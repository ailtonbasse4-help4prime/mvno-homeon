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
import { Plus, Tag, Edit, Trash2, Package, CheckCircle, XCircle } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export function Ofertas() {
  const { isAdmin } = useAuth();
  const [ofertas, setOfertas] = useState([]);
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingOferta, setEditingOferta] = useState(null);
  const [ofertaToDelete, setOfertaToDelete] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    plano_id: '',
    valor: '',
    descricao: '',
    ativo: true,
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [ofertasRes, planosRes] = await Promise.all([
        axios.get(`${API_URL}/api/ofertas`, { withCredentials: true }),
        axios.get(`${API_URL}/api/planos`, { withCredentials: true }),
      ]);
      setOfertas(ofertasRes.data);
      setPlanos(planosRes.data);
    } catch (error) {
      toast.error('Erro ao carregar ofertas');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDialog = (oferta = null) => {
    if (oferta) {
      setEditingOferta(oferta);
      setFormData({
        nome: oferta.nome,
        plano_id: oferta.plano_id,
        valor: oferta.valor.toString(),
        descricao: oferta.descricao || '',
        ativo: oferta.ativo,
      });
    } else {
      setEditingOferta(null);
      setFormData({ nome: '', plano_id: '', valor: '', descricao: '', ativo: true });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      nome: formData.nome,
      plano_id: formData.plano_id,
      valor: parseFloat(formData.valor),
      descricao: formData.descricao || null,
      ativo: formData.ativo,
    };

    try {
      if (editingOferta) {
        await axios.put(`${API_URL}/api/ofertas/${editingOferta.id}`, payload, {
          withCredentials: true,
        });
        toast.success('Oferta atualizada com sucesso');
      } else {
        await axios.post(`${API_URL}/api/ofertas`, payload, {
          withCredentials: true,
        });
        toast.success('Oferta cadastrada com sucesso');
      }
      setDialogOpen(false);
      fetchData();
    } catch (error) {
      const message = error.response?.data?.detail || 'Erro ao salvar oferta';
      toast.error(typeof message === 'string' ? message : 'Erro ao salvar oferta');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!ofertaToDelete) return;

    try {
      await axios.delete(`${API_URL}/api/ofertas/${ofertaToDelete.id}`, {
        withCredentials: true,
      });
      toast.success('Oferta removida com sucesso');
      setDeleteDialogOpen(false);
      setOfertaToDelete(null);
      fetchData();
    } catch (error) {
      const message = error.response?.data?.detail || 'Erro ao remover oferta';
      toast.error(typeof message === 'string' ? message : 'Erro ao remover oferta');
    }
  };

  const formatCurrency = (value) => {
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
    <div className="space-y-6" data-testid="ofertas-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <Tag className="w-7 h-7 text-blue-500" />
            Ofertas Comerciais
          </h1>
          <p className="text-zinc-400 text-sm -mt-4">
            Gerenciamento de ofertas comerciais vinculadas a planos tecnicos
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => handleOpenDialog()}
            className="btn-primary flex items-center gap-2"
            data-testid="add-oferta-button"
          >
            <Plus className="w-4 h-4" />
            Nova Oferta
          </Button>
        )}
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {ofertas.length === 0 ? (
          <div className="col-span-full text-center text-zinc-500 py-12">
            Nenhuma oferta cadastrada
          </div>
        ) : (
          ofertas.map((oferta) => (
            <div
              key={oferta.id}
              className={`dashboard-card relative group ${!oferta.ativo ? 'opacity-60' : ''}`}
              data-testid={`oferta-card-${oferta.id}`}
            >
              {isAdmin && (
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenDialog(oferta)}
                    className="w-8 h-8 p-0 text-zinc-400 hover:text-white"
                    data-testid={`edit-oferta-${oferta.id}`}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setOfertaToDelete(oferta);
                      setDeleteDialogOpen(true);
                    }}
                    className="w-8 h-8 p-0 text-zinc-400 hover:text-red-400"
                    data-testid={`delete-oferta-${oferta.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* Status badge */}
              <div className="absolute top-3 left-3">
                {oferta.ativo ? (
                  <span className="badge-active text-xs flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Ativa
                  </span>
                ) : (
                  <span className="badge-blocked text-xs flex items-center gap-1">
                    <XCircle className="w-3 h-3" /> Inativa
                  </span>
                )}
              </div>

              <div className="mb-4 mt-6">
                <h3 className="text-lg font-semibold text-white">{oferta.nome}</h3>
                {oferta.descricao && (
                  <p className="text-xs text-zinc-500 mt-1">{oferta.descricao}</p>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-3xl font-bold text-blue-400 font-mono">
                    {formatCurrency(oferta.valor)}
                  </p>
                  <p className="text-xs text-zinc-500">por mes</p>
                </div>

                <div className="pt-3 border-t border-zinc-800">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-sm bg-amber-500/10 flex items-center justify-center">
                      <Package className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {oferta.plano_nome || 'Plano nao encontrado'}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {oferta.franquia || '—'} de franquia
                      </p>
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
              {editingOferta ? 'Editar Oferta' : 'Nova Oferta Comercial'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="oferta-nome" className="text-zinc-300">
                Nome da Oferta
              </Label>
              <Input
                id="oferta-nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="form-input"
                placeholder="Ex: Chip 10GB Essencial"
                required
                data-testid="oferta-nome-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">Plano Tecnico Vinculado</Label>
              <Select
                value={formData.plano_id}
                onValueChange={(val) => setFormData({ ...formData, plano_id: val })}
              >
                <SelectTrigger className="form-input" data-testid="oferta-plano-select">
                  <SelectValue placeholder="Selecione um plano" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  {planos.map((plano) => (
                    <SelectItem key={plano.id} value={plano.id}>
                      {plano.nome} ({plano.franquia})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="oferta-valor" className="text-zinc-300">
                Valor (R$)
              </Label>
              <Input
                id="oferta-valor"
                type="number"
                step="0.01"
                min="0"
                value={formData.valor}
                onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                className="form-input font-mono"
                placeholder="49.90"
                required
                data-testid="oferta-valor-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oferta-descricao" className="text-zinc-300">
                Descricao (opcional)
              </Label>
              <Input
                id="oferta-descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                className="form-input"
                placeholder="Ex: Oferta essencial com 10GB"
                data-testid="oferta-descricao-input"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="oferta-ativo"
                checked={formData.ativo}
                onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-blue-500 focus:ring-blue-500"
                data-testid="oferta-ativo-checkbox"
              />
              <Label htmlFor="oferta-ativo" className="text-zinc-300 cursor-pointer">
                Oferta ativa
              </Label>
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
                disabled={submitting || !formData.plano_id}
                className="btn-primary"
                data-testid="oferta-submit-button"
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
            <DialogTitle className="text-white">Confirmar Exclusao</DialogTitle>
          </DialogHeader>
          <p className="text-zinc-400">
            Tem certeza que deseja remover a oferta{' '}
            <span className="text-white font-medium">{ofertaToDelete?.nome}</span>?
          </p>
          <p className="text-xs text-amber-400 mt-1">
            Ofertas vinculadas a chips nao podem ser removidas.
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
              data-testid="confirm-delete-oferta"
            >
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
