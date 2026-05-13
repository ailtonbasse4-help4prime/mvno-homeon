#!/usr/bin/env python3
"""Diagnostico + Fix de login admin.
Uso (na VPS):
    cd /opt/mvno-homeon/backend
    /app/venv/bin/python3 fix_login.py [email] [senha]

Exemplo:
    /app/venv/bin/python3 fix_login.py ailtonhomeon@gmail.com MinhaSenha123
"""
import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv()
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def main():
    email = sys.argv[1] if len(sys.argv) > 1 else "admin@mvno.com"
    senha = sys.argv[2] if len(sys.argv) > 2 else "admin123"

    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]

    print(f"=== Diagnostico de login para: {email} ===\n")

    # 1. Lista TODOS os usuarios (pra voce ver quais existem)
    print("1. Usuarios no banco:")
    count = 0
    async for u in db.usuarios.find({}, {"email": 1, "name": 1, "role": 1, "_id": 0}):
        count += 1
        print(f"   - {u.get('email'):<40} | {u.get('name'):<25} | {u.get('role')}")
    if count == 0:
        print("   (banco vazio)")
    print()

    # 2. Cria/atualiza o usuario solicitado
    existing = await db.usuarios.find_one({"email": email})
    if existing:
        await db.usuarios.update_one(
            {"email": email},
            {"$set": {"password_hash": pwd.hash(senha), "role": "admin"}},
        )
        print(f"2. ✅ Senha redefinida para usuario EXISTENTE: {email}")
    else:
        await db.usuarios.insert_one({
            "email": email,
            "name": email.split("@")[0].title(),
            "role": "admin",
            "password_hash": pwd.hash(senha),
            "created_at": datetime.now(timezone.utc),
        })
        print(f"2. ✅ Usuario CRIADO como admin: {email}")

    # 3. Limpa lockouts (tentativas falhas)
    r = await db.login_attempts.delete_many({})
    print(f"3. ✅ Lockouts limpos: {r.deleted_count} registro(s)")

    print(f"\n=== PRONTO ===")
    print(f"Tente fazer login agora com:")
    print(f"   Email: {email}")
    print(f"   Senha: {senha}")


if __name__ == "__main__":
    asyncio.run(main())
