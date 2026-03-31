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
import { Plus, CreditCard, Trash2, Filter } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export function Chips() {
  const { isAdmin } = useAuth();
  const [chips, setChips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [chipToDelete, setChipToDelete] = useState(null);
  const [iccid, setIccid] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchChips = useCallback(async () => {
    try {
      const params = statusFilter ? { status: statusFilter } : {};
      const response = await axios.get(`${API_URL}/api/chips`, {
        params,
        withCredentials: true
      });
      setChips(response.data);
    } catch (error) {
      toast.error('Erro ao carregar chips');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchChips();
  }, [fetchChips]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await axios.post(`${API_URL}/api/chips`, { iccid }, {
        withCredentials: true
      });
      toast.success('Chip cadastrado com sucesso');
      setDialogOpen(false);
      setIccid('');
      fetchChips();
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
        withCredentials: true
      });
      toast.success('Chip removido com sucesso');
      setDeleteDialogOpen(false);
      setChipToDelete(null);
      fetchChips();
    } catch (error) {
      const message = error.response?.data?.detail || 'Erro ao remover chip';
      toast.error(typeof message === 'string' ? message : 'Erro ao remover chip');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'disponivel':
        return <span className="badge-available">Disponível</span>;
      case 'ativado':
        return <span className="badge-active">Ativado</span>;
      case 'bloqueado':
        return <span className="badge-blocked">Bloqueado</span>;
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
    <div className="space-y-6" data-testid="chips-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <CreditCard className="w-7 h-7 text-emerald-500" />
            Chips (SIM Cards)
          </h1>
          <p className="text-zinc-400 text-sm -mt-4">Gerenciamento de chips</p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="btn-primary flex items-center gap-2"
          data-testid="add-chip-button"
        >
          <Plus className="w-4 h-4" />
          Novo Chip
        </Button>
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
            <SelectItem value="">Todos</SelectItem>
            <SelectItem value="disponivel">Disponível</SelectItem>
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
                <th>Status</th>
                <th>Cliente</th>
                <th>Data de Cadastro</th>
                {isAdmin && <th className="text-right">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {chips.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="text-center text-zinc-500 py-8">
                    Nenhum chip encontrado
                  </td>
                </tr>
              ) : (
                chips.map((chip) => (
                  <tr key={chip.id} data-testid={`chip-row-${chip.id}`}>
                    <td className="font-mono text-white">{chip.iccid}</td>
                    <td>{getStatusBadge(chip.status)}</td>
                    <td className="text-zinc-400">
                      {chip.cliente_nome || '—'}
                    </td>
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
              <Label htmlFor="iccid" className="text-zinc-300">ICCID</Label>
              <Input
                id="iccid"
                value={iccid}
                onChange={(e) => setIccid(e.target.value.replace(/\D/g, ''))}
                className="form-input font-mono"
                placeholder="Ex: 8955010012345678901"
                maxLength={20}
                required
                data-testid="chip-iccid-input"
              />
              <p className="text-xs text-zinc-500">
                O ICCID é o número de identificação único do chip (geralmente 19-20 dígitos)
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setIccid('');
                }}
                className="btn-secondary"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
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
            <DialogTitle className="text-white">Confirmar Exclusão</DialogTitle>
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
