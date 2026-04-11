import { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { Copy, Check, Download, Printer, Share2, Link, Smartphone, QrCode } from 'lucide-react';

const SITE_URL = process.env.REACT_APP_SITE_URL || process.env.REACT_APP_BACKEND_URL || '';

export default function Divulgacao() {
  const portalUrl = `${SITE_URL}/portal`;
  const [copied, setCopied] = useState(false);
  const qrRef = useRef(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const handleDownloadPNG = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = 1024;
      canvas.height = 1024;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 1024, 1024);
      ctx.drawImage(img, 0, 0, 1024, 1024);
      const link = document.createElement('a');
      link.download = 'portal-homeon-qrcode.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('QR Code baixado!');
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handlePrint = () => {
    const printContent = document.getElementById('divulgacao-print-area');
    if (!printContent) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
        <head>
          <title>Portal do Cliente - HomeOn Internet</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
            .card {
              text-align: center; padding: 48px 40px; max-width: 420px; margin: auto;
              border: 2px solid #000; border-radius: 16px;
            }
            .logo { width: 80px; height: 80px; margin: 0 auto 16px; border-radius: 12px; }
            .title { font-size: 24px; font-weight: 900; color: #000; margin-bottom: 4px; }
            .subtitle { font-size: 14px; color: #555; margin-bottom: 24px; }
            .qr-container { display: inline-block; padding: 16px; background: #fff; border: 1px solid #eee; border-radius: 12px; margin-bottom: 20px; }
            .qr-container svg { display: block; }
            .url { font-size: 13px; color: #007AFF; font-weight: 600; word-break: break-all; margin-bottom: 16px; }
            .instructions { font-size: 12px; color: #888; line-height: 1.6; }
            .instructions strong { color: #333; }
            .divider { border: none; border-top: 1px dashed #ddd; margin: 16px 0; }
            @media print { body { margin: 0; } .card { border: 2px solid #000; } }
          </style>
        </head>
        <body>
          <div class="card">
            <img src="/logo192.png" alt="HomeOn" class="logo" onerror="this.style.display='none'" />
            <div class="title">Portal do Cliente</div>
            <div class="subtitle">HomeOn Internet - Telefonia Movel</div>
            <div class="qr-container">
              ${qrRef.current?.innerHTML || ''}
            </div>
            <div class="url">${portalUrl}</div>
            <hr class="divider" />
            <div class="instructions">
              <strong>Acesse o Portal do Cliente</strong><br/>
              Aponte a camera do celular para o QR Code<br/>
              ou acesse o link acima no navegador.<br/><br/>
              Consulte seu saldo, consumo e faturas!
            </div>
          </div>
        </body>
      </html>
    `);
    win.document.close();
    setTimeout(() => { win.print(); }, 500);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Portal do Cliente - HomeOn Internet',
          text: 'Acesse o Portal do Cliente HomeOn para consultar seu saldo, consumo e faturas.',
          url: portalUrl,
        });
      } catch {}
    } else {
      handleCopy();
    }
  };

  return (
    <div className="space-y-6" data-testid="divulgacao-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title mb-0 flex items-center gap-2">
            <Share2 className="w-6 h-6 text-blue-400" />
            Divulgacao do Portal
          </h1>
          <p className="text-sm text-zinc-500 mt-1">QR Code e link para compartilhar com seus clientes</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* QR Code Preview */}
        <div className="dashboard-card p-6 flex flex-col items-center" data-testid="divulgacao-qr-section">
          <h3 className="text-lg font-bold text-white mb-1">QR Code do Portal</h3>
          <p className="text-xs text-zinc-500 mb-5">Aponte a camera para acessar</p>

          <div id="divulgacao-print-area" ref={qrRef} className="bg-white p-6 rounded-xl inline-block mb-5">
            <QRCodeSVG
              value={portalUrl}
              size={240}
              level="H"
              includeMargin={false}
              bgColor="#FFFFFF"
              fgColor="#000000"
            />
          </div>

          <div className="w-full space-y-3">
            <Button onClick={handleDownloadPNG} className="w-full btn-primary flex items-center justify-center gap-2" data-testid="divulgacao-download-btn">
              <Download className="w-4 h-4" /> Baixar QR Code (PNG)
            </Button>
            <Button onClick={handlePrint} variant="outline" className="w-full flex items-center justify-center gap-2 border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500" data-testid="divulgacao-print-btn">
              <Printer className="w-4 h-4" /> Imprimir Material
            </Button>
          </div>
        </div>

        {/* Link section */}
        <div className="space-y-6">
          <div className="dashboard-card p-6" data-testid="divulgacao-link-section">
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <Link className="w-5 h-5 text-blue-400" />
              Link do Portal
            </h3>
            <p className="text-xs text-zinc-500 mb-4">Compartilhe com seus clientes via WhatsApp, email ou redes sociais</p>

            <div className="flex items-center gap-2">
              <div className="flex-1 bg-zinc-950 border border-zinc-500/60 rounded-lg px-4 py-3 font-mono text-sm text-blue-400 truncate" data-testid="divulgacao-portal-url">
                {portalUrl}
              </div>
              <Button
                onClick={handleCopy}
                className={`shrink-0 ${copied ? 'bg-emerald-600 hover:bg-emerald-700' : 'btn-primary'}`}
                data-testid="divulgacao-copy-btn"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>

            {navigator.share && (
              <Button onClick={handleShare} variant="outline" className="w-full mt-3 flex items-center justify-center gap-2 border-zinc-700 text-zinc-300 hover:text-white" data-testid="divulgacao-share-btn">
                <Share2 className="w-4 h-4" /> Compartilhar
              </Button>
            )}
          </div>

          {/* Instructions */}
          <div className="dashboard-card p-6">
            <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-blue-400" />
              Como usar
            </h3>
            <div className="space-y-3 text-sm text-zinc-400">
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-600/20 flex items-center justify-center shrink-0 text-blue-400 text-xs font-bold">1</div>
                <p><strong className="text-white">Imprima</strong> o QR Code e coloque na loja, balcao ou material de divulgacao.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-600/20 flex items-center justify-center shrink-0 text-blue-400 text-xs font-bold">2</div>
                <p><strong className="text-white">Envie o link</strong> por WhatsApp, email ou SMS para seus clientes.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-600/20 flex items-center justify-center shrink-0 text-blue-400 text-xs font-bold">3</div>
                <p>O cliente acessa com <strong className="text-white">CPF e telefone</strong> e consulta saldo, consumo e faturas.</p>
              </div>
            </div>
          </div>

          {/* Quick text for WhatsApp */}
          <div className="dashboard-card p-6">
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <QrCode className="w-4 h-4 text-green-400" />
              Texto para WhatsApp
            </h3>
            <div className="bg-zinc-950 border border-zinc-500/60 rounded-lg p-4 text-sm text-zinc-300 whitespace-pre-line">
              {`Ola! Acesse o *Portal do Cliente HomeOn* para consultar seu saldo de dados, minutos, SMS e faturas.\n\nAcesse: ${portalUrl}\n\nUse seu CPF e numero de telefone para entrar.`}
            </div>
            <Button
              onClick={() => {
                navigator.clipboard.writeText(`Ola! Acesse o *Portal do Cliente HomeOn* para consultar seu saldo de dados, minutos, SMS e faturas.\n\nAcesse: ${portalUrl}\n\nUse seu CPF e numero de telefone para entrar.`);
                toast.success('Texto copiado!');
              }}
              variant="outline"
              className="w-full mt-3 flex items-center justify-center gap-2 border-zinc-700 text-zinc-300 hover:text-white"
              data-testid="divulgacao-copy-whatsapp-btn"
            >
              <Copy className="w-4 h-4" /> Copiar texto
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
