import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { safeArray } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Search, CheckCircle, Clock, AlertCircle, XCircle,
  RefreshCw, Zap, CreditCard,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const STATUS_MAP = {
  aguardando_pagamento: { label: 'Aguardando Pagamento', color: 'text-amber-400 bg-amber-500/15 border-amber-500/40' },
  pago: { label: 'Pago', color: 'text-blue-400 bg-blue-500/15 border-blue-500/40' },
  ativando: { label: 'Ativando', color: 'text-blue-400 bg-blue-500/15 border-blue-500/40' },
  ativo: { label: 'Ativo', color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40' },
  erro: { label: 'Erro', color: 'text-red-400 bg-red-500/15 border-red-500/40' },
  cancelado: { label: 'Cancelado', color: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20' },
};

export function AtivacoesSelfService() {
  const [activations, setActivations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [submitting, setSubmitting] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterStatus ? `?status=${filterStatus}` : '';
      const res = await axios.get(`${API_URL}/api/ativacoes-selfservice${params}`, { withCredentials: true });
      setActivations(safeArray(res.data));
    } catch (e) {
      toast.error('Erro ao carregar ativacoes');
    }
    setLoading(false);
  }, [filterStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleConfirm = async (id) => {
    if (!window.confirm('Confirmar pagamento e ativar este chip?')) return;
    setSubmitting(id);
    try {
      await axios.post(`${API_URL}/api/ativacoes-selfservice/${id}/confirmar`, {}, { withCredentials: true });
      toast.success('Pagamento confirmado. Ativacao em andamento.');
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao confirmar');
    }
    setSubmitting(null);
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancelar esta ativacao e liberar o chip?')) return;
    setSubmitting(id);
    try {
      await axios.post(`${API_URL}/api/ativacoes-selfservice/${id}/cancelar`, {}, { withCredentials: true });
      toast.success('Ativacao cancelada e chip liberado.');
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao cancelar');
    }
    setSubmitting(null);
  };

  const filtered = activations.filter(a => {
    if (search) {
      const s = search.toLowerCase();
      if (!(a.cliente_nome || '').toLowerCase().includes(s) &&
          !(a.iccid || '').includes(s) &&
          !(a.msisdn || '').includes(s)) return false;
    }
    return true;
  });

  const counts = {
    total: activations.length,
    aguardando: activations.filter(a => a.status === 'aguardando_pagamento').length,
    ativos: activations.filter(a => a.status === 'ativo').length,
    erros: activations.filter(a => a.status === 'erro').length,
  };

  return (
    <div className="space-y-6" data-testid="ativacoes-selfservice-page">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title mb-0">Ativacoes Self-Service</h1>
          <p className="text-zinc-300 text-sm">Gerenciar ativacoes feitas pelos clientes via QR Code</p>
        </div>
        <Button onClick={fetchData} variant="outline" className="btn-secondary" data-testid="refresh-btn">
          <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-zinc-900 border-zinc-500/60">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-white font-mono">{counts.total}</p>
            <p className="text-xs text-zinc-400">Total</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-500/60">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-400 font-mono">{counts.aguardando}</p>
            <p className="text-xs text-zinc-400">Aguardando</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-500/60">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400 font-mono">{counts.ativos}</p>
            <p className="text-xs text-zinc-400">Ativados</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-500/60">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-400 font-mono">{counts.erros}</p>
            <p className="text-xs text-zinc-400">Erros</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por cliente, ICCID ou numero..."
            className="form-input pl-10" data-testid="search-input" />
        </div>
        <Select value={filterStatus} onValueChange={v => setFilterStatus(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-48 form-input" data-testid="filter-status">
            <SelectValue placeholder="Todos Status" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-500/60">
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="aguardando_pagamento">Aguardando</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="ativando">Ativando</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="erro">Erro</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-zinc-400">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Nenhuma ativacao self-service encontrada</p>
        </div>
      ) : (
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] -mx-4 sm:mx-0">
          <table className="data-table min-w-[700px] w-full">
            <thead className="sticky top-0 z-10">
              <tr className="bg-blue-950/80 backdrop-blur-sm border-b border-blue-800/50">
                <th className="text-blue-300 w-[16%]">Cliente</th>
                <th className="text-blue-300 w-[14%]">ICCID</th>
                <th className="text-blue-300 w-[12%]">Plano</th>
                <th className="text-blue-300 w-[9%]">Valor</th>
                <th className="text-blue-300 w-[10%]">Tipo</th>
                <th className="text-blue-300 w-[10%]">Status</th>
                <th className="text-blue-300 w-[12%]">Data</th>
                <th className="text-blue-300 w-[17%]">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const st = STATUS_MAP[a.status] || { label: a.status, color: 'text-zinc-400' };
                return (
                  <tr key={a.id}>
                    <td>
                      <p className="text-white text-sm">{a.cliente_nome || '—'}</p>
                      {a.msisdn && <p className="text-zinc-500 text-xs">{a.msisdn}</p>}
                    </td>
                    <td className="font-mono text-xs text-zinc-300">{a.iccid}</td>
                    <td className="text-sm text-zinc-300">{a.plano_nome || a.oferta_nome || '—'}</td>
                    <td>
                      <span className="text-white text-sm">R$ {a.valor_final?.toFixed(2)}</span>
                      {a.desconto > 0 && (
                        <span className="block text-emerald-400 text-xs">-R$ {a.desconto.toFixed(2)}</span>
                      )}
                    </td>
                    <td>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                        a.billing_type === 'PIX' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                        'bg-blue-500/15 text-blue-400 border border-blue-500/40'
                      }`}>
                        <CreditCard className="w-3 h-3" /> {a.billing_type}
                      </span>
                    </td>
                    <td>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${st.color}`}>
                        {st.label}
                      </span>
                      {a.erro_msg && <p className="text-red-400 text-xs mt-1 max-w-[150px] truncate" title={a.erro_msg}>{a.erro_msg}</p>}
                    </td>
                    <td className="text-xs text-zinc-400">
                      {new Date(a.created_at).toLocaleDateString('pt-BR')}
                      <br />
                      {new Date(a.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        {a.status === 'aguardando_pagamento' && (
                          <>
                            <Button size="sm" onClick={() => handleConfirm(a.id)}
                              disabled={submitting === a.id}
                              className="h-8 px-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                              data-testid={`confirm-btn-${a.id}`}
                            >
                              <CheckCircle className="w-3.5 h-3.5 mr-1" /> Confirmar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleCancel(a.id)}
                              disabled={submitting === a.id}
                              className="h-8 px-2 text-xs border-zinc-700 text-zinc-400 hover:text-red-400"
                              data-testid={`cancel-btn-${a.id}`}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                        {a.status === 'erro' && (
                          <Button size="sm" variant="outline" onClick={() => handleCancel(a.id)}
                            disabled={submitting === a.id}
                            className="h-8 px-2 text-xs border-zinc-700 text-zinc-400"
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" /> Cancelar
                          </Button>
                        )}
                        {a.status === 'ativo' && (
                          <span className="text-emerald-400 text-xs flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Concluido
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
