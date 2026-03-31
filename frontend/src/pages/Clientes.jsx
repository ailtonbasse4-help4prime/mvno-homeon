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
import { Plus, Search, Edit, Trash2, Users } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export function Clientes() {
  const { isAdmin } = useAuth();
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
  const [clienteToDelete, setClienteToDelete] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    telefone: '',
    status: 'ativo'
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchClientes = useCallback(async () => {
    try {
      const params = search ? { search } : {};
      const response = await axios.get(`${API_URL}/api/clientes`, {
        params,
        withCredentials: true
      });
      setClientes(response.data);
    } catch (error) {
      toast.error('Erro ao carregar clientes');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  const handleOpenDialog = (cliente = null) => {
    if (cliente) {
      setEditingCliente(cliente);
      setFormData({
        nome: cliente.nome,
        cpf: cliente.cpf,
        telefone: cliente.telefone,
        status: cliente.status
      });
    } else {
      setEditingCliente(null);
      setFormData({ nome: '', cpf: '', telefone: '', status: 'ativo' });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (editingCliente) {
        await axios.put(
          `${API_URL}/api/clientes/${editingCliente.id}`,
          formData,
          { withCredentials: true }
        );
        toast.success('Cliente atualizado com sucesso');
      } else {
        await axios.post(`${API_URL}/api/clientes`, formData, {
          withCredentials: true
        });
        toast.success('Cliente cadastrado com sucesso');
      }
      setDialogOpen(false);
      fetchClientes();
    } catch (error) {
      const message = error.response?.data?.detail || 'Erro ao salvar cliente';
      toast.error(typeof message === 'string' ? message : 'Erro ao salvar cliente');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!clienteToDelete) return;

    try {
      await axios.delete(`${API_URL}/api/clientes/${clienteToDelete.id}`, {
        withCredentials: true
      });
      toast.success('Cliente removido com sucesso');
      setDeleteDialogOpen(false);
      setClienteToDelete(null);
      fetchClientes();
    } catch (error) {
      const message = error.response?.data?.detail || 'Erro ao remover cliente';
      toast.error(typeof message === 'string' ? message : 'Erro ao remover cliente');
    }
  };

  const formatCPF = (value) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
  };

  const formatPhone = (value) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return `(${numbers}`;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="clientes-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <Users className="w-7 h-7 text-blue-500" />
            Clientes
          </h1>
          <p className="text-zinc-400 text-sm -mt-4">Gerenciamento de clientes</p>
        </div>
        <Button
          onClick={() => handleOpenDialog()}
          className="btn-primary flex items-center gap-2"
          data-testid="add-cliente-button"
        >
          <Plus className="w-4 h-4" />
          Novo Cliente
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <Input
          type="text"
          placeholder="Buscar por nome, CPF ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="form-input pl-10"
          data-testid="search-clientes"
        />
      </div>

      {/* Table */}
      <div className="dashboard-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table" data-testid="clientes-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>CPF</th>
                <th>Telefone</th>
                <th>Status</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {clientes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-zinc-500 py-8">
                    Nenhum cliente encontrado
                  </td>
                </tr>
              ) : (
                clientes.map((cliente) => (
                  <tr key={cliente.id} data-testid={`cliente-row-${cliente.id}`}>
                    <td className="font-medium text-white">{cliente.nome}</td>
                    <td className="font-mono text-zinc-400">{cliente.cpf}</td>
                    <td className="font-mono text-zinc-400">{cliente.telefone}</td>
                    <td>
                      <span className={cliente.status === 'ativo' ? 'badge-active' : 'badge-inactive'}>
                        {cliente.status}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(cliente)}
                          className="text-zinc-400 hover:text-white"
                          data-testid={`edit-cliente-${cliente.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setClienteToDelete(cliente);
                              setDeleteDialogOpen(true);
                            }}
                            className="text-zinc-400 hover:text-red-400"
                            data-testid={`delete-cliente-${cliente.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingCliente ? 'Editar Cliente' : 'Novo Cliente'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome" className="text-zinc-300">Nome Completo</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="form-input"
                required
                data-testid="cliente-nome-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpf" className="text-zinc-300">CPF</Label>
              <Input
                id="cpf"
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: formatCPF(e.target.value) })}
                className="form-input font-mono"
                placeholder="000.000.000-00"
                maxLength={14}
                required
                data-testid="cliente-cpf-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone" className="text-zinc-300">Telefone</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: formatPhone(e.target.value) })}
                className="form-input font-mono"
                placeholder="(00) 00000-0000"
                maxLength={15}
                required
                data-testid="cliente-telefone-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status" className="text-zinc-300">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger className="form-input" data-testid="cliente-status-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
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
                data-testid="cliente-submit-button"
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
            Tem certeza que deseja remover o cliente{' '}
            <span className="text-white font-medium">{clienteToDelete?.nome}</span>?
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
              data-testid="confirm-delete-button"
            >
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
