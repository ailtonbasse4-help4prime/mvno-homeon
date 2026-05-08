import { useEffect, useState, useMemo, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Search, Download, Upload, RefreshCw, DollarSign, TrendingUp, Wallet, Percent, Save, X as XIcon, Signal, Receipt } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatDateBR, formatDateTimeBR } from '../lib/formatters';
import { StatCard } from '../components/StatCard';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const brl = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const normalize = (s) => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const statusChipColors = {
  'FS': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  'NP': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  'BLOQ.PARC': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  'BLOQ.TOTAL': 'bg-red-500/10 text-red-400 border-red-500/30',
  'CANCELADO': 'bg-zinc-700/30 text-zinc-400 border-zinc-700',
};

const statusLinhaColors = {
  ativo: 'bg-emerald-500/10 text-emerald-400',
  suspenso: 'bg-amber-500/10 text-amber-400',
  cancelado: 'bg-zinc-700/30 text-zinc-400',
  bloqueado: 'bg-red-500/10 text-red-400',
};

export default function PlanilhaOperacional() {
  const { isAdmin } = useAuth();
  const [linhas, setLinhas] = useState([]);
  const [resumo, setResumo] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterBloqueio, setFilterBloqueio] = useState('');
  const [filterCanal, setFilterCanal] = useState('');
  const [editingCell, setEditingCell] = useState(null); // { id, field }
  const [editValue, setEditValue] = useState('');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [syncingTa, setSyncingTa] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null); // {processadas, total, atualizadas}
  const [syncingAsaas, setSyncingAsaas] = useState(false);
  const [lastSyncTa, setLastSyncTa] = useState(() => {
    try { return localStorage.getItem('last_sync_tatelecom'); } catch { return null; }
  });
  const fileInputRef = useRef(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API_URL}/api/operacional/planilha`, { withCredentials: true });
      setLinhas(r.data.linhas || []);
      setResumo(r.data.resumo || {});
    } catch (e) {
      toast.error('Erro ao carregar planilha');
    }
    setLoading(false);
  };

  const syncTaTelecom = async () => {
    if (!window.confirm('Sincronizar status dos chips com a Ta Telecom? Apenas o status (Ativo/Bloq./etc) sera atualizado. A coluna "Recarga Ta" NAO sera tocada.')) return;
    setSyncingTa(true);
    try {
      const r = await axios.post(`${API_URL}/api/operacional/sincronizar-tatelecom`, {}, { withCredentials: true, timeout: 30000 });
      if (r.data.status === 'already_running') {
        toast.info('Ja existe uma sincronizacao em andamento');
      } else {
        toast.success('Sincronizacao iniciada (apenas status do chip) - acompanhe no rodape');
      }
      const poll = setInterval(async () => {
        try {
          const s = await axios.get(`${API_URL}/api/operacional/sync-status/tatelecom`, { withCredentials: true });
          const st = s.data;
          if (st.status === 'completed') {
            clearInterval(poll);
            setSyncingTa(false);
            toast.success(`Status sincronizado: ${st.atualizadas}/${st.total} linhas${st.erros ? ` (${st.erros} erros)` : ''}`);
            const now = new Date().toISOString();
            setLastSyncTa(now);
            try { localStorage.setItem('last_sync_tatelecom', now); } catch {}
            fetchData();
          } else if (st.status === 'error') {
            clearInterval(poll);
            setSyncingTa(false);
            toast.error(`Erro: ${st.error_message || 'desconhecido'}`);
          } else if (st.status === 'running') {
            setSyncProgress({ processadas: st.processadas || 0, total: st.total || 0, atualizadas: st.atualizadas || 0 });
          }
        } catch (err) {
          // mantem polling
        }
      }, 3000);
      setTimeout(() => { clearInterval(poll); setSyncingTa(false); }, 900000);
    } catch (e) {
      setSyncingTa(false);
      toast.error(e.response?.data?.detail || 'Erro ao iniciar sincronizacao');
    }
  };

  const syncAsaas = async () => {
    setSyncingAsaas(true);
    try {
      const r = await axios.post(`${API_URL}/api/carteira/sincronizar-asaas`, {}, { withCredentials: true, timeout: 180000 });
      const { imported, total_asaas } = r.data;
      toast.success(`${imported} cobranca(s) importada(s) de ${total_asaas} no Asaas`);
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao importar do Asaas');
    }
    setSyncingAsaas(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Ao montar, checa se ja existe sync em andamento
  useEffect(() => {
    let poll = null;
    const checkJob = async () => {
      try {
        const s = await axios.get(`${API_URL}/api/operacional/sync-status/tatelecom`, { withCredentials: true });
        const st = s.data;
        if (st.status === 'running') {
          setSyncingTa(true);
          setSyncProgress({ processadas: st.processadas || 0, total: st.total || 0, atualizadas: st.atualizadas || 0 });
          poll = setInterval(async () => {
            try {
              const r2 = await axios.get(`${API_URL}/api/operacional/sync-status/tatelecom`, { withCredentials: true });
              const s2 = r2.data;
              if (s2.status === 'completed') {
                clearInterval(poll);
                setSyncingTa(false);
                setSyncProgress(null);
                toast.success(`Sync concluida: ${s2.atualizadas}/${s2.total} linhas`);
                fetchData();
              } else if (s2.status === 'running') {
                setSyncProgress({ processadas: s2.processadas || 0, total: s2.total || 0, atualizadas: s2.atualizadas || 0 });
              } else {
                clearInterval(poll);
                setSyncingTa(false);
                setSyncProgress(null);
              }
            } catch {}
          }, 3000);
        } else if (st.iniciado_em && st.status === 'completed') {
          setLastSyncTa(st.finalizado_em || st.iniciado_em);
        }
      } catch {}
    };
    checkJob();
    return () => { if (poll) clearInterval(poll); };
  }, []);

  const canais = useMemo(() => {
    const set = new Set(linhas.map(l => l.canal).filter(Boolean));
    return Array.from(set).sort();
  }, [linhas]);

  const filtered = useMemo(() => {
    let res = linhas;
    if (search) {
      const s = normalize(search);
      res = res.filter(l =>
        normalize(l.cliente_nome).includes(s) ||
        normalize(l.cpf).includes(s) ||
        normalize(l.numero).includes(s) ||
        normalize(l.iccid).includes(s) ||
        normalize(l.email || '').includes(s)
      );
    }
    if (filterStatus === 'recarga_ordem') {
      // Ordena pela coluna Recarga Tá (expirar_dados) crescente — mais proximos primeiro
      res = [...res].sort((a, b) => {
        const da = a.expirar_dados || '9999-12-31';
        const db = b.expirar_dados || '9999-12-31';
        return da.localeCompare(db);
      });
    } else if (filterStatus === 'recarga_7dias') {
      // So linhas com Recarga Ta nos proximos 7 dias (inclui hoje), ordenadas crescente
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const limite = new Date(hoje);
      limite.setDate(limite.getDate() + 7);
      const hojeIso = hoje.toISOString().slice(0, 10);
      const limiteIso = limite.toISOString().slice(0, 10);
      res = res.filter(l => l.expirar_dados && l.expirar_dados >= hojeIso && l.expirar_dados <= limiteIso);
      res = [...res].sort((a, b) => (a.expirar_dados || '').localeCompare(b.expirar_dados || ''));
    } else if (filterStatus) {
      res = res.filter(l => l.status_linha === filterStatus);
    }
    if (filterBloqueio) res = res.filter(l => (l.status_chip || '') === filterBloqueio);
    if (filterCanal) res = res.filter(l => (l.canal || '') === filterCanal);
    return res;
  }, [linhas, search, filterStatus, filterBloqueio, filterCanal]);

  const startEdit = (id, field, currentValue) => {
    if (!isAdmin) return;
    setEditingCell({ id, field });
    setEditValue(currentValue || '');
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const saveEdit = async () => {
    if (!editingCell) return;
    const { id, field } = editingCell;
    try {
      let payloadValue = editValue;
      if (field === 'desconto') {
        const num = parseFloat(String(editValue).replace(',', '.'));
        payloadValue = isNaN(num) || num < 0 ? 0 : num;
      }
      await axios.patch(`${API_URL}/api/operacional/linha/${id}`, { [field]: payloadValue }, { withCredentials: true });
      setLinhas(prev => prev.map(l => {
        if (l.linha_id !== id) return l;
        const updated = { ...l, [mapField(field)]: payloadValue };
        if (field === 'desconto') {
          const val = Number(updated.valor || 0);
          const desc = Number(payloadValue || 0);
          const valLiq = Math.max(0, val - desc);
          const cst = Number(updated.custo || 0);
          updated.valor_liquido = +valLiq.toFixed(2);
          updated.lucro = +(valLiq - cst).toFixed(2);
        }
        return updated;
      }));
      toast.success('Atualizado');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao salvar');
    }
    cancelEdit();
  };

  const mapField = (f) => {
    // Mapear nomes do PATCH para o campo local que aparece na linha
    if (f === 'observacoes') return 'observacoes_linha';
    return f;
  };

  const toggleInclude = async (id, field, value) => {
    if (!isAdmin) return;
    try {
      await axios.patch(`${API_URL}/api/operacional/linha/${id}`, { [field]: value }, { withCredentials: true });
      setLinhas(prev => prev.map(l => l.linha_id === id ? { ...l, [field]: value } : l));
    } catch (e) {
      toast.error('Erro ao salvar');
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const r = await axios.get(`${API_URL}/api/operacional/export`, { withCredentials: true, responseType: 'blob' });
      const blob = new Blob([r.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `planilha-operacional-${new Date().toISOString().slice(0,10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Planilha exportada');
    } catch (e) {
      toast.error('Erro ao exportar');
    }
    setExporting(false);
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm(`Importar "${file.name}"? Clientes existentes nao serao sobrescritos (merge).`)) {
      e.target.value = '';
      return;
    }
    setImporting(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await axios.post(`${API_URL}/api/operacional/importar-excel`, fd, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000,
      });
      const { imported, updated, errors, total_errors } = r.data;
      toast.success(`${imported} novos | ${updated} atualizados${total_errors ? ` | ${total_errors} erros` : ''}`);
      if (errors?.length) console.warn('Erros importacao:', errors);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao importar');
    }
    setImporting(false);
    e.target.value = '';
  };

  const filteredResumo = useMemo(() => {
    const receita = filtered.reduce((s, l) => s + (l.incluir_lucro ? (l.valor_liquido ?? l.valor ?? 0) : 0), 0);
    const custo = filtered.reduce((s, l) => s + (l.incluir_custo ? (l.custo || 0) : 0), 0);
    const lucro = receita - custo;
    const margem = receita > 0 ? (lucro / receita * 100) : 0;
    // custo_fixo vem do backend (soma dos custos fixos ativos do painel)
    const custoFixo = resumo.custo_fixo || 0;
    const custoTotal = custo + custoFixo;
    return { receita, custo, custoFixo, custoTotal, lucro, margem };
  }, [filtered, resumo.custo_fixo]);

  return (
    <div className="space-y-4" data-testid="planilha-operacional-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Planilha Operacional</h1>
          <p className="text-sm text-zinc-400">Visao consolidada: cliente, linha, plano, financeiro e margem</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={syncTaTelecom} disabled={syncingTa} variant="outline" size="sm" className="border-emerald-700 text-emerald-400 hover:bg-emerald-900/20" data-testid="sync-tatelecom-btn" title="Consulta a Ta Telecom para atualizar Recarga Ta e status dos chips">
            <Signal className={`w-4 h-4 mr-1.5 ${syncingTa ? 'animate-pulse' : ''}`} />{syncingTa ? 'Sincronizando...' : 'Sincronizar Tá Telecom'}
          </Button>
          {isAdmin && (
            <Button onClick={syncAsaas} disabled={syncingAsaas} variant="outline" size="sm" className="border-amber-700 text-amber-400 hover:bg-amber-900/20" data-testid="sync-asaas-btn" title="Importa cobrancas do Asaas para o sistema local">
              <Receipt className={`w-4 h-4 mr-1.5 ${syncingAsaas ? 'animate-pulse' : ''}`} />{syncingAsaas ? 'Importando...' : 'Importar Asaas'}
            </Button>
          )}
          <Button onClick={fetchData} variant="outline" size="sm" disabled={loading} className="border-zinc-700" data-testid="refresh-btn" title="Recarrega a tela">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleExport} disabled={exporting} variant="outline" size="sm" className="border-blue-700 text-blue-400 hover:bg-blue-900/20" data-testid="export-excel-btn">
            <Download className="w-4 h-4 mr-1.5" />{exporting ? 'Exportando...' : 'Exportar Excel'}
          </Button>
          {isAdmin && (
            <>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" data-testid="import-file-input" />
              <Button onClick={() => fileInputRef.current?.click()} disabled={importing} variant="outline" size="sm" className="border-amber-700 text-amber-400 hover:bg-amber-900/20" data-testid="import-excel-btn">
                <Upload className="w-4 h-4 mr-1.5" />{importing ? 'Importando...' : 'Importar Excel'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard icon={DollarSign} label="Receita" value={brl(filteredResumo.receita)} color="emerald" testId="stat-receita" />
        <StatCard icon={Wallet} label="Custos" value={brl(filteredResumo.custo)} color="red" testId="stat-custo" sub="Planilha (variavel)" title="Custos variaveis das linhas (soma do custo da oferta de cada linha marcada)" />
        <StatCard icon={Wallet} label="Custo Total" value={brl(filteredResumo.custoTotal)} color="orange" testId="stat-custo-total" sub={`+ ${brl(filteredResumo.custoFixo)} fixos`} title="Custos da planilha + Custos Fixos do Painel (VPS, dominio, Asaas, etc)" />
        <StatCard icon={TrendingUp} label="Lucro" value={brl(filteredResumo.lucro)} color="blue" testId="stat-lucro" />
        <StatCard icon={Percent} label="Margem" value={`${filteredResumo.margem.toFixed(1)}%`} color="violet" testId="stat-margem" />
      </div>

      <div className="flex items-center justify-between text-sm text-zinc-400 px-1 gap-3 flex-wrap">
        <span><strong className="text-zinc-200">{filtered.length}</strong> de {linhas.length} linhas · <span className="text-emerald-400">{resumo.ativas || 0}</span> ativas · <span className="text-amber-400">{resumo.suspensas || 0}</span> suspensas · <span className="text-zinc-500">{resumo.canceladas || 0}</span> canceladas</span>
        <span className="text-xs text-zinc-500 flex items-center gap-3">
          <span title="Cobrancas Asaas sao atualizadas automaticamente via webhook em tempo real"><Receipt className="w-3 h-3 inline mr-1" />Asaas: <span className="text-emerald-400">tempo real</span></span>
          <span title="Dados da Ta Telecom sao sincronizados sob demanda"><Signal className="w-3 h-3 inline mr-1" />Tá Telecom: {syncProgress ? <span className="text-amber-400">sync {syncProgress.processadas}/{syncProgress.total}...</span> : lastSyncTa ? <span className="text-zinc-300">{formatDateTimeBR(lastSyncTa)}</span> : <span className="text-amber-400">nunca sincronizado</span>}</span>
        </span>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input placeholder="Buscar cliente, CPF, numero, ICCID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-zinc-900 border-zinc-700" data-testid="search-operacional" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm" data-testid="filter-status">
          <option value="">Todos status</option>
          <option value="ativo">Ativo</option>
          <option value="suspenso">Suspenso</option>
          <option value="cancelado">Cancelado</option>
          <option value="bloqueado">Bloqueado</option>
          <option value="recarga_ordem">Recarga Tá — ordem de vencimento</option>
          <option value="recarga_7dias">Recarga Tá — próximos 7 dias</option>
        </select>
        <select value={filterBloqueio} onChange={e => setFilterBloqueio(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm" data-testid="filter-bloqueio">
          <option value="">Todos chips</option>
          <option value="FS">FS</option>
          <option value="NP">NP</option>
          <option value="BLOQ.PARC">BLOQ.PARC</option>
          <option value="BLOQ.TOTAL">BLOQ.TOTAL</option>
          <option value="CANCELADO">CANCELADO</option>
        </select>
        {canais.length > 0 && (
          <select value={filterCanal} onChange={e => setFilterCanal(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm" data-testid="filter-canal">
            <option value="">Todos canais</option>
            {canais.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {/* Tabela */}
      <div className="rounded-lg border border-zinc-800 overflow-auto max-h-[70vh] bg-zinc-950/40">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-900 z-10 shadow-md">
            <tr className="text-left text-zinc-200 border-b-2 border-zinc-700">
              <th className="px-3 py-3 font-bold uppercase text-xs tracking-wide">Cliente</th>
              <th className="px-3 py-3 font-bold uppercase text-xs tracking-wide">Complemento</th>
              <th className="px-3 py-3 font-bold uppercase text-xs tracking-wide">Numero</th>
              <th className="px-3 py-3 font-bold uppercase text-xs tracking-wide">Status</th>
              <th className="px-3 py-3 font-bold uppercase text-xs tracking-wide">Chip</th>
              <th className="px-3 py-3 font-bold uppercase text-xs tracking-wide">Recarga Tá</th>
              <th className="px-3 py-3 font-bold uppercase text-xs tracking-wide">Venc. Boleto</th>
              <th className="px-3 py-3 font-bold uppercase text-xs tracking-wide">Canal</th>
              <th className="px-3 py-3 font-bold uppercase text-xs tracking-wide">Plano</th>
              <th className="px-3 py-3 font-bold uppercase text-xs tracking-wide text-right">Valor</th>
              <th className="px-3 py-3 font-bold uppercase text-xs tracking-wide text-right" title="Desconto fixo em R$ aplicado a esta linha (ex: combo). Clique para editar.">Desc.</th>
              <th className="px-3 py-3 font-bold uppercase text-xs tracking-wide text-right" title="Valor apos desconto (cobrado de fato)">Val. Liq.</th>
              <th className="px-3 py-3 font-bold uppercase text-xs tracking-wide text-right" title="Clique no checkbox para incluir ou excluir o custo desta linha do total">Custo</th>
              <th className="px-3 py-3 font-bold uppercase text-xs tracking-wide text-right" title="Clique no checkbox para incluir ou excluir a receita desta linha do lucro">Lucro</th>
              <th className="px-3 py-3 font-bold uppercase text-xs tracking-wide">Obs</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={15} className="text-center py-10 text-zinc-500">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={15} className="text-center py-10 text-zinc-500">Nenhuma linha encontrada</td></tr>
            ) : (
              filtered.map((l) => {
                const isEditingObs = editingCell?.id === l.linha_id && editingCell?.field === 'observacoes';
                const isEditingCanal = editingCell?.id === l.linha_id && editingCell?.field === 'canal';
                const isEditingComplemento = editingCell?.id === l.linha_id && editingCell?.field === 'complemento';
                const isEditingDesconto = editingCell?.id === l.linha_id && editingCell?.field === 'desconto';
                return (
                  <tr key={l.linha_id} className="border-b border-zinc-800/60 hover:bg-zinc-900/60 transition-colors">
                    <td className="px-3 py-2.5 font-semibold text-zinc-100">{l.cliente_nome || '—'}</td>
                    <td className="px-3 py-2.5 text-zinc-300" onClick={() => startEdit(l.linha_id, 'complemento', l.complemento)}>
                      {isEditingComplemento ? (
                        <div className="flex gap-1 items-center">
                          <input type="text" value={editValue} onChange={e => setEditValue(e.target.value)} placeholder="Ex: filho Joao" className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm w-full min-w-[140px]" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }} />
                          <button onClick={saveEdit} className="text-emerald-400"><Save className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <span className="cursor-pointer hover:text-white text-sm">{l.complemento || <span className="text-zinc-600">—</span>}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-zinc-300">{l.numero}</td>
                    <td className="px-3 py-2.5">
                      {l.status_linha && (
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${statusLinhaColors[l.status_linha] || 'bg-zinc-700/30 text-zinc-400'}`}>
                          {l.status_linha}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {l.status_chip ? (
                        <span className={`px-2 py-1 rounded text-xs font-semibold border ${statusChipColors[l.status_chip] || 'bg-zinc-700/30 text-zinc-400 border-zinc-700'}`}>
                          {l.status_chip}
                        </span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-300 whitespace-nowrap" onClick={() => isAdmin && startEdit(l.linha_id, 'expirar_dados', l.expirar_dados || '')} data-testid={`cell-expirar-${l.linha_id}`}>
                      {editingCell?.id === l.linha_id && editingCell?.field === 'expirar_dados' ? (
                        <div className="flex gap-1 items-center">
                          <input type="date" value={editValue} onChange={e => setEditValue(e.target.value)}
                            className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm" autoFocus
                            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }} />
                          <button onClick={saveEdit} className="text-emerald-400"><Save className="w-4 h-4" /></button>
                          <button onClick={cancelEdit} className="text-zinc-500"><XIcon className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <span className={`${isAdmin ? 'cursor-pointer hover:text-emerald-400' : ''} ${l.expirar_dados_manual ? 'text-blue-300 font-semibold' : ''}`}
                          title={isAdmin ? (l.expirar_dados_manual ? 'Editado manualmente — clique pra alterar' : 'Calculado automaticamente — clique pra editar') : ''}>
                          {l.expirar_dados ? formatDateBR(l.expirar_dados) : <span className="text-zinc-600">—</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-300 whitespace-nowrap">{formatDateBR(l.ultima_cobranca_venc)}</td>
                    <td className="px-3 py-2.5 text-zinc-300" onClick={() => startEdit(l.linha_id, 'canal', l.canal)}>
                      {isEditingCanal ? (
                        <div className="flex gap-1 items-center">
                          <select value={editValue} onChange={e => setEditValue(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm" autoFocus>
                            <option value="">—</option>
                            <option value="Proprio">Proprio</option>
                            <option value="Shopee">Shopee</option>
                            <option value="Revendedor">Revendedor</option>
                            <option value="Mercado Livre">Mercado Livre</option>
                            <option value="Outro">Outro</option>
                          </select>
                          <button onClick={saveEdit} className="text-emerald-400"><Save className="w-4 h-4" /></button>
                          <button onClick={cancelEdit} className="text-zinc-400"><XIcon className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <span className="cursor-pointer hover:text-white">{l.canal || '—'}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-200 font-medium">{l.plano_nome || l.franquia || '—'}</td>
                    <td className="px-3 py-2.5 text-right text-emerald-400 font-mono font-semibold">{brl(l.valor)}</td>
                    <td className="px-3 py-2.5 text-right" onClick={() => isAdmin && startEdit(l.linha_id, 'desconto', l.desconto || '')}>
                      {isEditingDesconto ? (
                        <div className="flex gap-1 items-center justify-end">
                          <input type="number" step="0.01" min="0" value={editValue} onChange={e => setEditValue(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm w-20 text-right" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }} />
                          <button onClick={saveEdit} className="text-emerald-400"><Save className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <span className={`cursor-pointer hover:text-white font-mono text-sm ${Number(l.desconto) > 0 ? 'text-amber-400' : 'text-zinc-600'}`} title="Clique para editar desconto">
                          {Number(l.desconto) > 0 ? `-${brl(l.desconto)}` : '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-emerald-300 font-mono font-semibold" title="Valor liquido (Valor - Desconto)">
                      {brl(l.valor_liquido ?? l.valor)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isAdmin && (
                          <input type="checkbox" checked={!!l.incluir_custo} onChange={(e) => toggleInclude(l.linha_id, 'incluir_custo', e.target.checked)} className="w-3.5 h-3.5 accent-red-500 cursor-pointer" title="Incluir este custo no total" />
                        )}
                        <span className={`font-mono ${l.incluir_custo ? 'text-red-400' : 'text-zinc-600 line-through'}`}>{brl(l.custo)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isAdmin && (
                          <input type="checkbox" checked={!!l.incluir_lucro} onChange={(e) => toggleInclude(l.linha_id, 'incluir_lucro', e.target.checked)} className="w-3.5 h-3.5 accent-blue-500 cursor-pointer" title="Incluir esta receita no calculo do lucro" />
                        )}
                        <span className={`font-mono font-semibold ${l.incluir_lucro ? 'text-blue-400' : 'text-zinc-600 line-through'}`}>{brl(l.lucro)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 max-w-[240px]" onClick={() => startEdit(l.linha_id, 'observacoes', l.observacoes_linha)}>
                      {isEditingObs ? (
                        <div className="flex gap-1 items-center">
                          <input type="text" value={editValue} onChange={e => setEditValue(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm w-full" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }} />
                          <button onClick={saveEdit} className="text-emerald-400"><Save className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <span className="cursor-pointer hover:text-white truncate block" title={l.observacoes_linha}>{l.observacoes_linha || <span className="text-zinc-600">—</span>}</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {isAdmin && (
        <p className="text-xs text-zinc-500">Dica: clique nas celulas <strong>Complemento</strong>, <strong>Canal</strong>, <strong>Desc.</strong> (desconto R$) ou <strong>Obs</strong> para editar inline. Marque ou desmarque os checkbox em <strong>Custo</strong> e <strong>Lucro</strong> para incluir ou excluir a linha do calculo total.</p>
      )}
    </div>
  );
}
