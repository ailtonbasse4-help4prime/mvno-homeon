import { CreditCard, CheckCircle, Clock, AlertCircle, Ban } from 'lucide-react';
import { StatCard } from '../../components/StatCard';
import { getDemoData } from '../../demo/fakeData';

const STATUS_CHIP = {
  'Ativo':                   { color: 'emerald', Icon: CheckCircle },
  'Pendente':                { color: 'amber',   Icon: Clock },
  'Bloqueado - vencimento':  { color: 'red',     Icon: AlertCircle },
  'Cancelado':               { color: 'zinc',    Icon: Ban },
};

export default function DemoChipsReais() {
  const data = getDemoData();
  const chips = data.linhas.map(l => ({
    iccid: l.iccid,
    numero: l.numero,
    cliente_nome: l.cliente_nome,
    status_chip: l.status_chip,
  }));

  const total = chips.length;
  const ativos = chips.filter(c => c.status_chip === 'Ativo').length;
  const bloqueados = chips.filter(c => c.status_chip === 'Bloqueado - vencimento').length;
  const pendentes = chips.filter(c => c.status_chip === 'Pendente').length;

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="demo-chips-page">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Chips</h1>
        <p className="text-zinc-400 text-xs sm:text-sm mt-1">Estoque e status dos chips no sistema</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={CreditCard} label="Total de chips" value={total} color="blue" testId="chips-total" />
        <StatCard icon={CheckCircle} label="Ativos" value={ativos} color="emerald" testId="chips-ativos" />
        <StatCard icon={AlertCircle} label="Bloqueados" value={bloqueados} color="red" testId="chips-bloqueados" />
        <StatCard icon={Clock} label="Pendentes" value={pendentes} color="amber" testId="chips-pendentes" />
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-white">Inventário de chips</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-950">
              <tr className="text-zinc-500 text-left text-xs">
                <th className="px-4 py-2.5 font-medium">ICCID</th>
                <th className="px-4 py-2.5 font-medium">Número atrelado</th>
                <th className="px-4 py-2.5 font-medium">Cliente</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {chips.slice(0, 100).map((c, i) => {
                const info = STATUS_CHIP[c.status_chip] || STATUS_CHIP['Ativo'];
                return (
                  <tr key={i} className="border-t border-zinc-800 hover:bg-zinc-950/50 transition">
                    <td className="px-4 py-2.5 text-xs text-zinc-300 font-mono">{c.iccid}</td>
                    <td className="px-4 py-2.5 text-xs text-zinc-300 font-mono">{c.numero}</td>
                    <td className="px-4 py-2.5 text-white text-xs">{c.cliente_nome}</td>
                    <td className="px-4 py-2.5 text-xs">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-${info.color}-500/10 border border-${info.color}-500/30 text-${info.color}-400 text-[10px] font-bold`}>
                        <info.Icon className="w-3 h-3" /> {c.status_chip}
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
