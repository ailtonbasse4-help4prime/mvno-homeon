import { useState, useMemo } from 'react';
import { StatCard } from '../../components/StatCard';
import { getDemoData, brl } from '../../demo/fakeData';
import { DollarSign, Wallet, TrendingUp, Percent, Search, CheckCircle, XCircle, Clock } from 'lucide-react';

const statusColors = {
  ativo: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
  bloqueado: 'bg-red-500/15 text-red-400 border-red-500/40',
  pendente: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
  cancelado: 'bg-zinc-700 text-zinc-400 border-zinc-600',
};

const formatDateBR = (iso) => {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

export default function DemoPlanilha() {
  const data = useMemo(() => getDemoData(), []);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');

  const linhasFiltradas = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return data.linhas.filter(l => {
      if (filtroStatus !== 'todos' && l.status_linha !== filtroStatus) return false;
      if (q && !l.cliente_nome.toLowerCase().includes(q) && !l.numero.includes(q) && !l.plano_nome.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data.linhas, busca, filtroStatus]);

  const resumoFiltrado = useMemo(() => {
    const receita = linhasFiltradas.filter(l => l.incluir_lucro).reduce((s,l) => s + l.valor_liquido, 0);
    const custo = linhasFiltradas.filter(l => l.incluir_custo).reduce((s,l) => s + l.custo, 0);
    const custoTotal = custo + data.resumo.custo_fixo;
    const lucro = receita - custo;
    const margem = receita > 0 ? (lucro/receita)*100 : 0;
    return { receita, custo, custoTotal, lucro, margem, custoFixo: data.resumo.custo_fixo };
  }, [linhasFiltradas, data.resumo.custo_fixo]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Planilha Operacional</h1>
        <p className="text-zinc-400 text-sm mt-1">Visão tipo Excel — edição inline por célula, checkbox para incluir/excluir do cálculo</p>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard icon={DollarSign} label="Receita" value={brl(resumoFiltrado.receita)} color="emerald" />
        <StatCard icon={Wallet} label="Custos" value={brl(resumoFiltrado.custo)} color="red" sub="Planilha (variável)" />
        <StatCard icon={Wallet} label="Custo Total" value={brl(resumoFiltrado.custoTotal)} color="orange" sub={`+ ${brl(resumoFiltrado.custoFixo)} fixos`} />
        <StatCard icon={TrendingUp} label="Lucro Bruto" value={brl(resumoFiltrado.lucro)} color="blue" />
        <StatCard icon={Percent} label="Margem" value={`${resumoFiltrado.margem.toFixed(1)}%`} color="violet" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome, número ou plano..."
            className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:border-emerald-500 focus:outline-none" />
        </div>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
          className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:border-emerald-500 focus:outline-none">
          <option value="todos">Todos os status</option>
          <option value="ativo">Ativas</option>
          <option value="bloqueado">Bloqueadas</option>
          <option value="pendente">Pendentes</option>
          <option value="cancelado">Canceladas</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-950 sticky top-0 z-10">
              <tr className="text-zinc-400 text-left">
                <th className="px-3 py-3 font-bold uppercase text-xs">Cliente</th>
                <th className="px-3 py-3 font-bold uppercase text-xs">Número</th>
                <th className="px-3 py-3 font-bold uppercase text-xs">Plano</th>
                <th className="px-3 py-3 font-bold uppercase text-xs">Canal</th>
                <th className="px-3 py-3 font-bold uppercase text-xs">Status</th>
                <th className="px-3 py-3 font-bold uppercase text-xs">Recarga Tá</th>
                <th className="px-3 py-3 font-bold uppercase text-xs text-right">Valor</th>
                <th className="px-3 py-3 font-bold uppercase text-xs text-right">Desc.</th>
                <th className="px-3 py-3 font-bold uppercase text-xs text-right">V. Líq.</th>
                <th className="px-3 py-3 font-bold uppercase text-xs text-right">Custo</th>
                <th className="px-3 py-3 font-bold uppercase text-xs text-right">Lucro</th>
              </tr>
            </thead>
            <tbody>
              {linhasFiltradas.map((l, idx) => (
                <tr key={l.linha_id} className={`border-t border-zinc-800 hover:bg-zinc-800/50 transition ${idx % 2 === 0 ? 'bg-zinc-900' : 'bg-zinc-900/50'}`}>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-white">{l.cliente_nome}</div>
                    {l.complemento && <div className="text-[10px] text-zinc-500">{l.complemento}</div>}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-zinc-300">{l.numero}</td>
                  <td className="px-3 py-2.5 text-zinc-300">{l.plano_nome}</td>
                  <td className="px-3 py-2.5 text-zinc-400 text-xs">{l.canal}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border capitalize ${statusColors[l.status_linha]}`}>{l.status_linha}</span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-zinc-300">{formatDateBR(l.expirar_dados)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-emerald-400 font-semibold">{brl(l.valor)}</td>
                  <td className={`px-3 py-2.5 text-right font-mono text-xs ${l.desconto > 0 ? 'text-amber-400' : 'text-zinc-600'}`}>
                    {l.desconto > 0 ? `-${brl(l.desconto)}` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-emerald-300 font-semibold">{brl(l.valor_liquido)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-red-400">{brl(l.custo)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-blue-400 font-semibold">{brl(l.lucro)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-zinc-950 px-4 py-2 text-xs text-zinc-500 border-t border-zinc-800">
          {linhasFiltradas.length} de {data.linhas.length} linhas
        </div>
      </div>

      <p className="text-xs text-zinc-500">
        💡 No sistema real, todas as células são editáveis inline, você sincroniza o status com a Tá Telecom em 1 clique e exporta tudo para Excel.
      </p>
    </div>
  );
}
