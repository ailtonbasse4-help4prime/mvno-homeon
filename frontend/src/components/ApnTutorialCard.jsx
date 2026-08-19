import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Smartphone, Wifi, Router, Copy, Check, MessageCircle, ChevronDown, ChevronUp, Power, Signal } from 'lucide-react';

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
            <h3 className="text-white font-bold text-sm">Bem-vindo à HOMEON TELECOMUNICAÇÕES!</h3>
            <p className="text-zinc-400 text-xs mt-1">
              Siga os passos abaixo <strong>na ordem</strong> para começar a usar seu chip.
              Já enviamos este guia no seu WhatsApp.
            </p>
          </div>
        </div>

        {/* Passo 1 - Reiniciar */}
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-none">
            <Power className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex-1">
            <p className="text-emerald-300 font-semibold text-xs">1. Reinicie o celular</p>
            <p className="text-zinc-300 text-xs mt-1 leading-relaxed">
              Se o chip já estava no aparelho durante a ativação, <strong>desligue e ligue o celular</strong>.
              Isso resolve a maior parte dos casos de sem sinal ou sem internet.
            </p>
          </div>
        </div>

        {/* Passo 2 - Rede 4G */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-none">
            <Signal className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-amber-300 font-semibold text-xs">2. Deixe a rede 4G como preferencial</p>
            <p className="text-zinc-300 text-xs mt-1 leading-relaxed">
              Muitas regiões <strong>não têm cobertura 5G</strong> e o celular fica tentando conectar sem sucesso.
              Vá em <strong>Configurações → Rede móvel → Tipo de rede preferido</strong> e selecione <strong>4G/LTE</strong>.
              No iPhone: <strong>Ajustes → Celular → Opções → Voz e Dados → LTE</strong>.
            </p>
          </div>
        </div>

        {/* Passo 3 - APN */}
        <div className="border-t border-zinc-800 pt-3">
          <p className="text-white font-semibold text-xs mb-2">3. Se ainda não navegar, configure o APN</p>
          <div className="grid grid-cols-2 gap-2">
            <CopyField label="APN" value={APN_CONFIG.apn} testid="apn-copy-apn" />
            <CopyField label="Nome" value={APN_CONFIG.nome} testid="apn-copy-nome" />
            <CopyField label="MCC" value={APN_CONFIG.mcc} testid="apn-copy-mcc" />
            <CopyField label="MNC" value={APN_CONFIG.mnc} testid="apn-copy-mnc" />
            <div className="col-span-2">
              <CopyField label="Protocolo APN (modem)" value={APN_CONFIG.protocolo} testid="apn-copy-protocolo" />
            </div>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setOpenTabs(!openTabs)}
            className="flex items-center justify-between w-full text-left text-xs text-zinc-300 hover:text-white transition-colors py-2 border-t border-zinc-800"
            data-testid="apn-toggle-steps"
          >
            <span className="font-medium">Passo a passo detalhado do APN</span>
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
                    <li>1. Abra <strong>Configurações</strong> &gt; <strong>Rede móvel</strong> (ou Conexões).</li>
                    <li>2. Toque em <strong>Nomes de pontos de acesso (APN)</strong>.</li>
                    <li>3. Toque em <strong>+</strong> / <strong>Adicionar</strong> novo APN.</li>
                    <li>4. Preencha os campos com os dados acima.</li>
                    <li>5. Salve e <strong>selecione</strong> o novo APN.</li>
                    <li>6. Reinicie o celular.</li>
                  </>
                )}
                {tab === 'ios' && (
                  <>
                    <li>1. Abra <strong>Ajustes</strong> &gt; <strong>Celular</strong> &gt; <strong>Redes de dados móveis</strong>.</li>
                    <li>2. No campo <strong>APN</strong> em &quot;Dados Móveis&quot;, coloque: <span className="text-blue-300 font-mono">internet.br</span></li>
                    <li>3. Deixe <strong>Usuário</strong> e <strong>Senha</strong> em branco.</li>
                    <li>4. Reinicie o iPhone.</li>
                  </>
                )}
                {tab === 'modem' && (
                  <>
                    <li>1. Acesse o painel do modem no navegador (ex: <span className="font-mono">192.168.0.1</span> ou <span className="font-mono">192.168.8.1</span>).</li>
                    <li>2. Vá em <strong>APN</strong> / <strong>Configurações de rede</strong>.</li>
                    <li>3. APN: <span className="text-blue-300 font-mono">internet.br</span> | Protocolo: <span className="text-blue-300 font-mono">IPv4/IPv6</span></li>
                    <li>4. Salve as configurações e reinicie o modem.</li>
                    <li className="text-amber-400 mt-2">
                      ⚠ Em modem/roteador 4G o <strong>Protocolo IPv4/IPv6</strong> é obrigatório, senão a internet não conecta.
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
