import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { safeArray } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import { SearchableSelect } from '../components/SearchableSelect';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import {
  RefreshCw, Plus, Clock, CheckCircle, XCircle, AlertTriangle, Ban,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const STATUS_MAP = {
  ACTIVE: { label: 'Ativa', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle },
  EXPIRED: { label: 'Expirada', class: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: Clock },
  CANCELLED: { label: 'Cancelada', class: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20', icon: XCircle },
};

const CICLO_MAP = {
  MONTHLY: 'Mensal',
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quinzenal',
  BIMONTHLY: 'Bimestral',
  QUARTERLY: 'Trimestral',
  SEMIANNUALLY: 'Semestral',
  YEARLY: 'Anual',
};

function formatCurrency(value) {
  if (value == null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function StatusBadge({ status }) {
  const info = STATUS_MAP[status] || STATUS_MAP.ACTIVE;
  const Icon = info.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium border ${info.class}`}>
      <Icon className="w-3 h-3" />{info.label}
    </span>
  );
}

export function Assinaturas() {
  const { isAdmin } = useAuth();
  const [assinaturas, setAssinaturas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [linhas, setLinhas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [assinaturaToCancel, setAssinaturaToCancel] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    cliente_id: '', linha_id: '', billing_type: 'PIX', valor: '',
    proximo_vencimento: '', ciclo: 'MONTHLY', descricao: '',
  });

  const fetchData = useCallback(async () => {
    try {
      const params = statusFilter && statusFilter !== 'all' ? { status: statusFilter } : {};
      const [assRes, clientesRes, linhasRes] = await Promise.all([
        axios.get(`${API_URL}/api/carteira/assinaturas`, { params, withCredentials: true }),
        axios.get(`${API_URL}/api/clientes`, { withCredentials: true }),
        axios.get(`${API_URL}/api/linhas`, { withCredentials: true }),
      ]);
      setAssinaturas(safeArray(assRes.data));
      setClientes(safeArray(clientesRes.data));
      setLinhas(safeArray(linhasRes.data));
    } catch (error) {
      toast.error('Erro ao carregar assinaturas');
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const clienteLinhas = formData.cliente_id
    ? linhas.filter(l => l.cliente_id === formData.cliente_id)
    : [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/api/carteira/assinaturas`, {
        cliente_id: formData.cliente_id,
        linha_id: formData.linha_id || null,
        billing_type: formData.billing_type,
        valor: parseFloat(formData.valor),
        proximo_vencimento: formData.proximo_vencimento,
        ciclo: formData.ciclo,
        descricao: formData.descricao || null,
      }, { withCredentials: true });
      toast.success('Assinatura criada');
      setDialogOpen(false);
      setFormData({ cliente_id: '', linha_id: '', billing_type: 'PIX', valor: '', proximo_vencimento: '', ciclo: 'MONTHLY', descricao: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao criar assinatura');
    } finally { setSubmitting(false); }
  };

  const handleCancel = async () => {
    if (!assinaturaToCancel) return;
    try {
      await axios.post(`${API_URL}/api/carteira/assinaturas/${assinaturaToCancel.id}/cancelar`, {}, { withCredentials: true });
      toast.success('Assinatura cancelada');
      setCancelDialogOpen(false);
      setAssinaturaToCancel(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao cancelar');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const ativas = assinaturas.filter(a => a.status === 'ACTIVE').length;

  return (
    <div className="space-y-6" data-testid="assinaturas-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <RefreshCw className="w-7 h-7 text-blue-500" />Assinaturas
          </h1>
          <p className="text-zinc-400 text-sm -mt-4">Cobrancas recorrentes para planos moveis ({ativas} ativas)</p>
        </div>
        {isAdmin && (
          <Button onClick={() => {
            setFormData({ cliente_id: '', linha_id: '', billing_type: 'PIX', valor: '', proximo_vencimento: '', ciclo: 'MONTHLY', descricao: '' });
            setDialogOpen(true);
          }} className="btn-primary flex items-center gap-2 w-full sm:w-auto" data-testid="add-assinatura-button">
            <Plus className="w-4 h-4" />Nova Assinatura
          </Button>
        )}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-zinc-400">Status:</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48 form-input" data-testid="assinatura-status-filter">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ACTIVE">Ativa</SelectItem>
            <SelectItem value="CANCELLED">Cancelada</SelectItem>
            <SelectItem value="EXPIRED">Expirada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="dashboard-card overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
          <table className="data-table w-full min-w-[1400px]" data-testid="assinaturas-table">
            <thead className="sticky top-0 z-10">
              <tr className="bg-blue-950/80 backdrop-blur-sm border-b border-blue-800/50">
                <th className="text-blue-300 whitespace-nowrap min-w-[200px]">Cliente</th>
                <th className="text-blue-300 whitespace-nowrap min-w-[150px]">Linha</th>
                <th className="text-blue-300 whitespace-nowrap min-w-[150px]">Oferta</th>
                <th className="text-blue-300 whitespace-nowrap min-w-[80px]">Tipo</th>
                <th className="text-blue-300 whitespace-nowrap min-w-[100px]">Valor</th>
                <th className="text-blue-300 whitespace-nowrap min-w-[80px]">Ciclo</th>
                <th className="text-blue-300 whitespace-nowrap min-w-[130px]">Proximo Venc.</th>
                <th className="text-blue-300 whitespace-nowrap min-w-[80px]">Status</th>
                <th className="text-blue-300 whitespace-nowrap min-w-[180px]">Asaas ID</th>
                {isAdmin && <th className="text-blue-300 text-right whitespace-nowrap min-w-[80px]">Acoes</th>}
              </tr>
            </thead>
            <tbody>
              {assinaturas.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 10 : 9} className="text-center text-zinc-500 py-8">
                    Nenhuma assinatura encontrada
                  </td>
                </tr>
              ) : (
                assinaturas.map((ass) => (
                  <tr key={ass.id} data-testid={`assinatura-row-${ass.id}`}>
                    <td className="text-white text-sm whitespace-nowrap">{ass.cliente_nome || '-'}</td>
                    <td className="font-mono text-zinc-400 text-sm whitespace-nowrap">{ass.msisdn || '-'}</td>
                    <td className="text-zinc-400 text-sm whitespace-nowrap">{ass.oferta_nome || '-'}</td>
                    <td>
                      <span className={`px-2 py-0.5 rounded-sm text-xs font-medium border ${
                        ass.billing_type === 'PIX' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : ass.billing_type === 'BOLETO' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      }`}>{ass.billing_type}</span>
                    </td>
                    <td className="text-emerald-400 font-mono text-sm font-medium whitespace-nowrap">{formatCurrency(ass.valor)}</td>
                    <td className="text-zinc-400 text-sm whitespace-nowrap">{CICLO_MAP[ass.ciclo] || ass.ciclo}</td>
                    <td className="text-zinc-400 text-sm whitespace-nowrap">{ass.proximo_vencimento ? new Date(ass.proximo_vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                    <td className="whitespace-nowrap"><StatusBadge status={ass.status} /></td>
                    <td className="font-mono text-zinc-500 text-xs whitespace-nowrap">{ass.asaas_subscription_id || '-'}</td>
                    {isAdmin && (
                      <td className="text-right">
                        {ass.status === 'ACTIVE' && (
                          <Button variant="ghost" size="sm"
                            onClick={() => { setAssinaturaToCancel(ass); setCancelDialogOpen(true); }}
                            className="text-zinc-400 hover:text-red-400"
                            data-testid={`cancel-assinatura-${ass.id}`} title="Cancelar assinatura">
                            <Ban className="w-4 h-4" />
                          </Button>
                        )}
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
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Nova Assinatura Recorrente</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">Cliente</Label>
              <SearchableSelect
                value={formData.cliente_id}
                onValueChange={(v) => setFormData({ ...formData, cliente_id: v, linha_id: '' })}
                placeholder="Selecione o cliente"
                searchPlaceholder="Buscar por nome, CPF..."
                testId="assinatura-cliente-select"
                options={[...clientes].filter(c => c.status === 'ativo').sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR')).map(c => ({
                  value: c.id,
                  label: c.nome,
                  sublabel: c.documento || '',
                }))}
              />
            </div>
            {clienteLinhas.length > 0 && (
              <div className="space-y-2">
                <Label className="text-zinc-300">Linha (opcional)</Label>
                <Select value={formData.linha_id} onValueChange={(v) => setFormData({ ...formData, linha_id: v })}>
                  <SelectTrigger className="form-input" data-testid="assinatura-linha-select"><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
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
                  <SelectTrigger className="form-input" data-testid="assinatura-billing-select"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
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
                  className="form-input font-mono" required data-testid="assinatura-valor-input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-zinc-300">Ciclo</Label>
                <Select value={formData.ciclo} onValueChange={(v) => setFormData({ ...formData, ciclo: v })}>
                  <SelectTrigger className="form-input" data-testid="assinatura-ciclo-select"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="MONTHLY">Mensal</SelectItem>
                    <SelectItem value="BIMONTHLY">Bimestral</SelectItem>
                    <SelectItem value="QUARTERLY">Trimestral</SelectItem>
                    <SelectItem value="SEMIANNUALLY">Semestral</SelectItem>
                    <SelectItem value="YEARLY">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Primeiro Vencimento</Label>
                <Input type="date" value={formData.proximo_vencimento}
                  onChange={(e) => setFormData({ ...formData, proximo_vencimento: e.target.value })}
                  className="form-input" required data-testid="assinatura-vencimento-input" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">Descricao (opcional)</Label>
              <Input value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                className="form-input" placeholder="Ex: Assinatura Movel 10GB"
                data-testid="assinatura-descricao-input" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="btn-secondary">Cancelar</Button>
              <Button type="submit" disabled={submitting || !formData.cliente_id} className="btn-primary"
                data-testid="assinatura-submit-button">
                {submitting ? 'Criando...' : 'Criar Assinatura'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader><DialogTitle className="text-white">Cancelar Assinatura</DialogTitle></DialogHeader>
          <p className="text-zinc-400">Deseja cancelar a assinatura de <span className="text-white font-medium">{formatCurrency(assinaturaToCancel?.valor)}/mes</span> para <span className="text-white">{assinaturaToCancel?.cliente_nome}</span>?</p>
          <p className="text-xs text-amber-400 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Esta acao nao pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)} className="btn-secondary">Manter</Button>
            <Button onClick={handleCancel} className="btn-danger" data-testid="confirm-cancel-assinatura">Cancelar Assinatura</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
