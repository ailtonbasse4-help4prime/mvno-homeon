import { useState } from 'react';
import { Download, Share2, ExternalLink, Copy, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { usePWAInstall } from '../hooks/usePWAInstall';

/**
 * Botao "Instalar App" para o Portal do Cliente.
 * - Se ja instalado (standalone): nao renderiza nada
 * - Se o Chrome disparou beforeinstallprompt: mostra "Instalar App" (tap instala)
 * - Se in-app browser (Telegram/WhatsApp/etc): abre modal explicando como abrir no Chrome
 * - Se iOS Safari: abre modal com instrucoes de "Adicionar a Tela de Inicio"
 * - Fallback (Chrome sem prompt ainda): mostra "Instalar App" com instrucao no menu
 */
export function InstallAppButton({ variant = 'default' }) {
  const { canInstall, isInstalled, isIOS, isInAppBrowser, promptInstall } = usePWAInstall();
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (isInstalled) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.origin + '/portal' : '';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      toast.success('Link copiado! Cole no Chrome para instalar.');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Nao foi possivel copiar. Copie manualmente: ' + currentUrl);
    }
  };

  const handleClick = async () => {
    if (isInAppBrowser || isIOS) {
      setModalOpen(true);
      return;
    }
    if (canInstall) {
      const res = await promptInstall();
      if (res.outcome === 'accepted') {
        toast.success('App instalado! Procure o icone na tela inicial.');
      }
      return;
    }
    // Fallback: Chrome ainda nao disparou prompt (ex: usuario acabou de chegar)
    setModalOpen(true);
  };

  const btnClasses = variant === 'inline'
    ? 'inline-flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-2'
    : 'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-blue-500/15 border border-blue-500/40 text-blue-300 hover:bg-blue-500/25 hover:border-blue-500/60 transition-all text-sm font-medium';

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={btnClasses}
        data-testid="pwa-install-button"
      >
        <Download className="w-4 h-4" />
        <span>Instalar App na tela inicial</span>
      </button>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setModalOpen(false)}
          data-testid="pwa-install-modal"
        >
          <div
            className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Download className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Como instalar o app</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors"
                aria-label="Fechar"
                data-testid="pwa-install-modal-close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-4">
                <p className="text-sm text-zinc-300">
                  No iPhone/iPad, use o <strong>Safari</strong> e siga estes passos:
                </p>
                <ol className="space-y-3 text-sm text-zinc-300">
                  <li className="flex gap-3">
                    <span className="flex-none w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">1</span>
                    <span>Toque no icone <Share2 className="w-4 h-4 inline text-blue-400" /> <strong>Compartilhar</strong> na barra do Safari.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-none w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">2</span>
                    <span>Role e toque em <strong>&quot;Adicionar a Tela de Inicio&quot;</strong>.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-none w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">3</span>
                    <span>Toque em <strong>Adicionar</strong> no canto superior direito.</span>
                  </li>
                </ol>
              </div>
            ) : isInAppBrowser ? (
              <div className="space-y-4">
                <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-lg p-3 text-sm">
                  Voce esta em um navegador interno (Telegram, WhatsApp, Instagram etc.) que nao permite instalar apps.
                </div>
                <p className="text-sm text-zinc-300">Para instalar, abra este link no navegador Chrome:</p>
                <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 flex items-center gap-2">
                  <code className="flex-1 text-xs text-zinc-300 break-all">{currentUrl}</code>
                  <button
                    type="button"
                    onClick={copyLink}
                    className="flex-none px-3 py-1.5 rounded-md bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 text-xs font-medium flex items-center gap-1"
                    data-testid="pwa-install-copy-link"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
                <ol className="space-y-2 text-sm text-zinc-400">
                  <li>1. Toque em <strong>Copiar</strong> acima.</li>
                  <li>2. Abra o <strong>Chrome</strong> no seu celular.</li>
                  <li>3. Cole o link na barra de endereco e abra.</li>
                  <li>4. Toque no menu <strong>&#8942;</strong> e escolha <strong>&quot;Instalar app&quot;</strong>.</li>
                </ol>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-zinc-300">
                  No Chrome, siga estes passos para instalar:
                </p>
                <ol className="space-y-3 text-sm text-zinc-300">
                  <li className="flex gap-3">
                    <span className="flex-none w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">1</span>
                    <span>Toque no menu <strong>&#8942;</strong> no canto superior direito.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-none w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">2</span>
                    <span>Escolha <strong>&quot;Instalar app&quot;</strong> ou <strong>&quot;Adicionar a tela inicial&quot;</strong>.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-none w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">3</span>
                    <span>Confirme e pronto! O icone aparece na tela inicial.</span>
                  </li>
                </ol>
                <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-zinc-500 flex-none" />
                  <code className="flex-1 text-xs text-zinc-400 break-all">{currentUrl}</code>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
