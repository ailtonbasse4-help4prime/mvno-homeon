import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { X, Zap, CheckCircle2, Copy, Loader2, AlertCircle, Wifi } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

function fmtCurrency(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function RecargaModal({ token, linha, onClose, onSuccess }) {
  const [step, setStep] = useState('planos');
  const [ofertas, setOfertas] = useState([]);
  const [ofertaSelecionada, setOfertaSelecionada] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pix, setPix] = useState(null);
  const [statusRecarga, setStatusRecarga] = useState(null);
  const [copiado, setCopiado] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const loadOfertas = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(
        `${API_URL}/api/portal/ofertas-disponiveis?linha_id=${linha.id}`,
        { headers }
      );
      setOfertas(r.data.ofertas || []);
      const atual = r.data.ofertas?.find((o) => o.atual);
      if (atual) setOfertaSelecionada(atual);
    } catch (err) {
      toast.error('Falha ao carregar planos disponiveis');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linha.id, token]);

  useEffect(() => { loadOfertas(); }, [loadOfertas]);

  const iniciarRecarga = async () => {
    if (!ofertaSelecionada) return;
    setLoading(true);
    try {
      const r = await axios.post(
        `${API_URL}/api/portal/recarga/iniciar`,
        { linha_id: linha.id, oferta_id: ofertaSelecionada.id },
        { headers }
      );
      setPix(r.data);
      setStep('pix');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Falha ao gerar PIX';
      toast.error(String(msg));
    } finally {
      setLoading(false);
    }
  };

  // Polling do status
  useEffect(() => {
    if (step !== 'pix' || !pix?.cobranca_id) return;
    let cancelled = false;
    let intervalId;
    const check = async () => {
      try {
        const r = await axios.get(
          `${API_URL}/api/portal/recarga/${pix.cobranca_id}/status`,
          { headers }
        );
        if (cancelled) return;
        setStatusRecarga(r.data);
        if (r.data.paga) {
          clearInterval(intervalId);
          if (r.data.recarga_aplicada) {
            setStep('sucesso');
            toast.success('Recarga aplicada com sucesso!');
            setTimeout(() => onSuccess?.(), 1200);
          } else if (r.data.recarga_erro) {
            setStep('erro');
          }
        }
      } catch (_e) {
        // silent
      }
    };
    check();
    intervalId = setInterval(check, 4000);
    return () => { cancelled = true; clearInterval(intervalId); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, pix]);

  const copiarPix = async () => {
    try {
      await navigator.clipboard.writeText(pix.pix_copy_paste);
      setCopiado(true);
      toast.success('Codigo PIX copiado');
      setTimeout(() => setCopiado(false), 3000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      data-testid="recarga-modal-overlay"
    >
      <div
        className="bg-[#141414] border border-white/10 rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        data-testid="recarga-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#007AFF]/15 flex items-center justify-center">
              <Zap className="w-4 h-4 text-[#007AFF]" />
            </div>
            <div>
              <h2 className="font-outfit text-base font-bold text-white">
                {step === 'planos' && 'Recarregar linha'}
                {step === 'pix' && 'Pague com PIX'}
                {step === 'sucesso' && 'Recarga concluida'}
                {step === 'erro' && 'Pagamento OK, ativacao pendente'}
              </h2>
              <p className="text-[10px] text-zinc-500 font-mono">{linha.numero}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/10"
            data-testid="recarga-close-btn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {step === 'planos' && (
            <>
              {loading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-[#007AFF] animate-spin" /></div>}
              {!loading && ofertas.length === 0 && (
                <div className="text-center py-8 text-zinc-500 text-sm">Nenhuma oferta disponivel</div>
              )}
              {!loading && ofertas.length > 0 && (
                <div className="space-y-2" data-testid="recarga-ofertas-list">
                  {ofertas.map((o) => {
                    const selected = ofertaSelecionada?.id === o.id;
                    return (
                      <button
                        key={o.id}
                        onClick={() => setOfertaSelecionada(o)}
                        className={`w-full text-left p-4 rounded-lg border transition-colors ${
                          selected
                            ? 'bg-[#007AFF]/10 border-[#007AFF]'
                            : 'bg-black/40 border-white/10 hover:border-white/20'
                        }`}
                        data-testid={`recarga-oferta-${o.id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-outfit text-white font-bold text-sm">{o.nome}</span>
                              {o.atual && (
                                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#34C759]/15 text-[#34C759] border border-[#34C759]/30">Atual</span>
                              )}
                            </div>
                            {o.franquia && (
                              <div className="flex items-center gap-1 mt-1 text-xs text-zinc-400">
                                <Wifi className="w-3 h-3" /> {o.franquia}
                              </div>
                            )}
                            {o.descricao && <p className="text-[11px] text-zinc-500 mt-1 line-clamp-2">{o.descricao}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-outfit text-lg font-black text-white">{fmtCurrency(o.valor)}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {step === 'pix' && pix && (
            <div className="text-center space-y-4" data-testid="recarga-pix-step">
              <div className="bg-[#FF9500]/10 border border-[#FF9500]/20 rounded-lg p-3 flex items-center gap-2 text-left">
                <Loader2 className="w-4 h-4 text-[#FF9500] animate-spin shrink-0" />
                <div className="text-xs text-[#FF9500]">
                  Aguardando pagamento... A recarga sera aplicada automaticamente apos confirmacao.
                </div>
              </div>
              {pix.pix_qr_image && (
                <div className="bg-white p-3 rounded-lg inline-block">
                  <img
                    src={`data:image/png;base64,${pix.pix_qr_image}`}
                    alt="QR Code PIX"
                    className="w-48 h-48 mx-auto"
                    data-testid="recarga-pix-qr"
                  />
                </div>
              )}
              <div className="text-white font-outfit text-2xl font-black">{fmtCurrency(pix.valor)}</div>
              {pix.pix_copy_paste && (
                <button
                  onClick={copiarPix}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-[#007AFF] hover:bg-[#3395FF] text-white font-bold text-sm transition-colors"
                  data-testid="recarga-pix-copy-btn"
                >
                  {copiado ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiado ? 'Copiado!' : 'Copiar codigo PIX'}
                </button>
              )}
              {pix.invoice_url && (
                <a
                  href={pix.invoice_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-xs text-[#007AFF] underline"
                  data-testid="recarga-invoice-link"
                >
                  Abrir pagina de pagamento
                </a>
              )}
            </div>
          )}

          {step === 'sucesso' && (
            <div className="text-center py-8" data-testid="recarga-sucesso-step">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#34C759]/15 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-[#34C759]" />
              </div>
              <p className="text-white font-outfit text-lg font-bold mb-1">Recarga aplicada!</p>
              <p className="text-sm text-zinc-400">Sua linha esta ativa por mais 30 dias.</p>
              {statusRecarga?.nova_expiracao_ta && (
                <p className="text-xs text-zinc-500 mt-2">
                  Valida ate {statusRecarga.nova_expiracao_ta.split('-').reverse().join('/')}
                </p>
              )}
            </div>
          )}

          {step === 'erro' && (
            <div className="text-center py-6" data-testid="recarga-erro-step">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#FF9500]/15 flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-[#FF9500]" />
              </div>
              <p className="text-white font-outfit text-lg font-bold mb-1">Pagamento confirmado</p>
              <p className="text-sm text-zinc-400 mb-3">A ativacao automatica falhou. Nossa equipe foi notificada.</p>
              <p className="text-xs text-zinc-600">Detalhe: {statusRecarga?.recarga_erro}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'planos' && (
          <div className="p-4 border-t border-white/10 shrink-0">
            <Button
              onClick={iniciarRecarga}
              disabled={!ofertaSelecionada || loading}
              className="w-full bg-[#007AFF] hover:bg-[#3395FF] text-white font-bold rounded-lg py-3 disabled:opacity-40"
              data-testid="recarga-confirm-btn"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {ofertaSelecionada ? `Pagar ${fmtCurrency(ofertaSelecionada.valor)}` : 'Escolha uma oferta'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
