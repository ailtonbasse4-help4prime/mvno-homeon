import { Zap, Clock, CheckCircle, XCircle } from 'lucide-react';
import { StatCard } from '../../components/StatCard';
import { getDemoData, brl } from '../../demo/fakeData';

export default function DemoAtivacoesReais() {
  const data = getDemoData();
  // "Ativacoes" = linhas ordenadas por recente, mostra as 50 ultimas
  const ativacoes = data.linhas.slice(0, 50).map((l, i) => {
    // status de ativacao: sucesso/pendente/falha
    const r = (i * 37) % 100;
    let statusAtivacao, cor;
    if (r < 85) { statusAtivacao = 'sucesso'; cor = 'emerald'; }
    else if (r < 95) { statusAtivacao = 'pendente'; cor = 'amber'; }
    else { statusAtivacao = 'falha'; cor = 'red'; }
    const diasAtras = (i * 3) % 90;
    const d = new Date(); d.setDate(d.getDate() - diasAtras);
    return {
      ...l,
      status_ativacao: statusAtivacao,
      cor,
      ativado_em: d.toISOString().slice(0, 19).replace('T', ' '),
    };
  });

  const sucesso = ativacoes.filter(a => a.status_ativacao === 'sucesso').length;
  const pendente = ativacoes.filter(a => a.status_ativacao === 'pendente').length;
  const falha = ativacoes.filter(a => a.status_ativacao === 'falha').length;
  const taxaSucesso = ((sucesso / ativacoes.length) * 100).toFixed(1);

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="demo-ativacoes-page">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Ativações</h1>
        <p className="text-zinc-400 text-xs sm:text-sm mt-1">Histórico das 50 ativações mais recentes via API Tá Telecom</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Zap} label="Total no período" value={ativacoes.length} color="blue" testId="ativ-total" />
        <StatCard icon={CheckCircle} label="Sucesso" value={sucesso} color="emerald" testId="ativ-sucesso" />
        <StatCard icon={Clock} label="Pendentes" value={pendente} color="amber" testId="ativ-pendente" />
        <StatCard icon={XCircle} label="Taxa de sucesso" value={`${taxaSucesso}%`} color="violet" testId="ativ-taxa" />
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-white">Últimas ativações</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-950">
              <tr className="text-zinc-500 text-left text-xs">
                <th className="px-4 py-2.5 font-medium">Data</th>
                <th className="px-4 py-2.5 font-medium">Cliente</th>
                <th className="px-4 py-2.5 font-medium">ICCID</th>
                <th className="px-4 py-2.5 font-medium">Número</th>
                <th className="px-4 py-2.5 font-medium">Plano</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {ativacoes.map((a, i) => (
                <tr key={i} className="border-t border-zinc-800 hover:bg-zinc-950/50 transition">
                  <td className="px-4 py-2.5 text-xs text-zinc-300 font-mono">{a.ativado_em}</td>
                  <td className="px-4 py-2.5 text-white text-xs">{a.cliente_nome}</td>
                  <td className="px-4 py-2.5 text-[11px] text-zinc-400 font-mono">{a.iccid}</td>
                  <td className="px-4 py-2.5 text-xs text-zinc-300 font-mono">{a.numero}</td>
                  <td className="px-4 py-2.5 text-xs">
                    <span className="inline-flex px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-bold">
                      {a.franquia}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    <span className={`inline-flex px-2 py-0.5 rounded-full bg-${a.cor}-500/10 border border-${a.cor}-500/30 text-${a.cor}-400 text-[10px] font-bold`}>
                      {a.status_ativacao}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
