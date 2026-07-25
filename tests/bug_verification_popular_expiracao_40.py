#!/usr/bin/env python3
"""Focused verification for POST /api/automacao/bloqueio/popular-expiracao-de-recarga.

This script checks the exact reported production symptom in preview:
- route is present in /openapi.json
- unauthenticated POST is not 404 and returns auth failure
- authenticated admin POST returns 200 with expected JSON shape
- sibling painel route still returns 200
"""
import json
import os
import sys
import time
from pathlib import Path

import requests


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://chip-manager-3.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@mvno.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
OUT = Path("/app/test_reports/runtime_popular_expiracao_40.json")


def record(results, name, ok, **details):
    item = {"name": name, "ok": bool(ok), **details}
    results.append(item)
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}: {details}")
    return ok


def main():
    session = requests.Session()
    results = []
    endpoint = f"{BASE_URL}/api/automacao/bloqueio/popular-expiracao-de-recarga"
    painel = f"{BASE_URL}/api/automacao/bloqueio/painel"

    # 1) OpenAPI registration proof. In this preview, public /openapi.json is served by
    # the frontend SPA, so route registration must be checked on the internal backend.
    try:
        r = requests.get("http://127.0.0.1:8001/openapi.json", timeout=30)
        openapi_ok = r.status_code == 200
        paths = r.json().get("paths", {}) if openapi_ok else {}
        route_path = "/api/automacao/bloqueio/popular-expiracao-de-recarga"
        route_registered = route_path in paths and "post" in paths.get(route_path, {})
        record(results, "openapi route registered", openapi_ok and route_registered,
               status_code=r.status_code, route_registered=route_registered)
    except Exception as exc:
        record(results, "openapi route registered", False, error=repr(exc))

    # 2) Unauthenticated request proves route exists (should be 401/403, not 404)
    try:
        r = requests.post(endpoint, timeout=30)
        record(results, "unauthenticated POST returns auth error not 404",
               r.status_code in (401, 403), status_code=r.status_code, body=r.text[:300])
    except Exception as exc:
        record(results, "unauthenticated POST returns auth error not 404", False, error=repr(exc))

    # 3) Login as admin
    headers = {}
    try:
        r = session.post(f"{BASE_URL}/api/auth/login",
                         json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
        access = r.cookies.get("access_token")
        if access:
            headers["Authorization"] = f"Bearer {access}"
        record(results, "admin login", r.status_code == 200 and bool(access),
               status_code=r.status_code, has_access_cookie=bool(access), body=r.text[:300])
    except Exception as exc:
        record(results, "admin login", False, error=repr(exc))

    # 4) Authenticated target endpoint. This is the user-visible button's backend action.
    post_json = None
    try:
        r = session.post(endpoint, headers=headers, timeout=60)
        try:
            post_json = r.json()
        except Exception:
            post_json = None
        expected_keys = ["ok", "atualizadas", "ja_preenchidas", "sem_proxima_recarga", "sem_proxima_recarga_invalida"]
        shape_ok = isinstance(post_json, dict) and post_json.get("ok") is True and all(
            isinstance(post_json.get(k), int) for k in expected_keys if k != "ok"
        )
        record(results, "authenticated POST popular-expiracao-de-recarga returns 200 valid JSON",
               r.status_code == 200 and shape_ok,
               status_code=r.status_code, json=post_json, body=None if post_json is not None else r.text[:500])
    except Exception as exc:
        record(results, "authenticated POST popular-expiracao-de-recarga returns 200 valid JSON", False, error=repr(exc))

    # 5) Regression check: sibling painel endpoint still works.
    try:
        r = session.get(painel, headers=headers, timeout=60)
        try:
            painel_json = r.json()
        except Exception:
            painel_json = None
        record(results, "GET painel still works",
               r.status_code == 200 and isinstance(painel_json, dict),
               status_code=r.status_code,
               top_level_keys=sorted(list(painel_json.keys()))[:20] if isinstance(painel_json, dict) else None,
               body=None if painel_json is not None else r.text[:500])
    except Exception as exc:
        record(results, "GET painel still works", False, error=repr(exc))

    summary = {
        "base_url": BASE_URL,
        "timestamp": int(time.time()),
        "results": results,
        "all_passed": all(item["ok"] for item in results),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0 if summary["all_passed"] else 1


if __name__ == "__main__":
    sys.exit(main())