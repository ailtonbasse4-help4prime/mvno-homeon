import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Loader2, Smartphone, Wifi, CheckCircle, AlertCircle, ArrowRight, User, LifeBuoy, Ban } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { InstallAppButton } from '../components/InstallAppButton';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function ChipLanding() {
  const { iccid } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [chip, setChip] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/public/chip/${iccid}/status`);
        if (!alive) return;
        setChip(res.data);
      } catch (e) {
        if (!alive) return;
        setErro(e.response?.data?.detail || 'Não foi possível consultar o chip. Verifique sua conexão.');
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [iccid]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" data-testid="chip-landing-loading" />
      </div>
    );
  }

  if (erro) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-zinc-900 border-red-500/40">
          <CardContent className="p-6 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
            <h1 className="text-xl font-bold text-white">Chip inválido</h1>
            <p className="text-zinc-400 text-sm">{erro}</p>
            <p className="text-xs text-zinc-500 font-mono break-all">ICCID: {iccid}</p>
            <p className="text-xs text-zinc-500">Fale com o suporte informando o número acima.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const estado = chip?.estado;

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col p-4 py-8">
      <div className="max-w-md w-full mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-white tracking-tight">HOMEON</h1>
          <p className="text-zinc-500 text-xs uppercase tracking-widest">Telecomunicações</p>
        </div>

        {/* ICCID pill */}
        <div className="text-center">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider">ICCID</p>
          <p className="text-zinc-400 font-mono text-xs" data-testid="chip-landing-iccid">{iccid}</p>
        </div>

        {/* Estado NAO ATIVADO */}
        {estado === 'nao_ativado' && (
          <Card className="bg-zinc-900 border-emerald-500/40">
            <CardContent className="p-6 space-y-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mx-auto">
                <Smartphone className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">Ativar meu chip</h2>
                <p className="text-zinc-400 text-sm mt-2">
                  Seu chip Homeon ainda não foi ativado. Toque no botão abaixo para começar.
                </p>
              </div>

              <Button
                onClick={() => navigate(`/ativar?iccid=${iccid}`)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-12 text-base"
                data-testid="chip-landing-ativar-btn"
              >
                Ativar meu chip agora <ArrowRight className="w-5 h-5" />
              </Button>

              <div className="pt-4 border-t border-zinc-800 text-left space-y-2">
                <p className="text-xs text-zinc-500 font-semibold">O que vai acontecer:</p>
                <ol className="space-y-1.5 text-xs text-zinc-400">
                  <li>1. Preencha seus dados (CPF, endereço e WhatsApp)</li>
                  <li>2. Escolha o plano ideal pra você</li>
                  <li>3. Insira o chip no celular e reinicie</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Estado ATIVANDO */}
        {estado === 'ativando' && (
          <Card className="bg-zinc-900 border-amber-500/40">
            <CardContent className="p-6 space-y-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center mx-auto">
                <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">Ativação em andamento</h2>
                <p className="text-zinc-400 text-sm mt-2">
                  Seu chip está sendo ativado neste momento. Aguarde alguns minutos e recarregue esta página.
                </p>
              </div>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="w-full"
                data-testid="chip-landing-reload-btn"
              >
                Verificar novamente
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Estado ATIVO */}
        {estado === 'ativo' && (
          <>
            <Card className="bg-zinc-900 border-emerald-500/40">
              <CardContent className="p-6 space-y-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">Chip ativo</h2>
                  {chip.msisdn && (
                    <p className="text-zinc-300 text-sm mt-1">
                      Número: <span className="font-mono text-white font-bold">{chip.msisdn}</span>
                    </p>
                  )}
                </div>
                <Button
                  onClick={() => navigate('/portal')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2 h-12 text-base"
                  data-testid="chip-landing-portal-btn"
                >
                  <User className="w-5 h-5" />
                  Acessar Portal do Cliente
                </Button>
              </CardContent>
            </Card>
            <InstallAppButton />
          </>
        )}

        {/* Estado BLOQUEADO */}
        {estado === 'bloqueado' && (
          <Card className="bg-zinc-900 border-red-500/40">
            <CardContent className="p-6 space-y-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-center justify-center mx-auto">
                <Ban className="w-8 h-8 text-red-400" />
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">Chip bloqueado</h2>
                <p className="text-zinc-400 text-sm mt-2">
                  Sua linha está temporariamente bloqueada. Regularize sua situação para reativar.
                </p>
              </div>
              <Button
                onClick={() => navigate('/portal')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="chip-landing-portal-btn"
              >
                Ver faturas no Portal
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Estado CANCELADO */}
        {estado === 'cancelado' && (
          <Card className="bg-zinc-900 border-zinc-700">
            <CardContent className="p-6 space-y-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto">
                <Ban className="w-8 h-8 text-zinc-400" />
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">Chip cancelado</h2>
                <p className="text-zinc-400 text-sm mt-2">
                  Este chip foi cancelado e não pode mais ser ativado.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Suporte */}
        <div className="text-center pt-4">
          <a
            href="https://wa.me/5535999999999?text=Preciso%20de%20ajuda%20com%20meu%20chip%20Homeon"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            data-testid="chip-landing-suporte-link"
          >
            <LifeBuoy className="w-4 h-4" /> Falar com o suporte
          </a>
        </div>
      </div>
    </div>
  );
}
