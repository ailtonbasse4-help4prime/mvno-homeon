"""
APN Tutorial - configuracao para clientes do MVNO Surf (rede Vivo, MNC 17).

Uma unica fonte de verdade para o passo a passo de APN, usado em:
  - Mensagem automatica pos-ativacao via Z-API (WhatsApp)
  - Reenvio manual solicitado pelo cliente
  - Renderizacao no proprio Self-Service (frontend consome a mesma constante via API)
"""
from typing import Optional

APN_CONFIG = {
    "nome": "Surf",
    "apn": "internet.br",
    "mcc": "724",
    "mnc": "17",
    "protocolo": "IPv4/IPv6",
}


def build_apn_whatsapp_message(cliente_nome: Optional[str] = None, msisdn: Optional[str] = None) -> str:
    """Monta a mensagem de texto para WhatsApp com o passo a passo de APN."""
    saudacao_nome = ""
    if cliente_nome:
        primeiro = cliente_nome.strip().split(" ")[0]
        saudacao_nome = f" {primeiro}"

    linha_numero = f"\n\nSeu numero: *{msisdn}*" if msisdn else ""

    return (
        f"Ola{saudacao_nome}! Seu chip *Surf* ja esta ativo!{linha_numero}\n\n"
        "Se voce nao conseguir navegar apos inserir o chip, configure o APN manualmente:\n\n"
        "*Dados do APN*\n"
        f"* Nome: *{APN_CONFIG['nome']}*\n"
        f"* APN: *{APN_CONFIG['apn']}*\n"
        f"* MCC: *{APN_CONFIG['mcc']}*\n"
        f"* MNC: *{APN_CONFIG['mnc']}*\n"
        f"* Protocolo APN: *{APN_CONFIG['protocolo']}* (obrigatorio em modem/roteador 4G)\n\n"
        "*Passo a passo Android*\n"
        "1. Configuracoes -> Rede movel / Conexoes\n"
        "2. Nomes de pontos de acesso (APN)\n"
        "3. Toque em + / Adicionar novo APN\n"
        "4. Preencha com os dados acima\n"
        "5. Salvar e selecionar o novo APN\n"
        "6. Reinicie o celular\n\n"
        "*Passo a passo iPhone*\n"
        "1. Ajustes -> Celular -> Redes de dados moveis\n"
        "2. Em Dados Moveis, coloque em APN: *internet.br*\n"
        "3. Deixe Usuario e Senha em branco\n"
        "4. Reinicie o iPhone\n\n"
        "*Modem / roteador 4G*\n"
        "1. Acesse o painel do modem (geralmente 192.168.0.1 ou 192.168.8.1)\n"
        "2. Menu APN / Configuracoes de rede\n"
        "3. APN: *internet.br* | Protocolo: *IPv4/IPv6*\n"
        "4. Salve e reinicie o modem\n\n"
        "Qualquer duvida, fale com o suporte."
    )
