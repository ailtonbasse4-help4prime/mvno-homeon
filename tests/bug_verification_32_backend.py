#!/usr/bin/env python3
"""Focused backend verification for /automacao-bloqueio false-positive blocking bug.

Creates tagged QA clients/cobrancas directly in MongoDB to exercise the three
payment-protection rules and whitelist behavior, then verifies the public API.
Run cleanup with: python bug_verification_32_backend.py --cleanup-only <tag>
"""
import argparse
import json
import os
import re
import sys
import uuid
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
import pymongo
import requests
from bson import ObjectId


ROOT = Path("/app")
FRONTEND_ENV = ROOT / "frontend" / ".env"
BACKEND_ENV = ROOT / "backend" / ".env"
TAG_FILE = ROOT / "test_reports" / "bug32_seed_tag.txt"
OUT_FILE = ROOT / "test_reports" / "bug32_backend_results.json"


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


def norm_name(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", s).strip().lower()


def cleanup(db, tag: str):
    client_ids = [str(x["_id"]) for x in db.clientes.find({"qa_tag": tag}, {"_id": 1})]
    result = {
        "tag": tag,
        "clientes": db.clientes.delete_many({"qa_tag": tag}).deleted_count,
        "linhas": db.linhas.delete_many({"qa_tag": tag}).deleted_count,
        "cobrancas": db.cobrancas.delete_many({"qa_tag": tag}).deleted_count,
        "whitelist": db.automacao_bloqueio_whitelist.delete_many({"qa_tag": tag}).deleted_count,
        "usuarios": db.usuarios.delete_many({"qa_tag": tag}).deleted_count,
        "client_ids": client_ids,
    }
    return result


def create_client_case(db, tag: str, label: str, cobrancas: list, whitelist: bool = False) -> dict:
    now = datetime.now(timezone.utc)
    cliente = {
        "nome": f"QA BUG32 {label} {tag}",
        "tipo_pessoa": "pf",
        "documento": str(abs(hash(f'{tag}-{label}')))[:11].ljust(11, "0"),
        "telefone": "11999999999",
        "email": f"qa-bug32-{label.lower().replace(' ', '-')}@example.com",
        "status": "ativo",
        "qa_tag": tag,
        "created_at": now,
    }
    cid = db.clientes.insert_one(cliente).inserted_id
    cid_s = str(cid)
    db.linhas.insert_one({
        "cliente_id": cid_s,
        "status": "ativo",
        "msisdn": "119" + str(abs(hash(cid_s)))[:8].ljust(8, "0"),
        "qa_tag": tag,
        "created_at": now,
    })
    inserted = []
    for c in cobrancas:
        doc = {
            "cliente_id": cid_s,
            "status": c["status"],
            "vencimento": c["vencimento"],
            "valor": c.get("valor", 12.34),
            "descricao": f"QA BUG32 {label}",
            "qa_tag": tag,
            "created_at": now,
        }
        if "paid_at" in c:
            doc["paid_at"] = c["paid_at"]
        inserted.append(str(db.cobrancas.insert_one(doc).inserted_id))
    if whitelist:
        db.automacao_bloqueio_whitelist.insert_one({
            "cliente_id": cid_s,
            "motivo": "QA BUG32 whitelist regression",
            "added_by": "qa",
            "added_by_name": "QA",
            "added_at": now,
            "qa_tag": tag,
        })
    return {"cliente_id": cid_s, "nome": cliente["nome"], "cobrancas": inserted, "whitelist": whitelist}


def find_named_clients(db):
    targets = {
        "Clarice": ["clarice", "santos", "freitas"],
        "Emidio": ["emidio", "souza", "duarte"],
    }
    found = {}
    candidates = list(db.clientes.find({"$or": [{"nome": re.compile("clarice", re.I)}, {"nome": re.compile("em", re.I)}, {"nome": re.compile("duarte", re.I)}]}, {"nome": 1}).limit(500))
    for doc in candidates:
        nn = norm_name(doc.get("nome"))
        for key, tokens in targets.items():
            if key not in found and all(t in nn for t in tokens):
                found[key] = {"id": str(doc["_id"]), "nome": doc.get("nome")}
    return found


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cleanup-only")
    args = parser.parse_args()

    be = parse_env(BACKEND_ENV)
    fe = parse_env(FRONTEND_ENV)
    base_url = fe.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
    client = pymongo.MongoClient(be["MONGO_URL"], serverSelectionTimeoutMS=5000)
    db = client[be["DB_NAME"]]

    if args.cleanup_only:
        print(json.dumps(cleanup(db, args.cleanup_only), indent=2, default=str))
        return 0

    tag = "BUG32-" + uuid.uuid4().hex[:8]
    TAG_FILE.write_text(tag)
    today = datetime.now(timezone.utc).date()
    overdue = (today - timedelta(days=60)).isoformat()
    older = (today - timedelta(days=90)).isoformat()
    future = (today + timedelta(days=30)).isoformat()
    month_start = today.replace(day=1).isoformat()
    same_month_paid = today.replace(day=min(2, today.day)).isoformat()
    recent_paid_dt = datetime.now(timezone.utc) - timedelta(days=5)

    created = {}
    checks = []
    failures = []

    def check(name, condition, detail=""):
        checks.append({"name": name, "passed": bool(condition), "detail": detail})
        if not condition:
            failures.append(f"{name}: {detail}")

    try:
        created["future_paid"] = create_client_case(db, tag, "FUTURE PAID", [
            {"status": "PENDING", "vencimento": overdue, "valor": 74.99},
            {"status": "RECEIVED", "vencimento": future, "valor": 74.99, "paid_at": datetime.now(timezone.utc)},
        ])
        created["recent_paid"] = create_client_case(db, tag, "RECENT PAID", [
            {"status": "PENDING", "vencimento": overdue, "valor": 39.99},
            {"status": "RECEIVED", "vencimento": older, "valor": 39.99, "paid_at": recent_paid_dt},
        ])
        created["same_month_duplicate"] = create_client_case(db, tag, "SAME MONTH DUP", [
            {"status": "PENDING", "vencimento": month_start, "valor": 55.55},
            {"status": "RECEIVED", "vencimento": same_month_paid, "valor": 55.55, "paid_at": datetime.now(timezone.utc)},
        ])
        created["true_delinquent"] = create_client_case(db, tag, "TRUE DELINQUENT", [
            {"status": "PENDING", "vencimento": overdue, "valor": 88.88},
        ])
        created["whitelist"] = create_client_case(db, tag, "WHITELIST", [
            {"status": "PENDING", "vencimento": overdue, "valor": 66.66},
        ], whitelist=True)

        session = requests.Session()
        login = session.post(
            f"{base_url}/api/auth/login",
            json={"email": "admin@mvno.com", "password": "admin123"},
            timeout=30,
        )
        check("admin login", login.status_code == 200, f"HTTP {login.status_code}: {login.text[:200]}")

        sim = session.get(f"{base_url}/api/automacao/bloqueio/simular", timeout=60)
        check("simular HTTP 200", sim.status_code == 200, f"HTTP {sim.status_code}: {sim.text[:300]}")
        sim_data = sim.json() if sim.status_code == 200 else {"itens": []}
        items = sim_data.get("itens", [])
        names = {norm_name(i.get("cliente_nome")): i for i in items}

        for key in ["future_paid", "recent_paid", "same_month_duplicate"]:
            nm = norm_name(created[key]["nome"])
            check(f"{key} absent from simular", nm not in names, f"present={names.get(nm)}")

        true_nm = norm_name(created["true_delinquent"]["nome"])
        wl_nm = norm_name(created["whitelist"]["nome"])
        check("true delinquent still appears", true_nm in names, "seeded truly overdue client missing")
        check("true delinquent action BLOQUEAR", names.get(true_nm, {}).get("acao") == "BLOQUEAR", json.dumps(names.get(true_nm, {}), default=str))
        check("whitelist still appears but skipped", wl_nm in names and names.get(wl_nm, {}).get("acao") == "SKIP_WHITELIST", json.dumps(names.get(wl_nm, {}), default=str))

        exact_clients = find_named_clients(db)
        for label in ["Clarice", "Emidio"]:
            if label in exact_clients:
                exact_nm = norm_name(exact_clients[label]["nome"])
                check(f"reported customer {label} absent from simular", exact_nm not in names, f"present={names.get(exact_nm)}")
            else:
                checks.append({"name": f"reported customer {label} found in preview DB", "passed": None, "detail": "not present in this preview database"})

        # Diagnosticar happy-path and summary behavior.
        diag_future = session.get(f"{base_url}/api/automacao/bloqueio/diagnosticar/{created['future_paid']['cliente_id']}", timeout=30)
        check("diagnosticar future_paid HTTP 200", diag_future.status_code == 200, diag_future.text[:300])
        if diag_future.status_code == 200:
            d = diag_future.json()
            check("diagnosticar schema includes required fields", all(k in d for k in ["cliente", "total_cobrancas", "cobrancas", "linhas", "candidatas_bloqueio", "resumo"]), json.dumps(list(d.keys())))
            check("diagnosticar future_paid not blocked", d.get("resumo", {}).get("seria_bloqueado") is False, json.dumps(d.get("resumo", {})))

        diag_true = session.get(f"{base_url}/api/automacao/bloqueio/diagnosticar/{created['true_delinquent']['cliente_id']}", timeout=30)
        check("diagnosticar true_delinquent HTTP 200", diag_true.status_code == 200, diag_true.text[:300])
        if diag_true.status_code == 200:
            d = diag_true.json()
            check("diagnosticar true_delinquent seria_bloqueado true", d.get("resumo", {}).get("seria_bloqueado") is True, json.dumps(d.get("resumo", {})))

        # Reported customers diagnostic if present.
        reported_diag = {}
        for label, info in exact_clients.items():
            r = session.get(f"{base_url}/api/automacao/bloqueio/diagnosticar/{info['id']}", timeout=30)
            reported_diag[label] = {"status": r.status_code, "body": r.json() if r.status_code == 200 else r.text[:300]}
            check(f"diagnosticar reported {label} HTTP 200", r.status_code == 200, r.text[:300])
            if r.status_code == 200:
                check(f"diagnosticar reported {label} not blocked", r.json().get("resumo", {}).get("seria_bloqueado") is False, json.dumps(r.json().get("resumo", {})))

        invalid = session.get(f"{base_url}/api/automacao/bloqueio/diagnosticar/not-a-valid-objectid", timeout=30)
        check("diagnosticar invalid id returns 400", invalid.status_code == 400, f"HTTP {invalid.status_code}: {invalid.text[:200]}")

        missing_oid = str(ObjectId())
        missing = session.get(f"{base_url}/api/automacao/bloqueio/diagnosticar/{missing_oid}", timeout=30)
        check("diagnosticar nonexistent id returns 404", missing.status_code == 404, f"HTTP {missing.status_code}: {missing.text[:200]}")

        noauth = requests.get(f"{base_url}/api/automacao/bloqueio/diagnosticar/{created['true_delinquent']['cliente_id']}", timeout=30)
        check("diagnosticar requires auth 401", noauth.status_code == 401, f"HTTP {noauth.status_code}: {noauth.text[:200]}")

        temp_user_id = db.usuarios.insert_one({
            "email": f"qa-bug32-{tag.lower()}@example.com",
            "name": "QA BUG32 Non Admin",
            "role": "atendente",
            "qa_tag": tag,
            "created_at": datetime.now(timezone.utc),
        }).inserted_id
        token = jwt.encode({
            "sub": str(temp_user_id),
            "email": f"qa-bug32-{tag.lower()}@example.com",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=30),
            "type": "access",
        }, be["JWT_SECRET"], algorithm="HS256")
        nonadmin = requests.get(
            f"{base_url}/api/automacao/bloqueio/diagnosticar/{created['true_delinquent']['cliente_id']}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        check("diagnosticar rejects non-admin 403", nonadmin.status_code == 403, f"HTTP {nonadmin.status_code}: {nonadmin.text[:200]}")

        result = {
            "tag": tag,
            "base_url": base_url,
            "created": created,
            "reported_clients_found": exact_clients,
            "simular_counts": {k: sim_data.get(k) for k in ["total", "a_bloquear", "skip_whitelist"]},
            "checks": checks,
            "failures": failures,
        }
        OUT_FILE.write_text(json.dumps(result, indent=2, default=str, ensure_ascii=False))
        print(json.dumps(result, indent=2, default=str, ensure_ascii=False))
        return 1 if failures else 0
    except Exception as exc:
        result = {"tag": tag, "error": repr(exc), "checks": checks, "failures": failures or [repr(exc)], "created": created}
        OUT_FILE.write_text(json.dumps(result, indent=2, default=str, ensure_ascii=False))
        print(json.dumps(result, indent=2, default=str, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())