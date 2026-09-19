"""
Script CLI para simular o job de auto-bloqueio SEM precisar de autenticacao HTTP.

Uso no VPS:
    cd /opt/mvno-homeon/backend
    source /app/venv/bin/activate   # ou o venv usado pelo systemd
    python scripts/dry_run_bloqueio.py

Retorna JSON com os clientes que seriam bloqueados HOJE.
"""
import asyncio
import json
import os
import sys
from pathlib import Path

# Garante que consegue importar routes.*
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv
load_dotenv(BACKEND_DIR / ".env")

from motor.motor_asyncio import AsyncIOMotorClient
from routes import automacao_bloqueio


async def _noop_log(*args, **kwargs):
    return None


async def _fake_require_admin(request=None):
    return {"id": "cli", "name": "DryRunCLI"}


async def main():
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    # Tenta carregar o AsaasService para o _cliente_ja_pagou_no_mes checar Asaas
    asaas_service = None
    try:
        from services.asaas_service import AsaasService
        asaas_service = AsaasService()
        try:
            await asaas_service.load_config_from_db(db)
        except Exception:
            pass
    except Exception as e:
        print(f"AVISO: nao carregou AsaasService: {e}", file=sys.stderr)

    automacao_bloqueio.init(
        db=db,
        get_current_user=_fake_require_admin,
        require_admin=_fake_require_admin,
        create_log=_noop_log,
        operadora_service=None,
        zapi_service=None,
        sync_asaas_fn=None,
        asaas_service=asaas_service,
    )

    itens = await automacao_bloqueio._build_simulacao(dias_tolerancia=0)

    resumo = {
        "total_candidatos": len(itens),
        "a_bloquear": sum(1 for i in itens if i["acao"] == "BLOQUEAR"),
        "skip_whitelist": sum(1 for i in itens if i["acao"] == "SKIP_WHITELIST"),
        "clientes": [
            {
                "nome": i.get("cliente_nome"),
                "documento": i.get("documento"),
                "telefone": i.get("telefone"),
                "msisdns": [l.get("msisdn") for l in i.get("linhas_afetadas", [])],
                "vencimento_ta": i.get("vencimento"),
                "data_expiracao_ta": i.get("data_expiracao_ta"),
                "acao": i.get("acao"),
                "origem": i.get("origem"),
            }
            for i in itens
        ],
    }
    print(json.dumps(resumo, indent=2, ensure_ascii=False, default=str))


if __name__ == "__main__":
    asyncio.run(main())
