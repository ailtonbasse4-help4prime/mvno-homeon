import { useState, useEffect } from 'react';
import axios from 'axios';
import { StatCard } from '../components/StatCard';
import { Eye, Users, Calendar, TrendingUp, ExternalLink, MessageCircle, UserPlus, ShoppingBag, MousePointerClick } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function DemoAcessos() {
  const [stats, setStats] = useState(null);
  const [homeon, setHomeon] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [r1, r2] = await Promise.all([
        axios.get(`${API_URL}/api/demo-admin/stats`, { withCredentials: true }),
        axios.get(`${API_URL}/api/homeon-admin/stats`, { withCredentials: true }),
      ]);
      setStats(r1.data);
      setHomeon(r2.data);
    } catch (e) {
      toast.error('Erro ao carregar estatisticas');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="text-zinc-400">Carregando...</div>;
  if (!stats) return <div className="text-red-400">Erro ao carregar dados.</div>;

  const demoUrl = `${window.location.origin}/demo`;
  const homeonUrl = `${window.location.origin}/homeon`;

  const PLANO_LABEL = {
    start: 'START (10GB)', plus: 'PLUS (15GB)', smart: 'SMART (20GB)',
    power: 'POWER (30GB)', ultra: 'ULTRA (40GB)', max: 'MAX (50GB)', hero: 'Hero (destaque)',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Acessos a Demo</h1>
          <p className="text-zinc-300 text-sm -mt-4">Estatisticas da pagina publica de demonstracao</p>
        </div>
        <div className="flex items-center gap-2">
          <a href={homeonUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 bg-orange-500/10 border border-orange-500/40 rounded-lg text-orange-400 text-sm hover:bg-orange-500/20 transition"
            data-testid="open-homeon-btn">
            <ExternalLink className="w-4 h-4" /> Abrir HomeOn
          </a>
          <a href={demoUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/40 rounded-lg text-emerald-400 text-sm hover:bg-emerald-500/20 transition"
            data-testid="open-demo-btn">
            <ExternalLink className="w-4 h-4" /> Abrir Demo
          </a>
          <button onClick={load} className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:bg-zinc-700">Atualizar</button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <StatCard icon={Eye} label="Total de acessos" value={stats.total} color="blue" testId="stat-total" />
        <StatCard icon={Users} label="Visitantes únicos" value={stats.unique_visitors} color="emerald" testId="stat-unique" />
        <StatCard icon={UserPlus} label="Leads capturados" value={stats.total_leads || 0} color="emerald" testId="stat-leads" />
        <StatCard icon={TrendingUp} label="Últimas 24h" value={stats.last_24h} color="amber" testId="stat-24h" />
        <StatCard icon={Calendar} label="Últimos 7 dias" value={stats.last_7d} color="violet" testId="stat-7d" />
        <StatCard icon={Calendar} label="Últimos 30 dias" value={stats.last_30d} color="orange" testId="stat-30d" />
      </div>

      {/* Link pra compartilhar */}
      <div className="bg-gradient-to-br from-emerald-950/30 to-zinc-950 border border-emerald-900/40 rounded-lg p-5">
        <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold mb-2">
          <ExternalLink className="w-4 h-4" /> Link da demo para compartilhar
        </div>
        <div className="flex items-center gap-2">
          <input readOnly value={demoUrl}
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white font-mono"
            onClick={e => e.target.select()} data-testid="demo-link-input" />
          <button onClick={() => { navigator.clipboard.writeText(demoUrl); toast.success('Link copiado!'); }}
            className="px-4 py-2 bg-emerald-500 text-white rounded-md text-sm font-medium hover:bg-emerald-400 transition" data-testid="copy-demo-link">
            Copiar
          </button>
        </div>
        <p className="text-xs text-zinc-500 mt-2">Acesso livre, sem senha — o modal de captura de lead é disparado nas páginas com "Diferencial Exclusivo".</p>
      </div>

      {/* Leads capturados */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden" data-testid="leads-table-card">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-emerald-400" /> Leads capturados
          </h3>
          <span className="text-xs text-zinc-500">{stats.total_leads || 0} no total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-950">
              <tr className="text-zinc-500 text-left text-xs">
                <th className="px-4 py-2 font-medium">Quando</th>
                <th className="px-4 py-2 font-medium">Nome</th>
                <th className="px-4 py-2 font-medium">WhatsApp</th>
                <th className="px-4 py-2 font-medium">Interesse</th>
                <th className="px-4 py-2 font-medium">Ação</th>
              </tr>
            </thead>
            <tbody>
              {(!stats.leads || stats.leads.length === 0) ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-zinc-500" data-testid="no-leads">Nenhum lead capturado ainda</td></tr>
              ) : stats.leads.map((l, i) => {
                const wppDigits = (l.whatsapp || '').replace(/\D/g, '');
                const wppFmt = wppDigits.length === 11
                  ? `(${wppDigits.slice(0,2)}) ${wppDigits.slice(2,7)}-${wppDigits.slice(7)}`
                  : wppDigits.length === 10
                  ? `(${wppDigits.slice(0,2)}) ${wppDigits.slice(2,6)}-${wppDigits.slice(6)}`
                  : wppDigits;
                const waLink = `https://wa.me/55${wppDigits}?text=${encodeURIComponent(`Olá ${l.nome}! Vi que você se interessou pela demonstração do HELP4PRIME MVNO. Podemos conversar?`)}`;
                return (
                  <tr key={i} className="border-t border-zinc-800 hover:bg-zinc-950/50 transition" data-testid={`lead-row-${i}`}>
                    <td className="px-4 py-2.5 text-xs text-zinc-300 font-mono whitespace-nowrap">{new Date(l.timestamp).toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-2.5 text-sm text-white font-medium">{l.nome}</td>
                    <td className="px-4 py-2.5 text-sm text-zinc-300 font-mono">{wppFmt}</td>
                    <td className="px-4 py-2.5 text-xs">
                      {l.interesse ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold">
                          {l.interesse}
                        </span>
                      ) : <span className="text-zinc-600">-</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <a href={waLink} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-xs font-semibold"
                        data-testid={`lead-wa-${i}`}>
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top paginas */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-zinc-800">
            <h3 className="text-sm font-semibold text-white">Paginas mais vistas</h3>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {stats.top_pages.length === 0 ? (
                <tr><td className="px-4 py-6 text-center text-zinc-500">Nenhum acesso ainda</td></tr>
              ) : stats.top_pages.map((p, i) => (
                <tr key={i} className="border-t border-zinc-800">
                  <td className="px-4 py-2.5 font-mono text-xs text-zinc-300">{p.path}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-emerald-400 font-bold">{p.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Acessos por dia */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-zinc-800">
            <h3 className="text-sm font-semibold text-white">Acessos por dia (ultimos 14)</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-zinc-950">
              <tr className="text-zinc-500 text-left text-xs">
                <th className="px-4 py-2 font-medium">Data</th>
                <th className="px-4 py-2 font-medium text-right">Acessos</th>
                <th className="px-4 py-2 font-medium text-right">Unicos</th>
              </tr>
            </thead>
            <tbody>
              {stats.by_day.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-zinc-500">Nenhum acesso ainda</td></tr>
              ) : stats.by_day.slice().reverse().map((d, i) => (
                <tr key={i} className="border-t border-zinc-800">
                  <td className="px-4 py-2.5 text-xs text-zinc-300">{d.date}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-emerald-400">{d.count}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-blue-400">{d.unique}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ultimos acessos */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-white">Ultimos 20 acessos</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-950">
              <tr className="text-zinc-500 text-left text-xs">
                <th className="px-4 py-2 font-medium">Quando</th>
                <th className="px-4 py-2 font-medium">IP</th>
                <th className="px-4 py-2 font-medium">Pagina</th>
                <th className="px-4 py-2 font-medium">Navegador</th>
              </tr>
            </thead>
            <tbody>
              {stats.ultimos.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-zinc-500">Nenhum acesso ainda</td></tr>
              ) : stats.ultimos.map((u, i) => (
                <tr key={i} className="border-t border-zinc-800">
                  <td className="px-4 py-2 text-xs text-zinc-300 font-mono">{new Date(u.timestamp).toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-2 text-xs text-zinc-400 font-mono">{u.ip}</td>
                  <td className="px-4 py-2 text-xs text-zinc-400 font-mono">{u.path || '-'}</td>
                  <td className="px-4 py-2 text-[10px] text-zinc-500 truncate max-w-xs">{u.user_agent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============ HOMEON PORTFOLIO ============ */}
      {homeon && (
        <div className="mt-8 pt-6 border-t border-zinc-800 space-y-4" data-testid="homeon-section">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-orange-500/15 border border-orange-500/40 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 text-orange-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Portfolio HomeOn — Cliques pra Shopee</h2>
                <p className="text-xs text-zinc-500">Cada clique em "Assinar pela Shopee" e registrado por plano.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatCard icon={MousePointerClick} label="Total de cliques" value={homeon.total} color="orange" testId="homeon-stat-total" />
            <StatCard icon={Users} label="Visitantes unicos" value={homeon.unique_visitors} color="blue" testId="homeon-stat-unique" />
            <StatCard icon={TrendingUp} label="Ultimas 24h" value={homeon.last_24h} color="amber" testId="homeon-stat-24h" />
            <StatCard icon={Calendar} label="Ultimos 7 dias" value={homeon.last_7d} color="violet" testId="homeon-stat-7d" />
            <StatCard icon={Calendar} label="Ultimos 30 dias" value={homeon.last_30d} color="emerald" testId="homeon-stat-30d" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Ranking por plano */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-zinc-800">
                <h3 className="text-sm font-semibold text-white">Cliques por plano</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-zinc-950">
                  <tr className="text-zinc-500 text-left text-xs">
                    <th className="px-4 py-2 font-medium">Plano</th>
                    <th className="px-4 py-2 font-medium text-right">Cliques</th>
                    <th className="px-4 py-2 font-medium text-right">Unicos</th>
                    <th className="px-4 py-2 font-medium text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {homeon.por_plano.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-zinc-500" data-testid="homeon-no-clicks">Nenhum clique ainda</td></tr>
                  ) : homeon.por_plano.map((p, i) => {
                    const pct = homeon.total > 0 ? ((p.count / homeon.total) * 100).toFixed(1) : '0';
                    return (
                      <tr key={i} className="border-t border-zinc-800" data-testid={`homeon-plano-${p.plano}`}>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-[11px] font-bold">
                            {PLANO_LABEL[p.plano] || p.plano}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-orange-400 font-bold">{p.count}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-blue-400">{p.unique}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-zinc-400 text-xs">{pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Cliques por dia */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-zinc-800">
                <h3 className="text-sm font-semibold text-white">Cliques por dia (ultimos 14)</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-zinc-950">
                  <tr className="text-zinc-500 text-left text-xs">
                    <th className="px-4 py-2 font-medium">Data</th>
                    <th className="px-4 py-2 font-medium text-right">Cliques</th>
                  </tr>
                </thead>
                <tbody>
                  {homeon.by_day.length === 0 ? (
                    <tr><td colSpan={2} className="px-4 py-6 text-center text-zinc-500">Nenhum clique ainda</td></tr>
                  ) : homeon.by_day.slice().reverse().map((d, i) => (
                    <tr key={i} className="border-t border-zinc-800">
                      <td className="px-4 py-2.5 text-xs text-zinc-300">{d.date}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-orange-400">{d.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Ultimos cliques */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-white">Ultimos 30 cliques</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-950">
                  <tr className="text-zinc-500 text-left text-xs">
                    <th className="px-4 py-2 font-medium">Quando</th>
                    <th className="px-4 py-2 font-medium">Plano</th>
                    <th className="px-4 py-2 font-medium">Origem</th>
                    <th className="px-4 py-2 font-medium">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {homeon.ultimos.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-zinc-500">Nenhum clique ainda</td></tr>
                  ) : homeon.ultimos.map((u, i) => (
                    <tr key={i} className="border-t border-zinc-800">
                      <td className="px-4 py-2 text-xs text-zinc-300 font-mono whitespace-nowrap">{new Date(u.timestamp).toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-2 text-xs">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-[10px] font-semibold">
                          {PLANO_LABEL[u.plano] || u.plano}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-zinc-400">{u.source || '-'}</td>
                      <td className="px-4 py-2 text-xs text-zinc-500 font-mono">{u.ip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
