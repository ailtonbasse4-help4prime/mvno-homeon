import { useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation, Outlet } from 'react-router-dom';
import axios from 'axios';
import {
  LayoutDashboard, FileSpreadsheet, Wallet, DollarSign, LogOut, Zap,
  MessageCircle, Users, CreditCard, Phone, Package, Tag, Store,
  Smartphone, Share2, Receipt, UserCog, FileText, Activity,
  ChevronDown, ChevronRight, Radio, Settings,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const DEMO_AUTH_KEY = 'demo_authed_v1';

const GROUPS = [
  {
    id: 'operacao', label: 'Operacao', icon: Activity,
    items: [
      { to: '/demo/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/demo/operacional', label: 'Planilha Operacional', icon: FileSpreadsheet },
      { to: '/demo/ativacoes', label: 'Ativacoes', icon: Zap, badge: 'DIFERENCIAL' },
    ],
  },
  {
    id: 'clientes', label: 'Clientes & Linhas', icon: Users,
    items: [
      { to: '/demo/clientes', label: 'Clientes', icon: Users },
      { to: '/demo/chips', label: 'Chips', icon: CreditCard },
      { to: '/demo/linhas', label: 'Linhas', icon: Phone, badge: 'DIFERENCIAL' },
    ],
  },
  {
    id: 'financeiro', label: 'Financeiro', icon: DollarSign,
    items: [
      { to: '/demo/cobrancas', label: 'Cobrancas', icon: Wallet },
      { to: '/demo/carteira', label: 'Carteira Movel', icon: Receipt },
      { to: '/demo/assinaturas', label: 'Assinaturas', icon: CreditCard },
      { to: '/demo/custos', label: 'Custos & Lucro', icon: DollarSign },
    ],
  },
  {
    id: 'cadastros', label: 'Cadastros', icon: Package,
    items: [
      { to: '/demo/planos', label: 'Planos', icon: Package },
      { to: '/demo/ofertas', label: 'Ofertas', icon: Tag },
    ],
  },
  {
    id: 'rede', label: 'Rede', icon: Radio,
    items: [
      { to: '/demo/revendedores', label: 'Revendedores', icon: Store },
      { to: '/demo/self-service', label: 'Self-Service', icon: Smartphone, badge: 'DIFERENCIAL' },
      { to: '/demo/divulgacao', label: 'Divulgacao', icon: Share2 },
    ],
  },
  {
    id: 'sistema', label: 'Sistema', icon: Settings,
    items: [
      { to: '/demo/usuarios', label: 'Usuarios', icon: UserCog },
      { to: '/demo/logs', label: 'Logs & Auditoria', icon: FileText },
    ],
  },
];

export default function DemoLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const [openGroups, setOpenGroups] = useState(() => GROUPS.map(g => g.id));

  useEffect(() => {
    if (sessionStorage.getItem(DEMO_AUTH_KEY) !== 'yes') {
      nav('/demo', { replace: true }); return;
    }
    axios.post(`${API_URL}/api/demo/access`, { path: loc.pathname }).catch(() => {});
  }, [loc.pathname, nav]);

  const toggleGroup = (id) => {
    setOpenGroups(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
  };

  const logout = () => {
    sessionStorage.removeItem(DEMO_AUTH_KEY);
    nav('/demo');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col max-h-screen sticky top-0">
        <div className="p-5 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center font-bold text-white text-lg">H</div>
            <div>
              <div className="font-bold text-white">HELP4PRIME</div>
              <div className="text-[10px] text-emerald-400 font-semibold tracking-wider">MVNO · DEMO</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {GROUPS.map(group => {
            const GroupIcon = group.icon;
            const open = openGroups.includes(group.id);
            return (
              <div key={group.id}>
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition"
                >
                  <span className="flex items-center gap-2">
                    <GroupIcon className="w-3.5 h-3.5" /> {group.label}
                  </span>
                  {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
                {open && (
                  <div className="space-y-0.5 mb-1">
                    {group.items.map(item => {
                      const Icon = item.icon;
                      return (
                        <NavLink key={item.to} to={item.to} end
                          className={({isActive}) => `flex items-center justify-between gap-2 pl-6 pr-2.5 py-2 rounded-md text-[13px] transition ${isActive ? 'bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                          data-testid={`demo-nav-${item.to.split('/').pop()}`}
                        >
                          <span className="flex items-center gap-2 truncate">
                            <Icon className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{item.label}</span>
                          </span>
                          {item.badge && (
                            <span className="shrink-0 text-[8px] font-bold px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              {item.badge}
                            </span>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-zinc-800 space-y-2 shrink-0 bg-zinc-900">
          <a href="https://wa.me/5511915322526?text=Ol%C3%A1!%20Vi%20a%20demo%20do%20HELP4PRIME%20MVNO%20e%20tenho%20interesse%20em%20avan%C3%A7ar%20para%20pre-contrato"
             target="_blank" rel="noopener noreferrer"
             className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white transition text-sm font-semibold shadow-lg shadow-emerald-500/20"
             data-testid="demo-whats-btn">
            <MessageCircle className="w-4 h-4" /> Quero contratar
          </a>
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-white transition text-xs" data-testid="demo-logout-btn">
            <LogOut className="w-3.5 h-3.5" /> Sair da demo
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {/* Barra demo */}
        <div className="sticky top-0 z-20 bg-gradient-to-r from-emerald-600/95 to-emerald-500/95 backdrop-blur text-white text-xs text-center py-1.5 font-semibold flex items-center justify-center gap-2">
          <Zap className="w-3 h-3" /> MODO DEMONSTRACAO · Dados ficticios para apresentacao · Valores da tabela Ta Telecom
        </div>
        <div className="p-6 space-y-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
