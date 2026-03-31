import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { Phone, Lock, Unlock, Info, Filter, RefreshCw, Activity } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export function Linhas() {
  const [linhas, setLinhas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedLinha, setSelectedLinha] = useState(null);
  const [actionType, setActionType] = useState(null); // 'bloquear' or 'desbloquear'
  const [lineStatus, setLineStatus] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const fetchLinhas = useCallback(async () => {
    try {
      const params = statusFilter && statusFilter !== 'all' ? { status: statusFilter } : {};
      const response = await axios.get(`${API_URL}/api/linhas`, {
        params,
        withCredentials: true
      });
      setLinhas(response.data);
    } catch (error) {
      toast.error('Erro ao carregar linhas');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchLinhas();
  }, [fetchLinhas]);

  const handleAction = async () => {
    if (!selectedLinha || !actionType) return;

    setProcessing(true);
    try {
      const endpoint = actionType === 'bloquear' ? 'bloquear' : 'desbloquear';
      const response = await axios.post(
        `${API_URL}/api/linhas/${selectedLinha.id}/${endpoint}`,
        {},
        { withCredentials: true }
      );

      if (response.data.success) {
        toast.success(response.data.message);
        setActionDialogOpen(false);
        fetchLinhas();
      } else {
        toast.error(response.data.message || 'Erro ao processar ação');
      }
    } catch (error) {
      const message = error.response?.data?.detail || 'Erro ao processar ação';
      toast.error(typeof message === 'string' ? message : 'Erro ao processar ação');
    } finally {
      setProcessing(false);
    }
  };

  const handleCheckStatus = async (linha) => {
    setSelectedLinha(linha);
    setLineStatus(null);
    setStatusDialogOpen(true);
    setCheckingStatus(true);

    try {
      const response = await axios.get(
        `${API_URL}/api/linhas/${linha.id}/status`,
        { withCredentials: true }
      );
      setLineStatus(response.data);
    } catch (error) {
      toast.error('Erro ao consultar status');
      setStatusDialogOpen(false);
    } finally {
      setCheckingStatus(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ativo':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Ativo
          </span>
        );
      case 'bloqueado':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            <Lock className="w-3 h-3" />
            Bloqueado
          </span>
        );
      case 'pendente':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Pendente
          </span>
        );
      case 'erro':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <Activity className="w-3 h-3" />
            Erro
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-sm text-xs font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
            {status}
          </span>
        );
    }
  };

  const canBlock = (status) => {
    return status === 'ativo';
  };

  const canUnblock = (status) => {
    return status === 'bloqueado';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="linhas-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <Phone className="w-7 h-7 text-purple-500" />
            Linhas
          </h1>
          <p className="text-zinc-400 text-sm -mt-4">Gerenciamento de linhas ativas</p>
        </div>
        <Button
          onClick={fetchLinhas}
          variant="outline"
          className="btn-secondary flex items-center gap-2"
          data-testid="refresh-linhas"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </Button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-500" />
          <span className="text-sm text-zinc-400">Filtrar por status:</span>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48 form-input" data-testid="linha-status-filter">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="bloqueado">Bloqueado</SelectItem>
            <SelectItem value="erro">Erro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-sm p-4">
          <p className="text-2xl font-bold text-white font-mono">{linhas.length}</p>
          <p className="text-xs text-zinc-500">Total de Linhas</p>
        </div>
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-sm p-4">
          <p className="text-2xl font-bold text-emerald-400 font-mono">
            {linhas.filter(l => l.status === 'ativo').length}
          </p>
          <p className="text-xs text-zinc-500">Ativas</p>
        </div>
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-sm p-4">
          <p className="text-2xl font-bold text-amber-400 font-mono">
            {linhas.filter(l => l.status === 'pendente').length}
          </p>
          <p className="text-xs text-zinc-500">Pendentes</p>
        </div>
        <div className="bg-red-500/5 border border-red-500/20 rounded-sm p-4">
          <p className="text-2xl font-bold text-red-400 font-mono">
            {linhas.filter(l => l.status === 'bloqueado').length}
          </p>
          <p className="text-xs text-zinc-500">Bloqueadas</p>
        </div>
      </div>

      {/* Table */}
      <div className="dashboard-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table" data-testid="linhas-table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Cliente</th>
                <th>ICCID</th>
                <th>Plano</th>
                <th>Status</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-zinc-500 py-8">
                    Nenhuma linha encontrada
                  </td>
                </tr>
              ) : (
                linhas.map((linha) => (
                  <tr key={linha.id} data-testid={`linha-row-${linha.id}`}>
                    <td className="font-mono text-white font-semibold">{linha.numero}</td>
                    <td className="text-zinc-300">{linha.cliente_nome || '—'}</td>
                    <td className="font-mono text-zinc-400 text-sm">{linha.iccid || '—'}</td>
                    <td className="text-zinc-300">{linha.plano_nome || '—'}</td>
                    <td>{getStatusBadge(linha.status)}</td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Consultar Status */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCheckStatus(linha)}
                          className="text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10"
                          title="Consultar Status"
                          data-testid={`check-status-${linha.id}`}
                        >
                          <Info className="w-4 h-4" />
                        </Button>
                        
                        {/* Bloquear */}
                        {canBlock(linha.status) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedLinha(linha);
                              setActionType('bloquear');
                              setActionDialogOpen(true);
                            }}
                            className="text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
                            title="Bloquear Linha"
                            data-testid={`block-linha-${linha.id}`}
                          >
                            <Lock className="w-4 h-4" />
                          </Button>
                        )}
                        
                        {/* Desbloquear */}
                        {canUnblock(linha.status) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedLinha(linha);
                              setActionType('desbloquear');
                              setActionDialogOpen(true);
                            }}
                            className="text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10"
                            title="Desbloquear Linha"
                            data-testid={`unblock-linha-${linha.id}`}
                          >
                            <Unlock className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Confirmation Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              {actionType === 'bloquear' ? (
                <>
                  <Lock className="w-5 h-5 text-red-400" />
                  Bloquear Linha
                </>
              ) : (
                <>
                  <Unlock className="w-5 h-5 text-emerald-400" />
                  Desbloquear Linha
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 bg-zinc-800/50 rounded-sm mb-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Número</p>
                  <p className="text-white font-mono font-semibold">{selectedLinha?.numero}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Cliente</p>
                  <p className="text-white">{selectedLinha?.cliente_nome || '—'}</p>
                </div>
              </div>
            </div>
            
            <p className="text-zinc-400">
              {actionType === 'bloquear' ? (
                <>
                  Tem certeza que deseja <span className="text-red-400 font-medium">bloquear</span> esta linha?
                  A linha será suspensa imediatamente.
                </>
              ) : (
                <>
                  Tem certeza que deseja <span className="text-emerald-400 font-medium">desbloquear</span> esta linha?
                  A linha será reativada imediatamente.
                </>
              )}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionDialogOpen(false)}
              className="btn-secondary"
              disabled={processing}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAction}
              disabled={processing}
              className={actionType === 'bloquear' ? 'btn-danger' : 'btn-success'}
              data-testid="confirm-action-button"
            >
              {processing ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processando...</span>
                </div>
              ) : actionType === 'bloquear' ? (
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  <span>Bloquear</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Unlock className="w-4 h-4" />
                  <span>Desbloquear</span>
                </div>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" />
              Status da Linha
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {checkingStatus ? (
              <div className="flex flex-col items-center justify-center py-8 gap-4">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-zinc-400">Consultando operadora...</p>
              </div>
            ) : lineStatus ? (
              <div className="space-y-4">
                <div className="p-4 bg-zinc-800/50 rounded-sm">
                  <p className="text-xs text-zinc-500 mb-1">Número</p>
                  <p className="text-xl font-mono font-bold text-white">{lineStatus.numero}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-zinc-800/50 rounded-sm">
                    <p className="text-xs text-zinc-500 mb-1">Status</p>
                    {getStatusBadge(lineStatus.status)}
                  </div>
                  <div className="p-4 bg-zinc-800/50 rounded-sm">
                    <p className="text-xs text-zinc-500 mb-1">Saldo de Dados</p>
                    <p className="text-lg font-semibold text-emerald-400">{lineStatus.saldo_dados || '—'}</p>
                  </div>
                </div>
                
                <div className="p-4 bg-zinc-800/50 rounded-sm">
                  <p className="text-xs text-zinc-500 mb-1">Validade</p>
                  <p className="text-white">
                    {lineStatus.validade 
                      ? new Date(lineStatus.validade).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        })
                      : '—'
                    }
                  </p>
                </div>

                {lineStatus.response_time_ms && (
                  <p className="text-xs text-zinc-600 text-center">
                    Tempo de resposta: {lineStatus.response_time_ms}ms
                  </p>
                )}
              </div>
            ) : (
              <p className="text-center text-zinc-500 py-8">Erro ao carregar status</p>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => setStatusDialogOpen(false)}
              className="btn-secondary"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
