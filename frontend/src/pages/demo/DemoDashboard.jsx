import { useMemo } from 'react';
import { StatCard } from '../../components/StatCard';
import { getDemoData, brl } from '../../demo/fakeData';
import { Users, CreditCard, Phone, DollarSign, Wallet, TrendingUp, Package, Zap } from 'lucide-react';

export default function DemoDashboard() {
  const data = useMemo(() => getDemoData(), []);
  const { linhas, clientes, resumo } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-zinc-400 text-sm mt-1">Visão geral da operação — 150 linhas fictícias com valores reais da Tá</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard icon={Users} label="Clientes" value={clientes.length} color="blue" sub={`${clientes.filter(c=>c.ativo).length} ativos`} />
        <StatCard icon={Phone} label="Linhas Ativas" value={resumo.ativas} color="emerald" sub={`${resumo.total_linhas} total`} />
        <StatCard icon={CreditCard} label="Bloqueadas" value={resumo.suspensas} color="red" sub="Vencimento / inadimp." />
        <StatCard icon={Package} label="Planos ativos" value={data.planos.length} color="violet" sub="Tabela Tá Telecom" />
        <StatCard icon={Zap} label="Ativações no mês" value={18} color="amber" sub="Self-Service QR Code" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={DollarSign} label="Receita mensal" value={brl(resumo.receita)} color="emerald" />
        <StatCard icon={Wallet} label="Custo Total" value={brl(resumo.custo_total)} color="orange" sub={`+ ${brl(resumo.custo_fixo)} fixos`} />
        <StatCard icon={TrendingUp} label="Lucro Líquido" value={brl(resumo.lucro_liquido)} color="blue" sub="Após custos fixos" />
        <StatCard icon={TrendingUp} label="Margem" value={`${resumo.margem_pct.toFixed(1)}%`} color="violet" />
      </div>

      {/* Distribuicao por plano */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Distribuição por plano</h3>
        <div className="grid grid-cols-3 lg:grid-cols-9 gap-2">
          {data.planos.map(p => {
            const qtd = linhas.filter(l => l.plano_nome === p.nome).length;
            return (
              <div key={p.nome} className="bg-zinc-950 border border-zinc-800 rounded-md p-3 text-center hover:border-emerald-500/50 transition">
                <div className="text-xs text-zinc-500">{p.franquia}</div>
                <div className="text-xl font-bold text-emerald-400 font-mono">{qtd}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">{brl(p.valor)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Highlights */}
      <div className="bg-gradient-to-br from-emerald-950/30 to-zinc-950 border border-emerald-900/40 rounded-lg p-6">
        <h3 className="text-lg font-bold text-emerald-400 mb-2">Por que o HELP4PRIME MVNO?</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-sm">
          <div>
            <div className="font-semibold text-white">🎯 Ativação em segundos</div>
            <p className="text-zinc-400 text-xs mt-1">O cliente lê o QR Code, paga via PIX e o chip é ativado automaticamente pela API da Tá Telecom.</p>
          </div>
          <div>
            <div className="font-semibold text-white">💸 Zero inadimplência</div>
            <p className="text-zinc-400 text-xs mt-1">Cobrança recorrente via Asaas. Boleto, PIX e cartão de crédito — tudo integrado.</p>
          </div>
          <div>
            <div className="font-semibold text-white">📊 Visão financeira real</div>
            <p className="text-zinc-400 text-xs mt-1">A Planilha Operacional mostra custo, lucro e margem por linha. Você sabe exatamente o que está ganhando.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
