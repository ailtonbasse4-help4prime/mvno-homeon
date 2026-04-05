import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import {
  Smartphone, Signal, Wifi, MessageSquare, Clock, LogOut,
  RefreshCw, ExternalLink, FileText, Loader2, AlertCircle,
  Phone, User, CreditCard, ChevronDown, ChevronUp, BarChart3,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

function getPortalAuth() {
  const token = sessionStorage.getItem('portal_token');
  const cliente = JSON.parse(sessionStorage.getItem('portal_cliente') || 'null');
  return { token, cliente };
}

function portalHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

function formatBytes(mb) {
  if (mb == null || isNaN(mb)) return '—';
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${Number(mb).toFixed(0)} MB`;
}

function formatPhone(num) {
  if (!num) return '—';
  const d = num.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return num;
}

function statusBadge(status) {
  const s = (status || '').toLowerCase();
  if (s === 'ativo' || s === 'active') return 'badge-active';
  if (s === 'bloqueado' || s === 'blocked' || s === 'suspended') return 'badge-blocked';
  if (s === 'pendente' || s === 'pending') return 'badge-pending';
  return 'badge-inactive';
}

function cobrancaStatusBadge(status) {
  const s = (status || '').toUpperCase();
  if (s === 'RECEIVED' || s === 'CONFIRMED' || s === 'RECEIVED_IN_CASH') return 'badge-active';
  if (s === 'OVERDUE') return 'badge-blocked';
  if (s === 'PENDING') return 'badge-pending';
  return 'badge-inactive';
}

function cobrancaStatusLabel(status) {
  const labels = {
    PENDING: 'Pendente', RECEIVED: 'Pago', CONFIRMED: 'Confirmado',
    OVERDUE: 'Vencido', REFUNDED: 'Estornado', RECEIVED_IN_CASH: 'Pago',
    REFUND_REQUESTED: 'Estorno Solicitado', CHARGEBACK_REQUESTED: 'Chargeback',
    CHARGEBACK_DISPUTE: 'Em Disputa', AWAITING_CHARGEBACK_REVERSAL: 'Aguardando Reversao',
    DUNNING_REQUESTED: 'Cobranca', DUNNING_RECEIVED: 'Cobranca Recebida',
  };
  return labels[status] || status || 'Desconhecido';
}

function billingTypeLabel(bt) {
  if (bt === 'PIX') return 'Pix';
  if (bt === 'BOLETO') return 'Boleto';
  if (bt === 'CREDIT_CARD') return 'Cartao';
  return bt || '—';
}

export default function PortalDashboard() {
  const navigate = useNavigate();
  const { token, cliente } = getPortalAuth();

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Saldo & consumo per line
  const [saldos, setSaldos] = useState({});
  const [consumos, setConsumos] = useState({});
  const [loadingSaldo, setLoadingSaldo] = useState({});
  const [loadingConsumo, setLoadingConsumo] = useState({});
  const [expandedLine, setExpandedLine] = useState(null);

  // If not authenticated, redirect
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
    if (expandedLine === clean) {
      setExpandedLine(null);
      return;
    }
    setExpandedLine(clean);
    if (!saldos[clean]) fetchSaldo(numero);
    if (!consumos[clean]) fetchConsumo(numero);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('portal_token');
    sessionStorage.removeItem('portal_cliente');
    navigate('/portal', { replace: true });
  };

  if (!token || !cliente) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="bg-zinc-900 border-zinc-800 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-white mb-4">{error}</p>
            <Button onClick={fetchDashboard} className="btn-primary" data-testid="portal-retry-btn">
              <RefreshCw className="w-4 h-4 mr-2" /> Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const linhas = dashboard?.linhas || [];
  const cobrancas = dashboard?.cobrancas || [];
  const cli = dashboard?.cliente || cliente;

  return (
    <div className="min-h-screen bg-background" data-testid="portal-dashboard">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-zinc-950 border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-sm bg-blue-600 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">Portal do Cliente</h1>
              <p className="text-xs text-zinc-500 hidden sm:block">{cli.nome}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchDashboard}
              className="text-zinc-400 hover:text-white"
              data-testid="portal-refresh-btn"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-zinc-400 hover:text-red-400"
              data-testid="portal-logout-btn"
            >
              <LogOut className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline text-sm">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Cliente info */}
        <Card className="bg-zinc-900 border-zinc-800" data-testid="portal-client-info">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                <User className="w-6 h-6 text-blue-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-white truncate">{cli.nome}</h2>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-zinc-400">
                  {cli.documento && (
                    <span className="font-mono">{formatCPFDisplay(cli.documento)}</span>
                  )}
                  {cli.email && <span>{cli.email}</span>}
                  {cli.telefone && <span>{formatPhone(cli.telefone)}</span>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Linhas */}
        <section>
          <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            <Signal className="w-5 h-5 text-blue-400" />
            Minhas Linhas
          </h3>

          {linhas.length === 0 ? (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-8 text-center text-zinc-500">
                Nenhuma linha encontrada.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {linhas.map((linha) => {
                const numClean = (linha.numero || '').replace(/\D/g, '');
                const isExpanded = expandedLine === numClean;
                const saldo = saldos[numClean];
                const consumo = consumos[numClean];
                const isSaldoLoading = loadingSaldo[numClean];
                const isConsumoLoading = loadingConsumo[numClean];

                return (
                  <Card key={linha.id} className="bg-zinc-900 border-zinc-800" data-testid={`portal-line-${numClean}`}>
                    <CardContent className="p-0">
                      {/* Line header - clickable */}
                      <button
                        className="w-full text-left p-4 flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
                        onClick={() => handleExpandLine(linha.numero)}
                        data-testid={`portal-line-toggle-${numClean}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Phone className="w-5 h-5 text-zinc-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-white font-mono font-semibold text-sm">
                              {formatPhone(linha.numero)}
                            </p>
                            <p className="text-xs text-zinc-500 truncate">
                              {linha.plano_nome || 'Sem plano'}{linha.oferta_nome ? ` — ${linha.oferta_nome}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={statusBadge(linha.status)}>
                            {linha.status || 'desconhecido'}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-zinc-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-zinc-500" />
                          )}
                        </div>
                      </button>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="border-t border-zinc-800 p-4 space-y-4" data-testid={`portal-line-details-${numClean}`}>
                          {/* ICCID */}
                          {linha.iccid && (
                            <p className="text-xs text-zinc-500">
                              ICCID: <span className="font-mono text-zinc-400">{linha.iccid}</span>
                            </p>
                          )}

                          {/* Saldo e Consumo cards */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Saldo de dados */}
                            <div className="bg-zinc-950 border border-zinc-800 rounded-sm p-4">
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                                  <Wifi className="w-3.5 h-3.5" /> Saldo de Dados
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-zinc-500 hover:text-white"
                                  onClick={(e) => { e.stopPropagation(); fetchSaldo(linha.numero); }}
                                  disabled={isSaldoLoading}
                                  data-testid={`portal-saldo-refresh-${numClean}`}
                                >
                                  <RefreshCw className={`w-3 h-3 ${isSaldoLoading ? 'animate-spin' : ''}`} />
                                </Button>
                              </div>
                              {isSaldoLoading ? (
                                <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                              ) : saldo?.success ? (
                                <p className="text-2xl font-bold text-white font-mono" data-testid={`portal-saldo-value-${numClean}`}>
                                  {formatBytes(saldo.balance_mb)}
                                </p>
                              ) : saldo ? (
                                <p className="text-sm text-zinc-500">{saldo.message || 'Indisponivel'}</p>
                              ) : (
                                <p className="text-sm text-zinc-500">Carregando...</p>
                              )}
                            </div>

                            {/* Consumo do mes */}
                            <div className="bg-zinc-950 border border-zinc-800 rounded-sm p-4">
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                                  <BarChart3 className="w-3.5 h-3.5" /> Consumo do Mes
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-zinc-500 hover:text-white"
                                  onClick={(e) => { e.stopPropagation(); fetchConsumo(linha.numero); }}
                                  disabled={isConsumoLoading}
                                  data-testid={`portal-consumo-refresh-${numClean}`}
                                >
                                  <RefreshCw className={`w-3 h-3 ${isConsumoLoading ? 'animate-spin' : ''}`} />
                                </Button>
                              </div>
                              {isConsumoLoading ? (
                                <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                              ) : consumo?.success ? (
                                <div className="space-y-2" data-testid={`portal-consumo-values-${numClean}`}>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-zinc-400 flex items-center gap-1.5">
                                      <Wifi className="w-3 h-3" /> Dados
                                    </span>
                                    <span className="text-white font-mono">
                                      {consumo.consumo_dados_gb != null ? `${Number(consumo.consumo_dados_gb).toFixed(2)} GB` : '—'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-zinc-400 flex items-center gap-1.5">
                                      <Phone className="w-3 h-3" /> Minutos
                                    </span>
                                    <span className="text-white font-mono">
                                      {consumo.consumo_minutos != null ? `${Number(consumo.consumo_minutos).toFixed(1)} min` : '—'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-zinc-400 flex items-center gap-1.5">
                                      <MessageSquare className="w-3 h-3" /> SMS
                                    </span>
                                    <span className="text-white font-mono">
                                      {consumo.consumo_sms ?? '—'}
                                    </span>
                                  </div>
                                </div>
                              ) : consumo ? (
                                <p className="text-sm text-zinc-500">{consumo.message || 'Indisponivel'}</p>
                              ) : (
                                <p className="text-sm text-zinc-500">Carregando...</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Faturas / Cobrancas */}
        <section>
          <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-400" />
            Minhas Faturas
          </h3>

          {cobrancas.length === 0 ? (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-8 text-center text-zinc-500">
                Nenhuma fatura encontrada.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {cobrancas.map((cob) => (
                <Card key={cob.id} className="bg-zinc-900 border-zinc-800" data-testid={`portal-fatura-${cob.id}`}>
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-mono font-semibold text-sm">
                            R$ {Number(cob.valor).toFixed(2)}
                          </span>
                          <span className={cobrancaStatusBadge(cob.status)}>
                            {cobrancaStatusLabel(cob.status)}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {billingTypeLabel(cob.billing_type)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                          {cob.vencimento && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Venc: {cob.vencimento}
                            </span>
                          )}
                          {cob.descricao && (
                            <span className="truncate max-w-[200px]">{cob.descricao}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {cob.asaas_invoice_url && (
                          <a
                            href={cob.asaas_invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors px-3 py-1.5 rounded-sm border border-blue-500/20 hover:border-blue-500/40 bg-blue-500/5"
                            data-testid={`portal-fatura-link-${cob.id}`}
                          >
                            <ExternalLink className="w-3 h-3" />
                            Ver Fatura
                          </a>
                        )}
                        {cob.barcode && !cob.asaas_invoice_url && (
                          <span
                            className="text-xs text-zinc-500 font-mono truncate max-w-[160px]"
                            title={cob.barcode}
                          >
                            {cob.barcode}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 mt-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 text-center text-xs text-zinc-600">
          Portal do Cliente &mdash; MVNO Manager
        </div>
      </footer>
    </div>
  );
}

function formatCPFDisplay(doc) {
  if (!doc) return '';
  const d = doc.replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return doc;
}
