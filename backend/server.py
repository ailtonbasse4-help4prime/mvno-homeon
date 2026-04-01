from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import logging
import secrets
import bcrypt
import jwt
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from enum import Enum

# Import operadora service
from services.operadora_service import operadora_service, OperadoraStatus

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get("JWT_SECRET", secrets.token_hex(32))
JWT_ALGORITHM = "HS256"

# Create the main app
app = FastAPI(title="MVNO Management System")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ==================== ENUMS ====================
class UserRole(str, Enum):
    admin = "admin"
    atendente = "atendente"

class ClientStatus(str, Enum):
    ativo = "ativo"
    inativo = "inativo"

class ChipStatus(str, Enum):
    disponivel = "disponivel"
    reservado = "reservado"
    ativado = "ativado"
    bloqueado = "bloqueado"

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

# ==================== MODELS ====================

# User Models
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

# Client Models
class ClientCreate(BaseModel):
    nome: str
    cpf: str
    telefone: str
    status: ClientStatus = ClientStatus.ativo

class ClientResponse(BaseModel):
    id: str
    nome: str
    cpf: str
    telefone: str
    status: str
    created_at: datetime

# Plan Models (Técnico - sem valor)
class PlanCreate(BaseModel):
    nome: str
    franquia: str  # Ex: "10GB"
    descricao: Optional[str] = None

class PlanResponse(BaseModel):
    id: str
    nome: str
    franquia: str
    descricao: Optional[str] = None
    created_at: datetime

# Offer Models (Comercial - com valor)
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
    valor: float
    descricao: Optional[str] = None
    ativo: bool
    created_at: datetime

# Chip Models (com oferta_id)
class ChipCreate(BaseModel):
    iccid: str
    oferta_id: str  # Obrigatório vincular a uma oferta

class ChipResponse(BaseModel):
    id: str
    iccid: str
    status: str
    oferta_id: Optional[str] = None
    oferta_nome: Optional[str] = None
    plano_nome: Optional[str] = None
    franquia: Optional[str] = None
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
    iccid: Optional[str] = None
    created_at: datetime

# Activation Models (simplificado - apenas cliente e chip)
class ActivationRequest(BaseModel):
    cliente_id: str
    chip_id: str
    # plano_id removido - vem da oferta do chip

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
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

# ==================== JWT UTILS ====================
def get_jwt_secret() -> str:
    return JWT_SECRET

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=60),
        "type": "access"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Token inválido")
        user = await db.usuarios.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Usuário não encontrado")
        return {
            "id": str(user["_id"]),
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "created_at": user.get("created_at", datetime.now(timezone.utc))
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

async def require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado. Requer permissão de administrador.")
    return user

# ==================== LOG UTILS ====================
async def create_log(action: str, details: str, user_id: Optional[str] = None, user_name: Optional[str] = None):
    log_entry = {
        "action": action,
        "details": details,
        "user_id": user_id,
        "user_name": user_name,
        "created_at": datetime.now(timezone.utc)
    }
    await db.logs.insert_one(log_entry)

# ==================== AUTH ROUTES ====================
@api_router.post("/auth/register", response_model=UserResponse)
async def register(data: UserCreate, response: Response):
    email = data.email.lower()
    existing = await db.usuarios.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email já cadastrado")
    
    user_doc = {
        "email": email,
        "password_hash": hash_password(data.password),
        "name": data.name,
        "role": data.role.value,
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.usuarios.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    await create_log("cadastro", f"Novo usuário registrado: {email}", user_id, data.name)
    
    return UserResponse(
        id=user_id,
        email=email,
        name=data.name,
        role=data.role.value,
        created_at=user_doc["created_at"]
    )

@api_router.post("/auth/login", response_model=UserResponse)
async def login(data: UserLogin, response: Response, request: Request):
    email = data.email.lower()
    
    # Check brute force
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
            {
                "$inc": {"count": 1},
                "$set": {"lockout_until": datetime.now(timezone.utc) + timedelta(minutes=15)}
            },
            upsert=True
        )
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    
    await db.login_attempts.delete_one({"identifier": identifier})
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    await create_log("login", f"Login realizado: {email}", user_id, user["name"])
    
    return UserResponse(
        id=user_id,
        email=user["email"],
        name=user["name"],
        role=user["role"],
        created_at=user.get("created_at", datetime.now(timezone.utc))
    )

@api_router.post("/auth/logout")
async def logout(response: Response, request: Request):
    user = None
    try:
        user = await get_current_user(request)
    except:
        pass
    
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    
    if user:
        await create_log("logout", f"Logout realizado: {user['email']}", user['id'], user['name'])
    
    return {"message": "Logout realizado com sucesso"}

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(request: Request):
    user = await get_current_user(request)
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        role=user["role"],
        created_at=user["created_at"]
    )

@api_router.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Refresh token não encontrado")
    
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Token inválido")
        
        user = await db.usuarios.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Usuário não encontrado")
        
        user_id = str(user["_id"])
        access_token = create_access_token(user_id, user["email"])
        
        response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
        
        return {"message": "Token renovado com sucesso"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

# ==================== CLIENTS ROUTES ====================
@api_router.get("/clientes", response_model=List[ClientResponse])
async def list_clients(request: Request, search: Optional[str] = None):
    await get_current_user(request)
    
    query = {}
    if search:
        query = {
            "$or": [
                {"nome": {"$regex": search, "$options": "i"}},
                {"cpf": {"$regex": search, "$options": "i"}},
                {"telefone": {"$regex": search, "$options": "i"}}
            ]
        }
    
    clients = await db.clientes.find(query).to_list(1000)
    
    return [
        ClientResponse(
            id=str(c["_id"]),
            nome=c["nome"],
            cpf=c["cpf"],
            telefone=c["telefone"],
            status=c["status"],
            created_at=c.get("created_at", datetime.now(timezone.utc))
        ) for c in clients
    ]

@api_router.post("/clientes", response_model=ClientResponse)
async def create_client(data: ClientCreate, request: Request):
    user = await get_current_user(request)
    
    existing = await db.clientes.find_one({"cpf": data.cpf})
    if existing:
        raise HTTPException(status_code=400, detail="CPF já cadastrado")
    
    client_doc = {
        "nome": data.nome,
        "cpf": data.cpf,
        "telefone": data.telefone,
        "status": data.status.value,
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.clientes.insert_one(client_doc)
    
    await create_log("cadastro", f"Cliente cadastrado: {data.nome} - CPF: {data.cpf}", user["id"], user["name"])
    
    return ClientResponse(
        id=str(result.inserted_id),
        nome=data.nome,
        cpf=data.cpf,
        telefone=data.telefone,
        status=data.status.value,
        created_at=client_doc["created_at"]
    )

@api_router.get("/clientes/{client_id}", response_model=ClientResponse)
async def get_client(client_id: str, request: Request):
    await get_current_user(request)
    
    client = await db.clientes.find_one({"_id": ObjectId(client_id)})
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    
    return ClientResponse(
        id=str(client["_id"]),
        nome=client["nome"],
        cpf=client["cpf"],
        telefone=client["telefone"],
        status=client["status"],
        created_at=client.get("created_at", datetime.now(timezone.utc))
    )

@api_router.put("/clientes/{client_id}", response_model=ClientResponse)
async def update_client(client_id: str, data: ClientCreate, request: Request):
    user = await get_current_user(request)
    
    client = await db.clientes.find_one({"_id": ObjectId(client_id)})
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    
    existing = await db.clientes.find_one({"cpf": data.cpf, "_id": {"$ne": ObjectId(client_id)}})
    if existing:
        raise HTTPException(status_code=400, detail="CPF já cadastrado para outro cliente")
    
    await db.clientes.update_one(
        {"_id": ObjectId(client_id)},
        {"$set": {
            "nome": data.nome,
            "cpf": data.cpf,
            "telefone": data.telefone,
            "status": data.status.value
        }}
    )
    
    await create_log("cadastro", f"Cliente atualizado: {data.nome}", user["id"], user["name"])
    
    return ClientResponse(
        id=client_id,
        nome=data.nome,
        cpf=data.cpf,
        telefone=data.telefone,
        status=data.status.value,
        created_at=client.get("created_at", datetime.now(timezone.utc))
    )

@api_router.delete("/clientes/{client_id}")
async def delete_client(client_id: str, request: Request):
    user = await require_admin(request)
    
    client = await db.clientes.find_one({"_id": ObjectId(client_id)})
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    
    await db.clientes.delete_one({"_id": ObjectId(client_id)})
    await create_log("cadastro", f"Cliente removido: {client['nome']}", user["id"], user["name"])
    
    return {"message": "Cliente removido com sucesso"}

# ==================== PLANS ROUTES (Técnico - sem valor) ====================
@api_router.get("/planos", response_model=List[PlanResponse])
async def list_plans(request: Request):
    await get_current_user(request)
    
    plans = await db.planos.find({}).to_list(1000)
    
    return [
        PlanResponse(
            id=str(p["_id"]),
            nome=p["nome"],
            franquia=p["franquia"],
            descricao=p.get("descricao"),
            created_at=p.get("created_at", datetime.now(timezone.utc))
        ) for p in plans
    ]

@api_router.post("/planos", response_model=PlanResponse)
async def create_plan(data: PlanCreate, request: Request):
    user = await require_admin(request)
    
    plan_doc = {
        "nome": data.nome,
        "franquia": data.franquia,
        "descricao": data.descricao,
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.planos.insert_one(plan_doc)
    
    await create_log("cadastro", f"Plano técnico cadastrado: {data.nome} ({data.franquia})", user["id"], user["name"])
    
    return PlanResponse(
        id=str(result.inserted_id),
        nome=data.nome,
        franquia=data.franquia,
        descricao=data.descricao,
        created_at=plan_doc["created_at"]
    )

@api_router.put("/planos/{plan_id}", response_model=PlanResponse)
async def update_plan(plan_id: str, data: PlanCreate, request: Request):
    user = await require_admin(request)
    
    plan = await db.planos.find_one({"_id": ObjectId(plan_id)})
    if not plan:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    
    await db.planos.update_one(
        {"_id": ObjectId(plan_id)},
        {"$set": {
            "nome": data.nome,
            "franquia": data.franquia,
            "descricao": data.descricao
        }}
    )
    
    await create_log("cadastro", f"Plano técnico atualizado: {data.nome}", user["id"], user["name"])
    
    return PlanResponse(
        id=plan_id,
        nome=data.nome,
        franquia=data.franquia,
        descricao=data.descricao,
        created_at=plan.get("created_at", datetime.now(timezone.utc))
    )

@api_router.delete("/planos/{plan_id}")
async def delete_plan(plan_id: str, request: Request):
    user = await require_admin(request)
    
    plan = await db.planos.find_one({"_id": ObjectId(plan_id)})
    if not plan:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    
    # Check if plan is in use by any offer
    offer_using = await db.ofertas.find_one({"plano_id": plan_id})
    if offer_using:
        raise HTTPException(status_code=400, detail="Plano está vinculado a ofertas e não pode ser removido")
    
    await db.planos.delete_one({"_id": ObjectId(plan_id)})
    await create_log("cadastro", f"Plano técnico removido: {plan['nome']}", user["id"], user["name"])
    
    return {"message": "Plano removido com sucesso"}

# ==================== OFFERS ROUTES (Comercial - com valor) ====================
@api_router.get("/ofertas", response_model=List[OfferResponse])
async def list_offers(request: Request, ativo: Optional[bool] = None):
    await get_current_user(request)
    
    query = {}
    if ativo is not None:
        query["ativo"] = ativo
    
    offers = await db.ofertas.find(query).to_list(1000)
    
    result = []
    for o in offers:
        plano_nome = None
        franquia = None
        if o.get("plano_id"):
            plano = await db.planos.find_one({"_id": ObjectId(o["plano_id"])})
            if plano:
                plano_nome = plano["nome"]
                franquia = plano["franquia"]
        
        result.append(OfferResponse(
            id=str(o["_id"]),
            nome=o["nome"],
            plano_id=o["plano_id"],
            plano_nome=plano_nome,
            franquia=franquia,
            valor=o["valor"],
            descricao=o.get("descricao"),
            ativo=o.get("ativo", True),
            created_at=o.get("created_at", datetime.now(timezone.utc))
        ))
    
    return result

@api_router.get("/ofertas/{offer_id}", response_model=OfferResponse)
async def get_offer(offer_id: str, request: Request):
    await get_current_user(request)
    
    offer = await db.ofertas.find_one({"_id": ObjectId(offer_id)})
    if not offer:
        raise HTTPException(status_code=404, detail="Oferta não encontrada")
    
    plano_nome = None
    franquia = None
    if offer.get("plano_id"):
        plano = await db.planos.find_one({"_id": ObjectId(offer["plano_id"])})
        if plano:
            plano_nome = plano["nome"]
            franquia = plano["franquia"]
    
    return OfferResponse(
        id=str(offer["_id"]),
        nome=offer["nome"],
        plano_id=offer["plano_id"],
        plano_nome=plano_nome,
        franquia=franquia,
        valor=offer["valor"],
        descricao=offer.get("descricao"),
        ativo=offer.get("ativo", True),
        created_at=offer.get("created_at", datetime.now(timezone.utc))
    )

@api_router.post("/ofertas", response_model=OfferResponse)
async def create_offer(data: OfferCreate, request: Request):
    user = await require_admin(request)
    
    # Validate plano exists
    plano = await db.planos.find_one({"_id": ObjectId(data.plano_id)})
    if not plano:
        raise HTTPException(status_code=400, detail="Plano não encontrado")
    
    offer_doc = {
        "nome": data.nome,
        "plano_id": data.plano_id,
        "valor": data.valor,
        "descricao": data.descricao,
        "ativo": data.ativo,
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.ofertas.insert_one(offer_doc)
    
    await create_log("cadastro", f"Oferta cadastrada: {data.nome} - R$ {data.valor:.2f}", user["id"], user["name"])
    
    return OfferResponse(
        id=str(result.inserted_id),
        nome=data.nome,
        plano_id=data.plano_id,
        plano_nome=plano["nome"],
        franquia=plano["franquia"],
        valor=data.valor,
        descricao=data.descricao,
        ativo=data.ativo,
        created_at=offer_doc["created_at"]
    )

@api_router.put("/ofertas/{offer_id}", response_model=OfferResponse)
async def update_offer(offer_id: str, data: OfferCreate, request: Request):
    user = await require_admin(request)
    
    offer = await db.ofertas.find_one({"_id": ObjectId(offer_id)})
    if not offer:
        raise HTTPException(status_code=404, detail="Oferta não encontrada")
    
    # Validate plano exists
    plano = await db.planos.find_one({"_id": ObjectId(data.plano_id)})
    if not plano:
        raise HTTPException(status_code=400, detail="Plano não encontrado")
    
    await db.ofertas.update_one(
        {"_id": ObjectId(offer_id)},
        {"$set": {
            "nome": data.nome,
            "plano_id": data.plano_id,
            "valor": data.valor,
            "descricao": data.descricao,
            "ativo": data.ativo
        }}
    )
    
    await create_log("cadastro", f"Oferta atualizada: {data.nome}", user["id"], user["name"])
    
    return OfferResponse(
        id=offer_id,
        nome=data.nome,
        plano_id=data.plano_id,
        plano_nome=plano["nome"],
        franquia=plano["franquia"],
        valor=data.valor,
        descricao=data.descricao,
        ativo=data.ativo,
        created_at=offer.get("created_at", datetime.now(timezone.utc))
    )

@api_router.delete("/ofertas/{offer_id}")
async def delete_offer(offer_id: str, request: Request):
    user = await require_admin(request)
    
    offer = await db.ofertas.find_one({"_id": ObjectId(offer_id)})
    if not offer:
        raise HTTPException(status_code=404, detail="Oferta não encontrada")
    
    # Check if offer is in use by any chip
    chip_using = await db.chips.find_one({"oferta_id": offer_id})
    if chip_using:
        raise HTTPException(status_code=400, detail="Oferta está vinculada a chips e não pode ser removida")
    
    await db.ofertas.delete_one({"_id": ObjectId(offer_id)})
    await create_log("cadastro", f"Oferta removida: {offer['nome']}", user["id"], user["name"])
    
    return {"message": "Oferta removida com sucesso"}

# ==================== CHIPS ROUTES (com oferta_id) ====================
@api_router.get("/chips", response_model=List[ChipResponse])
async def list_chips(request: Request, status: Optional[str] = None, oferta_id: Optional[str] = None):
    await get_current_user(request)
    
    query = {}
    if status:
        query["status"] = status
    if oferta_id:
        query["oferta_id"] = oferta_id
    
    chips = await db.chips.find(query).to_list(1000)
    
    result = []
    for chip in chips:
        cliente_nome = None
        oferta_nome = None
        plano_nome = None
        franquia = None
        valor = None
        
        if chip.get("cliente_id"):
            cliente = await db.clientes.find_one({"_id": ObjectId(chip["cliente_id"])})
            if cliente:
                cliente_nome = cliente["nome"]
        
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
        
        result.append(ChipResponse(
            id=str(chip["_id"]),
            iccid=chip["iccid"],
            status=chip["status"],
            oferta_id=chip.get("oferta_id"),
            oferta_nome=oferta_nome,
            plano_nome=plano_nome,
            franquia=franquia,
            valor=valor,
            cliente_id=chip.get("cliente_id"),
            cliente_nome=cliente_nome,
            created_at=chip.get("created_at", datetime.now(timezone.utc))
        ))
    
    return result

@api_router.post("/chips", response_model=ChipResponse)
async def create_chip(data: ChipCreate, request: Request):
    user = await get_current_user(request)
    
    # Validate ICCID unique
    existing = await db.chips.find_one({"iccid": data.iccid})
    if existing:
        raise HTTPException(status_code=400, detail="ICCID já cadastrado")
    
    # Validate offer exists
    oferta = await db.ofertas.find_one({"_id": ObjectId(data.oferta_id)})
    if not oferta:
        raise HTTPException(status_code=400, detail="Oferta não encontrada")
    
    if not oferta.get("ativo", True):
        raise HTTPException(status_code=400, detail="Oferta não está ativa")
    
    chip_doc = {
        "iccid": data.iccid,
        "status": ChipStatus.disponivel.value,
        "oferta_id": data.oferta_id,
        "cliente_id": None,
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.chips.insert_one(chip_doc)
    
    # Get offer and plan info
    plano_nome = None
    franquia = None
    if oferta.get("plano_id"):
        plano = await db.planos.find_one({"_id": ObjectId(oferta["plano_id"])})
        if plano:
            plano_nome = plano["nome"]
            franquia = plano["franquia"]
    
    await create_log("cadastro", f"Chip cadastrado: {data.iccid} - Oferta: {oferta['nome']}", user["id"], user["name"])
    
    return ChipResponse(
        id=str(result.inserted_id),
        iccid=data.iccid,
        status=ChipStatus.disponivel.value,
        oferta_id=data.oferta_id,
        oferta_nome=oferta["nome"],
        plano_nome=plano_nome,
        franquia=franquia,
        valor=oferta["valor"],
        cliente_id=None,
        cliente_nome=None,
        created_at=chip_doc["created_at"]
    )

@api_router.delete("/chips/{chip_id}")
async def delete_chip(chip_id: str, request: Request):
    user = await require_admin(request)
    
    chip = await db.chips.find_one({"_id": ObjectId(chip_id)})
    if not chip:
        raise HTTPException(status_code=404, detail="Chip não encontrado")
    
    if chip["status"] == ChipStatus.ativado.value:
        raise HTTPException(status_code=400, detail="Não é possível remover um chip ativado")
    
    await db.chips.delete_one({"_id": ObjectId(chip_id)})
    await create_log("cadastro", f"Chip removido: {chip['iccid']}", user["id"], user["name"])
    
    return {"message": "Chip removido com sucesso"}

# ==================== ACTIVATION ROUTES ====================
@api_router.post("/ativacao", response_model=ActivationResponse)
async def activate_line(data: ActivationRequest, request: Request):
    user = await get_current_user(request)
    
    # Get client
    cliente = await db.clientes.find_one({"_id": ObjectId(data.cliente_id)})
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    
    if cliente["status"] != ClientStatus.ativo.value:
        raise HTTPException(status_code=400, detail="Cliente não está ativo")
    
    # Get chip
    chip = await db.chips.find_one({"_id": ObjectId(data.chip_id)})
    if not chip:
        raise HTTPException(status_code=404, detail="Chip não encontrado")
    
    if chip["status"] != ChipStatus.disponivel.value:
        status_msg = {
            ChipStatus.ativado.value: "Chip já está ativado",
            ChipStatus.bloqueado.value: "Chip está bloqueado",
            ChipStatus.reservado.value: "Chip está reservado"
        }
        raise HTTPException(status_code=400, detail=status_msg.get(chip["status"], f"Chip com status inválido: {chip['status']}"))
    
    # Get offer from chip
    if not chip.get("oferta_id"):
        raise HTTPException(status_code=400, detail="Chip não possui oferta vinculada")
    
    oferta = await db.ofertas.find_one({"_id": ObjectId(chip["oferta_id"])})
    if not oferta:
        raise HTTPException(status_code=400, detail="Oferta do chip não encontrada")
    
    if not oferta.get("ativo", True):
        raise HTTPException(status_code=400, detail="Oferta do chip não está ativa")
    
    # Get plan from offer
    if not oferta.get("plano_id"):
        raise HTTPException(status_code=400, detail="Oferta não possui plano vinculado")
    
    plano = await db.planos.find_one({"_id": ObjectId(oferta["plano_id"])})
    if not plano:
        raise HTTPException(status_code=400, detail="Plano da oferta não encontrado")
    
    # Call operadora service
    result = await operadora_service.ativar_chip(
        cpf=cliente["cpf"],
        nome=cliente["nome"],
        iccid=chip["iccid"],
        plano=plano["nome"],
        plano_id=oferta["plano_id"],
        telefone=cliente.get("telefone"),
        db=db,
        user_id=user["id"],
        user_name=user["name"]
    )
    
    if result.success:
        # Update chip status
        if result.status == OperadoraStatus.ATIVO or result.status == "ativo":
            chip_status = ChipStatus.ativado.value
        elif result.status == OperadoraStatus.BLOQUEADO or result.status == "bloqueado":
            chip_status = ChipStatus.bloqueado.value
        else:
            chip_status = ChipStatus.ativado.value
        
        await db.chips.update_one(
            {"_id": ObjectId(data.chip_id)},
            {"$set": {
                "status": chip_status,
                "cliente_id": data.cliente_id
            }}
        )
        
        # Create line
        line_status = result.status
        if hasattr(result.status, 'value'):
            line_status = result.status.value
        
        line_doc = {
            "numero": result.numero or "Pendente",
            "status": line_status,
            "cliente_id": data.cliente_id,
            "chip_id": data.chip_id,
            "plano_id": oferta["plano_id"],
            "oferta_id": chip["oferta_id"],
            "created_at": datetime.now(timezone.utc)
        }
        await db.linhas.insert_one(line_doc)
    
    return ActivationResponse(
        success=result.success,
        status=result.status if isinstance(result.status, str) else result.status.value,
        message=result.message,
        numero=result.numero,
        oferta_nome=oferta["nome"],
        plano_nome=plano["nome"],
        franquia=plano["franquia"],
        valor=oferta["valor"],
        response_time_ms=result.response_time_ms
    )

# ==================== LINES ROUTES ====================
@api_router.get("/linhas", response_model=List[LineResponse])
async def list_lines(request: Request, status: Optional[str] = None):
    await get_current_user(request)
    
    query = {}
    if status:
        query["status"] = status
    
    lines = await db.linhas.find(query).to_list(1000)
    
    result = []
    for line in lines:
        cliente_nome = None
        plano_nome = None
        oferta_nome = None
        franquia = None
        iccid = None
        
        if line.get("cliente_id"):
            cliente = await db.clientes.find_one({"_id": ObjectId(line["cliente_id"])})
            if cliente:
                cliente_nome = cliente["nome"]
        
        if line.get("plano_id"):
            plano = await db.planos.find_one({"_id": ObjectId(line["plano_id"])})
            if plano:
                plano_nome = plano["nome"]
                franquia = plano["franquia"]
        
        if line.get("oferta_id"):
            oferta = await db.ofertas.find_one({"_id": ObjectId(line["oferta_id"])})
            if oferta:
                oferta_nome = oferta["nome"]
        
        if line.get("chip_id"):
            chip = await db.chips.find_one({"_id": ObjectId(line["chip_id"])})
            if chip:
                iccid = chip["iccid"]
        
        result.append(LineResponse(
            id=str(line["_id"]),
            numero=line["numero"],
            status=line["status"],
            cliente_id=line["cliente_id"],
            chip_id=line["chip_id"],
            plano_id=line["plano_id"],
            oferta_id=line.get("oferta_id"),
            cliente_nome=cliente_nome,
            plano_nome=plano_nome,
            oferta_nome=oferta_nome,
            franquia=franquia,
            iccid=iccid,
            created_at=line.get("created_at", datetime.now(timezone.utc))
        ))
    
    return result

@api_router.get("/linhas/{line_id}/status")
async def get_line_status(line_id: str, request: Request):
    user = await get_current_user(request)
    
    line = await db.linhas.find_one({"_id": ObjectId(line_id)})
    if not line:
        raise HTTPException(status_code=404, detail="Linha não encontrada")
    
    result = await operadora_service.consultar_linha(
        numero=line["numero"],
        db=db,
        user_id=user["id"],
        user_name=user["name"]
    )
    
    return {
        "success": result.success,
        "numero": result.numero,
        "status": result.status if isinstance(result.status, str) else result.status.value,
        "saldo_dados": result.data.get("saldo_dados") if result.data else None,
        "validade": result.data.get("validade") if result.data else None,
        "response_time_ms": result.response_time_ms
    }

@api_router.post("/linhas/{line_id}/bloquear")
async def block_line(line_id: str, request: Request):
    user = await get_current_user(request)
    
    line = await db.linhas.find_one({"_id": ObjectId(line_id)})
    if not line:
        raise HTTPException(status_code=404, detail="Linha não encontrada")
    
    if line["status"] == LineStatus.bloqueado.value:
        raise HTTPException(status_code=400, detail="Linha já está bloqueada")
    
    result = await operadora_service.bloquear_linha(
        numero=line["numero"],
        db=db,
        user_id=user["id"],
        user_name=user["name"]
    )
    
    if result.success:
        await db.linhas.update_one(
            {"_id": ObjectId(line_id)},
            {"$set": {"status": LineStatus.bloqueado.value}}
        )
        
        await db.chips.update_one(
            {"_id": ObjectId(line["chip_id"])},
            {"$set": {"status": ChipStatus.bloqueado.value}}
        )
    
    return {
        "success": result.success,
        "message": result.message,
        "status": result.status if isinstance(result.status, str) else result.status.value,
        "response_time_ms": result.response_time_ms
    }

@api_router.post("/linhas/{line_id}/desbloquear")
async def unblock_line(line_id: str, request: Request):
    user = await get_current_user(request)
    
    line = await db.linhas.find_one({"_id": ObjectId(line_id)})
    if not line:
        raise HTTPException(status_code=404, detail="Linha não encontrada")
    
    if line["status"] != LineStatus.bloqueado.value:
        raise HTTPException(status_code=400, detail="Linha não está bloqueada")
    
    result = await operadora_service.desbloquear_linha(
        numero=line["numero"],
        db=db,
        user_id=user["id"],
        user_name=user["name"]
    )
    
    if result.success:
        await db.linhas.update_one(
            {"_id": ObjectId(line_id)},
            {"$set": {"status": LineStatus.ativo.value}}
        )
        
        await db.chips.update_one(
            {"_id": ObjectId(line["chip_id"])},
            {"$set": {"status": ChipStatus.ativado.value}}
        )
    
    return {
        "success": result.success,
        "message": result.message,
        "status": result.status if isinstance(result.status, str) else result.status.value,
        "response_time_ms": result.response_time_ms
    }

# ==================== LOGS ROUTES ====================
@api_router.get("/logs", response_model=List[LogEntry])
async def list_logs(request: Request, action: Optional[str] = None, limit: int = 100):
    await get_current_user(request)
    
    query = {}
    if action:
        query["action"] = action
    
    logs = await db.logs.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    
    return [
        LogEntry(
            id=str(log["_id"]),
            action=log["action"],
            details=log["details"],
            user_id=log.get("user_id"),
            user_name=log.get("user_name"),
            created_at=log.get("created_at", datetime.now(timezone.utc)),
            api_request=log.get("api_request"),
            api_response=log.get("api_response"),
            is_mock=log.get("is_mock")
        ) for log in logs
    ]

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
    chips_reservados = await db.chips.count_documents({"status": "reservado"})
    
    total_linhas = await db.linhas.count_documents({})
    linhas_ativas = await db.linhas.count_documents({"status": "ativo"})
    linhas_pendentes = await db.linhas.count_documents({"status": "pendente"})
    linhas_bloqueadas = await db.linhas.count_documents({"status": "bloqueado"})
    
    total_planos = await db.planos.count_documents({})
    total_ofertas = await db.ofertas.count_documents({})
    ofertas_ativas = await db.ofertas.count_documents({"ativo": True})
    
    # Recent logs
    recent_logs = await db.logs.find({}).sort("created_at", -1).limit(5).to_list(5)
    
    return {
        "clientes": {
            "total": total_clientes,
            "ativos": clientes_ativos
        },
        "chips": {
            "total": total_chips,
            "disponiveis": chips_disponiveis,
            "ativados": chips_ativados,
            "bloqueados": chips_bloqueados,
            "reservados": chips_reservados
        },
        "linhas": {
            "total": total_linhas,
            "ativas": linhas_ativas,
            "pendentes": linhas_pendentes,
            "bloqueadas": linhas_bloqueadas
        },
        "planos": {
            "total": total_planos
        },
        "ofertas": {
            "total": total_ofertas,
            "ativas": ofertas_ativas
        },
        "recent_logs": [
            {
                "id": str(log["_id"]),
                "action": log["action"],
                "details": log["details"],
                "created_at": log.get("created_at", datetime.now(timezone.utc)).isoformat()
            } for log in recent_logs
        ]
    }

# ==================== OPERADORA CONFIG ====================
@api_router.get("/operadora/config")
async def get_operadora_config(request: Request):
    await require_admin(request)
    return operadora_service.get_config_status()

@api_router.post("/operadora/test")
async def test_operadora_connection(request: Request):
    user = await require_admin(request)
    
    test_numero = "11999999999"
    result = await operadora_service.consultar_linha(
        numero=test_numero,
        db=db,
        user_id=user["id"],
        user_name=user["name"]
    )
    
    return {
        "mode": "mock" if operadora_service.use_mock else "real",
        "test_success": result.success,
        "response_time_ms": result.response_time_ms,
        "message": result.message if result.success else f"Erro: {result.message}",
        "error_code": result.error_code
    }

# ==================== SEED DATA ====================
async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@mvno.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    
    existing = await db.usuarios.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.usuarios.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "name": "Administrador",
            "role": "admin",
            "created_at": datetime.now(timezone.utc)
        })
        logger.info(f"Admin user created: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.usuarios.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )
        logger.info(f"Admin password updated: {admin_email}")
    
    # Write test credentials
    memory_dir = Path("/app/memory")
    memory_dir.mkdir(exist_ok=True)
    with open(memory_dir / "test_credentials.md", "w") as f:
        f.write(f"""# Test Credentials

## Admin User
- Email: {admin_email}
- Password: {admin_password}
- Role: admin
""")

async def seed_sample_data():
    """Seed sample data for testing with new structure"""
    
    # Check if data already exists
    existing_plans = await db.planos.count_documents({})
    if existing_plans > 0:
        return
    
    # Create sample plans (técnico - sem valor)
    plans = [
        {"nome": "Plano 5GB", "franquia": "5GB", "descricao": "Plano básico com 5GB de dados", "created_at": datetime.now(timezone.utc)},
        {"nome": "Plano 10GB", "franquia": "10GB", "descricao": "Plano essencial com 10GB de dados", "created_at": datetime.now(timezone.utc)},
        {"nome": "Plano 20GB", "franquia": "20GB", "descricao": "Plano plus com 20GB de dados", "created_at": datetime.now(timezone.utc)},
        {"nome": "Plano 50GB", "franquia": "50GB", "descricao": "Plano premium com 50GB de dados", "created_at": datetime.now(timezone.utc)},
    ]
    result = await db.planos.insert_many(plans)
    plan_ids = [str(id) for id in result.inserted_ids]
    
    # Create sample offers (comercial - com valor)
    offers = [
        {"nome": "Chip 5GB Básico", "plano_id": plan_ids[0], "valor": 29.90, "descricao": "Oferta básica", "ativo": True, "created_at": datetime.now(timezone.utc)},
        {"nome": "Chip 10GB Essencial", "plano_id": plan_ids[1], "valor": 49.90, "descricao": "Oferta essencial", "ativo": True, "created_at": datetime.now(timezone.utc)},
        {"nome": "Chip 20GB Plus", "plano_id": plan_ids[2], "valor": 79.90, "descricao": "Oferta plus", "ativo": True, "created_at": datetime.now(timezone.utc)},
        {"nome": "Chip 50GB Premium", "plano_id": plan_ids[3], "valor": 119.90, "descricao": "Oferta premium", "ativo": True, "created_at": datetime.now(timezone.utc)},
    ]
    result = await db.ofertas.insert_many(offers)
    offer_ids = [str(id) for id in result.inserted_ids]
    
    # Create sample clients
    clients = [
        {"nome": "João Silva", "cpf": "123.456.789-00", "telefone": "(11) 98765-4321", "status": "ativo", "created_at": datetime.now(timezone.utc)},
        {"nome": "Maria Santos", "cpf": "987.654.321-00", "telefone": "(11) 91234-5678", "status": "ativo", "created_at": datetime.now(timezone.utc)},
        {"nome": "Pedro Oliveira", "cpf": "456.789.123-00", "telefone": "(21) 99876-5432", "status": "ativo", "created_at": datetime.now(timezone.utc)},
        {"nome": "Ana Costa", "cpf": "789.123.456-00", "telefone": "(31) 98765-1234", "status": "inativo", "created_at": datetime.now(timezone.utc)},
    ]
    await db.clientes.insert_many(clients)
    
    # Create sample chips (vinculados às ofertas)
    chips = [
        {"iccid": "8955010012345678901", "status": "disponivel", "oferta_id": offer_ids[0], "cliente_id": None, "created_at": datetime.now(timezone.utc)},
        {"iccid": "8955010012345678902", "status": "disponivel", "oferta_id": offer_ids[1], "cliente_id": None, "created_at": datetime.now(timezone.utc)},
        {"iccid": "8955010012345678903", "status": "disponivel", "oferta_id": offer_ids[2], "cliente_id": None, "created_at": datetime.now(timezone.utc)},
        {"iccid": "8955010012345678904", "status": "disponivel", "oferta_id": offer_ids[3], "cliente_id": None, "created_at": datetime.now(timezone.utc)},
        {"iccid": "8955010012345678905", "status": "disponivel", "oferta_id": offer_ids[0], "cliente_id": None, "created_at": datetime.now(timezone.utc)},
    ]
    await db.chips.insert_many(chips)
    
    logger.info("Sample data seeded successfully with new structure")

@app.on_event("startup")
async def startup_event():
    # Create indexes
    await db.usuarios.create_index("email", unique=True)
    await db.clientes.create_index("cpf", unique=True)
    await db.chips.create_index("iccid", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.logs.create_index([("created_at", -1)])
    
    # Seed admin
    await seed_admin()
    
    # Seed sample data
    await seed_sample_data()
    
    logger.info("Application started successfully")

# Include the router in the main app
app.include_router(api_router)

# CORS configuration
frontend_url = os.environ.get('FRONTEND_URL', os.environ.get('CORS_ORIGINS', '*'))
origins = [frontend_url] if frontend_url != '*' else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
