"""
Corrige motivo_bloqueio no config em runtime: 15 -> 4 (Inadimplencia).
"""
import asyncio, os, sys
from pathlib import Path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))
from dotenv import load_dotenv
load_dotenv(BACKEND_DIR / ".env")
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    doc = await db.config.find_one({"key": "automacao_bloqueio"})
    atual = (doc or {}).get("value", {}).get("motivo_bloqueio")
    print(f"motivo_bloqueio atual no DB: {atual}")
    if atual != 4:
        await db.config.update_one(
            {"key": "automacao_bloqueio"},
            {"$set": {"value.motivo_bloqueio": 4}},
            upsert=True,
        )
        print("Atualizado para 4 (Inadimplencia)")
    else:
        print("Ja esta correto (4)")

asyncio.run(main())
