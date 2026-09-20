"""
Desativa ofertas antigas (Ta Conectado) para que nao apareçam no self-service/portal.

Uso:
    python scripts/desativar_ofertas_antigas.py           # dry-run: apenas lista
    python scripts/desativar_ofertas_antigas.py --apply   # aplica desativacao
"""
import asyncio, os, sys, re
from pathlib import Path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))
from dotenv import load_dotenv
load_dotenv(BACKEND_DIR / ".env")
from motor.motor_asyncio import AsyncIOMotorClient

# Padroes que identificam ofertas que nao devem mais aparecer publicamente
PADROES_DESATIVAR = [
    re.compile(r"t[áa]\s*conectado", re.I),
    re.compile(r"t[áa]\s*m2m", re.I),
]


def match_desativar(nome: str) -> bool:
    n = (nome or "").strip()
    return any(p.search(n) for p in PADROES_DESATIVAR)


async def main():
    apply_changes = "--apply" in sys.argv
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    ofertas = await db.ofertas.find({"ativo": True}).to_list(1000)
    alvos = [o for o in ofertas if match_desativar(o.get("nome", ""))]
    manter = [o for o in ofertas if not match_desativar(o.get("nome", ""))]

    print(f"Ofertas ATIVAS hoje: {len(ofertas)}")
    print(f"Serao DESATIVADAS ({len(alvos)}):")
    for o in alvos:
        print(f"  - {o.get('nome'):<40}  R$ {float(o.get('valor') or 0):.2f}  categoria={o.get('categoria','?')}")

    print(f"\nContinuarao ATIVAS ({len(manter)}):")
    for o in manter:
        print(f"  ✓ {o.get('nome'):<40}  R$ {float(o.get('valor') or 0):.2f}  categoria={o.get('categoria','?')}")

    if not apply_changes:
        print("\n[DRY-RUN] Nenhuma alteracao aplicada. Rode com --apply para efetivar.")
        return

    if not alvos:
        print("\nNada a fazer.")
        return

    r = await db.ofertas.update_many(
        {"_id": {"$in": [o["_id"] for o in alvos]}},
        {"$set": {"ativo": False}},
    )
    print(f"\n✅ {r.modified_count} ofertas desativadas.")

asyncio.run(main())
