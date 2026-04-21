/**
 * StatCard - Card de indicador padronizado (usado em Planilha, Cobrancas, Custos, Dashboard).
 * Estilo: borda colorida + gradiente + texto grande + hover animation.
 *
 * Uso:
 *   <StatCard icon={DollarSign} label="Receita" value="R$ 4.329,08" color="emerald" sub="Planilha" />
 */

const COLOR_MAP = {
  emerald: {
    border: 'border-emerald-900/40 hover:border-emerald-700/70',
    bg: 'from-emerald-950/30 to-zinc-950',
    icon: 'text-emerald-400',
    value: 'text-emerald-400',
    glow: 'hover:shadow-emerald-900/30',
  },
  red: {
    border: 'border-red-900/40 hover:border-red-700/70',
    bg: 'from-red-950/30 to-zinc-950',
    icon: 'text-red-400',
    value: 'text-red-400',
    glow: 'hover:shadow-red-900/30',
  },
  orange: {
    border: 'border-orange-900/40 hover:border-orange-700/70',
    bg: 'from-orange-950/30 to-zinc-950',
    icon: 'text-orange-400',
    value: 'text-orange-400',
    glow: 'hover:shadow-orange-900/30',
  },
  amber: {
    border: 'border-amber-900/40 hover:border-amber-700/70',
    bg: 'from-amber-950/30 to-zinc-950',
    icon: 'text-amber-400',
    value: 'text-amber-400',
    glow: 'hover:shadow-amber-900/30',
  },
  yellow: {
    border: 'border-yellow-900/40 hover:border-yellow-700/70',
    bg: 'from-yellow-950/30 to-zinc-950',
    icon: 'text-yellow-400',
    value: 'text-yellow-400',
    glow: 'hover:shadow-yellow-900/30',
  },
  blue: {
    border: 'border-blue-900/40 hover:border-blue-700/70',
    bg: 'from-blue-950/30 to-zinc-950',
    icon: 'text-blue-400',
    value: 'text-blue-400',
    glow: 'hover:shadow-blue-900/30',
  },
  violet: {
    border: 'border-violet-900/40 hover:border-violet-700/70',
    bg: 'from-violet-950/30 to-zinc-950',
    icon: 'text-violet-400',
    value: 'text-violet-400',
    glow: 'hover:shadow-violet-900/30',
  },
  purple: {
    border: 'border-purple-900/40 hover:border-purple-700/70',
    bg: 'from-purple-950/30 to-zinc-950',
    icon: 'text-purple-400',
    value: 'text-purple-400',
    glow: 'hover:shadow-purple-900/30',
  },
};

export function StatCard({ icon: Icon, label, value, sub, color = 'blue', testId, title, valueClassName = '', details }) {
  const c = COLOR_MAP[color] || COLOR_MAP.blue;
  return (
    <div
      className={`group relative rounded-lg border ${c.border} bg-gradient-to-br ${c.bg} p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${c.glow} ${details ? 'cursor-help' : 'cursor-default'}`}
      data-testid={testId}
      title={title}
    >
      <div className="flex items-center gap-2 text-zinc-300 text-sm font-medium">
        {Icon && <Icon className={`w-4 h-4 ${c.icon} transition-transform duration-300 group-hover:scale-110`} />}
        <span>{label}</span>
        {details && details.length > 0 && (
          <span className={`ml-auto text-[10px] ${c.icon} opacity-60`}>ⓘ</span>
        )}
      </div>
      <div className={`mt-1.5 text-2xl font-bold ${c.value} ${valueClassName}`}>{value}</div>
      {sub && <div className="text-[11px] text-zinc-400 mt-1">{sub}</div>}

      {/* Tooltip com detalhamento dos itens */}
      {details && details.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 z-30 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl p-3 min-w-[200px]">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-semibold">Detalhamento</div>
            <div className="space-y-1">
              {details.map((d, i) => (
                <div key={i} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-zinc-400 truncate">{d.label}</span>
                  <span className={`font-mono font-semibold ${c.value}`}>{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StatCard;
