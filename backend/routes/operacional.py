"""Modulo Operacional - Visao consolidada tipo planilha (Excel-like)."""
import io
import re
import unicodedata
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Request, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from bson import ObjectId
from pydantic import BaseModel

router = APIRouter(prefix="/operacional", tags=["operacional"])

# Injetado pelo server.py principal
_ctx = {}


def init(db, get_current_user, require_admin, create_log):
    _ctx["db"] = db
    _ctx["get_current_user"] = get_current_user
    _ctx["require_admin"] = require_admin
    _ctx["create_log"] = create_log


def _norm(s: str) -> str:
    if not s:
        return ""
    return ''.join(c for c in unicodedata.normalize('NFD', str(s)) if unicodedata.category(c) != 'Mn').lower()


class LinhaOperacionalUpdate(BaseModel):
    observacoes: Optional[str] = None
    proxima_recarga: Optional[str] = None  # ISO date YYYY-MM-DD
    canal: Optional[str] = None  # atualizar no cliente
    status_chip: Optional[str] = None  # FS, NP, BLOQ.PARC, BLOQ.TOTAL, CANCELADO (manual)


@router.get("/planilha")
async def planilha_consolidada(request: Request, search: Optional[str] = None, status: Optional[str] = None,
                                canal: Optional[str] = None, bloqueio: Optional[str] = None):
    """Retorna uma linha por LINHA ativa/suspensa com dados consolidados: cliente+chip+oferta+plano+cobrancas."""
    await _ctx["get_current_user"](request)
    db = _ctx["db"]

    # Buscar todas as linhas
    linhas = await db.linhas.find({}).to_list(5000)
    if not linhas:
        return {"linhas": [], "resumo": _resumo_vazio()}

    cliente_ids = list({l["cliente_id"] for l in linhas if l.get("cliente_id")})
    chip_ids = list({l["chip_id"] for l in linhas if l.get("chip_id") and ObjectId.is_valid(l["chip_id"])})
    oferta_ids = list({l["oferta_id"] for l in linhas if l.get("oferta_id") and ObjectId.is_valid(l["oferta_id"])})
    plano_ids_linha = list({l["plano_id"] for l in linhas if l.get("plano_id") and ObjectId.is_valid(l["plano_id"])})

    clientes_map = {}
    if cliente_ids:
        cs = await db.clientes.find({"_id": {"$in": [ObjectId(c) for c in cliente_ids if ObjectId.is_valid(c)]}}).to_list(5000)
        clientes_map = {str(c["_id"]): c for c in cs}

    chips_map = {}
    if chip_ids:
        chs = await db.chips.find({"_id": {"$in": [ObjectId(c) for c in chip_ids]}}).to_list(5000)
        chips_map = {str(c["_id"]): c for c in chs}

    ofertas_map = {}
    planos_map = {}
    # Carrega todas ofertas ativas (para fallback por plano)
    all_ofertas = await db.ofertas.find({"ativo": True}).to_list(1000)
    for o in all_ofertas:
        ofertas_map[str(o["_id"])] = o
    # Indice: plano_id -> primeira oferta ativa
    oferta_por_plano = {}
    for o in all_ofertas:
        pid = o.get("plano_id")
        if pid and pid not in oferta_por_plano:
            oferta_por_plano[pid] = o

    all_plano_ids = list(set(plano_ids_linha) | {o.get("plano_id") for o in all_ofertas if o.get("plano_id")})
    if all_plano_ids:
        pls = await db.planos.find({"_id": {"$in": [ObjectId(p) for p in all_plano_ids if ObjectId.is_valid(p)]}}).to_list(500)
        planos_map = {str(p["_id"]): p for p in pls}

    # Ultima cobranca PENDENTE por cliente (ou mais recente)
    cobs = await db.cobrancas.find({}).sort("vencimento", -1).to_list(10000)
    cobs_by_cliente = {}
    for c in cobs:
        cid = c.get("cliente_id")
        if not cid:
            continue
        if cid not in cobs_by_cliente:
            cobs_by_cliente[cid] = []
        cobs_by_cliente[cid].append(c)

    result = []
    for l in linhas:
        cid = l.get("cliente_id") or ""
        cliente = clientes_map.get(cid, {})
        chip = chips_map.get(l.get("chip_id") or "", {})
        oferta = ofertas_map.get(l.get("oferta_id") or "", {})
        # Fallback: se linha nao tem oferta, usa a primeira oferta ativa do plano da linha
        if not oferta and l.get("plano_id"):
            oferta = oferta_por_plano.get(l["plano_id"], {})
        plano = planos_map.get(oferta.get("plano_id") or l.get("plano_id") or "", {})
        cobs_cli = cobs_by_cliente.get(cid, [])
        # ultima cobranca pendente
        cobs_pend = [c for c in cobs_cli if c.get("status") not in ("RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "REFUNDED")]
        ultima_cob = cobs_pend[0] if cobs_pend else (cobs_cli[0] if cobs_cli else {})
        total_cobs = len(cobs_cli)
        total_pagas = sum(1 for c in cobs_cli if c.get("status") in ("RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"))
        total_pendentes = total_cobs - total_pagas

        endereco_full = " ".join(filter(None, [
            cliente.get("endereco"), cliente.get("numero_endereco"),
            cliente.get("bairro"), cliente.get("cidade"), cliente.get("estado"),
        ]))

        valor = oferta.get("valor", 0.0) or 0.0
        custo = oferta.get("custo", 0.0) or 0.0
        lucro = valor - custo
        margem = (lucro / valor * 100) if valor > 0 else 0

        row = {
            "linha_id": str(l["_id"]),
            "cliente_id": cid,
            "chip_id": l.get("chip_id") or "",
            "oferta_id": l.get("oferta_id") or "",
            # Chip/Linha
            "iccid": chip.get("iccid", ""),
            "numero": l.get("numero") or l.get("msisdn") or chip.get("msisdn") or "",
            "status_linha": l.get("status", ""),
            "status_chip": l.get("status_chip") or chip.get("status", ""),  # FS/NP/BLOQ.PARC/BLOQ.TOTAL
            "expirar_dados": l.get("expirar_dados"),  # data vinda da Ta Telecom (cache local)
            "proxima_recarga": l.get("proxima_recarga"),  # editavel manualmente
            # Cliente
            "cliente_nome": cliente.get("nome", ""),
            "cpf": cliente.get("documento") or cliente.get("cpf", ""),
            "telefone_cliente": cliente.get("telefone", ""),
            "email": cliente.get("email"),
            "endereco": endereco_full,
            "canal": cliente.get("canal", ""),
            "observacoes_cliente": cliente.get("observacoes", ""),
            # Oferta / Plano
            "oferta_nome": oferta.get("nome", ""),
            "plano_nome": plano.get("nome", ""),
            "franquia": plano.get("franquia", ""),
            "valor": valor,
            "custo": custo,
            "lucro": lucro,
            "margem_pct": round(margem, 2),
            "categoria": oferta.get("categoria", ""),
            # Cobranca
            "ultima_cobranca_venc": ultima_cob.get("vencimento") if ultima_cob else None,
            "ultima_cobranca_status": ultima_cob.get("status") if ultima_cob else None,
            "ultima_cobranca_tipo": ultima_cob.get("billing_type") if ultima_cob else None,
            "cobrancas_total": total_cobs,
            "cobrancas_pagas": total_pagas,
            "cobrancas_pendentes": total_pendentes,
            # Observacoes da linha
            "observacoes_linha": l.get("observacoes", ""),
            "port": bool(cliente.get("port") or cliente.get("portabilidade")),
        }
        result.append(row)

    # Filtros
    if search:
        s = _norm(search)
        result = [r for r in result if s in _norm(r["cliente_nome"]) or s in _norm(r["cpf"]) or s in _norm(r["numero"]) or s in _norm(r["iccid"]) or s in _norm(r["email"] or "")]
    if status:
        result = [r for r in result if r["status_linha"] == status]
    if canal:
        result = [r for r in result if _norm(r["canal"]) == _norm(canal)]
    if bloqueio:
        result = [r for r in result if _norm(r["status_chip"]) == _norm(bloqueio)]

    # Ordenar por nome
    result.sort(key=lambda r: _norm(r["cliente_nome"]))

    # Resumo
    total_receita = sum(r["valor"] for r in result)
    total_custo = sum(r["custo"] for r in result)
    total_lucro = total_receita - total_custo
    margem_pct = round((total_lucro / total_receita * 100), 2) if total_receita > 0 else 0
    ativas = sum(1 for r in result if r["status_linha"] == "ativo")
    suspensas = sum(1 for r in result if r["status_linha"] == "suspenso")
    canceladas = sum(1 for r in result if r["status_linha"] == "cancelado")

    resumo = {
        "total_linhas": len(result),
        "ativas": ativas,
        "suspensas": suspensas,
        "canceladas": canceladas,
        "receita": round(total_receita, 2),
        "custo": round(total_custo, 2),
        "lucro": round(total_lucro, 2),
        "margem_pct": margem_pct,
    }
    return {"linhas": result, "resumo": resumo}


def _resumo_vazio():
    return {"total_linhas": 0, "ativas": 0, "suspensas": 0, "canceladas": 0, "receita": 0, "custo": 0, "lucro": 0, "margem_pct": 0}


@router.patch("/linha/{linha_id}")
async def atualizar_linha_inline(linha_id: str, data: LinhaOperacionalUpdate, request: Request):
    user = await _ctx["require_admin"](request)
    db = _ctx["db"]
    if not ObjectId.is_valid(linha_id):
        raise HTTPException(status_code=400, detail="ID invalido")
    linha = await db.linhas.find_one({"_id": ObjectId(linha_id)})
    if not linha:
        raise HTTPException(status_code=404, detail="Linha nao encontrada")

    update_linha = {}
    if data.observacoes is not None:
        update_linha["observacoes"] = data.observacoes
    if data.proxima_recarga is not None:
        update_linha["proxima_recarga"] = data.proxima_recarga
    if data.status_chip is not None:
        update_linha["status_chip"] = data.status_chip
    if update_linha:
        await db.linhas.update_one({"_id": ObjectId(linha_id)}, {"$set": update_linha})

    if data.canal is not None and linha.get("cliente_id") and ObjectId.is_valid(linha["cliente_id"]):
        await db.clientes.update_one({"_id": ObjectId(linha["cliente_id"])}, {"$set": {"canal": data.canal}})

    await _ctx["create_log"]("operacional", f"Linha {linha_id} atualizada inline", user["id"], user["name"])
    return {"success": True, "updated": {**update_linha, **({"canal": data.canal} if data.canal is not None else {})}}


@router.get("/export")
async def exportar_excel(request: Request):
    """Exporta a planilha consolidada em XLSX."""
    await _ctx["require_admin"](request)
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment

    # Reusa a planilha
    data = await planilha_consolidada(request)
    linhas = data["linhas"]

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Planilha Operacional"

    headers = [
        "Cliente", "CPF", "Telefone", "Email", "Canal",
        "ICCID", "Numero", "Status Linha", "Status Chip",
        "Expirar Dados", "Proxima Recarga",
        "Oferta", "Plano", "Franquia",
        "Valor (R$)", "Custo (R$)", "Lucro (R$)", "Margem %",
        "Categoria",
        "Ultima Cobranca Venc", "Ultima Cobranca Status", "Tipo Boleto",
        "Cobrancas Total", "Pagas", "Pendentes",
        "Endereco", "Observacoes Cliente", "Observacoes Linha",
    ]
    ws.append(headers)
    # Style header
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="2563EB", end_color="2563EB", fill_type="solid")
    for cell in ws[1]:
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")

    for r in linhas:
        ws.append([
            r["cliente_nome"], r["cpf"], r["telefone_cliente"], r.get("email") or "", r["canal"],
            r["iccid"], r["numero"], r["status_linha"], r["status_chip"],
            r.get("expirar_dados") or "", r.get("proxima_recarga") or "",
            r["oferta_nome"], r["plano_nome"], r["franquia"],
            r["valor"], r["custo"], r["lucro"], r["margem_pct"],
            r["categoria"],
            r.get("ultima_cobranca_venc") or "", r.get("ultima_cobranca_status") or "", r.get("ultima_cobranca_tipo") or "",
            r["cobrancas_total"], r["cobrancas_pagas"], r["cobrancas_pendentes"],
            r["endereco"], r["observacoes_cliente"], r["observacoes_linha"],
        ])

    # Auto width
    for col_idx, col in enumerate(ws.columns, 1):
        max_len = max((len(str(c.value)) if c.value else 0 for c in col), default=10)
        ws.column_dimensions[openpyxl.utils.get_column_letter(col_idx)].width = min(max_len + 2, 40)

    # Summary sheet
    ws2 = wb.create_sheet("Resumo")
    resumo = data["resumo"]
    ws2.append(["Indicador", "Valor"])
    ws2.append(["Total Linhas", resumo["total_linhas"]])
    ws2.append(["Ativas", resumo["ativas"]])
    ws2.append(["Suspensas", resumo["suspensas"]])
    ws2.append(["Canceladas", resumo["canceladas"]])
    ws2.append(["Receita (R$)", resumo["receita"]])
    ws2.append(["Custo (R$)", resumo["custo"]])
    ws2.append(["Lucro (R$)", resumo["lucro"]])
    ws2.append(["Margem %", resumo["margem_pct"]])
    for cell in ws2[1]:
        cell.font = Font(bold=True)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    filename = f"planilha-operacional-{datetime.now().strftime('%Y%m%d-%H%M')}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.post("/importar-excel")
async def importar_excel(request: Request, file: UploadFile = File(...)):
    """Importa clientes + observacoes de uma planilha Excel. Nao sobrescreve dados existentes nao-nulos (merge)."""
    user = await _ctx["require_admin"](request)
    db = _ctx["db"]
    import openpyxl
    contents = await file.read()
    try:
        wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Arquivo invalido: {e}")
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if len(rows) < 2:
        raise HTTPException(status_code=400, detail="Planilha vazia")

    # Heuristica: detecta colunas pelo primeiro row que contenha texto que case nome/cpf
    header_idx = 0
    for i, row in enumerate(rows[:5]):
        joined = " ".join(str(c or "").lower() for c in row)
        if any(k in joined for k in ["assinante", "cliente", "nome"]):
            header_idx = i
            break

    headers = [(_norm(str(c or ""))) for c in rows[header_idx]]

    def col(row, *names):
        for name in names:
            for i, h in enumerate(headers):
                if name in h:
                    return row[i] if i < len(row) else None
        return None

    imported = 0
    updated_count = 0
    errors = []

    for row in rows[header_idx + 1:]:
        if not any(row):
            continue
        nome = str(col(row, "assinante", "cliente", "nome") or "").strip()
        cpf_raw = col(row, "cpf", "documento")
        cpf = re.sub(r"\D", "", str(cpf_raw or ""))
        tel = re.sub(r"\D", "", str(col(row, "chip", "telefone", "numero") or ""))
        endereco = str(col(row, "endereco") or "").strip() or None
        obs = str(col(row, "observa", "status") or "").strip() or None
        valor_raw = col(row, "valor")
        plano_txt = str(col(row, "plano") or "").strip() or None

        if not nome:
            continue

        # Match por CPF (preferido), senao por telefone, senao por nome
        existing = None
        if cpf and len(cpf) >= 11:
            existing = await db.clientes.find_one({"documento": cpf})
        if not existing and tel and len(tel) >= 10:
            existing = await db.clientes.find_one({"telefone": {"$regex": tel[-9:]}})
        if not existing:
            existing = await db.clientes.find_one({"nome": {"$regex": f"^{re.escape(nome)}$", "$options": "i"}})

        if existing:
            upd = {}
            if obs and not existing.get("observacoes"):
                upd["observacoes"] = obs
            if endereco and not existing.get("endereco"):
                upd["endereco"] = endereco
            if upd:
                await db.clientes.update_one({"_id": existing["_id"]}, {"$set": upd})
                updated_count += 1
        else:
            if not cpf or len(cpf) < 11:
                errors.append(f"{nome}: CPF invalido, pulado")
                continue
            try:
                doc = {
                    "nome": nome, "documento": cpf, "tipo_pessoa": "pf",
                    "telefone": tel or "",
                    "endereco": endereco,
                    "observacoes": obs,
                    "status": "ativo",
                    "created_at": datetime.now(timezone.utc),
                    "imported_from_excel": True,
                }
                await db.clientes.insert_one(doc)
                imported += 1
            except Exception as e:
                errors.append(f"{nome}: {e}")

    await _ctx["create_log"]("operacional", f"Import Excel: {imported} novos, {updated_count} atualizados", user["id"], user["name"])
    return {"imported": imported, "updated": updated_count, "errors": errors[:50], "total_errors": len(errors)}


@router.post("/atualizar-expirar-dados/{iccid}")
async def atualizar_expirar_dados(iccid: str, request: Request):
    """Consulta Ta Telecom e cacheia a data de expiracao dos dados em linhas.expirar_dados."""
    user = await _ctx["require_admin"](request)
    db = _ctx["db"]
    # Import local para nao criar import circular
    from services.operadora_service import operadora_service
    try:
        req, resp = await operadora_service.consultar_linha(iccid)
        if resp.status != 200 or not resp.body:
            raise HTTPException(status_code=502, detail=f"Falha Ta Telecom: {resp.status}")
        body = resp.body if isinstance(resp.body, dict) else {}
        # Tentar extrair data de expiracao (campo pode variar)
        expirar = (
            body.get("data_expiracao")
            or body.get("dataExpiracao")
            or body.get("expira_em")
            or body.get("validity")
            or (body.get("data") or {}).get("data_expiracao")
        )
        chip = await db.chips.find_one({"iccid": iccid})
        if chip:
            await db.linhas.update_many({"chip_id": str(chip["_id"])}, {"$set": {"expirar_dados": expirar, "expirar_dados_updated_at": datetime.now(timezone.utc)}})
        await _ctx["create_log"]("operacional", f"Expirar dados atualizado via TaTelecom: ICCID {iccid}", user["id"], user["name"])
        return {"iccid": iccid, "expirar_dados": expirar, "raw": body}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
