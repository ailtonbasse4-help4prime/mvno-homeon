from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import re
import logging
import secrets
import bcrypt
import jwt
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from enum import Enum

from services.operadora_service import operadora_service, OperadoraStatus, BLOCK_REASONS, STOCK_STATUS_MAP

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get("JWT_SECRET", secrets.token_hex(32))
JWT_ALGORITHM = "HS256"

app = FastAPI(title="MVNO Management System - Ta Telecom")
api_router = APIRouter(prefix="/api")

# ==================== ENUMS ====================
class UserRole(str, Enum):
    admin = "admin"
    atendente = "atendente"

class ClientStatus(str, Enum):
    ativo = "ativo"
    inativo = "inativo"

class TipoPessoa(str, Enum):
    pf = "pf"
    pj = "pj"

class ChipStatus(str, Enum):
    disponivel = "disponivel"
    reservado = "reservado"
    ativado = "ativado"
    bloqueado = "bloqueado"
    cancelado = "cancelado"

class LineStatus(str, Enum):
    ativo = "ativo"
    bloqueado = "bloqueado"
    pendente = "pendente"
    erro = "erro"

class LogAction(str, Enum):
    ativacao = "ativacao"
    bloqueio = "bloqueio"
    desbloqueio = "desbloqueio"
    erro = "erro"
    login = "login"
    logout = "logout"
    cadastro = "cadastro"
    api_call = "api_call"
    consulta = "consulta"
    alteracao_plano = "alteracao_plano"
    sincronizacao = "sincronizacao"

# ==================== VALIDATION UTILS ====================
def validate_cpf(cpf: str) -> bool:
    cpf = re.sub(r'\D', '', cpf)
    if len(cpf) != 11 or cpf == cpf[0] * 11:
        return False
    for i in range(9, 11):
        val = sum((cpf_digit := int(cpf[num])) * ((i + 1) - num) for num in range(0, i))
        digit = ((val * 10) % 11) % 10
        if digit != int(cpf[i]):
            return False
    return True

def validate_cnpj(cnpj: str) -> bool:
    cnpj = re.sub(r'\D', '', cnpj)
    if len(cnpj) != 14 or cnpj == cnpj[0] * 14:
        return False
    weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    sum1 = sum(int(cnpj[i]) * weights1[i] for i in range(12))
    d1 = 11 - (sum1 % 11)
    d1 = 0 if d1 >= 10 else d1
    if int(cnpj[12]) != d1:
        return False
    sum2 = sum(int(cnpj[i]) * weights2[i] for i in range(13))
    d2 = 11 - (sum2 % 11)
    d2 = 0 if d2 >= 10 else d2
    return int(cnpj[13]) == d2

def clean_document(doc: str) -> str:
    return re.sub(r'\D', '', doc)

def validate_document(documento: str, tipo_pessoa: str) -> bool:
    if tipo_pessoa == "pf":
        return validate_cpf(documento)
    elif tipo_pessoa == "pj":
        return validate_cnpj(documento)
    return False

def validate_cep(cep: str) -> bool:
    cleaned = re.sub(r'\D', '', cep)
    return len(cleaned) == 8

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: UserRole = UserRole.atendente

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    created_at: datetime

# Client Models - expanded for Ta Telecom
class ClientCreate(BaseModel):
    nome: str
    tipo_pessoa: TipoPessoa = TipoPessoa.pf
    documento: str  # CPF or CNPJ
    telefone: str
    data_nascimento: Optional[str] = None
    cep: Optional[str] = None
    endereco: Optional[str] = None
    numero_endereco: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    city_code: Optional[str] = None
    complemento: Optional[str] = None
    status: ClientStatus = ClientStatus.ativo

class ClientResponse(BaseModel):
    id: str
    nome: str
    tipo_pessoa: str
    documento: str
    telefone: str
    data_nascimento: Optional[str] = None
    cep: Optional[str] = None
    endereco: Optional[str] = None
    numero_endereco: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    city_code: Optional[str] = None
    complemento: Optional[str] = None
    status: str
    dados_completos: bool = False
    created_at: datetime

# Plan Models - with plan_code
class PlanCreate(BaseModel):
    nome: str
    franquia: str
    descricao: Optional[str] = None
    plan_code: Optional[str] = None

class PlanResponse(BaseModel):
    id: str
    nome: str
    franquia: str
    descricao: Optional[str] = None
    plan_code: Optional[str] = None
    created_at: datetime

# Offer Models
class OfferCreate(BaseModel):
    nome: str
    plano_id: str
    valor: float
    descricao: Optional[str] = None
    ativo: bool = True

class OfferResponse(BaseModel):
    id: str
    nome: str
    plano_id: str
    plano_nome: Optional[str] = None
    franquia: Optional[str] = None
    plan_code: Optional[str] = None
    valor: float
    descricao: Optional[str] = None
    ativo: bool
    created_at: datetime

# Chip Models - with msisdn
class ChipCreate(BaseModel):
    iccid: str
    oferta_id: str

class ChipResponse(BaseModel):
    id: str
    iccid: str
    status: str
    msisdn: Optional[str] = None
    oferta_id: Optional[str] = None
    oferta_nome: Optional[str] = None
    plano_nome: Optional[str] = None
    franquia: Optional[str] = None
    plan_code: Optional[str] = None
    valor: Optional[float] = None
    cliente_id: Optional[str] = None
    cliente_nome: Optional[str] = None
    created_at: datetime

# Line Models
class LineResponse(BaseModel):
    id: str
    numero: str
    status: str
    cliente_id: str
    chip_id: str
    plano_id: str
    oferta_id: Optional[str] = None
    cliente_nome: Optional[str] = None
    plano_nome: Optional[str] = None
    oferta_nome: Optional[str] = None
    franquia: Optional[str] = None
    plan_code: Optional[str] = None
    iccid: Optional[str] = None
    msisdn: Optional[str] = None
    created_at: datetime

# Activation Models
class ActivationRequest(BaseModel):
    cliente_id: str
    chip_id: str

class ActivationResponse(BaseModel):
    success: bool
    status: str
    message: str
    numero: Optional[str] = None
    oferta_nome: Optional[str] = None
    plano_nome: Optional[str] = None
    franquia: Optional[str] = None
    valor: Optional[float] = None
    response_time_ms: Optional[int] = None

# Line action models
class BlockTotalRequest(BaseModel):
    reason: int  # 1-5

class PlanChangeRequest(BaseModel):
    oferta_id: str  # new offer -> new plan

# Log Models
class LogEntry(BaseModel):
    id: str
    action: str
    details: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    created_at: datetime
    api_request: Optional[dict] = None
    api_response: Optional[dict] = None
    is_mock: Optional[bool] = None

# ==================== PASSWORD UTILS ====================
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

# ==================== JWT UTILS ====================
def get_jwt_secret() -> str:
    return JWT_SECRET

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(minutes=60), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Nao autenticado")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Token invalido")
        user = await db.usuarios.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Usuario nao encontrado")
        return {
            "id": str(user["_id"]), "email": user["email"],
            "name": user["name"], "role": user["role"],
            "created_at": user.get("created_at", datetime.now(timezone.utc))
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalido")

async def require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado. Requer permissao de administrador.")
    return user

# ==================== LOG UTILS ====================
async def create_log(action: str, details: str, user_id: Optional[str] = None, user_name: Optional[str] = None):
    await db.logs.insert_one({
        "action": action, "details": details,
        "user_id": user_id, "user_name": user_name,
        "created_at": datetime.now(timezone.utc)
    })

# ==================== HELPER: check client data completeness ====================
def check_client_completeness(cliente: dict) -> tuple:
    """Returns (is_complete, missing_fields)"""
    required = ["nome", "documento", "telefone", "data_nascimento", "cep", "numero_endereco"]
    missing = [f for f in required if not cliente.get(f)]
    return len(missing) == 0, missing

def build_client_response(c: dict) -> ClientResponse:
    is_complete, _ = check_client_completeness(c)
    return ClientResponse(
        id=str(c["_id"]), nome=c["nome"],
        tipo_pessoa=c.get("tipo_pessoa", "pf"),
        documento=c.get("documento", c.get("cpf", "")),
        telefone=c.get("telefone", ""),
        data_nascimento=c.get("data_nascimento"),
        cep=c.get("cep"), endereco=c.get("endereco"),
        numero_endereco=c.get("numero_endereco"),
        bairro=c.get("bairro"), cidade=c.get("cidade"),
        estado=c.get("estado"), city_code=c.get("city_code"),
        complemento=c.get("complemento"),
        status=c["status"], dados_completos=is_complete,
        created_at=c.get("created_at", datetime.now(timezone.utc))
    )

# ==================== AUTH ROUTES ====================
@api_router.post("/auth/register", response_model=UserResponse)
async def register(data: UserCreate, response: Response):
    email = data.email.lower()
    existing = await db.usuarios.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email ja cadastrado")
    user_doc = {
        "email": email, "password_hash": hash_password(data.password),
        "name": data.name, "role": data.role.value,
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.usuarios.insert_one(user_doc)
    user_id = str(result.inserted_id)
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    await create_log("cadastro", f"Novo usuario registrado: {email}", user_id, data.name)
    return UserResponse(id=user_id, email=email, name=data.name, role=data.role.value, created_at=user_doc["created_at"])

@api_router.post("/auth/login", response_model=UserResponse)
async def login(data: UserLogin, response: Response, request: Request):
    email = data.email.lower()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    attempts = await db.login_attempts.find_one({"identifier": identifier})
    if attempts and attempts.get("count", 0) >= 5:
        lockout_until = attempts.get("lockout_until")
        if lockout_until and datetime.now(timezone.utc) < lockout_until:
            raise HTTPException(status_code=429, detail="Muitas tentativas. Tente novamente em 15 minutos.")
    user = await db.usuarios.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1}, "$set": {"lockout_until": datetime.now(timezone.utc) + timedelta(minutes=15)}},
            upsert=True
        )
        raise HTTPException(status_code=401, detail="Credenciais invalidas")
    await db.login_attempts.delete_one({"identifier": identifier})
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    await create_log("login", f"Login realizado: {email}", user_id, user["name"])
    return UserResponse(id=user_id, email=user["email"], name=user["name"], role=user["role"], created_at=user.get("created_at", datetime.now(timezone.utc)))

@api_router.post("/auth/logout")
async def logout(response: Response, request: Request):
    user = None
    try:
        user = await get_current_user(request)
    except Exception:
        pass
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    if user:
        await create_log("logout", f"Logout realizado: {user['email']}", user['id'], user['name'])
    return {"message": "Logout realizado com sucesso"}

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(request: Request):
    user = await get_current_user(request)
    return UserResponse(id=user["id"], email=user["email"], name=user["name"], role=user["role"], created_at=user["created_at"])

@api_router.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Refresh token nao encontrado")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Token invalido")
        user = await db.usuarios.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Usuario nao encontrado")
        user_id = str(user["_id"])
        access_token = create_access_token(user_id, user["email"])
        response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
        return {"message": "Token renovado com sucesso"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalido")


# ==================== PASSWORD CHANGE ====================
class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

@api_router.post("/auth/change-password")
async def change_password(data: PasswordChangeRequest, request: Request):
    user = await get_current_user(request)
    db_user = await db.usuarios.find_one({"_id": ObjectId(user["id"])})
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado")
    if not verify_password(data.current_password, db_user["password_hash"]):
        raise HTTPException(status_code=400, detail="Senha atual incorreta")
    if len(data.new_password) < 4:
        raise HTTPException(status_code=400, detail="Nova senha deve ter pelo menos 4 caracteres")
    await db.usuarios.update_one({"_id": ObjectId(user["id"])}, {"$set": {"password_hash": hash_password(data.new_password)}})
    await create_log("cadastro", f"Senha alterada: {user['email']}", user["id"], user["name"])
    return {"message": "Senha alterada com sucesso"}

# ==================== USER MANAGEMENT (Admin Only) ====================
class UserManageCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: UserRole = UserRole.atendente

class UserManageUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[UserRole] = None
    password: Optional[str] = None

@api_router.get("/usuarios", response_model=List[UserResponse])
async def list_users(request: Request):
    await require_admin(request)
    users = await db.usuarios.find({}).to_list(1000)
    return [UserResponse(
        id=str(u["_id"]), email=u["email"], name=u["name"],
        role=u["role"], created_at=u.get("created_at", datetime.now(timezone.utc))
    ) for u in users]

@api_router.post("/usuarios", response_model=UserResponse)
async def create_user(data: UserManageCreate, request: Request):
    admin = await require_admin(request)
    email = data.email.lower()
    existing = await db.usuarios.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email ja cadastrado")
    if len(data.password) < 4:
        raise HTTPException(status_code=400, detail="Senha deve ter pelo menos 4 caracteres")
    user_doc = {
        "email": email, "password_hash": hash_password(data.password),
        "name": data.name, "role": data.role.value,
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.usuarios.insert_one(user_doc)
    await create_log("cadastro", f"Usuario criado: {email} ({data.role.value})", admin["id"], admin["name"])
    return UserResponse(id=str(result.inserted_id), email=email, name=data.name, role=data.role.value, created_at=user_doc["created_at"])

@api_router.put("/usuarios/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, data: UserManageUpdate, request: Request):
    admin = await require_admin(request)
    u = await db.usuarios.find_one({"_id": ObjectId(user_id)})
    if not u:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado")
    update_fields = {}
    if data.name is not None:
        update_fields["name"] = data.name
    if data.role is not None:
        update_fields["role"] = data.role.value
    if data.password is not None:
        if len(data.password) < 4:
            raise HTTPException(status_code=400, detail="Senha deve ter pelo menos 4 caracteres")
        update_fields["password_hash"] = hash_password(data.password)
    if update_fields:
        await db.usuarios.update_one({"_id": ObjectId(user_id)}, {"$set": update_fields})
    await create_log("cadastro", f"Usuario atualizado: {u['email']}", admin["id"], admin["name"])
    updated = await db.usuarios.find_one({"_id": ObjectId(user_id)})
    return UserResponse(id=str(updated["_id"]), email=updated["email"], name=updated["name"], role=updated["role"], created_at=updated.get("created_at", datetime.now(timezone.utc)))

@api_router.delete("/usuarios/{user_id}")
async def delete_user(user_id: str, request: Request):
    admin = await require_admin(request)
    if admin["id"] == user_id:
        raise HTTPException(status_code=400, detail="Nao e possivel remover seu proprio usuario")
    u = await db.usuarios.find_one({"_id": ObjectId(user_id)})
    if not u:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado")
    await db.usuarios.delete_one({"_id": ObjectId(user_id)})
    await create_log("cadastro", f"Usuario removido: {u['email']}", admin["id"], admin["name"])
    return {"message": "Usuario removido com sucesso"}

# ==================== CLIENTS ROUTES ====================
@api_router.get("/clientes", response_model=List[ClientResponse])
async def list_clients(request: Request, search: Optional[str] = None):
    await get_current_user(request)
    query = {}
    if search:
        query = {"$or": [
            {"nome": {"$regex": search, "$options": "i"}},
            {"documento": {"$regex": search, "$options": "i"}},
            {"cpf": {"$regex": search, "$options": "i"}},
            {"telefone": {"$regex": search, "$options": "i"}}
        ]}
    clients = await db.clientes.find(query).to_list(1000)
    return [build_client_response(c) for c in clients]

@api_router.post("/clientes", response_model=ClientResponse)
async def create_client(data: ClientCreate, request: Request):
    user = await get_current_user(request)
    doc_clean = clean_document(data.documento)
    if not validate_document(data.documento, data.tipo_pessoa.value):
        tp = "CPF" if data.tipo_pessoa == TipoPessoa.pf else "CNPJ"
        raise HTTPException(status_code=400, detail=f"{tp} invalido")
    if data.cep and not validate_cep(data.cep):
        raise HTTPException(status_code=400, detail="CEP invalido (deve ter 8 digitos)")
    existing = await db.clientes.find_one({"documento": doc_clean})
    if existing:
        raise HTTPException(status_code=400, detail="Documento ja cadastrado")
    client_doc = {
        "nome": data.nome, "tipo_pessoa": data.tipo_pessoa.value,
        "documento": doc_clean, "telefone": data.telefone,
        "data_nascimento": data.data_nascimento,
        "cep": re.sub(r'\D', '', data.cep) if data.cep else None,
        "endereco": data.endereco, "numero_endereco": data.numero_endereco,
        "bairro": data.bairro, "cidade": data.cidade,
        "estado": data.estado, "city_code": data.city_code,
        "complemento": data.complemento,
        "status": data.status.value,
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.clientes.insert_one(client_doc)
    client_doc["_id"] = result.inserted_id
    await create_log("cadastro", f"Cliente cadastrado: {data.nome}", user["id"], user["name"])
    return build_client_response(client_doc)

@api_router.get("/clientes/{client_id}", response_model=ClientResponse)
async def get_client(client_id: str, request: Request):
    await get_current_user(request)
    c = await db.clientes.find_one({"_id": ObjectId(client_id)})
    if not c:
        raise HTTPException(status_code=404, detail="Cliente nao encontrado")
    return build_client_response(c)

@api_router.put("/clientes/{client_id}", response_model=ClientResponse)
async def update_client(client_id: str, data: ClientCreate, request: Request):
    user = await get_current_user(request)
    c = await db.clientes.find_one({"_id": ObjectId(client_id)})
    if not c:
        raise HTTPException(status_code=404, detail="Cliente nao encontrado")
    doc_clean = clean_document(data.documento)
    if not validate_document(data.documento, data.tipo_pessoa.value):
        tp = "CPF" if data.tipo_pessoa == TipoPessoa.pf else "CNPJ"
        raise HTTPException(status_code=400, detail=f"{tp} invalido")
    if data.cep and not validate_cep(data.cep):
        raise HTTPException(status_code=400, detail="CEP invalido")
    existing = await db.clientes.find_one({"documento": doc_clean, "_id": {"$ne": ObjectId(client_id)}})
    if existing:
        raise HTTPException(status_code=400, detail="Documento ja cadastrado para outro cliente")
    update_data = {
        "nome": data.nome, "tipo_pessoa": data.tipo_pessoa.value,
        "documento": doc_clean, "telefone": data.telefone,
        "data_nascimento": data.data_nascimento,
        "cep": re.sub(r'\D', '', data.cep) if data.cep else None,
        "endereco": data.endereco, "numero_endereco": data.numero_endereco,
        "bairro": data.bairro, "cidade": data.cidade,
        "estado": data.estado, "city_code": data.city_code,
        "complemento": data.complemento,
        "status": data.status.value,
    }
    await db.clientes.update_one({"_id": ObjectId(client_id)}, {"$set": update_data})
    await create_log("cadastro", f"Cliente atualizado: {data.nome}", user["id"], user["name"])
    updated = await db.clientes.find_one({"_id": ObjectId(client_id)})
    return build_client_response(updated)

@api_router.delete("/clientes/{client_id}")
async def delete_client(client_id: str, request: Request):
    user = await require_admin(request)
    c = await db.clientes.find_one({"_id": ObjectId(client_id)})
    if not c:
        raise HTTPException(status_code=404, detail="Cliente nao encontrado")
    await db.clientes.delete_one({"_id": ObjectId(client_id)})
    await create_log("cadastro", f"Cliente removido: {c['nome']}", user["id"], user["name"])
    return {"message": "Cliente removido com sucesso"}

# ==================== PLANS ROUTES ====================
@api_router.get("/planos", response_model=List[PlanResponse])
async def list_plans(request: Request):
    await get_current_user(request)
    plans = await db.planos.find({}).to_list(1000)
    return [PlanResponse(
        id=str(p["_id"]), nome=p["nome"], franquia=p["franquia"],
        descricao=p.get("descricao"), plan_code=p.get("plan_code"),
        created_at=p.get("created_at", datetime.now(timezone.utc))
    ) for p in plans]

@api_router.post("/planos", response_model=PlanResponse)
async def create_plan(data: PlanCreate, request: Request):
    user = await require_admin(request)
    plan_doc = {
        "nome": data.nome, "franquia": data.franquia,
        "descricao": data.descricao, "plan_code": data.plan_code,
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.planos.insert_one(plan_doc)
    await create_log("cadastro", f"Plano cadastrado: {data.nome} (plan_code: {data.plan_code})", user["id"], user["name"])
    return PlanResponse(
        id=str(result.inserted_id), nome=data.nome, franquia=data.franquia,
        descricao=data.descricao, plan_code=data.plan_code, created_at=plan_doc["created_at"]
    )

@api_router.put("/planos/{plan_id}", response_model=PlanResponse)
async def update_plan(plan_id: str, data: PlanCreate, request: Request):
    user = await require_admin(request)
    plan = await db.planos.find_one({"_id": ObjectId(plan_id)})
    if not plan:
        raise HTTPException(status_code=404, detail="Plano nao encontrado")
    await db.planos.update_one({"_id": ObjectId(plan_id)}, {"$set": {
        "nome": data.nome, "franquia": data.franquia,
        "descricao": data.descricao, "plan_code": data.plan_code,
    }})
    await create_log("cadastro", f"Plano atualizado: {data.nome}", user["id"], user["name"])
    return PlanResponse(
        id=plan_id, nome=data.nome, franquia=data.franquia,
        descricao=data.descricao, plan_code=data.plan_code,
        created_at=plan.get("created_at", datetime.now(timezone.utc))
    )

@api_router.delete("/planos/{plan_id}")
async def delete_plan(plan_id: str, request: Request):
    user = await require_admin(request)
    plan = await db.planos.find_one({"_id": ObjectId(plan_id)})
    if not plan:
        raise HTTPException(status_code=404, detail="Plano nao encontrado")
    offer_using = await db.ofertas.find_one({"plano_id": plan_id})
    if offer_using:
        raise HTTPException(status_code=400, detail="Plano esta vinculado a ofertas e nao pode ser removido")
    await db.planos.delete_one({"_id": ObjectId(plan_id)})
    await create_log("cadastro", f"Plano removido: {plan['nome']}", user["id"], user["name"])
    return {"message": "Plano removido com sucesso"}

# ==================== OFFERS ROUTES ====================
async def build_offer_response(o: dict) -> OfferResponse:
    plano_nome, franquia, plan_code = None, None, None
    if o.get("plano_id"):
        plano = await db.planos.find_one({"_id": ObjectId(o["plano_id"])})
        if plano:
            plano_nome = plano["nome"]
            franquia = plano["franquia"]
            plan_code = plano.get("plan_code")
    return OfferResponse(
        id=str(o["_id"]), nome=o["nome"], plano_id=o["plano_id"],
        plano_nome=plano_nome, franquia=franquia, plan_code=plan_code,
        valor=o["valor"], descricao=o.get("descricao"),
        ativo=o.get("ativo", True),
        created_at=o.get("created_at", datetime.now(timezone.utc))
    )

@api_router.get("/ofertas", response_model=List[OfferResponse])
async def list_offers(request: Request, ativo: Optional[bool] = None):
    await get_current_user(request)
    query = {}
    if ativo is not None:
        query["ativo"] = ativo
    offers = await db.ofertas.find(query).to_list(1000)
    return [await build_offer_response(o) for o in offers]

@api_router.get("/ofertas/{offer_id}", response_model=OfferResponse)
async def get_offer(offer_id: str, request: Request):
    await get_current_user(request)
    offer = await db.ofertas.find_one({"_id": ObjectId(offer_id)})
    if not offer:
        raise HTTPException(status_code=404, detail="Oferta nao encontrada")
    return await build_offer_response(offer)

@api_router.post("/ofertas", response_model=OfferResponse)
async def create_offer(data: OfferCreate, request: Request):
    user = await require_admin(request)
    plano = await db.planos.find_one({"_id": ObjectId(data.plano_id)})
    if not plano:
        raise HTTPException(status_code=400, detail="Plano nao encontrado")
    offer_doc = {
        "nome": data.nome, "plano_id": data.plano_id,
        "valor": data.valor, "descricao": data.descricao,
        "ativo": data.ativo, "created_at": datetime.now(timezone.utc)
    }
    result = await db.ofertas.insert_one(offer_doc)
    await create_log("cadastro", f"Oferta cadastrada: {data.nome} - R$ {data.valor:.2f}", user["id"], user["name"])
    offer_doc["_id"] = result.inserted_id
    return await build_offer_response(offer_doc)

@api_router.put("/ofertas/{offer_id}", response_model=OfferResponse)
async def update_offer(offer_id: str, data: OfferCreate, request: Request):
    user = await require_admin(request)
    offer = await db.ofertas.find_one({"_id": ObjectId(offer_id)})
    if not offer:
        raise HTTPException(status_code=404, detail="Oferta nao encontrada")
    plano = await db.planos.find_one({"_id": ObjectId(data.plano_id)})
    if not plano:
        raise HTTPException(status_code=400, detail="Plano nao encontrado")
    await db.ofertas.update_one({"_id": ObjectId(offer_id)}, {"$set": {
        "nome": data.nome, "plano_id": data.plano_id,
        "valor": data.valor, "descricao": data.descricao, "ativo": data.ativo,
    }})
    await create_log("cadastro", f"Oferta atualizada: {data.nome}", user["id"], user["name"])
    updated = await db.ofertas.find_one({"_id": ObjectId(offer_id)})
    return await build_offer_response(updated)

@api_router.delete("/ofertas/{offer_id}")
async def delete_offer(offer_id: str, request: Request):
    user = await require_admin(request)
    offer = await db.ofertas.find_one({"_id": ObjectId(offer_id)})
    if not offer:
        raise HTTPException(status_code=404, detail="Oferta nao encontrada")
    chip_using = await db.chips.find_one({"oferta_id": offer_id})
    if chip_using:
        raise HTTPException(status_code=400, detail="Oferta esta vinculada a chips e nao pode ser removida")
    await db.ofertas.delete_one({"_id": ObjectId(offer_id)})
    await create_log("cadastro", f"Oferta removida: {offer['nome']}", user["id"], user["name"])
    return {"message": "Oferta removida com sucesso"}

# ==================== CHIPS ROUTES ====================
async def build_chip_response(chip: dict) -> ChipResponse:
    cliente_nome, oferta_nome, plano_nome, franquia, valor, plan_code = None, None, None, None, None, None
    if chip.get("cliente_id"):
        cl = await db.clientes.find_one({"_id": ObjectId(chip["cliente_id"])})
        if cl:
            cliente_nome = cl["nome"]
    if chip.get("oferta_id"):
        oferta = await db.ofertas.find_one({"_id": ObjectId(chip["oferta_id"])})
        if oferta:
            oferta_nome = oferta["nome"]
            valor = oferta["valor"]
            if oferta.get("plano_id"):
                plano = await db.planos.find_one({"_id": ObjectId(oferta["plano_id"])})
                if plano:
                    plano_nome = plano["nome"]
                    franquia = plano["franquia"]
                    plan_code = plano.get("plan_code")
    return ChipResponse(
        id=str(chip["_id"]), iccid=chip["iccid"], status=chip["status"],
        msisdn=chip.get("msisdn"), oferta_id=chip.get("oferta_id"),
        oferta_nome=oferta_nome, plano_nome=plano_nome, franquia=franquia,
        plan_code=plan_code, valor=valor,
        cliente_id=chip.get("cliente_id"), cliente_nome=cliente_nome,
        created_at=chip.get("created_at", datetime.now(timezone.utc))
    )

@api_router.get("/chips", response_model=List[ChipResponse])
async def list_chips(request: Request, status: Optional[str] = None, oferta_id: Optional[str] = None):
    await get_current_user(request)
    query = {}
    if status:
        query["status"] = status
    if oferta_id:
        query["oferta_id"] = oferta_id
    chips = await db.chips.find(query).to_list(1000)
    return [await build_chip_response(c) for c in chips]

@api_router.post("/chips", response_model=ChipResponse)
async def create_chip(data: ChipCreate, request: Request):
    user = await require_admin(request)
    existing = await db.chips.find_one({"iccid": data.iccid})
    if existing:
        raise HTTPException(status_code=400, detail="ICCID ja cadastrado")
    oferta = await db.ofertas.find_one({"_id": ObjectId(data.oferta_id)})
    if not oferta:
        raise HTTPException(status_code=400, detail="Oferta nao encontrada")
    if not oferta.get("ativo", True):
        raise HTTPException(status_code=400, detail="Oferta nao esta ativa")
    chip_doc = {
        "iccid": data.iccid, "status": ChipStatus.disponivel.value,
        "oferta_id": data.oferta_id, "cliente_id": None, "msisdn": None,
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.chips.insert_one(chip_doc)
    chip_doc["_id"] = result.inserted_id
    await create_log("cadastro", f"Chip cadastrado: {data.iccid}", user["id"], user["name"])
    return await build_chip_response(chip_doc)

@api_router.delete("/chips/{chip_id}")
async def delete_chip(chip_id: str, request: Request):
    user = await require_admin(request)
    chip = await db.chips.find_one({"_id": ObjectId(chip_id)})
    if not chip:
        raise HTTPException(status_code=404, detail="Chip nao encontrado")
    if chip["status"] == ChipStatus.ativado.value:
        raise HTTPException(status_code=400, detail="Nao e possivel remover um chip ativado")
    await db.chips.delete_one({"_id": ObjectId(chip_id)})
    await create_log("cadastro", f"Chip removido: {chip['iccid']}", user["id"], user["name"])
    return {"message": "Chip removido com sucesso"}

# ==================== ACTIVATION ROUTE ====================
@api_router.post("/ativacao", response_model=ActivationResponse)
async def activate_line(data: ActivationRequest, request: Request):
    user = await get_current_user(request)

    # Get client
    cliente = await db.clientes.find_one({"_id": ObjectId(data.cliente_id)})
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente nao encontrado")
    if cliente["status"] != ClientStatus.ativo.value:
        raise HTTPException(status_code=400, detail="Cliente nao esta ativo")

    # Validate client data completeness
    is_complete, missing = check_client_completeness(cliente)
    if not is_complete:
        field_names = {"nome": "Nome", "documento": "CPF/CNPJ", "telefone": "Telefone",
                       "data_nascimento": "Data de Nascimento", "cep": "CEP", "numero_endereco": "Numero do Endereco"}
        missing_labels = [field_names.get(f, f) for f in missing]
        raise HTTPException(status_code=400, detail=f"Dados incompletos do cliente. Faltam: {', '.join(missing_labels)}")

    # Get chip
    chip = await db.chips.find_one({"_id": ObjectId(data.chip_id)})
    if not chip:
        raise HTTPException(status_code=404, detail="Chip nao encontrado")
    if chip["status"] != ChipStatus.disponivel.value:
        status_msg = {
            ChipStatus.ativado.value: "Chip ja esta ativado",
            ChipStatus.bloqueado.value: "Chip esta bloqueado",
            ChipStatus.reservado.value: "Chip esta reservado",
            ChipStatus.cancelado.value: "Chip esta cancelado",
        }
        raise HTTPException(status_code=400, detail=status_msg.get(chip["status"], f"Chip com status invalido: {chip['status']}"))

    # Get offer from chip
    if not chip.get("oferta_id"):
        raise HTTPException(status_code=400, detail="Chip nao possui oferta vinculada")
    oferta = await db.ofertas.find_one({"_id": ObjectId(chip["oferta_id"])})
    if not oferta:
        raise HTTPException(status_code=400, detail="Oferta do chip nao encontrada")
    if not oferta.get("ativo", True):
        raise HTTPException(status_code=400, detail="Oferta do chip nao esta ativa")

    # Get plan from offer
    if not oferta.get("plano_id"):
        raise HTTPException(status_code=400, detail="Oferta nao possui plano vinculado")
    plano = await db.planos.find_one({"_id": ObjectId(oferta["plano_id"])})
    if not plano:
        raise HTTPException(status_code=400, detail="Plano da oferta nao encontrado")
    if not plano.get("plan_code"):
        raise HTTPException(status_code=400, detail="Plano nao possui plan_code configurado. Sincronize os planos da operadora primeiro.")

    # Build activation payload for Ta Telecom
    tipo_pessoa = cliente.get("tipo_pessoa", "pf")
    telefone_clean = re.sub(r'\D', '', cliente.get("telefone", ""))
    ddd = telefone_clean[:2] if len(telefone_clean) >= 2 else "11"

    activation_payload = {
        "person_type": tipo_pessoa,
        "person_name": cliente["nome"],
        "document_number": clean_document(cliente.get("documento", "")),
        "phone_number": telefone_clean,
        "date_of_birth": cliente.get("data_nascimento", ""),
        "type_of_street": "",
        "address": cliente.get("endereco", ""),
        "address_number": cliente.get("numero_endereco", ""),
        "neighborhood": cliente.get("bairro", ""),
        "state": cliente.get("estado", ""),
        "city_code": cliente.get("city_code", ""),
        "postcode": re.sub(r'\D', '', cliente.get("cep", "")),
        "plan_code": plano["plan_code"],
        "portability": False,
        "cn_contract_line": ddd,
        "contract_line": "",
    }

    # Call operadora service
    result = await operadora_service.ativar_chip(
        iccid=chip["iccid"],
        activation_payload=activation_payload,
        db=db, user_id=user["id"], user_name=user["name"]
    )

    if result.success:
        status_str = result.status if isinstance(result.status, str) else result.status.value
        # Pendente = reservado (aguardando confirmacao), Ativo = ativado
        chip_status = ChipStatus.ativado.value if status_str == "ativo" else ChipStatus.reservado.value
        msisdn = result.numero or (result.data.get("msisdn") if result.data else None)

        await db.chips.update_one({"_id": ObjectId(data.chip_id)}, {"$set": {
            "status": chip_status, "cliente_id": data.cliente_id, "msisdn": msisdn,
        }})

        line_doc = {
            "numero": msisdn or "Pendente",
            "status": status_str,
            "cliente_id": data.cliente_id,
            "chip_id": data.chip_id,
            "plano_id": oferta["plano_id"],
            "oferta_id": chip["oferta_id"],
            "msisdn": msisdn,
            "created_at": datetime.now(timezone.utc)
        }
        await db.linhas.insert_one(line_doc)

    return ActivationResponse(
        success=result.success,
        status=result.status if isinstance(result.status, str) else result.status.value,
        message=result.message,
        numero=result.numero or (result.data.get("msisdn") if result.data else None),
        oferta_nome=oferta["nome"],
        plano_nome=plano["nome"],
        franquia=plano["franquia"],
        valor=oferta["valor"],
        response_time_ms=result.response_time_ms,
    )

# ==================== LINES ROUTES ====================
async def build_line_response(line: dict) -> LineResponse:
    cliente_nome, plano_nome, oferta_nome, franquia, plan_code, iccid, msisdn = None, None, None, None, None, None, None
    if line.get("cliente_id"):
        cl = await db.clientes.find_one({"_id": ObjectId(line["cliente_id"])})
        if cl:
            cliente_nome = cl["nome"]
    if line.get("plano_id"):
        plano = await db.planos.find_one({"_id": ObjectId(line["plano_id"])})
        if plano:
            plano_nome = plano["nome"]
            franquia = plano["franquia"]
            plan_code = plano.get("plan_code")
    if line.get("oferta_id"):
        oferta = await db.ofertas.find_one({"_id": ObjectId(line["oferta_id"])})
        if oferta:
            oferta_nome = oferta["nome"]
    if line.get("chip_id"):
        chip = await db.chips.find_one({"_id": ObjectId(line["chip_id"])})
        if chip:
            iccid = chip["iccid"]
            msisdn = chip.get("msisdn")
    return LineResponse(
        id=str(line["_id"]), numero=line["numero"], status=line["status"],
        cliente_id=line["cliente_id"], chip_id=line["chip_id"],
        plano_id=line["plano_id"], oferta_id=line.get("oferta_id"),
        cliente_nome=cliente_nome, plano_nome=plano_nome,
        oferta_nome=oferta_nome, franquia=franquia, plan_code=plan_code,
        iccid=iccid, msisdn=msisdn or line.get("msisdn"),
        created_at=line.get("created_at", datetime.now(timezone.utc))
    )

@api_router.get("/linhas", response_model=List[LineResponse])
async def list_lines(request: Request, status: Optional[str] = None):
    await get_current_user(request)
    query = {}
    if status:
        query["status"] = status
    lines = await db.linhas.find(query).to_list(1000)
    return [await build_line_response(l) for l in lines]

@api_router.get("/linhas/{line_id}/consultar")
async def query_line_from_operator(line_id: str, request: Request):
    user = await require_admin(request)
    line = await db.linhas.find_one({"_id": ObjectId(line_id)})
    if not line:
        raise HTTPException(status_code=404, detail="Linha nao encontrada")
    chip = await db.chips.find_one({"_id": ObjectId(line["chip_id"])})
    if not chip:
        raise HTTPException(status_code=404, detail="Chip da linha nao encontrado")
    result = await operadora_service.consultar_linha(
        iccid=chip["iccid"], db=db, user_id=user["id"], user_name=user["name"]
    )
    return {
        "success": result.success,
        "status": result.status if isinstance(result.status, str) else result.status.value,
        "message": result.message,
        "data": result.data,
        "response_time_ms": result.response_time_ms,
    }

@api_router.post("/linhas/{line_id}/bloquear-parcial")
async def block_line_partial(line_id: str, request: Request):
    user = await require_admin(request)
    line = await db.linhas.find_one({"_id": ObjectId(line_id)})
    if not line:
        raise HTTPException(status_code=404, detail="Linha nao encontrada")
    if line["status"] == LineStatus.bloqueado.value:
        raise HTTPException(status_code=400, detail="Linha ja esta bloqueada")
    chip = await db.chips.find_one({"_id": ObjectId(line["chip_id"])})
    if not chip:
        raise HTTPException(status_code=404, detail="Chip nao encontrado")
    result = await operadora_service.bloquear_parcial(
        iccid=chip["iccid"], db=db, user_id=user["id"], user_name=user["name"]
    )
    if result.success:
        await db.linhas.update_one({"_id": ObjectId(line_id)}, {"$set": {"status": LineStatus.bloqueado.value}})
        await db.chips.update_one({"_id": ObjectId(line["chip_id"])}, {"$set": {"status": ChipStatus.bloqueado.value}})
    return {
        "success": result.success, "message": result.message,
        "status": result.status if isinstance(result.status, str) else result.status.value,
        "response_time_ms": result.response_time_ms,
    }

@api_router.post("/linhas/{line_id}/bloquear-total")
async def block_line_total(line_id: str, data: BlockTotalRequest, request: Request):
    user = await require_admin(request)
    line = await db.linhas.find_one({"_id": ObjectId(line_id)})
    if not line:
        raise HTTPException(status_code=404, detail="Linha nao encontrada")
    if data.reason not in BLOCK_REASONS:
        raise HTTPException(status_code=400, detail=f"Motivo invalido. Opcoes: {BLOCK_REASONS}")
    chip = await db.chips.find_one({"_id": ObjectId(line["chip_id"])})
    if not chip:
        raise HTTPException(status_code=404, detail="Chip nao encontrado")
    result = await operadora_service.bloquear_total(
        iccid=chip["iccid"], reason=data.reason, db=db, user_id=user["id"], user_name=user["name"]
    )
    if result.success:
        await db.linhas.update_one({"_id": ObjectId(line_id)}, {"$set": {"status": LineStatus.bloqueado.value}})
        await db.chips.update_one({"_id": ObjectId(line["chip_id"])}, {"$set": {"status": ChipStatus.bloqueado.value}})
    return {
        "success": result.success, "message": result.message,
        "status": result.status if isinstance(result.status, str) else result.status.value,
        "response_time_ms": result.response_time_ms,
    }

@api_router.post("/linhas/{line_id}/desbloquear")
async def unblock_line(line_id: str, request: Request):
    user = await require_admin(request)
    line = await db.linhas.find_one({"_id": ObjectId(line_id)})
    if not line:
        raise HTTPException(status_code=404, detail="Linha nao encontrada")
    if line["status"] != LineStatus.bloqueado.value:
        raise HTTPException(status_code=400, detail="Linha nao esta bloqueada")
    chip = await db.chips.find_one({"_id": ObjectId(line["chip_id"])})
    if not chip:
        raise HTTPException(status_code=404, detail="Chip nao encontrado")
    result = await operadora_service.desbloquear(
        iccid=chip["iccid"], db=db, user_id=user["id"], user_name=user["name"]
    )
    if result.success:
        await db.linhas.update_one({"_id": ObjectId(line_id)}, {"$set": {"status": LineStatus.ativo.value}})
        await db.chips.update_one({"_id": ObjectId(line["chip_id"])}, {"$set": {"status": ChipStatus.ativado.value}})
    return {
        "success": result.success, "message": result.message,
        "status": result.status if isinstance(result.status, str) else result.status.value,
        "response_time_ms": result.response_time_ms,
    }

@api_router.post("/linhas/{line_id}/alterar-plano")
async def change_plan(line_id: str, data: PlanChangeRequest, request: Request):
    user = await require_admin(request)
    line = await db.linhas.find_one({"_id": ObjectId(line_id)})
    if not line:
        raise HTTPException(status_code=404, detail="Linha nao encontrada")
    if line["status"] != LineStatus.ativo.value:
        raise HTTPException(status_code=400, detail="Linha precisa estar ativa para alterar plano")
    # Get new offer -> plan -> plan_code
    new_oferta = await db.ofertas.find_one({"_id": ObjectId(data.oferta_id)})
    if not new_oferta:
        raise HTTPException(status_code=400, detail="Nova oferta nao encontrada")
    new_plano = await db.planos.find_one({"_id": ObjectId(new_oferta["plano_id"])})
    if not new_plano:
        raise HTTPException(status_code=400, detail="Plano da nova oferta nao encontrado")
    if not new_plano.get("plan_code"):
        raise HTTPException(status_code=400, detail="Plano nao possui plan_code configurado")
    chip = await db.chips.find_one({"_id": ObjectId(line["chip_id"])})
    if not chip:
        raise HTTPException(status_code=404, detail="Chip nao encontrado")
    result = await operadora_service.alterar_plano(
        iccid=chip["iccid"], plan_code=new_plano["plan_code"],
        db=db, user_id=user["id"], user_name=user["name"]
    )
    if result.success:
        await db.linhas.update_one({"_id": ObjectId(line_id)}, {"$set": {
            "plano_id": str(new_plano["_id"]), "oferta_id": data.oferta_id,
        }})
        await db.chips.update_one({"_id": ObjectId(line["chip_id"])}, {"$set": {
            "oferta_id": data.oferta_id,
        }})
    return {
        "success": result.success, "message": result.message,
        "new_plan": new_plano["nome"] if result.success else None,
        "new_offer": new_oferta["nome"] if result.success else None,
        "response_time_ms": result.response_time_ms,
    }

# ==================== OPERADORA SYNC ROUTES ====================
@api_router.post("/operadora/sincronizar-planos")
async def sync_plans_from_operator(request: Request):
    user = await require_admin(request)
    result = await operadora_service.listar_planos(db=db, user_id=user["id"], user_name=user["name"])
    if not result.success:
        raise HTTPException(status_code=502, detail=f"Erro ao buscar planos da operadora: {result.message}")
    plans_data = result.data.get("items", result.data.get("plans", result.data.get("data", [])))
    if isinstance(plans_data, dict):
        plans_data = plans_data.get("items", plans_data.get("plans", []))
    synced = 0
    created = 0
    for plan_item in plans_data:
        # Ta Telecom format: {id: 15, quantity: {dados: 2000, sms: 100, telefonia: 100}, description: "..."}
        pc = plan_item.get("id") or plan_item.get("plan_code") or plan_item.get("code")
        if not pc:
            continue
        pc_str = str(pc)
        desc = plan_item.get("description") or plan_item.get("nome") or plan_item.get("name") or pc_str
        # Extract franquia from quantity.dados (in MB) or direct field
        quantity = plan_item.get("quantity")
        if isinstance(quantity, dict) and quantity.get("dados"):
            dados_mb = quantity["dados"]
            if dados_mb >= 1000:
                franquia = f"{dados_mb // 1000}GB"
            else:
                franquia = f"{dados_mb}MB"
        else:
            franquia = plan_item.get("data_limit") or plan_item.get("franquia") or ""
        existing = await db.planos.find_one({"plan_code": pc_str})
        if existing:
            await db.planos.update_one({"_id": existing["_id"]}, {"$set": {
                "nome": desc, "franquia": franquia, "descricao": desc,
            }})
            synced += 1
        else:
            await db.planos.insert_one({
                "nome": desc, "franquia": franquia,
                "descricao": desc,
                "plan_code": pc_str,
                "created_at": datetime.now(timezone.utc),
            })
            created += 1
    await create_log("sincronizacao", f"Planos sincronizados: {synced} atualizados, {created} criados", user["id"], user["name"])
    return {"success": True, "message": f"Sincronizacao concluida: {synced} atualizados, {created} criados", "synced": synced, "created": created}

@api_router.post("/operadora/sincronizar-estoque")
async def sync_stock_from_operator(request: Request):
    user = await require_admin(request)
    result = await operadora_service.listar_estoque(db=db, user_id=user["id"], user_name=user["name"])
    if not result.success:
        raise HTTPException(status_code=502, detail=f"Erro ao buscar estoque da operadora: {result.message}")
    # Ta Telecom estoque format: {codigo_status_tip, results: [{data, sim_card, status}]}
    items = result.data.get("results", result.data.get("items", result.data.get("data", [])))
    if isinstance(items, dict):
        items = items.get("results", items.get("items", []))
    # Status text mapping
    status_text_map = {
        "DISPONÍVEL": "disponivel", "DISPONIVEL": "disponivel",
        "CANCELADO": "cancelado", "CANCELADA": "cancelado",
        "EM USO": "ativado", "ATIVADO": "ativado", "ATIVA": "ativado", "ATIVO": "ativado",
        "BLOQUEADO": "bloqueado", "BLOQUEADA": "bloqueado",
        "SUSPENSA": "bloqueado", "SUSPENSO": "bloqueado",
    }
    synced = 0
    created = 0
    for item in items:
        # Try different field names for ICCID
        iccid = item.get("sim_card") or item.get("iccid") or item.get("ICCID")
        if not iccid:
            continue
        # Map status - can be text string or numeric
        raw_status = item.get("status", "")
        if isinstance(raw_status, str):
            local_status = status_text_map.get(raw_status.upper().strip(), "disponivel")
        elif isinstance(raw_status, int):
            local_status = STOCK_STATUS_MAP.get(raw_status, "disponivel")
        else:
            local_status = "disponivel"
        msisdn = item.get("msisdn") or item.get("MSISDN") or item.get("telefone")
        existing = await db.chips.find_one({"iccid": str(iccid)})
        if existing:
            update_fields = {"status": local_status}
            if msisdn:
                update_fields["msisdn"] = str(msisdn)
            await db.chips.update_one({"_id": existing["_id"]}, {"$set": update_fields})
            synced += 1
        else:
            await db.chips.insert_one({
                "iccid": str(iccid), "status": local_status,
                "oferta_id": None, "cliente_id": None,
                "msisdn": str(msisdn) if msisdn else None,
                "created_at": datetime.now(timezone.utc),
            })
            created += 1
    await create_log("sincronizacao", f"Estoque sincronizado: {synced} atualizados, {created} importados", user["id"], user["name"])
    return {"success": True, "message": f"Sincronizacao concluida: {synced} atualizados, {created} importados", "synced": synced, "created": created}

@api_router.get("/operadora/config")
async def get_operadora_config(request: Request):
    await require_admin(request)
    return operadora_service.get_config_status()

@api_router.post("/operadora/test")
async def test_operadora_connection(request: Request):
    user = await require_admin(request)
    result = await operadora_service.listar_planos(db=db, user_id=user["id"], user_name=user["name"])
    return {
        "mode": "mock" if operadora_service.use_mock else "real",
        "test_success": result.success,
        "response_time_ms": result.response_time_ms,
        "message": result.message if result.success else f"Erro: {result.message}",
    }

# ==================== LOGS ROUTES ====================
@api_router.get("/logs", response_model=List[LogEntry])
async def list_logs(request: Request, action: Optional[str] = None, limit: int = 100):
    await require_admin(request)
    query = {}
    if action:
        query["action"] = action
    logs = await db.logs.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    return [LogEntry(
        id=str(log["_id"]), action=log["action"], details=log["details"],
        user_id=log.get("user_id"), user_name=log.get("user_name"),
        created_at=log.get("created_at", datetime.now(timezone.utc)),
        api_request=log.get("api_request"), api_response=log.get("api_response"),
        is_mock=log.get("is_mock"),
    ) for log in logs]

# ==================== DASHBOARD STATS ====================
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(request: Request):
    await get_current_user(request)
    total_clientes = await db.clientes.count_documents({})
    clientes_ativos = await db.clientes.count_documents({"status": "ativo"})
    total_chips = await db.chips.count_documents({})
    chips_disponiveis = await db.chips.count_documents({"status": "disponivel"})
    chips_ativados = await db.chips.count_documents({"status": "ativado"})
    chips_bloqueados = await db.chips.count_documents({"status": "bloqueado"})
    total_linhas = await db.linhas.count_documents({})
    linhas_ativas = await db.linhas.count_documents({"status": "ativo"})
    linhas_pendentes = await db.linhas.count_documents({"status": "pendente"})
    linhas_bloqueadas = await db.linhas.count_documents({"status": "bloqueado"})
    total_planos = await db.planos.count_documents({})
    total_ofertas = await db.ofertas.count_documents({})
    ofertas_ativas = await db.ofertas.count_documents({"ativo": True})
    recent_logs = await db.logs.find({}).sort("created_at", -1).limit(5).to_list(5)
    return {
        "clientes": {"total": total_clientes, "ativos": clientes_ativos},
        "chips": {"total": total_chips, "disponiveis": chips_disponiveis, "ativados": chips_ativados, "bloqueados": chips_bloqueados},
        "linhas": {"total": total_linhas, "ativas": linhas_ativas, "pendentes": linhas_pendentes, "bloqueadas": linhas_bloqueadas},
        "planos": {"total": total_planos},
        "ofertas": {"total": total_ofertas, "ativas": ofertas_ativas},
        "operadora": operadora_service.get_config_status(),
        "recent_logs": [{
            "id": str(log["_id"]), "action": log["action"], "details": log["details"],
            "created_at": log.get("created_at", datetime.now(timezone.utc)).isoformat()
        } for log in recent_logs]
    }

# ==================== BLOCK REASONS ENDPOINT ====================
@api_router.get("/operadora/motivos-bloqueio")
async def get_block_reasons(request: Request):
    await get_current_user(request)
    return {"reasons": [{"code": k, "label": v} for k, v in BLOCK_REASONS.items()]}

# ==================== SEED DATA ====================
async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@mvno.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.usuarios.find_one({"email": admin_email})
    if existing is None:
        await db.usuarios.insert_one({
            "email": admin_email, "password_hash": hash_password(admin_password),
            "name": "Administrador", "role": "admin",
            "created_at": datetime.now(timezone.utc)
        })
        logger.info(f"Admin user created: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.usuarios.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
        logger.info(f"Admin password updated: {admin_email}")
    memory_dir = Path("/app/memory")
    memory_dir.mkdir(exist_ok=True)
    with open(memory_dir / "test_credentials.md", "w") as f:
        f.write(f"# Test Credentials\n\n## Admin User\n- Email: {admin_email}\n- Password: {admin_password}\n- Role: admin\n")

async def seed_sample_data():
    existing_plans = await db.planos.count_documents({})
    if existing_plans > 0:
        return
    plans = [
        {"nome": "Plano 5GB", "franquia": "5GB", "descricao": "Plano basico com 5GB", "plan_code": "PLAN_5GB", "created_at": datetime.now(timezone.utc)},
        {"nome": "Plano 10GB", "franquia": "10GB", "descricao": "Plano essencial com 10GB", "plan_code": "PLAN_10GB", "created_at": datetime.now(timezone.utc)},
        {"nome": "Plano 20GB", "franquia": "20GB", "descricao": "Plano plus com 20GB", "plan_code": "PLAN_20GB", "created_at": datetime.now(timezone.utc)},
        {"nome": "Plano 50GB", "franquia": "50GB", "descricao": "Plano premium com 50GB", "plan_code": "PLAN_50GB", "created_at": datetime.now(timezone.utc)},
    ]
    result = await db.planos.insert_many(plans)
    plan_ids = [str(pid) for pid in result.inserted_ids]
    offers = [
        {"nome": "Chip 5GB Basico", "plano_id": plan_ids[0], "valor": 29.90, "descricao": "Oferta basica", "ativo": True, "created_at": datetime.now(timezone.utc)},
        {"nome": "Chip 10GB Essencial", "plano_id": plan_ids[1], "valor": 49.90, "descricao": "Oferta essencial", "ativo": True, "created_at": datetime.now(timezone.utc)},
        {"nome": "Chip 20GB Plus", "plano_id": plan_ids[2], "valor": 79.90, "descricao": "Oferta plus", "ativo": True, "created_at": datetime.now(timezone.utc)},
        {"nome": "Chip 50GB Premium", "plano_id": plan_ids[3], "valor": 119.90, "descricao": "Oferta premium", "ativo": True, "created_at": datetime.now(timezone.utc)},
    ]
    result = await db.ofertas.insert_many(offers)
    offer_ids = [str(oid) for oid in result.inserted_ids]
    clients = [
        {"nome": "Joao Silva", "tipo_pessoa": "pf", "documento": "52998224725", "telefone": "11987654321",
         "data_nascimento": "1990-05-15", "cep": "01001000", "endereco": "Praca da Se",
         "numero_endereco": "100", "bairro": "Se", "cidade": "Sao Paulo", "estado": "SP",
         "city_code": "3550308", "complemento": None, "status": "ativo", "created_at": datetime.now(timezone.utc)},
        {"nome": "Maria Santos", "tipo_pessoa": "pf", "documento": "11144477735", "telefone": "11912345678",
         "data_nascimento": "1985-08-20", "cep": "04538133", "endereco": "Av Brigadeiro Faria Lima",
         "numero_endereco": "3477", "bairro": "Itaim Bibi", "cidade": "Sao Paulo", "estado": "SP",
         "city_code": "3550308", "complemento": "Sala 501", "status": "ativo", "created_at": datetime.now(timezone.utc)},
        {"nome": "Pedro Oliveira", "tipo_pessoa": "pf", "documento": "35379838867", "telefone": "21999876543",
         "data_nascimento": "1992-03-10", "cep": "20040020", "endereco": "Av Rio Branco",
         "numero_endereco": "156", "bairro": "Centro", "cidade": "Rio de Janeiro", "estado": "RJ",
         "city_code": "3304557", "complemento": None, "status": "ativo", "created_at": datetime.now(timezone.utc)},
    ]
    await db.clientes.insert_many(clients)
    chips = [
        {"iccid": "8955010012345678901", "status": "disponivel", "oferta_id": offer_ids[0], "cliente_id": None, "msisdn": None, "created_at": datetime.now(timezone.utc)},
        {"iccid": "8955010012345678902", "status": "disponivel", "oferta_id": offer_ids[1], "cliente_id": None, "msisdn": None, "created_at": datetime.now(timezone.utc)},
        {"iccid": "8955010012345678903", "status": "disponivel", "oferta_id": offer_ids[2], "cliente_id": None, "msisdn": None, "created_at": datetime.now(timezone.utc)},
        {"iccid": "8955010012345678904", "status": "disponivel", "oferta_id": offer_ids[3], "cliente_id": None, "msisdn": None, "created_at": datetime.now(timezone.utc)},
        {"iccid": "8955010012345678905", "status": "disponivel", "oferta_id": offer_ids[0], "cliente_id": None, "msisdn": None, "created_at": datetime.now(timezone.utc)},
    ]
    await db.chips.insert_many(chips)
    logger.info("Sample data seeded successfully with Ta Telecom structure")

@app.on_event("startup")
async def startup_event():
    await db.usuarios.create_index("email", unique=True)
    await db.clientes.create_index("documento", unique=True, sparse=True)
    await db.chips.create_index("iccid", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.logs.create_index([("created_at", -1)])
    await seed_admin()
    await seed_sample_data()
    logger.info("Application started successfully")

app.include_router(api_router)

frontend_url = os.environ.get('FRONTEND_URL', os.environ.get('CORS_ORIGINS', '*'))
origins = [frontend_url] if frontend_url != '*' else ["*"]
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=origins, allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
