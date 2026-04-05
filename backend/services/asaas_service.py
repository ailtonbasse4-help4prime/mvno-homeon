import os
import logging
import httpx
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

ASAAS_SANDBOX_URL = "https://sandbox.asaas.com/api/v3"
ASAAS_PRODUCTION_URL = "https://www.asaas.com/api/v3"


class AsaasService:
    """Servico de integracao com a API do Asaas para cobrancas e assinaturas."""

    def __init__(self):
        raw_key = os.environ.get("ASAAS_API_KEY", "")
        # Sanitize: python-dotenv may strip leading $ if .env is unquoted
        # If key doesn't start with $ but should (hmlg or production key), prepend it
        if raw_key and not raw_key.startswith("$") and (raw_key.startswith("aact_") or raw_key.startswith("aach_")):
            raw_key = "$" + raw_key
        self.api_key = raw_key
        self.environment = os.environ.get("ASAAS_ENVIRONMENT", "sandbox")
        self.base_url = ASAAS_PRODUCTION_URL if self.environment == "production" else ASAAS_SANDBOX_URL
        self.timeout = int(os.environ.get("ASAAS_TIMEOUT", "30"))

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    def _headers(self) -> dict:
        return {
            "Content-Type": "application/json",
            "User-Agent": "MVNOManager/1.0",
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
        payload = {"name": name, "cpfCnpj": cpf_cnpj}
        if email:
            payload["email"] = email
        if phone:
            payload["mobilePhone"] = phone
        if address:
            payload["address"] = address
        if address_number:
            payload["addressNumber"] = address_number
        if province:
            payload["province"] = province
        if postal_code:
            payload["postalCode"] = postal_code
        return await self._request("POST", "/customers", payload)

    async def find_customer_by_cpf(self, cpf_cnpj: str) -> Optional[Dict[str, Any]]:
        self._check_configured()
        result = await self._request("GET", f"/customers?cpfCnpj={cpf_cnpj}")
        data = result.get("data", [])
        return data[0] if data else None

    async def get_or_create_customer(self, name: str, cpf_cnpj: str, **kwargs) -> Dict[str, Any]:
        existing = await self.find_customer_by_cpf(cpf_cnpj)
        if existing:
            return existing
        return await self.create_customer(name, cpf_cnpj, **kwargs)

    async def list_customers(self, offset: int = 0, limit: int = 50) -> Dict[str, Any]:
        self._check_configured()
        return await self._request("GET", f"/customers?offset={offset}&limit={limit}")

    # ==================== COBRANCAS ====================
    async def create_payment(self, customer_id: str, billing_type: str, value: float,
                             due_date: str, description: Optional[str] = None,
                             external_reference: Optional[str] = None,
                             discount_value: Optional[float] = None,
                             fine_value: Optional[float] = None,
                             interest_value: Optional[float] = None) -> Dict[str, Any]:
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
        if discount_value:
            payload["discount"] = {"value": discount_value, "dueDateLimitDays": 0}
        if fine_value:
            payload["fine"] = {"value": fine_value}
        if interest_value:
            payload["interest"] = {"value": interest_value}
        return await self._request("POST", "/payments", payload)

    async def create_payments_batch(self, payments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Cria multiplas cobrancas de uma vez."""
        self._check_configured()
        results = []
        for p in payments:
            try:
                result = await self.create_payment(**p)
                results.append({"success": True, "data": result})
            except Exception as e:
                results.append({"success": False, "error": str(e), "input": p})
        return results

    async def get_payment(self, payment_id: str) -> Dict[str, Any]:
        self._check_configured()
        return await self._request("GET", f"/payments/{payment_id}")

    async def update_payment(self, payment_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        self._check_configured()
        return await self._request("PUT", f"/payments/{payment_id}", data)

    async def delete_payment(self, payment_id: str) -> Dict[str, Any]:
        self._check_configured()
        return await self._request("DELETE", f"/payments/{payment_id}")

    async def list_payments(self, offset: int = 0, limit: int = 50,
                            status: Optional[str] = None,
                            customer_id: Optional[str] = None,
                            billing_type: Optional[str] = None,
                            date_from: Optional[str] = None,
                            date_to: Optional[str] = None) -> Dict[str, Any]:
        self._check_configured()
        params = f"?offset={offset}&limit={limit}"
        if status:
            params += f"&status={status}"
        if customer_id:
            params += f"&customer={customer_id}"
        if billing_type:
            params += f"&billingType={billing_type}"
        if date_from:
            params += f"&dueDate[ge]={date_from}"
        if date_to:
            params += f"&dueDate[le]={date_to}"
        return await self._request("GET", f"/payments{params}")

    async def get_pix_qrcode(self, payment_id: str) -> Dict[str, Any]:
        self._check_configured()
        return await self._request("GET", f"/payments/{payment_id}/pixQrCode")

    async def get_boleto_barcode(self, payment_id: str) -> Dict[str, Any]:
        self._check_configured()
        return await self._request("GET", f"/payments/{payment_id}/identificationField")

    async def get_invoice_url(self, payment_id: str) -> str:
        """Retorna URL do boleto/fatura para visualizacao."""
        payment = await self.get_payment(payment_id)
        return payment.get("invoiceUrl", "")

    # ==================== ASSINATURAS ====================
    async def create_subscription(self, customer_id: str, billing_type: str, value: float,
                                   next_due_date: str, cycle: str = "MONTHLY",
                                   description: Optional[str] = None,
                                   external_reference: Optional[str] = None) -> Dict[str, Any]:
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

    async def update_subscription(self, subscription_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        self._check_configured()
        return await self._request("PUT", f"/subscriptions/{subscription_id}", data)

    async def cancel_subscription(self, subscription_id: str) -> Dict[str, Any]:
        self._check_configured()
        return await self._request("DELETE", f"/subscriptions/{subscription_id}")

    async def list_subscriptions(self, offset: int = 0, limit: int = 50,
                                  customer_id: Optional[str] = None) -> Dict[str, Any]:
        self._check_configured()
        params = f"?offset={offset}&limit={limit}"
        if customer_id:
            params += f"&customer={customer_id}"
        return await self._request("GET", f"/subscriptions{params}")

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
                    try:
                        error_data = response.json() if response.text else {}
                    except Exception:
                        error_data = {"message": response.text[:200] if response.text else "Erro desconhecido"}
                    logger.error(f"Asaas API error {response.status_code}: {error_data}")
                    raise AsaasApiError(
                        f"Erro na API do Asaas ({response.status_code})",
                        status_code=response.status_code,
                        details=error_data
                    )
                try:
                    return response.json()
                except Exception:
                    raise AsaasApiError(
                        "Resposta invalida do Asaas (nao JSON)",
                        status_code=502,
                        details={"raw": response.text[:200] if response.text else ""}
                    )
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
