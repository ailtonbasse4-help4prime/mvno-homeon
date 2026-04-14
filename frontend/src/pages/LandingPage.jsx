import { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  Phone, Users, Receipt, QrCode, Smartphone, Store, Mail,
  Shield, RefreshCw, BarChart3, Zap, ChevronRight, MessageCircle,
  Check, ArrowRight, MonitorSmartphone, Clock,
} from 'lucide-react';
import { MockDashboard, MockClientes, MockCobrancas, MockAtivacoes } from '../components/LandingMockups';

const WA_LINK = 'https://wa.me/5511915322526?text=Olá! Tenho interesse no sistema HELP4PRIME MVNO.';
const WA_NUMBER = '(11) 91532-2526';

const features = [
  { icon: Users, title: 'Gestao de Clientes', desc: 'Cadastro completo com CPF, linhas, planos e status. Sincronizacao direta com a operadora.', span: 'md:col-span-4' },
  { icon: Receipt, title: 'Cobrancas Integradas (Asaas)', desc: 'Boletos, PIX e cartao. Envio automatico por email e WhatsApp. Controle de inadimplencia.', span: 'md:col-span-8' },
  { icon: QrCode, title: 'Ativacao Self-Service', desc: 'QR Code para ativacao automatica pelo proprio cliente. Pagamento online integrado.', span: 'md:col-span-6' },
  { icon: Smartphone, title: 'Portal do Cliente (PWA)', desc: 'App instalavel no celular. Consulta de saldo, consumo de dados e faturas em tempo real.', span: 'md:col-span-6' },
  { icon: Store, title: 'Rede de Revendedores', desc: 'Gestao de revendedores com chips vinculados, descontos e cartoes de ativacao imprimiveis.', span: 'md:col-span-8' },
  { icon: Mail, title: 'Notificacoes por Email', desc: 'Emails automaticos via Gmail com layout profissional para cobrancas e ativacoes.', span: 'md:col-span-4' },
];

const extraFeatures = [
  { icon: Shield, text: 'Seguranca Avancada' },
  { icon: RefreshCw, text: 'Retry Automatico' },
  { icon: BarChart3, text: 'Dashboard Completo' },
  { icon: Zap, text: 'API Real da Operadora' },
  { icon: Clock, text: 'Backup Diario' },
  { icon: MonitorSmartphone, text: 'Responsivo' },
];

const screenshots = [
  { component: MockDashboard, label: 'Dashboard' },
  { component: MockClientes, label: 'Clientes' },
  { component: MockCobrancas, label: 'Cobrancas' },
  { component: MockAtivacoes, label: 'Ativacoes' },
];

function FadeIn({ children, className = '', delay = 0 }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.4, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-zinc-950/80 backdrop-blur-xl border-b border-white/10 shadow-2xl' : 'bg-transparent'
    }`} data-testid="landing-navbar">
      <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-between h-16 md:h-20">
        <a href="#hero" className="flex items-center gap-2">
          <Phone className="w-6 h-6 text-blue-500" />
          <span className="font-['Outfit'] font-black text-white text-lg tracking-tight">HELP4PRIME</span>
          <span className="text-zinc-500 text-sm font-['Manrope'] hidden sm:inline">MVNO</span>
        </a>
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-zinc-400 hover:text-white text-sm font-['Manrope'] font-medium transition-colors">Funcionalidades</a>
          <a href="#screenshots" className="text-zinc-400 hover:text-white text-sm font-['Manrope'] font-medium transition-colors">Sistema</a>
          <a href="#pricing" className="text-zinc-400 hover:text-white text-sm font-['Manrope'] font-medium transition-colors">Planos</a>
        </div>
        <a href={WA_LINK} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 bg-[#25D366] text-zinc-950 px-5 py-2.5 rounded-full text-sm font-['Manrope'] font-bold hover:bg-[#1DA851] transition-all hover:scale-105"
          data-testid="navbar-whatsapp-btn">
          <MessageCircle className="w-4 h-4" /> Fale Conosco
        </a>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section id="hero" className="relative min-h-screen flex items-center overflow-hidden" data-testid="hero-section">
      <div className="absolute inset-0 bg-zinc-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(59,130,246,0.15),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_80%_at_80%_50%,rgba(59,130,246,0.08),transparent)]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 pt-24 md:pt-32 pb-16 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-blue-500 font-['Manrope'] mb-6">
                <Zap className="w-3.5 h-3.5" /> Sistema Completo para MVNOs
              </span>
            </motion.div>

            <motion.h1
              className="font-['Outfit'] font-black text-4xl sm:text-5xl lg:text-6xl text-white leading-none tracking-tight mb-6"
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
            >
              Gerencie sua
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">operadora movel</span>
              <br />
              em um so lugar
            </motion.h1>

            <motion.p
              className="text-lg text-zinc-400 font-['Manrope'] leading-relaxed max-w-lg mb-8"
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
            >
              Dashboard administrativo, portal do cliente, cobrancas automaticas,
              ativacao por QR Code e muito mais. Tudo integrado com sua operadora e gateway de pagamento.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-4"
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
            >
              <a href={WA_LINK} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-[#25D366] text-zinc-950 px-8 py-4 rounded-full text-base font-['Manrope'] font-bold hover:bg-[#1DA851] transition-all hover:scale-105 shadow-lg shadow-green-500/20"
                data-testid="hero-whatsapp-btn">
                <MessageCircle className="w-5 h-5" /> Fale no WhatsApp
              </a>
              <a href="#screenshots"
                className="inline-flex items-center justify-center gap-2 bg-zinc-900 text-white border border-white/10 px-8 py-4 rounded-full text-base font-['Manrope'] font-semibold hover:bg-zinc-800 transition-all"
                data-testid="hero-demo-btn">
                Ver Sistema <ArrowRight className="w-4 h-4" />
              </a>
            </motion.div>

            <motion.div
              className="flex items-center gap-6 mt-10 text-zinc-500 text-sm font-['Manrope']"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.5 }}
            >
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-blue-500" /> API Real</span>
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-blue-500" /> Asaas</span>
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-blue-500" /> PWA</span>
            </motion.div>
          </div>

          <motion.div
            className="hidden lg:block"
            initial={{ opacity: 0, x: 60, rotateY: -8 }} animate={{ opacity: 1, x: 0, rotateY: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 to-blue-600/10 rounded-3xl blur-2xl" />
              <div className="relative">
                <MockDashboard />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="relative py-24 md:py-32" data-testid="features-section">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <FadeIn>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-blue-500 font-['Manrope']">Funcionalidades</span>
          <h2 className="font-['Outfit'] font-bold text-3xl md:text-4xl text-white tracking-tight mt-3 mb-4">
            Tudo que voce precisa para gerenciar sua MVNO
          </h2>
          <p className="text-zinc-400 font-['Manrope'] text-lg max-w-2xl mb-12">
            Um sistema completo e integrado, do cadastro do cliente ate a cobranca automatica.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <FadeIn key={i} className={`${f.span}`} delay={i * 0.08}>
                <div className="h-full bg-zinc-900/50 border border-white/10 rounded-2xl md:rounded-3xl p-8 hover:-translate-y-1 transition-transform duration-300 group">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-5 group-hover:bg-blue-500/20 transition-colors">
                    <Icon className="w-6 h-6 text-blue-400" />
                  </div>
                  <h3 className="font-['Outfit'] font-bold text-xl text-white mb-2">{f.title}</h3>
                  <p className="text-zinc-400 font-['Manrope'] text-sm leading-relaxed">{f.desc}</p>
                </div>
              </FadeIn>
            );
          })}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 mt-12">
          {extraFeatures.map((f, i) => {
            const Icon = f.icon;
            return (
              <FadeIn key={i} delay={i * 0.05}>
                <div className="flex flex-col items-center gap-2 py-5 px-3 bg-zinc-900/30 border border-white/5 rounded-xl text-center">
                  <Icon className="w-5 h-5 text-blue-400" />
                  <span className="text-zinc-300 text-xs font-['Manrope'] font-medium">{f.text}</span>
                </div>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Screenshots() {
  const [active, setActive] = useState(0);
  return (
    <section id="screenshots" className="relative py-24 md:py-32 overflow-hidden" data-testid="screenshots-section">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(59,130,246,0.06),transparent)]" />
      <div className="relative max-w-7xl mx-auto px-6 md:px-12">
        <FadeIn>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-blue-500 font-['Manrope']">Sistema</span>
          <h2 className="font-['Outfit'] font-bold text-3xl md:text-4xl text-white tracking-tight mt-3 mb-4">
            Conhca o sistema por dentro
          </h2>
          <p className="text-zinc-400 font-['Manrope'] text-lg max-w-2xl mb-10">
            Interface moderna, escura e intuitiva. Projetada para operacao rapida e eficiente.
          </p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
            {screenshots.map((s, i) => (
              <button key={i} onClick={() => setActive(i)}
                className={`px-5 py-2.5 rounded-full text-sm font-['Manrope'] font-medium transition-all whitespace-nowrap ${
                  active === i
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-zinc-900 text-zinc-400 border border-white/10 hover:text-white'
                }`}
                data-testid={`screenshot-tab-${i}`}>
                {s.label}
              </button>
            ))}
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-b from-blue-500/10 to-transparent rounded-3xl blur-2xl" />
            <div className="relative">
              {(() => { const Comp = screenshots[active].component; return <Comp />; })()}
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="relative py-24 md:py-32" data-testid="pricing-section">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <FadeIn>
          <div className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-blue-500 font-['Manrope']">Planos</span>
            <h2 className="font-['Outfit'] font-bold text-3xl md:text-4xl text-white tracking-tight mt-3 mb-4">
              Escolha o melhor plano para sua operacao
            </h2>
            <p className="text-zinc-400 font-['Manrope'] text-lg max-w-xl mx-auto">
              Sistema completo com todas as funcionalidades incluidas. Sem taxas extras.
            </p>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <FadeIn delay={0.1}>
            <div className="relative bg-zinc-900/50 border border-white/10 rounded-3xl p-8 md:p-10 flex flex-col h-full">
              <h3 className="font-['Outfit'] font-bold text-2xl text-white mb-2">Contrato 12 Meses</h3>
              <p className="text-zinc-500 font-['Manrope'] text-sm mb-8">Flexibilidade com compromisso menor</p>
              <div className="mb-8">
                <span className="font-['Outfit'] font-black text-5xl text-white">R$ 600</span>
                <span className="text-zinc-400 font-['Manrope'] text-base">/mes</span>
              </div>
              <ul className="space-y-3 mb-10 flex-1">
                {['Todas as funcionalidades', 'Portal do Cliente PWA', 'Cobrancas automaticas', 'Suporte por WhatsApp', 'Atualizacoes incluidas'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-zinc-300 font-['Manrope'] text-sm">
                    <Check className="w-4 h-4 text-blue-500 flex-shrink-0" /> {item}
                  </li>
                ))}
              </ul>
              <a href={WA_LINK} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-zinc-800 text-white border border-white/10 py-4 rounded-full font-['Manrope'] font-semibold hover:bg-zinc-700 transition-all"
                data-testid="pricing-12m-btn">
                Contratar <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="relative bg-zinc-900/50 border-2 border-blue-500/50 rounded-3xl p-8 md:p-10 flex flex-col h-full shadow-xl shadow-blue-500/5">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="bg-blue-500 text-white text-xs font-['Manrope'] font-bold px-4 py-1.5 rounded-full uppercase tracking-wider">
                  Melhor Valor
                </span>
              </div>
              <h3 className="font-['Outfit'] font-bold text-2xl text-white mb-2">Contrato 24 Meses</h3>
              <p className="text-zinc-500 font-['Manrope'] text-sm mb-8">Economia de R$ 1.200/ano</p>
              <div className="mb-2">
                <span className="font-['Outfit'] font-black text-5xl text-white">R$ 500</span>
                <span className="text-zinc-400 font-['Manrope'] text-base">/mes</span>
              </div>
              <p className="text-blue-400 font-['Manrope'] text-sm font-medium mb-8">Economize R$ 100/mes</p>
              <ul className="space-y-3 mb-10 flex-1">
                {['Todas as funcionalidades', 'Portal do Cliente PWA', 'Cobrancas automaticas', 'Suporte prioritario', 'Atualizacoes incluidas', 'Setup e configuracao gratis'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-zinc-300 font-['Manrope'] text-sm">
                    <Check className="w-4 h-4 text-blue-500 flex-shrink-0" /> {item}
                  </li>
                ))}
              </ul>
              <a href={WA_LINK} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-[#25D366] text-zinc-950 py-4 rounded-full font-['Manrope'] font-bold hover:bg-[#1DA851] transition-all hover:scale-[1.02]"
                data-testid="pricing-24m-btn">
                <MessageCircle className="w-5 h-5" /> Contratar pelo WhatsApp
              </a>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/10 py-12" data-testid="landing-footer">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-blue-500" />
            <span className="font-['Outfit'] font-bold text-white">HELP4PRIME MVNO</span>
          </div>
          <div className="flex items-center gap-6 text-zinc-500 text-sm font-['Manrope']">
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1.5">
              <MessageCircle className="w-4 h-4" /> {WA_NUMBER}
            </a>
          </div>
          <p className="text-zinc-600 text-xs font-['Manrope']">
            HELP4PRIME MVNO - Todos os direitos reservados
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="bg-zinc-950 min-h-screen text-white" data-testid="landing-page">
      <Navbar />
      <Hero />
      <Features />
      <Screenshots />
      <Pricing />
      <Footer />

      {/* WhatsApp FAB */}
      <a href={WA_LINK} target="_blank" rel="noopener noreferrer"
        className="fixed bottom-8 right-8 z-50 rounded-full p-4 bg-[#25D366] text-zinc-950 shadow-lg shadow-green-500/30 hover:scale-110 transition-transform"
        data-testid="whatsapp-fab"
        aria-label="WhatsApp">
        <MessageCircle className="w-6 h-6" />
      </a>
    </div>
  );
}
