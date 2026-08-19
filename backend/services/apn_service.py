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
    """Monta a mensagem de texto para WhatsApp com o passo a passo de ativacao/APN."""
    saudacao_nome = ""
    if cliente_nome:
        primeiro = cliente_nome.strip().split(" ")[0]
        saudacao_nome = f" {primeiro}"

    linha_numero = f"\n\nSeu número: *{msisdn}*" if msisdn else ""

    return (
        f"Olá{saudacao_nome}! Bem-vindo à *HOMEON TELECOMUNICAÇÕES*! 🎉{linha_numero}\n\n"
        "Para começar a usar seu chip, siga os passos abaixo *na ordem*:\n\n"
        "*1. Reinicie o celular*\n"
        "Se o chip já estava no aparelho durante a ativação, desligue e ligue o celular. "
        "Isso resolve a maior parte dos casos em que não há sinal ou internet.\n\n"
        "*2. Deixe a rede 4G como preferencial*\n"
        "Em muitas regiões não há cobertura 5G, e o celular pode ficar tentando conectar sem sucesso. "
        "Vá em *Configurações → Rede móvel → Tipo de rede preferido* e selecione *4G/LTE*.\n"
        "No iPhone: *Ajustes → Celular → Opções → Voz e Dados → LTE*.\n\n"
        "*3. Se ainda não navegar, configure o APN*\n\n"
        "*Dados do APN*\n"
        f"• Nome: *{APN_CONFIG['nome']}*\n"
        f"• APN: *{APN_CONFIG['apn']}*\n"
        f"• MCC: *{APN_CONFIG['mcc']}*\n"
        f"• MNC: *{APN_CONFIG['mnc']}*\n"
        f"• Protocolo APN: *{APN_CONFIG['protocolo']}* (obrigatório em modem/roteador 4G)\n\n"
        "*Passo a passo Android*\n"
        "1. Configurações → Rede móvel / Conexões\n"
        "2. Nomes de pontos de acesso (APN)\n"
        "3. Toque em + / Adicionar novo APN\n"
        "4. Preencha com os dados acima\n"
        "5. Salvar e selecionar o novo APN\n"
        "6. Reinicie o celular\n\n"
        "*Passo a passo iPhone*\n"
        "1. Ajustes → Celular → Redes de dados móveis\n"
        "2. Em Dados Móveis, coloque em APN: *internet.br*\n"
        "3. Deixe Usuário e Senha em branco\n"
        "4. Reinicie o iPhone\n\n"
        "*Modem / roteador 4G*\n"
        "1. Acesse o painel do modem (geralmente 192.168.0.1 ou 192.168.8.1)\n"
        "2. Menu APN / Configurações de rede\n"
        "3. APN: *internet.br* | Protocolo: *IPv4/IPv6*\n"
        "4. Salve e reinicie o modem\n\n"
        "Qualquer dúvida, fale com o suporte. 📞"
    )
