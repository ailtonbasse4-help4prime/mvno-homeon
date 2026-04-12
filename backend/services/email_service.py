"""
Servico de Email via Gmail SMTP

Envia emails personalizados com a marca HomeOn Internet.
Configuracao via variaveis de ambiente:
- GMAIL_USER: Email Gmail para envio
- GMAIL_APP_PASSWORD: Senha de App do Google (16 caracteres)
"""

import os
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

logger = logging.getLogger(__name__)

GMAIL_USER = os.environ.get("GMAIL_USER", "")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "")
SITE_URL = os.environ.get("SITE_URL", "")

BRAND_COLOR = "#1e3a5f"
BRAND_NAME = "HomeOn Internet"
CONTACT_PHONE = "(19) 92005-1397"


def _base_template(content: str, title: str = "") -> str:
    """Template HTML base com a marca HomeOn."""
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>{title}</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#0f2942,{BRAND_COLOR});padding:24px 32px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:bold;letter-spacing:0.5px;">{BRAND_NAME}</h1>
    <p style="color:#a0c4e8;margin:4px 0 0;font-size:12px;">Telefonia Movel</p>
  </td></tr>
  <!-- Content -->
  <tr><td style="padding:32px;">
    {content}
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#f8f9fa;padding:20px 32px;border-top:1px solid #e9ecef;text-align:center;">
    <p style="color:#666;font-size:12px;margin:0;">
      <strong style="color:{BRAND_COLOR};">Contato: {CONTACT_PHONE}</strong>
    </p>
    {f'<p style="color:#999;font-size:11px;margin:6px 0 0;"><a href="{SITE_URL}/portal" style="color:{BRAND_COLOR};text-decoration:none;">{SITE_URL}/portal</a></p>' if SITE_URL else ''}
    <p style="color:#bbb;font-size:10px;margin:8px 0 0;">{BRAND_NAME} - Todos os direitos reservados</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>"""


def email_cobranca_criada(
    cliente_nome: str,
    valor: float,
    vencimento: str,
    descricao: str,
    billing_type: str,
    invoice_url: str = None,
    pix_code: str = None,
    barcode: str = None,
) -> str:
    """Template para cobranca/boleto criado."""
    valor_fmt = f"R$ {valor:.2f}"

    tipo_label = {"BOLETO": "Boleto", "PIX": "PIX", "CREDIT_CARD": "Cartao de Credito"}.get(billing_type, billing_type)

    payment_section = ""
    if invoice_url:
        payment_section += f"""
        <div style="text-align:center;margin:20px 0;">
          <a href="{invoice_url}" style="display:inline-block;background:{BRAND_COLOR};color:#fff;padding:14px 32px;
            border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;">
            Pagar Agora
          </a>
        </div>"""

    if pix_code:
        payment_section += f"""
        <div style="background:#f0f7ff;border:1px solid #d0e3f7;border-radius:6px;padding:16px;margin:16px 0;">
          <p style="margin:0 0 8px;font-weight:bold;color:{BRAND_COLOR};font-size:13px;">Codigo PIX (Copia e Cola):</p>
          <p style="margin:0;font-family:monospace;font-size:11px;word-break:break-all;color:#333;
            background:#fff;padding:10px;border:1px dashed #ccc;border-radius:4px;">{pix_code}</p>
        </div>"""

    if barcode:
        payment_section += f"""
        <div style="background:#f0f7ff;border:1px solid #d0e3f7;border-radius:6px;padding:16px;margin:16px 0;">
          <p style="margin:0 0 8px;font-weight:bold;color:{BRAND_COLOR};font-size:13px;">Linha Digitavel do Boleto:</p>
          <p style="margin:0;font-family:monospace;font-size:11px;word-break:break-all;color:#333;
            background:#fff;padding:10px;border:1px dashed #ccc;border-radius:4px;">{barcode}</p>
        </div>"""

    content = f"""
    <h2 style="color:{BRAND_COLOR};margin:0 0 16px;font-size:18px;">Cobranca Gerada</h2>
    <p style="color:#333;font-size:14px;line-height:1.6;margin:0 0 16px;">
      Ola <strong>{cliente_nome}</strong>,
    </p>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 20px;">
      Uma nova cobranca foi gerada para voce:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border-radius:6px;overflow:hidden;margin-bottom:16px;">
      <tr><td style="padding:12px 16px;border-bottom:1px solid #e9ecef;">
        <span style="color:#888;font-size:12px;">Descricao</span><br>
        <span style="color:#333;font-size:14px;font-weight:500;">{descricao}</span>
      </td></tr>
      <tr><td style="padding:12px 16px;border-bottom:1px solid #e9ecef;">
        <span style="color:#888;font-size:12px;">Valor</span><br>
        <span style="color:{BRAND_COLOR};font-size:20px;font-weight:bold;">{valor_fmt}</span>
      </td></tr>
      <tr><td style="padding:12px 16px;border-bottom:1px solid #e9ecef;">
        <span style="color:#888;font-size:12px;">Vencimento</span><br>
        <span style="color:#333;font-size:14px;font-weight:500;">{vencimento}</span>
      </td></tr>
      <tr><td style="padding:12px 16px;">
        <span style="color:#888;font-size:12px;">Forma de Pagamento</span><br>
        <span style="color:#333;font-size:14px;font-weight:500;">{tipo_label}</span>
      </td></tr>
    </table>
    {payment_section}
    <p style="color:#999;font-size:12px;margin:16px 0 0;text-align:center;">
      Em caso de duvidas, entre em contato: <strong>{CONTACT_PHONE}</strong>
    </p>
    """
    return _base_template(content, f"Cobranca - {BRAND_NAME}")


def email_ativacao_sucesso(
    cliente_nome: str,
    numero: str = None,
    plano_nome: str = None,
    iccid: str = None,
) -> str:
    """Template para ativacao de chip concluida."""
    numero_section = ""
    if numero:
        numero_section = f"""
        <div style="text-align:center;margin:20px 0;padding:20px;background:#e8f5e9;border-radius:8px;">
          <p style="color:#388e3c;font-size:12px;margin:0 0 4px;">Seu novo numero</p>
          <p style="color:#1b5e20;font-size:28px;font-weight:bold;margin:0;font-family:monospace;">{numero}</p>
        </div>"""

    content = f"""
    <h2 style="color:#2e7d32;margin:0 0 16px;font-size:18px;">Chip Ativado com Sucesso!</h2>
    <p style="color:#333;font-size:14px;line-height:1.6;margin:0 0 16px;">
      Ola <strong>{cliente_nome}</strong>,
    </p>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 20px;">
      Seu chip foi ativado com sucesso! Insira o chip no celular e comece a usar.
    </p>
    {numero_section}
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border-radius:6px;overflow:hidden;margin-bottom:16px;">
      {f'<tr><td style="padding:12px 16px;border-bottom:1px solid #e9ecef;"><span style="color:#888;font-size:12px;">Plano</span><br><span style="color:#333;font-size:14px;font-weight:500;">{plano_nome}</span></td></tr>' if plano_nome else ''}
      {f'<tr><td style="padding:12px 16px;"><span style="color:#888;font-size:12px;">ICCID</span><br><span style="color:#333;font-size:13px;font-family:monospace;">{iccid}</span></td></tr>' if iccid else ''}
    </table>
    {f'<div style="text-align:center;margin:20px 0;"><a href="{SITE_URL}/portal" style="display:inline-block;background:{BRAND_COLOR};color:#fff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;">Acessar Portal do Cliente</a></div>' if SITE_URL else ''}
    <p style="color:#999;font-size:12px;margin:16px 0 0;text-align:center;">
      Em caso de duvidas, entre em contato: <strong>{CONTACT_PHONE}</strong>
    </p>
    """
    return _base_template(content, f"Chip Ativado - {BRAND_NAME}")


def email_lembrete_vencimento(
    cliente_nome: str,
    valor: float,
    vencimento: str,
    descricao: str,
    invoice_url: str = None,
) -> str:
    """Template para lembrete de vencimento proximo."""
    valor_fmt = f"R$ {valor:.2f}"

    content = f"""
    <h2 style="color:#e65100;margin:0 0 16px;font-size:18px;">Lembrete de Vencimento</h2>
    <p style="color:#333;font-size:14px;line-height:1.6;margin:0 0 16px;">
      Ola <strong>{cliente_nome}</strong>,
    </p>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 20px;">
      Este e um lembrete de que sua fatura esta proxima do vencimento:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff3e0;border:1px solid #ffe0b2;border-radius:6px;overflow:hidden;margin-bottom:16px;">
      <tr><td style="padding:12px 16px;border-bottom:1px solid #ffe0b2;">
        <span style="color:#888;font-size:12px;">Descricao</span><br>
        <span style="color:#333;font-size:14px;font-weight:500;">{descricao}</span>
      </td></tr>
      <tr><td style="padding:12px 16px;border-bottom:1px solid #ffe0b2;">
        <span style="color:#888;font-size:12px;">Valor</span><br>
        <span style="color:#e65100;font-size:20px;font-weight:bold;">{valor_fmt}</span>
      </td></tr>
      <tr><td style="padding:12px 16px;">
        <span style="color:#888;font-size:12px;">Vencimento</span><br>
        <span style="color:#c62828;font-size:14px;font-weight:bold;">{vencimento}</span>
      </td></tr>
    </table>
    {f'<div style="text-align:center;margin:20px 0;"><a href="{invoice_url}" style="display:inline-block;background:#e65100;color:#fff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;">Pagar Agora</a></div>' if invoice_url else ''}
    <p style="color:#999;font-size:12px;margin:16px 0 0;text-align:center;">
      Evite o bloqueio da sua linha. Pague antes do vencimento.
    </p>
    """
    return _base_template(content, f"Lembrete de Vencimento - {BRAND_NAME}")


class EmailService:

    def __init__(self):
        self.gmail_user = GMAIL_USER
        self.gmail_password = GMAIL_APP_PASSWORD
        self.is_configured = bool(self.gmail_user and self.gmail_password)
        if self.is_configured:
            logger.info(f"EmailService configurado: {self.gmail_user}")
        else:
            logger.warning("EmailService NAO configurado (GMAIL_USER ou GMAIL_APP_PASSWORD ausente)")

    def get_status(self) -> dict:
        return {
            "configured": self.is_configured,
            "email": self.gmail_user if self.is_configured else None,
        }

    async def send_email(self, to_email: str, subject: str, html_body: str) -> dict:
        """Envia email via Gmail SMTP."""
        if not self.is_configured:
            logger.warning(f"Email nao enviado (nao configurado): {subject} -> {to_email}")
            return {"success": False, "error": "Email nao configurado"}

        try:
            msg = MIMEMultipart("alternative")
            msg["From"] = f"{BRAND_NAME} <{self.gmail_user}>"
            msg["To"] = to_email
            msg["Subject"] = subject
            msg.attach(MIMEText(html_body, "html", "utf-8"))

            import asyncio
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, self._send_smtp, msg)
            return result
        except Exception as e:
            logger.error(f"Erro ao enviar email para {to_email}: {e}")
            return {"success": False, "error": str(e)}

    def _send_smtp(self, msg: MIMEMultipart) -> dict:
        """Envia via SMTP (bloqueante, rodar em executor)."""
        try:
            with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=15) as server:
                server.login(self.gmail_user, self.gmail_password)
                server.send_message(msg)
            logger.info(f"Email enviado: {msg['Subject']} -> {msg['To']}")
            return {"success": True}
        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"Erro de autenticacao SMTP: {e}")
            return {"success": False, "error": "Falha na autenticacao Gmail. Verifique a App Password."}
        except Exception as e:
            logger.error(f"Erro SMTP: {e}")
            return {"success": False, "error": str(e)}

    async def send_cobranca(
        self, to_email: str, cliente_nome: str, valor: float, vencimento: str,
        descricao: str, billing_type: str, invoice_url: str = None,
        pix_code: str = None, barcode: str = None,
    ) -> dict:
        """Envia email de cobranca/boleto."""
        html = email_cobranca_criada(
            cliente_nome=cliente_nome, valor=valor, vencimento=vencimento,
            descricao=descricao, billing_type=billing_type,
            invoice_url=invoice_url, pix_code=pix_code, barcode=barcode,
        )
        subject = f"Cobranca {BRAND_NAME} - {descricao[:50]}"
        return await self.send_email(to_email, subject, html)

    async def send_ativacao_sucesso(
        self, to_email: str, cliente_nome: str, numero: str = None,
        plano_nome: str = None, iccid: str = None,
    ) -> dict:
        """Envia email de ativacao bem-sucedida."""
        html = email_ativacao_sucesso(
            cliente_nome=cliente_nome, numero=numero,
            plano_nome=plano_nome, iccid=iccid,
        )
        subject = f"Chip Ativado! - {BRAND_NAME}"
        return await self.send_email(to_email, subject, html)

    async def send_lembrete_vencimento(
        self, to_email: str, cliente_nome: str, valor: float,
        vencimento: str, descricao: str, invoice_url: str = None,
    ) -> dict:
        """Envia lembrete de vencimento."""
        html = email_lembrete_vencimento(
            cliente_nome=cliente_nome, valor=valor, vencimento=vencimento,
            descricao=descricao, invoice_url=invoice_url,
        )
        subject = f"Lembrete: Fatura vencendo - {BRAND_NAME}"
        return await self.send_email(to_email, subject, html)

    async def send_test(self, to_email: str) -> dict:
        """Envia email de teste."""
        html = _base_template(f"""
        <h2 style="color:{BRAND_COLOR};margin:0 0 16px;font-size:18px;">Email de Teste</h2>
        <p style="color:#333;font-size:14px;line-height:1.6;">
          Este e um email de teste do sistema <strong>{BRAND_NAME}</strong>.
        </p>
        <p style="color:#555;font-size:14px;line-height:1.6;">
          Se voce recebeu este email, a configuracao SMTP esta funcionando corretamente!
        </p>
        <div style="text-align:center;margin:20px 0;padding:16px;background:#e8f5e9;border-radius:8px;">
          <p style="color:#2e7d32;font-size:16px;font-weight:bold;margin:0;">Configuracao OK!</p>
        </div>
        """, f"Teste - {BRAND_NAME}")
        return await self.send_email(to_email, f"Teste de Email - {BRAND_NAME}", html)


email_service = EmailService()
