import { useState, useMemo } from 'react';
import { StatCard } from '../../components/StatCard';
import { getDemoData, brl } from '../../demo/fakeData';
import { DollarSign, Clock, AlertCircle, FileText, Search } from 'lucide-react';

const statusBadge = {
  RECEIVED: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
  PENDING: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
  OVERDUE: 'bg-red-500/15 text-red-400 border-red-500/40',
};
const statusLabel = { RECEIVED: 'Recebido', PENDING: 'Pendente', OVERDUE: 'Vencido' };
const formatDateBR = (iso) => {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

export default function DemoCobrancas() {
  const data = useMemo(() => getDemoData(), []);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');

  const cobsFiltradas = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return data.cobrancas.filter(c => {
      if (filtro !== 'todos' && c.status !== filtro) return false;
      if (q && !c.cliente_nome.toLowerCase().includes(q)) return false;
      return true;
    }).slice(0, 100);
  }, [data.cobrancas, busca, filtro]);

  const { resumoCobrancas } = data;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Gestão de Cobranças</h1>
        <p className="text-zinc-400 text-xs sm:text-sm mt-1">Cobranças integradas com Asaas — boleto, PIX e cartão recorrente</p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={DollarSign} label="Receita" value={brl(resumoCobrancas.financeiro.receita_total)} color="emerald" />
        <StatCard icon={Clock} label="Pendente" value={brl(resumoCobrancas.financeiro.pendente_total)} color="amber" sub={`${resumoCobrancas.cobrancas.pendentes} cobranças`} />
        <StatCard icon={AlertCircle} label="Vencido" value={brl(resumoCobrancas.financeiro.vencido_total)} color="red" sub={`${resumoCobrancas.cobrancas.vencidas} cobranças`} />
        <StatCard icon={FileText} label={`${resumoCobrancas.cobrancas.total} cobranças`} value={`${resumoCobrancas.cobrancas.pagas} pagas`} color="blue" sub={`${resumoCobrancas.cobrancas.pendentes} pendentes`} />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por cliente..."
            className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:border-emerald-500 focus:outline-none" />
        </div>
        <select value={filtro} onChange={e => setFiltro(e.target.value)}
          className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:border-emerald-500 focus:outline-none">
          <option value="todos">Todos</option>
          <option value="RECEIVED">Recebidas</option>
          <option value="PENDING">Pendentes</option>
          <option value="OVERDUE">Vencidas</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-950 sticky top-0">
              <tr className="text-zinc-400 text-left">
                <th className="px-3 py-3 font-bold uppercase text-xs">Cliente</th>
                <th className="px-3 py-3 font-bold uppercase text-xs">Plano</th>
                <th className="px-3 py-3 font-bold uppercase text-xs">Tipo</th>
                <th className="px-3 py-3 font-bold uppercase text-xs text-right">Valor</th>
                <th className="px-3 py-3 font-bold uppercase text-xs">Vencimento</th>
                <th className="px-3 py-3 font-bold uppercase text-xs">Status</th>
                <th className="px-3 py-3 font-bold uppercase text-xs">ID Asaas</th>
              </tr>            </thead>
            <tbody>
              {cobsFiltradas.map((c, idx) => (
                <tr key={c.id} className={`border-t border-zinc-800 hover:bg-zinc-800/50 ${idx % 2 === 0 ? 'bg-zinc-900' : 'bg-zinc-900/50'}`}>
                  <td className="px-3 py-2.5 font-medium text-white">{c.cliente_nome}</td>
                  <td className="px-3 py-2.5 text-zinc-400 text-xs">{c.oferta_nome}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold border border-zinc-700 bg-zinc-800 text-zinc-300">{c.billing_type}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-white">{brl(c.valor)}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-zinc-300">{formatDateBR(c.vencimento)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border ${statusBadge[c.status]}`}>{statusLabel[c.status]}</span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[10px] text-zinc-500">{c.asaas_payment_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-zinc-950 px-4 py-2 text-xs text-zinc-500 border-t border-zinc-800">
          Exibindo {cobsFiltradas.length} de {data.cobrancas.length} cobranças
        </div>
      </div>
    </div>
  );
}
