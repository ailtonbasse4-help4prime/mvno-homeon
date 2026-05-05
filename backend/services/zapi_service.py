"""Z-API service - integracao com WhatsApp via Z-API.

Documentacao: https://developer.z-api.io/

Auth:
  - URL: https://api.z-api.io/instances/{instance_id}/token/{token}/send-text
  - Header: Client-Token: {client_token}
"""
import asyncio
import logging
import re
from datetime import datetime, timezone
from typing import Optional, Dict, Any
import httpx

logger = logging.getLogger(__name__)


class ZapiService:
    def __init__(self):
        self.instance_id: Optional[str] = None
        self.token: Optional[str] = None
        self.client_token: Optional[str] = None
        self.base_url = "https://api.z-api.io"
        self._db = None
        self._loaded = False

    async def load_config(self, db):
        """Carrega config da collection 'config' (key='zapi')."""
        self._db = db
        cfg = await db.config.find_one({"key": "zapi"})
        if cfg:
            self.instance_id = cfg.get("instance_id")
            self.token = cfg.get("token")
            self.client_token = cfg.get("client_token")
            self._loaded = True
            logger.info(
                f"Z-API config loaded: instance={self.instance_id[:8] if self.instance_id else 'NONE'}..., "
                f"token_len={len(self.token) if self.token else 0}, "
                f"client_token_len={len(self.client_token) if self.client_token else 0}"
            )
        else:
            logger.warning("Z-API config nao encontrada em db.config (key=zapi)")

    def is_configured(self) -> bool:
        return bool(self.instance_id and self.token and self.client_token)

    async def save_config(self, db, instance_id: str, token: str, client_token: str):
        await db.config.update_one(
            {"key": "zapi"},
            {"$set": {
                "key": "zapi",
                "instance_id": instance_id,
                "token": token,
                "client_token": client_token,
                "updated_at": datetime.now(timezone.utc),
            }},
            upsert=True,
        )
        self.instance_id = instance_id
        self.token = token
        self.client_token = client_token
        self._loaded = True

    @staticmethod
    def normalize_phone(phone: str) -> Optional[str]:
        """Normaliza telefone BR para formato Z-API (somente digitos com DDI 55)."""
        if not phone:
            return None
        digits = re.sub(r"\D", "", str(phone))
        if not digits:
            return None
        # Remove zeros à esquerda
        digits = digits.lstrip("0")
        # Se nao tem DDI 55, adiciona
        if len(digits) <= 11:
            digits = "55" + digits
        # Validacao basica: 12-13 digitos (55 + DDD2 + numero8/9)
        if len(digits) < 12 or len(digits) > 13:
            return None
        return digits

    async def send_text(self, phone: str, message: str) -> Dict[str, Any]:
        """Envia mensagem de texto. Retorna dict com {success, message_id?, error?}."""
        if not self.is_configured():
            return {"success": False, "error": "Z-API nao configurado"}
        normalized = self.normalize_phone(phone)
        if not normalized:
            return {"success": False, "error": f"Telefone invalido: {phone}"}

        url = f"{self.base_url}/instances/{self.instance_id}/token/{self.token}/send-text"
        headers = {
            "Client-Token": self.client_token,
            "Content-Type": "application/json",
        }
        payload = {"phone": normalized, "message": message}

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                r = await client.post(url, json=payload, headers=headers)
                if r.status_code in (200, 201):
                    data = r.json() if r.text else {}
                    return {
                        "success": True,
                        "message_id": data.get("messageId") or data.get("id"),
                        "phone_normalized": normalized,
                        "raw": data,
                    }
                return {
                    "success": False,
                    "status_code": r.status_code,
                    "error": (r.text or "")[:300],
                }
        except httpx.TimeoutException:
            return {"success": False, "error": "Timeout (Z-API sem resposta em 20s)"}
        except Exception as e:
            return {"success": False, "error": f"{type(e).__name__}: {str(e)[:200]}"}

    async def status_instance(self) -> Dict[str, Any]:
        """Verifica se a instancia esta conectada (QR Code escaneado)."""
        if not self.is_configured():
            return {"configured": False}
        url = f"{self.base_url}/instances/{self.instance_id}/token/{self.token}/status"
        headers = {"Client-Token": self.client_token}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(url, headers=headers)
                if r.status_code == 200:
                    return {"configured": True, "data": r.json()}
                return {"configured": True, "error": r.text[:200], "status_code": r.status_code}
        except Exception as e:
            return {"configured": True, "error": str(e)[:200]}


zapi_service = ZapiService()
