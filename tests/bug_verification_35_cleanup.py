#!/usr/bin/env python3
"""Cleanup temporary BUG35 QA records."""
import json
import sys
from pathlib import Path

import pymongo


ROOT = Path("/app")
RESULT_FILE = ROOT / "test_reports" / "bug35_reconciliation_results.json"
OUT_FILE = ROOT / "test_reports" / "bug35_cleanup_results.json"


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


def cleanup(db, tag):
    return {
        "clientes": db.clientes.delete_many({"qa_tag": tag}).deleted_count,
        "cobrancas": db.cobrancas.delete_many({"qa_tag": tag}).deleted_count,
        "linhas": db.linhas.delete_many({"qa_tag": tag}).deleted_count,
        "usuarios": db.usuarios.delete_many({"qa_tag": tag}).deleted_count,
    }


def main():
    if len(sys.argv) > 1:
        tag = sys.argv[1]
    else:
        data = json.loads(RESULT_FILE.read_text())
        tag = data["tag"]
    env = parse_env(ROOT / "backend" / ".env")
    db = pymongo.MongoClient(env["MONGO_URL"], serverSelectionTimeoutMS=5000)[env["DB_NAME"]]
    deleted = cleanup(db, tag)
    remaining = {
        "clientes": db.clientes.count_documents({"qa_tag": tag}),
        "cobrancas": db.cobrancas.count_documents({"qa_tag": tag}),
        "linhas": db.linhas.count_documents({"qa_tag": tag}),
        "usuarios": db.usuarios.count_documents({"qa_tag": tag}),
    }
    result = {"tag": tag, "deleted": deleted, "remaining": remaining, "success": all(v == 0 for v in remaining.values())}
    OUT_FILE.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if result["success"] else 1


if __name__ == "__main__":
    raise SystemExit(main())