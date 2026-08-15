import { useEffect } from 'react';
import {
  Check, MessageCircle, Zap, Users, ShieldCheck, TrendingUp, Smartphone,
  CreditCard, Bell, LayoutDashboard, QrCode, FileText, PhoneCall, MapPin,
} from 'lucide-react';

/**
 * Portfolio publico /help4prime — vitrine do sistema MVNO Help4Prime.
 * Para divulgacao em redes sociais e captacao de operadoras/revendedores parceiros.
 */

const PHONE_DISPLAY = '(19) 92005-1397';
const PHONE_DIGITS = '5519920051397';
const WHATS_MSG = 'Olá! Tenho interesse na plataforma Help4Prime MVNO. Pode me passar mais informações?';
const ENDERECO = 'Santa Rita do Passa Quatro / SP';

const FEATURES = [
  { icon: LayoutDashboard, title: 'Dashboard Financeiro', desc: 'Custos, lucro por linha, planilha operacional em tempo real. Você sabe exatamente quanto ganha em cada cliente.' },
  { icon: QrCode, title: 'Ativação Self-Service', desc: 'Cliente escaneia o QR do chip, cadastra dados e ativa sozinho. Sem contato humano, 24/7.' },
  { icon: CreditCard, title: 'Cobrança Automatizada', desc: 'Geração em massa de boletos PIX via Asaas. Cobrança recorrente sem esforço manual.' },
  { icon: MessageCircle, title: 'WhatsApp em Massa (Z-API)', desc: 'Envio de cobranças, avisos e ativações direto pelo WhatsApp. Comunicação profissional anti-banimento.' },
  { icon: ShieldCheck, title: 'Bloqueio Automático D-2', desc: 'Sistema bloqueia inadimplentes 2 dias antes da renovação Tá Telecom. Você não paga por linha morta.' },
  { icon: Bell, title: 'Lembretes Escalonados', desc: 'D-3 (aviso preventivo), D-0 (vence hoje), D-Bloqueio (execução). Cliente sempre informado.' },
  { icon: Smartphone, title: 'Portal do Cliente (PWA)', desc: 'Instalável no celular. Cliente consulta faturas, saldo, boletos e paga com 1 clique.' },
  { icon: Users, title: 'Multi-Revendedor', desc: 'Gerencie sub-revendedores, comissões e planos próprios. Escale sem virar operadora.' },
  { icon: FileText, title: 'Portabilidade Integrada', desc: 'Cliente porta o número existente direto pelo QR. Sem preencher papel, sem loja física.' },
];

const PLANOS_DEMO = [
  {
    nome: 'STARTER', preco: '499', periodo: '/mês',
    subtitle: 'Para começar como MVNO',
    cor: 'from-sky-500 to-blue-600',
    features: ['Até 100 linhas ativas', 'Ativação self-service ilimitada', 'Cobrança Asaas integrada', 'Portal do cliente PWA', 'Suporte por WhatsApp'],
  },
  {
    nome: 'PROFISSIONAL', preco: '999', periodo: '/mês',
    subtitle: 'Operação em escala',
    destaque: true,
    cor: 'from-amber-500 to-orange-600',
    features: ['Até 500 linhas ativas', 'Tudo do Starter +', 'WhatsApp em massa (Z-API)', 'Bloqueio automático D-2', 'Dashboard financeiro completo', 'Portabilidade integrada'],
  },
  {
    nome: 'ENTERPRISE', preco: 'Sob consulta', periodo: '',
    subtitle: 'Volume ilimitado',
    cor: 'from-emerald-500 to-teal-600',
    features: ['Linhas ilimitadas', 'Tudo do Profissional +', 'Multi-revendedor', 'API personalizada', 'Domínio próprio', 'Suporte prioritário 24/7'],
  },
];

const NUMEROS = [
  { valor: '95%', label: 'Reducao no tempo de ativacao' },
  { valor: '3x', label: 'Mais eficiencia na cobranca' },
  { valor: '24/7', label: 'Cliente ativa sozinho' },
  { valor: '0', label: 'Linhas mortas na sua conta Ta' },
];

export default function Help4Prime() {
  useEffect(() => {
    document.title = 'Help4Prime MVNO — Plataforma completa para operadoras móveis';
    const meta = document.querySelector('meta[name="description"]') || document.createElement('meta');
    meta.setAttribute('name', 'description');
    meta.setAttribute('content', 'Plataforma completa para gestão de MVNO: ativação self-service, cobrança automatizada, bloqueio inteligente e mais.');
    document.head.appendChild(meta);
  }, []);

  const whatsUrl = `https://wa.me/${PHONE_DIGITS}?text=${encodeURIComponent(WHATS_MSG)}`;

  return (
    <div className="min-h-screen bg-zinc-950 text-white" data-testid="help4prime-portfolio">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 via-zinc-950 to-orange-900/30" />
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 25% 30%, rgba(59,130,246,0.3) 0%, transparent 40%), radial-gradient(circle at 75% 70%, rgba(249,115,22,0.25) 0%, transparent 45%)' }} />
        <div className="relative max-w-6xl mx-auto px-6 py-20 md:py-28 text-center">
          <div className="inline-block px-4 py-1.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-300 text-xs font-semibold mb-6" data-testid="hero-tag">
            PLATAFORMA COMPLETA PARA MVNO
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-white to-orange-400 bg-clip-text text-transparent">
            Help4Prime <span className="block text-3xl md:text-5xl mt-2 text-white/90">MVNO Manager</span>
          </h1>
          <p className="text-lg md:text-xl text-zinc-300 max-w-2xl mx-auto mb-8">
            A operação inteira da sua operadora móvel em um só lugar. Ativação, cobrança, bloqueio, portal do cliente — tudo automático.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <a href={whatsUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-500 transition-colors px-8 py-4 rounded-full text-white font-semibold text-base shadow-lg shadow-green-600/30"
              data-testid="hero-whatsapp-btn">
              <MessageCircle className="w-5 h-5" /> Falar no WhatsApp
            </a>
            <a href="/demo" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 transition-colors px-8 py-4 rounded-full text-white font-semibold text-base"
              data-testid="hero-demo-btn">
              <Zap className="w-5 h-5" /> Ver Demo Gratuito
            </a>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 max-w-3xl mx-auto">
            {NUMEROS.map((n, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl md:text-4xl font-bold bg-gradient-to-br from-orange-400 to-orange-600 bg-clip-text text-transparent">{n.valor}</div>
                <div className="text-xs md:text-sm text-zinc-400 mt-1">{n.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-6xl mx-auto px-6 py-16 md:py-24" id="funcionalidades">
        <div className="text-center mb-14">
          <div className="text-orange-400 text-xs font-semibold mb-2 tracking-widest">FUNCIONALIDADES</div>
          <h2 className="text-3xl md:text-5xl font-bold">Tudo que você precisa para operar</h2>
          <p className="text-zinc-400 mt-4 max-w-2xl mx-auto">Sistema pensado por quem opera um MVNO na prática. Sem enrolação, sem funções inúteis, tudo focado em resultado.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <div key={i} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 hover:border-orange-500/40 transition-colors" data-testid={`feature-${i}`}>
              <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-blue-500/20 to-orange-500/20 border border-blue-500/30 flex items-center justify-center mb-3">
                <f.icon className="w-5 h-5 text-orange-400" />
              </div>
              <h3 className="text-base font-semibold mb-1.5">{f.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PLANOS */}
      <section className="bg-gradient-to-b from-transparent via-zinc-900/50 to-transparent py-16 md:py-24" id="planos">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="text-orange-400 text-xs font-semibold mb-2 tracking-widest">INVESTIMENTO</div>
            <h2 className="text-3xl md:text-5xl font-bold">Planos que crescem com você</h2>
            <p className="text-zinc-400 mt-4">Sem taxa de setup. Sem fidelidade. Cancele quando quiser.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {PLANOS_DEMO.map((p, i) => (
              <div key={i} className={`relative bg-zinc-900/80 border-2 rounded-2xl p-6 flex flex-col ${p.destaque ? 'border-orange-500 shadow-2xl shadow-orange-500/20 md:scale-105' : 'border-zinc-800'}`}
                data-testid={`plano-${p.nome.toLowerCase()}`}>
                {p.destaque && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg">
                    MAIS ESCOLHIDO
                  </div>
                )}
                <div className={`h-1 -mx-6 -mt-6 mb-5 bg-gradient-to-r ${p.cor} rounded-t-2xl`} />
                <div className="text-xl font-bold">{p.nome}</div>
                <div className="text-xs text-zinc-500 mb-4">{p.subtitle}</div>
                <div className="mb-5">
                  {p.preco === 'Sob consulta' ? (
                    <div className="text-3xl font-bold">Sob consulta</div>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl text-zinc-500">R$</span>
                      <span className="text-5xl font-bold">{p.preco}</span>
                      <span className="text-zinc-500 text-sm">{p.periodo}</span>
                    </div>
                  )}
                </div>
                <ul className="space-y-2.5 mb-6 flex-1">
                  {p.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-zinc-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <a href={whatsUrl} target="_blank" rel="noopener noreferrer"
                  className={`text-center py-3 rounded-lg font-semibold transition-all ${p.destaque ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-400 hover:to-orange-500 shadow-lg shadow-orange-500/30' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                  data-testid={`plano-contratar-${p.nome.toLowerCase()}`}>
                  Contratar {p.nome}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DIFERENCIAIS */}
      <section className="max-w-4xl mx-auto px-6 py-16 md:py-20 text-center">
        <TrendingUp className="w-12 h-12 text-orange-400 mx-auto mb-4" />
        <h2 className="text-3xl md:text-4xl font-bold mb-4">Feito por quem opera. Pra quem opera.</h2>
        <p className="text-zinc-400 text-lg leading-relaxed max-w-2xl mx-auto">
          Não somos uma consultoria de tecnologia genérica. Somos uma operadora MVNO real que construiu essa plataforma pra resolver os próprios problemas — e agora compartilha com quem quer profissionalizar a operação sem pagar caro por gigantes engessados.
        </p>
      </section>

      {/* CTA FINAL */}
      <section className="bg-gradient-to-br from-blue-900 via-blue-950 to-orange-900 py-16 md:py-24" id="contato">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">Pronto para escalar sua operação?</h2>
          <p className="text-blue-100 text-lg mb-8">Fale conosco agora mesmo pelo WhatsApp. Resposta em minutos.</p>
          <a href={whatsUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-3 bg-green-600 hover:bg-green-500 transition-colors px-10 py-5 rounded-full text-white font-bold text-lg shadow-2xl shadow-green-600/40"
            data-testid="cta-whatsapp-btn">
            <MessageCircle className="w-6 h-6" /> {PHONE_DISPLAY}
          </a>
          <div className="mt-6 flex justify-center items-center gap-2 text-blue-200 text-sm">
            <MapPin className="w-4 h-4" /> {ENDERECO}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-zinc-800 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-zinc-500">
          <div>© {new Date().getFullYear()} Help4Prime — Todos os direitos reservados</div>
          <div className="flex items-center gap-4">
            <a href={whatsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-orange-400 transition-colors inline-flex items-center gap-1">
              <PhoneCall className="w-3.5 h-3.5" /> {PHONE_DISPLAY}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
