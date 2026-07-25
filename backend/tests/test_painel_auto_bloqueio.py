"""
Tests for the new Painel Central + D-3/D-0 automation endpoints.

Covers:
- GET  /api/automacao/bloqueio/painel: structure, KPIs, situacao classification.
- PUT  /api/automacao/bloqueio/config: new fields + hora_alerta_d0 validation.
- POST /api/automacao/bloqueio/enviar-lembrete: d3 dedup + d0 no dedup + tipo validation.
- POST /api/automacao/bloqueio/executar-lembrete-d3: job structure.
- POST /api/automacao/bloqueio/executar-alerta-d0: job structure.
- Non-regression: /simular D-2 rule (exp > hoje+2 excluded).
"""
import os
import time
import uuid
import copy
from datetime import date, datetime, timedelta, timezone

import pytest
import requests
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@mvno.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
TEST_PREFIX = f"TEST_PAINEL_{int(time.time())}"


# ---------------- fixtures ----------------

@pytest.fixture(scope="module")
def admin_session():
    session = requests.Session()
    resp = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert resp.status_code == 200, f"admin login failed {resp.status_code}: {resp.text}"
    # Emergent preview issues httpOnly cookies but Session sometimes fails to reuse them
    # across requests (Cloudflare cookie domain). Extract access_token and set Bearer header.
    access = resp.cookies.get("access_token")
    if access:
        session.headers.update({"Authorization": f"Bearer {access}"})
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


def run(loop, coro):
    return loop.run_until_complete(coro)


# ---------------- seed helpers ----------------

async def _cleanup(db):
    cids = [str(d["_id"]) async for d in db.clientes.find({"nome": {"$regex": f"^{TEST_PREFIX}_"}}, {"_id": 1})]
    await db.automacao_bloqueio_whitelist.delete_many({"cliente_id": {"$in": cids}})
    await db.cobrancas.delete_many({"cliente_id": {"$in": cids}})
    await db.linhas.delete_many({"observacao": {"$regex": f"^{TEST_PREFIX}_"}})
    await db.chips.delete_many({"iccid": {"$regex": f"^{TEST_PREFIX}_"}})
    await db.automacao_lembretes_log.delete_many({"cliente_id": {"$in": cids}})
    await db.clientes.delete_many({"nome": {"$regex": f"^{TEST_PREFIX}_"}})


async def _seed_case(db, key, nome_suffix, exp, status_linha="ativo", with_pending_cob=True,
                     paid_cycle=False, whitelist=False, confianca_days=None):
    today = date.today()
    nome = f"{TEST_PREFIX}_{nome_suffix}"
    uniq = uuid.uuid4().hex[:10]
    cli = await db.clientes.insert_one({
        "nome": nome, "documento": f"9{uniq}",
        "telefone": f"11{uniq[:9]}", "ativo": True,
        "created_at": datetime.now(timezone.utc),
    })
    cid = str(cli.inserted_id)
    chip = await db.chips.insert_one({
        "iccid": f"{TEST_PREFIX}_{key}_{uniq}", "status": "ativado",
        "created_at": datetime.now(timezone.utc),
    })
    line_doc = {
        "cliente_id": cid, "chip_id": str(chip.inserted_id),
        "msisdn": f"5511{uniq}",
        "numero": f"5511{uniq}",
        "status": status_linha,
        "observacao": f"{TEST_PREFIX}_{key}",
        "created_at": datetime.now(timezone.utc),
    }
    if exp:
        line_doc["data_expiracao_ta"] = exp
    if confianca_days is not None:
        line_doc["desbloqueio_confianca_ate"] = (today + timedelta(days=confianca_days)).isoformat()
    line = await db.linhas.insert_one(line_doc)

    if with_pending_cob and exp:
        await db.cobrancas.insert_one({
            "cliente_id": cid, "vencimento": exp, "status": "PENDING",
            "valor": 89.9, "descricao": f"{TEST_PREFIX} pending {key}",
            "created_at": datetime.now(timezone.utc),
        })
    if paid_cycle and exp:
        await db.cobrancas.insert_one({
            "cliente_id": cid,
            "vencimento": (datetime.strptime(exp, "%Y-%m-%d").date() - timedelta(days=5)).isoformat(),
            "status": "RECEIVED", "valor": 89.9,
            "descricao": f"{TEST_PREFIX} paid {key}",
            "paid_at": datetime.now(timezone.utc),
            "created_at": datetime.now(timezone.utc),
        })
    if whitelist:
        await db.automacao_bloqueio_whitelist.insert_one({
            "cliente_id": cid, "motivo": "test vip",
            "created_at": datetime.now(timezone.utc),
        })
    return {"cliente_id": cid, "linha_id": str(line.inserted_id), "nome": nome}


async def _seed_all(db):
    await _cleanup(db)
    today = date.today()
    plus = lambda n: (today + timedelta(days=n)).isoformat()  # noqa: E731
    fixtures = {}
    # em_dia: paid + exp far in future (>+5 blocking days => exp>7)
    fixtures["em_dia"] = await _seed_case(db, "em_dia", "em_dia", plus(20), paid_cycle=True, with_pending_cob=False)
    # avisar: dias_ate_bloqueio in [1..5]  => exp in [3..7]
    fixtures["avisar"] = await _seed_case(db, "avisar", "avisar", plus(5))  # bloq = +3 => avisar
    # vence_hoje: dias_ate_bloqueio == 0 => exp = +2
    fixtures["vence_hoje"] = await _seed_case(db, "vence_hoje", "vence_hoje", plus(2))
    # vencido: dias_ate_bloqueio < 0 => exp < +2 (use exp = -3)
    fixtures["vencido"] = await _seed_case(db, "vencido", "vencido", plus(-3))
    # bloqueado: status=bloqueado
    fixtures["bloqueado"] = await _seed_case(db, "bloqueado", "bloqueado", plus(-3), status_linha="bloqueado")
    # sem_expiracao
    fixtures["sem_expiracao"] = await _seed_case(db, "sem_exp", "sem_exp", None)
    # vip
    fixtures["vip"] = await _seed_case(db, "vip", "vip", plus(-3), whitelist=True)
    # confianca
    fixtures["confianca"] = await _seed_case(db, "conf", "conf", plus(-3), confianca_days=3)
    # d3 candidate: dias_ate_bloqueio == 3 => exp = +5 (falls under avisar 1..5)
    fixtures["d3_target"] = await _seed_case(db, "d3", "d3_target", plus(5))
    return fixtures


# ---------------- tests ----------------

def test_painel_structure_and_situacoes(admin_session, db, event_loop):
    fx = run(event_loop, _seed_all(db))
    try:
        r = admin_session.get(f"{BASE_URL}/api/automacao/bloqueio/painel", timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        # Top-level structure
        assert "itens" in data and "kpis" in data and "hoje" in data
        assert isinstance(data["itens"], list)
        for k in ["ativas", "bloqueadas", "vence_hoje", "a_vencer_7d", "sem_expiracao"]:
            assert k in data["kpis"], f"KPI missing: {k}"

        by_name = {i["cliente_nome"]: i for i in data["itens"] if i.get("cliente_nome", "").startswith(TEST_PREFIX)}
        expected_sit = {
            "em_dia": "em_dia",
            "avisar": "avisar",
            "vence_hoje": "vence_hoje",
            "vencido": "vencido",
            "bloqueado": "bloqueado",
            "sem_expiracao": "sem_expiracao",
            "vip": "vip",
            "confianca": "confianca",
        }
        for key, expected in expected_sit.items():
            nome = fx[key]["nome"]
            assert nome in by_name, f"{nome} missing from painel"
            got = by_name[nome]["situacao"]
            assert got == expected, f"[{key}] expected situacao={expected}, got={got}. item={by_name[nome]}"

        # Item shape
        it = by_name[fx["vence_hoje"]["nome"]]
        for k in ["linha_id", "cliente_id", "cliente_nome", "msisdn", "status_linha",
                  "data_expiracao_ta", "bloqueio_homeon", "dias_ate_bloqueio",
                  "boleto", "boleto_status", "situacao", "na_whitelist",
                  "desbloqueio_confianca_ate", "lembrete_d3_enviado"]:
            assert k in it, f"field missing on painel item: {k}"
        # bloqueio_homeon == data_expiracao_ta - 2 dias
        exp_dt = datetime.strptime(it["data_expiracao_ta"], "%Y-%m-%d").date()
        bh_dt = datetime.strptime(it["bloqueio_homeon"], "%Y-%m-%d").date()
        assert (exp_dt - bh_dt).days == 2
        assert it["dias_ate_bloqueio"] == 0
    finally:
        run(event_loop, _cleanup(db))


def test_config_update_new_fields_and_validation(admin_session, db, event_loop):
    original = admin_session.get(f"{BASE_URL}/api/automacao/bloqueio/config", timeout=30).json()
    try:
        # valid update including new fields
        payload = {
            "hora_alerta_d0": 12,
            "enviar_lembrete_d3": True,
            "enviar_alerta_d0": True,
            "executar_bloqueio_auto": False,
            "mensagem_alerta_d0": "Ola {nome}, teste D0. link={link}",
        }
        r = admin_session.put(f"{BASE_URL}/api/automacao/bloqueio/config", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        cfg = r.json()
        assert cfg["hora_alerta_d0"] == 12
        assert cfg["enviar_lembrete_d3"] is True
        assert cfg["enviar_alerta_d0"] is True
        assert cfg["executar_bloqueio_auto"] is False
        assert cfg["mensagem_alerta_d0"].startswith("Ola {nome}")

        # verify persistence via GET
        r2 = admin_session.get(f"{BASE_URL}/api/automacao/bloqueio/config", timeout=30).json()
        assert r2["hora_alerta_d0"] == 12
        assert r2["executar_bloqueio_auto"] is False

        # invalid hora_alerta_d0 = 25 -> 400
        r3 = admin_session.put(f"{BASE_URL}/api/automacao/bloqueio/config", json={"hora_alerta_d0": 25}, timeout=30)
        assert r3.status_code == 400, f"expected 400 for hora_alerta_d0=25, got {r3.status_code}: {r3.text}"

        # invalid = -1 -> 400
        r4 = admin_session.put(f"{BASE_URL}/api/automacao/bloqueio/config", json={"hora_alerta_d0": -1}, timeout=30)
        assert r4.status_code == 400
    finally:
        # restore relevant fields to defaults where possible
        restore = {k: original.get(k) for k in ["hora_alerta_d0", "enviar_lembrete_d3",
                                                "enviar_alerta_d0", "executar_bloqueio_auto",
                                                "mensagem_alerta_d0"] if original.get(k) is not None}
        if restore:
            admin_session.put(f"{BASE_URL}/api/automacao/bloqueio/config", json=restore, timeout=30)


def test_enviar_lembrete_tipo_validation(admin_session):
    r = admin_session.post(
        f"{BASE_URL}/api/automacao/bloqueio/enviar-lembrete",
        json={"linha_ids": [], "tipo": "invalid"},
        timeout=30,
    )
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"


def test_enviar_lembrete_d3_dedup(admin_session, db, event_loop):
    fx = run(event_loop, _seed_all(db))
    try:
        lid = fx["avisar"]["linha_id"]
        cid = fx["avisar"]["cliente_id"]
        # First call: should attempt to send (dedup empty)
        r1 = admin_session.post(
            f"{BASE_URL}/api/automacao/bloqueio/enviar-lembrete",
            json={"linha_ids": [lid], "tipo": "d3"},
            timeout=60,
        )
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1["tipo"] == "d3"
        assert d1["total"] == 1
        for k in ["enviados", "skipped_dedup", "erros"]:
            assert k in d1
        # First call: expected enviados=1, skipped=0 (Zapi mock/prod may still record dedup)
        assert d1["enviados"] + len(d1["erros"]) == 1, f"unexpected: {d1}"

        # If first send succeeded, dedup log must exist
        if d1["enviados"] == 1:
            log = run(event_loop, db.automacao_lembretes_log.find_one({
                "cliente_id": cid, "tipo": "d3",
            }))
            assert log is not None, "dedup log entry not created"
            assert log["ciclo_ref"]  # non-empty

            # Second call same cycle => must be skipped_dedup
            r2 = admin_session.post(
                f"{BASE_URL}/api/automacao/bloqueio/enviar-lembrete",
                json={"linha_ids": [lid], "tipo": "d3"},
                timeout=60,
            )
            assert r2.status_code == 200, r2.text
            d2 = r2.json()
            assert d2["skipped_dedup"] >= 1, f"expected skipped_dedup>=1 on second d3 call, got {d2}"
            assert d2["enviados"] == 0

        # d0 must NOT check dedup
        r3 = admin_session.post(
            f"{BASE_URL}/api/automacao/bloqueio/enviar-lembrete",
            json={"linha_ids": [lid], "tipo": "d0"},
            timeout=60,
        )
        assert r3.status_code == 200, r3.text
        d3 = r3.json()
        assert d3["tipo"] == "d0"
        assert d3["skipped_dedup"] == 0
    finally:
        run(event_loop, _cleanup(db))


def test_executar_job_d3_and_d0_endpoints(admin_session, db, event_loop):
    fx = run(event_loop, _seed_all(db))
    try:
        r = admin_session.post(f"{BASE_URL}/api/automacao/bloqueio/executar-lembrete-d3", timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        # Response may be {"skipped": True, "motivo": ...} if config disables d3
        if not d.get("skipped"):
            assert d.get("tipo") == "d3"
            for k in ["enviados", "skipped_dedup", "erros", "candidatos"]:
                assert k in d
            # our d3_target (exp=+5, bloq=+3) should be a candidate
            assert d["candidatos"] >= 1, f"expected >=1 d3 candidate, got {d}"

        r2 = admin_session.post(f"{BASE_URL}/api/automacao/bloqueio/executar-alerta-d0", timeout=60)
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        if not d2.get("skipped"):
            assert d2.get("tipo") == "d0"
            for k in ["enviados", "erros", "candidatos"]:
                assert k in d2
            # our vence_hoje fixture should be a candidate
            assert d2["candidatos"] >= 1, f"expected >=1 d0 candidate, got {d2}"
    finally:
        run(event_loop, _cleanup(db))


def test_simular_still_excludes_future_beyond_d2(admin_session, db, event_loop):
    """Non-regression: /simular must NOT include clients with exp > hoje+2."""
    fx = run(event_loop, _seed_all(db))
    try:
        r = admin_session.get(f"{BASE_URL}/api/automacao/bloqueio/simular", timeout=60)
        assert r.status_code == 200, r.text
        nomes = {i.get("cliente_nome") for i in r.json().get("itens", [])}
        # avisar (exp=+5) and d3_target (exp=+5) and em_dia (exp=+20) => all > hoje+2 => excluded
        assert fx["avisar"]["nome"] not in nomes
        assert fx["d3_target"]["nome"] not in nomes
        assert fx["em_dia"]["nome"] not in nomes
        # vencido (exp=-3) and vence_hoje (exp=+2) => must be included
        assert fx["vencido"]["nome"] in nomes
        assert fx["vence_hoje"]["nome"] in nomes
    finally:
        run(event_loop, _cleanup(db))
