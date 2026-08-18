import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Smartphone, Wifi, Router, Copy, Check, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const APN_CONFIG = {
  nome: 'Surf',
  apn: 'internet.br',
  mcc: '724',
  mnc: '17',
  protocolo: 'IPv4/IPv6',
};

function CopyField({ label, value, testid }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copiado`);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };
  return (
    <div className="flex items-center justify-between gap-2 bg-zinc-950/60 border border-zinc-800 rounded-md px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</p>
        <p className="text-white font-mono text-sm truncate">{value}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        className="flex-none w-8 h-8 flex items-center justify-center rounded-md bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors"
        data-testid={testid}
        aria-label={`Copiar ${label}`}
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

export function ApnTutorialCard({ activationId }) {
  const [tab, setTab] = useState('android');
  const [openTabs, setOpenTabs] = useState(true);
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    if (!activationId) return;
    setResending(true);
    try {
      await axios.post(`${API_URL}/api/public/ativacao/${activationId}/reenviar-apn`);
      toast.success('Tutorial enviado no seu WhatsApp!');
    } catch (err) {
      const detail = err.response?.data?.detail || 'Falha ao enviar. Tente novamente em instantes.';
      toast.error(typeof detail === 'string' ? detail : 'Erro ao reenviar');
    } finally {
      setResending(false);
    }
  };

  return (
    <Card className="bg-zinc-900 border-blue-500/40" data-testid="apn-tutorial-card">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/15 border border-blue-500/40 flex items-center justify-center flex-none">
            <Wifi className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-bold text-sm">Configurar APN (se necessario)</h3>
            <p className="text-zinc-400 text-xs mt-1">
              Alguns aparelhos precisam configurar o APN manualmente para a internet funcionar.
              Ja enviamos o passo a passo no seu WhatsApp.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <CopyField label="APN" value={APN_CONFIG.apn} testid="apn-copy-apn" />
          <CopyField label="Nome" value={APN_CONFIG.nome} testid="apn-copy-nome" />
          <CopyField label="MCC" value={APN_CONFIG.mcc} testid="apn-copy-mcc" />
          <CopyField label="MNC" value={APN_CONFIG.mnc} testid="apn-copy-mnc" />
          <div className="col-span-2">
            <CopyField label="Protocolo APN (modem)" value={APN_CONFIG.protocolo} testid="apn-copy-protocolo" />
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setOpenTabs(!openTabs)}
            className="flex items-center justify-between w-full text-left text-xs text-zinc-300 hover:text-white transition-colors py-2 border-t border-zinc-800"
            data-testid="apn-toggle-steps"
          >
            <span className="font-medium">Passo a passo detalhado</span>
            {openTabs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {openTabs && (
            <div className="mt-3 space-y-3">
              <div className="flex gap-1 bg-zinc-950/60 rounded-md p-1" role="tablist">
                <button
                  type="button"
                  onClick={() => setTab('android')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded text-xs font-medium transition-colors ${
                    tab === 'android' ? 'bg-blue-500/25 text-blue-300' : 'text-zinc-400 hover:text-white'
                  }`}
                  data-testid="apn-tab-android"
                >
                  <Smartphone className="w-3.5 h-3.5" /> Android
                </button>
                <button
                  type="button"
                  onClick={() => setTab('ios')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded text-xs font-medium transition-colors ${
                    tab === 'ios' ? 'bg-blue-500/25 text-blue-300' : 'text-zinc-400 hover:text-white'
                  }`}
                  data-testid="apn-tab-ios"
                >
                  <Smartphone className="w-3.5 h-3.5" /> iPhone
                </button>
                <button
                  type="button"
                  onClick={() => setTab('modem')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded text-xs font-medium transition-colors ${
                    tab === 'modem' ? 'bg-blue-500/25 text-blue-300' : 'text-zinc-400 hover:text-white'
                  }`}
                  data-testid="apn-tab-modem"
                >
                  <Router className="w-3.5 h-3.5" /> Modem
                </button>
              </div>

              <ol className="space-y-2 text-xs text-zinc-300 pl-1" data-testid={`apn-steps-${tab}`}>
                {tab === 'android' && (
                  <>
                    <li>1. Abra <strong>Configuracoes</strong> &gt; <strong>Rede movel</strong> (ou Conexoes).</li>
                    <li>2. Toque em <strong>Nomes de pontos de acesso (APN)</strong>.</li>
                    <li>3. Toque em <strong>+</strong> / <strong>Adicionar</strong> novo APN.</li>
                    <li>4. Preencha os campos com os dados acima.</li>
                    <li>5. Salve e <strong>selecione</strong> o novo APN.</li>
                    <li>6. Reinicie o celular.</li>
                  </>
                )}
                {tab === 'ios' && (
                  <>
                    <li>1. Abra <strong>Ajustes</strong> &gt; <strong>Celular</strong> &gt; <strong>Redes de dados moveis</strong>.</li>
                    <li>2. No campo <strong>APN</strong> em &quot;Dados Moveis&quot;, coloque: <span className="text-blue-300 font-mono">internet.br</span></li>
                    <li>3. Deixe <strong>Usuario</strong> e <strong>Senha</strong> em branco.</li>
                    <li>4. Reinicie o iPhone.</li>
                  </>
                )}
                {tab === 'modem' && (
                  <>
                    <li>1. Acesse o painel do modem no navegador (ex: <span className="font-mono">192.168.0.1</span> ou <span className="font-mono">192.168.8.1</span>).</li>
                    <li>2. Va em <strong>APN</strong> / <strong>Configuracoes de rede</strong>.</li>
                    <li>3. APN: <span className="text-blue-300 font-mono">internet.br</span> | Protocolo: <span className="text-blue-300 font-mono">IPv4/IPv6</span></li>
                    <li>4. Salve as configuracoes e reinicie o modem.</li>
                    <li className="text-amber-400 mt-2">
                      ⚠ Em modem/roteador 4G o <strong>Protocolo IPv4/IPv6</strong> e obrigatorio, senao a internet nao conecta.
                    </li>
                  </>
                )}
              </ol>
            </div>
          )}
        </div>

        {activationId && (
          <Button
            onClick={handleResend}
            disabled={resending}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            data-testid="apn-resend-whatsapp"
          >
            <MessageCircle className="w-4 h-4" />
            {resending ? 'Enviando...' : 'Reenviar tutorial no WhatsApp'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
