"""
Atualiza config do auto-bloqueio no DB para D-1 as 16h.
Uso: python scripts/atualizar_config_bloqueio_d1.py
"""
import asyncio, os, sys
from pathlib import Path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))
from dotenv import load_dotenv
load_dotenv(BACKEND_DIR / ".env")
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    doc = await db.config.find_one({"key": "automacao_bloqueio"}) or {}
    val = doc.get("value") or {}
    print("Config atual:")
    print(f"  hora_bloqueio = {val.get('hora_bloqueio')}")
    print(f"  motivo_bloqueio = {val.get('motivo_bloqueio')}")

    updates = {}
    if val.get("hora_bloqueio") != 16:
        updates["value.hora_bloqueio"] = 16
    if val.get("motivo_bloqueio") != 4:
        updates["value.motivo_bloqueio"] = 4

    if not updates:
        print("Ja esta correto (hora_bloqueio=16, motivo_bloqueio=4).")
        return

    updates["updated_at"] = datetime.now(timezone.utc)
    await db.config.update_one(
        {"key": "automacao_bloqueio"},
        {"$set": {"key": "automacao_bloqueio", **updates}},
        upsert=True,
    )
    print(f"Aplicado: {updates}")

asyncio.run(main())
