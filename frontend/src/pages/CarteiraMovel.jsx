import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { safeArray, safeObject } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import {
  Wallet, Plus, Trash2, Search, DollarSign, Clock, AlertTriangle,
  CheckCircle, XCircle, Receipt, TrendingUp, Ban, Mail, Send,
} from 'lucide-react';
import { ConfirmPasswordDialog } from '../components/ConfirmPasswordDialog';
import { useSecureAction } from '../hooks/useSecureAction';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const STATUS_MAP = {
  PENDING: { label: 'Pendente', class: 'bg-amber-500/15 text-amber-400 border-amber-500/40', icon: Clock },
  CONFIRMED: { label: 'Confirmado', class: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40', icon: CheckCircle },
  RECEIVED: { label: 'Recebido', class: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40', icon: CheckCircle },
  OVERDUE: { label: 'Vencido', class: 'bg-red-500/15 text-red-400 border-red-500/40', icon: AlertTriangle },
  REFUNDED: { label: 'Reembolsado', class: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20', icon: Ban },
  CANCELLED: { label: 'Cancelado', class: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20', icon: XCircle },
};

function formatCurrency(value) {
  if (value == null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function StatusBadge({ status }) {
  const info = STATUS_MAP[status] || STATUS_MAP.PENDING;
  const Icon = info.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium border ${info.class}`}>
      <Icon className="w-3 h-3" />{info.label}
    </span>
  );
}

export function CarteiraMovel() {
  const { isAdmin } = useAuth();
  const { executeSecureDelete, confirmState, closeConfirm } = useSecureAction();
  const [resumo, setResumo] = useState(null);
  const [cobrancas, setCobrancas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [linhas, setLinhas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cobrancaToDelete, setCobrancaToDelete] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    cliente_id: '', linha_id: '', billing_type: 'PIX', valor: '', vencimento: '', descricao: '',
  });
  const [emailConfig, setEmailConfig] = useState(null);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const params = statusFilter && statusFilter !== 'all' ? { status: statusFilter } : {};
      const [resumoRes, cobrancasRes, clientesRes, linhasRes, emailRes] = await Promise.all([
        axios.get(`${API_URL}/api/carteira/resumo`, { withCredentials: true }),
        axios.get(`${API_URL}/api/carteira/cobrancas`, { params, withCredentials: true }),
        axios.get(`${API_URL}/api/clientes`, { withCredentials: true }),
        axios.get(`${API_URL}/api/linhas`, { withCredentials: true }),
        axios.get(`${API_URL}/api/email/config`, { withCredentials: true }).catch(() => ({ data: null })),
      ]);
      setResumo(safeObject(resumoRes.data));
      setCobrancas(safeArray(cobrancasRes.data));
      setClientes(safeArray(clientesRes.data));
      setLinhas(safeArray(linhasRes.data));
      if (emailRes.data) setEmailConfig(emailRes.data);
    } catch (error) {
      toast.error('Erro ao carregar dados da carteira');
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSendTestEmail = async () => {
    if (!testEmail) { toast.error('Informe o email de destino'); return; }
    setSendingTest(true);
    try {
      const res = await axios.post(`${API_URL}/api/email/test`, { to_email: testEmail }, { withCredentials: true });
      if (res.data.success) {
        toast.success(`Email de teste enviado para ${testEmail}`);
      } else {
        toast.error(res.data.error || 'Falha ao enviar');
      }
    } catch (e) { toast.error(e.response?.data?.detail || 'Erro ao enviar email de teste'); }
    setSendingTest(false);
  };

  const clienteLinhas = formData.cliente_id
    ? linhas.filter(l => l.cliente_id === formData.cliente_id)
    : [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/api/carteira/cobrancas`, {
        cliente_id: formData.cliente_id,
        linha_id: formData.linha_id || null,
        billing_type: formData.billing_type,
        valor: parseFloat(formData.valor),
        vencimento: formData.vencimento,
        descricao: formData.descricao || null,
      }, { withCredentials: true });
      toast.success('Cobranca criada');
      setDialogOpen(false);
      setFormData({ cliente_id: '', linha_id: '', billing_type: 'PIX', valor: '', vencimento: '', descricao: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao criar cobranca');
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!cobrancaToDelete) return;
    setDeleteDialogOpen(false);
    try {
      await executeSecureDelete(`/api/carteira/cobrancas/${cobrancaToDelete.id}`, `Remover cobranca do cliente`);
      toast.success('Cobranca removida');
      setCobrancaToDelete(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao remover');
    }
  };

  const handleConsultar = async (cobranca) => {
    try {
      const res = await axios.post(`${API_URL}/api/carteira/cobrancas/${cobranca.id}/consultar`, {}, { withCredentials: true });
      toast.success(`Status: ${res.data.status}`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao consultar');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const asaasConfigured = resumo?.asaas?.configured;

  return (
    <div className="space-y-6" data-testid="carteira-movel-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <Wallet className="w-7 h-7 text-emerald-500" />Carteira Movel
          </h1>
          <p className="text-zinc-300 text-sm -mt-4">Gestao financeira exclusiva para planos moveis</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium border ${
            asaasConfigured
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
              : 'bg-amber-500/15 text-amber-400 border-amber-500/40'
          }`} data-testid="asaas-status-badge">
            {asaasConfigured ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
            {asaasConfigured ? 'Asaas Conectado' : 'Asaas Pendente'}
          </span>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium border ${
            emailConfig?.configured
              ? 'bg-blue-500/15 text-blue-400 border-blue-500/40'
              : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
          }`} data-testid="email-status-badge">
            <Mail className="w-3 h-3" />
            {emailConfig?.configured ? 'Email Ativo' : 'Email Pendente'}
          </span>
          {isAdmin && (
            <Button onClick={() => {
              setFormData({ cliente_id: '', linha_id: '', billing_type: 'PIX', valor: '', vencimento: '', descricao: '' });
              setDialogOpen(true);
            }} className="btn-primary flex items-center gap-2 w-full sm:w-auto" data-testid="add-cobranca-button">
              <Plus className="w-4 h-4" />Nova Cobranca
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {resumo && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" data-testid="carteira-resumo">
          <div className="dashboard-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-sm bg-emerald-500/15 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-zinc-300">Receita Total</p>
                <p className="text-xl font-bold font-mono text-emerald-400">{formatCurrency(resumo.financeiro.receita_total)}</p>
              </div>
            </div>
          </div>
          <div className="dashboard-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-sm bg-amber-500/15 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-zinc-300">Pendente</p>
                <p className="text-xl font-bold font-mono text-amber-400">{formatCurrency(resumo.financeiro.pendente_total)}</p>
                <p className="text-xs text-zinc-600">{resumo.cobrancas.pendentes} cobrancas</p>
              </div>
            </div>
          </div>
          <div className="dashboard-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-sm bg-red-500/15 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-zinc-300">Vencido</p>
                <p className="text-xl font-bold font-mono text-red-400">{formatCurrency(resumo.financeiro.vencido_total)}</p>
                <p className="text-xs text-zinc-600">{resumo.cobrancas.vencidas} cobrancas</p>
              </div>
            </div>
          </div>
          <div className="dashboard-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-sm bg-blue-500/15 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-zinc-300">Assinaturas Ativas</p>
                <p className="text-xl font-bold font-mono text-blue-400">{resumo.assinaturas.ativas}</p>
                <p className="text-xs text-zinc-600">{resumo.assinaturas.total} total</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Config Card */}
      {isAdmin && emailConfig && (
        <div className="dashboard-card" data-testid="email-config-card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-400" />
              <h3 className="text-sm font-semibold text-zinc-200">Notificacoes por Email</h3>
            </div>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${
              emailConfig.configured
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                : 'bg-red-500/15 text-red-400 border-red-500/40'
            }`}>
              {emailConfig.configured ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              {emailConfig.configured ? 'Configurado' : 'Nao configurado'}
            </span>
          </div>
          {emailConfig.configured && (
            <>
              <p className="text-xs text-zinc-400 mb-3">
                Emails enviados automaticamente via <strong className="text-zinc-300">{emailConfig.email}</strong> ao criar cobrancas e ativar chips.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="email"
                  value={testEmail}
                  onChange={e => setTestEmail(e.target.value)}
                  placeholder="Email para teste..."
                  className="form-input flex-1 h-9 text-sm"
                  data-testid="test-email-input"
                />
                <Button
                  onClick={handleSendTestEmail}
                  disabled={sendingTest || !testEmail}
                  size="sm"
                  className="h-9 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                  data-testid="send-test-email-btn"
                >
                  {sendingTest ? <Mail className="w-3.5 h-3.5 animate-pulse" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                  {sendingTest ? 'Enviando...' : 'Testar'}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-zinc-400">Status:</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48 form-input" data-testid="cobranca-status-filter">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-500/60">
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="PENDING">Pendente</SelectItem>
            <SelectItem value="CONFIRMED">Confirmado</SelectItem>
            <SelectItem value="RECEIVED">Recebido</SelectItem>
            <SelectItem value="OVERDUE">Vencido</SelectItem>
            <SelectItem value="CANCELLED">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cobrancas Table */}
      <div className="dashboard-card overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-340px)]">
          <table className="data-table w-full min-w-[1400px]" data-testid="cobrancas-table">
            <thead className="sticky top-0 z-10">
              <tr className="bg-blue-950/80 backdrop-blur-sm border-b border-blue-800/50">
                <th className="text-blue-300 whitespace-nowrap min-w-[180px]">Cliente</th>
                <th className="text-blue-300 whitespace-nowrap min-w-[140px]">Linha</th>
                <th className="text-blue-300 whitespace-nowrap min-w-[140px]">Oferta</th>
                <th className="text-blue-300 whitespace-nowrap min-w-[80px]">Tipo</th>
                <th className="text-blue-300 whitespace-nowrap min-w-[100px]">Valor</th>
                <th className="text-blue-300 whitespace-nowrap min-w-[120px]">Vencimento</th>
                <th className="text-blue-300 whitespace-nowrap min-w-[90px]">Status</th>
                <th className="text-blue-300 whitespace-nowrap min-w-[180px]">Asaas ID</th>
                <th className="text-blue-300 whitespace-nowrap min-w-[110px]">Pago em</th>
                {isAdmin && <th className="text-blue-300 text-right whitespace-nowrap min-w-[80px]">Acoes</th>}
              </tr>
            </thead>
            <tbody>
              {cobrancas.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 10 : 9} className="text-center text-zinc-500 py-8">
                    Nenhuma cobranca encontrada
                  </td>
                </tr>
              ) : (
                cobrancas.map((cob) => (
                  <tr key={cob.id} data-testid={`cobranca-row-${cob.id}`}>
                    <td className="text-white text-sm whitespace-nowrap">{cob.cliente_nome || '-'}</td>
                    <td className="font-mono text-zinc-300 text-sm whitespace-nowrap">{cob.msisdn || '-'}</td>
                    <td className="text-zinc-300 text-sm whitespace-nowrap">{cob.oferta_nome || '-'}</td>
                    <td className="whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-sm text-xs font-medium border ${
                        cob.billing_type === 'PIX' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                        : cob.billing_type === 'BOLETO' ? 'bg-amber-500/15 text-amber-400 border-amber-500/40'
                        : 'bg-blue-500/15 text-blue-400 border-blue-500/40'
                      }`}>{cob.billing_type}</span>
                    </td>
                    <td className="text-emerald-400 font-mono text-sm font-medium whitespace-nowrap">{formatCurrency(cob.valor)}</td>
                    <td className="text-zinc-300 text-sm whitespace-nowrap">{cob.vencimento ? new Date(cob.vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                    <td className="whitespace-nowrap"><StatusBadge status={cob.status} /></td>
                    <td className="font-mono text-zinc-500 text-xs whitespace-nowrap">{cob.asaas_payment_id || '-'}</td>
                    <td className="text-zinc-300 text-sm whitespace-nowrap">{cob.paid_at ? new Date(cob.paid_at).toLocaleDateString('pt-BR') : '-'}</td>
                    {isAdmin && (
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {cob.asaas_payment_id && (
                            <Button variant="ghost" size="sm" onClick={() => handleConsultar(cob)}
                              className="text-zinc-400 hover:text-blue-400" title="Consultar status no Asaas"
                              data-testid={`consultar-cobranca-${cob.id}`}>
                              <Search className="w-4 h-4" />
                            </Button>
                          )}
                          {cob.status === 'PENDING' && (
                            <Button variant="ghost" size="sm"
                              onClick={() => { setCobrancaToDelete(cob); setDeleteDialogOpen(true); }}
                              className="text-zinc-400 hover:text-red-400"
                              data-testid={`delete-cobranca-${cob.id}`}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-500/60">
          <DialogHeader>
            <DialogTitle className="text-white">Nova Cobranca</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">Cliente</Label>
              <Select value={formData.cliente_id} onValueChange={(v) => setFormData({ ...formData, cliente_id: v, linha_id: '' })}>
                <SelectTrigger className="form-input" data-testid="cobranca-cliente-select"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 max-h-60">
                  {clientes.filter(c => c.status === 'ativo').map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome} - {c.documento}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {clienteLinhas.length > 0 && (
              <div className="space-y-2">
                <Label className="text-zinc-300">Linha (opcional)</Label>
                <Select value={formData.linha_id} onValueChange={(v) => setFormData({ ...formData, linha_id: v })}>
                  <SelectTrigger className="form-input" data-testid="cobranca-linha-select"><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-500/60">
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {clienteLinhas.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.msisdn || l.numero} - {l.plano_nome || 'Plano'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-zinc-300">Tipo de Pagamento</Label>
                <Select value={formData.billing_type} onValueChange={(v) => setFormData({ ...formData, billing_type: v })}>
                  <SelectTrigger className="form-input" data-testid="cobranca-billing-select"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-500/60">
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="BOLETO">Boleto</SelectItem>
                    <SelectItem value="CREDIT_CARD">Cartao de Credito</SelectItem>
                    <SelectItem value="UNDEFINED">A definir</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Valor (R$)</Label>
                <Input type="number" step="0.01" min="0" value={formData.valor}
                  onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                  className="form-input font-mono" required data-testid="cobranca-valor-input" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">Vencimento</Label>
              <Input type="date" value={formData.vencimento}
                onChange={(e) => setFormData({ ...formData, vencimento: e.target.value })}
                className="form-input" required data-testid="cobranca-vencimento-input" />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">Descricao (opcional)</Label>
              <Input value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                className="form-input" placeholder="Ex: Plano Movel 10GB - Abril"
                data-testid="cobranca-descricao-input" />
            </div>
            {!asaasConfigured && (
              <p className="text-xs text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" />
                Asaas nao configurado. A cobranca sera salva localmente.
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="btn-secondary">Cancelar</Button>
              <Button type="submit" disabled={submitting || !formData.cliente_id} className="btn-primary"
                data-testid="cobranca-submit-button">
                {submitting ? 'Criando...' : 'Criar Cobranca'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-500/60">
          <DialogHeader><DialogTitle className="text-white">Confirmar Exclusao</DialogTitle></DialogHeader>
          <p className="text-zinc-400">Remover a cobranca de <span className="text-white font-medium">{formatCurrency(cobrancaToDelete?.valor)}</span>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="btn-secondary">Cancelar</Button>
            <Button onClick={handleDelete} className="btn-danger" data-testid="confirm-delete-cobranca">Remover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmPasswordDialog open={confirmState.open} onClose={closeConfirm} onConfirmed={confirmState.onConfirmed} actionDescription={confirmState.description} />
    </div>
  );
}
