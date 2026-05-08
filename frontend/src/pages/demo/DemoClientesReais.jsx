import { useState } from 'react';
import { Users, UserCheck, UserX, Search } from 'lucide-react';
import { StatCard } from '../../components/StatCard';
import { getDemoData } from '../../demo/fakeData';

export default function DemoClientesReais() {
  const data = getDemoData();
  const [q, setQ] = useState('');

  const total = data.clientes.length;
  const ativos = data.clientes.filter(c => c.ativo).length;
  const inativos = total - ativos;

  // linhas por cliente
  const linhasPorCliente = {};
  data.linhas.forEach(l => {
    linhasPorCliente[l.cliente_id] = (linhasPorCliente[l.cliente_id] || 0) + 1;
  });

  const filtered = data.clientes.filter(c => {
    if (!q) return true;
    const term = q.toLowerCase();
    return c.nome.toLowerCase().includes(term) ||
           c.cpf.includes(q) || c.email.toLowerCase().includes(term);
  }).slice(0, 80);

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="demo-clientes-page">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Clientes</h1>
        <p className="text-zinc-400 text-xs sm:text-sm mt-1">Base completa de clientes cadastrados no MVNO</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard icon={Users} label="Total de clientes" value={total} color="blue" testId="cli-total" />
        <StatCard icon={UserCheck} label="Ativos" value={ativos} color="emerald" testId="cli-ativos" />
        <StatCard icon={UserX} label="Inativos" value={inativos} color="red" testId="cli-inativos" />
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Buscar por nome, CPF ou e-mail..."
          value={q} onChange={e => setQ(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500 outline-none"
          data-testid="cli-search"
        />
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-950">
              <tr className="text-zinc-500 text-left text-xs">
                <th className="px-4 py-2.5 font-medium">Nome</th>
                <th className="px-4 py-2.5 font-medium">CPF</th>
                <th className="px-4 py-2.5 font-medium">Telefone</th>
                <th className="px-4 py-2.5 font-medium">E-mail</th>
                <th className="px-4 py-2.5 font-medium">Canal</th>
                <th className="px-4 py-2.5 font-medium text-right">Linhas</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t border-zinc-800 hover:bg-zinc-950/50 transition">
                  <td className="px-4 py-2.5 text-white text-xs font-medium">{c.nome}</td>
                  <td className="px-4 py-2.5 text-xs text-zinc-300 font-mono">{c.cpf}</td>
                  <td className="px-4 py-2.5 text-xs text-zinc-400 font-mono">{c.telefone}</td>
                  <td className="px-4 py-2.5 text-xs text-zinc-400">{c.email}</td>
                  <td className="px-4 py-2.5 text-xs">
                    <span className="inline-flex px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 text-[10px] font-semibold">
                      {c.canal}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs font-mono text-blue-400 font-bold">{linhasPorCliente[c.id] || 0}</td>
                  <td className="px-4 py-2.5 text-xs">
                    {c.ativo ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                        <UserCheck className="w-3 h-3" /> Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-bold">
                        <UserX className="w-3 h-3" /> Inativo
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-500">Nenhum cliente encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-3 text-xs text-zinc-500 border-t border-zinc-800 text-center">
          Mostrando {filtered.length} de {total} clientes
        </div>
      </div>
    </div>
  );
}
