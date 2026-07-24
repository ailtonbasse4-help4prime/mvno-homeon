"""Regressao do BUG reportado no fork 37+ (24/07/2026):
- Cliente com data_expiracao_ta = 02/08 NAO pode aparecer para bloqueio hoje (24/07)
- Cliente com data_expiracao_ta = 25/07 DEVE aparecer para bloqueio hoje (24/07)
- Cliente sem data_expiracao_ta NUNCA deve ser bloqueado pela rotina (fail-safe).

Executa contra API rodando localmente + insere dados de fixture temporarios.
"""
import os
import pytest
import requests
from datetime import date, timedelta
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
ADMIN_EMAIL = "admin@mvno.com"
ADMIN_PASS = "admin123"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, f"login falhou {r.status_code}: {r.text}"
    return s


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module")
def db(event_loop):
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = AsyncIOMotorClient(mongo_url)
    return client[db_name]


TEST_PREFIX = "TEST_V2_MATH"


async def _seed_fixtures(db):
    hoje = date.today()
    exp_futuro = (hoje + timedelta(days=10)).isoformat()      # nao deve bloquear
    exp_hoje_plus_1 = (hoje + timedelta(days=1)).isoformat()  # DEVE bloquear (dentro janela D-2)
    exp_passado = (hoje - timedelta(days=3)).isoformat()       # DEVE bloquear

    clientes = [
        {"nome": f"{TEST_PREFIX}_Joelson_futuro", "documento": "111.111.111-11", "telefone": "11999990001", "exp": exp_futuro},
        {"nome": f"{TEST_PREFIX}_Gilmar_hoje", "documento": "222.222.222-22", "telefone": "11999990002", "exp": exp_hoje_plus_1},
        {"nome": f"{TEST_PREFIX}_atrasado", "documento": "333.333.333-33", "telefone": "11999990003", "exp": exp_passado},
        {"nome": f"{TEST_PREFIX}_semexp", "documento": "444.444.444-44", "telefone": "11999990004", "exp": None},
    ]

    # cleanup previo
    await db.clientes.delete_many({"nome": {"$regex": f"^{TEST_PREFIX}_"}})
    await db.linhas.delete_many({"observacao": {"$regex": f"^{TEST_PREFIX}"}})
    await db.chips.delete_many({"iccid": {"$regex": f"^{TEST_PREFIX}"}})

    for c in clientes:
        cli = {"nome": c["nome"], "documento": c["documento"], "telefone": c["telefone"], "ativo": True}
        r = await db.clientes.insert_one(cli)
        cid = str(r.inserted_id)
        chip = {"iccid": f"{TEST_PREFIX}_{c['documento']}", "status": "ativado"}
        rc = await db.chips.insert_one(chip)
        chip_id = str(rc.inserted_id)
        linha = {
            "cliente_id": cid,
            "chip_id": chip_id,
            "msisdn": f"55119999{c['documento'][-4:]}",
            "status": "ativo",
            "observacao": f"{TEST_PREFIX}_{c['nome']}",
        }
        if c["exp"]:
            linha["data_expiracao_ta"] = c["exp"]
        await db.linhas.insert_one(linha)

    return {c["nome"]: c for c in clientes}


async def _cleanup(db):
    await db.clientes.delete_many({"nome": {"$regex": f"^{TEST_PREFIX}_"}})
    await db.linhas.delete_many({"observacao": {"$regex": f"^{TEST_PREFIX}"}})
    await db.chips.delete_many({"iccid": {"$regex": f"^{TEST_PREFIX}"}})


def test_simulacao_expiracao_ta_math(admin_session, db, event_loop):
    """Bug fix: valida que a simulacao respeita hoje >= data_expiracao_ta - 2 dias."""
    seeded = event_loop.run_until_complete(_seed_fixtures(db))
    try:
        r = admin_session.get(f"{BASE_URL}/api/automacao/bloqueio/simular", timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        nomes = {it["cliente_nome"]: it for it in data.get("itens", [])}

        # Joelson (futuro) NAO pode aparecer
        assert f"{TEST_PREFIX}_Joelson_futuro" not in nomes, (
            f"BUG: cliente com expiracao futura (+10d) foi listado. "
            f"nomes listados: {list(nomes.keys())}"
        )
        # Sem exp NAO pode aparecer (fail-safe)
        assert f"{TEST_PREFIX}_semexp" not in nomes, (
            f"BUG: cliente sem data_expiracao_ta foi listado (legacy nao pode acionar). "
            f"nomes listados: {list(nomes.keys())}"
        )
        # Gilmar (exp = hoje+1, dentro janela D-2) DEVE aparecer
        assert f"{TEST_PREFIX}_Gilmar_hoje" in nomes, (
            f"BUG: cliente que expira em <=2 dias NAO foi listado. "
            f"nomes listados: {list(nomes.keys())}"
        )
        # Atrasado (exp = hoje-3) DEVE aparecer
        assert f"{TEST_PREFIX}_atrasado" in nomes, (
            f"BUG: cliente com expiracao ja passada NAO foi listado. "
            f"nomes listados: {list(nomes.keys())}"
        )

        # Verifica que a resposta traz data_expiracao_ta e origem
        gilmar = nomes[f"{TEST_PREFIX}_Gilmar_hoje"]
        assert gilmar.get("data_expiracao_ta"), "resposta sem data_expiracao_ta"
        assert gilmar.get("origem") == "expiracao_ta", f"origem errada: {gilmar.get('origem')}"
    finally:
        event_loop.run_until_complete(_cleanup(db))
