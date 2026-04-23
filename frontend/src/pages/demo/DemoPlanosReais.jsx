import { Package, DollarSign, TrendingUp, Wifi } from 'lucide-react';
import { StatCard } from '../../components/StatCard';
import { DEMO_PLANOS, brl } from '../../demo/fakeData';

export default function DemoPlanos() {
  const totalPlanos = DEMO_PLANOS.length;
  const custoMedio = DEMO_PLANOS.reduce((s, p) => s + p.custo, 0) / totalPlanos;
  const vendaMedia = DEMO_PLANOS.reduce((s, p) => s + p.valor, 0) / totalPlanos;
  const margemMedia = ((vendaMedia - custoMedio) / vendaMedia) * 100;

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="demo-planos-page">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Planos</h1>
        <p className="text-zinc-400 text-xs sm:text-sm mt-1">Tabela oficial da Tá Telecom com preços sugeridos de venda</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Package} label="Total de planos" value={totalPlanos} color="blue" testId="planos-total" />
        <StatCard icon={Wifi} label="Menor franquia" value="1GB" color="emerald" testId="planos-min" />
        <StatCard icon={Wifi} label="Maior franquia" value="50GB" color="violet" testId="planos-max" />
        <StatCard icon={TrendingUp} label="Margem média" value={`${margemMedia.toFixed(1)}%`} color="orange" testId="planos-margem" />
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" /> Tabela de planos Tá Telecom
          </h3>
          <span className="text-xs text-zinc-500">Valores oficiais da operadora</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-950">
              <tr className="text-zinc-500 text-left text-xs">
                <th className="px-4 py-2.5 font-medium">Plano</th>
                <th className="px-4 py-2.5 font-medium">Franquia</th>
                <th className="px-4 py-2.5 font-medium text-right">Custo Tá</th>
                <th className="px-4 py-2.5 font-medium text-right">Venda sugerida</th>
                <th className="px-4 py-2.5 font-medium text-right">Lucro/linha</th>
                <th className="px-4 py-2.5 font-medium text-right">Margem</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_PLANOS.map((p, i) => {
                const lucro = p.valor - p.custo;
                const margem = (lucro / p.valor) * 100;
                return (
                  <tr key={i} className="border-t border-zinc-800 hover:bg-zinc-950/50 transition">
                    <td className="px-4 py-2.5 text-white font-medium">{p.nome}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[11px] font-bold">
                        {p.franquia}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-red-400">{brl(p.custo)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-white font-bold">{brl(p.valor)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-emerald-400 font-semibold">{brl(lucro)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
                        {margem.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
