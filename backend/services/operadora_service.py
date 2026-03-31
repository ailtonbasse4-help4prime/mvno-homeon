"""
Serviço de Integração com Operadora (Surf Telecom)

Este módulo isola todas as chamadas para a API da operadora,
facilitando a troca entre mock e implementação real.

Para usar a API real:
1. Defina OPERADORA_API_URL e OPERADORA_API_TOKEN no .env
2. Mude USE_MOCK_API para False
3. Implemente as chamadas HTTP reais nos métodos
"""

import os
import random
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)

# Configuração
USE_MOCK_API = os.environ.get("USE_MOCK_API", "true").lower() == "true"
OPERADORA_API_URL = os.environ.get("OPERADORA_API_URL", "https://api.surftelecom.com.br")
OPERADORA_API_TOKEN = os.environ.get("OPERADORA_API_TOKEN", "")


class OperadoraStatus(str, Enum):
    """Status possíveis retornados pela operadora"""
    ATIVO = "ativo"
    PENDENTE = "pendente"
    BLOQUEADO = "bloqueado"
    ERRO = "erro"
    CANCELADO = "cancelado"


@dataclass
class OperadoraRequest:
    """Representa uma requisição para a operadora"""
    endpoint: str
    method: str
    payload: Dict[str, Any]
    timestamp: datetime
    
    def to_dict(self) -> dict:
        return {
            "endpoint": self.endpoint,
            "method": self.method,
            "payload": self.payload,
            "timestamp": self.timestamp.isoformat()
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
    
    def to_dict(self) -> dict:
        return {
            "success": self.success,
            "status": self.status,
            "message": self.message,
            "data": self.data,
            "numero": self.numero,
            "error_code": self.error_code,
            "raw_response": self.raw_response,
            "response_time_ms": self.response_time_ms
        }


class OperadoraService:
    """
    Serviço para integração com a operadora de telefonia.
    
    Suporta modo mock (para desenvolvimento/testes) e modo real (produção).
    """
    
    def __init__(self, use_mock: bool = USE_MOCK_API):
        self.use_mock = use_mock
        self.base_url = OPERADORA_API_URL
        self.token = OPERADORA_API_TOKEN
        
        if not use_mock and not self.token:
            logger.warning("OPERADORA_API_TOKEN não configurado. Usando modo mock.")
            self.use_mock = True
    
    def _get_headers(self) -> dict:
        """Retorna headers para requisições à API real"""
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    
    async def _log_request_response(
        self,
        db,
        action: str,
        request: OperadoraRequest,
        response: OperadoraResponse,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None,
        extra_details: Optional[str] = None
    ):
        """Salva log detalhado da requisição e resposta"""
        log_entry = {
            "action": action,
            "details": extra_details or f"{action} via API operadora",
            "user_id": user_id,
            "user_name": user_name,
            "created_at": datetime.now(timezone.utc),
            "api_request": request.to_dict(),
            "api_response": response.to_dict(),
            "is_mock": self.use_mock
        }
        await db.logs.insert_one(log_entry)
    
    # ==================== ATIVAÇÃO ====================
    
    async def ativar_chip(
        self,
        cpf: str,
        nome: str,
        iccid: str,
        plano: str,
        plano_id: Optional[str] = None,
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
            db: Conexão com banco de dados para logs
            user_id: ID do usuário que está realizando a ação
            user_name: Nome do usuário
        
        Returns:
            OperadoraResponse com status da ativação
        """
        request = OperadoraRequest(
            endpoint="/api/v1/ativacao",
            method="POST",
            payload={
                "cpf": cpf,
                "nome": nome,
                "iccid": iccid,
                "plano": plano,
                "plano_id": plano_id
            },
            timestamp=datetime.now(timezone.utc)
        )
        
        if self.use_mock:
            response = await self._mock_ativar_chip(cpf, nome, iccid, plano)
        else:
            response = await self._real_ativar_chip(request)
        
        # Log detalhado
        if db is not None:
            action = "ativacao" if response.success else "erro"
            details = f"Ativação - Cliente: {nome}, ICCID: {iccid}, Plano: {plano}, Status: {response.status}"
            if not response.success:
                details = f"Erro na ativação - Cliente: {nome}, ICCID: {iccid}, Erro: {response.message}"
            
            await self._log_request_response(
                db, action, request, response, user_id, user_name, details
            )
        
        return response
    
    async def _mock_ativar_chip(self, cpf: str, nome: str, iccid: str, plano: str) -> OperadoraResponse:
        """Simulação de ativação de chip"""
        import asyncio
        await asyncio.sleep(0.5)  # Simula latência
        
        # 70% sucesso, 20% pendente, 10% erro
        scenario = random.choices(
            ["sucesso", "pendente", "erro"],
            weights=[70, 20, 10],
            k=1
        )[0]
        
        if scenario == "sucesso":
            numero = f"11{random.randint(900000000, 999999999)}"
            return OperadoraResponse(
                success=True,
                status=OperadoraStatus.ATIVO,
                message="Chip ativado com sucesso",
                numero=numero,
                data={"numero": numero, "data_ativacao": datetime.now(timezone.utc).isoformat()},
                raw_response=json.dumps({"status": "ok", "numero": numero}),
                response_time_ms=random.randint(200, 800)
            )
        elif scenario == "pendente":
            return OperadoraResponse(
                success=True,
                status=OperadoraStatus.PENDENTE,
                message="Ativação em processamento. Aguarde até 24h.",
                numero=None,
                data={"protocolo": f"PROT{random.randint(100000, 999999)}"},
                raw_response=json.dumps({"status": "pending"}),
                response_time_ms=random.randint(200, 800)
            )
        else:
            return OperadoraResponse(
                success=False,
                status=OperadoraStatus.ERRO,
                message="Falha na comunicação com a operadora",
                error_code="ERR_CONNECTION",
                raw_response=json.dumps({"error": "connection_timeout"}),
                response_time_ms=random.randint(5000, 10000)
            )
    
    async def _real_ativar_chip(self, request: OperadoraRequest) -> OperadoraResponse:
        """
        Implementação real da ativação.
        
        TODO: Implementar chamada HTTP real para Surf Telecom
        """
        import httpx
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                start_time = datetime.now(timezone.utc)
                
                resp = await client.post(
                    f"{self.base_url}{request.endpoint}",
                    json=request.payload,
                    headers=self._get_headers()
                )
                
                elapsed_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
                
                data = resp.json()
                
                if resp.status_code == 200:
                    return OperadoraResponse(
                        success=True,
                        status=data.get("status", OperadoraStatus.PENDENTE),
                        message=data.get("message", "Processado com sucesso"),
                        numero=data.get("numero"),
                        data=data,
                        raw_response=resp.text,
                        response_time_ms=elapsed_ms
                    )
                else:
                    return OperadoraResponse(
                        success=False,
                        status=OperadoraStatus.ERRO,
                        message=data.get("error", f"Erro HTTP {resp.status_code}"),
                        error_code=str(resp.status_code),
                        raw_response=resp.text,
                        response_time_ms=elapsed_ms
                    )
        except Exception as e:
            logger.error(f"Erro na chamada à operadora: {e}")
            return OperadoraResponse(
                success=False,
                status=OperadoraStatus.ERRO,
                message=f"Erro de comunicação: {str(e)}",
                error_code="ERR_EXCEPTION"
            )
    
    # ==================== CONSULTA STATUS ====================
    
    async def consultar_status(
        self,
        numero: str,
        db=None,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None
    ) -> OperadoraResponse:
        """
        Consulta status de uma linha na operadora.
        """
        request = OperadoraRequest(
            endpoint="/api/v1/linha/status",
            method="GET",
            payload={"numero": numero},
            timestamp=datetime.now(timezone.utc)
        )
        
        if self.use_mock:
            response = await self._mock_consultar_status(numero)
        else:
            response = await self._real_consultar_status(request)
        
        return response
    
    async def _mock_consultar_status(self, numero: str) -> OperadoraResponse:
        """Simulação de consulta de status"""
        import asyncio
        await asyncio.sleep(0.3)
        
        return OperadoraResponse(
            success=True,
            status=OperadoraStatus.ATIVO,
            message="Consulta realizada com sucesso",
            numero=numero,
            data={
                "numero": numero,
                "status": "ativo",
                "saldo_dados": f"{random.uniform(1, 10):.1f}GB",
                "validade": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
                "plano": "Plano Teste"
            },
            raw_response=json.dumps({"status": "ok"}),
            response_time_ms=random.randint(100, 300)
        )
    
    async def _real_consultar_status(self, request: OperadoraRequest) -> OperadoraResponse:
        """Implementação real da consulta de status"""
        # TODO: Implementar chamada real
        return await self._mock_consultar_status(request.payload["numero"])
    
    # ==================== BLOQUEIO ====================
    
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
        """
        request = OperadoraRequest(
            endpoint="/api/v1/linha/bloquear",
            method="POST",
            payload={"numero": numero, "motivo": motivo or "Solicitação do cliente"},
            timestamp=datetime.now(timezone.utc)
        )
        
        if self.use_mock:
            response = await self._mock_bloquear_linha(numero)
        else:
            response = await self._real_bloquear_linha(request)
        
        if db is not None:
            action = "bloqueio" if response.success else "erro"
            details = f"Bloqueio de linha: {numero}, Status: {response.status}"
            if not response.success:
                details = f"Erro ao bloquear linha: {numero}, Erro: {response.message}"
            
            await self._log_request_response(
                db, action, request, response, user_id, user_name, details
            )
        
        return response
    
    async def _mock_bloquear_linha(self, numero: str) -> OperadoraResponse:
        """Simulação de bloqueio de linha"""
        import asyncio
        await asyncio.sleep(0.3)
        
        # 95% sucesso, 5% erro
        if random.random() < 0.95:
            return OperadoraResponse(
                success=True,
                status=OperadoraStatus.BLOQUEADO,
                message="Linha bloqueada com sucesso",
                numero=numero,
                data={"numero": numero, "data_bloqueio": datetime.now(timezone.utc).isoformat()},
                raw_response=json.dumps({"status": "blocked"}),
                response_time_ms=random.randint(100, 400)
            )
        else:
            return OperadoraResponse(
                success=False,
                status=OperadoraStatus.ERRO,
                message="Erro ao processar bloqueio",
                error_code="ERR_BLOCK_FAILED",
                raw_response=json.dumps({"error": "internal_error"}),
                response_time_ms=random.randint(500, 1000)
            )
    
    async def _real_bloquear_linha(self, request: OperadoraRequest) -> OperadoraResponse:
        """Implementação real do bloqueio"""
        # TODO: Implementar chamada real
        return await self._mock_bloquear_linha(request.payload["numero"])
    
    # ==================== DESBLOQUEIO ====================
    
    async def desbloquear_linha(
        self,
        numero: str,
        db=None,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None
    ) -> OperadoraResponse:
        """
        Desbloqueia uma linha na operadora.
        """
        request = OperadoraRequest(
            endpoint="/api/v1/linha/desbloquear",
            method="POST",
            payload={"numero": numero},
            timestamp=datetime.now(timezone.utc)
        )
        
        if self.use_mock:
            response = await self._mock_desbloquear_linha(numero)
        else:
            response = await self._real_desbloquear_linha(request)
        
        if db is not None:
            action = "desbloqueio" if response.success else "erro"
            details = f"Desbloqueio de linha: {numero}, Status: {response.status}"
            if not response.success:
                details = f"Erro ao desbloquear linha: {numero}, Erro: {response.message}"
            
            await self._log_request_response(
                db, action, request, response, user_id, user_name, details
            )
        
        return response
    
    async def _mock_desbloquear_linha(self, numero: str) -> OperadoraResponse:
        """Simulação de desbloqueio de linha"""
        import asyncio
        await asyncio.sleep(0.3)
        
        # 95% sucesso, 5% erro
        if random.random() < 0.95:
            return OperadoraResponse(
                success=True,
                status=OperadoraStatus.ATIVO,
                message="Linha desbloqueada com sucesso",
                numero=numero,
                data={"numero": numero, "data_desbloqueio": datetime.now(timezone.utc).isoformat()},
                raw_response=json.dumps({"status": "active"}),
                response_time_ms=random.randint(100, 400)
            )
        else:
            return OperadoraResponse(
                success=False,
                status=OperadoraStatus.ERRO,
                message="Erro ao processar desbloqueio",
                error_code="ERR_UNBLOCK_FAILED",
                raw_response=json.dumps({"error": "internal_error"}),
                response_time_ms=random.randint(500, 1000)
            )
    
    async def _real_desbloquear_linha(self, request: OperadoraRequest) -> OperadoraResponse:
        """Implementação real do desbloqueio"""
        # TODO: Implementar chamada real
        return await self._mock_desbloquear_linha(request.payload["numero"])


# Instância global do serviço
operadora_service = OperadoraService()
