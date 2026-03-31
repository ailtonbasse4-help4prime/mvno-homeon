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
import { toast } from 'sonner';
import { Plus, Package, Edit, Trash2 } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export function Planos() {
  const { isAdmin } = useAuth();
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingPlano, setEditingPlano] = useState(null);
  const [planoToDelete, setPlanoToDelete] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    valor: '',
    franquia: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchPlanos = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/planos`, {
        withCredentials: true
      });
      setPlanos(response.data);
    } catch (error) {
      toast.error('Erro ao carregar planos');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlanos();
  }, [fetchPlanos]);

  const handleOpenDialog = (plano = null) => {
    if (plano) {
      setEditingPlano(plano);
      setFormData({
        nome: plano.nome,
        valor: plano.valor.toString(),
        franquia: plano.franquia
      });
    } else {
      setEditingPlano(null);
      setFormData({ nome: '', valor: '', franquia: '' });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      nome: formData.nome,
      valor: parseFloat(formData.valor),
      franquia: formData.franquia
    };

    try {
      if (editingPlano) {
        await axios.put(
          `${API_URL}/api/planos/${editingPlano.id}`,
          payload,
          { withCredentials: true }
        );
        toast.success('Plano atualizado com sucesso');
      } else {
        await axios.post(`${API_URL}/api/planos`, payload, {
          withCredentials: true
        });
        toast.success('Plano cadastrado com sucesso');
      }
      setDialogOpen(false);
      fetchPlanos();
    } catch (error) {
      const message = error.response?.data?.detail || 'Erro ao salvar plano';
      toast.error(typeof message === 'string' ? message : 'Erro ao salvar plano');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!planoToDelete) return;

    try {
      await axios.delete(`${API_URL}/api/planos/${planoToDelete.id}`, {
        withCredentials: true
      });
      toast.success('Plano removido com sucesso');
      setDeleteDialogOpen(false);
      setPlanoToDelete(null);
      fetchPlanos();
    } catch (error) {
      const message = error.response?.data?.detail || 'Erro ao remover plano';
      toast.error(typeof message === 'string' ? message : 'Erro ao remover plano');
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
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
    <div className="space-y-6" data-testid="planos-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <Package className="w-7 h-7 text-amber-500" />
            Planos
          </h1>
          <p className="text-zinc-400 text-sm -mt-4">Gerenciamento de planos</p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => handleOpenDialog()}
            className="btn-primary flex items-center gap-2"
            data-testid="add-plano-button"
          >
            <Plus className="w-4 h-4" />
            Novo Plano
          </Button>
        )}
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {planos.length === 0 ? (
          <div className="col-span-full text-center text-zinc-500 py-12">
            Nenhum plano cadastrado
          </div>
        ) : (
          planos.map((plano) => (
            <div
              key={plano.id}
              className="dashboard-card relative group"
              data-testid={`plano-card-${plano.id}`}
            >
              {isAdmin && (
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenDialog(plano)}
                    className="w-8 h-8 p-0 text-zinc-400 hover:text-white"
                    data-testid={`edit-plano-${plano.id}`}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPlanoToDelete(plano);
                      setDeleteDialogOpen(true);
                    }}
                    className="w-8 h-8 p-0 text-zinc-400 hover:text-red-400"
                    data-testid={`delete-plano-${plano.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
              
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-white">{plano.nome}</h3>
              </div>
              
              <div className="space-y-3">
                <div>
                  <p className="text-3xl font-bold text-blue-400 font-mono">
                    {formatCurrency(plano.valor)}
                  </p>
                  <p className="text-xs text-zinc-500">por mês</p>
                </div>
                
                <div className="pt-3 border-t border-zinc-800">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-sm bg-emerald-500/10 flex items-center justify-center">
                      <span className="text-emerald-500 text-sm font-bold">GB</span>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-white">{plano.franquia}</p>
                      <p className="text-xs text-zinc-500">de franquia</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingPlano ? 'Editar Plano' : 'Novo Plano'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome" className="text-zinc-300">Nome do Plano</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="form-input"
                placeholder="Ex: Básico 5GB"
                required
                data-testid="plano-nome-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor" className="text-zinc-300">Valor (R$)</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                min="0"
                value={formData.valor}
                onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                className="form-input font-mono"
                placeholder="29.90"
                required
                data-testid="plano-valor-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="franquia" className="text-zinc-300">Franquia</Label>
              <Input
                id="franquia"
                value={formData.franquia}
                onChange={(e) => setFormData({ ...formData, franquia: e.target.value })}
                className="form-input"
                placeholder="Ex: 10GB"
                required
                data-testid="plano-franquia-input"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="btn-secondary"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="btn-primary"
                data-testid="plano-submit-button"
              >
                {submitting ? 'Salvando...' : 'Salvar'}
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
            Tem certeza que deseja remover o plano{' '}
            <span className="text-white font-medium">{planoToDelete?.nome}</span>?
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
              data-testid="confirm-delete-plano"
            >
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
