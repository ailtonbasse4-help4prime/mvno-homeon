import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Lock, Play, Zap } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const DEMO_PASSWORD = 'help4prime';
const DEMO_AUTH_KEY = 'demo_authed_v1';

export default function DemoLogin() {
  const navigate = useNavigate();
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    // Registra visita ao carregar a tela de login
    axios.post(`${API_URL}/api/demo/access`, { path: '/demo' }).catch(() => {});
    // Se ja autenticado, pula direto
    if (sessionStorage.getItem(DEMO_AUTH_KEY) === 'yes') navigate('/demo/dashboard');
  }, [navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pwd.trim().toLowerCase() === DEMO_PASSWORD) {
      sessionStorage.setItem(DEMO_AUTH_KEY, 'yes');
      navigate('/demo/dashboard');
    } else {
      setErr('Senha incorreta. Dica: help4prime');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)', backgroundSize: '32px 32px' }} />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-4">
            <Zap className="w-3.5 h-3.5" /> DEMONSTRAÇÃO AO VIVO
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">HELP4PRIME <span className="text-emerald-400">MVNO</span></h1>
          <p className="text-zinc-400 text-sm">Sistema completo de gestão de operadora móvel</p>
        </div>

        <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <Lock className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Acesso restrito</h2>
              <p className="text-xs text-zinc-400">Digite a senha da demonstração</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Senha</label>
              <input
                type="password" value={pwd} onChange={e => { setPwd(e.target.value); setErr(''); }}
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:border-emerald-500 focus:outline-none transition"
                placeholder="Digite a senha da demonstração"
                data-testid="demo-password-input"
                autoFocus
              />
              {err && <p className="text-red-400 text-xs mt-2">{err}</p>}
            </div>
            <button type="submit" className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20" data-testid="demo-submit-btn">
              <Play className="w-4 h-4" /> Entrar na Demonstração
            </button>
          </form>

          <p className="text-xs text-zinc-500 text-center mt-6">
            Dados 100% fictícios para fins de apresentação. Não há vínculo com o sistema em produção.
          </p>
        </div>

        <div className="text-center mt-6 text-xs text-zinc-600">
          Quer conhecer mais? <a href="https://wa.me/5511915322526" className="text-emerald-400 hover:underline">Fale com a gente no WhatsApp</a>
        </div>
      </div>
    </div>
  );
}
