import { NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Package,
  Tag,
  Zap,
  Phone,
  FileText,
  LogOut,
  Signal,
  Wifi,
  WifiOff,
} from 'lucide-react';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/clientes', icon: Users, label: 'Clientes' },
  { path: '/planos', icon: Package, label: 'Planos' },
  { path: '/ofertas', icon: Tag, label: 'Ofertas' },
  { path: '/chips', icon: CreditCard, label: 'Chips' },
  { path: '/ativacoes', icon: Zap, label: 'Ativacoes' },
  { path: '/linhas', icon: Phone, label: 'Linhas' },
  { path: '/logs', icon: FileText, label: 'Logs' },
];

const API_URL = process.env.REACT_APP_BACKEND_URL;

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [operadoraMode, setOperadoraMode] = useState(null);

  useEffect(() => {
    axios.get(`${API_URL}/api/operadora/config`, { withCredentials: true })
      .then(r => setOperadoraMode(r.data.mode))
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className="sidebar" data-testid="sidebar">
      <div className="p-6 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-sm bg-blue-600 flex items-center justify-center">
            <Signal className="w-6 h-6 text-white" />
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

      <nav className="py-4">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
            data-testid={`nav-${item.label.toLowerCase()}`}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-zinc-800">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center">
            <span className="text-sm font-medium text-white">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-zinc-500 truncate">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="sidebar-link w-full justify-center text-red-400 hover:text-red-300 hover:bg-red-500/10"
          data-testid="logout-button"
        >
          <LogOut className="w-5 h-5" />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}
