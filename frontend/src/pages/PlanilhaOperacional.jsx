import { useEffect, useState, useMemo, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Search, Download, Upload, RefreshCw, DollarSign, TrendingUp, Wallet, Percent, Save, X as XIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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

  useEffect(() => { fetchData(); }, []);

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
    if (filterStatus) res = res.filter(l => l.status_linha === filterStatus);
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
      await axios.patch(`${API_URL}/api/operacional/linha/${id}`, { [field]: editValue }, { withCredentials: true });
      setLinhas(prev => prev.map(l => l.linha_id === id ? { ...l, [mapField(field)]: editValue } : l));
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
    const receita = filtered.reduce((s, l) => s + (l.valor || 0), 0);
    const custo = filtered.reduce((s, l) => s + (l.custo || 0), 0);
    const lucro = receita - custo;
    const margem = receita > 0 ? (lucro / receita * 100) : 0;
    return { receita, custo, lucro, margem };
  }, [filtered]);

  return (
    <div className="space-y-4" data-testid="planilha-operacional-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Planilha Operacional</h1>
          <p className="text-sm text-zinc-400">Visao consolidada: cliente, linha, plano, financeiro e margem</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={fetchData} variant="outline" size="sm" disabled={loading} className="border-zinc-700" data-testid="refresh-btn">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleExport} disabled={exporting} variant="outline" size="sm" className="border-emerald-700 text-emerald-400 hover:bg-emerald-900/20" data-testid="export-excel-btn">
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-emerald-900/40 bg-gradient-to-br from-emerald-950/30 to-zinc-950 p-5" data-testid="stat-receita">
          <div className="flex items-center gap-2 text-zinc-400 text-sm"><DollarSign className="w-4 h-4 text-emerald-400" />Receita</div>
          <div className="mt-1.5 text-2xl font-bold text-emerald-400">{brl(filteredResumo.receita)}</div>
        </div>
        <div className="rounded-lg border border-red-900/40 bg-gradient-to-br from-red-950/30 to-zinc-950 p-5" data-testid="stat-custo">
          <div className="flex items-center gap-2 text-zinc-400 text-sm"><Wallet className="w-4 h-4 text-red-400" />Custo</div>
          <div className="mt-1.5 text-2xl font-bold text-red-400">{brl(filteredResumo.custo)}</div>
        </div>
        <div className="rounded-lg border border-blue-900/40 bg-gradient-to-br from-blue-950/30 to-zinc-950 p-5" data-testid="stat-lucro">
          <div className="flex items-center gap-2 text-zinc-400 text-sm"><TrendingUp className="w-4 h-4 text-blue-400" />Lucro</div>
          <div className="mt-1.5 text-2xl font-bold text-blue-400">{brl(filteredResumo.lucro)}</div>
        </div>
        <div className="rounded-lg border border-violet-900/40 bg-gradient-to-br from-violet-950/30 to-zinc-950 p-5" data-testid="stat-margem">
          <div className="flex items-center gap-2 text-zinc-400 text-sm"><Percent className="w-4 h-4 text-violet-400" />Margem</div>
          <div className="mt-1.5 text-2xl font-bold text-violet-400">{filteredResumo.margem.toFixed(1)}%</div>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-zinc-400 px-1">
        <span><strong className="text-zinc-200">{filtered.length}</strong> de {linhas.length} linhas · <span className="text-emerald-400">{resumo.ativas || 0}</span> ativas · <span className="text-amber-400">{resumo.suspensas || 0}</span> suspensas · <span className="text-zinc-500">{resumo.canceladas || 0}</span> canceladas</span>
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
              <th className="px-3 py-3 font-bold uppercase text-xs tracking-wide">Numero</th>
              <th className="px-3 py-3 font-bold uppercase text-xs tracking-wide">Status</th>
              <th className="px-3 py-3 font-bold uppercase text-xs tracking-wide">Chip</th>
              <th className="px-3 py-3 font-bold uppercase text-xs tracking-wide">Recarga Tá</th>
              <th className="px-3 py-3 font-bold uppercase text-xs tracking-wide">Prox. Boleto</th>
              <th className="px-3 py-3 font-bold uppercase text-xs tracking-wide">Canal</th>
              <th className="px-3 py-3 font-bold uppercase text-xs tracking-wide">Plano</th>
              <th className="px-3 py-3 font-bold uppercase text-xs tracking-wide text-right">Valor</th>
              <th className="px-3 py-3 font-bold uppercase text-xs tracking-wide text-right">Custo</th>
              <th className="px-3 py-3 font-bold uppercase text-xs tracking-wide text-right">Lucro</th>
              <th className="px-3 py-3 font-bold uppercase text-xs tracking-wide">Venc. Boleto</th>
              <th className="px-3 py-3 font-bold uppercase text-xs tracking-wide">Obs</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={13} className="text-center py-10 text-zinc-500">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={13} className="text-center py-10 text-zinc-500">Nenhuma linha encontrada</td></tr>
            ) : (
              filtered.map((l) => {
                const isEditingObs = editingCell?.id === l.linha_id && editingCell?.field === 'observacoes';
                const isEditingRecarga = editingCell?.id === l.linha_id && editingCell?.field === 'proxima_recarga';
                const isEditingCanal = editingCell?.id === l.linha_id && editingCell?.field === 'canal';
                const isEditingChip = editingCell?.id === l.linha_id && editingCell?.field === 'status_chip';
                return (
                  <tr key={l.linha_id} className="border-b border-zinc-800/60 hover:bg-zinc-900/60 transition-colors">
                    <td className="px-3 py-2.5 font-semibold text-zinc-100">{l.cliente_nome || '—'}</td>
                    <td className="px-3 py-2.5 font-mono text-zinc-300">{l.numero}</td>
                    <td className="px-3 py-2.5">
                      {l.status_linha && (
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${statusLinhaColors[l.status_linha] || 'bg-zinc-700/30 text-zinc-400'}`}>
                          {l.status_linha}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5" onClick={() => startEdit(l.linha_id, 'status_chip', l.status_chip)}>
                      {isEditingChip ? (
                        <div className="flex gap-1 items-center">
                          <select value={editValue} onChange={e => setEditValue(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm" autoFocus>
                            <option value="">—</option>
                            <option value="FS">FS</option>
                            <option value="NP">NP</option>
                            <option value="BLOQ.PARC">BLOQ.PARC</option>
                            <option value="BLOQ.TOTAL">BLOQ.TOTAL</option>
                            <option value="CANCELADO">CANCELADO</option>
                          </select>
                          <button onClick={saveEdit} className="text-emerald-400"><Save className="w-4 h-4" /></button>
                          <button onClick={cancelEdit} className="text-zinc-400"><XIcon className="w-4 h-4" /></button>
                        </div>
                      ) : l.status_chip ? (
                        <span className={`px-2 py-1 rounded text-xs font-semibold border ${statusChipColors[l.status_chip] || 'bg-zinc-700/30 text-zinc-400 border-zinc-700'} cursor-pointer hover:brightness-125 transition`}>
                          {l.status_chip}
                        </span>
                      ) : (
                        <span className="text-zinc-600 cursor-pointer hover:text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-300 whitespace-nowrap">{l.expirar_dados || '—'}</td>
                    <td className="px-3 py-2.5" onClick={() => startEdit(l.linha_id, 'proxima_recarga', l.proxima_recarga)}>
                      {isEditingRecarga ? (
                        <div className="flex gap-1 items-center">
                          <input type="date" value={editValue} onChange={e => setEditValue(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm" autoFocus />
                          <button onClick={saveEdit} className="text-emerald-400"><Save className="w-4 h-4" /></button>
                          <button onClick={cancelEdit} className="text-zinc-400"><XIcon className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <span className="cursor-pointer hover:text-white whitespace-nowrap">{l.proxima_recarga || '—'}</span>
                      )}
                    </td>
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
                    <td className="px-3 py-2.5 text-right text-red-400 font-mono">{brl(l.custo)}</td>
                    <td className="px-3 py-2.5 text-right text-blue-400 font-mono font-semibold">{brl(l.lucro)}</td>
                    <td className="px-3 py-2.5 text-zinc-300 whitespace-nowrap">{l.ultima_cobranca_venc || '—'}</td>
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
        <p className="text-xs text-zinc-500">Dica: clique nas celulas <strong>Chip</strong>, <strong>Prox.Recarga</strong>, <strong>Canal</strong> ou <strong>Obs</strong> para editar inline.</p>
      )}
    </div>
  );
}
