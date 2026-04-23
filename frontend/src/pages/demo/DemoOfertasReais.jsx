import { Tag, TrendingUp, DollarSign, Users, Package } from 'lucide-react';
import { StatCard } from '../../components/StatCard';
import { DEMO_PLANOS, brl, getDemoData } from '../../demo/fakeData';

export default function DemoOfertas() {
  const data = getDemoData();
  // Uma oferta por plano, com contagem de linhas usando cada uma
  const ofertas = DEMO_PLANOS.map((p) => {
    const linhasDoPlano = data.linhas.filter(l => l.plano_nome === p.nome && l.status_linha === 'ativo');
    return {
      nome: p.nome,
      franquia: p.franquia,
      custo: p.custo,
      valor: p.valor,
      lucro: +(p.valor - p.custo).toFixed(2),
      margem: +(((p.valor - p.custo) / p.valor) * 100).toFixed(1),
      linhas_ativas: linhasDoPlano.length,
      receita_mensal: +(linhasDoPlano.length * p.valor).toFixed(2),
      lucro_mensal: +(linhasDoPlano.length * (p.valor - p.custo)).toFixed(2),
    };
  });

  const totalLinhasAtivas = ofertas.reduce((s, o) => s + o.linhas_ativas, 0);
  const receitaTotal = ofertas.reduce((s, o) => s + o.receita_mensal, 0);
  const lucroTotal = ofertas.reduce((s, o) => s + o.lucro_mensal, 0);
  const margemMedia = receitaTotal > 0 ? ((lucroTotal / receitaTotal) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="demo-ofertas-page">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Ofertas</h1>
        <p className="text-zinc-400 text-xs sm:text-sm mt-1">
          Ofertas sugeridas pela Tá Telecom com desempenho em tempo real
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Tag} label="Ofertas ativas" value={ofertas.length} color="blue" testId="ofertas-total" />
        <StatCard icon={Users} label="Linhas ativas" value={totalLinhasAtivas} color="emerald" testId="ofertas-linhas" />
        <StatCard icon={DollarSign} label="Receita mensal" value={brl(receitaTotal)} color="violet" testId="ofertas-receita" />
        <StatCard icon={TrendingUp} label="Margem média" value={`${margemMedia}%`} color="orange" testId="ofertas-margem" />
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-400" /> Ofertas da Tá Telecom
          </h3>
          <span className="text-xs text-zinc-500">Custo + margem = venda sugerida</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-950">
              <tr className="text-zinc-500 text-left text-xs">
                <th className="px-4 py-2.5 font-medium">Oferta</th>
                <th className="px-4 py-2.5 font-medium">Franquia</th>
                <th className="px-4 py-2.5 font-medium text-right">Custo</th>
                <th className="px-4 py-2.5 font-medium text-right">Venda</th>
                <th className="px-4 py-2.5 font-medium text-right">Margem</th>
                <th className="px-4 py-2.5 font-medium text-right">Linhas ativas</th>
                <th className="px-4 py-2.5 font-medium text-right">Lucro/mês</th>
              </tr>
            </thead>
            <tbody>
              {ofertas.map((o, i) => (
                <tr key={i} className="border-t border-zinc-800 hover:bg-zinc-950/50 transition">
                  <td className="px-4 py-2.5 text-white font-medium">{o.nome}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[11px] font-bold">
                      {o.franquia}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-red-400">{brl(o.custo)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-white font-bold">{brl(o.valor)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
                      {o.margem}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-blue-400">{o.linhas_ativas}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-emerald-400 font-bold">{brl(o.lucro_mensal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-zinc-950 border-t-2 border-zinc-700">
              <tr>
                <td className="px-4 py-3 text-white font-bold" colSpan={5}>TOTAL</td>
                <td className="px-4 py-3 text-right font-mono text-blue-400 font-bold">{totalLinhasAtivas}</td>
                <td className="px-4 py-3 text-right font-mono text-emerald-400 font-black text-base">{brl(lucroTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
