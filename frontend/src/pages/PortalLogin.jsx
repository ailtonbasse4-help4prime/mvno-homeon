import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Smartphone, Signal, Loader2 } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

function formatCPF(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function PortalLogin() {
  const [documento, setDocumento] = useState('');
  const [telefone, setTelefone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Check if already logged in
  const existing = sessionStorage.getItem('portal_token');
  if (existing) {
    const cliente = JSON.parse(sessionStorage.getItem('portal_cliente') || '{}');
    if (cliente.nome) {
      navigate('/portal/dashboard', { replace: true });
      return null;
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const docClean = documento.replace(/\D/g, '');
    const telClean = telefone.replace(/\D/g, '');

    if (docClean.length < 11) {
      setError('CPF deve ter 11 digitos.');
      return;
    }
    if (telClean.length < 10) {
      setError('Telefone deve ter pelo menos 10 digitos.');
      return;
    }

    setLoading(true);
    try {
      const resp = await axios.post(`${API_URL}/api/portal/login`, {
        documento: docClean,
        telefone: telClean,
      });
      const { token, cliente } = resp.data;
      sessionStorage.setItem('portal_token', token);
      sessionStorage.setItem('portal_cliente', JSON.stringify(cliente));
      navigate('/portal/dashboard');
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Erro ao fazer login. Verifique seus dados.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen login-bg flex">
      {/* Left panel */}
      <div
        className="hidden lg:flex lg:w-1/2 relative items-center justify-center"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1762267683517-6e9bc20675e9?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHwxfHxkYXJrJTIwdGVjaG5vbG9neSUyMGFic3RyYWN0JTIwZGF0YSUyMHNlcnZlcnxlbnwwfHx8fDE3NzQ5NzU3NDR8MA&ixlib=rb-4.1.0&q=85)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/90 to-zinc-950/50" />
        <div className="relative z-10 p-12 max-w-lg">
          <div className="flex items-center gap-3 mb-8">
            <img src="/logo192.png" alt="HomeOn" className="w-14 h-14 rounded-xl object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
            <div>
              <h1 className="text-2xl font-bold text-white">Portal do Cliente</h1>
              <p className="text-sm text-zinc-400">HomeOn Internet</p>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">
            Acompanhe seu plano, consumo e faturas
          </h2>
          <p className="text-zinc-400 leading-relaxed">
            Consulte seu saldo de dados, minutos utilizados e acesse seus boletos
            de pagamento de forma rapida e segura.
          </p>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <img src="/logo192.png" alt="HomeOn" className="w-12 h-12 rounded-xl object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
            <div>
              <h1 className="text-xl font-bold text-white">Portal do Cliente</h1>
            </div>
          </div>

          <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 shadow-2xl rounded-md p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Acessar minha conta</h2>
              <p className="text-zinc-400 text-sm">
                Informe seu CPF e numero do telefone para entrar
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" data-testid="portal-login-form">
              {error && (
                <div
                  className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-sm text-sm"
                  data-testid="portal-login-error"
                >
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="documento" className="text-zinc-300">CPF</Label>
                <Input
                  id="documento"
                  type="text"
                  inputMode="numeric"
                  value={documento}
                  onChange={(e) => setDocumento(formatCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  required
                  className="form-input font-mono"
                  data-testid="portal-login-cpf-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefone" className="text-zinc-300">Telefone (com DDD)</Label>
                <Input
                  id="telefone"
                  type="text"
                  inputMode="numeric"
                  value={telefone}
                  onChange={(e) => setTelefone(formatPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  required
                  className="form-input font-mono"
                  data-testid="portal-login-phone-input"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full btn-primary h-12 text-base"
                data-testid="portal-login-submit-button"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Entrando...</span>
                  </div>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-zinc-800 text-center">
              <a
                href="/login"
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                data-testid="portal-admin-link"
              >
                Acesso administrativo
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
