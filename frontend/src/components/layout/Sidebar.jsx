import { NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../ui/dialog';
import { toast } from 'sonner';
import {
  LayoutDashboard, Users, CreditCard, Package, Tag, Zap,
  Phone, FileText, LogOut, Wifi, WifiOff, UserCog, KeyRound,
  Wallet, RefreshCw,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const allNavItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'atendente'] },
  { path: '/clientes', icon: Users, label: 'Clientes', roles: ['admin', 'atendente'] },
  { path: '/planos', icon: Package, label: 'Planos', roles: ['admin', 'atendente'] },
  { path: '/ofertas', icon: Tag, label: 'Ofertas', roles: ['admin', 'atendente'] },
  { path: '/chips', icon: CreditCard, label: 'Chips', roles: ['admin', 'atendente'] },
  { path: '/ativacoes', icon: Zap, label: 'Ativacoes', roles: ['admin', 'atendente'] },
  { path: '/linhas', icon: Phone, label: 'Linhas', roles: ['admin', 'atendente'] },
  { path: '/carteira', icon: Wallet, label: 'Carteira Movel', roles: ['admin'] },
  { path: '/assinaturas', icon: RefreshCw, label: 'Assinaturas', roles: ['admin'] },
  { path: '/usuarios', icon: UserCog, label: 'Usuarios', roles: ['admin'] },
  { path: '/logs', icon: FileText, label: 'Logs', roles: ['admin'] },
];

export function Sidebar() {
  const { user, logout, changePassword, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [operadoraMode, setOperadoraMode] = useState(null);
  const [pwdDialogOpen, setPwdDialogOpen] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current: '', new_pwd: '', confirm: '' });
  const [pwdSubmitting, setPwdSubmitting] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      axios.get(`${API_URL}/api/operadora/config`, { withCredentials: true })
        .then(r => setOperadoraMode(r.data.mode))
        .catch(() => {});
    }
  }, [isAdmin]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (pwdForm.new_pwd !== pwdForm.confirm) {
      toast.error('As senhas nao coincidem');
      return;
    }
    setPwdSubmitting(true);
    const result = await changePassword(pwdForm.current, pwdForm.new_pwd);
    if (result.success) {
      toast.success('Senha alterada com sucesso');
      setPwdDialogOpen(false);
      setPwdForm({ current: '', new_pwd: '', confirm: '' });
    } else {
      toast.error(result.error);
    }
    setPwdSubmitting(false);
  };

  const userRole = user?.role || 'atendente';
  const navItems = allNavItems.filter(item => item.roles.includes(userRole));

  return (
    <aside className="sidebar" data-testid="sidebar">
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-sm bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-lg">M</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">MVNO</h1>
            <p className="text-xs text-zinc-500">Ta Telecom</p>
          </div>
        </div>
        {operadoraMode && (
          <div
            className={`mt-3 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-sm text-xs font-semibold ${
              operadoraMode === 'real'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
            }`}
            data-testid="sidebar-mode-badge"
          >
            {operadoraMode === 'real' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {operadoraMode === 'real' ? 'API REAL' : 'MOCK'}
          </div>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
            }
            data-testid={`nav-${item.label.toLowerCase()}`}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-zinc-800">
        <div className="mb-3">
          <p className="text-sm font-medium text-white truncate">{user?.name}</p>
          <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
          <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-sm ${
            userRole === 'admin'
              ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
          }`}>
            {userRole === 'admin' ? 'Admin' : 'Atendente'}
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setPwdDialogOpen(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-sm transition-colors"
            data-testid="change-password-button"
          >
            <KeyRound className="w-3.5 h-3.5" />Senha
          </button>
          <button
            onClick={handleLogout}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-zinc-400 hover:text-red-400 hover:bg-zinc-800/50 rounded-sm transition-colors"
            data-testid="logout-button"
          >
            <LogOut className="w-3.5 h-3.5" />Sair
          </button>
        </div>
      </div>

      {/* Password Change Dialog */}
      <Dialog open={pwdDialogOpen} onOpenChange={setPwdDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader><DialogTitle className="text-white">Alterar Senha</DialogTitle></DialogHeader>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">Senha Atual</Label>
              <Input type="password" value={pwdForm.current} onChange={(e) => setPwdForm({ ...pwdForm, current: e.target.value })} className="form-input" required data-testid="current-password-input" />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">Nova Senha</Label>
              <Input type="password" value={pwdForm.new_pwd} onChange={(e) => setPwdForm({ ...pwdForm, new_pwd: e.target.value })} className="form-input" required data-testid="new-password-input" />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">Confirmar Nova Senha</Label>
              <Input type="password" value={pwdForm.confirm} onChange={(e) => setPwdForm({ ...pwdForm, confirm: e.target.value })} className="form-input" required data-testid="confirm-password-input" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPwdDialogOpen(false)} className="btn-secondary">Cancelar</Button>
              <Button type="submit" disabled={pwdSubmitting} className="btn-primary" data-testid="submit-password-change">{pwdSubmitting ? 'Alterando...' : 'Alterar Senha'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
