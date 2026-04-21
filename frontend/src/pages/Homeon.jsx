import { useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Check, ShoppingBag, MessageCircle, Signal, MapPin, Phone,
  Wifi, Globe, Repeat, Smartphone, Star, Zap,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Portfolio publico /homeon — acesso livre, sem login.
 * Vende planos moveis HOMEON via Shopee. Identidade: azul marinho + laranja.
 */

const PHONE_DISPLAY = '(19) 97005-1397';
const PHONE_DIGITS = '5519970051397';
const WHATS_MSG = 'Olá! Tenho interesse nos planos HomeOn Internet Móvel. Pode me ajudar?';
const ENDERECO = 'Av. José Ribeiro de Oliveira, 2450 — Jardim Alvorada, Santa Rita do Passa Quatro/SP';

const PLANOS = [
  {
    id: 'start', nome: 'START', gb: '10GB', preco: '39,99',
    subtitle: 'Ideal para WhatsApp e navegação leve',
    cor: 'from-sky-500 to-sky-600', badge: 'Entrada',
    shopee: 'https://br.shp.ee/YDasjNFN',
  },
  {
    id: 'plus', nome: 'PLUS', gb: '15GB', preco: '49,99',
    subtitle: 'Ideal para redes sociais e uso moderado',
    cor: 'from-indigo-500 to-indigo-600',
    shopee: 'https://br.shp.ee/WudDZ9HQ',
  },
  {
    id: 'smart', nome: 'SMART', gb: '20GB', preco: '59,99',
    subtitle: 'Ideal para quem usa bastante internet no dia a dia',
    cor: 'from-amber-500 to-orange-500', badge: 'Mais vendido', destaque: true,
    shopee: 'https://br.shp.ee/3dkvxh62',
  },
  {
    id: 'power', nome: 'POWER', gb: '30GB', preco: '65,99',
    subtitle: 'Ideal para vídeos, trabalho e uso intenso',
    cor: 'from-rose-500 to-rose-600',
    shopee: 'https://br.shp.ee/HWRi3Tce',
  },
  {
    id: 'ultra', nome: 'ULTRA', gb: '40GB', preco: '79,99',
    subtitle: 'Para quem consome muito conteúdo online',
    cor: 'from-violet-500 to-violet-600',
    shopee: 'https://br.shp.ee/CdgGcGgb',
  },
  {
    id: 'max', nome: 'MAX', gb: '50GB', preco: '85,99',
    subtitle: 'Máximo de internet sem preocupação',
    cor: 'from-zinc-700 to-zinc-900',
    shopee: 'https://br.shp.ee/qsfbD9Vq',
  },
];

const BENEFICIOS = [
  { icon: Signal, label: 'Dupla cobertura TIM + VIVO' },
  { icon: MessageCircle, label: 'WhatsApp ilimitado' },
  { icon: MapPin, label: 'Waze e GPS ilimitados' },
  { icon: Repeat, label: 'Uber ilimitado' },
  { icon: Phone, label: '1.000 minutos de ligações' },
  { icon: Wifi, label: '300 SMS' },
  { icon: Globe, label: 'Cobertura nacional' },
  { icon: Zap, label: 'Portabilidade gratuita' },
  { icon: Smartphone, label: 'Portal do Cliente exclusivo' },
];

function PlanoCard({ plano, onClickContratar }) {
  const isDestaque = plano.destaque;
  return (
    <div
      className={`relative group rounded-3xl overflow-hidden transition-all duration-300 ${
        isDestaque
          ? 'bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border-2 border-amber-500/60 shadow-2xl shadow-amber-500/20 lg:scale-105'
          : 'bg-white/[0.02] border border-white/10 hover:border-orange-500/40 hover:bg-white/[0.04]'
      }`}
      data-testid={`plano-card-${plano.id}`}
    >
      {plano.badge && (
        <div className={`absolute top-0 right-0 px-4 py-1.5 text-[11px] font-bold tracking-wider text-white rounded-bl-2xl z-10 ${
          isDestaque ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-blue-950/80 border-b border-l border-white/10'
        }`}>
          {isDestaque && <Star className="w-3 h-3 inline mr-1 -mt-0.5" />}
          {plano.badge}
        </div>
      )}

      <div className="p-6 sm:p-8">
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${plano.cor} text-white text-xs font-bold mb-4 shadow-lg`}>
          HOMEON {plano.nome}
        </div>

        <div className="mb-5">
          <div className="flex items-baseline gap-1">
            <span className="text-5xl sm:text-6xl font-black text-white leading-none tracking-tight">{plano.gb}</span>
          </div>
          <p className="text-sm text-white/60 mt-2 leading-snug">{plano.subtitle}</p>
        </div>

        <div className="mb-6 pb-6 border-b border-white/10">
          <div className="flex items-baseline gap-1">
            <span className="text-xs text-white/50 font-semibold">R$</span>
            <span className="text-4xl sm:text-5xl font-black text-white leading-none">{plano.preco}</span>
            <span className="text-sm text-white/60 ml-1">/mês</span>
          </div>
        </div>

        <ul className="space-y-2 mb-6 text-sm">
          {['Dupla cobertura TIM + VIVO', 'WhatsApp ilimitado', 'Waze e Uber ilimitados', '1000 min + 300 SMS', 'Sem fidelidade'].map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-white/80">
              <Check className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" /> {f}
            </li>
          ))}
        </ul>

        <a
          href={plano.shopee}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onClickContratar(plano)}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all duration-300 ${
            isDestaque
              ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white shadow-xl shadow-orange-500/30 hover:shadow-orange-500/50 hover:-translate-y-0.5'
              : 'bg-white/10 hover:bg-orange-500 text-white border border-white/20 hover:border-orange-500 hover:-translate-y-0.5'
          }`}
          data-testid={`btn-contratar-${plano.id}`}
        >
          <ShoppingBag className="w-4 h-4" /> Assinar pela Shopee
        </a>
      </div>
    </div>
  );
}

export default function Homeon() {
  const planosRef = useRef(null);

  useEffect(() => {
    document.title = 'HomeOn Internet — Planos Móveis com WhatsApp Ilimitado';
  }, []);

  const trackClick = (planoId, source) => {
    // fire-and-forget — nao bloqueia a abertura da Shopee
    axios.post(`${API_URL}/api/homeon/click`, { plano: planoId, source }).catch(() => {});
  };

  const contratar = (plano) => {
    trackClick(plano.id, 'card');
    // navegacao e feita pelo <a href target="_blank"> nativo — sem popup blocker
  };

  const scrollToPlanos = () => {
    planosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a1a3a] via-[#0a1228] to-[#050914] text-white font-sans">
      {/* Glows decorativos */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-orange-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[160px] pointer-events-none" />

      {/* Navbar */}
      <header className="relative z-20 border-b border-white/5 backdrop-blur-md bg-[#0a1a3a]/50 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-xl px-3 py-1.5 shadow-lg">
              <img src="/homeon-assets/logo.png" alt="HomeOn Internet" className="h-7 sm:h-9 w-auto" />
            </div>
          </div>
          <button
            onClick={scrollToPlanos}
            className="px-4 sm:px-5 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white text-xs sm:text-sm font-bold shadow-lg shadow-orange-500/30 transition"
            data-testid="nav-ver-planos"
          >
            Ver Planos
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-12">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-[11px] font-bold tracking-widest mb-6">
              <Signal className="w-3 h-3" /> DUPLA COBERTURA TIM + VIVO
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight mb-5">
              Internet Móvel com{' '}
              <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                WhatsApp Ilimitado
              </span>
            </h1>
            <p className="text-white/70 text-base sm:text-lg leading-relaxed mb-8 max-w-xl">
              Planos a partir de <strong className="text-white">R$ 39,99/mês</strong> com Waze, Uber, WhatsApp ilimitados e 1.000 minutos para ligações.
              Mais sinal, mais internet, mais liberdade — sem fidelidade.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={scrollToPlanos}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold shadow-xl shadow-orange-500/30 hover:-translate-y-0.5 transition-all"
                data-testid="hero-cta-planos"
              >
                <ShoppingBag className="w-5 h-5" /> Ver planos
              </button>
              <a
                href={`https://wa.me/${PHONE_DIGITS}?text=${encodeURIComponent(WHATS_MSG)}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white/5 border border-white/15 hover:border-orange-400 hover:bg-white/10 text-white font-bold transition"
                data-testid="hero-cta-whats"
              >
                <MessageCircle className="w-5 h-5" /> Falar no WhatsApp
              </a>
            </div>

            <div className="mt-8 flex items-center gap-6 text-xs text-white/50">
              <div className="flex items-center gap-2"><Check className="w-4 h-4 text-orange-400" /> Sem fidelidade</div>
              <div className="flex items-center gap-2"><Check className="w-4 h-4 text-orange-400" /> Portabilidade grátis</div>
              <div className="flex items-center gap-2"><Check className="w-4 h-4 text-orange-400" /> Envio pra todo o Brasil</div>
            </div>
          </div>

          {/* Cartao hero */}
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-orange-500/20 to-amber-500/20 blur-3xl rounded-3xl" />
            <div className="relative bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 rounded-3xl p-7 sm:p-9 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-5">
                <span className="text-xs font-bold text-orange-400 tracking-widest">A PARTIR DE</span>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-white/40 line-through text-xl">R$ 49,99</span>
              </div>
              <div className="flex items-baseline mb-6">
                <span className="text-sm text-white/60 mt-4 mr-1">R$</span>
                <span className="text-7xl sm:text-8xl font-black text-white leading-none tracking-tighter">
                  39<span className="text-4xl text-orange-400">,99</span>
                </span>
                <span className="text-white/60 ml-2 self-end mb-3">/mês</span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {['10GB de internet', '1000 min ligações', '300 SMS', 'WhatsApp ilimitado', 'Waze ilimitado', 'Uber ilimitado'].map((b, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-white/80">
                    <Check className="w-4 h-4 text-orange-400 shrink-0" /> {b}
                  </div>
                ))}
              </div>
              <a
                href="https://br.shp.ee/YDasjNFN" target="_blank" rel="noopener noreferrer"
                onClick={() => trackClick('hero', 'hero')}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold shadow-xl shadow-orange-500/30 transition"
                data-testid="hero-card-shopee"
              >
                <ShoppingBag className="w-5 h-5" /> Compre pela Shopee
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Beneficios */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-black mb-2">Tudo isso incluso em todos os planos</h2>
          <p className="text-white/60 text-sm">Sem pegadinhas, sem taxas escondidas.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {BENEFICIOS.map((b, i) => (
            <div key={i} className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/10 hover:border-orange-500/40 hover:bg-white/[0.04] transition">
              <div className="shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/10 border border-orange-500/30 flex items-center justify-center">
                <b.icon className="w-4 h-4 text-orange-400" />
              </div>
              <span className="text-sm font-medium text-white/90">{b.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Planos */}
      <section ref={planosRef} className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16" id="planos">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-[11px] font-bold tracking-widest mb-4">
            <Zap className="w-3 h-3" /> ESCOLHA SEU PLANO
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-3 tracking-tight">
            Planos para todo <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">perfil de uso</span>
          </h2>
          <p className="text-white/60 text-sm sm:text-base max-w-xl mx-auto">
            Clique em "Assinar pela Shopee" e finalize seu pedido com segurança. Entrega para todo o Brasil.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {PLANOS.map((p) => (
            <PlanoCard key={p.id} plano={p} onClickContratar={contratar} />
          ))}
        </div>
      </section>

      {/* Por que escolher */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="relative overflow-hidden rounded-3xl border border-orange-500/30 bg-gradient-to-br from-orange-500/5 via-[#0a1a3a]/40 to-transparent p-8 sm:p-12">
          <div className="absolute -top-32 -right-32 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="relative grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70 text-[11px] font-bold tracking-widest mb-4">
                <Signal className="w-3 h-3 text-orange-400" /> POR QUE HOMEON?
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black mb-4 leading-tight">
                Duas redes ao mesmo tempo.<br />
                <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">Zero dor de cabeça.</span>
              </h2>
              <p className="text-white/70 text-sm sm:text-base leading-relaxed">
                Diferente das operadoras tradicionais, o chip HomeOn escolhe automaticamente a melhor rede entre TIM e VIVO, garantindo mais cobertura, menos queda de sinal e melhor desempenho onde você estiver.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { t: 'Mais cobertura', d: 'TIM + VIVO ao mesmo tempo' },
                { t: 'Menos queda', d: 'Troca automática de rede' },
                { t: 'Sem fidelidade', d: 'Cancele quando quiser' },
                { t: 'Todo o Brasil', d: 'Enviamos pra qualquer lugar' },
              ].map((i, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                  <div className="font-bold text-white text-sm mb-1">{i.t}</div>
                  <div className="text-xs text-white/60">{i.d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black mb-4">
            Ainda com dúvidas? <span className="text-orange-400">Fale com a gente.</span>
          </h2>
          <p className="text-white/60 text-sm mb-6">Atendimento humano via WhatsApp, sem robô.</p>
          <a
            href={`https://wa.me/${PHONE_DIGITS}?text=${encodeURIComponent(WHATS_MSG)}`}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold text-base shadow-xl shadow-emerald-500/30 hover:-translate-y-0.5 transition-all"
            data-testid="cta-whats-final"
          >
            <MessageCircle className="w-5 h-5" /> {PHONE_DISPLAY}
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 bg-black/30 backdrop-blur-sm mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid md:grid-cols-3 gap-6 text-sm">
          <div>
            <div className="inline-block bg-white rounded-xl px-3 py-1.5 mb-3 shadow-lg">
              <img src="/homeon-assets/logo.png" alt="HomeOn" className="h-8 w-auto" />
            </div>
            <p className="text-white/50 text-xs leading-relaxed mt-2">
              Internet do seu jeito. Planos móveis com dupla cobertura TIM + VIVO, sem fidelidade.
            </p>
          </div>
          <div>
            <div className="text-white/80 font-bold mb-2 flex items-center gap-2"><Phone className="w-4 h-4 text-orange-400" /> Contato</div>
            <a href={`https://wa.me/${PHONE_DIGITS}`} target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-orange-400 transition">
              WhatsApp: {PHONE_DISPLAY}
            </a>
          </div>
          <div>
            <div className="text-white/80 font-bold mb-2 flex items-center gap-2"><MapPin className="w-4 h-4 text-orange-400" /> Endereço</div>
            <p className="text-white/60 text-xs leading-relaxed">{ENDERECO}</p>
          </div>
        </div>
        <div className="border-t border-white/5 py-4 text-center text-[11px] text-white/40">
          © {new Date().getFullYear()} HomeOn Internet — Todos os direitos reservados
        </div>
      </footer>

      {/* Botao flutuante WhatsApp */}
      <a
        href={`https://wa.me/${PHONE_DIGITS}?text=${encodeURIComponent(WHATS_MSG)}`}
        target="_blank" rel="noopener noreferrer"
        aria-label="Falar no WhatsApp"
        className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 flex items-center justify-center shadow-2xl shadow-emerald-500/40 hover:scale-110 transition-transform"
        data-testid="fab-whats"
      >
        <MessageCircle className="w-6 h-6 text-white" />
      </a>
    </div>
  );
}
