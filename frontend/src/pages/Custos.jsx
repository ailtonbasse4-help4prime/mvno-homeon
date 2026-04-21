import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { DollarSign, Save, TrendingUp, Zap, RefreshCw, Wand2, Plus, Trash2, Package, Layers, Building2, Wallet, Percent } from 'lucide-react';
import { StatCard } from '../components/StatCard';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const brl = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Custos() {
  const [planos, setPlanos] = useState([]);
  const [ofertas, setOfertas] = useState([]);
  const [custosFixos, setCustosFixos] = useState([]);
  const [resumo, setResumo] = useState({});
  const [loading, setLoading] = useState(true);
  const [editedPlanos, setEditedPlanos] = useState({});  // {plano_id: custo}
  const [editedFixos, setEditedFixos] = useState({}); // {fixo_id: {nome, valor}}
  const [newFixo, setNewFixo] = useState({ nome: '', valor: '' });
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [autoCanal, setAutoCanal] = useState(false);
  const [autoRecarga, setAutoRecarga] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [r1, r2, r3, r4] = await Promise.all([
        axios.get(`${API_URL}/api/operacional/planos-com-stats`, { withCredentials: true }),
        axios.get(`${API_URL}/api/operacional/ofertas-com-stats`, { withCredentials: true }),
        axios.get(`${API_URL}/api/operacional/custos-fixos`, { withCredentials: true }),
        axios.get(`${API_URL}/api/operacional/resumo-financeiro`, { withCredentials: true }),
      ]);
      setPlanos(r1.data || []);
      setOfertas(r2.data || []);
      setCustosFixos(r3.data || []);
      setResumo(r4.data || {});
    } catch (e) {
      toast.error('Erro ao carregar dados');
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // Totais em tempo real (considerando edicoes)
  const totais = useMemo(() => {
    const receita = ofertas.reduce((s, o) => s + (o.receita_total || 0), 0);
    let custoVariavel = 0;
    ofertas.forEach(o => {
      // Se houver edicao no plano dessa oferta, usa o valor editado
      const planoEdit = planos.find(p => editedPlanos[p.id] != null && ofertaBelongsToPlano(o, p));
      const custo = planoEdit ? parseFloat(editedPlanos[planoEdit.id] || 0) : (o.custo || 0);
      custoVariavel += custo * (o.linhas_ativas || 0);
    });
    let custoFixo = 0;
    custosFixos.forEach(f => {
      if (!f.ativo) return;
      const edit = editedFixos[f.id];
      const valor = edit?.valor != null ? parseFloat(edit.valor || 0) : (f.valor || 0);
      custoFixo += valor;
    });
    const custoTotal = custoVariavel + custoFixo;
    const lucro = receita - custoTotal;
    const margem = receita > 0 ? (lucro / receita * 100) : 0;
    return { receita, custoVariavel, custoFixo, custoTotal, lucro, margem };
  }, [ofertas, planos, custosFixos, editedPlanos, editedFixos]);

  const ofertaBelongsToPlano = (oferta, plano) => {
    // Match via nome do plano (ja vem do backend)
    return (oferta.plano_nome || '') === (plano.nome || '');
  };

  const updatePlanoCusto = (plano_id, valor) => setEditedPlanos(p => ({ ...p, [plano_id]: valor }));
  const updateFixo = (id, field, valor) => setEditedFixos(p => ({ ...p, [id]: { ...(p[id] || {}), [field]: valor } }));

  const salvarPlanos = async () => {
    const ids = Object.keys(editedPlanos).filter(id => {
      const v = parseFloat(editedPlanos[id]);
      return !isNaN(v) && v >= 0;
    });
    if (ids.length === 0) return toast.info('Nenhuma alteracao de plano');
    setSaving(true);
    try {
      await Promise.all(ids.map(id => axios.patch(`${API_URL}/api/operacional/plano/${id}/custo`, { custo: parseFloat(editedPlanos[id]) }, { withCredentials: true })));
      toast.success(`${ids.length} plano(s) atualizado(s) - custos aplicados em todas as ofertas`);
      setEditedPlanos({});
      fetchAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao salvar');
    }
    setSaving(false);
  };

  const salvarFixos = async () => {
    const ids = Object.keys(editedFixos);
    if (ids.length === 0) return toast.info('Nenhuma alteracao de custo fixo');
    setSaving(true);
    try {
      await Promise.all(ids.map(id => axios.patch(`${API_URL}/api/operacional/custos-fixos/${id}`, editedFixos[id], { withCredentials: true })));
      toast.success(`${ids.length} custo(s) fixo(s) atualizado(s)`);
      setEditedFixos({});
      fetchAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao salvar');
    }
    setSaving(false);
  };

  const criarFixo = async () => {
    if (!newFixo.nome.trim()) return toast.error('Informe o nome');
    const valor = parseFloat(newFixo.valor);
    if (isNaN(valor) || valor < 0) return toast.error('Valor invalido');
    try {
      await axios.post(`${API_URL}/api/operacional/custos-fixos`, { nome: newFixo.nome, valor, ativo: true }, { withCredentials: true });
      toast.success('Custo fixo criado');
      setNewFixo({ nome: '', valor: '' });
      fetchAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro');
    }
  };

  const removerFixo = async (id) => {
    if (!window.confirm('Remover este custo fixo?')) return;
    try {
      await axios.delete(`${API_URL}/api/operacional/custos-fixos/${id}`, { withCredentials: true });
      toast.success('Removido');
      fetchAll();
    } catch (e) { toast.error('Erro ao remover'); }
  };

  const syncTaTelecom = async () => {
    if (!window.confirm('Sincronizar status e data de expiracao de TODAS as linhas ativas via Ta Telecom? Pode demorar 1-3 minutos.')) return;
    setSyncing(true);
    try {
      const r = await axios.post(`${API_URL}/api/operacional/sincronizar-tatelecom`, {}, { withCredentials: true, timeout: 600000 });
      const { atualizadas, total_linhas, sem_chip, total_erros } = r.data;
      toast.success(`${atualizadas}/${total_linhas} sincronizadas${sem_chip ? ` | ${sem_chip} sem chip` : ''}${total_erros ? ` | ${total_erros} erros` : ''}`);
    } catch (e) { toast.error(e.response?.data?.detail || 'Erro'); }
    setSyncing(false);
  };

  const runAutoCanal = async () => {
    setAutoCanal(true);
    try {
      const r = await axios.post(`${API_URL}/api/operacional/auto-canal`, {}, { withCredentials: true });
      toast.success(`${r.data.updated_revendedor} Revendedor, ${r.data.updated_proprio} Proprio`);
    } catch (e) { toast.error('Erro'); }
    setAutoCanal(false);
  };

  const runAutoRecarga = async () => {
    setAutoRecarga(true);
    try {
      const r = await axios.post(`${API_URL}/api/operacional/auto-proxima-recarga`, {}, { withCredentials: true });
      toast.success(`${r.data.updated} linhas com proxima recarga calculada`);
    } catch (e) { toast.error('Erro'); }
    setAutoRecarga(false);
  };

  const alteracoesPlanos = Object.keys(editedPlanos).length;
  const alteracoesFixos = Object.keys(editedFixos).length;

  return (
    <div className="space-y-4" data-testid="custos-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Custos & Automacao</h1>
          <p className="text-sm text-zinc-400">Gerencie custos por plano, custos fixos do painel e automatize a Planilha Operacional</p>
        </div>
        <Button onClick={fetchAll} variant="outline" size="sm" className="border-zinc-700" data-testid="refresh-btn">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Indicadores: 5 cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard icon={DollarSign} label="Receita mensal" value={brl(totais.receita)} color="emerald" testId="total-receita" />
        <StatCard icon={Wallet} label="Custo Variavel" value={brl(totais.custoVariavel)} color="orange" testId="total-custo-variavel" sub="Linhas (oferta)" />
        <StatCard icon={Building2} label="Custo Fixo" value={brl(totais.custoFixo)} color="red" testId="total-custo-fixo" sub="Painel (VPS, Asaas...)" />
        <StatCard icon={Wallet} label="Custo Total" value={brl(totais.custoTotal)} color="red" testId="total-custo" sub="Variavel + Fixo" />
        <StatCard
          icon={TrendingUp}
          label="Lucro Liquido"
          value={brl(totais.lucro)}
          color={totais.lucro >= 0 ? 'emerald' : 'red'}
          testId="total-lucro"
          sub={`Margem: ${totais.margem.toFixed(1)}%`}
        />
      </div>

      {/* Automacoes */}
      <div className="rounded-sm border border-zinc-800 bg-zinc-950 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold">Automacoes</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={syncTaTelecom} disabled={syncing} variant="outline" size="sm" className="border-emerald-700 text-emerald-400 hover:bg-emerald-900/20" data-testid="sync-tatelecom-btn">
            <RefreshCw className={`w-4 h-4 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sincronizar Ta Telecom'}
          </Button>
          <Button onClick={runAutoCanal} disabled={autoCanal} variant="outline" size="sm" className="border-blue-700 text-blue-400 hover:bg-blue-900/20" data-testid="auto-canal-btn">
            <Wand2 className={`w-4 h-4 mr-1.5 ${autoCanal ? 'animate-pulse' : ''}`} />
            Auto-preencher Canal
          </Button>
          <Button onClick={runAutoRecarga} disabled={autoRecarga} variant="outline" size="sm" className="border-violet-700 text-violet-400 hover:bg-violet-900/20" data-testid="auto-recarga-btn">
            <Wand2 className={`w-4 h-4 mr-1.5 ${autoRecarga ? 'animate-pulse' : ''}`} />
            Calcular Proxima Recarga
          </Button>
        </div>
      </div>

      {/* Custos por Plano */}
      <div className="rounded-sm border border-zinc-800 overflow-hidden">
        <div className="flex items-center justify-between bg-zinc-900 px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold">Custos por Plano</h2>
            <span className="text-xs text-zinc-500">(aplicado automaticamente a todas ofertas do plano)</span>
          </div>
          {alteracoesPlanos > 0 && (
            <Button onClick={salvarPlanos} disabled={saving} size="sm" className="btn-primary" data-testid="salvar-planos-btn">
              <Save className="w-4 h-4 mr-1.5" />Salvar {alteracoesPlanos} plano(s)
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/50">
              <tr className="text-left text-xs text-zinc-400 border-b border-zinc-800">
                <th className="px-3 py-2 font-semibold">Plano</th>
                <th className="px-3 py-2 font-semibold text-center">Ofertas</th>
                <th className="px-3 py-2 font-semibold text-center">Linhas Ativas</th>
                <th className="px-3 py-2 font-semibold text-right w-48">Custo/Linha (R$)</th>
                <th className="px-3 py-2 font-semibold text-right">Custo Total deste Plano</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-8 text-zinc-500">Carregando...</td></tr>
              ) : planos.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-zinc-500">Nenhum plano</td></tr>
              ) : (
                planos.map(p => {
                  const custoAtual = editedPlanos[p.id] != null ? parseFloat(editedPlanos[p.id] || 0) : (p.custo_base || 0);
                  const dirty = editedPlanos[p.id] != null;
                  const custoTotalPlano = custoAtual * (p.linhas_ativas || 0);
                  return (
                    <tr key={p.id} className={`border-b border-zinc-800/60 hover:bg-zinc-900/40 ${dirty ? 'bg-amber-900/10' : ''}`}>
                      <td className="px-3 py-2">
                        <div className="font-medium">{p.nome}</div>
                        {p.franquia && <span className="text-xs text-zinc-500">{p.franquia}</span>}
                        {p.custos_diferentes && !dirty && (
                          <span className="ml-2 text-xs text-amber-400" title="Ofertas deste plano tem custos diferentes - salvar aqui unifica tudo">⚠ ofertas com custos diferentes</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center text-zinc-400">{p.ofertas_count}</td>
                      <td className="px-3 py-2 text-center">
                        <span className="inline-flex items-center justify-center min-w-[32px] px-2 py-0.5 bg-zinc-800 rounded text-xs">{p.linhas_ativas}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500">R$</span>
                          <Input
                            type="number" step="0.01" min="0"
                            value={editedPlanos[p.id] != null ? editedPlanos[p.id] : (p.custo_base || 0)}
                            onChange={e => updatePlanoCusto(p.id, e.target.value)}
                            className={`pl-8 h-8 bg-zinc-900 border-zinc-700 font-mono text-right text-sm ${dirty ? 'border-amber-500' : ''}`}
                            data-testid={`custo-plano-${p.id}`}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-red-400">{brl(custoTotalPlano)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Custos Fixos do Painel */}
      <div className="rounded-sm border border-zinc-800 overflow-hidden">
        <div className="flex items-center justify-between bg-zinc-900 px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-red-400" />
            <h2 className="text-sm font-semibold">Custos Fixos do Painel Administrativo</h2>
            <span className="text-xs text-zinc-500">(VPS, dominio, integracoes, etc.)</span>
          </div>
          {alteracoesFixos > 0 && (
            <Button onClick={salvarFixos} disabled={saving} size="sm" className="btn-primary" data-testid="salvar-fixos-btn">
              <Save className="w-4 h-4 mr-1.5" />Salvar {alteracoesFixos}
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/50">
              <tr className="text-left text-xs text-zinc-400 border-b border-zinc-800">
                <th className="px-3 py-2 font-semibold">Nome</th>
                <th className="px-3 py-2 font-semibold text-right w-48">Valor Mensal (R$)</th>
                <th className="px-3 py-2 font-semibold text-center w-24">Ativo</th>
                <th className="px-3 py-2 font-semibold text-right w-16"></th>
              </tr>
            </thead>
            <tbody>
              {custosFixos.map(f => {
                const edit = editedFixos[f.id] || {};
                const dirty = Object.keys(edit).length > 0;
                const nomeAtual = edit.nome != null ? edit.nome : f.nome;
                const valorAtual = edit.valor != null ? edit.valor : f.valor;
                return (
                  <tr key={f.id} className={`border-b border-zinc-800/60 hover:bg-zinc-900/40 ${dirty ? 'bg-amber-900/10' : ''}`}>
                    <td className="px-3 py-2">
                      <Input value={nomeAtual} onChange={e => updateFixo(f.id, 'nome', e.target.value)} className={`h-8 bg-zinc-900 border-zinc-700 text-sm ${dirty ? 'border-amber-500' : ''}`} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500">R$</span>
                        <Input type="number" step="0.01" min="0" value={valorAtual} onChange={e => updateFixo(f.id, 'valor', e.target.value)} className={`pl-8 h-8 bg-zinc-900 border-zinc-700 font-mono text-right text-sm ${dirty ? 'border-amber-500' : ''}`} />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" checked={f.ativo} onChange={e => {
                        axios.patch(`${API_URL}/api/operacional/custos-fixos/${f.id}`, { ativo: e.target.checked }, { withCredentials: true }).then(() => fetchAll());
                      }} className="w-4 h-4 accent-blue-500" />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => removerFixo(f.id)} className="text-red-400 hover:text-red-300">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {/* Linha de criacao */}
              <tr className="border-b border-zinc-800/60 bg-zinc-950/50">
                <td className="px-3 py-2">
                  <Input placeholder="Ex: VPS Hostinger, Dominio, Asaas" value={newFixo.nome} onChange={e => setNewFixo(p => ({ ...p, nome: e.target.value }))} className="h-8 bg-zinc-900 border-zinc-700 text-sm" />
                </td>
                <td className="px-3 py-2">
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500">R$</span>
                    <Input type="number" step="0.01" min="0" placeholder="0.00" value={newFixo.valor} onChange={e => setNewFixo(p => ({ ...p, valor: e.target.value }))} className="pl-8 h-8 bg-zinc-900 border-zinc-700 font-mono text-right text-sm" />
                  </div>
                </td>
                <td colSpan={2} className="px-3 py-2 text-right">
                  <Button onClick={criarFixo} size="sm" variant="outline" className="border-emerald-700 text-emerald-400" data-testid="add-custo-fixo-btn">
                    <Plus className="w-4 h-4 mr-1" />Adicionar
                  </Button>
                </td>
              </tr>
              {custosFixos.length === 0 && (
                <tr><td colSpan={4} className="text-center py-6 text-zinc-500 text-xs">Nenhum custo fixo cadastrado. Adicione acima.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ofertas - expansao por plano (apenas leitura de totais) */}
      <div className="rounded-sm border border-zinc-800 overflow-hidden">
        <div className="flex items-center gap-2 bg-zinc-900 px-4 py-3 border-b border-zinc-800">
          <Package className="w-4 h-4 text-violet-400" />
          <h2 className="text-sm font-semibold">Ofertas Detalhadas</h2>
          <span className="text-xs text-zinc-500">({ofertas.length} ofertas)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-zinc-900/50">
              <tr className="text-left text-zinc-400 border-b border-zinc-800">
                <th className="px-3 py-2 font-semibold">Oferta</th>
                <th className="px-3 py-2 font-semibold">Plano</th>
                <th className="px-3 py-2 font-semibold text-center">Linhas</th>
                <th className="px-3 py-2 font-semibold text-right">Valor</th>
                <th className="px-3 py-2 font-semibold text-right">Custo</th>
                <th className="px-3 py-2 font-semibold text-right">Lucro/Linha</th>
                <th className="px-3 py-2 font-semibold text-right">Margem</th>
              </tr>
            </thead>
            <tbody>
              {ofertas.map(o => {
                const lucro = (o.valor || 0) - (o.custo || 0);
                const margem = o.valor > 0 ? (lucro / o.valor * 100) : 0;
                return (
                  <tr key={o.id} className="border-b border-zinc-800/60 hover:bg-zinc-900/40">
                    <td className="px-3 py-2">{o.nome}</td>
                    <td className="px-3 py-2 text-zinc-400">{o.plano_nome}</td>
                    <td className="px-3 py-2 text-center">{o.linhas_ativas}</td>
                    <td className="px-3 py-2 text-right text-emerald-400 font-mono">{brl(o.valor)}</td>
                    <td className="px-3 py-2 text-right text-red-400 font-mono">{brl(o.custo)}</td>
                    <td className="px-3 py-2 text-right text-blue-400 font-mono">{brl(lucro)}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={margem >= 50 ? 'text-emerald-400' : margem >= 20 ? 'text-amber-400' : 'text-red-400'}>{margem.toFixed(1)}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-start gap-2 text-xs text-zinc-500 p-3 rounded-sm bg-zinc-900/50 border border-zinc-800">
        <TrendingUp className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
        <div>
          <strong className="text-zinc-300">Como usar:</strong> Informe o custo por Plano (sera aplicado em todas as ofertas do plano) e os custos fixos (VPS, dominio, Asaas, etc). O Lucro Liquido Total acima considera automaticamente: Receita - (Custo Variavel + Custo Fixo).
        </div>
      </div>
    </div>
  );
}
