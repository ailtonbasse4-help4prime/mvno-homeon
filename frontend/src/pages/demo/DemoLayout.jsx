import { useEffect } from 'react';
import { NavLink, useNavigate, useLocation, Outlet } from 'react-router-dom';
import axios from 'axios';
import { LayoutDashboard, FileSpreadsheet, Wallet, DollarSign, LogOut, Zap, MessageCircle } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const DEMO_AUTH_KEY = 'demo_authed_v1';

const NAV = [
  { to: '/demo/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/demo/operacional', label: 'Planilha Operacional', icon: FileSpreadsheet },
  { to: '/demo/cobrancas', label: 'Cobrancas', icon: Wallet },
  { to: '/demo/custos', label: 'Custos & Lucro', icon: DollarSign },
];

export default function DemoLayout() {
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (sessionStorage.getItem(DEMO_AUTH_KEY) !== 'yes') {
      nav('/demo', { replace: true }); return;
    }
    axios.post(`${API_URL}/api/demo/access`, { path: loc.pathname }).catch(() => {});
  }, [loc.pathname, nav]);

  const logout = () => {
    sessionStorage.removeItem(DEMO_AUTH_KEY);
    nav('/demo');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col">
        <div className="p-5 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center font-bold text-white text-lg">H</div>
            <div>
              <div className="font-bold text-white">HELP4PRIME</div>
              <div className="text-[10px] text-emerald-400 font-semibold tracking-wider">MVNO · DEMO</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(item => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} end
                className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                data-testid={`demo-nav-${item.label.toLowerCase().replace(/\s/g,'-').replace(/\./g,'').replace(/&/g,'')}`}
              >
                <Icon className="w-4 h-4" /> {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-zinc-800 space-y-2">
          <a href="https://wa.me/5583999999999?text=Ol%C3%A1!%20Vi%20a%20demo%20do%20HELP4PRIME%20MVNO%20e%20gostaria%20de%20saber%20mais"
             target="_blank" rel="noopener noreferrer"
             className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition text-sm font-medium"
             data-testid="demo-whats-btn">
            <MessageCircle className="w-4 h-4" /> Quero contratar
          </a>
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-white transition text-sm" data-testid="demo-logout-btn">
            <LogOut className="w-4 h-4" /> Sair da demo
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {/* Barra demo */}
        <div className="sticky top-0 z-20 bg-gradient-to-r from-emerald-600/90 to-emerald-500/90 backdrop-blur text-white text-xs text-center py-1.5 font-semibold flex items-center justify-center gap-2">
          <Zap className="w-3 h-3" /> MODO DEMONSTRACAO · Dados ficticios para apresentacao · Valores da tabela Ta Telecom
        </div>
        <div className="p-6 space-y-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
