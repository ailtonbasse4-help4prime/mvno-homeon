import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, MessageCircle, Sparkles, CheckCircle } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const LEAD_SENT_KEY = 'demo_lead_sent_v1';

/**
 * Modal de captura de lead. Aparece UMA vez por sessao quando o visitante
 * acessa uma pagina marcada como DIFERENCIAL. Pode ser pulado.
 *
 * @param {string} interesse - nome do diferencial (ex: "ativacoes", "linhas", "self-service")
 */
export default function LeadCaptureModal({ interesse, titulo = 'Quer uma demonstração ao vivo?' }) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [whats, setWhats] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    // mostra apenas se ainda nao enviou lead nesta sessao
    if (sessionStorage.getItem(LEAD_SENT_KEY) === 'yes') return;
    const t = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(t);
  }, [interesse]);

  const fmtTel = (v) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    const nomeTrim = nome.trim();
    const digits = whats.replace(/\D/g, '');
    if (nomeTrim.length < 2) { setErr('Informe seu nome'); return; }
    if (digits.length < 10) { setErr('WhatsApp inválido. Use DDD + número'); return; }
    setSending(true);
    try {
      await axios.post(`${API_URL}/api/demo/lead`, {
        nome: nomeTrim, whatsapp: digits, interesse,
      });
      sessionStorage.setItem(LEAD_SENT_KEY, 'yes');
      setDone(true);
    } catch (e2) {
      setErr(e2.response?.data?.detail || 'Erro ao enviar, tente novamente');
    }
    setSending(false);
  };

  const skip = () => {
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" data-testid="lead-modal">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={skip} />
      <div className="relative w-full max-w-md bg-gradient-to-br from-zinc-900 to-zinc-950 border border-emerald-500/30 rounded-2xl shadow-2xl overflow-hidden">
        {/* Glows decorativos */}
        <div className="absolute -top-16 -right-16 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <button onClick={skip} className="absolute top-3 right-3 p-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 z-10" aria-label="Fechar" data-testid="lead-modal-skip">
          <X className="w-4 h-4" />
        </button>

        <div className="relative p-6 sm:p-8">
          {done ? (
            <div className="text-center py-6">
              <div className="inline-flex w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/40 items-center justify-center mb-4">
                <CheckCircle className="w-7 h-7 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Recebemos seu contato!</h3>
              <p className="text-zinc-400 text-sm mb-4">Em breve retornaremos via WhatsApp para agendar sua demonstração ao vivo.</p>
              <button onClick={skip} className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold rounded-lg transition">
                Continuar explorando
              </button>
            </div>
          ) : (
            <>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold tracking-widest mb-3">
                <Sparkles className="w-3 h-3" /> DEMONSTRAÇÃO AO VIVO
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 leading-tight">{titulo}</h3>
              <p className="text-zinc-400 text-sm mb-5 leading-relaxed">
                Deixe seu contato e nossa equipe retorna via WhatsApp para apresentar essa funcionalidade com seus próprios dados, sem compromisso.
              </p>

              <form onSubmit={submit} className="space-y-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Nome</label>
                  <input
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white text-sm focus:border-emerald-500 focus:outline-none transition"
                    data-testid="lead-nome-input"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">WhatsApp</label>
                  <input
                    type="tel"
                    value={whats}
                    onChange={(e) => setWhats(fmtTel(e.target.value))}
                    placeholder="(11) 91234-5678"
                    className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white text-sm focus:border-emerald-500 focus:outline-none transition"
                    data-testid="lead-whats-input"
                  />
                </div>
                {err && <p className="text-red-400 text-xs">{err}</p>}

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button
                    type="button" onClick={skip}
                    className="sm:flex-1 px-4 py-2.5 text-zinc-400 hover:text-white text-sm transition order-2 sm:order-1"
                    data-testid="lead-modal-pular"
                  >
                    Pular, quero continuar vendo
                  </button>
                  <button
                    type="submit" disabled={sending}
                    className="sm:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-sm font-semibold rounded-lg transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 order-1 sm:order-2"
                    data-testid="lead-modal-enviar"
                  >
                    <MessageCircle className="w-4 h-4" /> {sending ? 'Enviando...' : 'Quero conhecer'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
