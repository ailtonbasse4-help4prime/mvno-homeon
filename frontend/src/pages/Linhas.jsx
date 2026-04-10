import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { safeArray, safeObject } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { Phone, Lock, Unlock, Info, Filter, RefreshCw, Activity, ShieldAlert, ArrowRightLeft, Tag, Search, X } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export function Linhas() {
  const { isAdmin } = useAuth();
  const [linhas, setLinhas] = useState([]);
  const [ofertas, setOfertas] = useState([]);
  const [blockReasons, setBlockReasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Dialogs
  const [blockPartialDialog, setBlockPartialDialog] = useState(false);
  const [blockTotalDialog, setBlockTotalDialog] = useState(false);
  const [unblockDialog, setUnblockDialog] = useState(false);
  const [statusDialog, setStatusDialog] = useState(false);
  const [planChangeDialog, setPlanChangeDialog] = useState(false);

  const [selectedLinha, setSelectedLinha] = useState(null);
  const [selectedReason, setSelectedReason] = useState('');
  const [selectedNewOferta, setSelectedNewOferta] = useState('');
  const [lineStatus, setLineStatus] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const fetchLinhas = useCallback(async () => {
    try {
      const params = statusFilter && statusFilter !== 'all' ? { status: statusFilter } : {};
      const [linhasRes, ofertasRes, reasonsRes] = await Promise.all([
        axios.get(`${API_URL}/api/linhas`, { params, withCredentials: true }),
        axios.get(`${API_URL}/api/ofertas?ativo=true`, { withCredentials: true }),
        axios.get(`${API_URL}/api/operadora/motivos-bloqueio`, { withCredentials: true }),
      ]);
      setLinhas(safeArray(linhasRes.data));
      setOfertas(safeArray(ofertasRes.data));
      setBlockReasons(safeArray(reasonsRes.data?.reasons));
    } catch (error) {
      toast.error('Erro ao carregar linhas');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchLinhas(); }, [fetchLinhas]);

  // Block Partial
  const handleBlockPartial = async () => {
    if (!selectedLinha) return;
    setProcessing(true);
    try {
      const r = await axios.post(`${API_URL}/api/linhas/${selectedLinha.id}/bloquear-parcial`, {}, { withCredentials: true });
      if (r.data.success) { toast.success(r.data.message); setBlockPartialDialog(false); fetchLinhas(); }
      else toast.error(r.data.message);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao bloquear');
    } finally { setProcessing(false); }
  };

  // Block Total
  const handleBlockTotal = async () => {
    if (!selectedLinha || !selectedReason) return;
    setProcessing(true);
    try {
      const r = await axios.post(`${API_URL}/api/linhas/${selectedLinha.id}/bloquear-total`, { reason: parseInt(selectedReason) }, { withCredentials: true });
      if (r.data.success) { toast.success(r.data.message); setBlockTotalDialog(false); fetchLinhas(); }
      else toast.error(r.data.message);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao bloquear');
    } finally { setProcessing(false); }
  };

  // Unblock
  const handleUnblock = async () => {
    if (!selectedLinha) return;
    setProcessing(true);
    try {
      const r = await axios.post(`${API_URL}/api/linhas/${selectedLinha.id}/desbloquear`, {}, { withCredentials: true });
      if (r.data.success) { toast.success(r.data.message); setUnblockDialog(false); fetchLinhas(); }
      else toast.error(r.data.message);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao desbloquear');
    } finally { setProcessing(false); }
  };

  // Check Status
  const handleCheckStatus = async (linha) => {
    setSelectedLinha(linha);
    setLineStatus(null);
    setStatusDialog(true);
    setCheckingStatus(true);
    try {
      const r = await axios.get(`${API_URL}/api/linhas/${linha.id}/consultar`, { withCredentials: true });
      setLineStatus(safeObject(r.data, {}));
    } catch (e) {
      toast.error('Erro ao consultar status');
      setStatusDialog(false);
    } finally { setCheckingStatus(false); }
  };

  // Change Plan
  const handleChangePlan = async () => {
    if (!selectedLinha || !selectedNewOferta) return;
    setProcessing(true);
    try {
      const r = await axios.post(`${API_URL}/api/linhas/${selectedLinha.id}/alterar-plano`, { oferta_id: selectedNewOferta }, { withCredentials: true });
      if (r.data.success) {
        toast.success(`Plano alterado para ${r.data.new_plan}`);
        setPlanChangeDialog(false);
        fetchLinhas();
      } else toast.error(r.data.message);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao alterar plano');
    } finally { setProcessing(false); }
  };

  const getStatusBadge = (status) => {
    const styles = {
      ativo: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      bloqueado: 'bg-red-500/10 text-red-400 border-red-500/20',
      pendente: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      erro: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    };
    const icons = {
      ativo: <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />,
      bloqueado: <Lock className="w-3 h-3" />,
      pendente: <RefreshCw className="w-3 h-3 animate-spin" />,
      erro: <Activity className="w-3 h-3" />,
    };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-medium border ${styles[status] || 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>
        {icons[status]}{status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6" data-testid="linhas-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-3"><Phone className="w-7 h-7 text-purple-500" />Linhas</h1>
          <p className="text-zinc-400 text-sm -mt-4">Gerenciamento de linhas ativas</p>
        </div>
        <Button onClick={fetchLinhas} variant="outline" className="btn-secondary flex items-center gap-2 w-full sm:w-auto" data-testid="refresh-linhas">
          <RefreshCw className="w-4 h-4" />Atualizar
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-500" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48 form-input" data-testid="linha-status-filter"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800">
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="bloqueado">Bloqueado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, CPF, ICCID, numero..."
            className="form-input w-full pl-9 pr-9 py-2 text-sm"
            data-testid="linha-search-input"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white" data-testid="linha-search-clear">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      {(() => {
        const q = searchTerm.toLowerCase().trim();
        const filteredLinhas = q
          ? linhas.filter(l =>
              (l.msisdn || '').toLowerCase().includes(q) ||
              (l.numero || '').toLowerCase().includes(q) ||
              (l.cliente_nome || '').toLowerCase().includes(q) ||
              (l.iccid || '').toLowerCase().includes(q) ||
              (l.cliente_documento || '').toLowerCase().includes(q)
            )
          : linhas;
        const displayLinhas = [...filteredLinhas].sort((a, b) =>
          (a.cliente_nome || '').localeCompare(b.cliente_nome || '', 'pt-BR', { sensitivity: 'base' })
        );
        return (
          <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-sm p-3 sm:p-4"><p className="text-xl sm:text-2xl font-bold text-white font-mono">{displayLinhas.length}</p><p className="text-xs text-zinc-500">Total</p></div>
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-sm p-3 sm:p-4"><p className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono">{displayLinhas.filter(l => l.status === 'ativo').length}</p><p className="text-xs text-zinc-500">Ativas</p></div>
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-sm p-3 sm:p-4"><p className="text-xl sm:text-2xl font-bold text-amber-400 font-mono">{displayLinhas.filter(l => l.status === 'pendente').length}</p><p className="text-xs text-zinc-500">Pendentes</p></div>
        <div className="bg-red-500/5 border border-red-500/20 rounded-sm p-3 sm:p-4"><p className="text-xl sm:text-2xl font-bold text-red-400 font-mono">{displayLinhas.filter(l => l.status === 'bloqueado').length}</p><p className="text-xs text-zinc-500">Bloqueadas</p></div>
      </div>

      {/* Table */}
      <div className="dashboard-card overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
          <table className="data-table w-full min-w-[1100px]" data-testid="linhas-table">
            <thead className="sticky top-0 z-10">
              <tr className="bg-blue-950/80 backdrop-blur-sm border-b border-blue-800/50">
                <th className="text-blue-300 whitespace-nowrap">Numero</th>
                <th className="text-blue-300 whitespace-nowrap">Cliente</th>
                <th className="text-blue-300 whitespace-nowrap">ICCID</th>
                <th className="text-blue-300 whitespace-nowrap">Plano</th>
                <th className="text-blue-300 whitespace-nowrap">Oferta</th>
                <th className="text-blue-300 whitespace-nowrap">Status</th>
                <th className="text-blue-300 text-right whitespace-nowrap">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {displayLinhas.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-zinc-500 py-8">Nenhuma linha encontrada</td></tr>
              ) : displayLinhas.map((linha) => (
                <tr key={linha.id} data-testid={`linha-row-${linha.id}`}>
                  <td className="font-mono text-white font-semibold text-sm whitespace-nowrap">{linha.msisdn || linha.numero}</td>
                  <td className="text-zinc-300 text-sm whitespace-nowrap">{linha.cliente_nome || '-'}</td>
                  <td className="font-mono text-zinc-400 text-sm whitespace-nowrap">{linha.iccid || '-'}</td>
                  <td className="text-zinc-300 text-sm whitespace-nowrap">{linha.plano_nome || '-'}</td>
                  <td className="text-zinc-400 text-sm whitespace-nowrap">{linha.oferta_nome || '-'}</td>
                  <td className="whitespace-nowrap">{getStatusBadge(linha.status)}</td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isAdmin && (
                        <Button variant="ghost" size="sm" onClick={() => handleCheckStatus(linha)} className="text-zinc-400 hover:text-blue-400" title="Consultar" data-testid={`check-status-${linha.id}`}>
                          <Info className="w-4 h-4" />
                        </Button>
                      )}
                      {isAdmin && linha.status === 'ativo' && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedLinha(linha); setBlockPartialDialog(true); }} className="text-zinc-400 hover:text-amber-400" title="Bloqueio Parcial" data-testid={`block-partial-${linha.id}`}>
                            <Lock className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedLinha(linha); setSelectedReason(''); setBlockTotalDialog(true); }} className="text-zinc-400 hover:text-red-400" title="Bloqueio Total" data-testid={`block-total-${linha.id}`}>
                            <ShieldAlert className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedLinha(linha); setSelectedNewOferta(''); setPlanChangeDialog(true); }} className="text-zinc-400 hover:text-blue-400" title="Alterar Plano" data-testid={`change-plan-${linha.id}`}>
                            <ArrowRightLeft className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      {isAdmin && linha.status === 'bloqueado' && (
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedLinha(linha); setUnblockDialog(true); }} className="text-zinc-400 hover:text-emerald-400" title="Desbloquear" data-testid={`unblock-${linha.id}`}>
                          <Unlock className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
          </>
        );
      })()}

      {/* Block Partial Dialog */}
      <Dialog open={blockPartialDialog} onOpenChange={setBlockPartialDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader><DialogTitle className="text-white flex items-center gap-2"><Lock className="w-5 h-5 text-amber-400" />Bloqueio Parcial</DialogTitle></DialogHeader>
          <div className="py-2">
            <div className="p-3 bg-zinc-800/50 rounded-sm mb-3">
              <p className="text-xs text-zinc-500">Numero</p>
              <p className="text-white font-mono">{selectedLinha?.msisdn || selectedLinha?.numero}</p>
              <p className="text-xs text-zinc-500 mt-1">Cliente: {selectedLinha?.cliente_nome}</p>
            </div>
            <p className="text-zinc-400 text-sm">Bloquear parcialmente esta linha? O usuario nao podera fazer chamadas mas ainda recebera.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockPartialDialog(false)} className="btn-secondary" disabled={processing}>Cancelar</Button>
            <Button onClick={handleBlockPartial} disabled={processing} className="bg-amber-600 hover:bg-amber-700 text-white" data-testid="confirm-block-partial">
              {processing ? 'Processando...' : 'Bloquear Parcial'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block Total Dialog */}
      <Dialog open={blockTotalDialog} onOpenChange={setBlockTotalDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader><DialogTitle className="text-white flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-red-400" />Bloqueio Total</DialogTitle></DialogHeader>
          <div className="py-2 space-y-3">
            <div className="p-3 bg-zinc-800/50 rounded-sm">
              <p className="text-xs text-zinc-500">Numero</p>
              <p className="text-white font-mono">{selectedLinha?.msisdn || selectedLinha?.numero}</p>
              <p className="text-xs text-zinc-500 mt-1">Cliente: {selectedLinha?.cliente_nome}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-zinc-300">Motivo do bloqueio:</p>
              <Select value={selectedReason} onValueChange={setSelectedReason}>
                <SelectTrigger className="form-input" data-testid="block-reason-select"><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  {blockReasons.map(r => (
                    <SelectItem key={r.code} value={String(r.code)}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-red-400 text-xs">Bloqueio total suspende completamente a linha.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockTotalDialog(false)} className="btn-secondary" disabled={processing}>Cancelar</Button>
            <Button onClick={handleBlockTotal} disabled={processing || !selectedReason} className="btn-danger" data-testid="confirm-block-total">
              {processing ? 'Processando...' : 'Bloquear Total'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unblock Dialog */}
      <Dialog open={unblockDialog} onOpenChange={setUnblockDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader><DialogTitle className="text-white flex items-center gap-2"><Unlock className="w-5 h-5 text-emerald-400" />Desbloquear Linha</DialogTitle></DialogHeader>
          <div className="py-2">
            <div className="p-3 bg-zinc-800/50 rounded-sm mb-3">
              <p className="text-xs text-zinc-500">Numero</p>
              <p className="text-white font-mono">{selectedLinha?.msisdn || selectedLinha?.numero}</p>
              <p className="text-xs text-zinc-500 mt-1">Cliente: {selectedLinha?.cliente_nome}</p>
            </div>
            <p className="text-zinc-400 text-sm">Desbloquear esta linha? A linha sera reativada imediatamente.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnblockDialog(false)} className="btn-secondary" disabled={processing}>Cancelar</Button>
            <Button onClick={handleUnblock} disabled={processing} className="bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="confirm-unblock">
              {processing ? 'Processando...' : 'Desbloquear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plan Change Dialog */}
      <Dialog open={planChangeDialog} onOpenChange={setPlanChangeDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader><DialogTitle className="text-white flex items-center gap-2"><ArrowRightLeft className="w-5 h-5 text-blue-400" />Alterar Plano</DialogTitle></DialogHeader>
          <div className="py-2 space-y-3">
            <div className="p-3 bg-zinc-800/50 rounded-sm">
              <p className="text-xs text-zinc-500">Numero / Plano Atual</p>
              <p className="text-white font-mono">{selectedLinha?.msisdn || selectedLinha?.numero}</p>
              <p className="text-sm text-zinc-400 mt-1">{selectedLinha?.plano_nome} - {selectedLinha?.oferta_nome}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-zinc-300">Nova Oferta / Plano:</p>
              <Select value={selectedNewOferta} onValueChange={setSelectedNewOferta}>
                <SelectTrigger className="form-input" data-testid="new-oferta-select"><SelectValue placeholder="Selecione a nova oferta" /></SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 max-h-60">
                  {ofertas.filter(o => o.id !== selectedLinha?.oferta_id).map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      <span className="flex items-center gap-2">
                        <Tag className="w-3 h-3 text-blue-400" />
                        {o.nome} - R$ {o.valor?.toFixed(2)} ({o.franquia})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanChangeDialog(false)} className="btn-secondary" disabled={processing}>Cancelar</Button>
            <Button onClick={handleChangePlan} disabled={processing || !selectedNewOferta} className="btn-primary" data-testid="confirm-plan-change">
              {processing ? 'Processando...' : 'Alterar Plano'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Dialog */}
      <Dialog open={statusDialog} onOpenChange={setStatusDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader><DialogTitle className="text-white flex items-center gap-2"><Activity className="w-5 h-5 text-blue-400" />Consulta da Linha</DialogTitle></DialogHeader>
          <div className="py-2">
            {checkingStatus ? (
              <div className="flex flex-col items-center py-8 gap-4">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-zinc-400">Consultando operadora...</p>
              </div>
            ) : lineStatus ? (
              <div className="space-y-3">
                <div className={`p-3 rounded-sm ${lineStatus.success ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-red-500/5 border border-red-500/20'}`}>
                  <p className="text-xs text-zinc-500 mb-1">Status</p>
                  <p className={`text-sm font-semibold ${lineStatus.success ? 'text-emerald-400' : 'text-red-400'}`}>
                    {lineStatus.success ? 'Consulta realizada' : 'Erro na consulta'}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">{lineStatus.message}</p>
                </div>
                {lineStatus.data && (
                  <div className="space-y-2 text-sm">
                    {Object.entries(lineStatus.data).filter(([k]) => !['raw'].includes(k)).map(([key, val]) => (
                      <div key={key} className="flex justify-between p-2 bg-zinc-800/50 rounded-sm">
                        <span className="text-zinc-500">{key}</span>
                        <span className="text-white font-mono text-xs">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {lineStatus.response_time_ms && (
                  <p className="text-xs text-zinc-600 text-center">Tempo: {lineStatus.response_time_ms}ms</p>
                )}
              </div>
            ) : (
              <p className="text-center text-zinc-500 py-8">Erro ao carregar dados</p>
            )}
          </div>
          <DialogFooter><Button onClick={() => setStatusDialog(false)} className="btn-secondary">Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
