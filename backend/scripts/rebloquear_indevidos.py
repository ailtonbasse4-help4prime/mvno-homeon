"""
Detecta e re-bloqueia clientes que foram desbloqueados incorretamente:
tem linha ATIVA + bloqueio_automatico.desbloqueado_em recente + cobranca OVERDUE aberta.

Uso: python scripts/rebloquear_indevidos.py            # dry-run
     python scripts/rebloquear_indevidos.py --apply    # aplica bloqueio parcial
"""
import asyncio, os, sys
from pathlib import Path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))
from dotenv import load_dotenv
load_dotenv(BACKEND_DIR / ".env")
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone

async def main():
    apply_changes = "--apply" in sys.argv
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    hoje_iso = datetime.now(timezone.utc).date().isoformat()
    paid_statuses = ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]

    # Todas as linhas ATIVAS com historico de bloqueio automatico + desbloqueio
    linhas = await db.linhas.find({
        "status": "ativo",
        "bloqueio_automatico.desbloqueado_em": {"$exists": True, "$ne": None},
    }).to_list(5000)

    print(f"Linhas ATIVAS com historico de desbloqueio: {len(linhas)}")
    print("Verificando quais ainda tem cobranca OVERDUE aberta...")
    print()

    alvos = []
    for l in linhas:
        cliente_id = str(l.get("cliente_id") or "")
        if not cliente_id:
            continue
        cob = await db.cobrancas.find_one({
            "cliente_id": cliente_id,
            "vencimento": {"$lte": hoje_iso},
            "status": {"$nin": paid_statuses + ["CANCELLED", "REFUNDED"]},
        }, sort=[("vencimento", 1)])
        if not cob:
            continue
        cli = await db.clientes.find_one({"_id": ObjectId(cliente_id)})
        alvos.append({
            "linha": l,
            "cliente": cli,
            "cobranca": cob,
        })

    print(f"Encontrados {len(alvos)} para re-bloqueio:")
    for a in alvos:
        cli = a["cliente"]
        l = a["linha"]
        cob = a["cobranca"]
        print(f"  - {cli.get('nome'):<40} | msisdn={l.get('msisdn') or l.get('numero')} | overdue venc={cob.get('vencimento')} R${cob.get('valor')}")

    if not apply_changes:
        print("\n[DRY-RUN] Rode com --apply para bloquear.")
        return

    if not alvos:
        return

    # Init operadora
    from services.operadora_service import OperadoraService
    op = OperadoraService()
    try:
        await op.load_config_from_db(db)
    except Exception:
        pass

    bloqueadas = 0
    for a in alvos:
        l = a["linha"]
        try:
            chip = await db.chips.find_one({"_id": ObjectId(l["chip_id"])}) if l.get("chip_id") else None
            if not chip:
                print(f"  ! sem chip: {l['_id']}")
                continue
            resp = await op.bloquear_parcial(iccid=chip["iccid"], db=db, user_id="sistema", user_name="ReblockScript")
            if getattr(resp, "success", False):
                await db.linhas.update_one(
                    {"_id": l["_id"]},
                    {"$set": {
                        "status": "bloqueado",
                        "bloqueio_automatico": {
                            "ativo": True,
                            "data": datetime.now(timezone.utc),
                            "motivo": "rebloqueio_indevido_script",
                            "cobranca_id": str(a["cobranca"]["_id"]),
                        },
                    }},
                )
                await db.chips.update_one({"_id": chip["_id"]}, {"$set": {"status": "bloqueado"}})
                bloqueadas += 1
                print(f"  OK: {a['cliente'].get('nome')}")
            else:
                print(f"  ERRO Ta: {a['cliente'].get('nome')} - {getattr(resp, 'message', '?')}")
        except Exception as e:
            print(f"  EXCECAO: {a['cliente'].get('nome')} - {e}")

    print(f"\n✅ {bloqueadas} linhas re-bloqueadas.")

asyncio.run(main())
