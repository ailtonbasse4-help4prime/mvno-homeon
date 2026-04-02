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
import { Plus, Package, Edit, Trash2, RefreshCw, Code } from 'lucide-react';

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
    franquia: '',
    descricao: '',
    plan_code: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const r = await axios.post(`${API_URL}/api/operadora/sincronizar-planos`, {}, { withCredentials: true });
      toast.success(r.data.message);
      fetchPlanos();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao sincronizar');
    } finally { setSyncing(false); }
  };

  const fetchPlanos = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/planos`, {
        withCredentials: true,
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
        franquia: plano.franquia,
        descricao: plano.descricao || '',
        plan_code: plano.plan_code || '',
      });
    } else {
      setEditingPlano(null);
      setFormData({ nome: '', franquia: '', descricao: '', plan_code: '' });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      nome: formData.nome,
      franquia: formData.franquia,
      descricao: formData.descricao || null,
      plan_code: formData.plan_code || null,
    };

    try {
      if (editingPlano) {
        await axios.put(`${API_URL}/api/planos/${editingPlano.id}`, payload, {
          withCredentials: true,
        });
        toast.success('Plano atualizado com sucesso');
      } else {
        await axios.post(`${API_URL}/api/planos`, payload, {
          withCredentials: true,
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
        withCredentials: true,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="planos-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <Package className="w-7 h-7 text-amber-500" />
            Planos Tecnicos
          </h1>
          <p className="text-zinc-400 text-sm -mt-4">
            Gerenciamento de planos tecnicos (sem valor comercial)
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <Button onClick={handleSync} variant="outline" className="btn-secondary flex items-center gap-2 flex-1 sm:flex-initial" disabled={syncing} data-testid="sync-planos-button">
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{syncing ? 'Sincronizando...' : 'Sincronizar Operadora'}</span>
              <span className="sm:hidden">{syncing ? 'Sync...' : 'Sync'}</span>
            </Button>
          )}
          {isAdmin && (
            <Button onClick={() => handleOpenDialog()} className="btn-primary flex items-center gap-2 flex-1 sm:flex-initial" data-testid="add-plano-button">
              <Plus className="w-4 h-4" />Novo Plano
            </Button>
          )}
        </div>
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
                {plano.descricao && (
                  <p className="text-xs text-zinc-500 mt-1">{plano.descricao}</p>
                )}
              </div>

              <div className="pt-3 border-t border-zinc-800 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-sm bg-emerald-500/10 flex items-center justify-center">
                    <span className="text-emerald-500 text-sm font-bold">GB</span>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-white">{plano.franquia}</p>
                    <p className="text-xs text-zinc-500">de franquia</p>
                  </div>
                </div>
                {plano.plan_code && (
                  <div className="flex items-center gap-1.5">
                    <Code className="w-3 h-3 text-zinc-500" />
                    <span className="text-xs font-mono text-zinc-500">{plano.plan_code}</span>
                  </div>
                )}
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
              {editingPlano ? 'Editar Plano' : 'Novo Plano Tecnico'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome" className="text-zinc-300">
                Nome do Plano
              </Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="form-input"
                placeholder="Ex: Plano 10GB"
                required
                data-testid="plano-nome-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="franquia" className="text-zinc-300">
                Franquia
              </Label>
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
            <div className="space-y-2">
              <Label htmlFor="descricao" className="text-zinc-300">
                Descricao (opcional)
              </Label>
              <Input
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                className="form-input"
                placeholder="Ex: Plano basico com 10GB de dados"
                data-testid="plano-descricao-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan_code" className="text-zinc-300">
                Codigo do Plano na Operadora (plan_code)
              </Label>
              <Input
                id="plan_code"
                value={formData.plan_code}
                onChange={(e) => setFormData({ ...formData, plan_code: e.target.value })}
                className="form-input font-mono"
                placeholder="Ex: PLAN_10GB"
                data-testid="plano-plancode-input"
              />
              <p className="text-xs text-zinc-500">Codigo usado pela operadora para identificar o plano</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="btn-secondary">Cancelar</Button>
              <Button type="submit" disabled={submitting} className="btn-primary" data-testid="plano-submit-button">{submitting ? 'Salvando...' : 'Salvar'}</Button>
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
            Tem certeza que deseja remover o plano{' '}
            <span className="text-white font-medium">{planoToDelete?.nome}</span>?
          </p>
          <p className="text-xs text-amber-400 mt-1">
            Planos vinculados a ofertas nao podem ser removidos.
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
