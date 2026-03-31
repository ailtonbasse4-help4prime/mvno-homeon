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
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from enum import Enum

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
    ativado = "ativado"
    bloqueado = "bloqueado"

class LineStatus(str, Enum):
    ativo = "ativo"
    bloqueado = "bloqueado"
    pendente = "pendente"

class LogAction(str, Enum):
    ativacao = "ativacao"
    bloqueio = "bloqueio"
    desbloqueio = "desbloqueio"
    erro = "erro"
    login = "login"
    logout = "logout"
    cadastro = "cadastro"

# ==================== MODELS ====================
class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: UserRole = UserRole.atendente

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

class ClientBase(BaseModel):
    nome: str
    cpf: str
    telefone: str
    status: ClientStatus = ClientStatus.ativo

class ClientCreate(ClientBase):
    pass

class ClientResponse(ClientBase):
    id: str
    created_at: datetime

class ChipBase(BaseModel):
    iccid: str
    status: ChipStatus = ChipStatus.disponivel
    cliente_id: Optional[str] = None

class ChipCreate(BaseModel):
    iccid: str

class ChipResponse(ChipBase):
    id: str
    created_at: datetime
    cliente_nome: Optional[str] = None

class PlanBase(BaseModel):
    nome: str
    valor: float
    franquia: str  # Ex: "10GB"

class PlanCreate(PlanBase):
    pass

class PlanResponse(PlanBase):
    id: str
    created_at: datetime

class LineBase(BaseModel):
    numero: str
    status: LineStatus = LineStatus.pendente
    cliente_id: str
    chip_id: str
    plano_id: str

class LineResponse(LineBase):
    id: str
    created_at: datetime
    cliente_nome: Optional[str] = None
    plano_nome: Optional[str] = None
    iccid: Optional[str] = None

class ActivationRequest(BaseModel):
    cliente_id: str
    chip_id: str
    plano_id: str

class ActivationResponse(BaseModel):
    success: bool
    status: str
    message: str
    numero: Optional[str] = None

class LogEntry(BaseModel):
    id: str
    action: str
    details: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    created_at: datetime

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

# ==================== MOCK OPERADORA API ====================
class MockOperadoraAPI:
    """Mock da API da operadora (Surf Telecom) para simulação"""
    
    @staticmethod
    async def ativar_chip(cpf: str, nome: str, iccid: str, plano: str) -> dict:
        """Simula ativação de chip na operadora"""
        import random
        
        # Simula diferentes cenários (70% sucesso, 20% pendente, 10% erro)
        scenario = random.choices(
            ["sucesso", "pendente", "erro"],
            weights=[70, 20, 10],
            k=1
        )[0]
        
        if scenario == "sucesso":
            numero = f"11{random.randint(900000000, 999999999)}"
            return {
                "success": True,
                "status": "ativo",
                "message": "Chip ativado com sucesso",
                "numero": numero
            }
        elif scenario == "pendente":
            return {
                "success": True,
                "status": "pendente",
                "message": "Ativação em processamento. Aguarde até 24h.",
                "numero": None
            }
        else:
            return {
                "success": False,
                "status": "erro",
                "message": "Falha na comunicação com a operadora",
                "numero": None
            }
    
    @staticmethod
    async def consultar_status(numero: str) -> dict:
        """Consulta status da linha na operadora"""
        return {
            "success": True,
            "numero": numero,
            "status": "ativo",
            "saldo_dados": "5.2GB",
            "validade": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        }
    
    @staticmethod
    async def bloquear_linha(numero: str) -> dict:
        """Bloqueia linha na operadora"""
        return {
            "success": True,
            "message": "Linha bloqueada com sucesso",
            "status": "bloqueado"
        }
    
    @staticmethod
    async def desbloquear_linha(numero: str) -> dict:
        """Desbloqueia linha na operadora"""
        return {
            "success": True,
            "message": "Linha desbloqueada com sucesso",
            "status": "ativo"
        }

mock_api = MockOperadoraAPI()

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
        # Increment failed attempts
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {
                "$inc": {"count": 1},
                "$set": {"lockout_until": datetime.now(timezone.utc) + timedelta(minutes=15)}
            },
            upsert=True
        )
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    
    # Clear failed attempts on success
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
    
    clients = await db.clientes.find(query, {"_id": 1, "nome": 1, "cpf": 1, "telefone": 1, "status": 1, "created_at": 1}).to_list(1000)
    
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
    
    # Check if CPF already exists
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
        status=data.status,
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
    
    # Check if CPF already exists for another client
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
        status=data.status,
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

# ==================== CHIPS ROUTES ====================
@api_router.get("/chips", response_model=List[ChipResponse])
async def list_chips(request: Request, status: Optional[str] = None):
    await get_current_user(request)
    
    query = {}
    if status:
        query["status"] = status
    
    chips = await db.chips.find(query).to_list(1000)
    
    result = []
    for chip in chips:
        cliente_nome = None
        if chip.get("cliente_id"):
            cliente = await db.clientes.find_one({"_id": ObjectId(chip["cliente_id"])})
            if cliente:
                cliente_nome = cliente["nome"]
        
        result.append(ChipResponse(
            id=str(chip["_id"]),
            iccid=chip["iccid"],
            status=chip["status"],
            cliente_id=chip.get("cliente_id"),
            cliente_nome=cliente_nome,
            created_at=chip.get("created_at", datetime.now(timezone.utc))
        ))
    
    return result

@api_router.post("/chips", response_model=ChipResponse)
async def create_chip(data: ChipCreate, request: Request):
    user = await get_current_user(request)
    
    existing = await db.chips.find_one({"iccid": data.iccid})
    if existing:
        raise HTTPException(status_code=400, detail="ICCID já cadastrado")
    
    chip_doc = {
        "iccid": data.iccid,
        "status": ChipStatus.disponivel.value,
        "cliente_id": None,
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.chips.insert_one(chip_doc)
    
    await create_log("cadastro", f"Chip cadastrado: {data.iccid}", user["id"], user["name"])
    
    return ChipResponse(
        id=str(result.inserted_id),
        iccid=data.iccid,
        status=ChipStatus.disponivel,
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

# ==================== PLANS ROUTES ====================
@api_router.get("/planos", response_model=List[PlanResponse])
async def list_plans(request: Request):
    await get_current_user(request)
    
    plans = await db.planos.find({}).to_list(1000)
    
    return [
        PlanResponse(
            id=str(p["_id"]),
            nome=p["nome"],
            valor=p["valor"],
            franquia=p["franquia"],
            created_at=p.get("created_at", datetime.now(timezone.utc))
        ) for p in plans
    ]

@api_router.post("/planos", response_model=PlanResponse)
async def create_plan(data: PlanCreate, request: Request):
    user = await require_admin(request)
    
    plan_doc = {
        "nome": data.nome,
        "valor": data.valor,
        "franquia": data.franquia,
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.planos.insert_one(plan_doc)
    
    await create_log("cadastro", f"Plano cadastrado: {data.nome}", user["id"], user["name"])
    
    return PlanResponse(
        id=str(result.inserted_id),
        nome=data.nome,
        valor=data.valor,
        franquia=data.franquia,
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
            "valor": data.valor,
            "franquia": data.franquia
        }}
    )
    
    await create_log("cadastro", f"Plano atualizado: {data.nome}", user["id"], user["name"])
    
    return PlanResponse(
        id=plan_id,
        nome=data.nome,
        valor=data.valor,
        franquia=data.franquia,
        created_at=plan.get("created_at", datetime.now(timezone.utc))
    )

@api_router.delete("/planos/{plan_id}")
async def delete_plan(plan_id: str, request: Request):
    user = await require_admin(request)
    
    plan = await db.planos.find_one({"_id": ObjectId(plan_id)})
    if not plan:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    
    # Check if plan is in use
    line_using = await db.linhas.find_one({"plano_id": plan_id})
    if line_using:
        raise HTTPException(status_code=400, detail="Plano está em uso e não pode ser removido")
    
    await db.planos.delete_one({"_id": ObjectId(plan_id)})
    await create_log("cadastro", f"Plano removido: {plan['nome']}", user["id"], user["name"])
    
    return {"message": "Plano removido com sucesso"}

# ==================== ACTIVATION ROUTES ====================
@api_router.post("/ativacao", response_model=ActivationResponse)
async def activate_line(data: ActivationRequest, request: Request):
    user = await get_current_user(request)
    
    # Get client
    cliente = await db.clientes.find_one({"_id": ObjectId(data.cliente_id)})
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    
    # Get chip
    chip = await db.chips.find_one({"_id": ObjectId(data.chip_id)})
    if not chip:
        raise HTTPException(status_code=404, detail="Chip não encontrado")
    
    if chip["status"] != ChipStatus.disponivel.value:
        raise HTTPException(status_code=400, detail="Chip não está disponível para ativação")
    
    # Get plan
    plano = await db.planos.find_one({"_id": ObjectId(data.plano_id)})
    if not plano:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    
    # Call mock API
    result = await mock_api.ativar_chip(
        cpf=cliente["cpf"],
        nome=cliente["nome"],
        iccid=chip["iccid"],
        plano=plano["nome"]
    )
    
    if result["success"]:
        # Update chip
        await db.chips.update_one(
            {"_id": ObjectId(data.chip_id)},
            {"$set": {
                "status": ChipStatus.ativado.value,
                "cliente_id": data.cliente_id
            }}
        )
        
        # Create line
        line_doc = {
            "numero": result.get("numero") or "Pendente",
            "status": result["status"],
            "cliente_id": data.cliente_id,
            "chip_id": data.chip_id,
            "plano_id": data.plano_id,
            "created_at": datetime.now(timezone.utc)
        }
        await db.linhas.insert_one(line_doc)
        
        await create_log(
            "ativacao",
            f"Ativação realizada - Cliente: {cliente['nome']}, ICCID: {chip['iccid']}, Plano: {plano['nome']}, Status: {result['status']}",
            user["id"],
            user["name"]
        )
    else:
        await create_log(
            "erro",
            f"Erro na ativação - Cliente: {cliente['nome']}, ICCID: {chip['iccid']}, Erro: {result['message']}",
            user["id"],
            user["name"]
        )
    
    return ActivationResponse(
        success=result["success"],
        status=result["status"],
        message=result["message"],
        numero=result.get("numero")
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
        iccid = None
        
        if line.get("cliente_id"):
            cliente = await db.clientes.find_one({"_id": ObjectId(line["cliente_id"])})
            if cliente:
                cliente_nome = cliente["nome"]
        
        if line.get("plano_id"):
            plano = await db.planos.find_one({"_id": ObjectId(line["plano_id"])})
            if plano:
                plano_nome = plano["nome"]
        
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
            cliente_nome=cliente_nome,
            plano_nome=plano_nome,
            iccid=iccid,
            created_at=line.get("created_at", datetime.now(timezone.utc))
        ))
    
    return result

@api_router.get("/linhas/{line_id}/status")
async def get_line_status(line_id: str, request: Request):
    await get_current_user(request)
    
    line = await db.linhas.find_one({"_id": ObjectId(line_id)})
    if not line:
        raise HTTPException(status_code=404, detail="Linha não encontrada")
    
    # Call mock API to get current status
    result = await mock_api.consultar_status(line["numero"])
    
    return result

@api_router.post("/linhas/{line_id}/bloquear")
async def block_line(line_id: str, request: Request):
    user = await get_current_user(request)
    
    line = await db.linhas.find_one({"_id": ObjectId(line_id)})
    if not line:
        raise HTTPException(status_code=404, detail="Linha não encontrada")
    
    if line["status"] == LineStatus.bloqueado.value:
        raise HTTPException(status_code=400, detail="Linha já está bloqueada")
    
    # Call mock API
    result = await mock_api.bloquear_linha(line["numero"])
    
    if result["success"]:
        await db.linhas.update_one(
            {"_id": ObjectId(line_id)},
            {"$set": {"status": LineStatus.bloqueado.value}}
        )
        
        await db.chips.update_one(
            {"_id": ObjectId(line["chip_id"])},
            {"$set": {"status": ChipStatus.bloqueado.value}}
        )
        
        await create_log(
            "bloqueio",
            f"Linha bloqueada: {line['numero']}",
            user["id"],
            user["name"]
        )
    
    return result

@api_router.post("/linhas/{line_id}/desbloquear")
async def unblock_line(line_id: str, request: Request):
    user = await get_current_user(request)
    
    line = await db.linhas.find_one({"_id": ObjectId(line_id)})
    if not line:
        raise HTTPException(status_code=404, detail="Linha não encontrada")
    
    if line["status"] != LineStatus.bloqueado.value:
        raise HTTPException(status_code=400, detail="Linha não está bloqueada")
    
    # Call mock API
    result = await mock_api.desbloquear_linha(line["numero"])
    
    if result["success"]:
        await db.linhas.update_one(
            {"_id": ObjectId(line_id)},
            {"$set": {"status": LineStatus.ativo.value}}
        )
        
        await db.chips.update_one(
            {"_id": ObjectId(line["chip_id"])},
            {"$set": {"status": ChipStatus.ativado.value}}
        )
        
        await create_log(
            "desbloqueio",
            f"Linha desbloqueada: {line['numero']}",
            user["id"],
            user["name"]
        )
    
    return result

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
            created_at=log.get("created_at", datetime.now(timezone.utc))
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
    
    total_linhas = await db.linhas.count_documents({})
    linhas_ativas = await db.linhas.count_documents({"status": "ativo"})
    linhas_pendentes = await db.linhas.count_documents({"status": "pendente"})
    linhas_bloqueadas = await db.linhas.count_documents({"status": "bloqueado"})
    
    total_planos = await db.planos.count_documents({})
    
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
            "bloqueados": chips_bloqueados
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
        "recent_logs": [
            {
                "id": str(log["_id"]),
                "action": log["action"],
                "details": log["details"],
                "created_at": log.get("created_at", datetime.now(timezone.utc)).isoformat()
            } for log in recent_logs
        ]
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

## Auth Endpoints
- POST /api/auth/login
- POST /api/auth/register
- POST /api/auth/logout
- GET /api/auth/me
- POST /api/auth/refresh
""")

async def seed_sample_data():
    """Seed sample data for testing"""
    
    # Check if data already exists
    existing_plans = await db.planos.count_documents({})
    if existing_plans > 0:
        return
    
    # Create sample plans
    plans = [
        {"nome": "Básico 5GB", "valor": 29.90, "franquia": "5GB", "created_at": datetime.now(timezone.utc)},
        {"nome": "Essencial 10GB", "valor": 49.90, "franquia": "10GB", "created_at": datetime.now(timezone.utc)},
        {"nome": "Plus 20GB", "valor": 79.90, "franquia": "20GB", "created_at": datetime.now(timezone.utc)},
        {"nome": "Premium 50GB", "valor": 119.90, "franquia": "50GB", "created_at": datetime.now(timezone.utc)},
    ]
    await db.planos.insert_many(plans)
    
    # Create sample clients
    clients = [
        {"nome": "João Silva", "cpf": "123.456.789-00", "telefone": "(11) 98765-4321", "status": "ativo", "created_at": datetime.now(timezone.utc)},
        {"nome": "Maria Santos", "cpf": "987.654.321-00", "telefone": "(11) 91234-5678", "status": "ativo", "created_at": datetime.now(timezone.utc)},
        {"nome": "Pedro Oliveira", "cpf": "456.789.123-00", "telefone": "(21) 99876-5432", "status": "ativo", "created_at": datetime.now(timezone.utc)},
        {"nome": "Ana Costa", "cpf": "789.123.456-00", "telefone": "(31) 98765-1234", "status": "inativo", "created_at": datetime.now(timezone.utc)},
    ]
    await db.clientes.insert_many(clients)
    
    # Create sample chips
    chips = [
        {"iccid": "8955010012345678901", "status": "disponivel", "cliente_id": None, "created_at": datetime.now(timezone.utc)},
        {"iccid": "8955010012345678902", "status": "disponivel", "cliente_id": None, "created_at": datetime.now(timezone.utc)},
        {"iccid": "8955010012345678903", "status": "disponivel", "cliente_id": None, "created_at": datetime.now(timezone.utc)},
        {"iccid": "8955010012345678904", "status": "disponivel", "cliente_id": None, "created_at": datetime.now(timezone.utc)},
        {"iccid": "8955010012345678905", "status": "disponivel", "cliente_id": None, "created_at": datetime.now(timezone.utc)},
    ]
    await db.chips.insert_many(chips)
    
    logger.info("Sample data seeded successfully")

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
