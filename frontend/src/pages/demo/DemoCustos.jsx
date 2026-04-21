import { useMemo } from 'react';
import { StatCard } from '../../components/StatCard';
import { getDemoData, brl } from '../../demo/fakeData';
import { DollarSign, Wallet, Building2, TrendingUp, Package } from 'lucide-react';

export default function DemoCustos() {
  const data = useMemo(() => getDemoData(), []);
  const { resumo, custosPorPlano, custosFixos } = data;

  const totalFixos = custosFixos.filter(f => f.ativo).reduce((s,f) => s + f.valor, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Custos & Lucro</h1>
        <p className="text-zinc-400 text-sm mt-1">Financeiro consolidado — receita, custos variaveis e fixos, lucro liquido por plano</p>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard icon={DollarSign} label="Receita mensal" value={brl(resumo.receita)} color="emerald" />
        <StatCard icon={Wallet} label="Custo Variavel" value={brl(resumo.custo)} color="orange" sub="Linhas (oferta Ta)" />
        <StatCard icon={Building2} label="Custo Fixo" value={brl(totalFixos)} color="red" sub="Painel (VPS, Asaas...)" />
        <StatCard icon={Wallet} label="Custo Total" value={brl(resumo.custo_total)} color="red" sub="Variavel + Fixo" />
        <StatCard icon={TrendingUp} label="Lucro Liquido" value={brl(resumo.lucro_liquido)} color={resumo.lucro_liquido >= 0 ? 'emerald' : 'red'} sub={`Margem: ${resumo.margem_pct.toFixed(1)}%`} />
      </div>

      {/* Custos por plano */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-zinc-800">
          <Package className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Custos por Plano (tabela Ta Telecom)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-950">
              <tr className="text-zinc-400 text-left">
                <th className="px-3 py-3 font-bold uppercase text-xs">Plano</th>
                <th className="px-3 py-3 font-bold uppercase text-xs text-right">Custo unit.</th>
                <th className="px-3 py-3 font-bold uppercase text-xs text-right">Venda unit.</th>
                <th className="px-3 py-3 font-bold uppercase text-xs text-center">Qtd Linhas</th>
                <th className="px-3 py-3 font-bold uppercase text-xs text-right">Receita Total</th>
                <th className="px-3 py-3 font-bold uppercase text-xs text-right">Custo Total</th>
                <th className="px-3 py-3 font-bold uppercase text-xs text-right">Lucro</th>
                <th className="px-3 py-3 font-bold uppercase text-xs text-right">Margem</th>
              </tr>
            </thead>
            <tbody>
              {custosPorPlano.map(cp => {
                const margem = cp.receita > 0 ? (cp.lucro/cp.receita)*100 : 0;
                return (
                  <tr key={cp.plano} className="border-t border-zinc-800 hover:bg-zinc-800/50">
                    <td className="px-3 py-2.5 font-medium text-white">{cp.plano}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-red-400">{brl(cp.custo_unit)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-emerald-400">{brl(cp.valor_unit)}</td>
                    <td className="px-3 py-2.5 text-center font-mono text-white">{cp.qtd_linhas}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-emerald-400 font-semibold">{brl(cp.receita)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-red-400">{brl(cp.custo_total)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-blue-400 font-semibold">{brl(cp.lucro)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-violet-400">{margem.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Custos Fixos */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-zinc-800">
          <Building2 className="w-4 h-4 text-red-400" />
          <h3 className="text-sm font-semibold text-white">Custos Fixos do Painel</h3>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {custosFixos.map(f => (
              <tr key={f.id} className="border-t border-zinc-800">
                <td className="px-4 py-3 text-white">{f.nome}</td>
                <td className="px-4 py-3 text-right font-mono text-red-400 font-semibold">{brl(f.valor)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-zinc-700 bg-zinc-950">
              <td className="px-4 py-3 font-bold text-white">TOTAL</td>
              <td className="px-4 py-3 text-right font-mono text-red-400 font-bold">{brl(totalFixos)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
