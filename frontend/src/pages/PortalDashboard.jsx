import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import {
  Smartphone, Signal, Wifi, MessageSquare, Clock, LogOut,
  RefreshCw, ExternalLink, Loader2, AlertCircle,
  Phone, User, CreditCard, ChevronDown, ChevronUp, BarChart3,
  Copy, Check, Zap, Calendar, TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Register service worker and switch manifest for PWA install
function usePortalPWA() {
  useEffect(() => {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) manifestLink.href = '/portal-manifest.json';
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        reg.update().catch(() => {});
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (nw) nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              nw.postMessage({ type: 'SKIP_WAITING' });
              window.location.reload();
            }
          });
        });
      }).catch(() => {});
    }
    return () => {
      if (manifestLink) manifestLink.href = '/manifest.json';
    };
  }, []);
}

function getPortalAuth() {
  const token = sessionStorage.getItem('portal_token');
  const cliente = JSON.parse(sessionStorage.getItem('portal_cliente') || 'null');
  return { token, cliente };
}

function portalHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

function formatBytes(mb) {
  if (mb == null || isNaN(mb)) return '0';
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)}`;
  return `${Number(mb).toFixed(0)}`;
}

function formatBytesUnit(mb) {
  if (mb == null || isNaN(mb)) return 'MB';
  if (mb >= 1024) return 'GB';
  return 'MB';
}

function formatPhone(num) {
  if (!num) return '';
  const d = num.replace(/\D/g, '');
  // With country code (55)
  if (d.length === 13 && d.startsWith('55')) return `(${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12 && d.startsWith('55')) return `(${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return num;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function getFirstName(name) {
  if (!name) return '';
  return name.split(' ')[0];
}

function formatCurrency(val) {
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

function cobrancaStatusInfo(status) {
  const s = (status || '').toUpperCase();
  if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(s))
    return { label: 'Pago', color: 'text-[#34C759]', bg: 'bg-[#34C759]/10', border: 'border-[#34C759]/20', icon: Check };
  if (s === 'OVERDUE')
    return { label: 'Vencido', color: 'text-[#FF3B30]', bg: 'bg-[#FF3B30]/10', border: 'border-[#FF3B30]/20', icon: AlertCircle };
  if (s === 'PENDING')
    return { label: 'A vencer', color: 'text-[#FF9500]', bg: 'bg-[#FF9500]/10', border: 'border-[#FF9500]/20', icon: Clock };
  return { label: status || '?', color: 'text-zinc-400', bg: 'bg-zinc-800', border: 'border-zinc-700', icon: CreditCard };
}

function billingTypeLabel(bt) {
  if (bt === 'PIX') return 'Pix';
  if (bt === 'BOLETO') return 'Boleto';
  if (bt === 'CREDIT_CARD') return 'Cartao';
  return bt || '';
}

// Data usage progress component
function DataGauge({ usedMb, totalMb, label }) {
  const used = Number(usedMb || 0);
  const total = Number(totalMb || 0);
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const barColor = pct > 90 ? '#FF3B30' : pct > 70 ? '#FF9500' : '#007AFF';

  return (
    <div data-testid="portal-data-gauge">
      <div className="flex items-end justify-between mb-2">
        <div>
          <p className="font-outfit text-xs font-bold uppercase tracking-[0.15em] text-zinc-500 mb-1">{label}</p>
          <p className="font-outfit text-3xl sm:text-4xl font-black text-white leading-none">
            {formatBytes(used)}
            <span className="text-base font-semibold text-zinc-500 ml-1">{formatBytesUnit(used)}</span>
          </p>
        </div>
        {total > 0 && (
          <p className="text-sm font-manrope text-zinc-500">
            de {formatBytes(total)} {formatBytesUnit(total)}
          </p>
        )}
      </div>
      {total > 0 && (
        <div className="w-full h-3 rounded-full bg-[#262626] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${pct}%`, backgroundColor: barColor }}
          />
        </div>
      )}
      {total > 0 && (
        <p className="text-xs text-zinc-600 mt-1.5 font-manrope">{pct.toFixed(0)}% utilizado</p>
      )}
    </div>
  );
}

// Stat mini card
function StatCard({ icon: Icon, label, value, unit, color = '#007AFF' }) {
  return (
    <div className="bg-[#141414] border border-white/10 rounded-lg p-4" data-testid={`portal-stat-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
        <span className="font-outfit text-xs font-bold uppercase tracking-[0.15em] text-zinc-500">{label}</span>
      </div>
      <p className="font-outfit text-2xl font-black text-white">
        {value}
        {unit && <span className="text-sm font-semibold text-zinc-500 ml-1">{unit}</span>}
      </p>
    </div>
  );
}

export default function PortalDashboard() {
  usePortalPWA();
  const navigate = useNavigate();
  const { token, cliente } = getPortalAuth();

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [saldos, setSaldos] = useState({});
  const [consumos, setConsumos] = useState({});
  const [loadingSaldo, setLoadingSaldo] = useState({});
  const [loadingConsumo, setLoadingConsumo] = useState({});
  const [expandedLine, setExpandedLine] = useState(null);
  const [copiedPix, setCopiedPix] = useState(null);

  useEffect(() => {
    if (!token || !cliente) {
      navigate('/portal', { replace: true });
    }
  }, [token, cliente, navigate]);

  const fetchDashboard = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const resp = await axios.get(`${API_URL}/api/portal/dashboard`, {
        headers: portalHeaders(token),
      });
      setDashboard(resp.data);
      // Auto-fetch saldo and consumo for all lines
      const linhas = resp.data?.linhas || [];
      linhas.forEach((linha) => {
        const clean = (linha.numero || '').replace(/\D/g, '');
        if (clean) {
          fetchSaldo(clean);
          fetchConsumo(clean);
        }
      });
    } catch (err) {
      if (err.response?.status === 401) {
        sessionStorage.removeItem('portal_token');
        sessionStorage.removeItem('portal_cliente');
        navigate('/portal', { replace: true });
        return;
      }
      setError('Erro ao carregar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, navigate]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const fetchSaldo = async (numero) => {
    if (!numero || !token) return;
    const clean = numero.replace(/\D/g, '');
    setLoadingSaldo((p) => ({ ...p, [clean]: true }));
    try {
      const resp = await axios.get(`${API_URL}/api/portal/saldo/${clean}`, {
        headers: portalHeaders(token),
      });
      setSaldos((p) => ({ ...p, [clean]: resp.data }));
    } catch {
      setSaldos((p) => ({ ...p, [clean]: { success: false, message: 'Erro ao consultar saldo' } }));
    } finally {
      setLoadingSaldo((p) => ({ ...p, [clean]: false }));
    }
  };

  const fetchConsumo = async (numero) => {
    if (!numero || !token) return;
    const clean = numero.replace(/\D/g, '');
    setLoadingConsumo((p) => ({ ...p, [clean]: true }));
    try {
      const resp = await axios.get(`${API_URL}/api/portal/consumo/${clean}`, {
        headers: portalHeaders(token),
      });
      setConsumos((p) => ({ ...p, [clean]: resp.data }));
    } catch {
      setConsumos((p) => ({ ...p, [clean]: { success: false, message: 'Erro ao consultar consumo' } }));
    } finally {
      setLoadingConsumo((p) => ({ ...p, [clean]: false }));
    }
  };

  const handleExpandLine = (numero) => {
    const clean = (numero || '').replace(/\D/g, '');
    setExpandedLine(expandedLine === clean ? null : clean);
  };

  const handleCopyPix = async (pixCode, id) => {
    try {
      await navigator.clipboard.writeText(pixCode);
      setCopiedPix(id);
      toast.success('Codigo PIX copiado!');
      setTimeout(() => setCopiedPix(null), 3000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('portal_token');
    sessionStorage.removeItem('portal_cliente');
    navigate('/portal', { replace: true });
  };

  if (!token || !cliente) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#007AFF] animate-spin mx-auto mb-3" />
          <p className="font-manrope text-sm text-zinc-500">Carregando seus dados...</p>
        </div>
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
        <div className="bg-[#141414] border border-white/10 rounded-lg max-w-md w-full p-8 text-center">
          <AlertCircle className="w-12 h-12 text-[#FF3B30] mx-auto mb-4" />
          <p className="text-white font-manrope mb-4">{error}</p>
          <Button onClick={fetchDashboard} className="bg-[#007AFF] hover:bg-[#3395FF] text-white font-bold rounded-lg px-6 py-3" data-testid="portal-retry-btn">
            <RefreshCw className="w-4 h-4 mr-2" /> Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  const linhas = dashboard?.linhas || [];
  const cobrancas = dashboard?.cobrancas || [];
  const cli = dashboard?.cliente || cliente;

  // Summary data
  const linhasAtivas = linhas.filter(l => ['ativo', 'active'].includes((l.status || '').toLowerCase())).length;
  const proximaFatura = cobrancas.find(c => c.status === 'PENDING');
  const faturaVencida = cobrancas.find(c => c.status === 'OVERDUE');

  // First line data for hero display
  const primeiraLinha = linhas[0];
  const primeiraLinhaClean = primeiraLinha ? (primeiraLinha.numero || '').replace(/\D/g, '') : '';
  const saldoPrincipal = saldos[primeiraLinhaClean];
  const consumoPrincipal = consumos[primeiraLinhaClean];

  // Estimate franchise from plan name (e.g. "10GB" -> 10240 MB)
  const getFranchiseMb = (linha) => {
    const franquia = linha?.franquia || linha?.plano_nome || '';
    const match = franquia.match(/(\d+)\s*(GB|MB)/i);
    if (match) {
      const val = parseInt(match[1]);
      return match[2].toUpperCase() === 'GB' ? val * 1024 : val;
    }
    return 0;
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] font-manrope" data-testid="portal-dashboard">
      {/* Header */}
      <header className="bg-black/60 backdrop-blur-xl border-b border-white/10 z-50 sticky top-0">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo192.png"
              alt="HomeOn"
              className="w-9 h-9 rounded-lg object-cover"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <div>
              <h1 className="font-outfit text-base font-bold text-white leading-tight">HomeOn</h1>
              <p className="text-[10px] text-zinc-500 font-outfit uppercase tracking-wider">Telefonia Movel</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchDashboard}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
              data-testid="portal-refresh-btn"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 transition-colors"
              data-testid="portal-logout-btn"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Greeting */}
        <div data-testid="portal-greeting">
          <p className="font-outfit text-2xl sm:text-3xl font-bold text-white">
            {getGreeting()}, {getFirstName(cli.nome)}!
          </p>
          <p className="text-sm text-zinc-500 mt-1">
            {linhasAtivas} {linhasAtivas === 1 ? 'linha ativa' : 'linhas ativas'}
            {faturaVencida && <span className="text-[#FF3B30] ml-2">&#8226; Fatura vencida</span>}
            {!faturaVencida && proximaFatura && (
              <span className="text-zinc-400 ml-2">&#8226; Proxima fatura: {formatDate(proximaFatura.vencimento)}</span>
            )}
          </p>
        </div>

        {/* Alert: overdue invoice */}
        {faturaVencida && (
          <div className="bg-[#FF3B30]/10 border border-[#FF3B30]/20 rounded-lg p-4 flex items-center gap-3" data-testid="portal-overdue-alert">
            <AlertCircle className="w-5 h-5 text-[#FF3B30] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#FF3B30]">Fatura vencida</p>
              <p className="text-xs text-zinc-400">{formatCurrency(faturaVencida.valor)} - Venc: {formatDate(faturaVencida.vencimento)}</p>
            </div>
            {faturaVencida.asaas_invoice_url && (
              <a href={faturaVencida.asaas_invoice_url} target="_blank" rel="noopener noreferrer"
                className="bg-[#FF3B30] text-white text-xs font-bold px-3 py-2 rounded-lg shrink-0"
                data-testid="portal-pay-overdue-btn"
              >Pagar</a>
            )}
          </div>
        )}

        {/* Main data usage card */}
        {primeiraLinha && (
          <div className="bg-[#141414] border border-white/10 rounded-lg p-5" data-testid="portal-main-usage">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#007AFF]" />
                <span className="text-white font-semibold text-sm font-mono">{formatPhone(primeiraLinha.numero)}</span>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                  ['ativo','active'].includes((primeiraLinha.status||'').toLowerCase())
                    ? 'bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/20'
                    : 'bg-[#FF3B30]/10 text-[#FF3B30] border border-[#FF3B30]/20'
                }`}>{primeiraLinha.status}</span>
              </div>
              {loadingSaldo[primeiraLinhaClean] && <Loader2 className="w-4 h-4 text-[#007AFF] animate-spin" />}
            </div>

            {/* Data gauge */}
            <DataGauge
              usedMb={consumoPrincipal?.success ? consumoPrincipal.consumo_dados_mb : 0}
              totalMb={getFranchiseMb(primeiraLinha)}
              label="Consumo de Dados"
            />

            {/* Saldo */}
            {saldoPrincipal?.success && (
              <div className="mt-4 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500 font-outfit uppercase tracking-wider">Saldo Restante</span>
                  <span className="font-outfit text-lg font-bold text-[#34C759]">
                    {formatBytes(saldoPrincipal.balance_mb)} {formatBytesUnit(saldoPrincipal.balance_mb)}
                  </span>
                </div>
              </div>
            )}

            {/* Plan info */}
            {primeiraLinha.plano_nome && (
              <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                <span className="text-xs text-zinc-300">Plano</span>
                <span className="text-sm text-white font-semibold">{primeiraLinha.plano_nome}</span>
              </div>
            )}
            {primeiraLinha.oferta_nome && (
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-zinc-300">Oferta</span>
                <span className="text-sm text-zinc-300">{primeiraLinha.oferta_nome}</span>
              </div>
            )}
          </div>
        )}

        {/* Stats grid: Minutes + SMS */}
        {primeiraLinha && (
          <div className="grid grid-cols-2 gap-3" data-testid="portal-stats-grid">
            <StatCard
              icon={Phone}
              label="Minutos"
              value={consumoPrincipal?.success && consumoPrincipal.consumo_minutos != null ? Number(consumoPrincipal.consumo_minutos).toFixed(0) : '0'}
              unit="min"
              color="#007AFF"
            />
            <StatCard
              icon={MessageSquare}
              label="SMS"
              value={consumoPrincipal?.success ? (consumoPrincipal.consumo_sms ?? '0') : '0'}
              unit=""
              color="#FF9500"
            />
          </div>
        )}

        {/* Additional lines (if more than 1) */}
        {linhas.length > 1 && (
          <section>
            <h3 className="font-outfit text-lg font-bold text-white mb-3 flex items-center gap-2">
              <Signal className="w-5 h-5 text-[#007AFF]" />
              Outras Linhas
            </h3>
            <div className="space-y-2">
              {linhas.slice(1).map((linha) => {
                const numClean = (linha.numero || '').replace(/\D/g, '');
                const isExpanded = expandedLine === numClean;
                const saldo = saldos[numClean];
                const consumo = consumos[numClean];
                const isSaldoLoading = loadingSaldo[numClean];
                const isConsumoLoading = loadingConsumo[numClean];
                const franchiseMb = getFranchiseMb(linha);

                return (
                  <div key={linha.id} className="bg-[#141414] border border-white/10 rounded-lg overflow-hidden" data-testid={`portal-line-${numClean}`}>
                    <button
                      className="w-full text-left p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                      onClick={() => handleExpandLine(linha.numero)}
                      data-testid={`portal-line-toggle-${numClean}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-[#007AFF]/10 flex items-center justify-center shrink-0">
                          <Phone className="w-4 h-4 text-[#007AFF]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-mono font-semibold text-sm">{formatPhone(linha.numero)}</p>
                          <p className="text-xs text-zinc-500 truncate">{linha.plano_nome || 'Sem plano'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                          ['ativo','active'].includes((linha.status||'').toLowerCase())
                            ? 'bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/20'
                            : 'bg-[#FF3B30]/10 text-[#FF3B30] border border-[#FF3B30]/20'
                        }`}>{linha.status}</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-white/5 p-4 space-y-4">
                        <DataGauge
                          usedMb={consumo?.success ? consumo.consumo_dados_mb : 0}
                          totalMb={franchiseMb}
                          label="Consumo de Dados"
                        />
                        {saldo?.success && (
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-500">Saldo Restante</span>
                            <span className="font-bold text-[#34C759]">{formatBytes(saldo.balance_mb)} {formatBytesUnit(saldo.balance_mb)}</span>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          <StatCard icon={Phone} label="Minutos" value={consumo?.success ? Number(consumo.consumo_minutos || 0).toFixed(0) : '...'} unit="min" color="#007AFF" />
                          <StatCard icon={MessageSquare} label="SMS" value={consumo?.success ? (consumo.consumo_sms ?? '0') : '...'} unit="" color="#FF9500" />
                        </div>
                        {(isSaldoLoading || isConsumoLoading) && (
                          <div className="flex items-center justify-center py-2">
                            <Loader2 className="w-4 h-4 text-[#007AFF] animate-spin" />
                            <span className="text-xs text-zinc-500 ml-2">Atualizando...</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Faturas */}
        <section>
          <h3 className="font-outfit text-lg font-bold text-white mb-3 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#007AFF]" />
            Faturas
          </h3>

          {cobrancas.length === 0 ? (
            <div className="bg-[#141414] border border-white/10 rounded-lg p-8 text-center">
              <CreditCard className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-zinc-500 text-sm">Nenhuma fatura encontrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cobrancas.map((cob) => {
                const info = cobrancaStatusInfo(cob.status);
                const StatusIcon = info.icon;
                const hasPix = cob.asaas_pix_code && cob.status === 'PENDING';
                const isCopied = copiedPix === cob.id;

                return (
                  <div key={cob.id} className="bg-[#141414] border border-white/10 rounded-lg p-4" data-testid={`portal-fatura-${cob.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-outfit text-lg font-bold text-white">
                            {formatCurrency(cob.valor)}
                          </span>
                          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md border ${info.bg} ${info.color} ${info.border}`}>
                            <StatusIcon className="w-3 h-3" />
                            {info.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-300">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(cob.vencimento)}
                          </span>
                          <span>{billingTypeLabel(cob.billing_type)}</span>
                        </div>
                        {cob.descricao && (
                          <p className="text-xs text-zinc-600 mt-1 truncate">{cob.descricao}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        {cob.asaas_invoice_url && (
                          <a
                            href={cob.asaas_invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#007AFF] hover:text-[#3395FF] px-3 py-2 rounded-lg border border-[#007AFF]/20 hover:border-[#007AFF]/40 bg-[#007AFF]/5 transition-colors"
                            data-testid={`portal-fatura-link-${cob.id}`}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Ver
                          </a>
                        )}
                      </div>
                    </div>

                    {/* PIX copy */}
                    {hasPix && (
                      <div className="mt-3 pt-3 border-t border-white/5">
                        <button
                          onClick={() => handleCopyPix(cob.asaas_pix_code, cob.id)}
                          className={`w-full flex items-center justify-center gap-2 text-sm font-bold py-3 rounded-lg transition-all ${
                            isCopied
                              ? 'bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/20'
                              : 'bg-[#007AFF] hover:bg-[#3395FF] text-white'
                          }`}
                          data-testid={`portal-copy-pix-${cob.id}`}
                        >
                          {isCopied ? (
                            <><Check className="w-4 h-4" /> Copiado!</>
                          ) : (
                            <><Copy className="w-4 h-4" /> Copiar codigo PIX</>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 mt-8">
        <div className="max-w-lg mx-auto px-4 py-5 text-center">
          <img src="/logo96.png" alt="HomeOn" className="w-8 h-8 rounded-md mx-auto mb-2 opacity-40" onError={(e) => { e.target.style.display = 'none'; }} />
          <p className="text-[11px] text-zinc-600 font-outfit">HomeOn Internet &mdash; Telefonia Movel</p>
        </div>
      </footer>
    </div>
  );
}
