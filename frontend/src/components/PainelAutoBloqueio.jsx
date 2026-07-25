import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import {
  RefreshCw, Loader2, Send, ShieldCheck, AlertTriangle,
  CheckCircle2, XCircle, Clock, Filter, Download, MessageCircle,
  Zap, TrendingUp, Users, ShieldOff,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Config visual dos badges por situacao
const SITUACAO_CONFIG = {
  em_dia:        { label: 'EM DIA',       color: 'bg-emerald-900/40 text-emerald-300 border-emerald-700', order: 6 },
  avisar:        { label: 'AVISAR',       color: 'bg-yellow-900/40 text-yellow-300 border-yellow-700',    order: 3 },
  vence_hoje:    { label: 'VENCE HOJE',   color: 'bg-orange-900/40 text-orange-300 border-orange-700',    order: 2 },
  vencido:       { label: 'VENCIDO',      color: 'bg-red-900/40 text-red-300 border-red-700',             order: 1 },
  bloqueado:     { label: 'BLOQUEADO',    color: 'bg-zinc-800 text-zinc-400 border-zinc-700',             order: 7 },
  confianca:     { label: 'CONFIANÇA',    color: 'bg-blue-900/40 text-blue-300 border-blue-700',          order: 5 },
  vip:           { label: 'VIP',          color: 'bg-purple-900/40 text-purple-300 border-purple-700',    order: 8 },
  sem_expiracao: { label: 'SEM EXP TÁ',   color: 'bg-zinc-900/50 text-zinc-500 border-zinc-800 border-dashed', order: 9 },
};

const BOLETO_STATUS_LABEL = {
  pago:     { label: '✓ Pago',     className: 'text-emerald-400' },
  pendente: { label: 'Pendente',   className: 'text-yellow-400' },
  vencido:  { label: 'Vencido',    className: 'text-red-400' },
};

const formatBR = (iso) => {
  if (!iso) return '—';
  try {
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  } catch {
    return iso;
  }
};

const formatBRL = (v) => (v == null ? '—' : `R$ ${Number(v).toFixed(2).replace('.', ',')}`);

export default function PainelAutoBloqueio() {
  const [painel, setPainel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtroSituacao, setFiltroSituacao] = useState('todos');
  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState(new Set());
  const [enviando, setEnviando] = useState(false);
  const [editando, setEditando] = useState(null); // linha_id em edicao
  const [novaData, setNovaData] = useState('');
  const [loteExpOpen, setLoteExpOpen] = useState(false);
  const [novaDataLote, setNovaDataLote] = useState('');

  const carregar = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/automacao/bloqueio/painel`, { withCredentials: true });
      setPainel(data);
    } catch (e) {
      toast.error('Erro ao carregar painel: ' + (e.response?.data?.detail || e.message));
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const itensFiltrados = useMemo(() => {
    if (!painel) return [];
    let arr = painel.itens || [];
    if (filtroSituacao !== 'todos') {
      arr = arr.filter(it => it.situacao === filtroSituacao);
    }
    if (busca.trim()) {
      const q = busca.toLowerCase().trim();
      arr = arr.filter(it =>
        (it.cliente_nome || '').toLowerCase().includes(q) ||
        (it.documento || '').includes(q) ||
        (it.telefone || '').includes(q) ||
        (it.msisdn || '').includes(q)
      );
    }
    // Ordenar: por urgencia (vencido, vence_hoje, avisar, ...)
    arr = [...arr].sort((a, b) => {
      const oa = SITUACAO_CONFIG[a.situacao]?.order || 99;
      const ob = SITUACAO_CONFIG[b.situacao]?.order || 99;
      if (oa !== ob) return oa - ob;
      return (a.dias_ate_bloqueio ?? 999) - (b.dias_ate_bloqueio ?? 999);
    });
    return arr;
  }, [painel, filtroSituacao, busca]);

  const toggleSel = (linha_id) => {
    const s = new Set(selecionados);
    if (s.has(linha_id)) s.delete(linha_id);
    else s.add(linha_id);
    setSelecionados(s);
  };

  const toggleSelTodos = () => {
    if (selecionados.size === itensFiltrados.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(itensFiltrados.map(i => i.linha_id)));
    }
  };

  const enviarLembretes = async (tipo) => {
    if (selecionados.size === 0) {
      toast.error('Selecione ao menos 1 linha');
      return;
    }
    if (!window.confirm(`Enviar lembrete "${tipo === 'd3' ? 'D-3 (3 dias antes)' : 'D-0 (vence hoje)'}" para ${selecionados.size} cliente(s)?`)) return;
    setEnviando(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/automacao/bloqueio/enviar-lembrete`,
        { linha_ids: Array.from(selecionados), tipo },
        { withCredentials: true });
      toast.success(`${data.enviados} enviado(s), ${data.skipped_dedup || 0} pulado(s), ${data.erros?.length || 0} erro(s)`);
      setSelecionados(new Set());
      await carregar();
    } catch (e) {
      toast.error('Erro: ' + (e.response?.data?.detail || e.message));
    }
    setEnviando(false);
  };

  const popularExpiracao = async () => {
    if (!window.confirm('Preencher automaticamente a coluna "Expiração Tá" das linhas vazias usando "Próxima Recarga" (que já é calculada como data_ativação + 30 dias)?')) return;
    setEnviando(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/automacao/bloqueio/popular-expiracao-de-recarga`, {}, { withCredentials: true });
      const semProx = data.sem_proxima_recarga || 0;
      toast.success(
        `${data.atualizadas} preenchida(s). ${data.ja_preenchidas || 0} já tinham. ${semProx > 0 ? `${semProx} sem "Próx.Recarga" (precisam de Sync Tá ou edição manual)` : ''}`
      );
      await carregar();
    } catch (e) {
      toast.error('Erro: ' + (e.response?.data?.detail || e.message));
    }
    setEnviando(false);
  };

  const dispararJobD3 = async () => {
    if (!window.confirm('Disparar o job D-3 agora? (Envia lembrete a TODOS que estao a 3 dias do bloqueio, respeitando dedup)')) return;
    setEnviando(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/automacao/bloqueio/executar-lembrete-d3`, {}, { withCredentials: true });
      toast.success(`D-3: ${data.enviados} enviado(s), ${data.skipped_dedup || 0} dedup, ${data.erros?.length || 0} erro(s)`);
      await carregar();
    } catch (e) {
      toast.error('Erro: ' + (e.response?.data?.detail || e.message));
    }
    setEnviando(false);
  };

  const dispararJobD0 = async () => {
    if (!window.confirm('Disparar o job D-0 agora? (Envia alerta URGENTE a todos que vencem hoje)')) return;
    setEnviando(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/automacao/bloqueio/executar-alerta-d0`, {}, { withCredentials: true });
      toast.success(`D-0: ${data.enviados} enviado(s), ${data.erros?.length || 0} erro(s)`);
      await carregar();
    } catch (e) {
      toast.error('Erro: ' + (e.response?.data?.detail || e.message));
    }
    setEnviando(false);
  };

  const exportarCSV = () => {
    const rows = [[
      'Cliente', 'Documento', 'Telefone', 'MSISDN', 'Boleto Valor', 'Boleto Venc.',
      'Boleto Status', 'Expiração Tá', 'Bloqueio HOMEON', 'Dias', 'Situação'
    ]];
    itensFiltrados.forEach(it => {
      rows.push([
        it.cliente_nome || '',
        it.documento || '',
        it.telefone || '',
        it.msisdn || '',
        it.boleto ? (it.boleto.valor || 0).toFixed(2) : '',
        it.boleto ? formatBR(it.boleto.vencimento) : '',
        it.boleto_status || '',
        formatBR(it.data_expiracao_ta),
        formatBR(it.bloqueio_homeon),
        it.dias_ate_bloqueio ?? '',
        SITUACAO_CONFIG[it.situacao]?.label || it.situacao || ''
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `painel-bloqueio-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const iniciarEdicao = (it) => {
    setEditando(it.linha_id);
    setNovaData(it.data_expiracao_ta || '');
  };

  const salvarEdicao = async (linha_id) => {
    try {
      await axios.put(`${API_URL}/api/automacao/bloqueio/linhas/${linha_id}/data-expiracao-ta`,
        { data_expiracao_ta: novaData || null },
        { withCredentials: true });
      toast.success('Data atualizada');
      setEditando(null);
      setNovaData('');
      await carregar();
    } catch (e) {
      toast.error('Erro: ' + (e.response?.data?.detail || e.message));
    }
  };

  const aplicarLoteExpiracao = async () => {
    if (!novaDataLote || !/^\d{4}-\d{2}-\d{2}$/.test(novaDataLote)) {
      toast.error('Formato inválido. Use YYYY-MM-DD (ex: 2026-08-15)');
      return;
    }
    if (selecionados.size === 0) {
      toast.error('Selecione ao menos 1 linha');
      return;
    }
    if (!window.confirm(`Aplicar data_expiracao_ta = ${novaDataLote} para ${selecionados.size} linha(s)?`)) return;
    try {
      const { data } = await axios.put(`${API_URL}/api/automacao/bloqueio/data-expiracao-ta/lote`,
        { linha_ids: Array.from(selecionados), data_expiracao_ta: novaDataLote },
        { withCredentials: true });
      toast.success(`${data.atualizadas} linha(s) atualizada(s)`);
      setLoteExpOpen(false);
      setNovaDataLote('');
      setSelecionados(new Set());
      await carregar();
    } catch (e) {
      toast.error('Erro: ' + (e.response?.data?.detail || e.message));
    }
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-zinc-500" /></div>;
  }

  const kpis = painel?.kpis || {};

  return (
    <div className="space-y-5" data-testid="painel-auto-bloqueio">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPICard icon={<Users className="w-4 h-4" />} label="Ativas" value={kpis.ativas || 0} color="text-emerald-400" />
        <KPICard icon={<AlertTriangle className="w-4 h-4" />} label="A vencer 7d" value={kpis.a_vencer_7d || 0} color="text-yellow-400" />
        <KPICard icon={<Clock className="w-4 h-4" />} label="Vence HOJE" value={kpis.vence_hoje || 0} color="text-orange-400" />
        <KPICard icon={<ShieldOff className="w-4 h-4" />} label="Bloqueadas" value={kpis.bloqueadas || 0} color="text-red-400" />
        <KPICard icon={<XCircle className="w-4 h-4" />} label="Sem exp. Tá" value={kpis.sem_expiracao || 0} color="text-zinc-500" />
      </div>

      {/* Barra de ações */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="w-4 h-4 text-zinc-500" />
            {['todos', 'vencido', 'vence_hoje', 'avisar', 'em_dia', 'bloqueado', 'confianca', 'vip', 'sem_expiracao'].map(s => (
              <button key={s} onClick={() => setFiltroSituacao(s)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${filtroSituacao === s ? 'border-emerald-500 bg-emerald-900/30 text-emerald-300' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
                data-testid={`filtro-${s}`}>
                {s === 'todos' ? 'Todos' : (SITUACAO_CONFIG[s]?.label || s)}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={carregar} variant="outline" size="sm" disabled={refreshing} className="border-zinc-700" data-testid="btn-atualizar-painel">
              {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
            <Button onClick={exportarCSV} variant="outline" size="sm" className="border-zinc-700" data-testid="btn-export-csv">
              <Download className="w-4 h-4 mr-1" /> CSV
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Input placeholder="Buscar cliente, documento, telefone ou MSISDN..."
            value={busca} onChange={e => setBusca(e.target.value)}
            className="flex-1 min-w-[200px] bg-zinc-900 border-zinc-700"
            data-testid="input-busca-painel" />
          <span className="text-xs text-zinc-500">
            {itensFiltrados.length} linha{itensFiltrados.length !== 1 ? 's' : ''}
            {selecionados.size > 0 && <span className="ml-2 text-emerald-400">({selecionados.size} sel.)</span>}
          </span>
        </div>

        {/* Ações em massa (quando ha selecionados) */}
        {selecionados.size > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-800">
            <Button onClick={() => enviarLembretes('d3')} disabled={enviando}
              className="bg-yellow-700 hover:bg-yellow-600 text-white" size="sm" data-testid="btn-lembrete-d3-massa">
              <MessageCircle className="w-4 h-4 mr-1" /> Enviar lembrete D-3 ({selecionados.size})
            </Button>
            <Button onClick={() => enviarLembretes('d0')} disabled={enviando}
              className="bg-orange-700 hover:bg-orange-600 text-white" size="sm" data-testid="btn-lembrete-d0-massa">
              <Send className="w-4 h-4 mr-1" /> Enviar alerta D-0 ({selecionados.size})
            </Button>
            <Button onClick={() => setLoteExpOpen(true)} size="sm"
              className="bg-blue-700 hover:bg-blue-600 text-white" data-testid="btn-editar-exp-lote">
              <Zap className="w-4 h-4 mr-1" /> Definir Expiração Tá em lote
            </Button>
            <Button onClick={() => setSelecionados(new Set())} variant="outline" size="sm" className="border-zinc-700">
              Limpar seleção
            </Button>
          </div>
        )}

        {/* Ações globais (disparar jobs manualmente) */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-800">
          <span className="text-xs text-zinc-500 self-center mr-2">Disparar agora (respeita dedup):</span>
          <Button onClick={dispararJobD3} disabled={enviando} size="sm"
            variant="outline" className="border-yellow-800 text-yellow-300 hover:bg-yellow-900/20" data-testid="btn-disparar-d3">
            <Zap className="w-4 h-4 mr-1" /> Job D-3 completo
          </Button>
          <Button onClick={dispararJobD0} disabled={enviando} size="sm"
            variant="outline" className="border-orange-800 text-orange-300 hover:bg-orange-900/20" data-testid="btn-disparar-d0">
            <Zap className="w-4 h-4 mr-1" /> Job D-0 completo
          </Button>
          <Button onClick={popularExpiracao} disabled={enviando} size="sm"
            variant="outline" className="border-emerald-800 text-emerald-300 hover:bg-emerald-900/20" data-testid="btn-popular-exp">
            <TrendingUp className="w-4 h-4 mr-1" /> Preencher Expiração Tá vazia (via Próx.Recarga)
          </Button>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-xs" data-testid="tabela-painel">
            <thead className="bg-zinc-900 sticky top-0 z-10">
              <tr className="text-left text-zinc-400">
                <th className="p-2 w-8">
                  <input type="checkbox"
                    checked={itensFiltrados.length > 0 && selecionados.size === itensFiltrados.length}
                    onChange={toggleSelTodos}
                    data-testid="check-todos" />
                </th>
                <th className="p-2">Cliente / MSISDN</th>
                <th className="p-2">Boleto</th>
                <th className="p-2">Expiração Tá</th>
                <th className="p-2">Bloqueio HOMEON</th>
                <th className="p-2">Dias</th>
                <th className="p-2">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {itensFiltrados.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-zinc-500">Nenhuma linha para os filtros atuais</td></tr>
              )}
              {itensFiltrados.map((it) => {
                const sitCfg = SITUACAO_CONFIG[it.situacao] || SITUACAO_CONFIG.sem_expiracao;
                const bStatus = BOLETO_STATUS_LABEL[it.boleto_status];
                return (
                  <tr key={it.linha_id} className="hover:bg-zinc-900/50" data-testid={`linha-${it.linha_id}`}>
                    <td className="p-2">
                      <input type="checkbox" checked={selecionados.has(it.linha_id)}
                        onChange={() => toggleSel(it.linha_id)}
                        data-testid={`check-${it.linha_id}`} />
                    </td>
                    <td className="p-2">
                      <div className="font-medium">{it.cliente_nome}</div>
                      <div className="text-zinc-500 font-mono">{it.msisdn}</div>
                    </td>
                    <td className="p-2">
                      {it.boleto ? (
                        <>
                          <div className="font-medium">{formatBRL(it.boleto.valor)}</div>
                          <div className={`text-[10px] ${bStatus?.className || 'text-zinc-500'}`}>
                            {bStatus?.label} {it.boleto.vencimento ? `• ${formatBR(it.boleto.vencimento)}` : ''}
                          </div>
                        </>
                      ) : it.boleto_status === 'pago' ? (
                        <span className="text-emerald-400">✓ pago no ciclo</span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="p-2 font-mono">
                      {editando === it.linha_id ? (
                        <div className="flex gap-1 items-center">
                          <input type="date" value={novaData}
                            onChange={(e) => setNovaData(e.target.value)}
                            className="bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-xs"
                            data-testid={`input-exp-${it.linha_id}`}
                            autoFocus />
                          <button onClick={() => salvarEdicao(it.linha_id)}
                            className="text-emerald-400 hover:text-emerald-300 text-xs px-1"
                            title="Salvar" data-testid={`btn-salvar-exp-${it.linha_id}`}>✓</button>
                          <button onClick={() => { setEditando(null); setNovaData(''); }}
                            className="text-red-400 hover:text-red-300 text-xs px-1"
                            title="Cancelar">✕</button>
                        </div>
                      ) : (
                        <button onClick={() => iniciarEdicao(it)}
                          className="text-left hover:bg-zinc-800 rounded px-1 py-0.5 min-w-[80px]"
                          title="Clique para editar" data-testid={`edit-exp-${it.linha_id}`}>
                          {it.data_expiracao_ta ? formatBR(it.data_expiracao_ta) : <span className="text-zinc-600 italic">— editar</span>}
                        </button>
                      )}
                    </td>
                    <td className="p-2 font-mono text-yellow-300">{formatBR(it.bloqueio_homeon)}</td>
                    <td className="p-2 text-center">
                      {it.dias_ate_bloqueio != null ? (
                        <span className={
                          it.dias_ate_bloqueio < 0 ? 'text-red-400 font-bold' :
                          it.dias_ate_bloqueio === 0 ? 'text-orange-400 font-bold' :
                          it.dias_ate_bloqueio <= 3 ? 'text-yellow-400' : 'text-zinc-400'
                        }>
                          {it.dias_ate_bloqueio > 0 ? `+${it.dias_ate_bloqueio}` : it.dias_ate_bloqueio}
                        </span>
                      ) : <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="p-2">
                      <span className={`inline-block text-[10px] px-2 py-0.5 rounded border font-semibold ${sitCfg.color}`}
                        data-testid={`sit-${it.situacao}`}>
                        {sitCfg.label}
                      </span>
                      {it.lembrete_d3_enviado && it.situacao === 'avisar' && (
                        <div className="text-[9px] text-emerald-500 mt-0.5">✓ lembrete enviado</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {/* Modal edicao em lote */}
      {loteExpOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setLoteExpOpen(false)}>
          <div className="bg-zinc-950 border border-zinc-700 rounded-lg p-6 max-w-md w-full space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-emerald-400">Definir Expiração Tá em lote</h3>
            <p className="text-sm text-zinc-400">
              {selecionados.size} linha(s) selecionada(s). Todas ficarão com a mesma data de expiração Tá — o Bloqueio HOMEON será calculado automaticamente (= expiração − 2 dias).
            </p>
            <div>
              <label className="text-xs text-zinc-400 block mb-1">Nova data de Expiração Tá</label>
              <input type="date" value={novaDataLote}
                onChange={e => setNovaDataLote(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
                data-testid="input-exp-lote" />
              <p className="text-xs text-zinc-500 mt-1">Formato: YYYY-MM-DD (ex: 2026-08-15)</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button onClick={() => { setLoteExpOpen(false); setNovaDataLote(''); }} variant="outline" size="sm" className="border-zinc-700">
                Cancelar
              </Button>
              <Button onClick={aplicarLoteExpiracao} className="bg-emerald-600 hover:bg-emerald-500" size="sm" data-testid="btn-aplicar-lote">
                Aplicar a {selecionados.size} linha(s)
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KPICard({ icon, label, value, color }) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
      <div className={`flex items-center gap-1 text-xs ${color}`}>
        {icon}<span>{label}</span>
      </div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}
