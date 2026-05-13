#!/usr/bin/env python3
"""
Script de reconstrucao dos clientes perdidos entre 07/05/2026 e 13/05/2026.

Estrategia:
1. Busca TODOS os clientes do Asaas criados apos 07/05
2. Compara com banco local (matching por CPF, email ou Asaas customer_id)
3. Lista os que FALTAM no banco
4. Modo --import: cria os faltantes + vincula cobrancas do Asaas
5. Para cada cliente importado, tenta achar a linha correspondente na Ta Telecom (por CPF)

Uso:
    cd /opt/mvno-homeon/backend

    # 1. PRIMEIRO: ver o que falta (dry-run)
    /app/venv/bin/python3 sync_asaas_faltantes.py

    # 2. SEGUNDO: importar de fato
    /app/venv/bin/python3 sync_asaas_faltantes.py --import

    # Opcional: data de corte diferente (default 2026-05-07)
    /app/venv/bin/python3 sync_asaas_faltantes.py --since 2026-05-01
"""
import asyncio
import os
import sys
import re
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import httpx
from bson import ObjectId

load_dotenv()

ASAAS_API_KEY = os.environ.get("ASAAS_API_KEY", "").strip()
ASAAS_BASE = os.environ.get("ASAAS_BASE_URL", "https://www.asaas.com/api/v3").strip()
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

# Args
DRY_RUN = "--import" not in sys.argv
SINCE = "2026-05-07"
for i, a in enumerate(sys.argv):
    if a == "--since" and i + 1 < len(sys.argv):
        SINCE = sys.argv[i + 1]


def only_digits(s):
    return re.sub(r"\D", "", str(s or ""))


async def asaas_get(client, path, params=None):
    headers = {"access_token": ASAAS_API_KEY, "User-Agent": "MVNO-Sync/1.0"}
    r = await client.get(f"{ASAAS_BASE}{path}", headers=headers, params=params or {}, timeout=30)
    r.raise_for_status()
    return r.json()


async def fetch_all_asaas_customers(since_iso):
    """Pagina todos os customers do Asaas criados >= since_iso."""
    customers = []
    offset = 0
    limit = 100
    async with httpx.AsyncClient() as client:
        while True:
            data = await asaas_get(client, "/customers", {
                "offset": offset, "limit": limit,
                "dateCreated[ge]": since_iso,
            })
            batch = data.get("data", [])
            customers.extend(batch)
            if len(batch) < limit or not data.get("hasMore"):
                break
            offset += limit
    return customers


async def main():
    if not ASAAS_API_KEY:
        print("❌ ASAAS_API_KEY nao definida em /opt/mvno-homeon/backend/.env")
        return

    print(f"=== RECONSTRUCAO DE CLIENTES PERDIDOS ===")
    print(f"Modo: {'DRY-RUN (apenas listar)' if DRY_RUN else 'IMPORTAR de fato'}")
    print(f"Periodo: a partir de {SINCE}")
    print()

    print(f"→ Buscando clientes no Asaas criados desde {SINCE}...")
    asaas_customers = await fetch_all_asaas_customers(SINCE)
    print(f"  Encontrados {len(asaas_customers)} clientes no Asaas no periodo\n")

    c = AsyncIOMotorClient(MONGO_URL)
    db = c[DB_NAME]

    # Carrega clientes locais
    locals_by_cpf = {}
    locals_by_email = {}
    locals_by_asaas_id = {}
    async for doc in db.clientes.find({}, {"documento": 1, "email": 1, "asaas_customer_id": 1, "_id": 1}):
        if doc.get("documento"):
            locals_by_cpf[only_digits(doc["documento"])] = doc
        if doc.get("email"):
            locals_by_email[doc["email"].lower().strip()] = doc
        if doc.get("asaas_customer_id"):
            locals_by_asaas_id[doc["asaas_customer_id"]] = doc

    print(f"→ Banco local tem {await db.clientes.count_documents({})} clientes hoje\n")

    # Identifica faltantes
    faltantes = []
    for ac in asaas_customers:
        ac_id = ac.get("id")
        cpf = only_digits(ac.get("cpfCnpj"))
        email = (ac.get("email") or "").lower().strip()
        if ac_id and ac_id in locals_by_asaas_id:
            continue
        if cpf and cpf in locals_by_cpf:
            # ja existe local mas sem asaas_customer_id - vincula
            local = locals_by_cpf[cpf]
            if not DRY_RUN:
                await db.clientes.update_one(
                    {"_id": local["_id"]},
                    {"$set": {"asaas_customer_id": ac_id}}
                )
            print(f"  ↔ JA EXISTE (vinculando asaas_id): {ac.get('name')} - CPF {cpf}")
            continue
        if email and email in locals_by_email:
            local = locals_by_email[email]
            if not DRY_RUN:
                await db.clientes.update_one(
                    {"_id": local["_id"]},
                    {"$set": {"asaas_customer_id": ac_id, "documento": cpf or local.get("documento")}}
                )
            print(f"  ↔ JA EXISTE (vinculando por email): {ac.get('name')} - {email}")
            continue
        faltantes.append(ac)

    print()
    print(f"=== {len(faltantes)} CLIENTES FALTANTES ===")
    for ac in faltantes:
        print(f"  • {ac.get('name'):<35} | CPF {only_digits(ac.get('cpfCnpj')):<11} | {ac.get('email','')[:30]:<30} | tel {ac.get('mobilePhone') or ac.get('phone','')}")

    if DRY_RUN:
        print(f"\n🔍 DRY-RUN concluido. Para importar de fato, rode:")
        print(f"   /app/venv/bin/python3 sync_asaas_faltantes.py --import")
        return

    if not faltantes:
        print("\n✅ Nada para importar")
        return

    print(f"\n→ Importando {len(faltantes)} clientes...")
    importados = 0
    for ac in faltantes:
        cpf = only_digits(ac.get("cpfCnpj"))
        tel = ac.get("mobilePhone") or ac.get("phone") or ""
        cliente_doc = {
            "nome": ac.get("name") or "",
            "documento": cpf,
            "email": (ac.get("email") or "").strip(),
            "telefone": tel,
            "endereco": ac.get("address") or "",
            "numero_endereco": ac.get("addressNumber") or "",
            "complemento": ac.get("complement") or "",
            "bairro": ac.get("province") or "",
            "cidade": ac.get("city") or "",
            "estado": ac.get("state") or "",
            "cep": ac.get("postalCode") or "",
            "status": "ativo",
            "asaas_customer_id": ac.get("id"),
            "created_at": datetime.now(timezone.utc),
            "reconstruido_em": datetime.now(timezone.utc),
            "reconstruido_de": "asaas_sync_pos_ataque",
        }
        r = await db.clientes.insert_one(cliente_doc)
        importados += 1
        print(f"  ✓ {ac.get('name')} (id={r.inserted_id})")

    print(f"\n✅ {importados} clientes importados com sucesso!")
    print(f"\nProximo passo:")
    print(f"  - Acesse /clientes no sistema e revise cada um (foto, endereco, complementos)")
    print(f"  - Cobrancas vinculadas serao re-importadas automaticamente na proxima abertura da Planilha Operacional")
    print(f"  - Linhas/ICCID: importe via 'Sincronizar Ta Telecom' apos vincular o chip de cada cliente")


if __name__ == "__main__":
    asyncio.run(main())
