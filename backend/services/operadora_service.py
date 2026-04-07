"""
Servico de Integracao com Operadora Ta Telecom

Centraliza TODAS as chamadas para a API MVNO da Ta Telecom.
Nenhuma chamada a operadora deve ser feita fora deste servico.

Configuracao via variaveis de ambiente:
- USE_MOCK_API: "true" para mock, "false" para API real
- TATELECOM_API_URL: URL base da API
- TATELECOM_USER_TOKEN: Token de autenticacao
- TATELECOM_TIMEOUT: Timeout em segundos
"""

import os
import random
import json
import logging
import httpx
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Tuple, List
from dataclasses import dataclass, field
from enum import Enum
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)

# ==================== CONFIGURACAO ====================
USE_MOCK_API = os.environ.get("USE_MOCK_API", "true").lower() == "true"
TATELECOM_API_URL = os.environ.get("TATELECOM_API_URL", "http://sistema.tatelecom.com.br/api/public")
TATELECOM_USER_TOKEN = os.environ.get("TATELECOM_USER_TOKEN", "")
TATELECOM_TIMEOUT = int(os.environ.get("TATELECOM_TIMEOUT", "30"))


# ==================== ENUMS ====================
class OperadoraStatus(str, Enum):
    ATIVO = "ativo"
    PENDENTE = "pendente"
    BLOQUEADO = "bloqueado"
    ERRO = "erro"
    CANCELADO = "cancelado"


class ErrorCode(str, Enum):
    TIMEOUT = "ERR_TIMEOUT"
    CONNECTION = "ERR_CONNECTION"
    AUTHENTICATION = "ERR_AUTH"
    NOT_FOUND = "ERR_NOT_FOUND"
    VALIDATION = "ERR_VALIDATION"
    SERVER_ERROR = "ERR_SERVER"
    UNKNOWN = "ERR_UNKNOWN"


BLOCK_REASONS = {
    1: "Roubo",
    2: "Perda",
    3: "Uso indevido",
    4: "Inadimplencia",
    5: "Suspensao temporaria",
}

STOCK_STATUS_MAP = {
    1: "disponivel",
    2: "cancelado",
    3: "ativado",
}


# ==================== DATA CLASSES ====================
@dataclass
class OperadoraRequest:
    endpoint: str
    method: str
    payload: Dict[str, Any]
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "endpoint": self.endpoint,
            "method": self.method,
            "payload": self.payload,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class OperadoraResponse:
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
            "response_time_ms": self.response_time_ms,
            "http_status_code": self.http_status_code,
        }


# ==================== INTERFACE ABSTRATA ====================
class IOperadoraAdapter(ABC):

    @abstractmethod
    async def listar_planos(self) -> Tuple[OperadoraRequest, OperadoraResponse]:
        pass

    @abstractmethod
    async def listar_estoque(self) -> Tuple[OperadoraRequest, OperadoraResponse]:
        pass

    @abstractmethod
    async def ativar_chip(self, iccid: str, payload: dict) -> Tuple[OperadoraRequest, OperadoraResponse]:
        pass

    @abstractmethod
    async def consultar_linha(self, iccid: str) -> Tuple[OperadoraRequest, OperadoraResponse]:
        pass

    @abstractmethod
    async def bloquear_parcial(self, iccid: str) -> Tuple[OperadoraRequest, OperadoraResponse]:
        pass

    @abstractmethod
    async def bloquear_total(self, iccid: str, reason: int) -> Tuple[OperadoraRequest, OperadoraResponse]:
        pass

    @abstractmethod
    async def desbloquear(self, iccid: str) -> Tuple[OperadoraRequest, OperadoraResponse]:
        pass

    @abstractmethod
    async def alterar_plano(self, iccid: str, plan_code: str) -> Tuple[OperadoraRequest, OperadoraResponse]:
        pass


# ==================== MOCK ADAPTER ====================
class MockTaTelecomAdapter(IOperadoraAdapter):

    async def listar_planos(self) -> Tuple[OperadoraRequest, OperadoraResponse]:
        import asyncio
        await asyncio.sleep(0.3)
        req = OperadoraRequest(endpoint="/planos", method="GET", payload={})
        plans = [
            {"plan_code": "MOCK_5GB", "description": "Plano 5GB Mock", "data_limit": "5GB"},
            {"plan_code": "MOCK_10GB", "description": "Plano 10GB Mock", "data_limit": "10GB"},
            {"plan_code": "MOCK_20GB", "description": "Plano 20GB Mock", "data_limit": "20GB"},
        ]
        resp = OperadoraResponse(
            success=True, status="ok", message="Planos listados (mock)",
            data={"plans": plans}, response_time_ms=300, http_status_code=200,
        )
        return req, resp

    async def listar_estoque(self) -> Tuple[OperadoraRequest, OperadoraResponse]:
        import asyncio
        await asyncio.sleep(0.3)
        req = OperadoraRequest(endpoint="/estoque/listar", method="GET", payload={})
        items = [
            {"iccid": f"895501001234567890{i}", "status": 1, "msisdn": None}
            for i in range(1, 6)
        ]
        resp = OperadoraResponse(
            success=True, status="ok", message="Estoque listado (mock)",
            data={"items": items}, response_time_ms=300, http_status_code=200,
        )
        return req, resp

    async def ativar_chip(self, iccid: str, payload: dict) -> Tuple[OperadoraRequest, OperadoraResponse]:
        import asyncio
        await asyncio.sleep(random.uniform(0.3, 0.8))
        req = OperadoraRequest(endpoint=f"/simcard/{iccid}/ativar", method="POST", payload=payload)
        scenario = random.choices(["sucesso", "pendente", "erro"], weights=[70, 20, 10], k=1)[0]
        rt = random.randint(200, 800)
        if scenario == "sucesso":
            numero = f"11{random.randint(900000000, 999999999)}"
            resp = OperadoraResponse(
                success=True, status=OperadoraStatus.ATIVO, message="Chip ativado com sucesso (mock)",
                numero=numero, data={"msisdn": numero, "protocolo": f"ATIV{random.randint(100000,999999)}"},
                response_time_ms=rt, http_status_code=200,
            )
        elif scenario == "pendente":
            resp = OperadoraResponse(
                success=True, status=OperadoraStatus.PENDENTE,
                message="Ativacao em processamento (mock)", numero=None,
                data={"protocolo": f"PEND{random.randint(100000,999999)}"},
                response_time_ms=rt, http_status_code=202,
            )
        else:
            resp = OperadoraResponse(
                success=False, status=OperadoraStatus.ERRO,
                message="Falha na comunicacao com a operadora (mock)",
                error_code=ErrorCode.SERVER_ERROR, response_time_ms=rt, http_status_code=500,
            )
        return req, resp

    async def listar_estoque_completo(self) -> Tuple[OperadoraRequest, OperadoraResponse]:
        return await self.listar_estoque()

    async def consultar_linha(self, iccid: str) -> Tuple[OperadoraRequest, OperadoraResponse]:
        import asyncio
        await asyncio.sleep(0.3)
        req = OperadoraRequest(endpoint=f"/estoque/{iccid}", method="GET", payload={})
        resp = OperadoraResponse(
            success=True, status=OperadoraStatus.ATIVO, message="Consulta realizada (mock)",
            numero=f"11{random.randint(900000000,999999999)}",
            data={
                "iccid": iccid, "status": 3, "msisdn": f"11{random.randint(900000000,999999999)}",
                "subscriber_name": "Cliente Mock", "document_number": "12345678900",
                "plan_code": "MOCK_10GB", "activation_date": datetime.now(timezone.utc).isoformat(),
            },
            response_time_ms=300, http_status_code=200,
        )
        return req, resp

    async def bloquear_parcial(self, iccid: str) -> Tuple[OperadoraRequest, OperadoraResponse]:
        import asyncio
        await asyncio.sleep(0.3)
        req = OperadoraRequest(endpoint=f"/simcard/{iccid}/bloquear/parcial", method="POST", payload={})
        resp = OperadoraResponse(
            success=True, status=OperadoraStatus.BLOQUEADO,
            message="Bloqueio parcial realizado (mock)", response_time_ms=300, http_status_code=200,
        )
        return req, resp

    async def bloquear_total(self, iccid: str, reason: int) -> Tuple[OperadoraRequest, OperadoraResponse]:
        import asyncio
        await asyncio.sleep(0.3)
        req = OperadoraRequest(endpoint=f"/simcard/{iccid}/bloquear/total", method="POST", payload={"reason": reason})
        resp = OperadoraResponse(
            success=True, status=OperadoraStatus.BLOQUEADO,
            message=f"Bloqueio total realizado - motivo: {BLOCK_REASONS.get(reason, 'N/A')} (mock)",
            response_time_ms=300, http_status_code=200,
        )
        return req, resp

    async def desbloquear(self, iccid: str) -> Tuple[OperadoraRequest, OperadoraResponse]:
        import asyncio
        await asyncio.sleep(0.3)
        req = OperadoraRequest(endpoint=f"/simcard/{iccid}/desbloquear", method="POST", payload={})
        resp = OperadoraResponse(
            success=True, status=OperadoraStatus.ATIVO,
            message="Linha desbloqueada (mock)", response_time_ms=300, http_status_code=200,
        )
        return req, resp

    async def alterar_plano(self, iccid: str, plan_code: str) -> Tuple[OperadoraRequest, OperadoraResponse]:
        import asyncio
        await asyncio.sleep(0.3)
        req = OperadoraRequest(endpoint=f"/simcard/{iccid}/plano/alterar", method="POST", payload={"plan_code": plan_code})
        resp = OperadoraResponse(
            success=True, status=OperadoraStatus.ATIVO,
            message=f"Plano alterado para {plan_code} (mock)", response_time_ms=300, http_status_code=200,
        )
        return req, resp

    async def consultar_saldo_dados(self, numero: str) -> Tuple[OperadoraRequest, OperadoraResponse]:
        import asyncio
        await asyncio.sleep(0.3)
        req = OperadoraRequest(endpoint=f"/saldo/{numero}/dados", method="POST", payload={})
        resp = OperadoraResponse(
            success=True, status="ok", message="Saldo consultado (mock)",
            data={"balance": random.uniform(500, 8000), "codigo_status_tip": "0"},
            response_time_ms=300, http_status_code=200,
        )
        return req, resp

    async def consultar_status_portabilidade(self, numero_ou_iccid: str) -> Tuple[OperadoraRequest, OperadoraResponse]:
        import asyncio
        await asyncio.sleep(0.3)
        req = OperadoraRequest(endpoint=f"/portabilidade/status/{numero_ou_iccid}", method="GET", payload={})
        statuses = ["EM USO", "AGUARDANDO JANELA", "PORTABILIDADE CONCLUIDA", "PENDENTE"]
        chosen = random.choice(statuses)
        resp = OperadoraResponse(
            success=True, status="ok", message=f"Status portabilidade consultado (mock)",
            data={
                "codigo_status_tip": 0, "status": chosen,
                "msg_usuario": f"Portabilidade {chosen} (mock)",
                "simcard": numero_ou_iccid,
                "janela": "2026-04-10 03:00" if chosen == "AGUARDANDO JANELA" else None,
                "chip_status": "Ativo",
                "erro_info": "",
            },
            response_time_ms=300, http_status_code=200,
        )
        return req, resp

    async def consultar_consumo_consolidado(self, periodo: str, cpf_cnpj: str = None, linha: str = None) -> Tuple[OperadoraRequest, OperadoraResponse]:
        import asyncio
        await asyncio.sleep(0.3)
        payload = {"periodo": periodo}
        req = OperadoraRequest(endpoint="/consumoconsolidado", method="POST", payload=payload)
        resp = OperadoraResponse(
            success=True, status="ok", message="Consumo consultado (mock)",
            data={"codigo_status_tip": 0, "results": [{
                "consumo_sms": random.randint(0, 50),
                "consumo_dados": f"{random.uniform(0.5, 4.5):.5f}",
                "consumo_segundos": str(random.randint(100, 5000)),
                "consumo_minutos": f"{random.uniform(1, 80):.3f}",
                "periodo": periodo,
                "contrato_status": "ATIVO",
                "simcard_status": "EM USO",
                "plano": "Ta Telecom 10GB",
                "linha": linha or numero if 'numero' in dir() else "11999999999",
                "cliente_nome": "Cliente Mock",
            }]},
            response_time_ms=300, http_status_code=200,
        )
        return req, resp


# ==================== REAL TA TELECOM ADAPTER ====================
class RealTaTelecomAdapter(IOperadoraAdapter):

    def __init__(self, base_url: str, user_token: str, timeout: int = TATELECOM_TIMEOUT):
        self.base_url = base_url.rstrip("/")
        self.user_token = user_token
        self.timeout = timeout

    def _url(self, path: str) -> str:
        sep = "&" if "?" in path else "?"
        return f"{self.base_url}{path}{sep}user_token={self.user_token}"

    async def _request(self, method: str, path: str, payload: Optional[dict] = None) -> Tuple[OperadoraRequest, OperadoraResponse]:
        req = OperadoraRequest(endpoint=path, method=method, payload=payload or {})
        url = self._url(path)
        start = datetime.now(timezone.utc)
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                if method == "GET":
                    r = await client.get(url)
                else:
                    r = await client.post(url, json=payload)
                elapsed = int((datetime.now(timezone.utc) - start).total_seconds() * 1000)
                try:
                    data = r.json()
                except Exception:
                    data = {"raw": r.text}
                if 200 <= r.status_code < 300:
                    # Ta Telecom API can return list or dict
                    if isinstance(data, list):
                        wrapped = {"items": data}
                    else:
                        wrapped = data
                    msg = wrapped.get("message", "OK") if isinstance(wrapped, dict) else "OK"
                    return req, OperadoraResponse(
                        success=True, status="ok", message=msg,
                        data=wrapped, raw_response=r.text, response_time_ms=elapsed, http_status_code=r.status_code,
                    )
                elif r.status_code in (401, 403):
                    err_data = data if isinstance(data, dict) else {"raw": data}
                    return req, OperadoraResponse(
                        success=False, status=OperadoraStatus.ERRO, message=err_data.get("message", "Erro de autenticacao"),
                        error_code=ErrorCode.AUTHENTICATION, raw_response=r.text, response_time_ms=elapsed, http_status_code=r.status_code,
                    )
                elif r.status_code == 404:
                    err_data = data if isinstance(data, dict) else {"raw": data}
                    return req, OperadoraResponse(
                        success=False, status=OperadoraStatus.ERRO, message=err_data.get("message", "Nao encontrado"),
                        error_code=ErrorCode.NOT_FOUND, raw_response=r.text, response_time_ms=elapsed, http_status_code=r.status_code,
                    )
                elif 400 <= r.status_code < 500:
                    err_data = data if isinstance(data, dict) else {"raw": data}
                    return req, OperadoraResponse(
                        success=False, status=OperadoraStatus.ERRO,
                        message=err_data.get("message", f"Erro de validacao ({r.status_code})"),
                        data=err_data, error_code=ErrorCode.VALIDATION, raw_response=r.text, response_time_ms=elapsed, http_status_code=r.status_code,
                    )
                else:
                    err_data = data if isinstance(data, dict) else {"raw": data}
                    return req, OperadoraResponse(
                        success=False, status=OperadoraStatus.ERRO,
                        message=err_data.get("message", f"Erro do servidor ({r.status_code})"),
                        error_code=ErrorCode.SERVER_ERROR, raw_response=r.text, response_time_ms=elapsed, http_status_code=r.status_code,
                    )
        except httpx.TimeoutException:
            elapsed = int((datetime.now(timezone.utc) - start).total_seconds() * 1000)
            return req, OperadoraResponse(
                success=False, status=OperadoraStatus.ERRO,
                message=f"Timeout ({self.timeout}s)", error_code=ErrorCode.TIMEOUT, response_time_ms=elapsed,
            )
        except httpx.ConnectError as e:
            elapsed = int((datetime.now(timezone.utc) - start).total_seconds() * 1000)
            return req, OperadoraResponse(
                success=False, status=OperadoraStatus.ERRO,
                message=f"Erro de conexao: {e}", error_code=ErrorCode.CONNECTION, response_time_ms=elapsed,
            )
        except Exception as e:
            elapsed = int((datetime.now(timezone.utc) - start).total_seconds() * 1000)
            return req, OperadoraResponse(
                success=False, status=OperadoraStatus.ERRO,
                message=f"Erro inesperado: {e}", error_code=ErrorCode.UNKNOWN, response_time_ms=elapsed,
            )

    async def listar_planos(self) -> Tuple[OperadoraRequest, OperadoraResponse]:
        return await self._request("GET", "/planos")

    async def listar_estoque(self, status: int = None) -> Tuple[OperadoraRequest, OperadoraResponse]:
        params = "?per_page=500"
        if status is not None:
            params += f"&status={status}"
        return await self._request("GET", f"/estoque/listar{params}")

    async def listar_estoque_completo(self) -> Tuple[OperadoraRequest, OperadoraResponse]:
        """Busca estoque completo com paginacao automatica e todos os status."""
        all_items = []
        # Buscar com cada status relevante: 1=DISPONÍVEL, 3=EM USO
        for st in [1, 3]:
            page = 1
            while True:
                try:
                    req, resp = await self._request("GET", f"/estoque/listar?status={st}&page={page}&per_page=500")
                    if not resp.success or not resp.data:
                        break
                    items = resp.data.get("results", resp.data.get("items", resp.data.get("data", [])))
                    if isinstance(items, dict):
                        items = items.get("results", items.get("items", []))
                    if not isinstance(items, list) or len(items) == 0:
                        break
                    all_items.extend(items)
                    logger.info(f"Estoque status={st} page={page}: {len(items)} chips")
                    # Se retornou menos que per_page, é a última página
                    if len(items) < 500:
                        break
                    page += 1
                except Exception as e:
                    logger.warning(f"Erro ao buscar estoque status={st} page={page}: {e}")
                    break
        # Fallback: buscar sem filtro de status (pode pegar os que faltam)
        page = 1
        existing_iccids = {str(i.get("sim_card") or i.get("iccid") or "") for i in all_items}
        while True:
            try:
                req, resp = await self._request("GET", f"/estoque/listar?page={page}&per_page=500")
                if not resp.success or not resp.data:
                    break
                items = resp.data.get("results", resp.data.get("items", resp.data.get("data", [])))
                if isinstance(items, dict):
                    items = items.get("results", items.get("items", []))
                if not isinstance(items, list) or len(items) == 0:
                    break
                for item in items:
                    iccid = str(item.get("sim_card") or item.get("iccid") or "")
                    if iccid and iccid not in existing_iccids:
                        all_items.append(item)
                        existing_iccids.add(iccid)
                if len(items) < 500:
                    break
                page += 1
            except Exception:
                break

        logger.info(f"Estoque completo: {len(all_items)} chips total")
        final_resp = OperadoraResponse(
            success=True, status="ok",
            message=f"Estoque completo: {len(all_items)} chips",
            data={"results": all_items},
            response_time_ms=0, http_status_code=200,
        )
        return req if 'req' in dir() else OperadoraRequest(endpoint="/estoque/listar", method="GET", payload={}), final_resp

    async def ativar_chip(self, iccid: str, payload: dict) -> Tuple[OperadoraRequest, OperadoraResponse]:
        return await self._request("POST", f"/simcard/{iccid}/ativar", payload)

    async def consultar_linha(self, iccid: str) -> Tuple[OperadoraRequest, OperadoraResponse]:
        return await self._request("GET", f"/estoque/{iccid}")

    async def bloquear_parcial(self, iccid: str) -> Tuple[OperadoraRequest, OperadoraResponse]:
        return await self._request("POST", f"/simcard/{iccid}/bloquear/parcial")

    async def bloquear_total(self, iccid: str, reason: int) -> Tuple[OperadoraRequest, OperadoraResponse]:
        return await self._request("POST", f"/simcard/{iccid}/bloquear/total", {"reason": reason})

    async def desbloquear(self, iccid: str) -> Tuple[OperadoraRequest, OperadoraResponse]:
        return await self._request("POST", f"/simcard/{iccid}/desbloquear")

    async def alterar_plano(self, iccid: str, plan_code: str) -> Tuple[OperadoraRequest, OperadoraResponse]:
        return await self._request("POST", f"/simcard/{iccid}/plano/alterar", {"plan_code": plan_code})

    async def consultar_saldo_dados(self, numero: str) -> Tuple[OperadoraRequest, OperadoraResponse]:
        return await self._request("POST", f"/saldo/{numero}/dados")

    async def consultar_status_portabilidade(self, numero_ou_iccid: str) -> Tuple[OperadoraRequest, OperadoraResponse]:
        return await self._request("GET", f"/portabilidade/status/{numero_ou_iccid}")

    async def consultar_consumo_consolidado(self, periodo: str, cpf_cnpj: str = None, linha: str = None) -> Tuple[OperadoraRequest, OperadoraResponse]:
        payload = {"periodo": periodo}
        if cpf_cnpj:
            payload["cpf_cnpj"] = cpf_cnpj
        if linha:
            payload["linha_contrato"] = linha
        return await self._request("POST", "/consumoconsolidado", payload)


# ==================== SERVICO PRINCIPAL ====================
class OperadoraService:

    def __init__(self, use_mock: Optional[bool] = None):
        if use_mock is not None:
            self.use_mock = use_mock
        else:
            self.use_mock = USE_MOCK_API
        if not self.use_mock and not TATELECOM_USER_TOKEN:
            logger.warning("TATELECOM_USER_TOKEN nao configurado. Usando modo mock.")
            self.use_mock = True
        if self.use_mock:
            self.adapter: IOperadoraAdapter = MockTaTelecomAdapter()
            logger.info("OperadoraService iniciado em modo MOCK")
        else:
            self.adapter = RealTaTelecomAdapter(TATELECOM_API_URL, TATELECOM_USER_TOKEN, TATELECOM_TIMEOUT)
            logger.info(f"OperadoraService iniciado em modo REAL - URL: {TATELECOM_API_URL}")

    def get_config_status(self):
        return {
            "mode": "mock" if self.use_mock else "real",
            "api_url": TATELECOM_API_URL if not self.use_mock else "mock",
            "has_token": bool(TATELECOM_USER_TOKEN) and not self.use_mock,
        }

    async def load_config_from_db(self, db):
        """Carrega config Tá Telecom do MongoDB."""
        try:
            config = await db.system_config.find_one({"key": "tatelecom_config"})
            if config and config.get("api_url") and config.get("user_token"):
                stored_url = config["api_url"]
                stored_token = config["user_token"]
                if stored_token and len(stored_token) > 5:
                    self.use_mock = False
                    self.adapter = RealTaTelecomAdapter(stored_url, stored_token, TATELECOM_TIMEOUT)
                    logger.info(f"TaTelecom config loaded from DB: url={stored_url}, token_len={len(stored_token)}")
            elif not self.use_mock and TATELECOM_USER_TOKEN:
                # .env has token but DB doesn't — migrate
                await self.save_config_to_db(db)
                logger.info("TaTelecom config migrated from .env to DB")
        except Exception as e:
            logger.warning(f"Failed to load TaTelecom config from DB: {e}")

    async def save_config_to_db(self, db):
        """Persiste config Tá Telecom no MongoDB."""
        if self.use_mock:
            return
        try:
            adapter = self.adapter
            if hasattr(adapter, 'base_url') and hasattr(adapter, 'user_token'):
                await db.system_config.update_one(
                    {"key": "tatelecom_config"},
                    {"$set": {
                        "key": "tatelecom_config",
                        "api_url": adapter.base_url,
                        "user_token": adapter.user_token,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }},
                    upsert=True,
                )
                logger.info("TaTelecom config saved to DB")
        except Exception as e:
            logger.warning(f"Failed to save TaTelecom config to DB: {e}")

    async def _save_log(self, db, action: str, request: OperadoraRequest, response: OperadoraResponse,
                        user_id: Optional[str] = None, user_name: Optional[str] = None,
                        extra_details: Optional[str] = None):
        if db is None:
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
        }
        try:
            await db.logs.insert_one(log_entry)
        except Exception as e:
            logger.error(f"Erro ao salvar log: {e}")

    # ---------- Listar Planos ----------
    async def listar_planos(self, db=None, user_id=None, user_name=None) -> OperadoraResponse:
        req, resp = await self.adapter.listar_planos()
        await self._save_log(db, "api_call", req, resp, user_id, user_name, "Sincronizacao de planos da operadora")
        return resp

    # ---------- Listar Estoque ----------
    async def listar_estoque(self, db=None, user_id=None, user_name=None) -> OperadoraResponse:
        req, resp = await self.adapter.listar_estoque()
        await self._save_log(db, "api_call", req, resp, user_id, user_name, "Sincronizacao de estoque da operadora")
        return resp

    # ---------- Listar Estoque Completo (todos os status) ----------
    async def listar_estoque_completo(self, db=None, user_id=None, user_name=None) -> OperadoraResponse:
        if hasattr(self.adapter, 'listar_estoque_completo'):
            req, resp = await self.adapter.listar_estoque_completo()
        else:
            req, resp = await self.adapter.listar_estoque()
        await self._save_log(db, "api_call", req, resp, user_id, user_name, "Sincronizacao completa de estoque (todos status)")
        return resp

    # ---------- Ativar Chip ----------
    async def ativar_chip(self, iccid: str, activation_payload: dict,
                          db=None, user_id=None, user_name=None) -> OperadoraResponse:
        req, resp = await self.adapter.ativar_chip(iccid, activation_payload)
        action = "ativacao" if resp.success else "erro"
        details = f"Ativacao ICCID: {iccid} - {'Sucesso' if resp.success else 'Erro: ' + str(resp.message)}"
        await self._save_log(db, action, req, resp, user_id, user_name, details)
        return resp

    # ---------- Consultar Linha ----------
    async def consultar_linha(self, iccid: str, db=None, user_id=None, user_name=None) -> OperadoraResponse:
        req, resp = await self.adapter.consultar_linha(iccid)
        await self._save_log(db, "consulta", req, resp, user_id, user_name, f"Consulta linha ICCID: {iccid}")
        return resp

    # ---------- Bloquear Parcial ----------
    async def bloquear_parcial(self, iccid: str, db=None, user_id=None, user_name=None) -> OperadoraResponse:
        req, resp = await self.adapter.bloquear_parcial(iccid)
        action = "bloqueio" if resp.success else "erro"
        await self._save_log(db, action, req, resp, user_id, user_name, f"Bloqueio parcial ICCID: {iccid}")
        return resp

    # ---------- Bloquear Total ----------
    async def bloquear_total(self, iccid: str, reason: int, db=None, user_id=None, user_name=None) -> OperadoraResponse:
        req, resp = await self.adapter.bloquear_total(iccid, reason)
        action = "bloqueio" if resp.success else "erro"
        motivo = BLOCK_REASONS.get(reason, f"Codigo {reason}")
        await self._save_log(db, action, req, resp, user_id, user_name, f"Bloqueio total ICCID: {iccid} - Motivo: {motivo}")
        return resp

    # ---------- Desbloquear ----------
    async def desbloquear(self, iccid: str, db=None, user_id=None, user_name=None) -> OperadoraResponse:
        req, resp = await self.adapter.desbloquear(iccid)
        action = "desbloqueio" if resp.success else "erro"
        await self._save_log(db, action, req, resp, user_id, user_name, f"Desbloqueio ICCID: {iccid}")
        return resp

    # ---------- Alterar Plano ----------
    async def alterar_plano(self, iccid: str, plan_code: str, db=None, user_id=None, user_name=None) -> OperadoraResponse:
        req, resp = await self.adapter.alterar_plano(iccid, plan_code)
        action = "alteracao_plano" if resp.success else "erro"
        await self._save_log(db, action, req, resp, user_id, user_name, f"Alteracao plano ICCID: {iccid} -> {plan_code}")
        return resp

    # ---------- Consultar Saldo de Dados ----------
    async def consultar_saldo_dados(self, numero: str, db=None, user_id=None, user_name=None) -> OperadoraResponse:
        req, resp = await self.adapter.consultar_saldo_dados(numero)
        await self._save_log(db, "consulta_saldo", req, resp, user_id, user_name, f"Consulta saldo dados: {numero}")
        return resp

    # ---------- Consultar Status Portabilidade ----------
    async def consultar_status_portabilidade(self, numero_ou_iccid: str, db=None, user_id=None, user_name=None) -> OperadoraResponse:
        req, resp = await self.adapter.consultar_status_portabilidade(numero_ou_iccid)
        await self._save_log(db, "consulta_portabilidade", req, resp, user_id, user_name, f"Status portabilidade: {numero_ou_iccid}")
        return resp

    # ---------- Consultar Consumo Consolidado ----------
    async def consultar_consumo_consolidado(self, periodo: str, cpf_cnpj: str = None, linha: str = None,
                                             db=None, user_id=None, user_name=None) -> OperadoraResponse:
        req, resp = await self.adapter.consultar_consumo_consolidado(periodo, cpf_cnpj, linha)
        await self._save_log(db, "consulta_consumo", req, resp, user_id, user_name, f"Consumo consolidado: {periodo}")
        return resp

    def get_config_status(self) -> dict:
        return {
            "mode": "mock" if self.use_mock else "real",
            "api_url": TATELECOM_API_URL if not self.use_mock else None,
            "token_configured": bool(TATELECOM_USER_TOKEN),
            "timeout": TATELECOM_TIMEOUT,
        }


# ==================== INSTANCIA GLOBAL ====================
operadora_service = OperadoraService()
