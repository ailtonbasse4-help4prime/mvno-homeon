/**
 * Mockups estaticos com dados ficticios para a Landing Page.
 * NENHUM dado real de clientes eh usado aqui.
 */

const cardStyle = "bg-zinc-900 border border-zinc-800 rounded-lg p-3";
const headerCell = "text-xs font-medium text-blue-300 py-2 px-3";
const cell = "text-xs text-zinc-300 py-2.5 px-3 border-t border-zinc-800/50";
const badge = (color) => `inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${color}`;

export function MockDashboard() {
  return (
    <div className="bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden shadow-2xl">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-44 bg-zinc-900/80 border-r border-zinc-800 p-4 hidden md:block">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold">M</div>
            <div>
              <p className="text-white text-xs font-bold">MVNO</p>
              <p className="text-zinc-500 text-[9px]">Operadora</p>
            </div>
          </div>
          <div className="space-y-1">
            {['Dashboard', 'Clientes', 'Planos', 'Chips', 'Ativações', 'Linhas', 'Revendedores', 'Cobranças'].map((item, i) => (
              <div key={item} className={`text-[11px] py-1.5 px-2 rounded ${i === 0 ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-500'}`}>{item}</div>
            ))}
          </div>
        </div>
        {/* Main */}
        <div className="flex-1 p-4 md:p-5">
          <p className="text-white font-bold text-sm mb-4">Dashboard</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { n: '156', l: 'Clientes', c: 'text-white' },
              { n: '720', l: 'Chips', c: 'text-white' },
              { n: '143', l: 'Linhas Ativas', c: 'text-emerald-400' },
              { n: '12', l: 'Planos', c: 'text-white' },
            ].map((s) => (
              <div key={s.l} className={cardStyle}>
                <p className={`text-xl font-bold font-mono ${s.c}`}>{s.n}</p>
                <p className="text-zinc-500 text-[10px] mt-0.5">{s.l}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className={cardStyle}>
              <p className="text-zinc-300 text-xs font-medium mb-2">Status dos Chips</p>
              <div className="grid grid-cols-3 gap-2">
                {[{ n: '540', l: 'Disponíveis', c: 'text-emerald-400' }, { n: '143', l: 'Ativados', c: 'text-blue-400' }, { n: '37', l: 'Bloqueados', c: 'text-red-400' }].map((s) => (
                  <div key={s.l} className="text-center">
                    <p className={`text-lg font-bold font-mono ${s.c}`}>{s.n}</p>
                    <p className="text-zinc-500 text-[9px]">{s.l}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className={cardStyle}>
              <p className="text-zinc-300 text-xs font-medium mb-2">Status das Linhas</p>
              <div className="grid grid-cols-3 gap-2">
                {[{ n: '143', l: 'Ativas', c: 'text-emerald-400' }, { n: '5', l: 'Pendentes', c: 'text-amber-400' }, { n: '37', l: 'Bloqueadas', c: 'text-red-400' }].map((s) => (
                  <div key={s.l} className="text-center">
                    <p className={`text-lg font-bold font-mono ${s.c}`}>{s.n}</p>
                    <p className="text-zinc-500 text-[9px]">{s.l}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MockClientes() {
  const clientes = [
    { nome: 'Ana Carolina Souza', plano: 'Premium 20GB', st: 'ativo' },
    { nome: 'Bruno Oliveira Lima', plano: 'Básico 5GB', st: 'ativo' },
    { nome: 'Carla Mendes Silva', plano: 'Premium 20GB', st: 'ativo' },
    { nome: 'Daniel Ferreira Costa', plano: 'Intermediário 10GB', st: 'bloqueado' },
    { nome: 'Eduardo Santos Reis', plano: 'Básico 5GB', st: 'ativo' },
    { nome: 'Fernanda Alves Rocha', plano: 'Premium 20GB', st: 'ativo' },
  ];

  return (
    <div className="bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden shadow-2xl">
      <div className="p-4 md:p-5 border-b border-zinc-800">
        <p className="text-white font-bold text-sm">Clientes</p>
        <p className="text-zinc-500 text-[10px]">156 clientes cadastrados</p>
      </div>
      <table className="w-full">
        <thead><tr className="bg-zinc-900/80">
          <th className={headerCell}>Nome</th>
          <th className={headerCell}>Plano</th>
          <th className={headerCell}>Status</th>
        </tr></thead>
        <tbody>
          {clientes.map((c, i) => (
            <tr key={i} className="hover:bg-zinc-900/30">
              <td className={cell + " text-white font-medium"}>{c.nome}</td>
              <td className={cell}>{c.plano}</td>
              <td className={cell}>
                <span className={badge(c.st === 'ativo' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30')}>
                  {c.st}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MockCobrancas() {
  const cobrancas = [
    { nome: 'Ana Carolina Souza', tipo: 'PIX', valor: 'R$ 49,90', venc: '15/05', st: 'Pendente', stc: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    { nome: 'Bruno Oliveira Lima', tipo: 'BOLETO', valor: 'R$ 29,90', venc: '15/05', st: 'Pago', stc: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    { nome: 'Carla Mendes Silva', tipo: 'PIX', valor: 'R$ 49,90', venc: '10/05', st: 'Pago', stc: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    { nome: 'Daniel Ferreira Costa', tipo: 'BOLETO', valor: 'R$ 39,90', venc: '06/04', st: 'Vencido', stc: 'bg-red-500/15 text-red-400 border-red-500/30' },
    { nome: 'Eduardo Santos Reis', tipo: 'PIX', valor: 'R$ 29,90', venc: '15/05', st: 'Pendente', stc: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  ];

  return (
    <div className="bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden shadow-2xl">
      <div className="p-4 md:p-5 border-b border-zinc-800 flex items-center justify-between">
        <div>
          <p className="text-white font-bold text-sm">Gestão de Cobranças</p>
          <p className="text-emerald-400 text-[10px]">Asaas: Conectado (production)</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
        {[
          { n: 'R$ 1.240', l: 'Receita', c: 'text-emerald-400' },
          { n: 'R$ 349', l: 'Pendente', c: 'text-amber-400' },
          { n: 'R$ 39', l: 'Vencido', c: 'text-red-400' },
          { n: '42', l: 'Cobranças', c: 'text-white' },
        ].map((s) => (
          <div key={s.l} className={cardStyle + " text-center"}>
            <p className={`text-sm font-bold font-mono ${s.c}`}>{s.n}</p>
            <p className="text-zinc-500 text-[9px]">{s.l}</p>
          </div>
        ))}
      </div>
      <table className="w-full">
        <thead><tr className="bg-zinc-900/80">
          <th className={headerCell}>Cliente</th>
          <th className={headerCell}>Valor</th>
          <th className={headerCell}>Status</th>
        </tr></thead>
        <tbody>
          {cobrancas.map((c, i) => (
            <tr key={i} className="hover:bg-zinc-900/30">
              <td className={cell + " text-white font-medium"}>{c.nome}</td>
              <td className={cell + " font-mono"}>{c.valor}</td>
              <td className={cell}><span className={badge(c.stc) + " border"}>{c.st}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MockAtivacoes() {
  return (
    <div className="bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden shadow-2xl">
      <div className="p-4 md:p-5 border-b border-zinc-800">
        <p className="text-white font-bold text-sm">Ativação de Linha</p>
        <p className="text-zinc-500 text-[10px]">Selecione o cliente e o chip. A oferta e o plano são detectados automaticamente.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-5">
        <div className="md:col-span-3 space-y-4">
          <div>
            <p className="text-zinc-300 text-xs font-medium mb-2">1. Selecione o Cliente</p>
            <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 text-zinc-400 text-xs">Ana Carolina Souza</div>
          </div>
          <div>
            <p className="text-zinc-300 text-xs font-medium mb-2">2. Digite ou Selecione o ICCID</p>
            <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 text-zinc-400 text-xs font-mono">8955170110398877001</div>
          </div>
          <div>
            <p className="text-zinc-300 text-xs font-medium mb-2">DDD da Linha</p>
            <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 text-zinc-400 text-xs w-20">11</div>
          </div>
          <div className="bg-blue-600 text-white text-center py-3 rounded-lg text-xs font-semibold">Ativar Linha</div>
        </div>
        <div className="md:col-span-2 space-y-3">
          <div className="bg-blue-900/30 border border-blue-800/50 rounded-lg p-4">
            <p className="text-blue-300 text-xs font-bold mb-2">Sobre a Ativação</p>
            <ul className="text-zinc-400 text-[10px] space-y-1">
              <li>- Digite ou cole o ICCID diretamente</li>
              <li>- O sistema detecta a Oferta e o Plano</li>
              <li>- Apenas chips disponíveis podem ser ativados</li>
              <li>- A ativação é processada via API da operadora</li>
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className={cardStyle + " text-center"}>
              <p className="text-lg font-bold text-white">156</p>
              <p className="text-zinc-500 text-[9px]">Clientes Ativos</p>
            </div>
            <div className={cardStyle + " text-center border-emerald-800/30"}>
              <p className="text-lg font-bold text-emerald-400">540</p>
              <p className="text-zinc-500 text-[9px]">Chips Disponíveis</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
