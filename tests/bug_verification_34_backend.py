#!/usr/bin/env python3
"""Focused backend verification for iteration 34 Asaas payment-history block simulation bug.

This script is intentionally read-only against Asaas: it only lists payments to
find existing customers for realistic local seed cases. It creates temporary
MongoDB-only customers/cobrancas/linhas, calls the real preview API, then cleans
up all tagged seed records.
"""
import asyncio
import json
import os
import random
import re
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pymongo
import requests
from bson import ObjectId


ROOT = Path("/app")
BACKEND_ENV = ROOT / "backend" / ".env"
FRONTEND_ENV = ROOT / "frontend" / ".env"
OUT_FILE = ROOT / "test_reports" / "bug34_backend_results.json"


def parse_env(path: Path) -> dict:
    data = {}
    for raw in path.read_text().splitlines():
        raw = raw.strip()
        if not raw or raw.startswith("#") or "=" not in raw:
            continue
        k, v = raw.split("=", 1)
        v = v.strip().strip('"')
        if len(v) >= 2 and v[0] == "'" and v[-1] == "'":
            v = v[1:-1]
        data[k.strip()] = v
    return data


def parse_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
    except Exception:
        return None


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def get_asaas_config(db, env):
    cfg = db.system_config.find_one({"key": "asaas_config"}) or {}
    key = cfg.get("api_key") or env.get("ASAAS_API_KEY") or ""
    environment = cfg.get("environment") or env.get("ASAAS_ENVIRONMENT") or "sandbox"
    base = "https://www.asaas.com/api/v3" if environment == "production" else "https://sandbox.asaas.com/api/v3"
    return key, environment, base


def find_asaas_recent_and_old_customers(db, env):
    """Return one customer with recent paid status and one with only old paid statuses."""
    key, environment, base = get_asaas_config(db, env)
    if not key:
        return {"configured": False, "environment": environment, "recent": None, "old_only": None, "error": "missing key"}

    cutoff = datetime.now(timezone.utc).date() - timedelta(days=60)
    headers = {"access_token": key, "User-Agent": "MVNOManager-QA/1.0"}
    by_customer = {}
    api_calls = []

    for status in ("RECEIVED", "CONFIRMED"):
        # Keep this bounded; enough for current preview/prod data and avoids hammering Asaas.
        for offset in range(0, 600, 100):
            resp = requests.get(
                f"{base}/payments",
                params={"status": status, "limit": 100, "offset": offset},
                headers=headers,
                timeout=30,
            )
            api_calls.append({"status": status, "offset": offset, "http": resp.status_code})
            if resp.status_code != 200:
                return {
                    "configured": True,
                    "environment": environment,
                    "recent": None,
                    "old_only": None,
                    "api_calls": api_calls,
                    "error": f"Asaas list payments HTTP {resp.status_code}: {resp.text[:200]}",
                }
            body = resp.json()
            data = body.get("data", []) if isinstance(body, dict) else []
            for p in data:
                customer = p.get("customer")
                if not customer:
                    continue
                paid_date = parse_date(p.get("paymentDate") or p.get("confirmedDate") or p.get("clientPaymentDate"))
                if not paid_date:
                    continue
                info = by_customer.setdefault(customer, {"customer_id": customer, "dates": [], "statuses": set()})
                info["dates"].append(paid_date)
                info["statuses"].add(status)
            if len(data) < 100:
                break

    recent = None
    old_only = None
    for info in by_customer.values():
        info["max_date"] = max(info["dates"])
        info["min_date"] = min(info["dates"])
        info["statuses"] = sorted(info["statuses"])
        if not recent and info["max_date"] >= cutoff:
            recent = info
        if not old_only and info["max_date"] < cutoff:
            old_only = info
        if recent and old_only:
            break

    def safe(info):
        if not info:
            return None
        return {
            "customer_id": info["customer_id"],
            "max_date": info["max_date"].isoformat(),
            "min_date": info["min_date"].isoformat(),
            "statuses": info["statuses"],
        }

    return {
        "configured": True,
        "environment": environment,
        "cutoff": cutoff.isoformat(),
        "recent": safe(recent),
        "old_only": safe(old_only),
        "customers_seen": len(by_customer),
        "api_calls": api_calls,
    }


def cleanup(db, tag: str):
    return {
        "clientes": db.clientes.delete_many({"qa_tag": tag}).deleted_count,
        "linhas": db.linhas.delete_many({"qa_tag": tag}).deleted_count,
        "cobrancas": db.cobrancas.delete_many({"qa_tag": tag}).deleted_count,
        "whitelist": db.automacao_bloqueio_whitelist.delete_many({"qa_tag": tag}).deleted_count,
    }


def create_case(db, tag, label, cobrancas, asaas_customer_id=None, whitelist=False):
    now = datetime.now(timezone.utc)
    doc = {
        "nome": f"QA BUG34 {label} {tag}",
        "tipo_pessoa": "pf",
        "documento": ("33" + str(random.randint(10**8, 10**9 - 1)))[:11],
        "telefone": "11999999999",
        "email": f"qa-bug33-{label.lower().replace(' ', '-')}@example.com",
        "status": "ativo",
        "qa_tag": tag,
        "created_at": now,
    }
    if asaas_customer_id:
        doc["asaas_customer_id"] = asaas_customer_id
    cid = db.clientes.insert_one(doc).inserted_id
    cid_s = str(cid)
    db.linhas.insert_one({
        "cliente_id": cid_s,
        "status": "ativo",
        "msisdn": "119" + str(random.randint(10**7, 10**8 - 1)),
        "qa_tag": tag,
        "created_at": now,
    })
    cobranca_ids = []
    for c in cobrancas:
        cob = {
            "cliente_id": cid_s,
            "status": c["status"],
            "vencimento": c["vencimento"],
            "valor": c.get("valor", 33.33),
            "descricao": f"QA BUG34 {label}",
            "qa_tag": tag,
            "created_at": now,
        }
        if "paid_at" in c:
            cob["paid_at"] = c["paid_at"]
        cobranca_ids.append(str(db.cobrancas.insert_one(cob).inserted_id))
    if whitelist:
        db.automacao_bloqueio_whitelist.insert_one({
            "cliente_id": cid_s,
            "motivo": "QA BUG34 whitelist regression",
            "added_by": "qa",
            "added_by_name": "QA",
            "added_at": now,
            "qa_tag": tag,
        })
    return {"id": cid_s, "nome": doc["nome"], "cobrancas": cobranca_ids, "asaas_customer_id": asaas_customer_id}


async def direct_helper_regression_tests():
    """Exercise _cliente_ja_pagou_no_mes with fake Asaas responses."""
    sys.path.insert(0, str(ROOT / "backend"))
    import routes.automacao_bloqueio as ab

    class FakeFind:
        def __init__(self, result=None):
            self.result = result
        async def to_list(self, n):
            return []

    class FakeCollection:
        def __init__(self, find_one_func=None):
            self.find_one_func = find_one_func or (lambda q: None)
        async def find_one(self, query, *args, **kwargs):
            return self.find_one_func(query)
        def find(self, *args, **kwargs):
            return FakeFind([])

    class FakeDB:
        def __init__(self, client_id, customer_id):
            self.cobrancas = FakeCollection(lambda q: None)
            self.clientes = FakeCollection(lambda q: {"_id": ObjectId(client_id), "asaas_customer_id": customer_id})

    class FakeAsaas:
        is_configured = True
        def __init__(self, payments=None, raise_error=False):
            self.payments = payments or []
            self.raise_error = raise_error
            self.calls = []
        async def list_payments(self, **kwargs):
            self.calls.append(kwargs)
            if self.raise_error:
                raise RuntimeError("simulated Asaas timeout")
            return {"data": self.payments if kwargs.get("status") == "RECEIVED" else []}

    original_db = ab._db
    original_asaas = ab._asaas_service
    fake_client_id = str(ObjectId())
    old_date = (datetime.now(timezone.utc).date() - timedelta(days=75)).isoformat()
    recent_date = (datetime.now(timezone.utc).date() - timedelta(days=10)).isoformat()
    results = []
    try:
        ab._db = FakeDB(fake_client_id, "cus_fake")

        ab._asaas_service = FakeAsaas([{"id": "pay_recent", "paymentDate": recent_date}])
        got_recent = await ab._cliente_ja_pagou_no_mes(fake_client_id, "2026-01-01")
        results.append({"case": "asaas_recent_received_returns_true", "expected": True, "actual": got_recent, "passed": got_recent is True})

        ab._asaas_service = FakeAsaas([{"id": "pay_old", "paymentDate": old_date}])
        got_old = await ab._cliente_ja_pagou_no_mes(fake_client_id, "2026-01-01")
        results.append({"case": "asaas_old_received_outside_60d_returns_false", "expected": False, "actual": got_old, "passed": got_old is False})

        ab._asaas_service = FakeAsaas([], raise_error=True)
        got_error = await ab._cliente_ja_pagou_no_mes(fake_client_id, "2026-01-01")
        results.append({"case": "asaas_error_does_not_crash_returns_false", "expected": False, "actual": got_error, "passed": got_error is False})
    finally:
        ab._db = original_db
        ab._asaas_service = original_asaas
    return results


def main():
    be = parse_env(BACKEND_ENV)
    fe = parse_env(FRONTEND_ENV)
    base_url = fe.get("REACT_APP_BACKEND_URL", "https://chip-manager-3.preview.emergentagent.com").rstrip("/")
    db = pymongo.MongoClient(be["MONGO_URL"], serverSelectionTimeoutMS=5000)[be["DB_NAME"]]
    tag = "BUG34-" + uuid.uuid4().hex[:8]
    today = datetime.now(timezone.utc).date()
    overdue = (today - timedelta(days=90)).isoformat()
    current_month_due = today.replace(day=1).isoformat()
    future_due = (today + timedelta(days=30)).isoformat()
    old_due = (today - timedelta(days=120)).isoformat()
    paid_50d = datetime.now(timezone.utc) - timedelta(days=50)

    checks, failures = [], []
    created = {}

    def check(name, condition, detail=""):
        row = {"name": name, "passed": bool(condition), "detail": detail}
        checks.append(row)
        if not condition:
            failures.append(f"{name}: {detail}")

    asaas_scan = find_asaas_recent_and_old_customers(db, be)

    try:
        if asaas_scan.get("recent"):
            created["asaas_recent_only"] = create_case(
                db, tag, "ASAAS RECENT ONLY",
                [{"status": "PENDING", "vencimento": overdue, "valor": 91.01}],
                asaas_customer_id=asaas_scan["recent"]["customer_id"],
            )
        else:
            checks.append({"name": "found real Asaas customer with recent paid payment", "passed": None, "detail": str(asaas_scan.get("error") or "not found")})

        if asaas_scan.get("old_only"):
            created["asaas_old_only"] = create_case(
                db, tag, "ASAAS OLD ONLY",
                [{"status": "PENDING", "vencimento": overdue, "valor": 92.02}],
                asaas_customer_id=asaas_scan["old_only"]["customer_id"],
            )
        else:
            checks.append({"name": "found real Asaas customer with only old paid payments", "passed": None, "detail": str(asaas_scan.get("error") or "not found")})

        created["local_same_month"] = create_case(db, tag, "LOCAL SAME MONTH", [
            {"status": "PENDING", "vencimento": current_month_due, "valor": 41.01},
            {"status": "RECEIVED", "vencimento": today.isoformat(), "valor": 41.01, "paid_at": datetime.now(timezone.utc)},
        ])
        created["local_future"] = create_case(db, tag, "LOCAL FUTURE", [
            {"status": "PENDING", "vencimento": overdue, "valor": 42.02},
            {"status": "RECEIVED", "vencimento": future_due, "valor": 42.02, "paid_at": datetime.now(timezone.utc)},
        ])
        created["local_60d"] = create_case(db, tag, "LOCAL 60D", [
            {"status": "PENDING", "vencimento": overdue, "valor": 43.03},
            {"status": "RECEIVED", "vencimento": old_due, "valor": 43.03, "paid_at": paid_50d},
        ])
        created["true_delinquent"] = create_case(db, tag, "TRUE DELINQUENT", [
            {"status": "PENDING", "vencimento": overdue, "valor": 44.04},
        ])
        created["whitelist"] = create_case(db, tag, "WHITELIST", [
            {"status": "PENDING", "vencimento": overdue, "valor": 45.05},
        ], whitelist=True)

        session = requests.Session()
        login = session.post(f"{base_url}/api/auth/login", json={"email": "admin@mvno.com", "password": "admin123"}, timeout=30)
        check("admin login succeeds", login.status_code == 200, f"HTTP {login.status_code}: {login.text[:200]}")

        t0 = time.time()
        sim = session.get(f"{base_url}/api/automacao/bloqueio/simular", timeout=180)
        elapsed = time.time() - t0
        check("simular HTTP 200", sim.status_code == 200, f"HTTP {sim.status_code}: {sim.text[:300]}")
        check("simular performance under 60s", elapsed < 60, f"elapsed={elapsed:.2f}s")
        sim_data = sim.json() if sim.status_code == 200 else {"itens": []}
        by_id = {item.get("cliente_id"): item for item in sim_data.get("itens", [])}

        if "asaas_recent_only" in created:
            cid = created["asaas_recent_only"]["id"]
            check("Asaas recent paid but local outdated customer absent from simular", cid not in by_id, json.dumps(by_id.get(cid), default=str))
        if "asaas_old_only" in created:
            cid = created["asaas_old_only"]["id"]
            check("Asaas old-only paid customer still appears as delinquent", cid in by_id and by_id.get(cid, {}).get("acao") == "BLOQUEAR", json.dumps(by_id.get(cid), default=str))

        for key in ("local_same_month", "local_future", "local_60d"):
            cid = created[key]["id"]
            check(f"{key} protected and absent from simular", cid not in by_id, json.dumps(by_id.get(cid), default=str))

        td_id = created["true_delinquent"]["id"]
        wl_id = created["whitelist"]["id"]
        check("true delinquent appears with BLOQUEAR", td_id in by_id and by_id.get(td_id, {}).get("acao") == "BLOQUEAR", json.dumps(by_id.get(td_id), default=str))
        check("whitelist customer appears with SKIP_WHITELIST", wl_id in by_id and by_id.get(wl_id, {}).get("acao") == "SKIP_WHITELIST", json.dumps(by_id.get(wl_id), default=str))

        clarice_id = "69d023bc83caf2c1f9c09efe"
        check("Clarice absent from current simular", clarice_id not in by_id, json.dumps(by_id.get(clarice_id), default=str))
        diag_clarice = session.get(f"{base_url}/api/automacao/bloqueio/diagnosticar/{clarice_id}", timeout=60)
        check("diagnosticar Clarice HTTP 200", diag_clarice.status_code == 200, diag_clarice.text[:300])
        if diag_clarice.status_code == 200:
            body = diag_clarice.json()
            check("diagnosticar Clarice says not blocked", body.get("resumo", {}).get("seria_bloqueado") is False, json.dumps(body.get("resumo", {}), default=str))

        # Diagnostic endpoint regression on seeded customers.
        diag_recent_summary = None
        diag_old_summary = None
        if "asaas_recent_only" in created:
            r = session.get(f"{base_url}/api/automacao/bloqueio/diagnosticar/{created['asaas_recent_only']['id']}", timeout=90)
            check("diagnosticar Asaas recent HTTP 200", r.status_code == 200, r.text[:300])
            if r.status_code == 200:
                diag_recent_summary = r.json().get("resumo", {})
                check("diagnosticar Asaas recent says not blocked", diag_recent_summary.get("seria_bloqueado") is False, json.dumps(diag_recent_summary, default=str))
        if "asaas_old_only" in created:
            r = session.get(f"{base_url}/api/automacao/bloqueio/diagnosticar/{created['asaas_old_only']['id']}", timeout=90)
            check("diagnosticar Asaas old-only HTTP 200", r.status_code == 200, r.text[:300])
            if r.status_code == 200:
                diag_old_summary = r.json().get("resumo", {})
                check("diagnosticar Asaas old-only says blocked", diag_old_summary.get("seria_bloqueado") is True, json.dumps(diag_old_summary, default=str))

        direct_helper = asyncio.run(direct_helper_regression_tests())
        for item in direct_helper:
            check(f"direct helper {item['case']}", item["passed"], f"expected={item['expected']} actual={item['actual']}")

        result = {
            "tag": tag,
            "base_url": base_url,
            "test_plan": [
                "Verify admin /api/automacao/bloqueio/simular excludes a locally overdue customer when Asaas has a RECEIVED/CONFIRMED payment within 60 days.",
                "Verify Clarice is absent and /diagnosticar reports she would not be blocked.",
                "Verify local same-month, future-paid, and 50-days paid_at protections still work.",
                "Verify truly delinquent and whitelist customers still appear with correct actions.",
                "Verify old Asaas payments outside 60 days do not incorrectly protect a delinquent customer.",
            ],
            "asaas_scan": asaas_scan,
            "created": created,
            "simular_counts": {k: sim_data.get(k) for k in ("total", "a_bloquear", "skip_whitelist")},
            "simular_elapsed_seconds": round(elapsed, 3),
            "diag_recent_summary": diag_recent_summary,
            "diag_old_summary": diag_old_summary,
            "direct_helper": direct_helper,
            "checks": checks,
            "failures": failures,
        }
        return_code = 1 if failures else 0
    except Exception as exc:
        result = {"tag": tag, "error": repr(exc), "checks": checks, "failures": failures or [repr(exc)], "asaas_scan": asaas_scan, "created": created}
        return_code = 1
    finally:
        result["cleanup"] = cleanup(db, tag)
        OUT_FILE.write_text(json.dumps(result, indent=2, default=str, ensure_ascii=False))
        print(json.dumps(result, indent=2, default=str, ensure_ascii=False))

    return return_code


if __name__ == "__main__":
    raise SystemExit(main())