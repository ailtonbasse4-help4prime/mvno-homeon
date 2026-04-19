import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { DollarSign, Save, TrendingUp, Zap, RefreshCw, Wand2 } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const brl = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Custos() {
  const [ofertas, setOfertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [edited, setEdited] = useState({}); // {oferta_id: novo_custo}
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [autoCanal, setAutoCanal] = useState(false);
  const [autoRecarga, setAutoRecarga] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API_URL}/api/operacional/ofertas-com-stats`, { withCredentials: true });
      setOfertas(r.data || []);
    } catch (e) {
      toast.error('Erro ao carregar ofertas');
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const totais = useMemo(() => {
    const receita = ofertas.reduce((s, o) => s + (o.receita_total || 0), 0);
    const custoAtual = ofertas.reduce((s, o) => {
      const c = edited[o.id] != null ? parseFloat(edited[o.id] || 0) : (o.custo || 0);
      return s + c * (o.linhas_ativas || 0);
    }, 0);
    const lucro = receita - custoAtual;
    const margem = receita > 0 ? (lucro / receita * 100) : 0;
    return { receita, custo: custoAtual, lucro, margem };
  }, [ofertas, edited]);

  const updateCusto = (id, value) => {
    setEdited(prev => ({ ...prev, [id]: value }));
  };

  const salvarTodos = async () => {
    const payload = {};
    Object.keys(edited).forEach(id => {
      const v = parseFloat(edited[id]);
      if (!isNaN(v) && v >= 0) payload[id] = v;
    });
    if (Object.keys(payload).length === 0) {
      toast.info('Nenhuma alteracao');
      return;
    }
    setSaving(true);
    try {
      const r = await axios.post(`${API_URL}/api/operacional/custos/batch`, { custos: payload }, { withCredentials: true });
      toast.success(`${r.data.updated} oferta(s) atualizada(s)`);
      setEdited({});
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao salvar');
    }
    setSaving(false);
  };

  const syncTaTelecom = async () => {
    if (!window.confirm('Sincronizar status e data de expiracao de TODAS as linhas ativas via Ta Telecom? Pode demorar 1-3 minutos.')) return;
    setSyncing(true);
    try {
      const r = await axios.post(`${API_URL}/api/operacional/sincronizar-tatelecom`, {}, { withCredentials: true, timeout: 600000 });
      const { atualizadas, total_linhas, sem_chip, total_erros } = r.data;
      toast.success(`${atualizadas}/${total_linhas} linhas sincronizadas${sem_chip ? ` | ${sem_chip} sem chip` : ''}${total_erros ? ` | ${total_erros} erros` : ''}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao sincronizar');
    }
    setSyncing(false);
  };

  const runAutoCanal = async () => {
    setAutoCanal(true);
    try {
      const r = await axios.post(`${API_URL}/api/operacional/auto-canal`, {}, { withCredentials: true });
      toast.success(`Canal preenchido: ${r.data.updated_revendedor} Revendedor, ${r.data.updated_proprio} Proprio`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao auto-preencher canal');
    }
    setAutoCanal(false);
  };

  const runAutoRecarga = async () => {
    setAutoRecarga(true);
    try {
      const r = await axios.post(`${API_URL}/api/operacional/auto-proxima-recarga`, {}, { withCredentials: true });
      toast.success(`${r.data.updated} linhas com proxima recarga calculada`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro');
    }
    setAutoRecarga(false);
  };

  const alteracoes = Object.keys(edited).length;

  return (
    <div className="space-y-4" data-testid="custos-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Custos & Automacao</h1>
          <p className="text-sm text-zinc-400">Cadastre o custo operacional por oferta para calcular margem real e automatize dados da planilha</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm" className="border-zinc-700">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-sm border border-zinc-800 bg-zinc-950 p-4" data-testid="total-receita">
          <div className="text-xs text-zinc-400">Receita mensal estimada</div>
          <div className="mt-1 text-xl font-bold text-emerald-400">{brl(totais.receita)}</div>
        </div>
        <div className="rounded-sm border border-zinc-800 bg-zinc-950 p-4" data-testid="total-custo">
          <div className="text-xs text-zinc-400">Custo mensal estimado</div>
          <div className="mt-1 text-xl font-bold text-red-400">{brl(totais.custo)}</div>
        </div>
        <div className="rounded-sm border border-zinc-800 bg-zinc-950 p-4" data-testid="total-lucro">
          <div className="text-xs text-zinc-400">Lucro mensal estimado</div>
          <div className="mt-1 text-xl font-bold text-blue-400">{brl(totais.lucro)}</div>
        </div>
        <div className="rounded-sm border border-zinc-800 bg-zinc-950 p-4" data-testid="total-margem">
          <div className="text-xs text-zinc-400">Margem media</div>
          <div className="mt-1 text-xl font-bold text-violet-400">{totais.margem.toFixed(1)}%</div>
        </div>
      </div>

      {/* Automacoes */}
      <div className="rounded-sm border border-zinc-800 bg-zinc-950 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold">Automacoes</h2>
        </div>
        <p className="text-xs text-zinc-500">Ao clicar nos botoes abaixo, o sistema preenche campos da Planilha Operacional automaticamente sem precisar editar cliente por cliente.</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={syncTaTelecom} disabled={syncing} variant="outline" size="sm" className="border-emerald-700 text-emerald-400 hover:bg-emerald-900/20" data-testid="sync-tatelecom-btn">
            <RefreshCw className={`w-4 h-4 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando Ta Telecom...' : 'Sincronizar Ta Telecom (status + expirar dados)'}
          </Button>
          <Button onClick={runAutoCanal} disabled={autoCanal} variant="outline" size="sm" className="border-blue-700 text-blue-400 hover:bg-blue-900/20" data-testid="auto-canal-btn">
            <Wand2 className={`w-4 h-4 mr-1.5 ${autoCanal ? 'animate-pulse' : ''}`} />
            {autoCanal ? 'Preenchendo...' : 'Auto-preencher Canal'}
          </Button>
          <Button onClick={runAutoRecarga} disabled={autoRecarga} variant="outline" size="sm" className="border-violet-700 text-violet-400 hover:bg-violet-900/20" data-testid="auto-recarga-btn">
            <Wand2 className={`w-4 h-4 mr-1.5 ${autoRecarga ? 'animate-pulse' : ''}`} />
            {autoRecarga ? 'Calculando...' : 'Calcular Proxima Recarga'}
          </Button>
        </div>
      </div>

      {/* Tabela de custos */}
      <div className="rounded-sm border border-zinc-800 overflow-hidden">
        <div className="flex items-center justify-between bg-zinc-900 px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold">Custos por Oferta</h2>
            <span className="text-xs text-zinc-500">({ofertas.length} ofertas)</span>
          </div>
          {alteracoes > 0 && (
            <Button onClick={salvarTodos} disabled={saving} size="sm" className="btn-primary" data-testid="salvar-custos-btn">
              <Save className="w-4 h-4 mr-1.5" />{saving ? 'Salvando...' : `Salvar ${alteracoes} alteracao(oes)`}
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/50">
              <tr className="text-left text-xs text-zinc-400 border-b border-zinc-800">
                <th className="px-3 py-2 font-semibold">Oferta</th>
                <th className="px-3 py-2 font-semibold">Plano</th>
                <th className="px-3 py-2 font-semibold text-center">Linhas</th>
                <th className="px-3 py-2 font-semibold text-right">Valor</th>
                <th className="px-3 py-2 font-semibold text-right w-40">Custo (editavel)</th>
                <th className="px-3 py-2 font-semibold text-right">Lucro/Linha</th>
                <th className="px-3 py-2 font-semibold text-right">Margem</th>
                <th className="px-3 py-2 font-semibold text-right">Lucro Total</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8 text-zinc-500">Carregando...</td></tr>
              ) : ofertas.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-zinc-500">Nenhuma oferta cadastrada</td></tr>
              ) : (
                ofertas.map((o) => {
                  const custoAtual = edited[o.id] != null ? parseFloat(edited[o.id] || 0) : (o.custo || 0);
                  const lucroUnit = (o.valor || 0) - custoAtual;
                  const margem = o.valor > 0 ? (lucroUnit / o.valor * 100) : 0;
                  const lucroTotal = lucroUnit * (o.linhas_ativas || 0);
                  const dirty = edited[o.id] != null;
                  return (
                    <tr key={o.id} className={`border-b border-zinc-800/60 hover:bg-zinc-900/40 ${dirty ? 'bg-amber-900/10' : ''}`}>
                      <td className="px-3 py-2">
                        <div className="font-medium">{o.nome}</div>
                        {!o.ativo && <span className="text-xs text-zinc-500">(inativa)</span>}
                      </td>
                      <td className="px-3 py-2 text-zinc-400">
                        {o.plano_nome} {o.franquia && <span className="text-zinc-500">· {o.franquia}</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="inline-flex items-center justify-center min-w-[32px] px-2 py-0.5 bg-zinc-800 rounded text-xs">
                          {o.linhas_ativas || 0}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-400 font-mono">{brl(o.valor)}</td>
                      <td className="px-3 py-2">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500">R$</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={edited[o.id] != null ? edited[o.id] : (o.custo || 0)}
                            onChange={e => updateCusto(o.id, e.target.value)}
                            className={`pl-8 h-8 bg-zinc-900 border-zinc-700 font-mono text-right text-sm ${dirty ? 'border-amber-500' : ''}`}
                            data-testid={`custo-input-${o.id}`}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-blue-400">{brl(lucroUnit)}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={`text-xs font-semibold ${margem >= 50 ? 'text-emerald-400' : margem >= 20 ? 'text-amber-400' : 'text-red-400'}`}>
                          {margem.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-300">{brl(lucroTotal)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-start gap-2 text-xs text-zinc-500 p-3 rounded-sm bg-zinc-900/50 border border-zinc-800">
        <TrendingUp className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
        <div>
          <strong className="text-zinc-300">Dica:</strong> Informe o custo mensal que a operadora cobra por cada oferta. Isso vai alimentar a coluna <strong>Custo</strong> e <strong>Lucro</strong> da Planilha Operacional automaticamente. Ex: se o plano 10GB voce paga R$ 22,00 para a Ta Telecom e cobra R$ 39,99 do cliente, o lucro por linha e R$ 17,99.
        </div>
      </div>
    </div>
  );
}
