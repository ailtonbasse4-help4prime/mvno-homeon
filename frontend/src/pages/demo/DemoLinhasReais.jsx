import { useState } from 'react';
import { Signal, CheckCircle, AlertCircle, Ban, Search } from 'lucide-react';
import { StatCard } from '../../components/StatCard';
import { getDemoData, brl } from '../../demo/fakeData';

const STATUS_INFO = {
  ativo:      { label: 'Ativo',       color: 'emerald', Icon: CheckCircle },
  bloqueado:  { label: 'Bloqueado',   color: 'red',     Icon: Ban },
  pendente:   { label: 'Pendente',    color: 'amber',   Icon: AlertCircle },
  cancelado:  { label: 'Cancelado',   color: 'zinc',    Icon: Ban },
};

export default function DemoLinhasReais() {
  const data = getDemoData();
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const total = data.linhas.length;
  const ativas = data.linhas.filter(l => l.status_linha === 'ativo').length;
  const suspensas = data.linhas.filter(l => l.status_linha === 'bloqueado').length;
  const receita = data.linhas.filter(l => l.status_linha === 'ativo').reduce((s, l) => s + l.valor_liquido, 0);

  const filtered = data.linhas.filter(l => {
    if (statusFilter !== 'all' && l.status_linha !== statusFilter) return false;
    if (!q) return true;
    const term = q.toLowerCase();
    return l.cliente_nome.toLowerCase().includes(term) ||
           l.numero.includes(q) || l.iccid.includes(q);
  }).slice(0, 100);

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="demo-linhas-page">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Linhas</h1>
        <p className="text-zinc-400 text-xs sm:text-sm mt-1">Gestão completa das linhas ativas no MVNO</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Signal} label="Total de linhas" value={total} color="blue" testId="linhas-total" />
        <StatCard icon={CheckCircle} label="Ativas" value={ativas} color="emerald" testId="linhas-ativas" />
        <StatCard icon={Ban} label="Suspensas" value={suspensas} color="red" testId="linhas-suspensas" />
        <StatCard icon={Signal} label="Receita ativa" value={brl(receita)} color="violet" testId="linhas-receita" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome, número ou ICCID..."
            value={q} onChange={e => setQ(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500 outline-none"
            data-testid="linhas-search"
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:border-emerald-500 outline-none"
          data-testid="linhas-status-filter">
          <option value="all">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="bloqueado">Bloqueado</option>
          <option value="pendente">Pendente</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-950">
              <tr className="text-zinc-500 text-left text-xs">
                <th className="px-4 py-2.5 font-medium">Cliente</th>
                <th className="px-4 py-2.5 font-medium">Número</th>
                <th className="px-4 py-2.5 font-medium">Plano</th>
                <th className="px-4 py-2.5 font-medium">Próx. recarga</th>
                <th className="px-4 py-2.5 font-medium text-right">Valor</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l, i) => {
                const info = STATUS_INFO[l.status_linha] || STATUS_INFO.ativo;
                return (
                  <tr key={i} className="border-t border-zinc-800 hover:bg-zinc-950/50 transition">
                    <td className="px-4 py-2.5 text-white text-xs">{l.cliente_nome}{l.complemento && <span className="text-zinc-500 text-[10px] ml-1">({l.complemento})</span>}</td>
                    <td className="px-4 py-2.5 text-xs text-zinc-300 font-mono">{l.numero}</td>
                    <td className="px-4 py-2.5 text-xs">
                      <span className="inline-flex px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-bold">
                        {l.franquia}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-zinc-400 font-mono">{l.expirar_dados}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-mono text-white">{brl(l.valor_liquido)}</td>
                    <td className="px-4 py-2.5 text-xs">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-${info.color}-500/10 border border-${info.color}-500/30 text-${info.color}-400 text-[10px] font-bold`}>
                        <info.Icon className="w-3 h-3" /> {info.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">Nenhuma linha encontrada</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-3 text-xs text-zinc-500 border-t border-zinc-800 text-center">
          Mostrando {filtered.length} de {total} linhas
        </div>
      </div>
    </div>
  );
}
