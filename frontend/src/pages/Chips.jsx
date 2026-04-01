import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
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
import { Plus, CreditCard, Trash2, Filter, Tag, RefreshCw } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export function Chips() {
  const { isAdmin } = useAuth();
  const [chips, setChips] = useState([]);
  const [ofertas, setOfertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [chipToDelete, setChipToDelete] = useState(null);
  const [formData, setFormData] = useState({ iccid: '', oferta_id: '' });
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const r = await axios.post(`${API_URL}/api/operadora/sincronizar-estoque`, {}, { withCredentials: true });
      toast.success(r.data.message);
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao sincronizar estoque');
    } finally { setSyncing(false); }
  };

  const fetchData = useCallback(async () => {
    try {
      const params = statusFilter && statusFilter !== 'all' ? { status: statusFilter } : {};
      const [chipsRes, ofertasRes] = await Promise.all([
        axios.get(`${API_URL}/api/chips`, { params, withCredentials: true }),
        axios.get(`${API_URL}/api/ofertas?ativo=true`, { withCredentials: true }),
      ]);
      setChips(chipsRes.data);
      setOfertas(ofertasRes.data);
    } catch (error) {
      toast.error('Erro ao carregar dados');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await axios.post(
        `${API_URL}/api/chips`,
        { iccid: formData.iccid, oferta_id: formData.oferta_id },
        { withCredentials: true }
      );
      toast.success('Chip cadastrado com sucesso');
      setDialogOpen(false);
      setFormData({ iccid: '', oferta_id: '' });
      fetchData();
    } catch (error) {
      const message = error.response?.data?.detail || 'Erro ao cadastrar chip';
      toast.error(typeof message === 'string' ? message : 'Erro ao cadastrar chip');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!chipToDelete) return;

    try {
      await axios.delete(`${API_URL}/api/chips/${chipToDelete.id}`, {
        withCredentials: true,
      });
      toast.success('Chip removido com sucesso');
      setDeleteDialogOpen(false);
      setChipToDelete(null);
      fetchData();
    } catch (error) {
      const message = error.response?.data?.detail || 'Erro ao remover chip';
      toast.error(typeof message === 'string' ? message : 'Erro ao remover chip');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'disponivel':
        return <span className="badge-available">Disponivel</span>;
      case 'ativado':
        return <span className="badge-active">Ativado</span>;
      case 'bloqueado':
        return <span className="badge-blocked">Bloqueado</span>;
      case 'cancelado':
        return <span className="badge-inactive">Cancelado</span>;
      case 'reservado':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-sm text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">Reservado</span>;
      default:
        return <span className="badge-inactive">{status}</span>;
    }
  };

  const formatCurrency = (value) => {
    if (value == null) return '—';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="chips-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <CreditCard className="w-7 h-7 text-emerald-500" />
            Chips (SIM Cards)
          </h1>
          <p className="text-zinc-400 text-sm -mt-4">Gerenciamento de chips vinculados a ofertas</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button onClick={handleSync} variant="outline" className="btn-secondary flex items-center gap-2" disabled={syncing} data-testid="sync-estoque-button">
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Sincronizar Estoque'}
            </Button>
          )}
          {isAdmin && (
            <Button onClick={() => { setFormData({ iccid: '', oferta_id: '' }); setDialogOpen(true); }} className="btn-primary flex items-center gap-2" data-testid="add-chip-button">
              <Plus className="w-4 h-4" />Novo Chip
            </Button>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-500" />
          <span className="text-sm text-zinc-400">Filtrar por status:</span>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48 form-input" data-testid="chip-status-filter">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="disponivel">Disponivel</SelectItem>
            <SelectItem value="ativado">Ativado</SelectItem>
            <SelectItem value="bloqueado">Bloqueado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="dashboard-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table" data-testid="chips-table">
            <thead>
              <tr>
                <th>ICCID</th>
                <th>MSISDN</th>
                <th>Status</th>
                <th>Oferta</th>
                <th>Plano / Franquia</th>
                <th>Valor</th>
                <th>Cliente</th>
                <th>Data</th>
                {isAdmin && <th className="text-right">Acoes</th>}
              </tr>
            </thead>
            <tbody>
              {chips.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="text-center text-zinc-500 py-8">
                    Nenhum chip encontrado
                  </td>
                </tr>
              ) : (
                chips.map((chip) => (
                  <tr key={chip.id} data-testid={`chip-row-${chip.id}`}>
                    <td className="font-mono text-white">{chip.iccid}</td>
                    <td className="font-mono text-zinc-400 text-sm">{chip.msisdn || '-'}</td>
                    <td>{getStatusBadge(chip.status)}</td>
                    <td className="text-zinc-300 text-sm">{chip.oferta_nome || '—'}</td>
                    <td className="text-zinc-400 text-sm">
                      {chip.plano_nome ? `${chip.plano_nome} (${chip.franquia})` : '—'}
                    </td>
                    <td className="text-emerald-400 font-mono text-sm">
                      {formatCurrency(chip.valor)}
                    </td>
                    <td className="text-zinc-400">{chip.cliente_nome || '—'}</td>
                    <td className="text-zinc-400 text-sm">
                      {new Date(chip.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    {isAdmin && (
                      <td className="text-right">
                        {chip.status !== 'ativado' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setChipToDelete(chip);
                              setDeleteDialogOpen(true);
                            }}
                            className="text-zinc-400 hover:text-red-400"
                            data-testid={`delete-chip-${chip.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Add Chip Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Novo Chip</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="iccid" className="text-zinc-300">
                ICCID
              </Label>
              <Input
                id="iccid"
                value={formData.iccid}
                onChange={(e) =>
                  setFormData({ ...formData, iccid: e.target.value.replace(/\D/g, '') })
                }
                className="form-input font-mono"
                placeholder="Ex: 8955010012345678901"
                maxLength={20}
                required
                data-testid="chip-iccid-input"
              />
              <p className="text-xs text-zinc-500">
                O ICCID e o numero de identificacao unico do chip (19-20 digitos)
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 flex items-center gap-2">
                <Tag className="w-4 h-4 text-zinc-500" />
                Oferta Vinculada
              </Label>
              <Select
                value={formData.oferta_id}
                onValueChange={(val) => setFormData({ ...formData, oferta_id: val })}
              >
                <SelectTrigger className="form-input" data-testid="chip-oferta-select">
                  <SelectValue placeholder="Selecione uma oferta" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 max-h-60">
                  {ofertas.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      Nenhuma oferta ativa disponivel
                    </SelectItem>
                  ) : (
                    ofertas.map((oferta) => (
                      <SelectItem key={oferta.id} value={oferta.id}>
                        {oferta.nome} - R$ {oferta.valor.toFixed(2)} ({oferta.franquia || '—'})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-zinc-500">
                Cada chip deve estar vinculado a uma oferta comercial
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setFormData({ iccid: '', oferta_id: '' });
                }}
                className="btn-secondary"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting || !formData.oferta_id}
                className="btn-primary"
                data-testid="chip-submit-button"
              >
                {submitting ? 'Cadastrando...' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Confirmar Exclusao</DialogTitle>
          </DialogHeader>
          <p className="text-zinc-400">
            Tem certeza que deseja remover o chip{' '}
            <span className="text-white font-mono">{chipToDelete?.iccid}</span>?
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="btn-secondary"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDelete}
              className="btn-danger"
              data-testid="confirm-delete-chip"
            >
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
