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
import { Phone, Lock, Unlock, Info, Filter } from 'lucide-react';

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

  const fetchLinhas = useCallback(async () => {
    try {
      const params = statusFilter ? { status: statusFilter } : {};
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

    try {
      const response = await axios.get(
        `${API_URL}/api/linhas/${linha.id}/status`,
        { withCredentials: true }
      );
      setLineStatus(response.data);
    } catch (error) {
      toast.error('Erro ao consultar status');
      setStatusDialogOpen(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ativo':
        return <span className="badge-active">Ativo</span>;
      case 'bloqueado':
        return <span className="badge-blocked">Bloqueado</span>;
      case 'pendente':
        return <span className="badge-pending">Pendente</span>;
      default:
        return <span className="badge-inactive">{status}</span>;
    }
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
      <div>
        <h1 className="page-title flex items-center gap-3">
          <Phone className="w-7 h-7 text-purple-500" />
          Linhas
        </h1>
        <p className="text-zinc-400 text-sm -mt-4">Gerenciamento de linhas ativas</p>
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
            <SelectItem value="">Todos</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="bloqueado">Bloqueado</SelectItem>
          </SelectContent>
        </Select>
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
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCheckStatus(linha)}
                          className="text-zinc-400 hover:text-blue-400"
                          title="Consultar Status"
                          data-testid={`check-status-${linha.id}`}
                        >
                          <Info className="w-4 h-4" />
                        </Button>
                        
                        {linha.status === 'ativo' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedLinha(linha);
                              setActionType('bloquear');
                              setActionDialogOpen(true);
                            }}
                            className="text-zinc-400 hover:text-red-400"
                            title="Bloquear"
                            data-testid={`block-linha-${linha.id}`}
                          >
                            <Lock className="w-4 h-4" />
                          </Button>
                        )}
                        
                        {linha.status === 'bloqueado' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedLinha(linha);
                              setActionType('desbloquear');
                              setActionDialogOpen(true);
                            }}
                            className="text-zinc-400 hover:text-emerald-400"
                            title="Desbloquear"
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
            <DialogTitle className="text-white">
              {actionType === 'bloquear' ? 'Bloquear Linha' : 'Desbloquear Linha'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-zinc-400">
              {actionType === 'bloquear' ? (
                <>
                  Tem certeza que deseja <span className="text-red-400 font-medium">bloquear</span> a linha{' '}
                  <span className="text-white font-mono">{selectedLinha?.numero}</span>?
                </>
              ) : (
                <>
                  Tem certeza que deseja <span className="text-emerald-400 font-medium">desbloquear</span> a linha{' '}
                  <span className="text-white font-mono">{selectedLinha?.numero}</span>?
                </>
              )}
            </p>
            {selectedLinha?.cliente_nome && (
              <p className="text-sm text-zinc-500 mt-2">
                Cliente: {selectedLinha.cliente_nome}
              </p>
            )}
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
            <DialogTitle className="text-white">Status da Linha</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {!lineStatus ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
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
                    <p className="text-lg font-semibold text-emerald-400">{lineStatus.saldo_dados}</p>
                  </div>
                </div>
                
                <div className="p-4 bg-zinc-800/50 rounded-sm">
                  <p className="text-xs text-zinc-500 mb-1">Validade</p>
                  <p className="text-white">
                    {new Date(lineStatus.validade).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>
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
