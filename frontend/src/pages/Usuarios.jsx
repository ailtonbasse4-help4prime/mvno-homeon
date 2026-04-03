import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { safeArray } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { Plus, UserCog, Edit, Trash2, Shield, ShieldCheck } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'atendente' });
  const [submitting, setSubmitting] = useState(false);

  const fetchUsuarios = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/usuarios`, { withCredentials: true });
      setUsuarios(safeArray(response.data));
    } catch (error) {
      toast.error('Erro ao carregar usuarios');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsuarios(); }, [fetchUsuarios]);

  const handleOpenDialog = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({ name: user.name, email: user.email, password: '', role: user.role });
    } else {
      setEditingUser(null);
      setFormData({ name: '', email: '', password: '', role: 'atendente' });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingUser) {
        const payload = { name: formData.name, role: formData.role };
        if (formData.password) payload.password = formData.password;
        await axios.put(`${API_URL}/api/usuarios/${editingUser.id}`, payload, { withCredentials: true });
        toast.success('Usuario atualizado');
      } else {
        await axios.post(`${API_URL}/api/usuarios`, formData, { withCredentials: true });
        toast.success('Usuario criado');
      }
      setDialogOpen(false);
      fetchUsuarios();
    } catch (error) {
      const msg = error.response?.data?.detail || 'Erro ao salvar';
      toast.error(typeof msg === 'string' ? msg : 'Erro ao salvar');
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    try {
      await axios.delete(`${API_URL}/api/usuarios/${userToDelete.id}`, { withCredentials: true });
      toast.success('Usuario removido');
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      fetchUsuarios();
    } catch (error) {
      const msg = error.response?.data?.detail || 'Erro ao remover';
      toast.error(typeof msg === 'string' ? msg : 'Erro ao remover');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6" data-testid="usuarios-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-3"><UserCog className="w-7 h-7 text-violet-500" />Usuarios</h1>
          <p className="text-zinc-400 text-sm -mt-4">Gerenciamento de usuarios e perfis de acesso</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="btn-primary flex items-center gap-2 w-full sm:w-auto" data-testid="add-user-button">
          <Plus className="w-4 h-4" />Novo Usuario
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-sm p-4">
          <p className="text-2xl font-bold text-white font-mono">{usuarios.length}</p>
          <p className="text-xs text-zinc-500">Total</p>
        </div>
        <div className="bg-violet-500/5 border border-violet-500/20 rounded-sm p-4">
          <p className="text-2xl font-bold text-violet-400 font-mono">{usuarios.filter(u => u.role === 'admin').length}</p>
          <p className="text-xs text-zinc-500">Administradores</p>
        </div>
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-sm p-4">
          <p className="text-2xl font-bold text-blue-400 font-mono">{usuarios.filter(u => u.role === 'atendente').length}</p>
          <p className="text-xs text-zinc-500">Atendentes</p>
        </div>
      </div>

      {/* Table */}
      <div className="dashboard-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table" data-testid="usuarios-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Perfil</th>
                <th>Criado em</th>
                <th className="text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} data-testid={`user-row-${u.id}`}>
                  <td className="font-medium text-white">{u.name}</td>
                  <td className="text-zinc-400">{u.email}</td>
                  <td>
                    {u.role === 'admin' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20">
                        <ShieldCheck className="w-3 h-3" />Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <Shield className="w-3 h-3" />Atendente
                      </span>
                    )}
                  </td>
                  <td className="text-zinc-400 text-sm">{new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(u)} className="text-zinc-400 hover:text-white" data-testid={`edit-user-${u.id}`}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setUserToDelete(u); setDeleteDialogOpen(true); }} className="text-zinc-400 hover:text-red-400" data-testid={`delete-user-${u.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permissions Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="dashboard-card">
          <h3 className="text-sm font-semibold text-violet-400 mb-3 flex items-center gap-2"><ShieldCheck className="w-4 h-4" />Admin</h3>
          <ul className="text-sm text-zinc-400 space-y-1">
            <li>- Gerenciar usuarios</li>
            <li>- Sincronizar operadora</li>
            <li>- Ativar, bloquear, desbloquear linhas</li>
            <li>- Alterar plano</li>
            <li>- Gerenciar planos, ofertas e chips</li>
            <li>- Ver logs completos</li>
          </ul>
        </div>
        <div className="dashboard-card">
          <h3 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2"><Shield className="w-4 h-4" />Atendente</h3>
          <ul className="text-sm text-zinc-400 space-y-1">
            <li>- Cadastrar e editar clientes</li>
            <li>- Consultar chips e linhas</li>
            <li>- Ativar linha</li>
            <li>- Sem acesso a configuracoes</li>
            <li>- Sem gestao de usuarios</li>
            <li>- Sem acesso a logs</li>
          </ul>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">{editingUser ? 'Editar Usuario' : 'Novo Usuario'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">Nome</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="form-input" required data-testid="user-name-input" />
            </div>
            {!editingUser && (
              <div className="space-y-2">
                <Label className="text-zinc-300">Email</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="form-input" required data-testid="user-email-input" />
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-zinc-300">{editingUser ? 'Nova Senha (deixe vazio para manter)' : 'Senha'}</Label>
              <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="form-input" required={!editingUser} data-testid="user-password-input" />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">Perfil de Acesso</Label>
              <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                <SelectTrigger className="form-input" data-testid="user-role-select"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="atendente">Atendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="btn-secondary">Cancelar</Button>
              <Button type="submit" disabled={submitting} className="btn-primary" data-testid="user-submit-button">{submitting ? 'Salvando...' : 'Salvar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader><DialogTitle className="text-white">Confirmar Exclusao</DialogTitle></DialogHeader>
          <p className="text-zinc-400">Remover o usuario <span className="text-white font-medium">{userToDelete?.name}</span> ({userToDelete?.email})?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="btn-secondary">Cancelar</Button>
            <Button onClick={handleDelete} className="btn-danger" data-testid="confirm-delete-user">Remover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
