import os
import logging
import httpx
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

ASAAS_SANDBOX_URL = "https://sandbox.asaas.com/api/v3"
ASAAS_PRODUCTION_URL = "https://www.asaas.com/api/v3"


class AsaasService:
    """Servico de integracao com a API do Asaas para cobrancas e assinaturas."""

    def __init__(self):
        self.api_key = os.environ.get("ASAAS_API_KEY", "")
        self.environment = os.environ.get("ASAAS_ENVIRONMENT", "sandbox")
        self.base_url = ASAAS_PRODUCTION_URL if self.environment == "production" else ASAAS_SANDBOX_URL
        self.timeout = int(os.environ.get("ASAAS_TIMEOUT", "30"))

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    def _headers(self) -> dict:
        return {
            "Content-Type": "application/json",
            "User-Agent": "MVNOManager",
            "access_token": self.api_key,
        }

    def get_config_status(self) -> dict:
        return {
            "configured": self.is_configured,
            "environment": self.environment,
            "base_url": self.base_url,
        }

    def _check_configured(self):
        if not self.is_configured:
            raise AsaasNotConfiguredError("Asaas API key nao configurada. Defina ASAAS_API_KEY no .env")

    # ==================== CLIENTES ====================
    async def create_customer(self, name: str, cpf_cnpj: str, email: Optional[str] = None,
                              phone: Optional[str] = None, address: Optional[str] = None,
                              address_number: Optional[str] = None, province: Optional[str] = None,
                              postal_code: Optional[str] = None) -> Dict[str, Any]:
        self._check_configured()
        payload = {
            "name": name,
            "cpfCnpj": cpf_cnpj,
        }
        if email:
            payload["email"] = email
        if phone:
            payload["phone"] = phone
        if address:
            payload["address"] = address
        if address_number:
            payload["addressNumber"] = address_number
        if province:
            payload["province"] = province
        if postal_code:
            payload["postalCode"] = postal_code

        return await self._request("POST", "/customers", payload)

    async def get_customer(self, customer_id: str) -> Dict[str, Any]:
        self._check_configured()
        return await self._request("GET", f"/customers/{customer_id}")

    # ==================== COBRANCAS ====================
    async def create_payment(self, customer_id: str, billing_type: str, value: float,
                             due_date: str, description: Optional[str] = None,
                             external_reference: Optional[str] = None) -> Dict[str, Any]:
        """
        billing_type: BOLETO, CREDIT_CARD, PIX, UNDEFINED
        due_date: formato YYYY-MM-DD
        """
        self._check_configured()
        payload = {
            "customer": customer_id,
            "billingType": billing_type,
            "value": value,
            "dueDate": due_date,
        }
        if description:
            payload["description"] = description
        if external_reference:
            payload["externalReference"] = external_reference

        return await self._request("POST", "/payments", payload)

    async def get_payment(self, payment_id: str) -> Dict[str, Any]:
        self._check_configured()
        return await self._request("GET", f"/payments/{payment_id}")

    async def list_customer_payments(self, customer_id: str, offset: int = 0, limit: int = 50) -> Dict[str, Any]:
        self._check_configured()
        return await self._request("GET", f"/payments?customer={customer_id}&offset={offset}&limit={limit}")

    async def get_pix_qrcode(self, payment_id: str) -> Dict[str, Any]:
        self._check_configured()
        return await self._request("GET", f"/payments/{payment_id}/pixQrCode")

    async def get_boleto_url(self, payment_id: str) -> Dict[str, Any]:
        self._check_configured()
        return await self._request("GET", f"/payments/{payment_id}/identificationField")

    # ==================== ASSINATURAS ====================
    async def create_subscription(self, customer_id: str, billing_type: str, value: float,
                                   next_due_date: str, cycle: str = "MONTHLY",
                                   description: Optional[str] = None,
                                   external_reference: Optional[str] = None) -> Dict[str, Any]:
        """
        cycle: WEEKLY, BIWEEKLY, MONTHLY, BIMONTHLY, QUARTERLY, SEMIANNUALLY, YEARLY
        """
        self._check_configured()
        payload = {
            "customer": customer_id,
            "billingType": billing_type,
            "value": value,
            "nextDueDate": next_due_date,
            "cycle": cycle,
        }
        if description:
            payload["description"] = description
        if external_reference:
            payload["externalReference"] = external_reference

        return await self._request("POST", "/subscriptions", payload)

    async def get_subscription(self, subscription_id: str) -> Dict[str, Any]:
        self._check_configured()
        return await self._request("GET", f"/subscriptions/{subscription_id}")

    async def cancel_subscription(self, subscription_id: str) -> Dict[str, Any]:
        self._check_configured()
        return await self._request("DELETE", f"/subscriptions/{subscription_id}")

    async def list_subscription_payments(self, subscription_id: str) -> Dict[str, Any]:
        self._check_configured()
        return await self._request("GET", f"/subscriptions/{subscription_id}/payments")

    # ==================== HTTP CLIENT ====================
    async def _request(self, method: str, endpoint: str, payload: Optional[dict] = None) -> Dict[str, Any]:
        url = f"{self.base_url}{endpoint}"
        logger.info(f"Asaas API {method} {endpoint}")
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                if method == "GET":
                    response = await client.get(url, headers=self._headers())
                elif method == "POST":
                    response = await client.post(url, headers=self._headers(), json=payload)
                elif method == "PUT":
                    response = await client.put(url, headers=self._headers(), json=payload)
                elif method == "DELETE":
                    response = await client.delete(url, headers=self._headers())
                else:
                    raise ValueError(f"Metodo HTTP nao suportado: {method}")

                if response.status_code >= 400:
                    error_data = response.json() if response.text else {}
                    logger.error(f"Asaas API error {response.status_code}: {error_data}")
                    raise AsaasApiError(
                        f"Erro na API do Asaas ({response.status_code})",
                        status_code=response.status_code,
                        details=error_data
                    )
                return response.json()
        except httpx.TimeoutException:
            logger.error(f"Asaas API timeout: {method} {endpoint}")
            raise AsaasApiError("Timeout na comunicacao com o Asaas", status_code=504)
        except httpx.RequestError as e:
            logger.error(f"Asaas API connection error: {e}")
            raise AsaasApiError(f"Erro de conexao com o Asaas: {str(e)}", status_code=502)


class AsaasNotConfiguredError(Exception):
    pass


class AsaasApiError(Exception):
    def __init__(self, message: str, status_code: int = 500, details: Optional[dict] = None):
        super().__init__(message)
        self.status_code = status_code
        self.details = details or {}


asaas_service = AsaasService()
