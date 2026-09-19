"""
Script CLI para simular OU executar o job de auto-bloqueio SEM precisar de auth HTTP.

Uso:
    python scripts/dry_run_bloqueio.py             # DRY RUN (so simula)
    python scripts/dry_run_bloqueio.py --execute   # EXECUTA bloqueio real na Ta Telecom
"""
import asyncio
import json
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv
load_dotenv(BACKEND_DIR / ".env")

from motor.motor_asyncio import AsyncIOMotorClient
from routes import automacao_bloqueio


async def _noop_log(*args, **kwargs):
    return None


async def _fake_admin(request=None):
    return {"id": "cli-cron", "name": "AutoBloqueioCLI"}


async def main():
    execute = "--execute" in sys.argv

    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    asaas_service = None
    operadora_service = None
    zapi_service = None

    try:
        from services.asaas_service import AsaasService
        asaas_service = AsaasService()
        try:
            await asaas_service.load_config_from_db(db)
        except Exception:
            pass
    except Exception as e:
        print(f"AVISO asaas: {e}", file=sys.stderr)

    if execute:
        try:
            from services.operadora_service import OperadoraService
            operadora_service = OperadoraService()
            try:
                await operadora_service.load_config_from_db(db)
            except Exception:
                pass
        except Exception as e:
            print(f"ERRO operadora: {e}", file=sys.stderr)
            sys.exit(1)

        try:
            from services.zapi_service import ZapiService
            zapi_service = ZapiService()
            try:
                await zapi_service.load_config_from_db(db)
            except Exception:
                pass
        except Exception as e:
            print(f"AVISO zapi: {e}", file=sys.stderr)

    automacao_bloqueio.init(
        db=db,
        get_current_user=_fake_admin,
        require_admin=_fake_admin,
        create_log=_noop_log,
        operadora_service=operadora_service,
        zapi_service=zapi_service,
        sync_asaas_fn=None,
        asaas_service=asaas_service,
    )

    if not execute:
        # DRY RUN
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
        return

    # EXECUCAO REAL
    print("EXECUTANDO BLOQUEIO REAL na Ta Telecom...", file=sys.stderr)
    resultado = await automacao_bloqueio._executar_job_bloqueio(
        dias_tolerancia=0,
        dry_run=False,
        disparado_por={"id": "cli-cron", "name": "AutoBloqueioCLI"},
    )
    print(json.dumps(resultado, indent=2, ensure_ascii=False, default=str))


if __name__ == "__main__":
    asyncio.run(main())
