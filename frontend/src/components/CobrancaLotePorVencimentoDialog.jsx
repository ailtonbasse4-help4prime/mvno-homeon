import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { CalendarDays, Loader2, CheckCircle2, AlertTriangle, FileText, RefreshCw, Search } from 'lucide-react';
import { formatDateBR } from '../lib/formatters';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function nextMonth(d = new Date()) {
  const dt = new Date(d);
  dt.setMonth(dt.getMonth() + 1);
  return { mes: dt.getMonth() + 1, ano: dt.getFullYear() };
}

export function CobrancaLotePorVencimentoDialog({ open, onClose, onSuccess }) {
  const hoje = new Date();
  const padrao = nextMonth(hoje);

  const [mes, setMes] = useState(padrao.mes);
  const [ano, setAno] = useState(padrao.ano);
  const [diaFiltro, setDiaFiltro] = useState('');
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ items: [], counts_by_dia: {}, total: 0 });
  const [selecionadas, setSelecionadas] = useState(new Set());
  const [valoresOverride, setValoresOverride] = useState({}); // cliente_id -> valor
  const [descricoesOverride, setDescricoesOverride] = useState({}); // cliente_id -> descricao
  const [billingType, setBillingType] = useState('BOLETO');
  const [gerando, setGerando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ mes: String(mes), ano: String(ano) });
      if (diaFiltro) params.append('dia_vencimento', String(diaFiltro));
      const r = await axios.get(`${API_URL}/api/carteira/cobrancas/lote/preview?${params.toString()}`, { withCredentials: true });
      setData(r.data || { items: [], counts_by_dia: {}, total: 0 });
      setSelecionadas(new Set());
      setValoresOverride({});
      setDescricoesOverride({});
    } catch (e) {
      toast.error('Erro ao carregar previa: ' + (e.response?.data?.detail || e.message));
    }
    setLoading(false);
  }, [mes, ano, diaFiltro]);

  useEffect(() => {
    if (open) {
      setResultado(null);
      fetchPreview();
    }
  }, [open, fetchPreview]);

  const itemsFiltrados = useMemo(() => {
    if (!busca.trim()) return data.items;
    const q = busca.trim().toLowerCase();
    return data.items.filter(i =>
      (i.cliente_nome || '').toLowerCase().includes(q) ||
      (i.msisdn || '').toLowerCase().includes(q) ||
      (i.descricao_ultimo || '').toLowerCase().includes(q)
    );
  }, [data.items, busca]);

  const elegiveis = useMemo(() => itemsFiltrados.filter(i => !i.ja_tem_cobranca), [itemsFiltrados]);

  const toggleSelecao = (cliente_id) => {
    setSelecionadas(prev => {
      const next = new Set(prev);
      if (next.has(cliente_id)) next.delete(cliente_id); else next.add(cliente_id);
      return next;
    });
  };

  const selecionarTodos = () => {
    setSelecionadas(new Set(elegiveis.map(i => i.cliente_id)));
  };
  const limparSelecao = () => setSelecionadas(new Set());

  const getValor = (item) => {
    const v = valoresOverride[item.cliente_id];
    if (v !== undefined && v !== '') return parseFloat(v);
    return item.valor_ultimo;
  };
  const getDescricao = (item) => {
    const v = descricoesOverride[item.cliente_id];
    if (v !== undefined) return v;
    return item.descricao_sugerida || item.descricao_ultimo || '';
  };

  const totalSelecionado = useMemo(() => {
    let soma = 0;
    selecionadas.forEach(id => {
      const item = data.items.find(i => i.cliente_id === id);
      if (!item) return;
      const v = getValor(item);
      if (!isNaN(v)) soma += v;
    });
    return soma;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionadas, data.items, valoresOverride]);

  const gerarLote = async () => {
    if (selecionadas.size === 0) {
      toast.warning('Selecione ao menos um cliente');
      return;
    }
    const items = [];
    for (const id of selecionadas) {
      const item = data.items.find(i => i.cliente_id === id);
      if (!item) continue;
      items.push({
        cliente_id: id,
        valor: getValor(item),
        vencimento: item.vencimento_alvo,
        descricao: getDescricao(item),
        linha_id: item.linha_id,
      });
    }
    setGerando(true);
    try {
      const r = await axios.post(`${API_URL}/api/carteira/cobrancas/lote/por-vencimento`, {
        items,
        billing_type: billingType,
      }, { withCredentials: true });
      setResultado(r.data);
      toast.success(`Lote gerado: ${r.data.created} criadas, ${r.data.skipped} puladas, ${r.data.errors?.length || 0} erros`);
      await fetchPreview();
      onSuccess?.();
    } catch (e) {
      toast.error('Erro ao gerar lote: ' + (e.response?.data?.detail || e.message));
    }
    setGerando(false);
  };

  const closeAll = () => {
    setResultado(null);
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && closeAll()}>
      <DialogContent className="bg-zinc-950 border-zinc-800 max-w-6xl max-h-[92vh] overflow-hidden flex flex-col" data-testid="lote-vencimento-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-emerald-400" />
            Gerar Cobranças em Lote por Vencimento
          </DialogTitle>
          <DialogDescription className="text-zinc-400 text-xs">
            Valores e descrições são herdados do último boleto de cada cliente. Filtre por dia, marque os clientes e edite o que quiser antes de gerar.
          </DialogDescription>
        </DialogHeader>

        {resultado ? (
          <div className="space-y-4 overflow-y-auto p-2">
            <div className="bg-emerald-900/20 border border-emerald-700 rounded-lg p-4">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-2">
                <CheckCircle2 className="w-5 h-5" />
                Lote Processado
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-zinc-900 rounded p-3">
                  <div className="text-zinc-400 text-xs">Criadas</div>
                  <div className="text-2xl font-bold text-emerald-400" data-testid="result-created">{resultado.created}</div>
                </div>
                <div className="bg-zinc-900 rounded p-3">
                  <div className="text-zinc-400 text-xs">Puladas (já existiam)</div>
                  <div className="text-2xl font-bold text-amber-400" data-testid="result-skipped">{resultado.skipped}</div>
                </div>
                <div className="bg-zinc-900 rounded p-3">
                  <div className="text-zinc-400 text-xs">Erros</div>
                  <div className="text-2xl font-bold text-red-400" data-testid="result-errors">{resultado.errors?.length || 0}</div>
                </div>
              </div>
            </div>

            {resultado.errors?.length > 0 && (
              <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 max-h-48 overflow-y-auto">
                <div className="text-red-400 text-sm font-semibold mb-2">Erros</div>
                <ul className="text-xs space-y-1">
                  {resultado.errors.map((e, i) => (
                    <li key={i} className="text-zinc-300">• {e.error || JSON.stringify(e)}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button onClick={closeAll} className="btn-primary" data-testid="close-result-btn">Fechar</Button>
            </div>
          </div>
        ) : (
          <>
            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Mês alvo</label>
                <select
                  value={mes}
                  onChange={e => setMes(parseInt(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-2 py-2 text-sm"
                  data-testid="select-mes"
                >
                  {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Ano</label>
                <Input type="number" value={ano} onChange={e => setAno(parseInt(e.target.value))}
                  className="bg-zinc-900 border-zinc-700" data-testid="input-ano" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Filtrar dia (1-31)</label>
                <Input type="number" min="1" max="31" placeholder="Todos" value={diaFiltro}
                  onChange={e => setDiaFiltro(e.target.value)}
                  className="bg-zinc-900 border-zinc-700" data-testid="input-dia" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Tipo cobrança</label>
                <select value={billingType} onChange={e => setBillingType(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-2 py-2 text-sm"
                  data-testid="select-billing-type">
                  <option value="BOLETO">Boleto</option>
                  <option value="PIX">PIX</option>
                  <option value="UNDEFINED">Boleto + PIX</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button onClick={fetchPreview} disabled={loading} variant="outline"
                  className="w-full border-zinc-700 hover:bg-zinc-800" data-testid="refresh-preview-btn">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                  Atualizar
                </Button>
              </div>
            </div>

            {/* Resumo por dia */}
            {Object.keys(data.counts_by_dia || {}).length > 0 && (
              <div className="flex flex-wrap gap-2 px-1">
                <span className="text-xs text-zinc-400 mr-1">Distribuição por dia:</span>
                {Object.entries(data.counts_by_dia).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([dia, qt]) => (
                  <button key={dia}
                    onClick={() => setDiaFiltro(diaFiltro === dia ? '' : dia)}
                    className={`px-2 py-0.5 rounded text-xs border ${diaFiltro === dia ? 'bg-emerald-700/40 border-emerald-500 text-emerald-200' : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'}`}
                    data-testid={`chip-dia-${dia}`}
                  >
                    dia {dia}: {qt}
                  </button>
                ))}
              </div>
            )}

            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input placeholder="Buscar por nome / número / descrição..."
                value={busca} onChange={e => setBusca(e.target.value)}
                className="pl-10 bg-zinc-900 border-zinc-700" data-testid="search-lote" />
            </div>

            {/* Ações de selecao */}
            <div className="flex items-center justify-between text-xs flex-wrap gap-2">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={selecionarTodos}
                  className="border-zinc-700 hover:bg-zinc-800" data-testid="select-all-btn">
                  Selecionar elegíveis ({elegiveis.length})
                </Button>
                <Button size="sm" variant="outline" onClick={limparSelecao}
                  className="border-zinc-700 hover:bg-zinc-800" data-testid="clear-selection-btn">
                  Limpar
                </Button>
              </div>
              <div className="text-zinc-400">
                Selecionadas: <span className="text-emerald-400 font-bold" data-testid="count-selected">{selecionadas.size}</span> •
                Total: <span className="text-emerald-400 font-bold" data-testid="total-selected">R$ {totalSelecionado.toFixed(2)}</span>
              </div>
            </div>

            {/* Tabela */}
            <div className="flex-1 overflow-auto border border-zinc-800 rounded-lg">
              <table className="w-full text-sm" data-testid="lote-table">
                <thead className="bg-zinc-900 sticky top-0 z-10">
                  <tr className="border-b border-zinc-800 text-xs uppercase text-zinc-400">
                    <th className="p-2 w-8"></th>
                    <th className="p-2 text-left">Cliente</th>
                    <th className="p-2 text-left">Último boleto</th>
                    <th className="p-2 text-center w-14">Dia</th>
                    <th className="p-2 text-center">Novo vencimento</th>
                    <th className="p-2 text-right w-28">Valor</th>
                    <th className="p-2 text-left">Descrição</th>
                    <th className="p-2 text-center w-24">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={8} className="p-8 text-center text-zinc-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </td></tr>
                  )}
                  {!loading && itemsFiltrados.length === 0 && (
                    <tr><td colSpan={8} className="p-8 text-center text-zinc-500">
                      Nenhum cliente com histórico de cobrança encontrado para os filtros aplicados.
                    </td></tr>
                  )}
                  {!loading && itemsFiltrados.map(item => {
                    const selecionada = selecionadas.has(item.cliente_id);
                    const desabilitada = item.ja_tem_cobranca;
                    return (
                      <tr key={item.cliente_id}
                        className={`border-b border-zinc-800/60 ${desabilitada ? 'opacity-50' : 'hover:bg-zinc-900/40'}`}
                        data-testid={`row-cli-${item.cliente_id}`}
                      >
                        <td className="p-2 text-center align-top pt-3">
                          <input type="checkbox"
                            checked={selecionada}
                            disabled={desabilitada}
                            onChange={() => toggleSelecao(item.cliente_id)}
                            className="accent-emerald-500 w-4 h-4"
                            data-testid={`check-cli-${item.cliente_id}`}
                          />
                        </td>
                        <td className="p-2 align-top">
                          <div className="font-medium">{item.cliente_nome || '—'}</div>
                          {item.msisdn && <div className="text-xs text-zinc-500">{item.msisdn}</div>}
                        </td>
                        <td className="p-2 text-zinc-300 align-top">
                          <div className="text-xs">R$ {(item.valor_ultimo || 0).toFixed(2)}</div>
                          <div className="text-xs text-zinc-500">{formatDateBR(item.vencimento_ultimo)}</div>
                        </td>
                        <td className="p-2 text-center align-top pt-3">
                          <span className="inline-block bg-zinc-800 px-2 py-0.5 rounded text-xs">{item.dia_vencimento}</span>
                        </td>
                        <td className="p-2 text-center text-xs align-top pt-3">
                          {formatDateBR(item.vencimento_alvo)}
                        </td>
                        <td className="p-2 text-right align-top">
                          <Input type="number" step="0.01"
                            value={valoresOverride[item.cliente_id] ?? item.valor_ultimo}
                            onChange={e => setValoresOverride(prev => ({ ...prev, [item.cliente_id]: e.target.value }))}
                            disabled={desabilitada}
                            className="bg-zinc-900 border-zinc-700 h-8 w-24 text-right text-xs ml-auto"
                            data-testid={`valor-${item.cliente_id}`}
                          />
                        </td>
                        <td className="p-2 align-top">
                          <Input type="text"
                            value={descricoesOverride[item.cliente_id] ?? (item.descricao_sugerida || item.descricao_ultimo || '')}
                            onChange={e => setDescricoesOverride(prev => ({ ...prev, [item.cliente_id]: e.target.value }))}
                            disabled={desabilitada}
                            placeholder="Descrição"
                            className="bg-zinc-900 border-zinc-700 h-8 text-xs"
                            data-testid={`desc-${item.cliente_id}`}
                          />
                        </td>
                        <td className="p-2 text-center align-top pt-3">
                          {item.ja_tem_cobranca ? (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                              <AlertTriangle className="w-3 h-3" /> Já gerada
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" /> Elegível
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Acao */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-800 flex-wrap gap-2">
              <div className="text-xs text-zinc-400">
                <FileText className="w-3 h-3 inline mr-1" />
                Cobranças com vencimento já existente serão puladas automaticamente.
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={closeAll}
                  className="border-zinc-700 hover:bg-zinc-800" data-testid="cancel-lote-btn">
                  Cancelar
                </Button>
                <Button onClick={gerarLote} disabled={gerando || selecionadas.size === 0}
                  className="btn-primary" data-testid="gerar-lote-btn">
                  {gerando ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Gerar {selecionadas.size} cobrança{selecionadas.size === 1 ? '' : 's'}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
