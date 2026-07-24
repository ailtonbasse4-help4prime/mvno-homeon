#!/usr/bin/env python3
"""Focused verification for cobrança/Asaas reconciliation bug.

The bug: Clarice's June boleto stayed PENDING locally because the customer paid a
different Asaas payment id. This script seeds temporary local MongoDB records that
point to real read-only Asaas production payments, calls the preview API, and
leaves one tagged pending row for the browser/UI test. A separate cleanup script
removes all tagged data after the UI test.
"""
import json
import random
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

import bcrypt
import pymongo
import requests
from bson import ObjectId


ROOT = Path("/app")
BACKEND_ENV = ROOT / "backend" / ".env"
FRONTEND_ENV = ROOT / "frontend" / ".env"
OUT_FILE = ROOT / "test_reports" / "bug35_reconciliation_results.json"


def parse_env(path: Path) -> dict:
    data = {}
    if not path.exists():
        return data
    for raw in path.read_text().splitlines():
        raw = raw.strip()
        if not raw or raw.startswith("#") or "=" not in raw:
            continue
        key, value = raw.split("=", 1)
        value = value.strip().strip('"')
        if len(value) >= 2 and value[0] == "'" and value[-1] == "'":
            value = value[1:-1]
        data[key.strip()] = value
    return data


def get_asaas_config(db, env):
    cfg = db.system_config.find_one({"key": "asaas_config"}) or {}
    key = (cfg.get("api_key") or env.get("ASAAS_API_KEY") or "").strip().strip("'\"")
    environment = cfg.get("environment") or env.get("ASAAS_ENVIRONMENT") or "sandbox"
    base = "https://www.asaas.com/api/v3" if environment == "production" else "https://sandbox.asaas.com/api/v3"
    return key, environment, base


def find_paid_payment_candidates(db, env, needed=3):
    """Find real paid Asaas payments with customer, value, dueDate and id.

    Read-only; bounded to avoid rate-limit.
    """
    key, environment, base = get_asaas_config(db, env)
    result = {"configured": bool(key), "environment": environment, "api_calls": [], "payments": []}
    if not key:
        result["error"] = "missing Asaas key"
        return result

    headers = {"access_token": key, "User-Agent": "MVNOManager-QA/1.0"}
    seen = set()
    for status in ("RECEIVED", "CONFIRMED"):
        for offset in (0, 100, 200):
            resp = requests.get(
                f"{base}/payments",
                params={"status": status, "limit": 100, "offset": offset},
                headers=headers,
                timeout=30,
            )
            result["api_calls"].append({"status": status, "offset": offset, "http": resp.status_code})
            if resp.status_code != 200:
                result["error"] = f"Asaas HTTP {resp.status_code}: {resp.text[:200]}"
                return result
            data = resp.json().get("data", [])
            for p in data:
                pid = p.get("id")
                if not pid or pid in seen:
                    continue
                if not p.get("customer") or not p.get("dueDate"):
                    continue
                try:
                    value = float(p.get("value", 0))
                except Exception:
                    continue
                if value <= 0:
                    continue
                seen.add(pid)
                result["payments"].append({
                    "id": pid,
                    "customer": p.get("customer"),
                    "value": value,
                    "dueDate": str(p.get("dueDate"))[:10],
                    "status": p.get("status") or status,
                    "paymentDate": p.get("paymentDate") or p.get("confirmedDate") or p.get("clientPaymentDate"),
                })
                if len(result["payments"]) >= needed:
                    return result
            if len(data) < 100:
                break
    return result


def cleanup_tag(db, tag):
    return {
        "clientes": db.clientes.delete_many({"qa_tag": tag}).deleted_count,
        "cobrancas": db.cobrancas.delete_many({"qa_tag": tag}).deleted_count,
        "linhas": db.linhas.delete_many({"qa_tag": tag}).deleted_count,
        "usuarios": db.usuarios.delete_many({"qa_tag": tag}).deleted_count,
    }


def random_doc():
    return ("35" + str(random.randint(10**8, 10**9 - 1)))[:11]


def create_cliente(db, tag, label, asaas_customer_id=None):
    doc = {
        "nome": f"QA BUG35 {label} {tag}",
        "tipo_pessoa": "pf",
        "documento": random_doc(),
        "telefone": "11999999999",
        "email": f"qa-bug35-{label.lower().replace(' ', '-')}-{tag.lower()}@example.com",
        "status": "ativo",
        "qa_tag": tag,
        "created_at": datetime.now(timezone.utc),
    }
    if asaas_customer_id:
        doc["asaas_customer_id"] = asaas_customer_id
    cid = db.clientes.insert_one(doc).inserted_id
    db.linhas.insert_one({
        "cliente_id": str(cid),
        "status": "ativo",
        "msisdn": "119" + str(random.randint(10**7, 10**8 - 1)),
        "qa_tag": tag,
        "created_at": datetime.now(timezone.utc),
    })
    return {"id": str(cid), "nome": doc["nome"], "asaas_customer_id": asaas_customer_id}


def create_cobranca(db, tag, cliente_id, label, *, valor, vencimento, status="PENDING", asaas_payment_id=None):
    doc = {
        "cliente_id": cliente_id,
        "billing_type": "BOLETO",
        "valor": float(valor),
        "vencimento": vencimento,
        "descricao": f"QA BUG35 {label} {tag}",
        "status": status,
        "modalidade": "avista",
        "qa_tag": tag,
        "created_at": datetime.now(timezone.utc),
    }
    if asaas_payment_id:
        doc["asaas_payment_id"] = asaas_payment_id
    if status in ("RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"):
        doc["paid_at"] = datetime.now(timezone.utc).isoformat()
    inserted = db.cobrancas.insert_one(doc).inserted_id
    return str(inserted)


def create_nonadmin_user(db, tag):
    email = f"qa-bug35-atendente-{tag.lower()}@example.com"
    password = "qa123456"
    uid = db.usuarios.insert_one({
        "email": email,
        "name": f"QA BUG35 Atendente {tag}",
        "role": "atendente",
        "password_hash": bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode(),
        "qa_tag": tag,
        "created_at": datetime.now(timezone.utc),
    }).inserted_id
    return {"id": str(uid), "email": email, "password": password}


def post_reconcile(session, base_url, cliente_id):
    return session.post(f"{base_url}/api/carteira/reconciliar-cliente/{cliente_id}", json={}, timeout=90)


def main():
    be = parse_env(BACKEND_ENV)
    fe = parse_env(FRONTEND_ENV)
    base_url = fe.get("REACT_APP_BACKEND_URL", "https://chip-manager-3.preview.emergentagent.com").rstrip("/")
    db = pymongo.MongoClient(be["MONGO_URL"], serverSelectionTimeoutMS=5000)[be["DB_NAME"]]
    tag = "BUG35-" + uuid.uuid4().hex[:8]
    cleanup_tag(db, tag)

    checks = []
    failures = []
    responses = {}
    created = {}

    def check(name, condition, detail=""):
        row = {"name": name, "passed": bool(condition), "detail": detail}
        checks.append(row)
        if not condition:
            failures.append(f"{name}: {detail}")

    asaas_scan = find_paid_payment_candidates(db, be, needed=3)
    payments = asaas_scan.get("payments", [])

    try:
        check("real Asaas paid payment candidates found", len(payments) >= 1, json.dumps(asaas_scan, ensure_ascii=False)[:800])
        if not payments:
            raise RuntimeError("No usable paid Asaas payments found; cannot test reconciliation source-of-truth")
        p_direct = payments[0]
        p_recon = payments[1] if len(payments) > 1 else payments[0]
        p_ui = payments[2] if len(payments) > 2 else payments[0]

        created["nonadmin_user"] = create_nonadmin_user(db, tag)
        created["direct_client"] = create_cliente(db, tag, "DIRECT", p_direct["customer"])
        created["direct_cobranca_id"] = create_cobranca(
            db, tag, created["direct_client"]["id"], "DIRECT",
            valor=p_direct["value"], vencimento=p_direct["dueDate"], status="PENDING", asaas_payment_id=p_direct["id"])
        created["recon_client"] = create_cliente(db, tag, "RECON", p_recon["customer"])
        created["recon_cobranca_id"] = create_cobranca(
            db, tag, created["recon_client"]["id"], "RECON",
            valor=p_recon["value"], vencimento=p_recon["dueDate"], status="PENDING", asaas_payment_id=f"pay_bug35_different_{uuid.uuid4().hex[:8]}")
        created["no_pending_client"] = create_cliente(db, tag, "NO PENDING", p_recon["customer"])
        created["no_pending_cobranca_id"] = create_cobranca(
            db, tag, created["no_pending_client"]["id"], "NO PENDING",
            valor=p_recon["value"], vencimento=p_recon["dueDate"], status="RECEIVED")
        created["no_asaas_client"] = create_cliente(db, tag, "NO ASAAS", None)
        created["ui_client"] = create_cliente(db, tag, "UI RECON", p_ui["customer"])
        created["ui_cobranca_id"] = create_cobranca(
            db, tag, created["ui_client"]["id"], "UI RECON",
            valor=p_ui["value"], vencimento=p_ui["dueDate"], status="PENDING", asaas_payment_id=f"pay_bug35_ui_different_{uuid.uuid4().hex[:8]}")
        created["payments_used"] = {"direct": p_direct, "recon": p_recon, "ui": p_ui}

        admin = requests.Session()
        login = admin.post(f"{base_url}/api/auth/login", json={"email": "admin@mvno.com", "password": "admin123"}, timeout=30)
        check("admin login succeeds", login.status_code == 200, f"HTTP {login.status_code}: {login.text[:200]}")

        noauth = requests.post(f"{base_url}/api/carteira/reconciliar-cliente/{created['recon_client']['id']}", json={}, timeout=30)
        responses["noauth"] = {"status": noauth.status_code, "body": noauth.text[:300]}
        check("reconcile requires auth (401)", noauth.status_code == 401, json.dumps(responses["noauth"], ensure_ascii=False))

        nonadmin = requests.Session()
        nonadmin_login = nonadmin.post(
            f"{base_url}/api/auth/login",
            json={"email": created["nonadmin_user"]["email"], "password": created["nonadmin_user"]["password"]},
            timeout=30,
        )
        check("non-admin login succeeds", nonadmin_login.status_code == 200, f"HTTP {nonadmin_login.status_code}: {nonadmin_login.text[:200]}")
        forbidden = post_reconcile(nonadmin, base_url, created["recon_client"]["id"])
        responses["forbidden"] = {"status": forbidden.status_code, "body": forbidden.text[:300]}
        check("reconcile rejects non-admin (403)", forbidden.status_code == 403, json.dumps(responses["forbidden"], ensure_ascii=False))

        invalid = post_reconcile(admin, base_url, "cliente-invalido")
        responses["invalid"] = {"status": invalid.status_code, "body": invalid.text[:300]}
        check("invalid cliente_id returns 400", invalid.status_code == 400, json.dumps(responses["invalid"], ensure_ascii=False))

        missing_id = str(ObjectId())
        missing = post_reconcile(admin, base_url, missing_id)
        responses["missing"] = {"status": missing.status_code, "body": missing.text[:300]}
        check("nonexistent cliente_id returns 404", missing.status_code == 404, json.dumps(responses["missing"], ensure_ascii=False))

        noasaas = post_reconcile(admin, base_url, created["no_asaas_client"]["id"])
        responses["noasaas"] = {"status": noasaas.status_code, "body": noasaas.text[:300]}
        check("cliente without asaas_customer_id returns 400", noasaas.status_code == 400, json.dumps(responses["noasaas"], ensure_ascii=False))

        nopending = post_reconcile(admin, base_url, created["no_pending_client"]["id"])
        responses["nopending"] = {"status": nopending.status_code, "body": nopending.text[:1000]}
        nopending_json = nopending.json() if nopending.status_code == 200 else {}
        check("no-pending client returns 200", nopending.status_code == 200, responses["nopending"]["body"])
        check("no-pending client updates zero", nopending_json.get("atualizadas_por_payment_id") == 0 and nopending_json.get("atualizadas_por_conciliacao") == 0, json.dumps(nopending_json, ensure_ascii=False))

        direct = post_reconcile(admin, base_url, created["direct_client"]["id"])
        responses["direct"] = {"status": direct.status_code, "body": direct.text[:1200]}
        direct_json = direct.json() if direct.status_code == 200 else {}
        direct_doc = db.cobrancas.find_one({"_id": ObjectId(created["direct_cobranca_id"])})
        check("direct payment-id sync returns 200", direct.status_code == 200, responses["direct"]["body"])
        check("direct payment-id sync count is 1", direct_json.get("atualizadas_por_payment_id") == 1, json.dumps(direct_json, ensure_ascii=False))
        check("direct cobrança persisted as paid", direct_doc.get("status") in ("RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH") and direct_doc.get("paid_at"), json.dumps({k: direct_doc.get(k) for k in ("status", "paid_at", "asaas_payment_id")}, default=str))

        recon = post_reconcile(admin, base_url, created["recon_client"]["id"])
        responses["recon"] = {"status": recon.status_code, "body": recon.text[:1200]}
        recon_json = recon.json() if recon.status_code == 200 else {}
        recon_doc = db.cobrancas.find_one({"_id": ObjectId(created["recon_cobranca_id"])})
        check("value/date reconciliation returns 200", recon.status_code == 200, responses["recon"]["body"])
        check("value/date reconciliation count is 1", recon_json.get("atualizadas_por_conciliacao") == 1, json.dumps(recon_json, ensure_ascii=False))
        check("value/date cobrança persisted RECEIVED with reconciliada_por", recon_doc.get("status") == "RECEIVED" and bool(recon_doc.get("reconciliada_por")) and recon_doc.get("reconciliada_por") != recon_doc.get("asaas_payment_id"), json.dumps({k: recon_doc.get(k) for k in ("status", "paid_at", "reconciliada_por", "asaas_payment_id")}, default=str))

        clarice_id = "69d023bc83caf2c1f9c09efe"
        clarice_before = list(db.cobrancas.find({"cliente_id": clarice_id, "vencimento": "2026-06-25", "valor": {"$gte": 74.98, "$lte": 75.00}}))
        if db.clientes.find_one({"_id": ObjectId(clarice_id)}):
            clarice_resp = post_reconcile(admin, base_url, clarice_id)
            responses["clarice"] = {"status": clarice_resp.status_code, "body": clarice_resp.text[:1200]}
            clarice_after = list(db.cobrancas.find({"cliente_id": clarice_id, "vencimento": "2026-06-25", "valor": {"$gte": 74.98, "$lte": 75.00}}))
            target_exists = len(clarice_after) > 0
            still_pending = [str(d["_id"]) for d in clarice_after if d.get("status") not in ("CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH")]
            check("Clarice June R$74.99 cobrança exists in preview", target_exists, f"before={len(clarice_before)} after={len(clarice_after)}")
            check("Clarice June R$74.99 cobrança is not pending after reconcile", target_exists and not still_pending, json.dumps({"before": [{"id": str(d["_id"]), "status": d.get("status"), "reconciliada_por": d.get("reconciliada_por")} for d in clarice_before], "after": [{"id": str(d["_id"]), "status": d.get("status"), "reconciliada_por": d.get("reconciliada_por")} for d in clarice_after], "response": responses["clarice"]}, default=str, ensure_ascii=False))

            # Also verify the cobrança list API no longer exposes the specific June charge as Pendente.
            list_resp = admin.get(f"{base_url}/api/carteira/cobrancas", params={"cliente_id": clarice_id, "limit": 50}, timeout=60)
            list_json = list_resp.json() if list_resp.status_code == 200 else []
            matching = [c for c in list_json if c.get("vencimento") == "2026-06-25" and abs(float(c.get("valor", 0)) - 74.99) <= 0.01]
            check("/cobrancas API shows Clarice June charge not pending", list_resp.status_code == 200 and matching and all(c.get("status") in ("CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH") for c in matching), json.dumps(matching, ensure_ascii=False))
        else:
            check("Clarice client exists in preview", False, f"cliente_id {clarice_id} not found")

        result = {
            "tag": tag,
            "base_url": base_url,
            "asaas_scan": asaas_scan,
            "created": created,
            "responses": responses,
            "checks": checks,
            "failures": failures,
            "cleanup": "pending - run bug_verification_35_cleanup.py after browser/UI test",
        }
        return_code = 1 if failures else 0
    except Exception as exc:
        result = {
            "tag": tag,
            "base_url": base_url,
            "asaas_scan": asaas_scan,
            "created": created,
            "responses": responses,
            "checks": checks,
            "failures": failures or [repr(exc)],
            "error": repr(exc),
            "cleanup": "pending - run bug_verification_35_cleanup.py after inspection/browser test",
        }
        return_code = 1

    OUT_FILE.write_text(json.dumps(result, indent=2, default=str, ensure_ascii=False))
    print(json.dumps(result, indent=2, default=str, ensure_ascii=False))
    return return_code


if __name__ == "__main__":
    raise SystemExit(main())