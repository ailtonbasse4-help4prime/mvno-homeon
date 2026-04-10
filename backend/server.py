from dotenv import load_dotenv
load_dotenv(interpolate=False)

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import FileResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import re
import asyncio
import logging
import secrets
import json
import bcrypt
import jwt
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from enum import Enum

from services.operadora_service import operadora_service, OperadoraStatus, BLOCK_REASONS, STOCK_STATUS_MAP
from services.asaas_service import asaas_service, AsaasNotConfiguredError, AsaasApiError

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get("JWT_SECRET", secrets.token_hex(32))
JWT_ALGORITHM = "HS256"
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "true").lower() != "false"
COOKIE_SAMESITE = os.environ.get("COOKIE_SAMESITE", "lax")
SITE_URL = os.environ.get("SITE_URL", "")

def _append_portal_link(desc: str) -> str:
    """Adiciona link do Portal do Cliente na descricao da cobranca Asaas."""
    if SITE_URL:
        return f"{desc} | Acesse seu portal: {SITE_URL}/portal"
    return desc

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
    financeiro = "financeiro"

class BillingType(str, Enum):
    boleto = "BOLETO"
    pix = "PIX"
    credit_card = "CREDIT_CARD"
    undefined = "UNDEFINED"

class PaymentStatus(str, Enum):
    pendente = "PENDING"
    confirmado = "CONFIRMED"
    recebido = "RECEIVED"
    vencido = "OVERDUE"
    reembolsado = "REFUNDED"
    cancelado = "CANCELLED"

class SubscriptionStatus(str, Enum):
    ativa = "ACTIVE"
    expirada = "EXPIRED"
    cancelada = "CANCELLED"

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
    created_at: Optional[datetime] = None

# Client Models - expanded for Ta Telecom
class ClientCreate(BaseModel):
    nome: str
    tipo_pessoa: TipoPessoa = TipoPessoa.pf
    documento: str  # CPF or CNPJ
    telefone: str
    email: Optional[str] = None
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
    nome: str = ""
    tipo_pessoa: str = "PF"
    documento: str = ""
    telefone: str = ""
    email: Optional[str] = None
    data_nascimento: Optional[str] = None
    cep: Optional[str] = None
    endereco: Optional[str] = None
    numero_endereco: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    city_code: Optional[str] = None
    complemento: Optional[str] = None
    status: str = "ativo"
    dados_completos: bool = False
    created_at: Optional[datetime] = None
    linhas_count: int = 0
    linhas: list = []

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
    created_at: Optional[datetime] = None

class CategoriaOferta(str, Enum):
    movel = "movel"
    m2m = "m2m"

# Offer Models
class OfferCreate(BaseModel):
    nome: str
    plano_id: str
    valor: float
    descricao: Optional[str] = None
    categoria: CategoriaOferta = CategoriaOferta.movel
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
    categoria: str = "movel"
    ativo: bool
    created_at: Optional[datetime] = None

# Chip Models - with msisdn
class ChipCreate(BaseModel):
    iccid: str
    oferta_id: str

class ChipUpdate(BaseModel):
    oferta_id: str

class ChipResponse(BaseModel):
    id: str
    iccid: str = ""
    status: str = "disponivel"
    msisdn: Optional[str] = None
    oferta_id: Optional[str] = None
    oferta_nome: Optional[str] = None
    categoria: Optional[str] = None
    plano_nome: Optional[str] = None
    franquia: Optional[str] = None
    plan_code: Optional[str] = None
    valor: Optional[float] = None
    cliente_id: Optional[str] = None
    cliente_nome: Optional[str] = None
    created_at: Optional[datetime] = None

# Line Models
class LineResponse(BaseModel):
    id: str
    numero: str = ""
    status: str = "desconhecido"
    cliente_id: str = ""
    chip_id: str = ""
    plano_id: Optional[str] = None
    oferta_id: Optional[str] = None
    cliente_nome: Optional[str] = None
    cliente_documento: Optional[str] = None
    plano_nome: Optional[str] = None
    oferta_nome: Optional[str] = None
    franquia: Optional[str] = None
    plan_code: Optional[str] = None
    iccid: Optional[str] = None
    msisdn: Optional[str] = None
    created_at: Optional[datetime] = None

# Activation Models
class ActivationRequest(BaseModel):
    cliente_id: str
    chip_id: str
    ddd: Optional[str] = None
    portability: bool = False
    port_ddd: Optional[str] = None
    port_number: Optional[str] = None

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
    created_at: Optional[datetime] = None
    api_request: Optional[dict] = None
    api_response: Optional[dict] = None
    is_mock: Optional[bool] = None

# ==================== CARTEIRA MOVEL MODELS ====================
class CobrancaCreate(BaseModel):
    cliente_id: str
    linha_id: Optional[str] = None
    billing_type: BillingType = BillingType.pix
    valor: float
    vencimento: str  # YYYY-MM-DD
    descricao: Optional[str] = None

class CobrancaResponse(BaseModel):
    id: str
    cliente_id: str
    cliente_nome: Optional[str] = None
    linha_id: Optional[str] = None
    msisdn: Optional[str] = None
    oferta_nome: Optional[str] = None
    billing_type: str
    valor: float
    vencimento: str
    descricao: Optional[str] = None
    status: str
    asaas_payment_id: Optional[str] = None
    asaas_invoice_url: Optional[str] = None
    asaas_bankslip_url: Optional[str] = None
    asaas_pix_code: Optional[str] = None
    asaas_pix_qrcode: Optional[str] = None
    barcode: Optional[str] = None
    paid_at: Optional[str] = None
    created_at: Optional[datetime] = None

class AssinaturaCreate(BaseModel):
    cliente_id: str
    linha_id: Optional[str] = None
    billing_type: BillingType = BillingType.pix
    valor: float
    proximo_vencimento: str  # YYYY-MM-DD
    ciclo: str = "MONTHLY"
    descricao: Optional[str] = None

class AssinaturaResponse(BaseModel):
    id: str
    cliente_id: str
    cliente_nome: Optional[str] = None
    linha_id: Optional[str] = None
    msisdn: Optional[str] = None
    oferta_nome: Optional[str] = None
    billing_type: str
    valor: float
    ciclo: str
    proximo_vencimento: Optional[str] = None
    descricao: Optional[str] = None
    status: str
    asaas_subscription_id: Optional[str] = None
    asaas_customer_id: Optional[str] = None
    created_at: Optional[datetime] = None

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

async def build_client_response(c: dict) -> ClientResponse:
    is_complete, _ = check_client_completeness(c)
    client_id = str(c["_id"])
    # Fetch lines for this client
    linhas_cursor = db.linhas.find({"cliente_id": client_id}, {"_id": 0, "numero": 1, "status": 1, "plano_id": 1, "msisdn": 1})
    linhas_raw = await linhas_cursor.to_list(50)
    linhas_data = []
    for l in linhas_raw:
        plano_nome = None
        if l.get("plano_id"):
            try:
                plano = await db.planos.find_one({"_id": ObjectId(l["plano_id"])}, {"nome": 1})
                if plano:
                    plano_nome = plano["nome"]
            except Exception:
                pass
        linhas_data.append({
            "numero": l.get("numero") or l.get("msisdn", ""),
            "status": l.get("status", ""),
            "plano_nome": plano_nome,
        })
    return ClientResponse(
        id=client_id, nome=c["nome"],
        tipo_pessoa=c.get("tipo_pessoa", "pf"),
        documento=c.get("documento", c.get("cpf", "")),
        telefone=c.get("telefone", ""),
        email=c.get("email"),
        data_nascimento=c.get("data_nascimento"),
        cep=c.get("cep"), endereco=c.get("endereco"),
        numero_endereco=c.get("numero_endereco"),
        bairro=c.get("bairro"), cidade=c.get("cidade"),
        estado=c.get("estado"), city_code=c.get("city_code"),
        complemento=c.get("complemento"),
        status=c["status"], dados_completos=is_complete,
        created_at=c.get("created_at", datetime.now(timezone.utc)),
        linhas_count=len(linhas_data),
        linhas=linhas_data,
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
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE, max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE, max_age=604800, path="/")
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
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE, max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE, max_age=604800, path="/")
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
        response.set_cookie(key="access_token", value=access_token, httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE, max_age=3600, path="/")
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
            {"telefone": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]}
    clients = await db.clientes.find(query).sort("nome", 1).to_list(1000)
    # Pre-fetch all lines in bulk for performance
    client_ids = [str(c["_id"]) for c in clients]
    all_lines = await db.linhas.find({"cliente_id": {"$in": client_ids}}, {"_id": 0, "cliente_id": 1, "numero": 1, "status": 1, "plano_id": 1, "msisdn": 1, "chip_id": 1}).to_list(5000)
    # Pre-fetch plan names
    plano_ids = list(set(l["plano_id"] for l in all_lines if l.get("plano_id") and ObjectId.is_valid(l["plano_id"])))
    planos_map = {}
    if plano_ids:
        planos = await db.planos.find({"_id": {"$in": [ObjectId(pid) for pid in plano_ids]}}, {"nome": 1}).to_list(100)
        planos_map = {str(p["_id"]): p["nome"] for p in planos}
    # Pre-fetch chip ICCIDs
    chip_ids = list(set(l["chip_id"] for l in all_lines if l.get("chip_id") and ObjectId.is_valid(l["chip_id"])))
    chips_map = {}
    if chip_ids:
        chips = await db.chips.find({"_id": {"$in": [ObjectId(cid) for cid in chip_ids]}}, {"iccid": 1}).to_list(5000)
        chips_map = {str(ch["_id"]): ch.get("iccid", "") for ch in chips}
    # Group lines by client_id
    lines_by_client = {}
    for l in all_lines:
        cid = l["cliente_id"]
        if cid not in lines_by_client:
            lines_by_client[cid] = []
        lines_by_client[cid].append({
            "numero": l.get("numero") or l.get("msisdn", ""),
            "status": l.get("status", ""),
            "plano_nome": planos_map.get(l.get("plano_id"), None),
            "iccid": chips_map.get(l.get("chip_id"), ""),
        })
    results = []
    for c in clients:
        is_complete, _ = check_client_completeness(c)
        cid = str(c["_id"])
        linhas = lines_by_client.get(cid, [])
        results.append(ClientResponse(
            id=cid, nome=c["nome"],
            tipo_pessoa=c.get("tipo_pessoa", "pf"),
            documento=c.get("documento", c.get("cpf", "")),
            telefone=c.get("telefone", ""),
            email=c.get("email"),
            data_nascimento=c.get("data_nascimento"),
            cep=c.get("cep"), endereco=c.get("endereco"),
            numero_endereco=c.get("numero_endereco"),
            bairro=c.get("bairro"), cidade=c.get("cidade"),
            estado=c.get("estado"), city_code=c.get("city_code"),
            complemento=c.get("complemento"),
            status=c["status"], dados_completos=is_complete,
            created_at=c.get("created_at", datetime.now(timezone.utc)),
            linhas_count=len(linhas),
            linhas=linhas,
        ))
    return results

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
        "email": data.email,
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
    return await build_client_response(client_doc)

@api_router.get("/clientes/{client_id}", response_model=ClientResponse)
async def get_client(client_id: str, request: Request):
    await get_current_user(request)
    c = await db.clientes.find_one({"_id": ObjectId(client_id)})
    if not c:
        raise HTTPException(status_code=404, detail="Cliente nao encontrado")
    return await build_client_response(c)

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
        "email": data.email,
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
    return await build_client_response(updated)

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
        categoria=o.get("categoria", "movel"),
        ativo=o.get("ativo", True),
        created_at=o.get("created_at", datetime.now(timezone.utc))
    )

@api_router.get("/ofertas", response_model=List[OfferResponse])
async def list_offers(request: Request, ativo: Optional[bool] = None, categoria: Optional[str] = None):
    await get_current_user(request)
    query = {}
    if ativo is not None:
        query["ativo"] = ativo
    if categoria:
        query["categoria"] = categoria
    offers = await db.ofertas.find(query).to_list(1000)

    # Batch load planos
    plano_ids = list(set(o["plano_id"] for o in offers if o.get("plano_id")))
    planos_lookup = {}
    if plano_ids:
        planos = await db.planos.find({"_id": {"$in": [ObjectId(pid) for pid in plano_ids]}}).to_list(len(plano_ids))
        planos_lookup = {str(p["_id"]): p for p in planos}

    result = []
    for o in offers:
        plano = planos_lookup.get(o.get("plano_id"))
        result.append(OfferResponse(
            id=str(o["_id"]), nome=o["nome"], plano_id=o["plano_id"],
            plano_nome=plano["nome"] if plano else None,
            franquia=plano["franquia"] if plano else None,
            plan_code=plano.get("plan_code") if plano else None,
            valor=o["valor"], descricao=o.get("descricao"),
            categoria=o.get("categoria", "movel"),
            ativo=o.get("ativo", True),
            created_at=o.get("created_at", datetime.now(timezone.utc))
        ))
    return result

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
        "categoria": data.categoria.value,
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
        "valor": data.valor, "descricao": data.descricao,
        "categoria": data.categoria.value, "ativo": data.ativo,
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
    cliente_nome, oferta_nome, plano_nome, franquia, valor, plan_code, categoria = None, None, None, None, None, None, None
    if chip.get("cliente_id"):
        cl = await db.clientes.find_one({"_id": ObjectId(chip["cliente_id"])})
        if cl:
            cliente_nome = cl["nome"]
    if chip.get("oferta_id"):
        oferta = await db.ofertas.find_one({"_id": ObjectId(chip["oferta_id"])})
        if oferta:
            oferta_nome = oferta["nome"]
            valor = oferta["valor"]
            categoria = oferta.get("categoria", "movel")
            if oferta.get("plano_id"):
                plano = await db.planos.find_one({"_id": ObjectId(oferta["plano_id"])})
                if plano:
                    plano_nome = plano["nome"]
                    franquia = plano["franquia"]
                    plan_code = plano.get("plan_code")
    return ChipResponse(
        id=str(chip["_id"]), iccid=chip["iccid"], status=chip["status"],
        msisdn=chip.get("msisdn"), oferta_id=chip.get("oferta_id"),
        oferta_nome=oferta_nome, categoria=categoria,
        plano_nome=plano_nome, franquia=franquia,
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

    # Batch load related data
    cliente_ids = list(set(c["cliente_id"] for c in chips if c.get("cliente_id")))
    oferta_ids = list(set(c["oferta_id"] for c in chips if c.get("oferta_id")))

    clientes_lookup = {}
    if cliente_ids:
        clientes = await db.clientes.find({"_id": {"$in": [ObjectId(cid) for cid in cliente_ids]}}).to_list(len(cliente_ids))
        clientes_lookup = {str(cl["_id"]): cl for cl in clientes}

    ofertas_lookup = {}
    planos_lookup = {}
    if oferta_ids:
        ofertas = await db.ofertas.find({"_id": {"$in": [ObjectId(oid) for oid in oferta_ids]}}).to_list(len(oferta_ids))
        ofertas_lookup = {str(o["_id"]): o for o in ofertas}
        plano_ids = list(set(o["plano_id"] for o in ofertas if o.get("plano_id")))
        if plano_ids:
            planos = await db.planos.find({"_id": {"$in": [ObjectId(pid) for pid in plano_ids]}}).to_list(len(plano_ids))
            planos_lookup = {str(p["_id"]): p for p in planos}

    result = []
    for chip in chips:
        cliente_nome = None
        oferta_nome, plano_nome, franquia, valor, plan_code, categoria = None, None, None, None, None, None

        cl = clientes_lookup.get(chip.get("cliente_id"))
        if cl:
            cliente_nome = cl["nome"]

        oferta = ofertas_lookup.get(chip.get("oferta_id"))
        if oferta:
            oferta_nome = oferta["nome"]
            valor = oferta["valor"]
            categoria = oferta.get("categoria", "movel")
            plano = planos_lookup.get(oferta.get("plano_id"))
            if plano:
                plano_nome = plano["nome"]
                franquia = plano["franquia"]
                plan_code = plano.get("plan_code")

        result.append(ChipResponse(
            id=str(chip["_id"]), iccid=chip["iccid"], status=chip["status"],
            msisdn=chip.get("msisdn"), oferta_id=chip.get("oferta_id"),
            oferta_nome=oferta_nome, categoria=categoria,
            plano_nome=plano_nome, franquia=franquia,
            plan_code=plan_code, valor=valor,
            cliente_id=chip.get("cliente_id"), cliente_nome=cliente_nome,
            created_at=chip.get("created_at", datetime.now(timezone.utc))
        ))
    return result

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

@api_router.put("/chips/{chip_id}", response_model=ChipResponse)
async def update_chip(chip_id: str, data: ChipUpdate, request: Request):
    user = await require_admin(request)
    chip = await db.chips.find_one({"_id": ObjectId(chip_id)})
    if not chip:
        raise HTTPException(status_code=404, detail="Chip nao encontrado")
    if chip["status"] == ChipStatus.ativado.value:
        raise HTTPException(status_code=400, detail="Nao e possivel alterar oferta de um chip ativado")
    if chip["status"] not in [ChipStatus.disponivel.value, ChipStatus.reservado.value]:
        raise HTTPException(status_code=400, detail=f"Chip com status '{chip['status']}' nao pode ter a oferta alterada")
    oferta = await db.ofertas.find_one({"_id": ObjectId(data.oferta_id)})
    if not oferta:
        raise HTTPException(status_code=400, detail="Oferta nao encontrada")
    if not oferta.get("ativo", True):
        raise HTTPException(status_code=400, detail="Oferta nao esta ativa")
    await db.chips.update_one({"_id": ObjectId(chip_id)}, {"$set": {"oferta_id": data.oferta_id}})
    await create_log("cadastro", f"Oferta do chip {chip['iccid']} alterada para: {oferta['nome']}", user["id"], user["name"])
    updated = await db.chips.find_one({"_id": ObjectId(chip_id)})
    return await build_chip_response(updated)

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
    # Ta Telecom espera 'F' (Fisica) ou 'J' (Juridica)
    person_type_map = {"pf": "F", "pj": "J", "F": "F", "J": "J"}
    person_type = person_type_map.get(tipo_pessoa, "F")

    telefone_clean = re.sub(r'\D', '', cliente.get("telefone", ""))
    ddd = data.ddd if data.ddd and len(data.ddd) == 2 else (telefone_clean[:2] if len(telefone_clean) >= 2 else "11")

    # Converter data_nascimento para dd/mm/YYYY
    raw_dob = cliente.get("data_nascimento", "")
    dob_formatted = ""
    if raw_dob:
        try:
            # Tenta YYYY-MM-DD (ISO)
            if "-" in raw_dob and len(raw_dob) >= 10:
                parts = raw_dob[:10].split("-")
                if len(parts) == 3 and len(parts[0]) == 4:
                    dob_formatted = f"{parts[2]}/{parts[1]}/{parts[0]}"
                else:
                    dob_formatted = raw_dob
            elif "/" in raw_dob:
                dob_formatted = raw_dob  # Ja esta em dd/mm/YYYY
            else:
                dob_formatted = raw_dob
        except Exception:
            dob_formatted = raw_dob

    activation_payload = {
        "person_type": person_type,
        "person_name": cliente["nome"],
        "document_number": clean_document(cliente.get("documento", "")),
        "phone_number": telefone_clean,
        "date_of_birth": dob_formatted,
        "type_of_street": "",
        "address": cliente.get("endereco", ""),
        "address_number": cliente.get("numero_endereco", ""),
        "neighborhood": cliente.get("bairro", ""),
        "state": cliente.get("estado", ""),
        "city_code": cliente.get("city_code", ""),
        "postcode": re.sub(r'\D', '', cliente.get("cep", "")),
        "plan_code": plano["plan_code"],
        "portability": data.portability,
        "cn_contract_line": data.port_ddd if data.portability and data.port_ddd else ddd,
        "contract_line": data.port_number if data.portability and data.port_number else "",
    }

    # Call operadora service
    result = await operadora_service.ativar_chip(
        iccid=chip["iccid"],
        activation_payload=activation_payload,
        db=db, user_id=user["id"], user_name=user["name"]
    )

    # Normalizar status e message para strings
    if isinstance(result.status, str):
        status_str = result.status
    elif hasattr(result.status, 'value'):
        status_str = result.status.value
    else:
        status_str = str(result.status)
    # Mapear "ok" para "ativo" (Ta Telecom retorna "ok" quando sucesso)
    # Para portabilidade, manter como pendente ate conclusao
    if result.success and status_str == "ok":
        if data.portability:
            status_str = "portabilidade_em_andamento"
        else:
            status_str = "ativo"

    msg = result.message
    if isinstance(msg, list):
        msg = "; ".join(str(m) for m in msg)
    msg = str(msg) if msg else "Resultado da ativacao"

    if result.success:
        if status_str in ("ativo",):
            chip_status = ChipStatus.ativado.value
        else:
            chip_status = ChipStatus.reservado.value
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
            "portability": data.portability,
            "port_number": f"{data.port_ddd}{data.port_number}" if data.portability and data.port_ddd and data.port_number else None,
            "created_at": datetime.now(timezone.utc)
        }
        await db.linhas.insert_one(line_doc)

    try:
        return ActivationResponse(
            success=result.success,
            status=status_str,
            message=msg,
            numero=result.numero or (result.data.get("msisdn") if result.data else None),
            oferta_nome=str(oferta["nome"]),
            plano_nome=str(plano["nome"]),
            franquia=str(plano["franquia"]),
            valor=float(oferta["valor"]),
            response_time_ms=int(result.response_time_ms or 0),
        )
    except Exception as e:
        logger.error(f"Erro ao construir ActivationResponse: {e}")
        return ActivationResponse(
            success=result.success,
            status=status_str,
            message=msg,
            numero=None,
            oferta_nome=str(oferta.get("nome", "")),
            plano_nome=str(plano.get("nome", "")),
            franquia=str(plano.get("franquia", "")),
            valor=float(oferta.get("valor", 0)),
            response_time_ms=0,
        )


# ==================== PORTABILITY STATUS ====================
@api_router.get("/portabilidade/status/{numero_ou_iccid}")
async def get_portability_status(numero_ou_iccid: str, request: Request):
    user = await get_current_user(request)
    result = await operadora_service.consultar_status_portabilidade(
        numero_ou_iccid, db=db, user_id=user["id"], user_name=user["name"]
    )
    return {
        "success": result.success,
        "status": result.data.get("status") if result.data else None,
        "message": result.data.get("msg_usuario") if result.data else result.message,
        "janela": result.data.get("janela") if result.data else None,
        "chip_status": result.data.get("chip_status") if result.data else None,
    }

@api_router.post("/chips/{iccid}/verificar-portabilidade")
async def verificar_portabilidade_chip(iccid: str, request: Request):
    """Consulta status da portabilidade na Ta Telecom e atualiza chip/linha no banco."""
    user = await require_admin(request)
    iccid_clean = re.sub(r'\D', '', iccid)

    chip = await db.chips.find_one({"iccid": iccid_clean})
    if not chip:
        raise HTTPException(status_code=404, detail="Chip nao encontrado")

    # Consultar Ta Telecom
    result = await operadora_service.consultar_status_portabilidade(
        iccid_clean, db=db, user_id=user["id"], user_name=user["name"]
    )

    port_status = ""
    port_data = {}
    if result.success and result.data:
        port_data = result.data
        port_status = (port_data.get("status") or "").upper()

    # Tambem consultar a linha na operadora para pegar msisdn atualizado
    line_result = await operadora_service.consultar_linha(
        iccid_clean, db=db, user_id=user["id"], user_name=user["name"]
    )
    line_data = line_result.data or {} if line_result.success else {}
    operadora_msisdn = line_data.get("msisdn") or line_data.get("subscriber_number")
    operadora_status_raw = line_data.get("status")
    # status 3 = ativado/em uso na Ta Telecom
    operadora_ativo = operadora_status_raw == 3 or str(operadora_status_raw) == "3" or "EM USO" in port_status or "CONCLUIDA" in port_status or "CONCLUÍDA" in port_status

    updates_chip = {}
    updates_linha = {}
    new_chip_status = chip.get("status")

    if operadora_ativo:
        new_chip_status = ChipStatus.ativado.value
        updates_chip["status"] = new_chip_status
        if operadora_msisdn:
            updates_chip["msisdn"] = str(operadora_msisdn)
            updates_linha["msisdn"] = str(operadora_msisdn)
            updates_linha["numero"] = str(operadora_msisdn)
        updates_linha["status"] = "ativo"
    elif "AGUARDANDO" in port_status or "PENDENTE" in port_status:
        new_chip_status = ChipStatus.reservado.value
        updates_chip["status"] = new_chip_status

    if updates_chip:
        await db.chips.update_one({"_id": chip["_id"]}, {"$set": updates_chip})
    if updates_linha:
        await db.linhas.update_one({"chip_id": str(chip["_id"])}, {"$set": updates_linha})

    # Atualizar ativacao selfservice se existir
    ss = await db.ativacoes_selfservice.find_one({"iccid": iccid_clean})
    if ss and ss.get("status") in ("ativando", "portabilidade_em_andamento") and operadora_ativo:
        msisdn = operadora_msisdn or ss.get("port_number") or ss.get("msisdn")
        await db.ativacoes_selfservice.update_one({"_id": ss["_id"]}, {"$set": {"status": "ativo", "msisdn": msisdn}})

    await create_log("portabilidade", f"Verificacao portabilidade ICCID {iccid_clean}: {port_status or 'sem info'} | Chip: {new_chip_status}", user["id"], user["name"])

    return {
        "iccid": iccid_clean,
        "chip_status_anterior": chip.get("status"),
        "chip_status_novo": new_chip_status,
        "portabilidade_status": port_data.get("status", ""),
        "portabilidade_janela": port_data.get("janela", ""),
        "portabilidade_msg": port_data.get("msg_usuario", ""),
        "operadora_msisdn": operadora_msisdn,
        "operadora_status": operadora_status_raw,
        "atualizado": bool(updates_chip or updates_linha),
    }

@api_router.post("/chips/{iccid}/resetar")
async def resetar_chip(iccid: str, request: Request):
    """Reseta um chip de 'reservado' para 'disponivel', removendo vinculo com cliente e linha."""
    user = await require_admin(request)
    iccid_clean = re.sub(r'\D', '', iccid)
    chip = await db.chips.find_one({"iccid": iccid_clean})
    if not chip:
        raise HTTPException(status_code=404, detail="Chip nao encontrado")
    if chip.get("status") == ChipStatus.ativado.value:
        raise HTTPException(status_code=400, detail="Chip ativado nao pode ser resetado. Use bloqueio/desbloqueio.")
    old_status = chip.get("status", "?")
    await db.chips.update_one({"_id": chip["_id"]}, {"$set": {
        "status": ChipStatus.disponivel.value,
        "cliente_id": None, "msisdn": None,
    }})
    # Remover linha vinculada
    await db.linhas.delete_many({"chip_id": str(chip["_id"])})
    # Cancelar ativacao selfservice pendente
    await db.ativacoes_selfservice.update_many(
        {"iccid": iccid_clean, "status": {"$in": ["ativando", "portabilidade_em_andamento", "pago"]}},
        {"$set": {"status": "cancelado"}}
    )
    await create_log("cadastro", f"Chip {iccid_clean} resetado: {old_status} -> disponivel", user["id"], user["name"])
    return {"message": f"Chip resetado com sucesso ({old_status} -> disponivel)", "iccid": iccid_clean}

# ==================== LINES ROUTES ====================
async def build_line_response(line: dict) -> LineResponse:
    cliente_nome, cliente_documento, plano_nome, oferta_nome, franquia, plan_code, iccid, msisdn = None, None, None, None, None, None, None, None
    if line.get("cliente_id"):
        try:
            cl = await db.clientes.find_one({"_id": ObjectId(line["cliente_id"])})
            if cl:
                cliente_nome = cl.get("nome")
                cliente_documento = cl.get("documento")
        except Exception:
            pass
    if line.get("plano_id") and ObjectId.is_valid(line["plano_id"]):
        plano = await db.planos.find_one({"_id": ObjectId(line["plano_id"])})
        if plano:
            plano_nome = plano.get("nome")
            franquia = plano.get("franquia")
            plan_code = plano.get("plan_code")
    if line.get("oferta_id") and ObjectId.is_valid(line["oferta_id"]):
        oferta = await db.ofertas.find_one({"_id": ObjectId(line["oferta_id"])})
        if oferta:
            oferta_nome = oferta.get("nome")
    if line.get("chip_id") and ObjectId.is_valid(line["chip_id"]):
        chip = await db.chips.find_one({"_id": ObjectId(line["chip_id"])})
        if chip:
            iccid = chip.get("iccid")
            msisdn = chip.get("msisdn")
    return LineResponse(
        id=str(line["_id"]), numero=line.get("numero", ""), status=line.get("status", "desconhecido"),
        cliente_id=line.get("cliente_id", ""), chip_id=line.get("chip_id", ""),
        plano_id=line.get("plano_id"), oferta_id=line.get("oferta_id"),
        cliente_nome=cliente_nome, cliente_documento=cliente_documento,
        plano_nome=plano_nome, oferta_nome=oferta_nome, franquia=franquia, plan_code=plan_code,
        iccid=iccid, msisdn=msisdn or line.get("msisdn"),
        created_at=line.get("created_at")
    )

@api_router.get("/linhas", response_model=List[LineResponse])
async def list_lines(request: Request, status: Optional[str] = None):
    await get_current_user(request)
    query = {}
    if status:
        query["status"] = status
    lines = await db.linhas.find(query).to_list(1000)

    # Batch load related data
    cliente_ids = list(set(l["cliente_id"] for l in lines if l.get("cliente_id")))
    plano_ids = list(set(l["plano_id"] for l in lines if l.get("plano_id")))
    oferta_ids = list(set(l["oferta_id"] for l in lines if l.get("oferta_id")))
    chip_ids = list(set(l["chip_id"] for l in lines if l.get("chip_id")))

    clientes_lookup, planos_lookup, ofertas_lookup, chips_lookup = {}, {}, {}, {}
    if cliente_ids:
        docs = await db.clientes.find({"_id": {"$in": [ObjectId(i) for i in cliente_ids]}}).to_list(len(cliente_ids))
        clientes_lookup = {str(d["_id"]): d for d in docs}
    if plano_ids:
        docs = await db.planos.find({"_id": {"$in": [ObjectId(i) for i in plano_ids]}}).to_list(len(plano_ids))
        planos_lookup = {str(d["_id"]): d for d in docs}
    if oferta_ids:
        docs = await db.ofertas.find({"_id": {"$in": [ObjectId(i) for i in oferta_ids]}}).to_list(len(oferta_ids))
        ofertas_lookup = {str(d["_id"]): d for d in docs}
    if chip_ids:
        docs = await db.chips.find({"_id": {"$in": [ObjectId(i) for i in chip_ids]}}).to_list(len(chip_ids))
        chips_lookup = {str(d["_id"]): d for d in docs}

    result = []
    for line in lines:
        cl = clientes_lookup.get(line.get("cliente_id"))
        plano = planos_lookup.get(line.get("plano_id"))
        oferta = ofertas_lookup.get(line.get("oferta_id"))
        chip = chips_lookup.get(line.get("chip_id"))

        result.append(LineResponse(
            id=str(line["_id"]), numero=line.get("numero", ""), status=line.get("status", "desconhecido"),
            cliente_id=line.get("cliente_id", ""), chip_id=line.get("chip_id", ""),
            plano_id=line.get("plano_id"), oferta_id=line.get("oferta_id"),
            cliente_nome=cl.get("nome") if cl else None,
            cliente_documento=cl.get("documento") if cl else None,
            plano_nome=plano.get("nome") if plano else None,
            oferta_nome=oferta.get("nome") if oferta else None,
            franquia=plano.get("franquia") if plano else None,
            plan_code=plano.get("plan_code") if plano else None,
            iccid=chip.get("iccid") if chip else None,
            msisdn=(chip.get("msisdn") if chip else None) or line.get("msisdn"),
            created_at=line.get("created_at")
        ))
    return result

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
    result = await operadora_service.listar_estoque_completo(db=db, user_id=user["id"], user_name=user["name"])
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

@api_router.post("/operadora/sincronizar-clientes")
async def sync_clients_from_operator(request: Request):
    user = await require_admin(request)
    # 1. Get stock from Tá Telecom (all statuses)
    result = await operadora_service.listar_estoque_completo(db=db, user_id=user["id"], user_name=user["name"])
    if not result.success:
        raise HTTPException(status_code=502, detail=f"Erro ao buscar estoque: {result.message}")
    items = result.data.get("results", result.data.get("items", []))
    if isinstance(items, dict):
        items = items.get("results", items.get("items", []))
    # Filter only active chips (EM USO / ATIVADO / ATIVO)
    # Include EM USO (active) and BLOQUEADO (blocked) - both have contracts
    sync_statuses = {"EM USO", "ATIVADO", "ATIVA", "ATIVO", "BLOQUEADO", "BLOQUEADA", "SUSPENSO", "SUSPENSA"}
    contract_chips = [
        item for item in items
        if isinstance(item.get("status"), str) and item["status"].upper().strip() in sync_statuses
    ]
    clients_created = 0
    clients_updated = 0
    lines_created = 0
    chips_linked = 0
    errors = []
    for idx, item in enumerate(contract_chips):
        stock_status = (item.get("status") or "").upper().strip()
        iccid = item.get("sim_card") or item.get("iccid")
        if not iccid:
            continue
        iccid = str(iccid)
        # Rate limit: delay between chips
        if idx > 0:
            await asyncio.sleep(0.3)
        # 2. Query subscriber details from Tá Telecom (with retry for rate limit)
        d = None
        for attempt in range(3):
            try:
                detail_req, detail_resp = await operadora_service.adapter.consultar_linha(iccid)
                if detail_resp.success and detail_resp.data:
                    d = detail_resp.data
                    break
            except Exception as e:
                if attempt == 2:
                    errors.append(f"Erro ao consultar {iccid}: {str(e)}")
            # Exponential backoff between retries
            await asyncio.sleep(1.0 * (attempt + 1))
        if not d:
            errors.append(f"Sem dados para ICCID {iccid}")
            continue
        cpf = d.get("cpf") or d.get("document_number") or ""
        nome = d.get("nome") or d.get("subscriber_name") or ""
        if not cpf or not nome:
            continue
        cpf_clean = re.sub(r'\D', '', cpf)
        telefone = d.get("numero") or d.get("msisdn") or ""
        telefone_clean = re.sub(r'\D', '', str(telefone))
        cidade = d.get("cidade") or ""
        data_ativacao = d.get("data_ativacao") or ""
        plano_nome = d.get("plano") or ""
        numero_contrato = d.get("numero_contrato") or ""
        status_ta = (d.get("status") or "").lower().strip()
        msisdn = str(d.get("numero") or "")
        # Determine local status based on both stock status and individual status
        blocked_statuses = {"bloqueado", "bloqueada", "suspenso", "suspensa"}
        if stock_status in ("BLOQUEADO", "BLOQUEADA", "SUSPENSO", "SUSPENSA") or status_ta in blocked_statuses:
            local_status = "bloqueado"
        else:
            local_status = "ativo"
        # 3. Create or update client by CPF
        existing_client = await db.clientes.find_one({"documento": cpf_clean})
        if existing_client:
            update_fields = {}
            if not existing_client.get("telefone") and telefone_clean:
                update_fields["telefone"] = telefone_clean
            if not existing_client.get("cidade") and cidade:
                update_fields["cidade"] = cidade
            # Sempre atualizar o status do cliente conforme a operadora
            if existing_client.get("status") != local_status:
                update_fields["status"] = local_status
            if update_fields:
                await db.clientes.update_one({"_id": existing_client["_id"]}, {"$set": update_fields})
            client_id = str(existing_client["_id"])
            clients_updated += 1
        else:
            client_doc = {
                "nome": nome.title(),
                "tipo_pessoa": "pf",
                "documento": cpf_clean,
                "telefone": telefone_clean,
                "data_nascimento": None,
                "cep": None,
                "endereco": None,
                "numero_endereco": None,
                "bairro": None,
                "cidade": cidade.title() if cidade else None,
                "estado": None,
                "city_code": None,
                "complemento": None,
                "status": local_status,
                "created_at": datetime.now(timezone.utc),
            }
            insert_result = await db.clientes.insert_one(client_doc)
            client_id = str(insert_result.inserted_id)
            clients_created += 1
        # 4. Update chip in local DB
        local_chip = await db.chips.find_one({"iccid": iccid})
        chip_status = "ativado" if local_status == "ativo" else "bloqueado"
        if local_chip:
            chip_update = {"status": chip_status, "cliente_id": client_id}
            if msisdn:
                chip_update["msisdn"] = msisdn
            await db.chips.update_one({"_id": local_chip["_id"]}, {"$set": chip_update})
            chip_id = str(local_chip["_id"])
            chips_linked += 1
        else:
            chip_doc = {
                "iccid": iccid, "status": chip_status,
                "oferta_id": None, "cliente_id": client_id,
                "msisdn": msisdn or None,
                "created_at": datetime.now(timezone.utc),
            }
            insert_result = await db.chips.insert_one(chip_doc)
            chip_id = str(insert_result.inserted_id)
            chips_linked += 1
        # 5. Create or update line
        existing_line = await db.linhas.find_one({"chip_id": chip_id})
        if existing_line:
            # Update status if changed
            if existing_line.get("status") != local_status:
                await db.linhas.update_one({"_id": existing_line["_id"]}, {"$set": {"status": local_status}})
        elif msisdn:
            # Try to find matching plan
            plano_id = None
            if plano_nome:
                plano = await db.planos.find_one({"nome": {"$regex": re.escape(plano_nome), "$options": "i"}})
                if plano:
                    plano_id = str(plano["_id"])
            line_doc = {
                "numero": msisdn,
                "status": local_status,
                "cliente_id": client_id,
                "chip_id": chip_id,
                "plano_id": plano_id,
                "oferta_id": local_chip.get("oferta_id") if local_chip else None,
                "msisdn": msisdn,
                "created_at": datetime.now(timezone.utc),
            }
            await db.linhas.insert_one(line_doc)
            lines_created += 1
    msg = f"Clientes: {clients_created} criados, {clients_updated} atualizados. Linhas: {lines_created} criadas. Chips vinculados: {chips_linked}."
    if errors:
        msg += f" Erros: {len(errors)}"
    await create_log("sincronizacao", f"Sincronizacao de clientes: {msg}", user["id"], user["name"])
    return {
        "success": True, "message": msg,
        "clients_created": clients_created, "clients_updated": clients_updated,
        "lines_created": lines_created, "chips_linked": chips_linked,
        "total_with_contract": len(contract_chips), "errors": errors[:10],
    }

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

# ==================== CARTEIRA MOVEL ROUTES ====================

async def _get_asaas_customer_id(cliente: dict, user: dict) -> str:
    """Obtem ou cria o customer_id do Asaas para o cliente."""
    cached_id = cliente.get("asaas_customer_id")
    if cached_id:
        # Verify it exists in current environment
        try:
            existing = await asaas_service._request("GET", f"/customers/{cached_id}")
            # Garante que notificacoes estao desabilitadas
            if not existing.get("notificationDisabled"):
                try:
                    await asaas_service.disable_customer_notifications(cached_id)
                except Exception:
                    pass
            return cached_id
        except Exception:
            logger.info(f"Customer {cached_id} nao encontrado no ambiente atual. Recriando.")
            await db.clientes.update_one({"_id": cliente["_id"]}, {"$unset": {"asaas_customer_id": ""}})

    result = await asaas_service.get_or_create_customer(
        name=cliente["nome"],
        cpf_cnpj=cliente.get("documento", ""),
        email=cliente.get("email"),
        phone=cliente.get("telefone"),
        address=cliente.get("endereco"),
        address_number=cliente.get("numero_endereco"),
        province=cliente.get("bairro"),
        postal_code=cliente.get("cep"),
    )
    asaas_id = result.get("id")
    await db.clientes.update_one({"_id": cliente["_id"]}, {"$set": {"asaas_customer_id": asaas_id}})
    await create_log("financeiro", f"Cliente sincronizado com Asaas: {cliente['nome']} -> {asaas_id}", user["id"], user["name"])
    return asaas_id

async def _build_cobranca_response(doc: dict) -> CobrancaResponse:
    cliente_nome, msisdn, oferta_nome = None, None, None
    if doc.get("cliente_id"):
        cl = await db.clientes.find_one({"_id": ObjectId(doc["cliente_id"])})
        if cl:
            cliente_nome = cl["nome"]
    if doc.get("linha_id"):
        ln = await db.linhas.find_one({"_id": ObjectId(doc["linha_id"])})
        if ln:
            msisdn = ln.get("msisdn")
            if ln.get("oferta_id"):
                of = await db.ofertas.find_one({"_id": ObjectId(ln["oferta_id"])})
                if of:
                    oferta_nome = of["nome"]
    return CobrancaResponse(
        id=str(doc["_id"]), cliente_id=doc["cliente_id"],
        cliente_nome=cliente_nome, linha_id=doc.get("linha_id"),
        msisdn=msisdn, oferta_nome=oferta_nome,
        billing_type=doc["billing_type"], valor=doc["valor"],
        vencimento=doc["vencimento"], descricao=doc.get("descricao"),
        status=doc.get("status", "PENDING"),
        asaas_payment_id=doc.get("asaas_payment_id"),
        asaas_invoice_url=doc.get("asaas_invoice_url"),
        asaas_bankslip_url=doc.get("asaas_bankslip_url"),
        asaas_pix_code=doc.get("asaas_pix_code"),
        asaas_pix_qrcode=doc.get("asaas_pix_qrcode"),
        barcode=doc.get("barcode"),
        paid_at=doc.get("paid_at"),
        created_at=doc.get("created_at", datetime.now(timezone.utc)),
    )

async def _build_assinatura_response(doc: dict) -> AssinaturaResponse:
    cliente_nome, msisdn, oferta_nome = None, None, None
    if doc.get("cliente_id"):
        cl = await db.clientes.find_one({"_id": ObjectId(doc["cliente_id"])})
        if cl:
            cliente_nome = cl["nome"]
    if doc.get("linha_id"):
        ln = await db.linhas.find_one({"_id": ObjectId(doc["linha_id"])})
        if ln:
            msisdn = ln.get("msisdn")
            if ln.get("oferta_id"):
                of = await db.ofertas.find_one({"_id": ObjectId(ln["oferta_id"])})
                if of:
                    oferta_nome = of["nome"]
    return AssinaturaResponse(
        id=str(doc["_id"]), cliente_id=doc["cliente_id"],
        cliente_nome=cliente_nome, linha_id=doc.get("linha_id"),
        msisdn=msisdn, oferta_nome=oferta_nome,
        billing_type=doc["billing_type"], valor=doc["valor"],
        ciclo=doc.get("ciclo", "MONTHLY"),
        proximo_vencimento=doc.get("proximo_vencimento"),
        descricao=doc.get("descricao"),
        status=doc.get("status", "ACTIVE"),
        asaas_subscription_id=doc.get("asaas_subscription_id"),
        asaas_customer_id=doc.get("asaas_customer_id"),
        created_at=doc.get("created_at", datetime.now(timezone.utc)),
    )

@api_router.get("/carteira/config")
async def get_carteira_config(request: Request):
    await get_current_user(request)
    config = asaas_service.get_config_status()
    key = asaas_service.api_key
    config["key_prefix"] = key[:15] + "..." if len(key) > 15 else "(vazia)"
    config["key_length"] = len(key)
    config["key_starts_with_dollar"] = key.startswith("$")
    return config

class AsaasKeyUpdate(BaseModel):
    api_key: str
    environment: str = "sandbox"

@api_router.post("/carteira/config")
async def update_asaas_config(data: AsaasKeyUpdate, request: Request):
    """Atualiza a chave do Asaas no .env e recarrega o servico."""
    await require_admin(request)
    new_key = data.api_key.strip()
    new_env = data.environment.strip()
    if not new_key or len(new_key) < 20:
        raise HTTPException(status_code=400, detail="Chave API invalida. Deve ter pelo menos 20 caracteres.")
    if new_env == "production" and not (new_key.startswith("$aact_prod_") or new_key.startswith("aact_prod_")):
        raise HTTPException(status_code=400, detail="Chave de producao deve comecar com $aact_prod_")

    # Sanitize key - ensure $ prefix
    if not new_key.startswith("$") and (new_key.startswith("aact_") or new_key.startswith("aach_")):
        new_key = "$" + new_key

    # Update .env file
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    lines = []
    key_found = False
    env_found = False
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                if line.startswith("ASAAS_API_KEY"):
                    lines.append(f"ASAAS_API_KEY='{new_key}'\n")
                    key_found = True
                elif line.startswith("ASAAS_ENVIRONMENT"):
                    lines.append(f"ASAAS_ENVIRONMENT={new_env}\n")
                    env_found = True
                else:
                    lines.append(line)
    if not key_found:
        lines.append(f"ASAAS_API_KEY='{new_key}'\n")
    if not env_found:
        lines.append(f"ASAAS_ENVIRONMENT={new_env}\n")

    with open(env_path, "w") as f:
        f.writelines(lines)

    # Reload service in memory
    asaas_service.api_key = new_key
    asaas_service.environment = new_env
    asaas_service.base_url = "https://www.asaas.com/api/v3" if new_env == "production" else "https://sandbox.asaas.com/api/v3"

    # Persist to MongoDB (survives restarts/redeploys)
    await asaas_service.save_config_to_db(db)

    # Test connection
    try:
        await asaas_service._request("GET", "/customers?limit=1")
        return {"success": True, "message": "Chave atualizada e conexao verificada com sucesso!", "configured": True, "environment": new_env}
    except Exception as e:
        return {"success": False, "message": f"Chave salva mas erro ao testar: {str(e)}", "configured": True, "environment": new_env}

@api_router.post("/carteira/diagnostico")
async def diagnostico_asaas(request: Request):
    """Diagnostico completo da integracao Asaas. Testa a chave real."""
    await require_admin(request)
    key = asaas_service.api_key
    result = {
        "key_length": len(key),
        "key_valid_format": asaas_service._is_valid_key(key),
        "key_prefix": key[:20] + "..." if len(key) > 20 else "(curta)",
        "key_has_dollar": key.startswith("$") if key else False,
        "environment": asaas_service.environment,
        "base_url": asaas_service.base_url,
        "is_production": asaas_service.is_production(),
    }
    # Testar chamada real a API
    try:
        test = await asaas_service._request("GET", "/customers?limit=1")
        result["api_test"] = "OK"
        result["api_response_keys"] = list(test.keys()) if isinstance(test, dict) else str(type(test))
    except Exception as e:
        result["api_test"] = "ERRO"
        result["api_error"] = str(e)
    # Verificar MongoDB
    try:
        db_config = await db.system_config.find_one({"key": "asaas_config"}, {"_id": 0})
        if db_config:
            db_key = db_config.get("api_key", "")
            result["db_key_length"] = len(db_key)
            result["db_key_valid"] = asaas_service._is_valid_key(asaas_service._normalize_key(db_key))
            result["db_env"] = db_config.get("environment", "?")
            result["db_keys_match"] = (asaas_service._normalize_key(db_key) == key)
        else:
            result["db_config"] = "NAO ENCONTRADA"
    except Exception as e:
        result["db_error"] = str(e)
    return result

@api_router.get("/carteira/resumo")
async def get_carteira_resumo(request: Request):
    await get_current_user(request)
    total_cobrancas = await db.cobrancas.count_documents({})
    cobrancas_pendentes = await db.cobrancas.count_documents({"status": "PENDING"})
    cobrancas_pagas = await db.cobrancas.count_documents({"status": {"$in": ["CONFIRMED", "RECEIVED"]}})
    cobrancas_vencidas = await db.cobrancas.count_documents({"status": "OVERDUE"})
    total_assinaturas = await db.assinaturas.count_documents({})
    assinaturas_ativas = await db.assinaturas.count_documents({"status": "ACTIVE"})

    pipeline_receita = [
        {"$match": {"status": {"$in": ["CONFIRMED", "RECEIVED"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$valor"}}}
    ]
    receita = await db.cobrancas.aggregate(pipeline_receita).to_list(1)
    receita_total = receita[0]["total"] if receita else 0

    pipeline_pendente = [
        {"$match": {"status": "PENDING"}},
        {"$group": {"_id": None, "total": {"$sum": "$valor"}}}
    ]
    pendente = await db.cobrancas.aggregate(pipeline_pendente).to_list(1)
    pendente_total = pendente[0]["total"] if pendente else 0

    pipeline_vencido = [
        {"$match": {"status": "OVERDUE"}},
        {"$group": {"_id": None, "total": {"$sum": "$valor"}}}
    ]
    vencido = await db.cobrancas.aggregate(pipeline_vencido).to_list(1)
    vencido_total = vencido[0]["total"] if vencido else 0

    return {
        "cobrancas": {
            "total": total_cobrancas,
            "pendentes": cobrancas_pendentes,
            "pagas": cobrancas_pagas,
            "vencidas": cobrancas_vencidas,
        },
        "assinaturas": {
            "total": total_assinaturas,
            "ativas": assinaturas_ativas,
        },
        "financeiro": {
            "receita_total": receita_total,
            "pendente_total": pendente_total,
            "vencido_total": vencido_total,
        },
        "asaas": asaas_service.get_config_status(),
    }

# --- Cobrancas ---
@api_router.get("/carteira/cobrancas", response_model=List[CobrancaResponse])
async def list_cobrancas(request: Request, cliente_id: Optional[str] = None,
                         status: Optional[str] = None, limit: int = 100):
    await get_current_user(request)
    query = {}
    if cliente_id:
        query["cliente_id"] = cliente_id
    if status:
        query["status"] = status
    docs = await db.cobrancas.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    return [await _build_cobranca_response(d) for d in docs]

@api_router.post("/carteira/cobrancas", response_model=CobrancaResponse)
async def create_cobranca(data: CobrancaCreate, request: Request):
    user = await require_admin(request)
    cliente = await db.clientes.find_one({"_id": ObjectId(data.cliente_id)})
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente nao encontrado")

    doc = {
        "cliente_id": data.cliente_id,
        "linha_id": data.linha_id,
        "billing_type": data.billing_type.value,
        "valor": data.valor,
        "vencimento": data.vencimento,
        "descricao": data.descricao,
        "status": "PENDING",
        "asaas_payment_id": None,
        "asaas_invoice_url": None,
        "asaas_pix_code": None,
        "paid_at": None,
        "created_at": datetime.now(timezone.utc),
    }

    if asaas_service.is_configured:
        try:
            asaas_customer_id = await _get_asaas_customer_id(cliente, user)
            ref = f"cob-{data.cliente_id}"
            if data.linha_id:
                ref += f"-{data.linha_id}"
            result = await asaas_service.create_payment(
                customer_id=asaas_customer_id,
                billing_type=data.billing_type.value,
                value=data.valor,
                due_date=data.vencimento,
                description=_append_portal_link(data.descricao or f"Cobranca movel - {cliente['nome']}"),
                external_reference=ref,
            )
            doc["asaas_payment_id"] = result.get("id")
            doc["asaas_invoice_url"] = result.get("invoiceUrl")
            doc["asaas_bankslip_url"] = result.get("bankSlipUrl")
            doc["status"] = result.get("status", "PENDING")
            # Fetch barcode/pix details
            payment_id = result.get("id")
            if payment_id:
                try:
                    if data.billing_type.value == "BOLETO":
                        barcode_data = await asaas_service.get_boleto_barcode(payment_id)
                        doc["barcode"] = barcode_data.get("identificationField")
                    elif data.billing_type.value == "PIX":
                        pix_data = await asaas_service.get_pix_qrcode(payment_id)
                        doc["asaas_pix_code"] = pix_data.get("payload")
                        doc["asaas_pix_qrcode"] = pix_data.get("encodedImage")
                except Exception as e:
                    logger.warning(f"Erro ao buscar detalhes do pagamento: {e}")
        except (AsaasNotConfiguredError, AsaasApiError) as e:
            logger.warning(f"Asaas API error ao criar cobranca: {e}")
        except Exception as e:
            logger.warning(f"Erro inesperado ao criar cobranca no Asaas: {e}")

    inserted = await db.cobrancas.insert_one(doc)
    doc["_id"] = inserted.inserted_id
    await create_log("financeiro", f"Cobranca criada: R$ {data.valor:.2f} para {cliente['nome']}", user["id"], user["name"])
    return await _build_cobranca_response(doc)

@api_router.delete("/carteira/cobrancas/{cobranca_id}")
async def delete_cobranca(cobranca_id: str, request: Request):
    user = await require_admin(request)
    doc = await db.cobrancas.find_one({"_id": ObjectId(cobranca_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Cobranca nao encontrada")
    if doc.get("status") in ["CONFIRMED", "RECEIVED"]:
        raise HTTPException(status_code=400, detail="Nao e possivel remover cobranca ja paga")
    if asaas_service.is_configured and doc.get("asaas_payment_id"):
        try:
            await asaas_service.delete_payment(doc["asaas_payment_id"])
        except AsaasApiError as e:
            logger.warning(f"Erro ao remover cobranca no Asaas: {e}")
        except Exception as e:
            logger.warning(f"Erro inesperado ao remover no Asaas: {e}")
    await db.cobrancas.delete_one({"_id": ObjectId(cobranca_id)})
    await create_log("financeiro", f"Cobranca removida: R$ {doc['valor']:.2f}", user["id"], user["name"])
    return {"message": "Cobranca removida"}

@api_router.post("/carteira/cobrancas/{cobranca_id}/refresh")
async def refresh_cobranca_asaas(cobranca_id: str, request: Request):
    """Consulta o Asaas para atualizar dados da cobranca. Se nao tem payment_id, gera no Asaas."""
    user = await require_admin(request)
    doc = await db.cobrancas.find_one({"_id": ObjectId(cobranca_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Cobranca nao encontrada")

    if not asaas_service.is_configured:
        raise HTTPException(status_code=400, detail="Asaas nao configurado. Verifique ASAAS_API_KEY no .env")

    payment_id = doc.get("asaas_payment_id")

    # Se nao tem payment real, redireciona para gerar
    if not payment_id or payment_id.startswith("mock_"):
        return await generate_asaas_payment(cobranca_id, request)

    try:
        payment = await asaas_service.get_payment(payment_id)
        update_fields = {
            "status": payment.get("status", doc["status"]),
            "asaas_invoice_url": payment.get("invoiceUrl"),
            "asaas_bankslip_url": payment.get("bankSlipUrl"),
        }
        if payment.get("confirmedDate"):
            update_fields["paid_at"] = payment["confirmedDate"]

        try:
            billing_type = doc.get("billing_type", "BOLETO")
            if billing_type == "BOLETO":
                barcode_data = await asaas_service.get_boleto_barcode(payment_id)
                update_fields["barcode"] = barcode_data.get("identificationField")
            elif billing_type == "PIX":
                pix_data = await asaas_service.get_pix_qrcode(payment_id)
                update_fields["asaas_pix_code"] = pix_data.get("payload")
                update_fields["asaas_pix_qrcode"] = pix_data.get("encodedImage")
        except Exception as e:
            logger.warning(f"Erro ao buscar detalhes pagamento: {e}")

        await db.cobrancas.update_one({"_id": doc["_id"]}, {"$set": update_fields})
        updated = await db.cobrancas.find_one({"_id": doc["_id"]})
        return await _build_cobranca_response(updated)
    except (AsaasNotConfiguredError, AsaasApiError) as e:
        raise HTTPException(status_code=502, detail=f"Erro ao consultar Asaas: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro: {str(e)}")


@api_router.post("/carteira/cobrancas/{cobranca_id}/gerar-asaas")
async def generate_asaas_payment(cobranca_id: str, request: Request):
    """Cria o pagamento no Asaas para uma cobranca que foi criada localmente (sem asaas_payment_id)."""
    user = await require_admin(request)
    doc = await db.cobrancas.find_one({"_id": ObjectId(cobranca_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Cobranca nao encontrada")

    if doc.get("asaas_payment_id") and not doc["asaas_payment_id"].startswith("mock_"):
        # Verify payment exists in current environment
        try:
            await asaas_service.get_payment(doc["asaas_payment_id"])
            raise HTTPException(status_code=400, detail="Cobranca ja possui pagamento no Asaas. Use o botao de atualizar.")
        except (AsaasApiError, Exception) as check_err:
            if "404" in str(check_err):
                logger.info(f"Payment {doc['asaas_payment_id']} nao encontrado no ambiente atual. Recriando.")
            else:
                raise HTTPException(status_code=400, detail="Cobranca ja possui pagamento no Asaas. Use o botao de atualizar.")

    if not asaas_service.is_configured:
        raise HTTPException(status_code=400, detail="Asaas nao configurado. Verifique ASAAS_API_KEY no .env")

    cliente = await db.clientes.find_one({"_id": ObjectId(doc["cliente_id"])})
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente nao encontrado")

    try:
        asaas_customer_id = await _get_asaas_customer_id(cliente, user)
        result = await asaas_service.create_payment(
            customer_id=asaas_customer_id,
            billing_type=doc["billing_type"],
            value=doc["valor"],
            due_date=doc["vencimento"],
            description=_append_portal_link(doc.get("descricao") or f"Cobranca movel - {cliente['nome']}"),
        )

        update_fields = {
            "asaas_payment_id": result.get("id"),
            "asaas_invoice_url": result.get("invoiceUrl"),
            "asaas_bankslip_url": result.get("bankSlipUrl"),
            "status": result.get("status", "PENDING"),
        }

        payment_id = result.get("id")
        if payment_id:
            try:
                if doc["billing_type"] == "BOLETO":
                    barcode_data = await asaas_service.get_boleto_barcode(payment_id)
                    update_fields["barcode"] = barcode_data.get("identificationField")
                elif doc["billing_type"] == "PIX":
                    pix_data = await asaas_service.get_pix_qrcode(payment_id)
                    update_fields["asaas_pix_code"] = pix_data.get("payload")
                    update_fields["asaas_pix_qrcode"] = pix_data.get("encodedImage")
            except Exception as e:
                logger.warning(f"Erro ao buscar detalhes pagamento apos criacao: {e}")

        await db.cobrancas.update_one({"_id": doc["_id"]}, {"$set": update_fields})
        updated = await db.cobrancas.find_one({"_id": doc["_id"]})
        await create_log("financeiro", f"Pagamento Asaas gerado para cobranca de {cliente['nome']}: {payment_id}", user["id"], user["name"])
        return await _build_cobranca_response(updated)
    except (AsaasNotConfiguredError, AsaasApiError) as e:
        detail_msg = f"Erro ao criar pagamento no Asaas: {str(e)}"
        if hasattr(e, 'details') and e.details:
            detail_msg += f" | Detalhes: {json.dumps(e.details, ensure_ascii=False)}"
        raise HTTPException(status_code=502, detail=detail_msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro: {str(e)}")




@api_router.put("/carteira/cobrancas/{cobranca_id}")
async def update_cobranca(cobranca_id: str, data: CobrancaCreate, request: Request):
    user = await require_admin(request)
    doc = await db.cobrancas.find_one({"_id": ObjectId(cobranca_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Cobranca nao encontrada")
    if doc.get("status") in ["CONFIRMED", "RECEIVED"]:
        raise HTTPException(status_code=400, detail="Nao e possivel editar cobranca ja paga")
    update_fields = {
        "cliente_id": data.cliente_id,
        "linha_id": data.linha_id,
        "billing_type": data.billing_type.value,
        "valor": data.valor,
        "vencimento": data.vencimento,
        "descricao": data.descricao,
    }
    if asaas_service.is_configured and doc.get("asaas_payment_id"):
        try:
            await asaas_service.update_payment(doc["asaas_payment_id"], {
                "value": data.valor,
                "dueDate": data.vencimento,
                "description": data.descricao or "",
            })
        except AsaasApiError as e:
            logger.warning(f"Erro ao atualizar cobranca no Asaas: {e}")
        except Exception as e:
            logger.warning(f"Erro inesperado ao atualizar no Asaas: {e}")
    await db.cobrancas.update_one({"_id": ObjectId(cobranca_id)}, {"$set": update_fields})
    await create_log("financeiro", f"Cobranca editada: R$ {data.valor:.2f}", user["id"], user["name"])
    updated = await db.cobrancas.find_one({"_id": ObjectId(cobranca_id)})
    return await _build_cobranca_response(updated)

class CobrancaLoteItem(BaseModel):
    cliente_id: str
    linha_id: Optional[str] = None
    billing_type: str = "BOLETO"
    valor: float
    vencimento: str
    descricao: Optional[str] = None

class CobrancaLoteRequest(BaseModel):
    cobrancas: List[CobrancaLoteItem]

@api_router.post("/carteira/cobrancas/lote")
async def create_cobrancas_lote(data: CobrancaLoteRequest, request: Request):
    user = await require_admin(request)
    created = 0
    errors = []
    for idx, item in enumerate(data.cobrancas):
        try:
            cliente = await db.clientes.find_one({"_id": ObjectId(item.cliente_id)})
            if not cliente:
                errors.append(f"Item {idx+1}: Cliente nao encontrado")
                continue
            doc = {
                "cliente_id": item.cliente_id,
                "linha_id": item.linha_id,
                "billing_type": item.billing_type,
                "valor": item.valor,
                "vencimento": item.vencimento,
                "descricao": item.descricao,
                "status": "PENDING",
                "asaas_payment_id": None,
                "asaas_invoice_url": None,
                "asaas_pix_code": None,
                "paid_at": None,
                "created_at": datetime.now(timezone.utc),
            }
            if asaas_service.is_configured:
                try:
                    asaas_customer_id = await _get_asaas_customer_id(cliente, user)
                    result = await asaas_service.create_payment(
                        customer_id=asaas_customer_id,
                        billing_type=item.billing_type,
                        value=item.valor,
                        due_date=item.vencimento,
                        description=_append_portal_link(item.descricao or f"Cobranca - {cliente['nome']}"),
                        external_reference=f"lote-{item.cliente_id}",
                    )
                    doc["asaas_payment_id"] = result.get("id")
                    doc["asaas_invoice_url"] = result.get("invoiceUrl")
                    doc["status"] = result.get("status", "PENDING")
                except (AsaasNotConfiguredError, AsaasApiError) as e:
                    logger.warning(f"Asaas lote error item {idx+1}: {e}")
                except Exception as e:
                    logger.warning(f"Asaas lote erro inesperado item {idx+1}: {e}")
            created += 1
            await db.cobrancas.insert_one(doc)
        except Exception as e:
            errors.append(f"Item {idx+1}: {str(e)}")
    await create_log("financeiro", f"Lote de cobrancas: {created} criadas de {len(data.cobrancas)}", user["id"], user["name"])
    return {"success": True, "created": created, "total": len(data.cobrancas), "errors": errors}

@api_router.post("/carteira/cobrancas/{cobranca_id}/consultar")
async def consultar_cobranca(cobranca_id: str, request: Request):
    user = await get_current_user(request)
    doc = await db.cobrancas.find_one({"_id": ObjectId(cobranca_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Cobranca nao encontrada")
    if not doc.get("asaas_payment_id"):
        return {"message": "Cobranca sem ID Asaas vinculado", "status": doc.get("status", "PENDING")}
    if not asaas_service.is_configured:
        raise HTTPException(status_code=400, detail="Asaas nao configurado")
    try:
        result = await asaas_service.get_payment(doc["asaas_payment_id"])
        new_status = result.get("status", doc.get("status"))
        update_fields = {"status": new_status}
        if new_status in ["CONFIRMED", "RECEIVED"] and not doc.get("paid_at"):
            update_fields["paid_at"] = result.get("confirmedDate") or datetime.now(timezone.utc).isoformat()
        await db.cobrancas.update_one({"_id": ObjectId(cobranca_id)}, {"$set": update_fields})
        return {"status": new_status, "asaas_data": result}
    except AsaasApiError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))

# --- Assinaturas ---
@api_router.get("/carteira/assinaturas", response_model=List[AssinaturaResponse])
async def list_assinaturas(request: Request, cliente_id: Optional[str] = None,
                           status: Optional[str] = None, limit: int = 100):
    await get_current_user(request)
    query = {}
    if cliente_id:
        query["cliente_id"] = cliente_id
    if status and status not in ("all", "todos"):
        query["status"] = status
    docs = await db.assinaturas.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    return [await _build_assinatura_response(d) for d in docs]

@api_router.post("/carteira/assinaturas", response_model=AssinaturaResponse)
async def create_assinatura(data: AssinaturaCreate, request: Request):
    user = await require_admin(request)
    cliente = await db.clientes.find_one({"_id": ObjectId(data.cliente_id)})
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente nao encontrado")

    doc = {
        "cliente_id": data.cliente_id,
        "linha_id": data.linha_id,
        "billing_type": data.billing_type.value,
        "valor": data.valor,
        "ciclo": data.ciclo,
        "proximo_vencimento": data.proximo_vencimento,
        "descricao": data.descricao,
        "status": "ACTIVE",
        "asaas_subscription_id": None,
        "asaas_customer_id": None,
        "created_at": datetime.now(timezone.utc),
    }

    if asaas_service.is_configured:
        try:
            asaas_customer_id = await _get_asaas_customer_id(cliente, user)
            doc["asaas_customer_id"] = asaas_customer_id
            result = await asaas_service.create_subscription(
                customer_id=asaas_customer_id,
                billing_type=data.billing_type.value,
                value=data.valor,
                next_due_date=data.proximo_vencimento,
                cycle=data.ciclo,
                description=_append_portal_link(data.descricao or f"Assinatura movel - {cliente['nome']}"),
                external_reference=f"ass-{data.cliente_id}",
            )
            doc["asaas_subscription_id"] = result.get("id")
            doc["status"] = result.get("status", "ACTIVE")
        except (AsaasNotConfiguredError, AsaasApiError) as e:
            logger.warning(f"Asaas API error ao criar assinatura: {e}")

    inserted = await db.assinaturas.insert_one(doc)
    doc["_id"] = inserted.inserted_id
    await create_log("financeiro", f"Assinatura criada: R$ {data.valor:.2f}/mes para {cliente['nome']}", user["id"], user["name"])
    return await _build_assinatura_response(doc)

@api_router.post("/carteira/assinaturas/{assinatura_id}/cancelar")
async def cancelar_assinatura(assinatura_id: str, request: Request):
    user = await require_admin(request)
    doc = await db.assinaturas.find_one({"_id": ObjectId(assinatura_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Assinatura nao encontrada")
    if doc.get("status") == "CANCELLED":
        raise HTTPException(status_code=400, detail="Assinatura ja esta cancelada")

    if asaas_service.is_configured and doc.get("asaas_subscription_id"):
        try:
            await asaas_service.cancel_subscription(doc["asaas_subscription_id"])
        except AsaasApiError as e:
            logger.warning(f"Erro ao cancelar assinatura no Asaas: {e}")

    await db.assinaturas.update_one({"_id": ObjectId(assinatura_id)}, {"$set": {"status": "CANCELLED"}})
    await create_log("financeiro", f"Assinatura cancelada: {assinatura_id}", user["id"], user["name"])
    return {"message": "Assinatura cancelada"}

# --- Sincronizar cliente com Asaas ---
@api_router.post("/carteira/clientes/{cliente_id}/sync-asaas")
async def sync_cliente_asaas(cliente_id: str, request: Request):
    user = await require_admin(request)
    if not asaas_service.is_configured:
        raise HTTPException(status_code=400, detail="Asaas nao configurado. Defina ASAAS_API_KEY no .env")
    cliente = await db.clientes.find_one({"_id": ObjectId(cliente_id)})
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente nao encontrado")
    try:
        asaas_id = await _get_asaas_customer_id(cliente, user)
        return {"message": f"Cliente sincronizado com Asaas", "asaas_customer_id": asaas_id}
    except AsaasApiError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))

@api_router.post("/carteira/desabilitar-notificacoes")
async def disable_asaas_notifications_bulk(request: Request):
    """Desabilita notificacoes do Asaas para TODOS os clientes que ja possuem asaas_customer_id."""
    user = await require_admin(request)
    if not asaas_service.is_configured:
        raise HTTPException(status_code=400, detail="Asaas nao configurado")
    clientes_cursor = db.clientes.find({"asaas_customer_id": {"$exists": True, "$ne": ""}})
    clientes_list = await clientes_cursor.to_list(length=5000)
    total = len(clientes_list)
    updated = 0
    errors = []
    for cli in clientes_list:
        try:
            await asaas_service.disable_customer_notifications(cli["asaas_customer_id"])
            updated += 1
        except Exception as e:
            errors.append({"cliente": cli.get("nome", "?"), "error": str(e)})
    await create_log("financeiro", f"Notificacoes Asaas desabilitadas: {updated}/{total}", user["id"], user["name"])
    return {"total": total, "updated": updated, "errors": errors}

# --- Webhook Asaas ---
@api_router.post("/webhooks/asaas")
async def asaas_webhook(request: Request):
    """Recebe notificacoes de pagamento do Asaas."""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Payload invalido")

    event = body.get("event")
    payment = body.get("payment", {})
    payment_id = payment.get("id")
    status = payment.get("status")

    logger.info(f"Asaas webhook: event={event} payment_id={payment_id} status={status}")

    if payment_id and status:
        cobranca = await db.cobrancas.find_one({"asaas_payment_id": payment_id})
        if cobranca:
            update_fields = {"status": status}
            if status in ["CONFIRMED", "RECEIVED"]:
                update_fields["paid_at"] = payment.get("confirmedDate") or datetime.now(timezone.utc).isoformat()
            await db.cobrancas.update_one({"_id": cobranca["_id"]}, {"$set": update_fields})
            await create_log("financeiro", f"Webhook Asaas: cobranca {payment_id} -> {status}", None, "Sistema")
            logger.info(f"Cobranca {payment_id} atualizada para {status}")

    return {"received": True}

# --- Sync status from Asaas ---
@api_router.post("/carteira/sincronizar-status")
async def sync_cobrancas_status(request: Request):
    """Consulta o Asaas e atualiza o status de todas as cobrancas pendentes."""
    user = await require_admin(request)
    if not asaas_service.is_configured:
        raise HTTPException(status_code=400, detail="Asaas nao configurado")

    pendentes = await db.cobrancas.find({
        "asaas_payment_id": {"$ne": None, "$exists": True},
        "status": {"$nin": ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]},
    }).to_list(200)

    updated_count = 0
    errors = []
    for cob in pendentes:
        try:
            payment_data = await asaas_service.get_payment(cob["asaas_payment_id"])
            new_status = payment_data.get("status")
            if new_status and new_status != cob.get("status"):
                update_fields = {"status": new_status}
                if new_status in ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]:
                    update_fields["paid_at"] = payment_data.get("confirmedDate") or datetime.now(timezone.utc).isoformat()
                await db.cobrancas.update_one({"_id": cob["_id"]}, {"$set": update_fields})
                updated_count += 1
        except Exception as e:
            errors.append(f"{cob['asaas_payment_id']}: {str(e)}")

    await create_log("financeiro", f"Sync Asaas: {updated_count} cobrancas atualizadas de {len(pendentes)} pendentes", user["id"], user["name"])
    return {"total_checked": len(pendentes), "updated": updated_count, "errors": errors}



# ==================== REVENDEDORES ====================
class RevendedorCreate(BaseModel):
    nome: str
    contato: Optional[str] = None
    telefone: Optional[str] = None
    desconto_valor: float = 0
    observacoes: Optional[str] = None

class RevendedorResponse(BaseModel):
    id: str
    nome: str
    contato: Optional[str] = None
    telefone: Optional[str] = None
    desconto_valor: float
    observacoes: Optional[str] = None
    total_chips: int = 0
    chips_ativados: int = 0
    created_at: Optional[datetime] = None

async def _build_revendedor_response(doc: dict) -> RevendedorResponse:
    rev_id = str(doc["_id"])
    total_chips = await db.chips.count_documents({"revendedor_id": rev_id})
    chips_ativados = await db.chips.count_documents({"revendedor_id": rev_id, "status": "ativado"})
    return RevendedorResponse(
        id=rev_id, nome=doc["nome"], contato=doc.get("contato"),
        telefone=doc.get("telefone"), desconto_valor=doc.get("desconto_valor", 0),
        observacoes=doc.get("observacoes"), total_chips=total_chips,
        chips_ativados=chips_ativados,
        created_at=doc.get("created_at", datetime.now(timezone.utc)),
    )

@api_router.get("/revendedores")
async def list_revendedores(request: Request):
    await get_current_user(request)
    docs = await db.revendedores.find().sort("nome", 1).to_list(500)
    return [await _build_revendedor_response(d) for d in docs]

@api_router.post("/revendedores")
async def create_revendedor(data: RevendedorCreate, request: Request):
    user = await require_admin(request)
    doc = {
        "nome": data.nome,
        "contato": data.contato,
        "telefone": data.telefone,
        "desconto_valor": data.desconto_valor,
        "observacoes": data.observacoes,
        "created_at": datetime.now(timezone.utc),
    }
    inserted = await db.revendedores.insert_one(doc)
    doc["_id"] = inserted.inserted_id
    await create_log("revendedor", f"Revendedor criado: {data.nome}", user["id"], user["name"])
    return await _build_revendedor_response(doc)

@api_router.put("/revendedores/{rev_id}")
async def update_revendedor(rev_id: str, data: RevendedorCreate, request: Request):
    user = await require_admin(request)
    doc = await db.revendedores.find_one({"_id": ObjectId(rev_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Revendedor nao encontrado")
    update = {
        "nome": data.nome, "contato": data.contato, "telefone": data.telefone,
        "desconto_valor": data.desconto_valor, "observacoes": data.observacoes,
    }
    await db.revendedores.update_one({"_id": ObjectId(rev_id)}, {"$set": update})
    updated = await db.revendedores.find_one({"_id": ObjectId(rev_id)})
    await create_log("revendedor", f"Revendedor editado: {data.nome}", user["id"], user["name"])
    return await _build_revendedor_response(updated)

@api_router.delete("/revendedores/{rev_id}")
async def delete_revendedor(rev_id: str, request: Request):
    user = await require_admin(request)
    doc = await db.revendedores.find_one({"_id": ObjectId(rev_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Revendedor nao encontrado")
    await db.chips.update_many({"revendedor_id": rev_id}, {"$unset": {"revendedor_id": ""}})
    await db.revendedores.delete_one({"_id": ObjectId(rev_id)})
    await create_log("revendedor", f"Revendedor removido: {doc['nome']}", user["id"], user["name"])
    return {"message": "Revendedor removido"}

class VincularChipsRequest(BaseModel):
    iccids: List[str]

@api_router.post("/revendedores/{rev_id}/vincular-chips")
async def vincular_chips_revendedor(rev_id: str, data: VincularChipsRequest, request: Request):
    user = await require_admin(request)
    doc = await db.revendedores.find_one({"_id": ObjectId(rev_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Revendedor nao encontrado")
    linked = 0
    for iccid in data.iccids:
        result = await db.chips.update_one(
            {"iccid": iccid, "status": "disponivel"},
            {"$set": {"revendedor_id": rev_id}}
        )
        if result.modified_count:
            linked += 1
    await create_log("revendedor", f"{linked} chips vinculados ao revendedor {doc['nome']}", user["id"], user["name"])
    return {"success": True, "linked": linked, "total": len(data.iccids)}

@api_router.post("/revendedores/{rev_id}/desvincular-chips")
async def desvincular_chips_revendedor(rev_id: str, data: VincularChipsRequest, request: Request):
    user = await require_admin(request)
    unlinked = 0
    for iccid in data.iccids:
        result = await db.chips.update_one(
            {"iccid": iccid, "revendedor_id": rev_id},
            {"$unset": {"revendedor_id": ""}}
        )
        if result.modified_count:
            unlinked += 1
    await create_log("revendedor", f"{unlinked} chips desvinculados do revendedor", user["id"], user["name"])
    return {"success": True, "unlinked": unlinked}

@api_router.get("/revendedores/{rev_id}/chips")
async def get_chips_revendedor(rev_id: str, request: Request):
    await get_current_user(request)
    chips = await db.chips.find({"revendedor_id": rev_id}, {"_id": 0, "iccid": 1, "status": 1, "msisdn": 1, "cliente_id": 1}).to_list(1000)
    return chips



# ==================== PORTAL DO CLIENTE ====================
class PortalLoginRequest(BaseModel):
    documento: str
    telefone: str

@api_router.post("/portal/login")
async def portal_login(data: PortalLoginRequest):
    """Login do cliente por CPF + telefone."""
    try:
        doc_clean = clean_document(data.documento)
        tel_clean = re.sub(r'\D', '', data.telefone)

        cliente = await db.clientes.find_one({"documento": doc_clean})
        if not cliente:
            raise HTTPException(status_code=401, detail="CPF nao encontrado. Entre em contato com a operadora para verificar seu cadastro.")

        cliente_id_str = str(cliente["_id"])

        # Find line matching the phone number
        linhas = await db.linhas.find({"cliente_id": cliente_id_str}).to_list(100)
        chip_match = None
        linha_match = None
        for l in linhas:
            msisdn = l.get("msisdn") or l.get("numero") or ""
            msisdn_clean = re.sub(r'\D', '', msisdn)
            if msisdn_clean and (tel_clean.endswith(msisdn_clean[-8:]) or msisdn_clean.endswith(tel_clean[-8:])):
                linha_match = l
                if l.get("chip_id"):
                    try:
                        chip_match = await db.chips.find_one({"_id": ObjectId(l["chip_id"])})
                    except Exception:
                        pass
                break

        if not linha_match:
            # Try matching via chips
            chips = await db.chips.find({"cliente_id": cliente_id_str}).to_list(100)
            for c in chips:
                msisdn = c.get("msisdn", "")
                msisdn_clean = re.sub(r'\D', '', msisdn)
                if msisdn_clean and (tel_clean.endswith(msisdn_clean[-8:]) or msisdn_clean.endswith(tel_clean[-8:])):
                    chip_match = c
                    linha_match = await db.linhas.find_one({"chip_id": str(c["_id"])})
                    break

        if not linha_match and not chip_match:
            raise HTTPException(status_code=401, detail="Telefone nao encontrado para este CPF.")

        # Generate portal token (simple JWT with limited scope)
        portal_token = jwt.encode({
            "sub": cliente_id_str,
            "type": "portal",
            "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        }, get_jwt_secret(), algorithm=JWT_ALGORITHM)

        return {
            "token": portal_token,
            "cliente": {
                "nome": cliente.get("nome", "Cliente"),
                "documento": doc_clean,
                "telefone": data.telefone,
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro no portal login: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Erro interno ao processar login. Tente novamente.")

async def _get_portal_cliente(request: Request) -> dict:
    """Extrai e valida o token do portal do cliente."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token nao fornecido")
    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "portal":
            raise HTTPException(status_code=401, detail="Token invalido")
        cliente = await db.clientes.find_one({"_id": ObjectId(payload["sub"])})
        if not cliente:
            raise HTTPException(status_code=401, detail="Cliente nao encontrado")
        return cliente
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sessao expirada. Faca login novamente.")
    except Exception:
        raise HTTPException(status_code=401, detail="Token invalido")

@api_router.get("/portal/dashboard")
async def portal_dashboard(request: Request):
    """Retorna dados completos do cliente: linhas, plano, saldo, consumo, boletos."""
    try:
        cliente = await _get_portal_cliente(request)
        cliente_id = str(cliente["_id"])

        # Linhas do cliente
        linhas = await db.linhas.find({"cliente_id": cliente_id}).to_list(50)
        chips = await db.chips.find({"cliente_id": cliente_id}).to_list(50)

        # Planos e ofertas (com proteção para ObjectId inválido)
        plano_ids = list(set(l.get("plano_id") for l in linhas if l.get("plano_id")))
        oferta_ids = list(set(l.get("oferta_id") for l in linhas if l.get("oferta_id")))
        planos_lookup = {}
        ofertas_lookup = {}
        if plano_ids:
            try:
                valid_ids = [ObjectId(p) for p in plano_ids if ObjectId.is_valid(p)]
                if valid_ids:
                    docs = await db.planos.find({"_id": {"$in": valid_ids}}).to_list(len(valid_ids))
                    planos_lookup = {str(d["_id"]): d for d in docs}
            except Exception as e:
                logger.warning(f"Portal dashboard: erro ao buscar planos: {e}")
        if oferta_ids:
            try:
                valid_ids = [ObjectId(o) for o in oferta_ids if ObjectId.is_valid(o)]
                if valid_ids:
                    docs = await db.ofertas.find({"_id": {"$in": valid_ids}}).to_list(len(valid_ids))
                    ofertas_lookup = {str(d["_id"]): d for d in docs}
            except Exception as e:
                logger.warning(f"Portal dashboard: erro ao buscar ofertas: {e}")

        linhas_data = []
        for l in linhas:
            numero = l.get("msisdn") or l.get("numero") or ""
            plano = planos_lookup.get(l.get("plano_id"))
            oferta = ofertas_lookup.get(l.get("oferta_id"))
            chip = next((c for c in chips if str(c["_id"]) == l.get("chip_id")), None)

            linhas_data.append({
                "id": str(l["_id"]),
                "numero": numero,
                "status": l.get("status", "desconhecido"),
                "plano_nome": plano.get("nome") if plano else None,
                "franquia": plano.get("franquia") if plano else None,
                "plan_code": plano.get("plan_code") if plano else None,
                "oferta_nome": oferta.get("nome") if oferta else None,
                "valor": oferta.get("valor") if oferta else None,
                "iccid": chip.get("iccid") if chip else None,
            })

        # Cobranças do cliente (Asaas) - com sync de status em tempo real
        cobrancas = await db.cobrancas.find({"cliente_id": cliente_id}).sort("created_at", -1).to_list(50)
        cobrancas_data = []
        for c in cobrancas:
            status = c.get("status", "PENDING")
            if c.get("asaas_payment_id") and status not in ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH", "REFUNDED"]:
                try:
                    if asaas_service.is_configured:
                        payment_data = await asaas_service.get_payment(c["asaas_payment_id"])
                        new_status = payment_data.get("status")
                        if new_status and new_status != status:
                            update_fields = {"status": new_status}
                            if new_status in ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]:
                                update_fields["paid_at"] = payment_data.get("confirmedDate") or datetime.now(timezone.utc).isoformat()
                            await db.cobrancas.update_one({"_id": c["_id"]}, {"$set": update_fields})
                            status = new_status
                except Exception as e:
                    logger.warning(f"Portal: erro ao sync status cobranca {c.get('asaas_payment_id')}: {e}")

            cobrancas_data.append({
                "id": str(c["_id"]),
                "valor": c.get("valor", 0),
                "vencimento": c.get("vencimento", ""),
                "billing_type": c.get("billing_type", "UNDEFINED"),
                "status": status,
                "descricao": c.get("descricao"),
                "asaas_invoice_url": c.get("asaas_invoice_url"),
                "asaas_bankslip_url": c.get("asaas_bankslip_url"),
                "asaas_pix_code": c.get("asaas_pix_code"),
                "barcode": c.get("barcode"),
                "paid_at": c.get("paid_at"),
            })

        # Ativações self-service
        ss_ativacoes = await db.ativacoes_selfservice.find({"cliente_id": cliente_id}).sort("created_at", -1).to_list(10)
        ss_data = []
        for s in ss_ativacoes:
            created = s.get("created_at")
            if hasattr(created, "isoformat"):
                created = created.isoformat()
            elif not isinstance(created, str):
                created = datetime.now(timezone.utc).isoformat()
            ss_data.append({
                "id": str(s["_id"]),
                "iccid": s.get("iccid"),
                "status": s.get("status"),
                "valor_final": s.get("valor_final", 0),
                "asaas_invoice_url": s.get("asaas_invoice_url"),
                "asaas_pix_code": s.get("asaas_pix_code"),
                "barcode": s.get("barcode"),
                "created_at": created,
            })

        return {
            "cliente": {
                "nome": cliente.get("nome", "Cliente"),
                "documento": cliente.get("documento"),
                "email": cliente.get("email"),
                "telefone": cliente.get("telefone"),
            },
            "linhas": linhas_data,
            "cobrancas": cobrancas_data,
            "ativacoes_selfservice": ss_data,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro no portal dashboard: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Erro interno ao carregar dashboard.")

@api_router.get("/portal/saldo/{numero}")
async def portal_saldo(numero: str, request: Request):
    """Consulta saldo de dados na Ta Telecom."""
    cliente = await _get_portal_cliente(request)
    numero_clean = re.sub(r'\D', '', numero)
    try:
        resp = await operadora_service.consultar_saldo_dados(numero_clean, db=db, user_id=str(cliente["_id"]), user_name=cliente["nome"])
        if resp.success and resp.data:
            return {
                "success": True,
                "balance_mb": resp.data.get("balance", 0),
                "codigo_status_tip": resp.data.get("codigo_status_tip"),
            }
        return {"success": False, "message": resp.message, "balance_mb": 0}
    except Exception as e:
        return {"success": False, "message": str(e), "balance_mb": 0}

@api_router.get("/portal/consumo/{numero}")
async def portal_consumo(numero: str, request: Request, periodo: Optional[str] = None):
    """Consulta consumo consolidado do mes."""
    cliente = await _get_portal_cliente(request)
    numero_clean = re.sub(r'\D', '', numero)
    if not periodo:
        periodo = datetime.now(timezone.utc).strftime("%Y-%m")
    try:
        resp = await operadora_service.consultar_consumo_consolidado(
            periodo=periodo,
            cpf_cnpj=cliente.get("documento"),
            linha=numero_clean,
            db=db, user_id=str(cliente["_id"]), user_name=cliente["nome"]
        )
        if resp.success and resp.data:
            results = resp.data.get("results", [])
            if results:
                r = results[0]
                return {
                    "success": True,
                    "consumo_dados_mb": float(r.get("consumo_dados", 0)),
                    "consumo_dados_gb": float(r.get("consumo_dados", 0)) / 1024,
                    "consumo_sms": int(r.get("consumo_sms", 0)),
                    "consumo_minutos": float(r.get("consumo_segundos", 0)) / 60,
                    "consumo_segundos": int(r.get("consumo_segundos", 0)),
                    "plano": r.get("plano"),
                    "contrato_status": r.get("contrato_status"),
                    "simcard_status": r.get("simcard_status"),
                    "periodo": r.get("periodo"),
                    "cliente_nome": r.get("cliente_nome"),
                }
            return {"success": True, "consumo_dados_gb": 0, "consumo_sms": 0, "consumo_minutos": 0, "periodo": periodo, "message": "Sem dados para o periodo"}
        return {"success": False, "message": resp.message}
    except Exception as e:
        return {"success": False, "message": str(e)}


# ==================== PUBLIC SELF-SERVICE ACTIVATION ====================
class SelfServiceActivationRequest(BaseModel):
    iccid: str
    nome: str
    tipo_pessoa: TipoPessoa = TipoPessoa.pf
    documento: str
    telefone: str
    data_nascimento: str
    cep: str
    endereco: str
    numero_endereco: str
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    city_code: Optional[str] = None
    complemento: Optional[str] = None
    email: Optional[str] = None
    billing_type: str = "PIX"  # PIX or BOLETO
    portability: bool = False
    port_ddd: Optional[str] = None
    port_number: Optional[str] = None
    ddd: Optional[str] = None

class SelfServiceActivationResponse(BaseModel):
    id: str
    status: str  # aguardando_pagamento, pago, ativando, ativo, erro
    chip_iccid: str
    plano_nome: Optional[str] = None
    oferta_nome: Optional[str] = None
    valor_original: float
    desconto: float = 0
    valor_final: float
    billing_type: str
    asaas_invoice_url: Optional[str] = None
    asaas_pix_code: Optional[str] = None
    asaas_pix_qrcode: Optional[str] = None
    barcode: Optional[str] = None
    message: str = ""

@api_router.get("/public/validar-chip/{iccid}")
async def public_validate_chip(iccid: str):
    """Valida um ICCID e retorna info do chip, oferta, plano e desconto do revendedor."""
    iccid_clean = re.sub(r'\D', '', iccid)
    chip = await db.chips.find_one({"iccid": iccid_clean})
    if not chip:
        raise HTTPException(status_code=404, detail="Chip nao encontrado. Verifique o ICCID informado.")
    if chip["status"] != "disponivel":
        status_msgs = {
            "ativado": "Este chip ja foi ativado.",
            "bloqueado": "Este chip esta bloqueado.",
            "reservado": "Este chip esta reservado.",
            "cancelado": "Este chip foi cancelado.",
        }
        raise HTTPException(status_code=400, detail=status_msgs.get(chip["status"], f"Chip indisponivel (status: {chip['status']})"))

    if not chip.get("oferta_id"):
        raise HTTPException(status_code=400, detail="Chip nao possui oferta vinculada. Contate o administrador.")

    oferta = await db.ofertas.find_one({"_id": ObjectId(chip["oferta_id"])})
    if not oferta or not oferta.get("ativo", True):
        raise HTTPException(status_code=400, detail="Oferta deste chip nao esta disponivel.")

    plano = None
    if oferta.get("plano_id"):
        plano = await db.planos.find_one({"_id": ObjectId(oferta["plano_id"])})

    desconto = 0.0
    revendedor_nome = None
    if chip.get("revendedor_id"):
        rev = await db.revendedores.find_one({"_id": ObjectId(chip["revendedor_id"])})
        if rev:
            desconto = rev.get("desconto_valor", 0)
            revendedor_nome = rev.get("nome")

    valor_original = oferta.get("valor", 0)
    valor_final = max(0, valor_original - desconto)

    return {
        "chip_id": str(chip["_id"]),
        "iccid": chip["iccid"],
        "oferta_id": str(oferta["_id"]),
        "oferta_nome": oferta["nome"],
        "plano_nome": plano["nome"] if plano else None,
        "franquia": plano["franquia"] if plano else None,
        "descricao": oferta.get("descricao") or (plano["descricao"] if plano else None),
        "valor_original": valor_original,
        "desconto": desconto,
        "valor_final": valor_final,
        "revendedor_nome": revendedor_nome,
        "tem_revendedor": bool(chip.get("revendedor_id")),
    }

@api_router.get("/public/ofertas")
async def public_list_offers():
    """Lista ofertas ativas com dados do plano para a pagina publica."""
    ofertas = await db.ofertas.find({"ativo": True}).to_list(100)
    result = []
    for o in ofertas:
        plano = None
        if o.get("plano_id"):
            plano = await db.planos.find_one({"_id": ObjectId(o["plano_id"])})
        result.append({
            "id": str(o["_id"]),
            "nome": o["nome"],
            "plano_nome": plano["nome"] if plano else None,
            "franquia": plano["franquia"] if plano else None,
            "descricao": o.get("descricao") or (plano.get("descricao") if plano else None),
            "valor": o.get("valor", 0),
            "categoria": o.get("categoria", "movel"),
        })
    return result

@api_router.post("/public/ativacao", response_model=SelfServiceActivationResponse)
async def public_self_service_activation(data: SelfServiceActivationRequest):
    """Fluxo completo de ativacao self-service: valida chip, cria/encontra cliente, gera cobranca."""
    iccid_clean = re.sub(r'\D', '', data.iccid)

    # 1. Validate chip
    chip = await db.chips.find_one({"iccid": iccid_clean})
    if not chip:
        raise HTTPException(status_code=404, detail="Chip nao encontrado")
    if chip["status"] != "disponivel":
        raise HTTPException(status_code=400, detail="Chip nao esta disponivel para ativacao")

    oferta = await db.ofertas.find_one({"_id": ObjectId(chip["oferta_id"])})
    if not oferta:
        raise HTTPException(status_code=400, detail="Oferta do chip nao encontrada")
    plano = None
    if oferta.get("plano_id"):
        plano = await db.planos.find_one({"_id": ObjectId(oferta["plano_id"])})

    # 2. Calculate discount
    desconto = 0.0
    if chip.get("revendedor_id"):
        rev = await db.revendedores.find_one({"_id": ObjectId(chip["revendedor_id"])})
        if rev:
            desconto = rev.get("desconto_valor", 0)
    valor_original = oferta.get("valor", 0)
    valor_final = max(0, valor_original - desconto)

    # 3. Validate document
    doc_clean = clean_document(data.documento)
    if data.tipo_pessoa == TipoPessoa.pf:
        if not validate_cpf(doc_clean):
            raise HTTPException(status_code=400, detail="CPF invalido")
    else:
        if not validate_cnpj(doc_clean):
            raise HTTPException(status_code=400, detail="CNPJ invalido")

    # 4. Create or find cliente
    existing_client = await db.clientes.find_one({"documento": doc_clean})
    if existing_client:
        cliente_id = str(existing_client["_id"])
        # Update client data
        await db.clientes.update_one({"_id": existing_client["_id"]}, {"$set": {
            "nome": data.nome, "telefone": data.telefone,
            "data_nascimento": data.data_nascimento, "cep": re.sub(r'\D', '', data.cep),
            "endereco": data.endereco, "numero_endereco": data.numero_endereco,
            "bairro": data.bairro, "cidade": data.cidade, "estado": data.estado,
            "city_code": data.city_code, "complemento": data.complemento,
        }})
        cliente = await db.clientes.find_one({"_id": existing_client["_id"]})
    else:
        cliente_doc = {
            "nome": data.nome, "tipo_pessoa": data.tipo_pessoa.value,
            "documento": doc_clean, "telefone": data.telefone,
            "data_nascimento": data.data_nascimento,
            "cep": re.sub(r'\D', '', data.cep), "endereco": data.endereco,
            "numero_endereco": data.numero_endereco, "bairro": data.bairro,
            "cidade": data.cidade, "estado": data.estado,
            "city_code": data.city_code, "complemento": data.complemento,
            "email": data.email, "status": "ativo",
            "created_at": datetime.now(timezone.utc),
        }
        result = await db.clientes.insert_one(cliente_doc)
        cliente_id = str(result.inserted_id)
        cliente_doc["_id"] = result.inserted_id
        cliente = cliente_doc

    # 5. Reserve chip
    await db.chips.update_one({"_id": chip["_id"]}, {"$set": {"status": "reservado", "cliente_id": cliente_id}})

    # 6. Create activation record
    vencimento = (datetime.now(timezone.utc) + timedelta(days=3)).strftime("%Y-%m-%d")
    activation_doc = {
        "cliente_id": cliente_id,
        "chip_id": str(chip["_id"]),
        "iccid": iccid_clean,
        "oferta_id": str(oferta["_id"]),
        "plano_id": oferta.get("plano_id"),
        "valor_original": valor_original,
        "desconto": desconto,
        "valor_final": valor_final,
        "billing_type": data.billing_type,
        "status": "aguardando_pagamento",
        "asaas_payment_id": None,
        "asaas_invoice_url": None,
        "asaas_pix_code": None,
        "asaas_pix_qrcode": None,
        "barcode": None,
        "revendedor_id": chip.get("revendedor_id"),
        "portability": data.portability,
        "port_ddd": data.port_ddd if data.portability else None,
        "port_number": data.port_number if data.portability else None,
        "ddd": data.ddd,
        "created_at": datetime.now(timezone.utc),
    }

    # 7. Create Asaas payment
    if asaas_service.is_configured and valor_final > 0:
        try:
            asaas_customer = await asaas_service.get_or_create_customer(
                name=data.nome,
                cpf_cnpj=doc_clean,
                email=data.email,
                phone=data.telefone,
                address=data.endereco,
                address_number=data.numero_endereco,
                province=data.bairro,
                postal_code=re.sub(r'\D', '', data.cep),
            )
            asaas_customer_id = asaas_customer.get("id")
            if asaas_customer_id:
                await db.clientes.update_one({"_id": ObjectId(cliente_id)}, {"$set": {"asaas_customer_id": asaas_customer_id}})

            payment_result = await asaas_service.create_payment(
                customer_id=asaas_customer_id,
                billing_type=data.billing_type,
                value=valor_final,
                due_date=vencimento,
                description=_append_portal_link(f"Ativacao chip {iccid_clean} - {oferta['nome']}"),
                discount_value=desconto if desconto > 0 else None,
            )
            activation_doc["asaas_payment_id"] = payment_result.get("id")
            activation_doc["asaas_invoice_url"] = payment_result.get("invoiceUrl")

            payment_id = payment_result.get("id")
            if payment_id:
                try:
                    if data.billing_type == "BOLETO":
                        barcode_data = await asaas_service.get_boleto_barcode(payment_id)
                        activation_doc["barcode"] = barcode_data.get("identificationField")
                    elif data.billing_type == "PIX":
                        pix_data = await asaas_service.get_pix_qrcode(payment_id)
                        activation_doc["asaas_pix_code"] = pix_data.get("payload")
                        activation_doc["asaas_pix_qrcode"] = pix_data.get("encodedImage")
                except Exception as e:
                    logger.warning(f"Erro ao buscar detalhes pagamento self-service: {e}")
        except Exception as e:
            logger.warning(f"Erro Asaas no self-service (usando mock local): {e}")
            activation_doc["asaas_payment_id"] = f"mock_ss_{secrets.token_hex(8)}"
            activation_doc["asaas_invoice_url"] = None
    elif valor_final <= 0:
        activation_doc["status"] = "pago"

    inserted = await db.ativacoes_selfservice.insert_one(activation_doc)
    activation_doc["_id"] = inserted.inserted_id

    await create_log("ativacao", f"Self-service: {data.nome} ({doc_clean}) solicitou ativacao do chip {iccid_clean}", None, "self-service")

    # Se valor final = 0 (100% desconto), disparar ativacao imediatamente
    if valor_final <= 0:
        try:
            await _trigger_selfservice_activation(activation_doc)
            # Recarregar o doc atualizado
            updated_doc = await db.ativacoes_selfservice.find_one({"_id": inserted.inserted_id})
            if updated_doc:
                activation_doc = updated_doc
        except Exception as e:
            logger.warning(f"Erro ao disparar ativacao gratuita self-service: {e}")

    return SelfServiceActivationResponse(
        id=str(inserted.inserted_id),
        status=activation_doc["status"],
        chip_iccid=iccid_clean,
        plano_nome=plano["nome"] if plano else None,
        oferta_nome=oferta["nome"],
        valor_original=valor_original,
        desconto=desconto,
        valor_final=valor_final,
        billing_type=data.billing_type,
        asaas_invoice_url=activation_doc.get("asaas_invoice_url"),
        asaas_pix_code=activation_doc.get("asaas_pix_code"),
        asaas_pix_qrcode=activation_doc.get("asaas_pix_qrcode"),
        barcode=activation_doc.get("barcode"),
        message="Pagamento gerado. Apos confirmacao, seu chip sera ativado automaticamente." if activation_doc["status"] == "aguardando_pagamento" else "Ativacao em processamento.",
    )

@api_router.get("/public/ativacao/{activation_id}/status")
async def public_check_activation_status(activation_id: str):
    """Verifica status de uma ativacao self-service."""
    doc = await db.ativacoes_selfservice.find_one({"_id": ObjectId(activation_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Ativacao nao encontrada")

    # If still waiting, check Asaas
    if doc["status"] == "aguardando_pagamento" and doc.get("asaas_payment_id") and not doc["asaas_payment_id"].startswith("mock_"):
        try:
            payment = await asaas_service.get_payment(doc["asaas_payment_id"])
            asaas_status = payment.get("status", "")
            if asaas_status in ("CONFIRMED", "RECEIVED"):
                await db.ativacoes_selfservice.update_one({"_id": doc["_id"]}, {"$set": {"status": "pago"}})
                doc["status"] = "pago"
                # Trigger activation
                await _trigger_selfservice_activation(doc)
                doc = await db.ativacoes_selfservice.find_one({"_id": doc["_id"]})
        except Exception as e:
            logger.warning(f"Erro ao consultar status pagamento self-service: {e}")

    # If status is "pago" but activation was not triggered yet (e.g. free activation retry)
    if doc["status"] == "pago":
        try:
            await _trigger_selfservice_activation(doc)
            doc = await db.ativacoes_selfservice.find_one({"_id": doc["_id"]})
        except Exception as e:
            logger.warning(f"Erro ao disparar ativacao pendente: {e}")

    # If portability in progress, check with Ta Telecom
    if doc["status"] in ("portabilidade_em_andamento", "ativando") and doc.get("portability"):
        try:
            iccid = doc.get("iccid", "")
            port_result = await operadora_service.consultar_status_portabilidade(iccid, db=db)
            if port_result.success and port_result.data:
                port_data = port_result.data
                port_status = (port_data.get("status") or "").upper()
                doc["portability_status"] = port_data.get("status", "")
                doc["portability_window"] = port_data.get("janela", "")
                doc["portability_msg"] = port_data.get("msg_usuario", "")
                # If portability is concluded, update to ativo
                if "CONCLUIDA" in port_status or "CONCLUÍDA" in port_status:
                    msisdn = doc.get("port_number") or doc.get("msisdn")
                    await db.ativacoes_selfservice.update_one({"_id": doc["_id"]}, {"$set": {
                        "status": "ativo", "msisdn": msisdn,
                    }})
                    doc["status"] = "ativo"
                    doc["msisdn"] = msisdn
                    # Atualizar chip e linha para ativado
                    if doc.get("chip_id"):
                        await db.chips.update_one({"_id": ObjectId(doc["chip_id"])}, {"$set": {"status": "ativado", "msisdn": msisdn}})
                    if doc.get("chip_id"):
                        await db.linhas.update_one({"chip_id": doc["chip_id"]}, {"$set": {"status": "ativo", "msisdn": msisdn, "numero": msisdn or "Pendente"}})
        except Exception as e:
            logger.warning(f"Erro ao consultar portabilidade self-service: {e}")

    plano_nome, oferta_nome = None, None
    if doc.get("plano_id"):
        plano = await db.planos.find_one({"_id": ObjectId(doc["plano_id"])})
        if plano:
            plano_nome = plano["nome"]
    if doc.get("oferta_id"):
        oferta = await db.ofertas.find_one({"_id": ObjectId(doc["oferta_id"])})
        if oferta:
            oferta_nome = oferta["nome"]

    status_messages = {
        "aguardando_pagamento": "Aguardando confirmacao do pagamento.",
        "pago": "Pagamento confirmado! Ativando seu chip...",
        "ativando": "Ativacao em andamento na operadora...",
        "portabilidade_em_andamento": "Portabilidade solicitada! Voce recebera um SMS da sua operadora anterior para confirmar. Apos a confirmacao, a portabilidade sera agendada.",
        "ativo": "Chip ativado com sucesso!",
        "erro": "Erro na ativacao. Contate o suporte.",
    }

    return {
        "id": str(doc["_id"]),
        "status": doc["status"],
        "chip_iccid": doc.get("iccid"),
        "plano_nome": plano_nome,
        "oferta_nome": oferta_nome,
        "valor_original": doc.get("valor_original", 0),
        "desconto": doc.get("desconto", 0),
        "valor_final": doc.get("valor_final", 0),
        "billing_type": doc.get("billing_type"),
        "asaas_invoice_url": doc.get("asaas_invoice_url"),
        "asaas_pix_code": doc.get("asaas_pix_code"),
        "asaas_pix_qrcode": doc.get("asaas_pix_qrcode"),
        "barcode": doc.get("barcode"),
        "msisdn": doc.get("msisdn"),
        "portability": doc.get("portability", False),
        "portability_status": doc.get("portability_status", ""),
        "portability_window": doc.get("portability_window", ""),
        "portability_msg": doc.get("portability_msg", ""),
        "message": status_messages.get(doc["status"], ""),
    }

async def _trigger_selfservice_activation(doc: dict):
    """Dispara a ativacao na Ta Telecom apos pagamento confirmado."""
    try:
        await db.ativacoes_selfservice.update_one({"_id": doc["_id"]}, {"$set": {"status": "ativando"}})

        cliente = await db.clientes.find_one({"_id": ObjectId(doc["cliente_id"])})
        chip = await db.chips.find_one({"_id": ObjectId(doc["chip_id"])})
        oferta = await db.ofertas.find_one({"_id": ObjectId(doc["oferta_id"])})
        plano = await db.planos.find_one({"_id": ObjectId(doc["plano_id"])}) if doc.get("plano_id") else None

        if not all([cliente, chip, oferta, plano]):
            await db.ativacoes_selfservice.update_one({"_id": doc["_id"]}, {"$set": {"status": "erro", "erro_msg": "Dados incompletos para ativacao"}})
            return

        if not plano.get("plan_code"):
            await db.ativacoes_selfservice.update_one({"_id": doc["_id"]}, {"$set": {"status": "erro", "erro_msg": "Plano sem plan_code configurado"}})
            return

        telefone_clean = re.sub(r'\D', '', cliente.get("telefone", ""))
        chosen_ddd = doc.get("ddd")
        ddd = chosen_ddd if chosen_ddd and len(chosen_ddd) == 2 else (telefone_clean[:2] if len(telefone_clean) >= 2 else "11")

        # Mapear tipo_pessoa para formato Ta Telecom
        tipo_pessoa = cliente.get("tipo_pessoa", "pf")
        person_type_map = {"pf": "F", "pj": "J", "F": "F", "J": "J"}
        person_type = person_type_map.get(tipo_pessoa, "F")

        # Converter data_nascimento para dd/mm/YYYY
        raw_dob = cliente.get("data_nascimento", "")
        dob_formatted = ""
        if raw_dob:
            try:
                if "-" in raw_dob and len(raw_dob) >= 10:
                    parts = raw_dob[:10].split("-")
                    if len(parts) == 3 and len(parts[0]) == 4:
                        dob_formatted = f"{parts[2]}/{parts[1]}/{parts[0]}"
                    else:
                        dob_formatted = raw_dob
                elif "/" in raw_dob:
                    dob_formatted = raw_dob
                else:
                    dob_formatted = raw_dob
            except Exception:
                dob_formatted = raw_dob

        activation_payload = {
            "person_type": person_type,
            "person_name": cliente["nome"],
            "document_number": clean_document(cliente.get("documento", "")),
            "phone_number": telefone_clean,
            "date_of_birth": dob_formatted,
            "type_of_street": "",
            "address": cliente.get("endereco", ""),
            "address_number": cliente.get("numero_endereco", ""),
            "neighborhood": cliente.get("bairro", ""),
            "state": cliente.get("estado", ""),
            "city_code": cliente.get("city_code", ""),
            "postcode": re.sub(r'\D', '', cliente.get("cep", "")),
            "plan_code": plano["plan_code"],
            "portability": doc.get("portability", False),
            "cn_contract_line": doc.get("port_ddd") or ddd,
            "contract_line": doc.get("port_number", ""),
        }

        result = await operadora_service.ativar_chip(
            iccid=chip["iccid"],
            activation_payload=activation_payload,
            db=db, user_id="self-service", user_name="self-service"
        )

        if result.success:
            status_str = result.status if isinstance(result.status, str) else result.status.value
            is_portability = doc.get("portability", False)
            # Para portabilidade, o chip fica "reservado" ate a conclusao; para ativacao normal, se a API retornou sucesso, considerar ativado
            if status_str == "ativo" or (not is_portability and result.success):
                chip_status = ChipStatus.ativado.value
            else:
                chip_status = ChipStatus.reservado.value
            msisdn = result.numero or (result.data.get("msisdn") if result.data else None)

            await db.chips.update_one({"_id": chip["_id"]}, {"$set": {
                "status": chip_status, "cliente_id": doc["cliente_id"], "msisdn": msisdn,
            }})

            line_doc = {
                "numero": msisdn or doc.get("port_number") or "Pendente",
                "status": status_str,
                "cliente_id": doc["cliente_id"],
                "chip_id": doc["chip_id"],
                "plano_id": doc.get("plano_id"),
                "oferta_id": doc.get("oferta_id"),
                "msisdn": msisdn,
                "created_at": datetime.now(timezone.utc),
            }
            await db.linhas.insert_one(line_doc)

            is_portability = doc.get("portability", False)
            if status_str == "ativo":
                new_status = "ativo"
            elif is_portability:
                new_status = "portabilidade_em_andamento"
            else:
                new_status = "ativando"

            update_fields = {"status": new_status, "msisdn": msisdn}
            if is_portability:
                update_fields["portability_submitted_at"] = datetime.now(timezone.utc).isoformat()

            await db.ativacoes_selfservice.update_one({"_id": doc["_id"]}, {"$set": update_fields})
            await create_log("ativacao", f"Self-service {'portabilidade enviada' if is_portability else 'ativacao concluida'}: {cliente['nome']} - chip {chip['iccid']} - {msisdn or 'pendente'}", None, "self-service")
        else:
            err_msg = result.message
            if isinstance(err_msg, list):
                err_msg = "; ".join(str(m) for m in err_msg)
            await db.ativacoes_selfservice.update_one({"_id": doc["_id"]}, {"$set": {
                "status": "erro", "erro_msg": str(err_msg),
            }})
            await create_log("erro", f"Self-service ativacao falhou: {err_msg}", None, "self-service")
    except Exception as e:
        logger.error(f"Erro na ativacao self-service: {e}")
        await db.ativacoes_selfservice.update_one({"_id": doc["_id"]}, {"$set": {
            "status": "erro", "erro_msg": str(e),
        }})

@api_router.post("/public/ativacao/{activation_id}/confirmar-pagamento")
async def public_confirm_payment_manual(activation_id: str):
    """Permite confirmacao manual do pagamento (para testes ou quando webhook nao funcionar)."""
    doc = await db.ativacoes_selfservice.find_one({"_id": ObjectId(activation_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Ativacao nao encontrada")
    if doc["status"] not in ("aguardando_pagamento",):
        raise HTTPException(status_code=400, detail=f"Status atual: {doc['status']}. Nao e possivel confirmar pagamento.")

    await db.ativacoes_selfservice.update_one({"_id": doc["_id"]}, {"$set": {"status": "pago"}})
    doc["status"] = "pago"
    await _trigger_selfservice_activation(doc)

    updated = await db.ativacoes_selfservice.find_one({"_id": doc["_id"]})
    return {"success": True, "status": updated["status"], "message": "Pagamento confirmado. Ativacao em andamento."}

# --- Admin: Manage Self-Service Activations ---
@api_router.get("/ativacoes-selfservice")
async def admin_list_selfservice_activations(request: Request, status: Optional[str] = None):
    """Lista ativacoes self-service para o admin gerenciar."""
    await require_admin(request)
    query = {}
    if status:
        query["status"] = status
    docs = await db.ativacoes_selfservice.find(query).sort("created_at", -1).limit(200).to_list(200)
    result = []
    for d in docs:
        cliente_nome = None
        if d.get("cliente_id"):
            cl = await db.clientes.find_one({"_id": ObjectId(d["cliente_id"])})
            if cl:
                cliente_nome = cl["nome"]
        plano_nome = None
        if d.get("plano_id"):
            plano = await db.planos.find_one({"_id": ObjectId(d["plano_id"])})
            if plano:
                plano_nome = plano["nome"]
        oferta_nome = None
        if d.get("oferta_id"):
            oferta = await db.ofertas.find_one({"_id": ObjectId(d["oferta_id"])})
            if oferta:
                oferta_nome = oferta["nome"]
        result.append({
            "id": str(d["_id"]),
            "cliente_id": d.get("cliente_id"),
            "cliente_nome": cliente_nome,
            "iccid": d.get("iccid"),
            "plano_nome": plano_nome,
            "oferta_nome": oferta_nome,
            "valor_original": d.get("valor_original", 0),
            "desconto": d.get("desconto", 0),
            "valor_final": d.get("valor_final", 0),
            "billing_type": d.get("billing_type"),
            "status": d.get("status"),
            "msisdn": d.get("msisdn"),
            "erro_msg": d.get("erro_msg"),
            "revendedor_id": d.get("revendedor_id"),
            "created_at": d.get("created_at", datetime.now(timezone.utc)).isoformat(),
        })
    return result

@api_router.post("/ativacoes-selfservice/{activation_id}/confirmar")
async def admin_confirm_selfservice(activation_id: str, request: Request):
    """Admin confirma pagamento manualmente e dispara ativacao."""
    user = await require_admin(request)
    doc = await db.ativacoes_selfservice.find_one({"_id": ObjectId(activation_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Ativacao nao encontrada")
    if doc["status"] not in ("aguardando_pagamento",):
        raise HTTPException(status_code=400, detail=f"Status atual: {doc['status']}")

    await db.ativacoes_selfservice.update_one({"_id": doc["_id"]}, {"$set": {"status": "pago"}})
    doc["status"] = "pago"
    await _trigger_selfservice_activation(doc)

    updated = await db.ativacoes_selfservice.find_one({"_id": doc["_id"]})
    await create_log("ativacao", f"Admin confirmou pagamento self-service: {doc.get('iccid')}", user["id"], user["name"])
    return {"success": True, "status": updated["status"]}

@api_router.post("/ativacoes-selfservice/{activation_id}/cancelar")
async def admin_cancel_selfservice(activation_id: str, request: Request):
    """Admin cancela ativacao self-service e libera o chip."""
    user = await require_admin(request)
    doc = await db.ativacoes_selfservice.find_one({"_id": ObjectId(activation_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Ativacao nao encontrada")
    if doc["status"] in ("ativo",):
        raise HTTPException(status_code=400, detail="Ativacao ja foi concluida")

    # Release chip back to available
    if doc.get("chip_id"):
        await db.chips.update_one({"_id": ObjectId(doc["chip_id"])}, {"$set": {"status": "disponivel", "cliente_id": None}})

    await db.ativacoes_selfservice.update_one({"_id": doc["_id"]}, {"$set": {"status": "cancelado"}})
    await create_log("ativacao", f"Admin cancelou ativacao self-service: {doc.get('iccid')}", user["id"], user["name"])
    return {"success": True, "message": "Ativacao cancelada e chip liberado."}


# ==================== DASHBOARD STATS ====================
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(request: Request):
    await get_current_user(request)
    total_clientes = await db.clientes.count_documents({})
    clientes_ativos = await db.clientes.count_documents({"status": {"$in": ["ativo"]}})
    clientes_bloqueados = await db.clientes.count_documents({"status": {"$in": ["bloqueado", "inativo"]}})
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
        "clientes": {"total": total_clientes, "ativos": clientes_ativos, "bloqueados": clientes_bloqueados},
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
    await db.cobrancas.create_index([("cliente_id", 1)])
    await db.cobrancas.create_index([("status", 1)])
    await db.cobrancas.create_index("asaas_payment_id", sparse=True)
    await db.assinaturas.create_index([("cliente_id", 1)])
    await db.assinaturas.create_index([("status", 1)])
    await db.ativacoes_selfservice.create_index([("status", 1)])
    await db.ativacoes_selfservice.create_index([("iccid", 1)])
    await seed_admin()
    await seed_sample_data()
    # Load configs from DB (survives restarts/redeploys)
    await asaas_service.load_config_from_db(db)
    await operadora_service.load_config_from_db(db)
    # Cleanup: fix legacy lines with status "ok" -> "ativo"
    try:
        fix_result = await db.linhas.update_many({"status": "ok"}, {"$set": {"status": "ativo"}})
        if fix_result.modified_count > 0:
            logger.info(f"Startup cleanup: {fix_result.modified_count} linhas corrigidas de 'ok' para 'ativo'")
        # Cleanup: fix lines stuck as "pendente" where client is "ativo"
        active_clients = await db.clientes.find({"status": "ativo"}, {"_id": 1}).to_list(5000)
        active_ids = [str(c["_id"]) for c in active_clients]
        if active_ids:
            fix_pending = await db.linhas.update_many(
                {"status": "pendente", "cliente_id": {"$in": active_ids}},
                {"$set": {"status": "ativo"}}
            )
            if fix_pending.modified_count > 0:
                logger.info(f"Startup cleanup: {fix_pending.modified_count} linhas 'pendente' corrigidas para 'ativo' (cliente ativo)")
    except Exception as e:
        logger.warning(f"Startup cleanup error (non-fatal): {e}")
    logger.info("Application started successfully")

app.include_router(api_router)

# Download endpoint for VPS deploy package
@app.get("/download/deploy-package")
async def download_deploy_package():
    file_path = Path(__file__).parent.parent / "deploy" / "mvno-vps-deploy.tar.gz"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Pacote de deploy nao encontrado")
    return FileResponse(path=str(file_path), filename="mvno-vps-deploy.tar.gz", media_type="application/gzip")

frontend_url = os.environ.get('FRONTEND_URL', os.environ.get('CORS_ORIGINS', '*'))
if frontend_url == '*':
    origins = ["*"]
    app.add_middleware(CORSMiddleware, allow_credentials=False, allow_origins=origins, allow_methods=["*"], allow_headers=["*"])
else:
    origins = [o.strip() for o in frontend_url.split(",")]
    app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=origins, allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
