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
  Printer, Share2, Eye, QrCode, Barcode, CheckCircle, X, Settings, Download, Mail,
} from 'lucide-react';
import { ConfirmPasswordDialog } from '../components/ConfirmPasswordDialog';
import { useSecureAction } from '../hooks/useSecureAction';
import { SearchableSelect } from '../components/SearchableSelect';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export function GestaoCobrancas() {
  const { user } = useAuth();
  const { executeSecureDelete, confirmState, closeConfirm } = useSecureAction();  const isAdmin = user?.role === 'admin';
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
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configForm, setConfigForm] = useState({ api_key: '', environment: 'sandbox' });
  const [configSubmitting, setConfigSubmitting] = useState(false);
  const [diagResult, setDiagResult] = useState(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [disablingNotifs, setDisablingNotifs] = useState(false);

  const [form, setForm] = useState({
    cliente_id: '', linha_id: '', billing_type: 'BOLETO',
    valor: '', vencimento: '', descricao: '',
    modalidade: 'avista', parcelas: 1,
  });

  const [carneDialogOpen, setCarneDialogOpen] = useState(false);
  const [carneCobrancas, setCarneCobrancas] = useState([]);
  const [carneFilterOpen, setCarneFilterOpen] = useState(false);
  const [carneClienteId, setCarneClienteId] = useState('');
  const [carneDateFrom, setCarneDateFrom] = useState('');
  const [carneDateTo, setCarneDateTo] = useState('');

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
      setForm({ cliente_id: '', linha_id: '', billing_type: 'BOLETO', valor: '', vencimento: '', descricao: '', modalidade: 'avista', parcelas: 1 });
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
      const payload = { ...form, valor: parseFloat(form.valor), parcelas: parseInt(form.parcelas) || 1 };
      if (editingId) {
        await axios.put(`${API_URL}/api/carteira/cobrancas/${editingId}`, payload, { withCredentials: true });
        toast.success('Cobranca atualizada');
      } else {
        const res = await axios.post(`${API_URL}/api/carteira/cobrancas`, payload, { withCredentials: true });
        const created = Array.isArray(res.data) ? res.data : [res.data];
        if (form.modalidade !== 'avista' && created.length > 1) {
          toast.success(`${created.length} parcelas criadas com sucesso!`);
        } else {
          toast.success('Cobranca criada');
        }
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
      await executeSecureDelete(`/api/carteira/cobrancas/${id}`, `Remover cobranca`);
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

  const handlePrint = async (c) => {
    // Se tem invoice URL do Asaas, abre direto (boleto/fatura real)
    if (c.asaas_invoice_url) {
      window.open(c.asaas_invoice_url, '_blank');
      return;
    }
    // Se tem payment_id real mas falta URL, tenta buscar do Asaas
    if (c.asaas_payment_id && !c.asaas_payment_id.startsWith('mock_')) {
      try {
        toast.info('Buscando fatura no Asaas...');
        const res = await axios.post(`${API_URL}/api/carteira/cobrancas/${c.id}/refresh`, {}, { withCredentials: true });
        const updated = res.data;
        if (updated.asaas_invoice_url) {
          window.open(updated.asaas_invoice_url, '_blank');
          fetchAll();
          return;
        }
      } catch (e) {
        toast.error('Erro ao buscar fatura no Asaas');
      }
    }
    // Sem payment_id - precisa gerar no Asaas primeiro
    if (!c.asaas_payment_id || c.asaas_payment_id.startsWith('mock_')) {
      try {
        toast.info('Gerando pagamento no Asaas...');
        const res = await axios.post(`${API_URL}/api/carteira/cobrancas/${c.id}/gerar-asaas`, {}, { withCredentials: true });
        const updated = res.data;
        if (updated.asaas_invoice_url) {
          toast.success('Fatura gerada no Asaas!');
          window.open(updated.asaas_invoice_url, '_blank');
          fetchAll();
          return;
        }
        toast.success('Pagamento criado. Clique novamente para abrir a fatura.');
        fetchAll();
      } catch (e) {
        toast.error(e.response?.data?.detail || 'Erro ao gerar pagamento no Asaas');
      }
      return;
    }
    toast.error('Fatura do Asaas nao disponivel.');
  };

  const handleGenerateAsaas = async (c) => {
    try {
      toast.info('Gerando pagamento no Asaas...');
      const res = await axios.post(`${API_URL}/api/carteira/cobrancas/${c.id}/gerar-asaas`, {}, { withCredentials: true });
      if (res.data.asaas_invoice_url) {
        toast.success('Fatura gerada com sucesso!');
      } else {
        toast.success('Pagamento criado no Asaas!');
      }
      fetchAll();
      // Refresh detail modal if open
      if (selectedCobranca?.id === c.id) {
        setSelectedCobranca(res.data);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao gerar pagamento no Asaas');
    }
  };

  const handleRefreshCobranca = async (c) => {
    if (!c.asaas_payment_id || c.asaas_payment_id.startsWith('mock_')) {
      // No real payment - generate it
      await handleGenerateAsaas(c);
      return;
    }
    try {
      toast.info('Consultando Asaas...');
      const res = await axios.post(`${API_URL}/api/carteira/cobrancas/${c.id}/refresh`, {}, { withCredentials: true });
      toast.success('Dados atualizados do Asaas');
      fetchAll();
      if (selectedCobranca?.id === c.id) {
        setSelectedCobranca(res.data);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao consultar Asaas');
    }
  };

  const handleShareWhatsApp = (c) => {
    if (!window.confirm(`Enviar cobranca por WhatsApp para ${c.cliente_nome}?`)) return;
    let msg = `*Cobranca MVNO*\nCliente: ${c.cliente_nome}\nValor: R$ ${c.valor.toFixed(2)}\nVencimento: ${c.vencimento}\nTipo: ${c.billing_type}`;
    if (c.asaas_invoice_url) msg += `\n\nLink para pagamento:\n${c.asaas_invoice_url}`;
    if (c.barcode) msg += `\n\nCodigo de barras:\n${c.barcode}`;
    if (c.asaas_pix_code) msg += `\n\nPix Copia e Cola:\n${c.asaas_pix_code}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const [sendingEmail, setSendingEmail] = useState(null);

  const handleSendEmail = async (c) => {
    if (!window.confirm(`Enviar cobranca por email para ${c.cliente_nome}?`)) return;
    setSendingEmail(c.id);
    try {
      const res = await axios.post(`${API_URL}/api/carteira/cobrancas/${c.id}/enviar-email`, {}, { withCredentials: true });
      toast.success(res.data.message || 'Email enviado!');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao enviar email');
    }
    setSendingEmail(null);
  };

  const handlePrintCarne = (clienteId, dateFrom, dateTo) => {
    let clienteCobrancas = cobrancas
      .filter(c => c.cliente_id === clienteId)
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento));

    if (dateFrom) clienteCobrancas = clienteCobrancas.filter(c => c.vencimento >= dateFrom);
    if (dateTo) clienteCobrancas = clienteCobrancas.filter(c => c.vencimento <= dateTo);

    if (!clienteCobrancas.length) {
      toast.error('Nenhuma cobranca encontrada para este periodo');
      return;
    }
    setCarneCobrancas(clienteCobrancas);
    setCarneFilterOpen(false);
    setCarneDialogOpen(true);
  };

  const printCarne = () => {
    if (!carneCobrancas.length) return;
    const comPdf = carneCobrancas.filter(c => c.asaas_bankslip_url || c.asaas_invoice_url);
    if (!comPdf.length) {
      toast.error('Nenhuma cobranca possui boleto no Asaas.');
      return;
    }
    comPdf.forEach((c, i) => {
      setTimeout(() => {
        window.open(c.asaas_bankslip_url || c.asaas_invoice_url, '_blank');
      }, i * 500);
    });
    toast.success(`Abrindo ${comPdf.length} boleto${comPdf.length > 1 ? 's' : ''} do Asaas`);
  };

  const [loadingCarnePdf, setLoadingCarnePdf] = useState(false);

  const handleCarnePdf = async () => {
    if (!carneCobrancas.length) return;
    const clienteId = carneCobrancas[0]?.cliente_id;
    if (!clienteId) return;
    setLoadingCarnePdf(true);
    try {
      const res = await axios.get(`${API_URL}/api/carteira/carne/${clienteId}`, {
        withCredentials: true, responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      toast.success('Carne PDF aberto (3 boletos por folha)');
    } catch (e) {
      const msg = e.response?.data?.detail || (e.response?.data instanceof Blob
        ? await e.response.data.text().then(t => { try { return JSON.parse(t).detail; } catch { return t; } })
        : 'Erro ao gerar carne');
      toast.error(typeof msg === 'string' ? msg : 'Erro ao gerar carne PDF');
    }
    setLoadingCarnePdf(false);
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
    RECEIVED: 'Recebida', RECEIVED_IN_CASH: 'Recebida', CANCELLED: 'Cancelada',
  }[s] || s);

  const statusBg = (s) => ({
    PENDING: 'bg-yellow-900/30 text-yellow-400', OVERDUE: 'bg-red-900/30 text-red-400',
    CONFIRMED: 'bg-emerald-900/30 text-emerald-400', RECEIVED: 'bg-emerald-900/30 text-emerald-400',
    RECEIVED_IN_CASH: 'bg-emerald-900/30 text-emerald-400', CANCELLED: 'bg-zinc-800 text-zinc-500',
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

  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleSyncStatus = async () => {
    setSyncing(true);
    try {
      const res = await axios.post(`${API_URL}/api/carteira/sincronizar-status`, {}, { withCredentials: true });
      const { total_checked, updated, errors } = res.data;
      if (updated > 0) {
        toast.success(`${updated} cobranca(s) atualizada(s) de ${total_checked}`);
      } else {
        toast.info(`${total_checked} cobrancas verificadas, nenhuma alteracao`);
      }
      if (errors?.length) toast.warning(`${errors.length} erro(s) na sincronizacao`);
      fetchAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao sincronizar');
    }
    setSyncing(false);
  };

  const handleImportAsaas = async () => {
    if (!window.confirm('Importar TODAS as cobrancas existentes no Asaas que ainda nao estao no sistema? Esta operacao pode demorar alguns minutos.')) return;
    setImporting(true);
    try {
      const res = await axios.post(`${API_URL}/api/carteira/sincronizar-asaas`, {}, { withCredentials: true, timeout: 180000 });
      const { imported, skipped, no_client, total_asaas } = res.data;
      if (imported > 0) {
        toast.success(`${imported} cobranca(s) importada(s) de ${total_asaas} no Asaas`);
      } else {
        toast.info(`Nenhuma cobranca nova. Total no Asaas: ${total_asaas}, ja sincronizadas: ${skipped}`);
      }
      if (no_client > 0) {
        toast.warning(`${no_client} cobranca(s) sem cliente local correspondente (cadastre os clientes ou use "Sincronizar Asaas" na ficha do cliente)`);
      }
      fetchAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao importar cobrancas do Asaas');
    }
    setImporting(false);
  };

  const handleSaveAsaasConfig = async () => {
    if (!configForm.api_key) { toast.error('Informe a chave API'); return; }
    setConfigSubmitting(true);
    try {
      const res = await axios.post(`${API_URL}/api/carteira/config`, configForm, { withCredentials: true });
      if (res.data.success) {
        toast.success(res.data.message);
        setConfigDialogOpen(false);
        fetchAll();
      } else {
        toast.warning(res.data.message);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao salvar configuracao');
    }
    setConfigSubmitting(false);
  };

  const handleDiagnostico = async () => {
    setDiagLoading(true);
    setDiagResult(null);
    try {
      const res = await axios.post(`${API_URL}/api/carteira/diagnostico`, {}, { withCredentials: true });
      setDiagResult(res.data);
      if (res.data.api_test === 'OK') {
        toast.success('Conexao com Asaas OK!');
      } else {
        toast.error('Falha na conexao: ' + (res.data.api_error || 'Erro desconhecido'));
      }
    } catch (e) {
      toast.error('Erro ao executar diagnostico');
      setDiagResult({ api_test: 'ERRO', api_error: e.response?.data?.detail || e.message });
    }
    setDiagLoading(false);
  };

  const handleDisableNotifications = async () => {
    if (!window.confirm('Desabilitar TODAS as notificacoes automaticas do Asaas para todos os clientes cadastrados? O envio sera feito apenas pelo seu atendimento.')) return;
    setDisablingNotifs(true);
    try {
      const res = await axios.post(`${API_URL}/api/carteira/desabilitar-notificacoes`, {}, { withCredentials: true });
      const { total, updated, errors } = res.data;
      if (updated > 0) {
        toast.success(`Notificacoes desabilitadas para ${updated} de ${total} clientes`);
      } else if (total === 0) {
        toast.info('Nenhum cliente sincronizado com Asaas encontrado');
      } else {
        toast.info('Nenhuma alteracao necessaria');
      }
      if (errors?.length) toast.warning(`${errors.length} erro(s) ao processar`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao desabilitar notificacoes');
    }
    setDisablingNotifs(false);
  };

  return (
    <div className="space-y-6" data-testid="gestao-cobrancas-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gestao de Cobrancas</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Asaas: {asaasConfig.configured ? (
              <>
                <span className="text-emerald-400">Conectado ({asaasConfig.environment})</span>
                {asaasConfig.key_length < 50 && (
                  <button onClick={() => setConfigDialogOpen(true)} className="ml-2 text-yellow-400 underline text-xs">Chave invalida - Configurar</button>
                )}
              </>
            ) : (
              <button onClick={() => setConfigDialogOpen(true)} className="text-yellow-400 underline">Configurar chave API</button>
            )}
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2 w-full sm:w-auto flex-wrap">
            <Button onClick={handleSyncStatus} disabled={syncing} variant="outline" size="sm" className="flex items-center gap-1.5 border-emerald-700 text-emerald-400 hover:bg-emerald-900/20 text-xs sm:text-sm" data-testid="sync-status-btn">
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} /><span className="hidden sm:inline">{syncing ? 'Sincronizando...' : 'Sincronizar Status'}</span><span className="sm:hidden">{syncing ? 'Sync...' : 'Sync'}</span>
            </Button>
            <Button onClick={handleImportAsaas} disabled={importing} variant="outline" size="sm" className="flex items-center gap-1.5 border-amber-700 text-amber-400 hover:bg-amber-900/20 text-xs sm:text-sm" data-testid="import-asaas-btn" title="Importa cobrancas existentes no Asaas para o sistema local">
              <RefreshCw className={`w-3.5 h-3.5 ${importing ? 'animate-spin' : ''}`} /><span className="hidden sm:inline">{importing ? 'Importando...' : 'Importar do Asaas'}</span><span className="sm:hidden">{importing ? 'Imp...' : 'Importar'}</span>
            </Button>
            <Button onClick={() => setConfigDialogOpen(true)} variant="outline" size="sm" className="flex items-center gap-1.5 border-blue-700 text-blue-400 hover:bg-blue-900/20 text-xs sm:text-sm" data-testid="config-asaas-btn">
              <Settings className="w-3.5 h-3.5" /><span className="hidden sm:inline">API Asaas</span><span className="sm:hidden">API</span>
            </Button>
            <Button onClick={() => setLoteDialogOpen(true)} variant="outline" size="sm" className="flex items-center gap-1.5 border-zinc-700 hover:bg-zinc-800 text-xs sm:text-sm" data-testid="lote-cobranca-btn">
              <CreditCard className="w-3.5 h-3.5" /><span className="hidden sm:inline">Em Lote</span><span className="sm:hidden">Lote</span>
            </Button>
            {cobrancas.length > 0 && (
              <Button onClick={() => setCarneFilterOpen(true)} variant="outline" size="sm" className="flex items-center gap-1.5 border-zinc-700 hover:bg-zinc-800 text-xs sm:text-sm" data-testid="carne-btn">
                <Printer className="w-3.5 h-3.5" /><span className="hidden sm:inline">Imprimir Carne</span><span className="sm:hidden">Carne</span>
              </Button>
            )}
            <Button onClick={() => handleOpenDialog()} size="sm" className="btn-primary flex items-center gap-1.5 text-xs sm:text-sm" data-testid="nova-cobranca-btn">
              <Plus className="w-3.5 h-3.5" />Nova
            </Button>
          </div>
        )}
      </div>

      {/* Cards Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-zinc-900 border-zinc-500/60"><CardContent className="p-4 text-center">
          <DollarSign className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
          <div className="text-lg font-bold text-emerald-400">R$ {(fin.receita_total || 0).toFixed(2)}</div>
          <div className="text-xs text-zinc-400">Receita</div>
        </CardContent></Card>
        <Card className="bg-zinc-900 border-zinc-500/60"><CardContent className="p-4 text-center">
          <Clock className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
          <div className="text-lg font-bold text-yellow-400">R$ {(fin.pendente_total || 0).toFixed(2)}</div>
          <div className="text-xs text-zinc-400">Pendente</div>
        </CardContent></Card>
        <Card className="bg-zinc-900 border-zinc-500/60"><CardContent className="p-4 text-center">
          <AlertCircle className="w-5 h-5 text-red-400 mx-auto mb-1" />
          <div className="text-lg font-bold text-red-400">R$ {(fin.vencido_total || 0).toFixed(2)}</div>
          <div className="text-xs text-zinc-400">Vencido</div>
        </CardContent></Card>
        <Card className="bg-zinc-900 border-zinc-500/60"><CardContent className="p-4 text-center">
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
      <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-340px)]">
        <table className="w-full text-sm min-w-[1200px]" data-testid="cobrancas-table">
          <thead className="sticky top-0 z-10">
            <tr className="bg-blue-950/80 backdrop-blur-sm border-b border-blue-800/50 text-left">
              <th className="p-3 text-blue-300 whitespace-nowrap min-w-[200px]">Cliente</th>
              <th className="p-3 text-blue-300 whitespace-nowrap min-w-[80px]">Tipo</th>
              <th className="p-3 text-blue-300 whitespace-nowrap min-w-[100px]">Valor</th>
              <th className="p-3 text-blue-300 whitespace-nowrap min-w-[120px]">Vencimento</th>
              <th className="p-3 text-blue-300 whitespace-nowrap min-w-[100px]">Status</th>
              <th className="p-3 text-blue-300 whitespace-nowrap min-w-[200px]">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-zinc-500">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-zinc-500">Nenhuma cobranca encontrada</td></tr>
            ) : filtered.map(c => (
              <tr key={c.id} className="border-b border-zinc-500/50 hover:bg-zinc-900/50 cursor-pointer" onClick={() => handleViewDetail(c)}>
                <td className="p-3 whitespace-nowrap">
                  <div className="font-medium">{c.cliente_nome || '—'}</div>
                  <div className="text-xs text-zinc-300">
                    {c.parcela_num ? `${c.parcela_num}/${c.parcela_total} - ` : ''}{c.msisdn || c.descricao || ''}
                  </div>
                </td>
                <td className="p-3 whitespace-nowrap">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.billing_type === 'PIX' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-blue-900/40 text-blue-400'}`}>
                    {c.billing_type}
                  </span>
                </td>
                <td className="p-3 font-medium whitespace-nowrap">R$ {c.valor.toFixed(2)}</td>
                <td className="p-3 text-zinc-400 whitespace-nowrap">{c.vencimento}</td>
                <td className="p-3 whitespace-nowrap">
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
                    {(c.asaas_bankslip_url || c.asaas_invoice_url) && (
                      <a href={c.asaas_bankslip_url || c.asaas_invoice_url} target="_blank" rel="noreferrer"
                        className="p-1.5 hover:bg-zinc-800 rounded inline-flex" title="Baixar boleto PDF"
                        data-testid={`download-boleto-${c.id}`}>
                        <Download className="w-3.5 h-3.5 text-cyan-400" />
                      </a>
                    )}
                    <button onClick={() => handleRefreshCobranca(c)} className="p-1.5 hover:bg-zinc-800 rounded" title="Atualizar dados do Asaas">
                      <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                    </button>
                    <button onClick={() => handleShareWhatsApp(c)} className="p-1.5 hover:bg-zinc-800 rounded" title="Enviar por WhatsApp">
                      <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                    </button>
                    <button onClick={() => handleSendEmail(c)} disabled={sendingEmail === c.id} className="p-1.5 hover:bg-zinc-800 rounded" title="Enviar por Email"
                      data-testid={`send-email-btn-${c.id}`}>
                      <Mail className={`w-3.5 h-3.5 text-blue-400 ${sendingEmail === c.id ? 'animate-pulse' : ''}`} />
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
                <div className="p-3 bg-cyan-900/20 border border-cyan-800/30 rounded-lg space-y-2">
                  <div className="text-sm font-medium text-cyan-400 flex items-center gap-2"><Download className="w-4 h-4" /> Boleto PDF</div>
                  <a href={sc.asaas_bankslip_url} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm" className="w-full border-cyan-700 text-cyan-400 hover:bg-cyan-900/30" data-testid="download-boleto-detail">
                      <Download className="w-4 h-4 mr-2" />Baixar Boleto PDF
                    </Button>
                  </a>
                  <Button size="sm" variant="outline" onClick={() => handleCopy(sc.asaas_bankslip_url, 'Link do boleto')} className="w-full border-zinc-700">
                    <Copy className="w-3.5 h-3.5 mr-2" />Copiar Link do Boleto
                  </Button>
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
              {(!sc.asaas_payment_id || sc.asaas_payment_id.startsWith('mock_')) && (
                <div className="p-3 bg-yellow-900/20 border border-yellow-800/30 rounded-lg space-y-2">
                  <p className="text-sm text-yellow-400">
                    Esta cobranca ainda nao foi vinculada ao Asaas. Clique abaixo para gerar o boleto/Pix real.
                  </p>
                  <Button onClick={() => handleGenerateAsaas(sc)} variant="outline" size="sm" className="w-full border-yellow-700 text-yellow-400 hover:bg-yellow-900/30">
                    <ExternalLink className="w-3.5 h-3.5 mr-2" /> Gerar Pagamento no Asaas
                  </Button>
                </div>
              )}

              {/* Pagamento real sem invoice URL - precisa atualizar */}
              {sc.asaas_payment_id && !sc.asaas_payment_id.startsWith('mock_') && !sc.asaas_invoice_url && (
                <div className="p-3 bg-amber-900/20 border border-amber-800/30 rounded-lg text-sm text-amber-400">
                  <p>Fatura pendente de sincronizacao. Clique em "Atualizar do Asaas" para buscar o link da fatura.</p>
                  <Button onClick={() => handleRefreshCobranca(sc)} variant="outline" size="sm" className="mt-2 border-amber-700 text-amber-400 w-full">
                    <RefreshCw className="w-3.5 h-3.5 mr-2" /> Atualizar do Asaas
                  </Button>
                </div>
              )}

              {/* Botoes de acao */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                <Button onClick={() => handlePrint(sc)} variant="outline" className="flex items-center gap-2 border-zinc-700">
                  <Printer className="w-4 h-4" />{sc.asaas_invoice_url ? 'Fatura' : 'Gerar'}
                </Button>
                <Button onClick={() => handleShareWhatsApp(sc)} variant="outline" className="flex items-center gap-2 border-zinc-700 text-emerald-400 hover:text-emerald-300">
                  <Share2 className="w-4 h-4" />WhatsApp
                </Button>
                <Button onClick={() => handleSendEmail(sc)} disabled={sendingEmail === sc.id} variant="outline"
                  className="flex items-center gap-2 border-zinc-700 text-blue-400 hover:text-blue-300"
                  data-testid="send-email-detail-btn">
                  <Mail className={`w-4 h-4 ${sendingEmail === sc.id ? 'animate-pulse' : ''}`} />
                  {sendingEmail === sc.id ? 'Enviando...' : 'Email'}
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
        <DialogContent className="bg-zinc-950 border-zinc-800 max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Editar Cobranca' : 'Nova Cobranca'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="cobranca-form">
            <div>
              <label className="text-sm text-zinc-400">Cliente *</label>
              <div className="mt-1">
                <SearchableSelect
                  value={form.cliente_id}
                  onValueChange={(val) => setForm({ ...form, cliente_id: val, linha_id: '' })}
                  options={[...clientes].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR')).map(c => ({ value: c.id, label: `${c.nome} - ${c.documento}` }))}
                  placeholder="Selecione o cliente..."
                  searchPlaceholder="Buscar por nome ou documento..."
                  testId="cobranca-cliente-select"
                />
              </div>
            </div>
            {form.cliente_id && clienteLinhas(form.cliente_id).length > 0 && (
              <div>
                <label className="text-sm text-zinc-400">Linha / Oferta (opcional)</label>
                <select value={form.linha_id} onChange={e => {
                  const linhaId = e.target.value;
                  const linha = linhas.find(l => l.id === linhaId);
                  const updates = { linha_id: linhaId };
                  if (linha && linha.oferta_nome) {
                    updates.descricao = linha.oferta_nome + (linha.plano_nome ? ` - ${linha.plano_nome}` : '');
                  }
                  if (linha && linha.valor) {
                    updates.valor = linha.valor;
                  }
                  setForm({ ...form, ...updates });
                }}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm mt-1">
                  <option value="">Sem linha especifica</option>
                  {clienteLinhas(form.cliente_id).map(l => (
                    <option key={l.id} value={l.id}>
                      {l.numero || l.msisdn} {l.oferta_nome ? `- ${l.oferta_nome}` : ''} {l.plano_nome ? `(${l.plano_nome})` : ''} {l.valor ? `R$${l.valor}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {!editingId && (
              <div>
                <label className="text-sm text-zinc-400">Modalidade *</label>
                <select value={form.modalidade} onChange={e => setForm({ ...form, modalidade: e.target.value, parcelas: e.target.value === 'avista' ? 1 : form.parcelas })}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm mt-1" data-testid="cobranca-modalidade">
                  <option value="avista">A Vista (parcela unica)</option>
                  <option value="parcelado">Parcelado / Carne</option>
                  <option value="assinatura">Assinatura (recorrente mensal)</option>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-zinc-400">{form.modalidade === 'avista' ? 'Vencimento *' : '1o Vencimento *'}</label>
                <Input type="date" value={form.vencimento} onChange={e => setForm({ ...form, vencimento: e.target.value })}
                  className="bg-zinc-900 border-zinc-700 mt-1" required />
              </div>
              {form.modalidade !== 'avista' && !editingId && (
                <div>
                  <label className="text-sm text-zinc-400">Parcelas *</label>
                  <Input type="number" min="2" max="48" value={form.parcelas} onChange={e => setForm({ ...form, parcelas: e.target.value })}
                    className="bg-zinc-900 border-zinc-700 mt-1" required data-testid="cobranca-parcelas" />
                </div>
              )}
            </div>
            {form.modalidade !== 'avista' && form.valor && form.parcelas > 1 && (
              <div className="p-3 bg-blue-900/20 border border-blue-800/30 rounded-lg text-sm">
                <div className="text-blue-400 font-medium">Resumo</div>
                <div className="text-zinc-300 mt-1">
                  {form.parcelas}x de R$ {parseFloat(form.valor || 0).toFixed(2)} = <span className="font-bold text-white">R$ {(parseFloat(form.valor || 0) * parseInt(form.parcelas || 1)).toFixed(2)}</span>
                </div>
                {form.modalidade === 'assinatura' && (
                  <div className="text-zinc-500 text-xs mt-1">Sera criada uma assinatura recorrente no Asaas</div>
                )}
              </div>
            )}
            <div>
              <label className="text-sm text-zinc-400">Descricao</label>
              <Input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })}
                className="bg-zinc-900 border-zinc-700 mt-1" placeholder="Ex: Mensalidade Abril" />
            </div>
            <Button type="submit" disabled={submitting} className="w-full btn-primary" data-testid="cobranca-submit">
              {submitting ? 'Salvando...' : editingId ? 'Salvar Alteracoes' :
                form.modalidade === 'avista' ? 'Criar Cobranca' :
                form.modalidade === 'parcelado' ? `Gerar ${form.parcelas} Parcelas` :
                `Criar Assinatura (${form.parcelas}x)`}
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

      {/* Dialog Config Asaas */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-400" /> Configurar API Asaas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {asaasConfig.key_prefix && (
              <div className="p-3 bg-zinc-900 rounded-lg text-sm">
                <p className="text-zinc-400">Chave atual: <span className="font-mono text-zinc-300">{asaasConfig.key_prefix}</span></p>
                <p className="text-zinc-400">Tamanho: {asaasConfig.key_length} caracteres</p>
              </div>
            )}
            <div>
              <label className="text-sm text-zinc-400">Chave API do Asaas *</label>
              <Input
                value={configForm.api_key}
                onChange={e => setConfigForm(prev => ({ ...prev, api_key: e.target.value }))}
                className="bg-zinc-900 border-zinc-700 mt-1 font-mono text-xs"
                placeholder="$aact_hmlg_000... ou $aact_prod_..."
                data-testid="asaas-key-input"
              />
              <p className="text-xs text-zinc-500 mt-1">Cole a chave completa do painel do Asaas (Configuracoes &gt; Integracoes &gt; API)</p>
            </div>
            <div>
              <label className="text-sm text-zinc-400">Ambiente</label>
              <select
                value={configForm.environment}
                onChange={e => setConfigForm(prev => ({ ...prev, environment: e.target.value }))}
                className="w-full mt-1 p-2 bg-zinc-900 border border-zinc-700 rounded-md text-white text-sm"
              >
                <option value="sandbox">Sandbox (Testes)</option>
                <option value="production">Producao (Real)</option>
              </select>
            </div>
            <Button onClick={handleSaveAsaasConfig} disabled={configSubmitting || !configForm.api_key}
              className="w-full btn-primary" data-testid="save-asaas-config-btn">
              {configSubmitting ? 'Salvando e testando...' : 'Salvar e Testar Conexao'}
            </Button>
            <Button onClick={handleDiagnostico} disabled={diagLoading} variant="outline"
              className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800" data-testid="diagnostico-asaas-btn">
              {diagLoading ? 'Testando...' : 'Diagnostico da Conexao'}
            </Button>
            <div className="border-t border-zinc-800 pt-4">
              <p className="text-xs text-zinc-500 mb-2">Notificacoes automaticas do Asaas (e-mail, SMS, Correios) geram custo. Desabilite para que o envio seja feito apenas pelo seu atendimento.</p>
              <Button onClick={handleDisableNotifications} disabled={disablingNotifs} variant="outline"
                className="w-full border-red-800 text-red-400 hover:bg-red-900/20" data-testid="disable-notifs-btn">
                {disablingNotifs ? 'Desabilitando...' : 'Desabilitar Notificacoes de Todos os Clientes'}
              </Button>
            </div>
            {diagResult && (
              <div className={`p-3 rounded-lg text-sm space-y-1 ${diagResult.api_test === 'OK' ? 'bg-emerald-500/15 border border-emerald-500/40' : 'bg-red-500/15 border border-red-500/40'}`}
                data-testid="diagnostico-result">
                <p className={diagResult.api_test === 'OK' ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                  API: {diagResult.api_test}
                </p>
                <p className="text-zinc-400">Chave: {diagResult.key_prefix} ({diagResult.key_length} chars)</p>
                <p className="text-zinc-400">Formato valido: {diagResult.key_valid_format ? 'Sim' : 'NAO'}</p>
                <p className="text-zinc-400">Ambiente: {diagResult.environment} | Producao: {diagResult.is_production ? 'Sim' : 'Nao'}</p>
                <p className="text-zinc-400">MongoDB: {diagResult.db_keys_match ? 'Chave sincronizada' : diagResult.db_config || 'Chave divergente'}</p>
                {diagResult.api_error && <p className="text-red-400 text-xs mt-1">Erro: {diagResult.api_error}</p>}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Filtro de Carne */}
      <Dialog open={carneFilterOpen} onOpenChange={setCarneFilterOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 max-w-md">
          <DialogHeader><DialogTitle>Imprimir Carne</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-300 mb-1.5">Cliente *</label>
              <select value={carneClienteId} onChange={e => setCarneClienteId(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-300"
                data-testid="carne-cliente-select">
                <option value="">Selecione o cliente</option>
                {[...new Map(cobrancas.map(c => [c.cliente_id, c.cliente_nome])).entries()]
                  .sort((a, b) => (a[1] || '').localeCompare(b[1] || '', 'pt-BR'))
                  .map(([id, nome]) => (
                    <option key={id} value={id}>{nome} ({cobrancas.filter(c => c.cliente_id === id).length} cobrancas)</option>
                  ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-zinc-300 mb-1.5">Vencimento De</label>
                <Input type="date" value={carneDateFrom} onChange={e => setCarneDateFrom(e.target.value)}
                  className="form-input" data-testid="carne-date-from" />
              </div>
              <div>
                <label className="block text-sm text-zinc-300 mb-1.5">Vencimento Ate</label>
                <Input type="date" value={carneDateTo} onChange={e => setCarneDateTo(e.target.value)}
                  className="form-input" data-testid="carne-date-to" />
              </div>
            </div>
            {carneClienteId && (
              <p className="text-xs text-zinc-500">
                {cobrancas.filter(c => {
                  if (c.cliente_id !== carneClienteId) return false;
                  if (carneDateFrom && c.vencimento < carneDateFrom) return false;
                  if (carneDateTo && c.vencimento > carneDateTo) return false;
                  return true;
                }).length} cobrancas no periodo selecionado
              </p>
            )}
            <Button onClick={() => handlePrintCarne(carneClienteId, carneDateFrom, carneDateTo)}
              disabled={!carneClienteId}
              className="w-full btn-primary flex items-center justify-center gap-2"
              data-testid="carne-filter-btn">
              <Printer className="w-4 h-4" /> Gerar Carne
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Impressao de Carne */}
      <Dialog open={carneDialogOpen} onOpenChange={setCarneDialogOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 max-w-lg">
          <DialogHeader><DialogTitle>Carne - Boletos Asaas</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-zinc-400">
              {carneCobrancas.length} cobranca{carneCobrancas.length !== 1 ? 's' : ''} de <strong className="text-white">{carneCobrancas[0]?.cliente_nome || 'Cliente'}</strong>
            </p>
            <div className="max-h-72 overflow-y-auto space-y-1.5">
              {carneCobrancas.map((c, i) => {
                const hasLink = !!c.asaas_invoice_url;
                return (
                  <div key={c.id} className="flex items-center justify-between gap-2 p-2.5 bg-zinc-900 rounded border border-zinc-800">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-zinc-500 text-xs font-mono w-8">{c.parcela_num ? `${c.parcela_num}/${c.parcela_total}` : `#${i+1}`}</span>
                      <span className="text-zinc-300 text-sm">{c.vencimento.split('-').reverse().join('/')}</span>
                      <span className="text-white text-sm font-medium">R$ {c.valor.toFixed(2)}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs ${statusBg(c.status)}`}>{statusLabel(c.status)}</span>
                    </div>
                    {hasLink ? (
                      <a href={c.asaas_bankslip_url || c.asaas_invoice_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                        data-testid={`carne-boleto-link-${i}`}>
                        <ExternalLink className="w-3 h-3" /> PDF
                      </a>
                    ) : (
                      <span className="text-zinc-600 text-xs">Sem link</span>
                    )}
                  </div>
                );
              })}
            </div>
            {carneCobrancas.filter(c => !c.asaas_invoice_url).length > 0 && (
              <p className="text-xs text-amber-400">
                {carneCobrancas.filter(c => !c.asaas_invoice_url).length} cobranca(s) sem link do Asaas. Gere as cobrancas pelo Asaas primeiro.
              </p>
            )}
            <div className="flex flex-col gap-2">
              <Button onClick={handleCarnePdf} disabled={loadingCarnePdf}
                className="w-full btn-primary flex items-center justify-center gap-2" data-testid="carne-pdf-btn">
                <Printer className={`w-4 h-4 ${loadingCarnePdf ? 'animate-spin' : ''}`} />
                {loadingCarnePdf ? 'Gerando...' : 'Carne PDF (3 boletos/folha)'}
              </Button>
              <Button onClick={printCarne} variant="outline" disabled={!carneCobrancas.some(c => c.asaas_bankslip_url || c.asaas_invoice_url)}
                className="w-full flex items-center justify-center gap-2 border-zinc-700 text-zinc-300" data-testid="print-carne-btn">
                <ExternalLink className="w-4 h-4" /> Abrir Boletos Individuais ({carneCobrancas.filter(c => c.asaas_bankslip_url || c.asaas_invoice_url).length})
              </Button>
            </div>
            <p className="text-xs text-zinc-600 text-center">O carne PDF funciona para cobrancas parceladas criadas com installment no Asaas.</p>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmPasswordDialog open={confirmState.open} onClose={closeConfirm} onConfirmed={confirmState.onConfirmed} actionDescription={confirmState.description} />
    </div>
  );
}