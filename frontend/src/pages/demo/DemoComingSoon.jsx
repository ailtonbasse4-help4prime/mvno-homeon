import { Zap, MessageCircle, Sparkles, CheckCircle } from 'lucide-react';

/**
 * Pagina generica para funcionalidades sem implementacao visual no modo demo.
 * Explica o recurso e convida o visitante a agendar uma demo ao vivo.
 */
export default function DemoComingSoon({ title, description, features = [], highlight }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">{title}</h1>
        {description && <p className="text-zinc-400 text-xs sm:text-sm mt-1">{description}</p>}
      </div>

      {/* Banner de destaque */}
      {highlight && (
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/40 via-zinc-950 to-blue-950/30 p-5 sm:p-8">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] sm:text-[11px] font-bold tracking-widest mb-3">
              <Sparkles className="w-3 h-3" /> DIFERENCIAL EXCLUSIVO
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 leading-tight">{highlight.title}</h2>
            <p className="text-zinc-300 text-xs sm:text-sm max-w-2xl leading-relaxed">{highlight.description}</p>
          </div>
        </div>
      )}

      {/* Lista de features */}
      {features.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((f, i) => (
            <div key={i} className="group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 hover:border-emerald-500/40 transition">
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <div className="font-semibold text-white text-sm">{f.title}</div>
                  <p className="text-zinc-400 text-xs mt-1 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Aviso modo demo + CTA */}
      <div className="relative overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-950/30 to-zinc-950 p-6">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="shrink-0 w-11 h-11 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center justify-center">
            <Zap className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1 min-w-[260px]">
            <h3 className="text-base font-semibold text-white mb-1">Visualização indisponível no modo demo</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Esta funcionalidade está 100% implementada e disponível no sistema real.
              No modo demo apresentamos apenas uma amostra resumida.
              <br/><br/>
              Após o <strong className="text-amber-300">pré-contrato</strong>, você recebe uma demonstração prática ao vivo com seus próprios dados.
            </p>
          </div>
          <a
            href="https://wa.me/5511915322526?text=Ol%C3%A1!%20Vi%20a%20demonstra%C3%A7%C3%A3o%20do%20HELP4PRIME%20MVNO%20e%20gostaria%20de%20conversar%20sobre%20os%20pr%C3%B3ximos%20passos."
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-sm font-semibold rounded-lg transition shadow-lg shadow-emerald-500/20"
            data-testid="demo-cta-whats"
          >
            <MessageCircle className="w-4 h-4" /> Falar no WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
