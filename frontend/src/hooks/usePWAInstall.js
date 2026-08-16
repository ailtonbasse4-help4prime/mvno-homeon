import { useEffect, useState, useCallback } from 'react';

/**
 * Hook para instalacao de PWA.
 * - captura o evento `beforeinstallprompt` (Chrome/Edge/Samsung Internet)
 * - detecta se o navegador atual e um in-app browser (Instagram, FB, WhatsApp, Telegram, Line)
 *   que NAO suportam instalacao de PWA
 * - detecta se o app ja esta rodando em modo standalone (ja instalado)
 * - detecta iOS Safari (que instala manualmente via "Adicionar a Tela de Inicio")
 */
export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
  const isInAppBrowser = /Instagram|FBAN|FBAV|FB_IAB|Messenger|Line\/|MicroMessenger|Twitter/i.test(ua)
    || /; wv\)/i.test(ua); // Android WebView

  // Telegram in-app browser (Telegram-Android/iOS) — detecta via ausencia de features + posthoc
  const isTelegramWebView = /Telegram/i.test(ua) || (typeof window !== 'undefined' && !!window.TelegramWebviewProxy);

  useEffect(() => {
    // Ja em modo standalone?
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    setIsInstalled(!!standalone);

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return { outcome: 'unavailable' };
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return choice; // { outcome: 'accepted' | 'dismissed' }
    } catch {
      return { outcome: 'error' };
    }
  }, [deferredPrompt]);

  return {
    canInstall: !!deferredPrompt,
    isInstalled,
    isIOS,
    isInAppBrowser: isInAppBrowser || isTelegramWebView,
    promptInstall,
  };
}
