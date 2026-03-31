"""
Serviço de Integração com Operadora (Surf Telecom)

Este módulo centraliza TODAS as chamadas para a API da operadora.
Nenhuma chamada à operadora deve ser feita fora deste serviço.

Configuração via variáveis de ambiente:
- USE_MOCK_API: "true" para mock, "false" para API real
- OPERADORA_API_URL: URL base da API (ex: https://api.surftelecom.com.br)
- OPERADORA_API_TOKEN: Token Bearer para autenticação
- OPERADORA_TIMEOUT: Timeout em segundos (padrão: 30)

Para usar a API real:
1. Configure as variáveis de ambiente no .env
2. Mude USE_MOCK_API para "false"
3. Reinicie o servidor
"""

import os
import random
import json
import logging
import httpx
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)

# ==================== CONFIGURAÇÃO ====================

# Configurações da API
USE_MOCK_API = os.environ.get("USE_MOCK_API", "true").lower() == "true"
OPERADORA_API_URL = os.environ.get("OPERADORA_API_URL", "https://api.surftelecom.com.br")
OPERADORA_API_TOKEN = os.environ.get("OPERADORA_API_TOKEN", "")
OPERADORA_TIMEOUT = int(os.environ.get("OPERADORA_TIMEOUT", "30"))

# Endpoints da API (configuráveis)
ENDPOINTS = {
    "ativar_chip": os.environ.get("ENDPOINT_ATIVAR_CHIP", "/api/v1/chip/ativar"),
    "consultar_linha": os.environ.get("ENDPOINT_CONSULTAR_LINHA", "/api/v1/linha/status"),
    "bloquear_linha": os.environ.get("ENDPOINT_BLOQUEAR_LINHA", "/api/v1/linha/bloquear"),
    "desbloquear_linha": os.environ.get("ENDPOINT_DESBLOQUEAR_LINHA", "/api/v1/linha/desbloquear"),
}


# ==================== ENUMS ====================

class OperadoraStatus(str, Enum):
    """Status possíveis retornados pela operadora"""
    ATIVO = "ativo"
    PENDENTE = "pendente"
    BLOQUEADO = "bloqueado"
    ERRO = "erro"
    CANCELADO = "cancelado"


class ErrorCode(str, Enum):
    """Códigos de erro padronizados"""
    TIMEOUT = "ERR_TIMEOUT"
    CONNECTION = "ERR_CONNECTION"
    AUTHENTICATION = "ERR_AUTH"
    NOT_FOUND = "ERR_NOT_FOUND"
    VALIDATION = "ERR_VALIDATION"
    SERVER_ERROR = "ERR_SERVER"
    UNKNOWN = "ERR_UNKNOWN"


# ==================== DATA CLASSES ====================

@dataclass
class ClienteData:
    """Dados do cliente para ativação"""
    cpf: str
    nome: str
    telefone: Optional[str] = None
    email: Optional[str] = None


@dataclass
class OperadoraRequest:
    """Representa uma requisição para a operadora"""
    endpoint: str
    method: str
    payload: Dict[str, Any]
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    headers: Dict[str, str] = field(default_factory=dict)
    
    def to_dict(self) -> dict:
        return {
            "endpoint": self.endpoint,
            "method": self.method,
            "payload": self.payload,
            "timestamp": self.timestamp.isoformat(),
            "headers": {k: v for k, v in self.headers.items() if k.lower() != "authorization"}  # Não logar token
        }


@dataclass
class OperadoraResponse:
    """Representa uma resposta da operadora"""
    success: bool
    status: str
    message: str
    data: Optional[Dict[str, Any]] = None
    numero: Optional[str] = None
    error_code: Optional[str] = None
    raw_response: Optional[str] = None
    response_time_ms: int = 0
    http_status_code: Optional[int] = None
    
    def to_dict(self) -> dict:
        return {
            "success": self.success,
            "status": self.status,
            "message": self.message,
            "data": self.data,
            "numero": self.numero,
            "error_code": self.error_code,
            "raw_response": self.raw_response,
            "response_time_ms": self.response_time_ms,
            "http_status_code": self.http_status_code
        }


@dataclass
class LogEntry:
    """Entrada de log para o banco de dados"""
    action: str
    details: str
    user_id: Optional[str]
    user_name: Optional[str]
    created_at: datetime
    api_request: Dict[str, Any]
    api_response: Dict[str, Any]
    is_mock: bool
    error_details: Optional[str] = None


# ==================== INTERFACE ABSTRATA ====================

class IOperadoraAdapter(ABC):
    """Interface para adaptadores de operadora"""
    
    @abstractmethod
    async def ativar_chip(
        self,
        cliente: ClienteData,
        iccid: str,
        plano: str,
        plano_id: Optional[str] = None
    ) -> Tuple[OperadoraRequest, OperadoraResponse]:
        pass
    
    @abstractmethod
    async def consultar_linha(self, numero: str) -> Tuple[OperadoraRequest, OperadoraResponse]:
        pass
    
    @abstractmethod
    async def bloquear_linha(
        self,
        numero: str,
        motivo: Optional[str] = None
    ) -> Tuple[OperadoraRequest, OperadoraResponse]:
        pass
    
    @abstractmethod
    async def desbloquear_linha(self, numero: str) -> Tuple[OperadoraRequest, OperadoraResponse]:
        pass


# ==================== ADAPTADOR MOCK ====================

class MockOperadoraAdapter(IOperadoraAdapter):
    """
    Adaptador mock para desenvolvimento e testes.
    Simula respostas da operadora com probabilidades realistas.
    """
    
    async def ativar_chip(
        self,
        cliente: ClienteData,
        iccid: str,
        plano: str,
        plano_id: Optional[str] = None
    ) -> Tuple[OperadoraRequest, OperadoraResponse]:
        import asyncio
        await asyncio.sleep(random.uniform(0.3, 0.8))  # Simula latência
        
        request = OperadoraRequest(
            endpoint=ENDPOINTS["ativar_chip"],
            method="POST",
            payload={
                "cpf": cliente.cpf,
                "nome": cliente.nome,
                "iccid": iccid,
                "plano": plano,
                "plano_id": plano_id
            }
        )
        
        # 70% sucesso, 20% pendente, 10% erro
        scenario = random.choices(
            ["sucesso", "pendente", "erro"],
            weights=[70, 20, 10],
            k=1
        )[0]
        
        response_time = random.randint(200, 800)
        
        if scenario == "sucesso":
            numero = f"11{random.randint(900000000, 999999999)}"
            response = OperadoraResponse(
                success=True,
                status=OperadoraStatus.ATIVO,
                message="Chip ativado com sucesso",
                numero=numero,
                data={
                    "numero": numero,
                    "data_ativacao": datetime.now(timezone.utc).isoformat(),
                    "protocolo": f"ATIV{random.randint(100000, 999999)}"
                },
                raw_response=json.dumps({"status": "ok", "numero": numero}),
                response_time_ms=response_time,
                http_status_code=200
            )
        elif scenario == "pendente":
            protocolo = f"PEND{random.randint(100000, 999999)}"
            response = OperadoraResponse(
                success=True,
                status=OperadoraStatus.PENDENTE,
                message="Ativação em processamento. Aguarde até 24h.",
                numero=None,
                data={"protocolo": protocolo},
                raw_response=json.dumps({"status": "pending", "protocolo": protocolo}),
                response_time_ms=response_time,
                http_status_code=202
            )
        else:
            response = OperadoraResponse(
                success=False,
                status=OperadoraStatus.ERRO,
                message="Falha na comunicação com a operadora",
                error_code=ErrorCode.SERVER_ERROR,
                raw_response=json.dumps({"error": "internal_error"}),
                response_time_ms=random.randint(5000, 10000),
                http_status_code=500
            )
        
        return request, response
    
    async def consultar_linha(self, numero: str) -> Tuple[OperadoraRequest, OperadoraResponse]:
        import asyncio
        await asyncio.sleep(random.uniform(0.2, 0.5))
        
        request = OperadoraRequest(
            endpoint=ENDPOINTS["consultar_linha"],
            method="GET",
            payload={"numero": numero}
        )
        
        # 95% sucesso, 5% erro
        if random.random() < 0.95:
            saldo = round(random.uniform(1, 20), 1)
            response = OperadoraResponse(
                success=True,
                status=OperadoraStatus.ATIVO,
                message="Consulta realizada com sucesso",
                numero=numero,
                data={
                    "numero": numero,
                    "status": "ativo",
                    "saldo_dados": f"{saldo}GB",
                    "saldo_voz": f"{random.randint(50, 500)} minutos",
                    "saldo_sms": f"{random.randint(50, 200)} SMS",
                    "validade": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
                    "plano": "Plano Atual"
                },
                raw_response=json.dumps({"status": "ok"}),
                response_time_ms=random.randint(100, 300),
                http_status_code=200
            )
        else:
            response = OperadoraResponse(
                success=False,
                status=OperadoraStatus.ERRO,
                message="Linha não encontrada",
                error_code=ErrorCode.NOT_FOUND,
                raw_response=json.dumps({"error": "not_found"}),
                response_time_ms=random.randint(100, 200),
                http_status_code=404
            )
        
        return request, response
    
    async def bloquear_linha(
        self,
        numero: str,
        motivo: Optional[str] = None
    ) -> Tuple[OperadoraRequest, OperadoraResponse]:
        import asyncio
        await asyncio.sleep(random.uniform(0.2, 0.5))
        
        request = OperadoraRequest(
            endpoint=ENDPOINTS["bloquear_linha"],
            method="POST",
            payload={"numero": numero, "motivo": motivo or "Solicitação do cliente"}
        )
        
        # 95% sucesso, 5% erro
        if random.random() < 0.95:
            response = OperadoraResponse(
                success=True,
                status=OperadoraStatus.BLOQUEADO,
                message="Linha bloqueada com sucesso",
                numero=numero,
                data={
                    "numero": numero,
                    "data_bloqueio": datetime.now(timezone.utc).isoformat(),
                    "protocolo": f"BLOQ{random.randint(100000, 999999)}"
                },
                raw_response=json.dumps({"status": "blocked"}),
                response_time_ms=random.randint(100, 400),
                http_status_code=200
            )
        else:
            response = OperadoraResponse(
                success=False,
                status=OperadoraStatus.ERRO,
                message="Erro ao processar bloqueio",
                error_code=ErrorCode.SERVER_ERROR,
                raw_response=json.dumps({"error": "internal_error"}),
                response_time_ms=random.randint(500, 1000),
                http_status_code=500
            )
        
        return request, response
    
    async def desbloquear_linha(self, numero: str) -> Tuple[OperadoraRequest, OperadoraResponse]:
        import asyncio
        await asyncio.sleep(random.uniform(0.2, 0.5))
        
        request = OperadoraRequest(
            endpoint=ENDPOINTS["desbloquear_linha"],
            method="POST",
            payload={"numero": numero}
        )
        
        # 95% sucesso, 5% erro
        if random.random() < 0.95:
            response = OperadoraResponse(
                success=True,
                status=OperadoraStatus.ATIVO,
                message="Linha desbloqueada com sucesso",
                numero=numero,
                data={
                    "numero": numero,
                    "data_desbloqueio": datetime.now(timezone.utc).isoformat(),
                    "protocolo": f"DESB{random.randint(100000, 999999)}"
                },
                raw_response=json.dumps({"status": "active"}),
                response_time_ms=random.randint(100, 400),
                http_status_code=200
            )
        else:
            response = OperadoraResponse(
                success=False,
                status=OperadoraStatus.ERRO,
                message="Erro ao processar desbloqueio",
                error_code=ErrorCode.SERVER_ERROR,
                raw_response=json.dumps({"error": "internal_error"}),
                response_time_ms=random.randint(500, 1000),
                http_status_code=500
            )
        
        return request, response


# ==================== ADAPTADOR REAL (HTTP) ====================

class RealOperadoraAdapter(IOperadoraAdapter):
    """
    Adaptador real que faz chamadas HTTP para a API da operadora.
    Implementa tratamento de erros, timeout e retry.
    """
    
    def __init__(self, base_url: str, token: str, timeout: int = OPERADORA_TIMEOUT):
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.timeout = timeout
    
    def _get_headers(self) -> dict:
        """Retorna headers para requisições à API"""
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-Request-ID": f"mvno-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{random.randint(1000, 9999)}"
        }
    
    async def _make_request(
        self,
        method: str,
        endpoint: str,
        payload: Optional[Dict[str, Any]] = None
    ) -> Tuple[OperadoraRequest, OperadoraResponse]:
        """
        Executa uma requisição HTTP com tratamento completo de erros.
        """
        headers = self._get_headers()
        full_url = f"{self.base_url}{endpoint}"
        
        request = OperadoraRequest(
            endpoint=endpoint,
            method=method,
            payload=payload or {},
            headers=headers
        )
        
        start_time = datetime.now(timezone.utc)
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                if method.upper() == "GET":
                    resp = await client.get(full_url, params=payload, headers=headers)
                elif method.upper() == "POST":
                    resp = await client.post(full_url, json=payload, headers=headers)
                elif method.upper() == "PUT":
                    resp = await client.put(full_url, json=payload, headers=headers)
                elif method.upper() == "DELETE":
                    resp = await client.delete(full_url, headers=headers)
                else:
                    resp = await client.request(method, full_url, json=payload, headers=headers)
                
                elapsed_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
                
                # Tenta parsear JSON
                try:
                    data = resp.json()
                except:
                    data = {"raw": resp.text}
                
                # Verifica status HTTP
                if resp.status_code >= 200 and resp.status_code < 300:
                    response = OperadoraResponse(
                        success=True,
                        status=data.get("status", OperadoraStatus.ATIVO),
                        message=data.get("message", "Operação realizada com sucesso"),
                        numero=data.get("numero"),
                        data=data,
                        raw_response=resp.text,
                        response_time_ms=elapsed_ms,
                        http_status_code=resp.status_code
                    )
                elif resp.status_code == 401 or resp.status_code == 403:
                    response = OperadoraResponse(
                        success=False,
                        status=OperadoraStatus.ERRO,
                        message="Erro de autenticação com a operadora",
                        error_code=ErrorCode.AUTHENTICATION,
                        raw_response=resp.text,
                        response_time_ms=elapsed_ms,
                        http_status_code=resp.status_code
                    )
                elif resp.status_code == 404:
                    response = OperadoraResponse(
                        success=False,
                        status=OperadoraStatus.ERRO,
                        message=data.get("message", "Recurso não encontrado"),
                        error_code=ErrorCode.NOT_FOUND,
                        raw_response=resp.text,
                        response_time_ms=elapsed_ms,
                        http_status_code=resp.status_code
                    )
                elif resp.status_code >= 400 and resp.status_code < 500:
                    response = OperadoraResponse(
                        success=False,
                        status=OperadoraStatus.ERRO,
                        message=data.get("message", f"Erro de validação: {resp.status_code}"),
                        error_code=ErrorCode.VALIDATION,
                        raw_response=resp.text,
                        response_time_ms=elapsed_ms,
                        http_status_code=resp.status_code
                    )
                else:  # 5xx
                    response = OperadoraResponse(
                        success=False,
                        status=OperadoraStatus.ERRO,
                        message=data.get("message", f"Erro do servidor: {resp.status_code}"),
                        error_code=ErrorCode.SERVER_ERROR,
                        raw_response=resp.text,
                        response_time_ms=elapsed_ms,
                        http_status_code=resp.status_code
                    )
                
                return request, response
                
        except httpx.TimeoutException:
            elapsed_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
            logger.error(f"Timeout na requisição para {endpoint}")
            response = OperadoraResponse(
                success=False,
                status=OperadoraStatus.ERRO,
                message=f"Timeout na comunicação com a operadora ({self.timeout}s)",
                error_code=ErrorCode.TIMEOUT,
                response_time_ms=elapsed_ms
            )
            return request, response
            
        except httpx.ConnectError as e:
            elapsed_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
            logger.error(f"Erro de conexão: {e}")
            response = OperadoraResponse(
                success=False,
                status=OperadoraStatus.ERRO,
                message="Erro de conexão com a operadora. Verifique a configuração de rede.",
                error_code=ErrorCode.CONNECTION,
                response_time_ms=elapsed_ms
            )
            return request, response
            
        except Exception as e:
            elapsed_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
            logger.error(f"Erro inesperado: {e}")
            response = OperadoraResponse(
                success=False,
                status=OperadoraStatus.ERRO,
                message=f"Erro inesperado: {str(e)}",
                error_code=ErrorCode.UNKNOWN,
                response_time_ms=elapsed_ms
            )
            return request, response
    
    async def ativar_chip(
        self,
        cliente: ClienteData,
        iccid: str,
        plano: str,
        plano_id: Optional[str] = None
    ) -> Tuple[OperadoraRequest, OperadoraResponse]:
        """Ativa um chip na operadora"""
        payload = {
            "cpf": cliente.cpf,
            "nome": cliente.nome,
            "telefone": cliente.telefone,
            "email": cliente.email,
            "iccid": iccid,
            "plano": plano,
            "plano_id": plano_id
        }
        # Remove campos None
        payload = {k: v for k, v in payload.items() if v is not None}
        
        return await self._make_request("POST", ENDPOINTS["ativar_chip"], payload)
    
    async def consultar_linha(self, numero: str) -> Tuple[OperadoraRequest, OperadoraResponse]:
        """Consulta status de uma linha"""
        return await self._make_request("GET", ENDPOINTS["consultar_linha"], {"numero": numero})
    
    async def bloquear_linha(
        self,
        numero: str,
        motivo: Optional[str] = None
    ) -> Tuple[OperadoraRequest, OperadoraResponse]:
        """Bloqueia uma linha"""
        payload = {
            "numero": numero,
            "motivo": motivo or "Solicitação do cliente"
        }
        return await self._make_request("POST", ENDPOINTS["bloquear_linha"], payload)
    
    async def desbloquear_linha(self, numero: str) -> Tuple[OperadoraRequest, OperadoraResponse]:
        """Desbloqueia uma linha"""
        return await self._make_request("POST", ENDPOINTS["desbloquear_linha"], {"numero": numero})


# ==================== SERVIÇO PRINCIPAL ====================

class OperadoraService:
    """
    Serviço principal de integração com operadora.
    
    Este é o ponto único de entrada para todas as operações com a operadora.
    Gerencia logs, escolha de adaptador (mock/real) e tratamento de erros.
    
    Uso:
        service = OperadoraService()
        response = await service.ativar_chip(cliente, iccid, plano, db=db, user_id=user_id)
    """
    
    def __init__(self, use_mock: Optional[bool] = None):
        # Determina se usa mock
        if use_mock is not None:
            self.use_mock = use_mock
        else:
            self.use_mock = USE_MOCK_API
        
        # Verifica se pode usar API real
        if not self.use_mock and not OPERADORA_API_TOKEN:
            logger.warning("OPERADORA_API_TOKEN não configurado. Usando modo mock.")
            self.use_mock = True
        
        # Inicializa adaptador apropriado
        if self.use_mock:
            self.adapter: IOperadoraAdapter = MockOperadoraAdapter()
            logger.info("OperadoraService iniciado em modo MOCK")
        else:
            self.adapter = RealOperadoraAdapter(
                base_url=OPERADORA_API_URL,
                token=OPERADORA_API_TOKEN,
                timeout=OPERADORA_TIMEOUT
            )
            logger.info(f"OperadoraService iniciado em modo REAL - URL: {OPERADORA_API_URL}")
    
    async def _save_log(
        self,
        db,
        action: str,
        request: OperadoraRequest,
        response: OperadoraResponse,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None,
        extra_details: Optional[str] = None,
        error_details: Optional[str] = None
    ):
        """Salva log detalhado no banco de dados"""
        if db is None:
            logger.warning("Database não fornecido, log não será salvo")
            return
        
        log_entry = {
            "action": action,
            "details": extra_details or f"{action} via API operadora",
            "user_id": user_id,
            "user_name": user_name,
            "created_at": datetime.now(timezone.utc),
            "api_request": request.to_dict(),
            "api_response": response.to_dict(),
            "is_mock": self.use_mock,
            "error_details": error_details
        }
        
        try:
            await db.logs.insert_one(log_entry)
        except Exception as e:
            logger.error(f"Erro ao salvar log: {e}")
    
    async def ativar_chip(
        self,
        cpf: str,
        nome: str,
        iccid: str,
        plano: str,
        plano_id: Optional[str] = None,
        telefone: Optional[str] = None,
        email: Optional[str] = None,
        db=None,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None
    ) -> OperadoraResponse:
        """
        Ativa um chip na operadora.
        
        Args:
            cpf: CPF do cliente
            nome: Nome do cliente
            iccid: ICCID do chip
            plano: Nome do plano
            plano_id: ID interno do plano (opcional)
            telefone: Telefone do cliente (opcional)
            email: Email do cliente (opcional)
            db: Conexão com banco de dados para logs
            user_id: ID do usuário que está realizando a ação
            user_name: Nome do usuário
        
        Returns:
            OperadoraResponse com status da ativação
        """
        cliente = ClienteData(cpf=cpf, nome=nome, telefone=telefone, email=email)
        
        request, response = await self.adapter.ativar_chip(
            cliente=cliente,
            iccid=iccid,
            plano=plano,
            plano_id=plano_id
        )
        
        # Determina ação para log
        action = "ativacao" if response.success else "erro"
        
        # Cria detalhes para log
        if response.success:
            details = f"Ativação realizada - Cliente: {nome}, ICCID: {iccid}, Plano: {plano}, Status: {response.status}"
        else:
            details = f"Erro na ativação - Cliente: {nome}, ICCID: {iccid}, Erro: {response.message}"
        
        # Salva log
        await self._save_log(
            db=db,
            action=action,
            request=request,
            response=response,
            user_id=user_id,
            user_name=user_name,
            extra_details=details,
            error_details=response.error_code if not response.success else None
        )
        
        return response
    
    async def consultar_linha(
        self,
        numero: str,
        db=None,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None
    ) -> OperadoraResponse:
        """
        Consulta status de uma linha na operadora.
        
        Args:
            numero: Número da linha
            db: Conexão com banco de dados para logs
            user_id: ID do usuário
            user_name: Nome do usuário
        
        Returns:
            OperadoraResponse com dados da linha
        """
        request, response = await self.adapter.consultar_linha(numero)
        
        # Log de consulta (não salva como erro mesmo se falhar, apenas registra)
        await self._save_log(
            db=db,
            action="consulta",
            request=request,
            response=response,
            user_id=user_id,
            user_name=user_name,
            extra_details=f"Consulta de status - Linha: {numero}"
        )
        
        return response
    
    async def bloquear_linha(
        self,
        numero: str,
        motivo: Optional[str] = None,
        db=None,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None
    ) -> OperadoraResponse:
        """
        Bloqueia uma linha na operadora.
        
        Args:
            numero: Número da linha
            motivo: Motivo do bloqueio
            db: Conexão com banco de dados para logs
            user_id: ID do usuário
            user_name: Nome do usuário
        
        Returns:
            OperadoraResponse com status do bloqueio
        """
        request, response = await self.adapter.bloquear_linha(numero, motivo)
        
        action = "bloqueio" if response.success else "erro"
        
        if response.success:
            details = f"Linha bloqueada: {numero}"
        else:
            details = f"Erro ao bloquear linha: {numero}, Erro: {response.message}"
        
        await self._save_log(
            db=db,
            action=action,
            request=request,
            response=response,
            user_id=user_id,
            user_name=user_name,
            extra_details=details,
            error_details=response.error_code if not response.success else None
        )
        
        return response
    
    async def desbloquear_linha(
        self,
        numero: str,
        db=None,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None
    ) -> OperadoraResponse:
        """
        Desbloqueia uma linha na operadora.
        
        Args:
            numero: Número da linha
            db: Conexão com banco de dados para logs
            user_id: ID do usuário
            user_name: Nome do usuário
        
        Returns:
            OperadoraResponse com status do desbloqueio
        """
        request, response = await self.adapter.desbloquear_linha(numero)
        
        action = "desbloqueio" if response.success else "erro"
        
        if response.success:
            details = f"Linha desbloqueada: {numero}"
        else:
            details = f"Erro ao desbloquear linha: {numero}, Erro: {response.message}"
        
        await self._save_log(
            db=db,
            action=action,
            request=request,
            response=response,
            user_id=user_id,
            user_name=user_name,
            extra_details=details,
            error_details=response.error_code if not response.success else None
        )
        
        return response
    
    def get_config_status(self) -> dict:
        """Retorna status da configuração atual"""
        return {
            "mode": "mock" if self.use_mock else "real",
            "api_url": OPERADORA_API_URL if not self.use_mock else None,
            "token_configured": bool(OPERADORA_API_TOKEN),
            "timeout": OPERADORA_TIMEOUT,
            "endpoints": ENDPOINTS
        }


# ==================== INSTÂNCIA GLOBAL ====================

# Instância global do serviço (singleton)
operadora_service = OperadoraService()


# ==================== FUNÇÕES DE CONVENIÊNCIA ====================

def get_operadora_service(use_mock: Optional[bool] = None) -> OperadoraService:
    """
    Retorna uma instância do OperadoraService.
    
    Args:
        use_mock: Se True, força modo mock. Se False, força modo real.
                 Se None, usa a configuração do ambiente.
    """
    if use_mock is None:
        return operadora_service
    return OperadoraService(use_mock=use_mock)
