import { useMemo } from 'react';
import { StatCard } from '../../components/StatCard';
import { getDemoData, brl } from '../../demo/fakeData';
import { DollarSign, Wallet, Building2, TrendingUp, Package, Info, ArrowUpRight } from 'lucide-react';

export default function DemoCustos() {
  const data = useMemo(() => getDemoData(), []);
  const { resumo, custosPorPlano, custosFixos } = data;

  const totalFixos = custosFixos.filter(f => f.ativo).reduce((s,f) => s + f.valor, 0);
  const totalLinhas = data.linhas.filter(l => l.incluir_lucro).length;
  // Projecao de crescimento
  const mediaPorLinha = totalLinhas > 0 ? resumo.receita / totalLinhas : 0;
  const custoMedioPorLinha = totalLinhas > 0 ? resumo.custo / totalLinhas : 0;
  const projecoes = [500, 1000, 2000].map(qtd => {
    const receita = qtd * mediaPorLinha;
    const custoVar = qtd * custoMedioPorLinha;
    const lucro = receita - custoVar - totalFixos;
    return { qtd, receita, custoVar, lucro, margem: receita > 0 ? (lucro/receita)*100 : 0 };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Custos e Lucro</h1>
        <p className="text-zinc-400 text-sm mt-1">Financeiro consolidado — receita, custos variáveis e fixos, lucro líquido por plano</p>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard icon={DollarSign} label="Receita mensal" value={brl(resumo.receita)} color="emerald" />
        <StatCard icon={Wallet} label="Custo Variável" value={brl(resumo.custo)} color="orange" sub="Repasse Tá (70%)" />
        <StatCard icon={Building2} label="Custo Fixo" value={brl(totalFixos)} color="red" sub="Painel (VPS, Asaas, etc.)" />
        <StatCard icon={Wallet} label="Custo Total" value={brl(resumo.custo_total)} color="red" sub="Variável + Fixo" />
        <StatCard icon={TrendingUp} label="Lucro Líquido" value={brl(resumo.lucro_liquido)} color={resumo.lucro_liquido >= 0 ? 'emerald' : 'red'} sub={`Margem: ${resumo.margem_pct.toFixed(1)}%`} />
      </div>

      {/* Box explicativo margem Ta */}
      <div className="rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-950/30 to-zinc-950 p-5">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-lg bg-blue-500/15 border border-blue-500/40 flex items-center justify-center">
            <Info className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-sm text-zinc-300">
            <div className="font-semibold text-white mb-1">Como funciona a margem da Tá Telecom</div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              A Tá Telecom sugere uma <strong className="text-emerald-400">margem bruta de 30%</strong> sobre cada recarga (ela fica com 70%, você com 30%).
              No exemplo ao lado: <strong className="text-emerald-400">{brl(resumo.receita)}</strong> de receita ×
              <strong className="text-orange-400"> 70% = {brl(resumo.custo)}</strong> de repasse para a Tá,
              sobrando <strong className="text-blue-400">{brl(resumo.receita - resumo.custo)}</strong> de lucro bruto.
              Descontando os custos fixos (<strong className="text-red-400">{brl(totalFixos)}</strong> em VPS, domínio e Asaas),
              você fica com <strong className="text-emerald-400">{brl(resumo.lucro_liquido)}</strong> líquido ({resumo.margem_pct.toFixed(1)}% de margem real).
              Conforme o número de linhas cresce, os custos fixos se diluem e a margem real sobe.
            </p>
          </div>
        </div>
      </div>

      {/* Custos por plano */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-zinc-800">
          <Package className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Custos por Plano (tabela Tá Telecom)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-950">
              <tr className="text-zinc-400 text-left">
                <th className="px-3 py-3 font-bold uppercase text-xs">Plano</th>
                <th className="px-3 py-3 font-bold uppercase text-xs text-right">Custo unit.</th>
                <th className="px-3 py-3 font-bold uppercase text-xs text-right">Venda unit.</th>
                <th className="px-3 py-3 font-bold uppercase text-xs text-center">Qtd. de linhas</th>
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

      {/* Projecao de crescimento */}
      <div className="bg-gradient-to-br from-emerald-950/30 to-zinc-950 border border-emerald-500/30 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-emerald-900/40">
          <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Projeção de crescimento</h3>
          <span className="text-[10px] text-zinc-500">(custos fixos se diluem conforme você escala)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-emerald-900/40">
          {projecoes.map(p => (
            <div key={p.qtd} className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Com</span>
                <span className="text-2xl font-bold text-white">{p.qtd} clientes</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-zinc-500">Receita</span><span className="font-mono text-emerald-400 font-semibold">{brl(p.receita)}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Custo Tá (70%)</span><span className="font-mono text-orange-400">{brl(p.custoVar)}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Custos fixos</span><span className="font-mono text-red-400">{brl(totalFixos)}</span></div>
                <div className="flex justify-between border-t border-zinc-800 pt-1 mt-1">
                  <span className="text-white font-semibold">Lucro líquido</span>
                  <span className="font-mono text-emerald-400 font-bold">{brl(p.lucro)}</span>
                </div>
                <div className="text-right text-[10px] text-violet-400 font-semibold">Margem: {p.margem.toFixed(1)}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
