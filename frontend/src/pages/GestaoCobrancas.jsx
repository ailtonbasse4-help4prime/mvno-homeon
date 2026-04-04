import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { safeArray, safeObject } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import {
  Plus, Search, Trash2, Edit, RefreshCw, ExternalLink,
  DollarSign, Clock, AlertCircle, FileText, Copy, CreditCard,
  Printer, Share2, Eye, QrCode, Barcode, CheckCircle, X,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export function GestaoCobrancas() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [cobrancas, setCobrancas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [linhas, setLinhas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loteDialogOpen, setLoteDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedCobranca, setSelectedCobranca] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterBilling, setFilterBilling] = useState('');
  const [search, setSearch] = useState('');
  const [asaasConfig, setAsaasConfig] = useState({});
  const [resumo, setResumo] = useState({});

  const [form, setForm] = useState({
    cliente_id: '', linha_id: '', billing_type: 'BOLETO',
    valor: '', vencimento: '', descricao: '',
  });

  const [loteForm, setLoteForm] = useState({
    billing_type: 'BOLETO', valor: '', vencimento: '',
    descricao: '', cliente_ids: [],
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cobRes, cliRes, linRes, cfgRes, resRes] = await Promise.all([
        axios.get(`${API_URL}/api/carteira/cobrancas`, { withCredentials: true }),
        axios.get(`${API_URL}/api/clientes`, { withCredentials: true }),
        axios.get(`${API_URL}/api/linhas`, { withCredentials: true }),
        axios.get(`${API_URL}/api/carteira/config`, { withCredentials: true }).catch(() => ({ data: {} })),
        axios.get(`${API_URL}/api/carteira/resumo`, { withCredentials: true }).catch(() => ({ data: {} })),
      ]);
      setCobrancas(safeArray(cobRes.data));
      setClientes(safeArray(cliRes.data));
      setLinhas(safeArray(linRes.data));
      setAsaasConfig(safeObject(cfgRes.data));
      setResumo(safeObject(resRes.data));
    } catch (e) { toast.error('Erro ao carregar dados'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleOpenDialog = (cobranca = null) => {
    if (cobranca) {
      setEditingId(cobranca.id);
      setForm({
        cliente_id: cobranca.cliente_id, linha_id: cobranca.linha_id || '',
        billing_type: cobranca.billing_type, valor: cobranca.valor.toString(),
        vencimento: cobranca.vencimento, descricao: cobranca.descricao || '',
      });
    } else {
      setEditingId(null);
      setForm({ cliente_id: '', linha_id: '', billing_type: 'BOLETO', valor: '', vencimento: '', descricao: '' });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.cliente_id || !form.valor || !form.vencimento) {
      toast.error('Preencha cliente, valor e vencimento'); return;
    }
    setSubmitting(true);
    try {
      const payload = { ...form, valor: parseFloat(form.valor) };
      if (editingId) {
        await axios.put(`${API_URL}/api/carteira/cobrancas/${editingId}`, payload, { withCredentials: true });
        toast.success('Cobranca atualizada');
      } else {
        await axios.post(`${API_URL}/api/carteira/cobrancas`, payload, { withCredentials: true });
        toast.success('Cobranca criada');
      }
      setDialogOpen(false);
      fetchAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao salvar cobranca');
    }
    setSubmitting(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remover esta cobranca?')) return;
    try {
      await axios.delete(`${API_URL}/api/carteira/cobrancas/${id}`, { withCredentials: true });
      toast.success('Cobranca removida');
      fetchAll();
    } catch (e) { toast.error(e.response?.data?.detail || 'Erro ao remover'); }
  };

  const handleConsultar = async (id) => {
    try {
      const res = await axios.post(`${API_URL}/api/carteira/cobrancas/${id}/consultar`, {}, { withCredentials: true });
      toast.success(`Status atualizado: ${statusLabel(res.data.status)}`);
      fetchAll();
    } catch (e) { toast.error(e.response?.data?.detail || 'Erro ao consultar'); }
  };

  const handleViewDetail = (c) => {
    setSelectedCobranca(c);
    setDetailDialogOpen(true);
  };

  const handleCopy = (text, label) => {
    if (!text) { toast.error(`${label} nao disponivel`); return; }
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const handlePrint = (c) => {
    if (c.asaas_invoice_url) {
      window.open(c.asaas_invoice_url, '_blank');
      return;
    }
    // Gerar versao para impressao local
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html><head><title>Cobranca - ${c.cliente_nome}</title>
      <style>body{font-family:Arial,sans-serif;padding:40px;max-width:600px;margin:0 auto}
      h1{font-size:20px;border-bottom:2px solid #000;padding-bottom:10px}
      .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee}
      .label{color:#666;font-size:14px}.value{font-weight:bold;font-size:14px}
      .total{font-size:24px;text-align:center;margin:20px 0;padding:15px;background:#f5f5f5;border-radius:8px}
      .barcode{text-align:center;margin:20px 0;font-family:monospace;font-size:12px;word-break:break-all}
      @media print{button{display:none}}</style></head><body>
      <h1>Cobranca - MVNO Manager</h1>
      <div class="row"><span class="label">Cliente</span><span class="value">${c.cliente_nome || '—'}</span></div>
      <div class="row"><span class="label">Linha</span><span class="value">${c.msisdn || '—'}</span></div>
      <div class="row"><span class="label">Tipo</span><span class="value">${c.billing_type}</span></div>
      <div class="row"><span class="label">Vencimento</span><span class="value">${c.vencimento}</span></div>
      <div class="row"><span class="label">Status</span><span class="value">${statusLabel(c.status)}</span></div>
      <div class="row"><span class="label">Descricao</span><span class="value">${c.descricao || '—'}</span></div>
      <div class="total">Valor: R$ ${c.valor.toFixed(2)}</div>
      ${c.barcode ? `<div class="barcode"><strong>Codigo de Barras:</strong><br>${c.barcode}</div>` : ''}
      ${c.asaas_pix_code ? `<div class="barcode"><strong>Pix Copia e Cola:</strong><br>${c.asaas_pix_code}</div>` : ''}
      <button onclick="window.print()" style="width:100%;padding:12px;background:#000;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:16px;margin-top:20px">Imprimir</button>
      </body></html>
    `);
    printWindow.document.close();
  };

  const handleShareWhatsApp = (c) => {
    let msg = `*Cobranca MVNO*\nCliente: ${c.cliente_nome}\nValor: R$ ${c.valor.toFixed(2)}\nVencimento: ${c.vencimento}\nTipo: ${c.billing_type}`;
    if (c.asaas_invoice_url) msg += `\n\nLink para pagamento:\n${c.asaas_invoice_url}`;
    if (c.barcode) msg += `\n\nCodigo de barras:\n${c.barcode}`;
    if (c.asaas_pix_code) msg += `\n\nPix Copia e Cola:\n${c.asaas_pix_code}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleLoteSubmit = async (e) => {
    e.preventDefault();
    if (!loteForm.cliente_ids.length || !loteForm.valor || !loteForm.vencimento) {
      toast.error('Selecione clientes, valor e vencimento'); return;
    }
    setSubmitting(true);
    try {
      const cobrancas = loteForm.cliente_ids.map(cid => ({
        cliente_id: cid, billing_type: loteForm.billing_type,
        valor: parseFloat(loteForm.valor), vencimento: loteForm.vencimento,
        descricao: loteForm.descricao || '',
      }));
      const res = await axios.post(`${API_URL}/api/carteira/cobrancas/lote`, { cobrancas }, { withCredentials: true });
      toast.success(`${res.data.created} cobrancas criadas de ${res.data.total}`);
      if (res.data.errors?.length) toast.warning(`${res.data.errors.length} erros`);
      setLoteDialogOpen(false);
      setLoteForm({ billing_type: 'BOLETO', valor: '', vencimento: '', descricao: '', cliente_ids: [] });
      fetchAll();
    } catch (e) { toast.error('Erro ao criar lote'); }
    setSubmitting(false);
  };

  const toggleClienteLote = (id) => {
    setLoteForm(prev => ({
      ...prev,
      cliente_ids: prev.cliente_ids.includes(id)
        ? prev.cliente_ids.filter(c => c !== id)
        : [...prev.cliente_ids, id],
    }));
  };

  const selectAllClientes = () => {
    const activeIds = clientes.filter(c => c.status === 'ativo').map(c => c.id);
    setLoteForm(prev => ({ ...prev, cliente_ids: activeIds }));
  };

  const statusColor = (s) => ({
    PENDING: 'text-yellow-400', OVERDUE: 'text-red-400',
    CONFIRMED: 'text-emerald-400', RECEIVED: 'text-emerald-400',
    CANCELLED: 'text-zinc-500',
  }[s] || 'text-zinc-400');

  const statusLabel = (s) => ({
    PENDING: 'Pendente', OVERDUE: 'Vencida', CONFIRMED: 'Paga',
    RECEIVED: 'Recebida', CANCELLED: 'Cancelada',
  }[s] || s);

  const statusBg = (s) => ({
    PENDING: 'bg-yellow-900/30 text-yellow-400', OVERDUE: 'bg-red-900/30 text-red-400',
    CONFIRMED: 'bg-emerald-900/30 text-emerald-400', RECEIVED: 'bg-emerald-900/30 text-emerald-400',
    CANCELLED: 'bg-zinc-800 text-zinc-500',
  }[s] || 'bg-zinc-800 text-zinc-400');

  const filtered = cobrancas.filter(c => {
    if (filterStatus && c.status !== filterStatus) return false;
    if (filterBilling && c.billing_type !== filterBilling) return false;
    if (search) {
      const s = search.toLowerCase();
      return (c.cliente_nome || '').toLowerCase().includes(s) ||
             (c.msisdn || '').includes(s) || (c.descricao || '').toLowerCase().includes(s);
    }
    return true;
  });

  const fin = (resumo && resumo.financeiro) || {};
  const cobs = (resumo && resumo.cobrancas) || {};
  const clienteLinhas = (clienteId) => linhas.filter(l => l.cliente_id === clienteId);
  const sc = selectedCobranca;

  return (
    <div className="space-y-6" data-testid="gestao-cobrancas-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gestao de Cobrancas</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Asaas: {asaasConfig.configured ? (
              <span className="text-emerald-400">Conectado ({asaasConfig.environment})</span>
            ) : (
              <span className="text-yellow-400">Modo local (configure ASAAS_API_KEY)</span>
            )}
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2 w-full sm:w-auto">
            <Button onClick={() => setLoteDialogOpen(true)} variant="outline" className="flex items-center gap-2 border-zinc-700 hover:bg-zinc-800" data-testid="lote-cobranca-btn">
              <CreditCard className="w-4 h-4" />Em Lote
            </Button>
            <Button onClick={() => handleOpenDialog()} className="btn-primary flex items-center gap-2" data-testid="nova-cobranca-btn">
              <Plus className="w-4 h-4" />Nova Cobranca
            </Button>
          </div>
        )}
      </div>

      {/* Cards Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-zinc-900 border-zinc-800"><CardContent className="p-4 text-center">
          <DollarSign className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
          <div className="text-lg font-bold text-emerald-400">R$ {(fin.receita_total || 0).toFixed(2)}</div>
          <div className="text-xs text-zinc-400">Receita</div>
        </CardContent></Card>
        <Card className="bg-zinc-900 border-zinc-800"><CardContent className="p-4 text-center">
          <Clock className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
          <div className="text-lg font-bold text-yellow-400">R$ {(fin.pendente_total || 0).toFixed(2)}</div>
          <div className="text-xs text-zinc-400">Pendente</div>
        </CardContent></Card>
        <Card className="bg-zinc-900 border-zinc-800"><CardContent className="p-4 text-center">
          <AlertCircle className="w-5 h-5 text-red-400 mx-auto mb-1" />
          <div className="text-lg font-bold text-red-400">R$ {(fin.vencido_total || 0).toFixed(2)}</div>
          <div className="text-xs text-zinc-400">Vencido</div>
        </CardContent></Card>
        <Card className="bg-zinc-900 border-zinc-800"><CardContent className="p-4 text-center">
          <FileText className="w-5 h-5 text-blue-400 mx-auto mb-1" />
          <div className="text-lg font-bold">{cobs.total || 0}</div>
          <div className="text-xs text-zinc-400">{cobs.pagas || 0} pagas | {cobs.pendentes || 0} pendentes</div>
        </CardContent></Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 w-4 h-4" />
          <Input placeholder="Buscar por cliente, numero..." value={search}
            onChange={e => setSearch(e.target.value)} className="pl-10 bg-zinc-900 border-zinc-700" data-testid="search-cobrancas" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm" data-testid="filter-status">
          <option value="">Todos Status</option>
          <option value="PENDING">Pendente</option>
          <option value="OVERDUE">Vencida</option>
          <option value="CONFIRMED">Paga</option>
          <option value="RECEIVED">Recebida</option>
          <option value="CANCELLED">Cancelada</option>
        </select>
        <select value={filterBilling} onChange={e => setFilterBilling(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm" data-testid="filter-billing">
          <option value="">Todos Tipos</option>
          <option value="BOLETO">Boleto</option>
          <option value="PIX">Pix</option>
        </select>
        <Button onClick={fetchAll} variant="outline" className="border-zinc-700 hover:bg-zinc-800" data-testid="refresh-btn">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="cobrancas-table">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400 text-left">
              <th className="p-3">Cliente</th>
              <th className="p-3 hidden sm:table-cell">Tipo</th>
              <th className="p-3">Valor</th>
              <th className="p-3 hidden md:table-cell">Vencimento</th>
              <th className="p-3">Status</th>
              <th className="p-3">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-zinc-500">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-zinc-500">Nenhuma cobranca encontrada</td></tr>
            ) : filtered.map(c => (
              <tr key={c.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/50 cursor-pointer" onClick={() => handleViewDetail(c)}>
                <td className="p-3">
                  <div className="font-medium">{c.cliente_nome || '—'}</div>
                  <div className="text-xs text-zinc-500">{c.msisdn || c.descricao || ''}</div>
                </td>
                <td className="p-3 hidden sm:table-cell">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.billing_type === 'PIX' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-blue-900/40 text-blue-400'}`}>
                    {c.billing_type}
                  </span>
                </td>
                <td className="p-3 font-medium">R$ {c.valor.toFixed(2)}</td>
                <td className="p-3 text-zinc-400 hidden md:table-cell">{c.vencimento}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBg(c.status)}`}>
                    {statusLabel(c.status)}
                  </span>
                </td>
                <td className="p-3" onClick={e => e.stopPropagation()}>
                  <div className="flex gap-1">
                    <button onClick={() => handleViewDetail(c)} className="p-1.5 hover:bg-zinc-800 rounded" title="Visualizar detalhes">
                      <Eye className="w-3.5 h-3.5 text-blue-400" />
                    </button>
                    <button onClick={() => handlePrint(c)} className="p-1.5 hover:bg-zinc-800 rounded" title="Imprimir / Abrir fatura">
                      <Printer className="w-3.5 h-3.5 text-zinc-400" />
                    </button>
                    <button onClick={() => handleShareWhatsApp(c)} className="p-1.5 hover:bg-zinc-800 rounded" title="Enviar por WhatsApp">
                      <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                    </button>
                    {isAdmin && !['CONFIRMED','RECEIVED'].includes(c.status) && (
                      <>
                        <button onClick={() => handleOpenDialog(c)} className="p-1.5 hover:bg-zinc-800 rounded" title="Editar">
                          <Edit className="w-3.5 h-3.5 text-zinc-400" />
                        </button>
                        <button onClick={() => handleDelete(c.id)} className="p-1.5 hover:bg-zinc-800 rounded" title="Remover">
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Dialog Detalhes da Cobranca */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da Cobranca</DialogTitle>
          </DialogHeader>
          {sc && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-zinc-400">Cliente</span><div className="font-medium">{sc.cliente_nome || '—'}</div></div>
                <div><span className="text-zinc-400">Linha</span><div className="font-medium">{sc.msisdn || '—'}</div></div>
                <div><span className="text-zinc-400">Tipo</span><div className="font-medium">{sc.billing_type}</div></div>
                <div><span className="text-zinc-400">Status</span><div className={`font-medium ${statusColor(sc.status)}`}>{statusLabel(sc.status)}</div></div>
                <div><span className="text-zinc-400">Vencimento</span><div className="font-medium">{sc.vencimento}</div></div>
                <div><span className="text-zinc-400">Valor</span><div className="font-bold text-lg">R$ {sc.valor.toFixed(2)}</div></div>
              </div>
              {sc.descricao && <div className="text-sm"><span className="text-zinc-400">Descricao: </span>{sc.descricao}</div>}

              {/* Links Asaas */}
              {sc.asaas_invoice_url && (
                <div className="p-3 bg-zinc-900 rounded-lg space-y-2">
                  <div className="text-sm font-medium text-blue-400 flex items-center gap-2"><ExternalLink className="w-4 h-4" /> Link da Fatura (Asaas)</div>
                  <div className="flex gap-2">
                    <a href={sc.asaas_invoice_url} target="_blank" rel="noreferrer" className="flex-1 text-xs bg-blue-900/30 text-blue-400 p-2 rounded truncate hover:bg-blue-900/50">
                      {sc.asaas_invoice_url}
                    </a>
                    <Button size="sm" variant="outline" onClick={() => handleCopy(sc.asaas_invoice_url, 'Link')} className="border-zinc-700">
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Boleto bankslip */}
              {sc.asaas_bankslip_url && (
                <div className="p-3 bg-zinc-900 rounded-lg space-y-2">
                  <div className="text-sm font-medium flex items-center gap-2"><FileText className="w-4 h-4" /> PDF do Boleto</div>
                  <a href={sc.asaas_bankslip_url} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm" className="w-full border-zinc-700"><FileText className="w-4 h-4 mr-2" />Baixar PDF do Boleto</Button>
                  </a>
                </div>
              )}

              {/* Codigo de Barras */}
              {sc.barcode && (
                <div className="p-3 bg-zinc-900 rounded-lg space-y-2">
                  <div className="text-sm font-medium flex items-center gap-2"><Barcode className="w-4 h-4" /> Codigo de Barras</div>
                  <div className="text-xs font-mono bg-zinc-800 p-2 rounded break-all">{sc.barcode}</div>
                  <Button size="sm" variant="outline" onClick={() => handleCopy(sc.barcode, 'Codigo de barras')} className="w-full border-zinc-700">
                    <Copy className="w-3.5 h-3.5 mr-2" />Copiar Codigo
                  </Button>
                </div>
              )}

              {/* Pix */}
              {sc.asaas_pix_code && (
                <div className="p-3 bg-zinc-900 rounded-lg space-y-2">
                  <div className="text-sm font-medium flex items-center gap-2"><QrCode className="w-4 h-4 text-emerald-400" /> Pix Copia e Cola</div>
                  <div className="text-xs font-mono bg-zinc-800 p-2 rounded break-all max-h-20 overflow-y-auto">{sc.asaas_pix_code}</div>
                  <Button size="sm" variant="outline" onClick={() => handleCopy(sc.asaas_pix_code, 'Pix')} className="w-full border-zinc-700">
                    <Copy className="w-3.5 h-3.5 mr-2" />Copiar Pix
                  </Button>
                  {sc.asaas_pix_qrcode && (
                    <div className="text-center">
                      <img src={`data:image/png;base64,${sc.asaas_pix_qrcode}`} alt="QR Code Pix" className="w-40 h-40 mx-auto rounded" />
                    </div>
                  )}
                </div>
              )}

              {/* Sem dados do Asaas */}
              {!sc.asaas_payment_id && (
                <div className="p-3 bg-yellow-900/20 border border-yellow-800/30 rounded-lg text-sm text-yellow-400">
                  Esta cobranca foi criada no modo local. Para gerar boleto/Pix com link de pagamento, configure a chave do Asaas no backend.
                </div>
              )}

              {/* Botoes de acao */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button onClick={() => handlePrint(sc)} variant="outline" className="flex items-center gap-2 border-zinc-700">
                  <Printer className="w-4 h-4" />{sc.asaas_invoice_url ? 'Abrir Fatura' : 'Imprimir'}
                </Button>
                <Button onClick={() => handleShareWhatsApp(sc)} variant="outline" className="flex items-center gap-2 border-zinc-700 text-emerald-400 hover:text-emerald-300">
                  <Share2 className="w-4 h-4" />WhatsApp
                </Button>
                {sc.asaas_payment_id && (
                  <Button onClick={() => { handleConsultar(sc.id); setDetailDialogOpen(false); }} variant="outline" className="flex items-center gap-2 border-zinc-700 col-span-2">
                    <RefreshCw className="w-4 h-4" />Atualizar Status
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Nova/Editar Cobranca */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 max-w-md">
          <DialogHeader><DialogTitle>{editingId ? 'Editar Cobranca' : 'Nova Cobranca'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="cobranca-form">
            <div>
              <label className="text-sm text-zinc-400">Cliente *</label>
              <select value={form.cliente_id} onChange={e => setForm({ ...form, cliente_id: e.target.value, linha_id: '' })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm mt-1" required>
                <option value="">Selecione...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome} - {c.documento}</option>)}
              </select>
            </div>
            {form.cliente_id && clienteLinhas(form.cliente_id).length > 0 && (
              <div>
                <label className="text-sm text-zinc-400">Linha (opcional)</label>
                <select value={form.linha_id} onChange={e => setForm({ ...form, linha_id: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm mt-1">
                  <option value="">Sem linha especifica</option>
                  {clienteLinhas(form.cliente_id).map(l => <option key={l.id} value={l.id}>{l.numero || l.msisdn}</option>)}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-zinc-400">Tipo *</label>
                <select value={form.billing_type} onChange={e => setForm({ ...form, billing_type: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm mt-1">
                  <option value="BOLETO">Boleto</option>
                  <option value="PIX">Pix</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-zinc-400">Valor (R$) *</label>
                <Input type="number" step="0.01" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })}
                  className="bg-zinc-900 border-zinc-700 mt-1" required />
              </div>
            </div>
            <div>
              <label className="text-sm text-zinc-400">Vencimento *</label>
              <Input type="date" value={form.vencimento} onChange={e => setForm({ ...form, vencimento: e.target.value })}
                className="bg-zinc-900 border-zinc-700 mt-1" required />
            </div>
            <div>
              <label className="text-sm text-zinc-400">Descricao</label>
              <Input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })}
                className="bg-zinc-900 border-zinc-700 mt-1" placeholder="Ex: Mensalidade Abril" />
            </div>
            <Button type="submit" disabled={submitting} className="w-full btn-primary">
              {submitting ? 'Salvando...' : editingId ? 'Salvar Alteracoes' : 'Criar Cobranca'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Lote */}
      <Dialog open={loteDialogOpen} onOpenChange={setLoteDialogOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Cobranca em Lote</DialogTitle></DialogHeader>
          <form onSubmit={handleLoteSubmit} className="space-y-4" data-testid="lote-form">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-zinc-400">Tipo</label>
                <select value={loteForm.billing_type} onChange={e => setLoteForm({ ...loteForm, billing_type: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm mt-1">
                  <option value="BOLETO">Boleto</option>
                  <option value="PIX">Pix</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-zinc-400">Valor (R$)</label>
                <Input type="number" step="0.01" value={loteForm.valor} onChange={e => setLoteForm({ ...loteForm, valor: e.target.value })}
                  className="bg-zinc-900 border-zinc-700 mt-1" required />
              </div>
            </div>
            <div>
              <label className="text-sm text-zinc-400">Vencimento</label>
              <Input type="date" value={loteForm.vencimento} onChange={e => setLoteForm({ ...loteForm, vencimento: e.target.value })}
                className="bg-zinc-900 border-zinc-700 mt-1" required />
            </div>
            <div>
              <label className="text-sm text-zinc-400">Descricao</label>
              <Input value={loteForm.descricao} onChange={e => setLoteForm({ ...loteForm, descricao: e.target.value })}
                className="bg-zinc-900 border-zinc-700 mt-1" placeholder="Ex: Mensalidade Abril 2026" />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-zinc-400">Clientes ({loteForm.cliente_ids.length} selecionados)</label>
                <Button type="button" variant="ghost" size="sm" onClick={selectAllClientes} className="text-xs">
                  Selecionar todos ativos
                </Button>
              </div>
              <div className="max-h-48 overflow-y-auto border border-zinc-800 rounded-md p-2 space-y-1">
                {clientes.filter(c => c.status === 'ativo').map(c => (
                  <label key={c.id} className="flex items-center gap-2 p-1.5 hover:bg-zinc-900 rounded cursor-pointer text-sm">
                    <input type="checkbox" checked={loteForm.cliente_ids.includes(c.id)}
                      onChange={() => toggleClienteLote(c.id)} className="rounded" />
                    {c.nome} <span className="text-zinc-500 text-xs">{c.documento}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" disabled={submitting || !loteForm.cliente_ids.length} className="w-full btn-primary">
              {submitting ? 'Gerando...' : `Gerar ${loteForm.cliente_ids.length} Cobrancas`}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
