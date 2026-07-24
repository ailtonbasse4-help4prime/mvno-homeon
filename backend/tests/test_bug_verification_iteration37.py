"""
Focused bug verification for Automacao de Bloqueio D-2 rule.
Creates isolated Mongo fixtures and validates backend API behavior only.
"""
import os
import time
from datetime import date, datetime, timedelta, timezone

import pytest
import requests
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@mvno.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
TEST_PREFIX = f"BUGVERIFY_D2_{int(time.time())}"
PAID_STATUSES = ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]


@pytest.fixture(scope="module")
def admin_session():
    session = requests.Session()
    resp = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert resp.status_code == 200, f"admin login failed {resp.status_code}: {resp.text}"
    return session


@pytest.fixture(scope="module")
def event_loop():
    import asyncio

    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module")
def db(event_loop):
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = AsyncIOMotorClient(mongo_url)
    yield client[db_name]
    client.close()


def awaitable(event_loop, coro):
    return event_loop.run_until_complete(coro)


async def cleanup(db):
    client_ids = [
        str(d["_id"])
        for d in await db.clientes.find({"nome": {"$regex": f"^{TEST_PREFIX}_"}}, {"_id": 1}).to_list(100)
    ]
    await db.automacao_bloqueio_whitelist.delete_many({"cliente_id": {"$in": client_ids}})
    await db.cobrancas.delete_many({"cliente_id": {"$in": client_ids}})
    await db.linhas.delete_many({"observacao": {"$regex": f"^{TEST_PREFIX}_"}})
    await db.chips.delete_many({"iccid": {"$regex": f"^{TEST_PREFIX}_"}})
    await db.clientes.delete_many({"nome": {"$regex": f"^{TEST_PREFIX}_"}})


async def seed_fixtures(db):
    await cleanup(db)
    today = date.today()
    assert today.isoformat() == "2026-07-24", f"test assumes preview date 2026-07-24, got {today.isoformat()}"

    specs = [
        # Exact names/dates mirroring reported production examples.
        {"key": "joelson", "nome": "Joelson_exp_2026_08_02", "exp": "2026-08-02", "expect_simular": False},
        {"key": "valdo", "nome": "Valdo_exp_2026_08_02", "exp": "2026-08-02", "expect_simular": False},
        {"key": "gilmar", "nome": "Gilmar_exp_2026_07_25", "exp": "2026-07-25", "expect_simular": True},
        # Generic edge cases requested by the main agent.
        {"key": "future_plus_10", "nome": "Futuro_plus_10", "exp": (today + timedelta(days=10)).isoformat(), "expect_simular": False},
        {"key": "plus_1", "nome": "Exp_hoje_plus_1", "exp": (today + timedelta(days=1)).isoformat(), "expect_simular": True},
        {"key": "past_3", "nome": "Exp_passado_3", "exp": (today - timedelta(days=3)).isoformat(), "expect_simular": True},
        {"key": "no_exp", "nome": "Sem_data_expiracao", "exp": None, "expect_simular": False},
        {"key": "paid_inside", "nome": "Pago_dentro_janela", "exp": (today + timedelta(days=1)).isoformat(), "expect_simular": False, "paid_vencimento_offset": -10},
        {"key": "paid_old", "nome": "Pago_mais_30d_antes", "exp": (today + timedelta(days=1)).isoformat(), "expect_simular": True, "paid_vencimento_offset": -31},
        {"key": "whitelist", "nome": "Cliente_whitelist", "exp": (today + timedelta(days=1)).isoformat(), "expect_simular": True, "whitelist": True, "expected_acao": "SKIP_WHITELIST"},
    ]

    by_key = {}
    for idx, spec in enumerate(specs, start=1):
        cliente_doc = {
            "nome": f"{TEST_PREFIX}_{spec['nome']}",
            "documento": f"{idx:011d}",
            "telefone": f"11999{idx:06d}",
            "ativo": True,
            "created_at": datetime.now(timezone.utc),
        }
        cliente_result = await db.clientes.insert_one(cliente_doc)
        cliente_id = str(cliente_result.inserted_id)
        chip_result = await db.chips.insert_one({
            "iccid": f"{TEST_PREFIX}_{spec['key']}",
            "status": "ativado",
            "created_at": datetime.now(timezone.utc),
        })
        line_doc = {
            "cliente_id": cliente_id,
            "chip_id": str(chip_result.inserted_id),
            "msisdn": f"5511999{idx:06d}",
            "numero": f"5511999{idx:06d}",
            "status": "ativo",
            "observacao": f"{TEST_PREFIX}_{spec['key']}",
            "created_at": datetime.now(timezone.utc),
        }
        if spec["exp"]:
            line_doc["data_expiracao_ta"] = spec["exp"]
        line_result = await db.linhas.insert_one(line_doc)

        # Pending current-cycle charge marks the client as delinquent without satisfying paid-cycle checks.
        pending_vencimento = spec["exp"] or today.isoformat()
        await db.cobrancas.insert_one({
            "cliente_id": cliente_id,
            "vencimento": pending_vencimento,
            "status": "PENDING",
            "valor": 99.9,
            "descricao": f"{TEST_PREFIX} pending {spec['key']}",
            "created_at": datetime.now(timezone.utc),
        })

        if "paid_vencimento_offset" in spec:
            paid_venc = (datetime.strptime(spec["exp"], "%Y-%m-%d").date() + timedelta(days=spec["paid_vencimento_offset"])).isoformat()
            await db.cobrancas.insert_one({
                "cliente_id": cliente_id,
                "vencimento": paid_venc,
                "status": PAID_STATUSES[0],
                "valor": 99.9,
                "descricao": f"{TEST_PREFIX} paid {spec['key']}",
                # Set old paid_at for the old-payment fixture so paid_at fallback cannot hide the bug.
                "paid_at": datetime.strptime(paid_venc, "%Y-%m-%d").replace(tzinfo=timezone.utc),
                "created_at": datetime.now(timezone.utc),
            })

        if spec.get("whitelist"):
            await db.automacao_bloqueio_whitelist.insert_one({
                "cliente_id": cliente_id,
                "motivo": "bug verification whitelist",
                "created_at": datetime.now(timezone.utc),
            })

        by_key[spec["key"]] = {
            **spec,
            "cliente_id": cliente_id,
            "line_id": str(line_result.inserted_id),
            "full_name": cliente_doc["nome"],
        }
    return by_key


def item_by_name(payload):
    return {item.get("cliente_nome"): item for item in payload.get("itens", [])}


def test_simular_d2_math_payment_window_whitelist_and_diagnostics(admin_session, db, event_loop):
    fixtures = awaitable(event_loop, seed_fixtures(db))
    try:
        resp = admin_session.get(f"{BASE_URL}/api/automacao/bloqueio/simular", timeout=60)
        assert resp.status_code == 200, f"simular failed {resp.status_code}: {resp.text}"
        data = resp.json()
        nomes = item_by_name(data)

        for key, fixture in fixtures.items():
            present = fixture["full_name"] in nomes
            assert present is fixture["expect_simular"], (
                f"unexpected simular presence for {key}: present={present}, expected={fixture['expect_simular']}. "
                f"returned test names={[n for n in nomes if n and n.startswith(TEST_PREFIX)]}"
            )

        # Direct proof of the reported bug examples.
        assert fixtures["joelson"]["full_name"] not in nomes, "Joelson expiring 2026-08-02 must not be listed on 2026-07-24"
        assert fixtures["valdo"]["full_name"] not in nomes, "Valdo expiring 2026-08-02 must not be listed on 2026-07-24"
        gilmar = nomes[fixtures["gilmar"]["full_name"]]
        assert gilmar["acao"] == "BLOQUEAR"
        assert gilmar["data_expiracao_ta"] == "2026-07-25"
        assert gilmar["origem"] == "expiracao_ta"
        assert all(line.get("data_expiracao_ta") for line in gilmar.get("linhas_afetadas", []))

        paid_old = nomes[fixtures["paid_old"]["full_name"]]
        assert paid_old["acao"] == "BLOQUEAR", "payment >30 days before Ta expiration must not count as current cycle paid"

        whitelist = nomes[fixtures["whitelist"]["full_name"]]
        assert whitelist["acao"] == "SKIP_WHITELIST"
        assert whitelist["na_whitelist"] is True

        diag = admin_session.get(
            f"{BASE_URL}/api/automacao/bloqueio/diagnosticar/{fixtures['gilmar']['cliente_id']}",
            timeout=30,
        )
        assert diag.status_code == 200, f"diagnosticar failed {diag.status_code}: {diag.text}"
        diag_json = diag.json()
        assert diag_json["cliente"]["nome"] == fixtures["gilmar"]["full_name"]
        assert "resumo" in diag_json and "cobrancas" in diag_json
    finally:
        awaitable(event_loop, cleanup(db))


def test_executar_dry_run_uses_same_d2_logic_without_blocking(admin_session, db, event_loop):
    fixtures = awaitable(event_loop, seed_fixtures(db))
    try:
        resp = admin_session.post(
            f"{BASE_URL}/api/automacao/bloqueio/executar",
            json={"dry_run": True, "dias_tolerancia": 0},
            timeout=60,
        )
        assert resp.status_code == 200, f"executar dry_run failed {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data["success"] is True
        assert data["dry_run"] is True

        detail_names = {d.get("cliente_nome") for d in data.get("detalhes", [])}
        assert fixtures["gilmar"]["full_name"] in detail_names
        assert fixtures["past_3"]["full_name"] in detail_names
        assert fixtures["paid_old"]["full_name"] in detail_names
        assert fixtures["joelson"]["full_name"] not in detail_names
        assert fixtures["valdo"]["full_name"] not in detail_names
        assert fixtures["no_exp"]["full_name"] not in detail_names
        assert fixtures["paid_inside"]["full_name"] not in detail_names
        # Whitelist clients are in simulation but skipped before detalhes/bloqueadas count.
        assert fixtures["whitelist"]["full_name"] not in detail_names

        # Dry run must not mutate line status or call Ta Telecom blocking path.
        test_line_ids = [ObjectId(f["line_id"]) for f in fixtures.values()]
        lines = awaitable(event_loop, db.linhas.find({"_id": {"$in": test_line_ids}}).to_list(100))
        assert {line.get("status") for line in lines} == {"ativo"}
    finally:
        awaitable(event_loop, cleanup(db))