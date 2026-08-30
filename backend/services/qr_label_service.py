"""
QR Label PDF generation - Homeon Telecomunicacoes.

Suporta 2 formatos:
  - pimaco_6081: Etiqueta Pimaco 6081 (25.4 x 66.7 mm, 40 por folha A4)
  - a4_grid: Grid A4 com linhas de corte manual (30 por folha, mais tolerante)

Cada etiqueta contem:
  - Logo/nome "HOMEON"
  - Numero do lote (ex: L001)
  - QR Code apontando para /chip/{iccid}
  - ICCID legivel abaixo do QR
"""
from io import BytesIO
from typing import List, Dict, Optional

import qrcode
from qrcode.constants import ERROR_CORRECT_H
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, black
from reportlab.pdfbase.pdfmetrics import stringWidth


# ---------- Layouts (medidas em mm) ----------
LAYOUTS = {
    "pimaco_6081": {
        "label_width": 66.7,
        "label_height": 25.4,
        "cols": 3,
        "rows": 10,
        "margin_top": 12.7,
        "margin_left": 4.7,
        "gap_x": 2.5,
        "gap_y": 0.0,
        "safe_margin": 1.5,  # margem interna de seguranca contra deriva
        "show_cut_lines": False,
    },
    "a4_grid": {
        # 30 por folha: 3 colunas x 10 linhas com linhas de corte
        "label_width": 63.0,
        "label_height": 27.0,
        "cols": 3,
        "rows": 10,
        "margin_top": 10.0,
        "margin_left": 10.0,
        "gap_x": 5.0,
        "gap_y": 0.0,
        "safe_margin": 2.5,
        "show_cut_lines": True,
    },
}


def _make_qr_image(url: str) -> BytesIO:
    """Gera um QR Code PNG (nivel H = 30% de correcao de erro) e retorna BytesIO."""
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_H,
        box_size=10,
        border=1,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf


def _draw_label(c: canvas.Canvas, x: float, y: float, cfg: dict, url: str, iccid: str, lote_numero: str) -> None:
    """Desenha uma etiqueta na posicao (x, y) — coordenadas em pontos."""
    lw = cfg["label_width"] * mm
    lh = cfg["label_height"] * mm
    sm = cfg["safe_margin"] * mm

    # Area util
    ux, uy = x + sm, y + sm
    uw, uh = lw - 2 * sm, lh - 2 * sm

    # Linhas de corte (se A4 grid)
    if cfg.get("show_cut_lines"):
        c.setStrokeColor(HexColor("#CCCCCC"))
        c.setLineWidth(0.3)
        c.setDash([1, 2])
        c.rect(x, y, lw, lh, stroke=1, fill=0)
        c.setDash([])

    # QR (quadrado, ocupa altura util)
    qr_size = uh
    from reportlab.lib.utils import ImageReader
    qr_buf = _make_qr_image(url)
    c.drawImage(ImageReader(qr_buf), ux, uy, width=qr_size, height=qr_size, mask="auto")

    # Texto: HOMEON + lote + ICCID
    text_x = ux + qr_size + 2 * mm
    text_w = uw - qr_size - 2 * mm

    # HOMEON
    c.setFillColor(black)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(text_x, uy + uh - 3 * mm, "HOMEON")

    # Lote
    c.setFont("Helvetica", 6.5)
    c.setFillColor(HexColor("#666666"))
    c.drawString(text_x, uy + uh - 6 * mm, f"Lote: {lote_numero}")

    # ICCID (quebra em 2 linhas se necessario)
    c.setFont("Helvetica-Bold", 6)
    c.setFillColor(black)
    iccid_str = iccid or ""
    # Divide o ICCID em blocos para melhor legibilidade
    part1 = iccid_str[:10]
    part2 = iccid_str[10:]
    c.drawString(text_x, uy + 5 * mm, part1)
    c.drawString(text_x, uy + 2 * mm, part2)

    # Rodape
    c.setFont("Helvetica", 5.5)
    c.setFillColor(HexColor("#888888"))
    c.drawString(text_x, uy + 0.2 * mm, "Escaneie para ativar")


def build_qr_pdf(
    chips: List[Dict[str, str]],
    lote_numero: str,
    base_url: str,
    formato: str = "pimaco_6081",
) -> bytes:
    """
    Gera um PDF A4 com etiquetas QR Code.

    :param chips: lista de dicts com {"iccid": ...}
    :param lote_numero: numero do lote impresso na etiqueta (ex: "L001")
    :param base_url: URL base do frontend, ex: "https://mvno.homeonapp.com.br"
    :param formato: "pimaco_6081" | "a4_grid"
    :return: bytes do PDF
    """
    cfg = LAYOUTS.get(formato)
    if not cfg:
        raise ValueError(f"Formato desconhecido: {formato}")

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    page_w, page_h = A4

    cols = cfg["cols"]
    rows = cfg["rows"]
    per_page = cols * rows
    lw = cfg["label_width"] * mm
    lh = cfg["label_height"] * mm
    gap_x = cfg["gap_x"] * mm
    gap_y = cfg["gap_y"] * mm
    ml = cfg["margin_left"] * mm
    mt = cfg["margin_top"] * mm

    for idx, chip in enumerate(chips):
        pos = idx % per_page
        if idx > 0 and pos == 0:
            c.showPage()

        col = pos % cols
        row = pos // cols

        x = ml + col * (lw + gap_x)
        # Y no reportlab e de baixo pra cima
        y = page_h - mt - (row + 1) * lh - row * gap_y

        iccid = chip.get("iccid", "")
        url = f"{base_url.rstrip('/')}/chip/{iccid}"
        _draw_label(c, x, y, cfg, url, iccid, lote_numero)

    c.save()
    buf.seek(0)
    return buf.read()


def build_calibration_pdf(formato: str = "pimaco_6081") -> bytes:
    """Gera uma folha de calibracao com marcas para verificar alinhamento com a impressora."""
    cfg = LAYOUTS.get(formato)
    if not cfg:
        raise ValueError(f"Formato desconhecido: {formato}")

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    page_w, page_h = A4

    cols = cfg["cols"]
    rows = cfg["rows"]
    lw = cfg["label_width"] * mm
    lh = cfg["label_height"] * mm
    gap_x = cfg["gap_x"] * mm
    gap_y = cfg["gap_y"] * mm
    ml = cfg["margin_left"] * mm
    mt = cfg["margin_top"] * mm

    # Titulo
    c.setFont("Helvetica-Bold", 12)
    c.drawString(20 * mm, page_h - 8 * mm, f"Calibracao - {formato}")
    c.setFont("Helvetica", 8)
    c.drawString(20 * mm, page_h - 12 * mm,
                 "Imprima em 'Tamanho real 100%' (NAO 'Ajustar a pagina') e verifique se as marcas alinham com as etiquetas.")

    for row in range(rows):
        for col in range(cols):
            x = ml + col * (lw + gap_x)
            y = page_h - mt - (row + 1) * lh - row * gap_y

            # Retangulo tracejado indicando a etiqueta
            c.setStrokeColor(HexColor("#0066CC"))
            c.setLineWidth(0.5)
            c.setDash([2, 2])
            c.rect(x, y, lw, lh, stroke=1, fill=0)
            c.setDash([])

            # Cruz no centro
            cx, cy = x + lw / 2, y + lh / 2
            c.setStrokeColor(HexColor("#CC0000"))
            c.setLineWidth(0.4)
            c.line(cx - 3 * mm, cy, cx + 3 * mm, cy)
            c.line(cx, cy - 3 * mm, cx, cy + 3 * mm)

            # Coordenada
            c.setFont("Helvetica", 5)
            c.setFillColor(black)
            c.drawString(x + 1 * mm, y + 1 * mm, f"R{row+1}C{col+1}")

    c.save()
    buf.seek(0)
    return buf.read()
