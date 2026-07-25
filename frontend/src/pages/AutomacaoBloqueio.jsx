import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import PainelAutoBloqueio from '../components/PainelAutoBloqueio';
import {
  Shield, ShieldAlert, ShieldCheck, Zap, Clock, Users, PlayCircle,
  RefreshCw, Trash2, Plus, AlertTriangle, CheckCircle2, XCircle,
  MessageCircle, History, Loader2, LayoutDashboard, Settings,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const formatDateTime = (v) => {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString('pt-BR');
  } catch {
    return String(v);
  }
};

export default function AutomacaoBloqueio() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [simulacao, setSimulacao] = useState(null);
  const [simulando, setSimulando] = useState(false);
  const [executando, setExecutando] = useState(false);
  const [whitelist, setWhitelist] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [novoCliente, setNovoCliente] = useState({ cliente_id: '', motivo: '' });
  const [clientesBusca, setClientesBusca] = useState([]);
  const [buscaCliente, setBuscaCliente] = useState('');

  // Modal seleção em lote
  const [loteOpen, setLoteOpen] = useState(false);
  const [todosClientes, setTodosClientes] = useState([]);
  const [carregandoClientes, setCarregandoClientes] = useState(false);
  const [buscaLote, setBuscaLote] = useState('');
  const [selecionadosLote, setSelecionadosLote] = useState(new Set());
  const [motivoLote, setMotivoLote] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, wl, hist] = await Promise.all([
        axios.get(`${API_URL}/api/automacao/bloqueio/config`, { withCredentials: true }),
        axios.get(`${API_URL}/api/automacao/bloqueio/whitelist`, { withCredentials: true }),
        axios.get(`${API_URL}/api/automacao/bloqueio/historico?limit=50`, { withCredentials: true }),
      ]);
      setConfig(cfg.data);
      setWhitelist(wl.data || []);
      setHistorico(hist.data || []);
    } catch (e) {
      toast.error('Erro ao carregar: ' + (e.response?.data?.detail || e.message));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const salvarConfig = async () => {
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/automacao/bloqueio/config`, config, { withCredentials: true });
      toast.success('Configuracao salva');
    } catch (e) {
      toast.error('Erro ao salvar: ' + (e.response?.data?.detail || e.message));
    }
    setSaving(false);
  };

  const toggleAtivo = async (v) => {
    if (v && (!simulacao || simulacao.a_bloquear === 0)) {
      // Ao ligar pela 1a vez, forca uma simulacao antes
      await simular();
    }
    if (v) {
      const ok = window.confirm(
        `ATENCAO: Ligar a automacao vai bloquear automaticamente as ${config.hora_bloqueio}h os clientes inadimplentes.\n\n` +
        `Deseja continuar?`
      );
      if (!ok) return;
    }
    const novo = { ...config, ativo: v };
    setConfig(novo);
    try {
      await axios.put(`${API_URL}/api/automacao/bloqueio/config`, { ativo: v }, { withCredentials: true });
      toast.success(v ? '✅ Automacao ATIVADA' : '⏸️ Automacao PAUSADA');
    } catch (e) {
      setConfig(config); // revert
      toast.error('Erro: ' + (e.response?.data?.detail || e.message));
    }
  };

  const simular = async () => {
    setSimulando(true);
    try {
      const r = await axios.get(`${API_URL}/api/automacao/bloqueio/simular`, { withCredentials: true });
      setSimulacao(r.data);
      toast.success(`Simulacao: ${r.data.a_bloquear} clientes seriam bloqueados agora`);
    } catch (e) {
      toast.error('Erro: ' + (e.response?.data?.detail || e.message));
    }
    setSimulando(false);
  };

  const executar = async (dry_run) => {
    const label = dry_run ? 'SIMULAR (sem chamar a Ta Telecom)' : 'EXECUTAR AGORA (BLOQUEIO REAL na Ta Telecom)';
    if (!window.confirm(`Confirma ${label}?`)) return;
    setExecutando(true);
    try {
      const r = await axios.post(`${API_URL}/api/automacao/bloqueio/executar`, { dry_run, dias_tolerancia: 0 }, { withCredentials: true });
      const msg = `${dry_run ? '[DRY RUN]' : '[REAL]'} ${r.data.bloqueadas} bloqueadas | ${r.data.puladas_whitelist} VIP | ${r.data.pulados_pagamento_asaas || 0} já pagos (fail-safe) | ${r.data.erros?.length || 0} erros`;
      toast.success(msg);
      await fetchAll();
      await simular();
    } catch (e) {
      toast.error('Erro: ' + (e.response?.data?.detail || e.message));
    }
    setExecutando(false);
  };

  const sincronizarAsaas = async () => {
    if (!window.confirm('Sincronizar TODAS as cobrancas pendentes com o Asaas? Isso pode demorar 1-2 minutos se tiver muitas.')) return;
    setExecutando(true);
    try {
      const r = await axios.post(`${API_URL}/api/carteira/sincronizar-status`, {}, { withCredentials: true });
      toast.success(`✅ Sincronização: ${r.data.updated} cobranças atualizadas de ${r.data.total_checked} pendentes`);
      await simular();
    } catch (e) {
      toast.error('Erro: ' + (e.response?.data?.detail || e.message));
    }
    setExecutando(false);
  };

  const buscarClientes = async (q) => {
    setBuscaCliente(q);
    if (q.length < 2) { setClientesBusca([]); return; }
    try {
      const r = await axios.get(`${API_URL}/api/clientes?q=${encodeURIComponent(q)}&limit=10`, { withCredentials: true });
      setClientesBusca(r.data || []);
    } catch { /* empty */ }
  };

  const adicionarWhitelist = async () => {
    if (!novoCliente.cliente_id) { toast.warning('Selecione um cliente'); return; }
    try {
      await axios.post(`${API_URL}/api/automacao/bloqueio/whitelist`, novoCliente, { withCredentials: true });
      toast.success('Cliente adicionado a whitelist');
      setNovoCliente({ cliente_id: '', motivo: '' });
      setBuscaCliente('');
      setClientesBusca([]);
      fetchAll();
    } catch (e) {
      toast.error('Erro: ' + (e.response?.data?.detail || e.message));
    }
  };

  const [diagOpen, setDiagOpen] = useState(false);
  const [diagData, setDiagData] = useState(null);
  const [diagLoading, setDiagLoading] = useState(false);

  const diagnosticar = async (cliente_id) => {
    setDiagOpen(true);
    setDiagLoading(true);
    setDiagData(null);
    try {
      const r = await axios.get(`${API_URL}/api/automacao/bloqueio/diagnosticar/${cliente_id}`, { withCredentials: true });
      setDiagData(r.data);
    } catch (e) {
      toast.error('Erro: ' + (e.response?.data?.detail || e.message));
      setDiagOpen(false);
    }
    setDiagLoading(false);
  };

  const removerWhitelist = async (cliente_id) => {
    if (!window.confirm('Remover da whitelist?')) return;
    try {
      await axios.delete(`${API_URL}/api/automacao/bloqueio/whitelist/${cliente_id}`, { withCredentials: true });
      toast.success('Removido');
      fetchAll();
    } catch (e) {
      toast.error('Erro: ' + (e.response?.data?.detail || e.message));
    }
  };

  // Modal seleção em lote
  const abrirLote = async () => {
    setLoteOpen(true);
    setSelecionadosLote(new Set());
    setBuscaLote('');
    setMotivoLote('');
    setCarregandoClientes(true);
    try {
      const r = await axios.get(`${API_URL}/api/clientes?limit=5000`, { withCredentials: true });
      const clientes = (r.data || []).slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
      setTodosClientes(clientes);
    } catch (e) {
      toast.error('Erro ao carregar clientes: ' + (e.response?.data?.detail || e.message));
    }
    setCarregandoClientes(false);
  };

  const clientesFiltrados = todosClientes.filter(c => {
    if (!buscaLote.trim()) return true;
    const q = buscaLote.trim().toLowerCase();
    return (c.nome || '').toLowerCase().includes(q) ||
           (c.documento || '').toLowerCase().includes(q) ||
           (c.telefone || '').toLowerCase().includes(q);
  });

  const whitelistIds = new Set(whitelist.map(w => w.cliente_id));

  const toggleLote = (cid) => {
    setSelecionadosLote(prev => {
      const next = new Set(prev);
      if (next.has(cid)) next.delete(cid); else next.add(cid);
      return next;
    });
  };
  const selecionarTodosLote = () => {
    const elegiveis = clientesFiltrados.filter(c => !whitelistIds.has(c.id)).map(c => c.id);
    setSelecionadosLote(new Set(elegiveis));
  };
  const limparLote = () => setSelecionadosLote(new Set());

  const adicionarLote = async () => {
    if (selecionadosLote.size === 0) { toast.warning('Selecione ao menos um cliente'); return; }
    try {
      const r = await axios.post(`${API_URL}/api/automacao/bloqueio/whitelist/lote`,
        { cliente_ids: Array.from(selecionadosLote), motivo: motivoLote || null },
        { withCredentials: true });
      toast.success(`${r.data.adicionados} clientes adicionados à whitelist${r.data.ja_existiam ? ` (${r.data.ja_existiam} já existiam)` : ''}`);
      setLoteOpen(false);
      fetchAll();
    } catch (e) {
      toast.error('Erro: ' + (e.response?.data?.detail || e.message));
    }
  };

  if (loading || !config) {
    return <div className="p-8 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-400" /></div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto" data-testid="automacao-bloqueio-page">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-orange-400" />
            Automação de Bloqueio por Inadimplência
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Bloqueia clientes atrasados na Tá Telecom e desbloqueia automaticamente quando o pagamento é confirmado (via Asaas)</p>
        </div>
        <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2">
          <span className="text-sm text-zinc-400">Status:</span>
          <span className={`text-sm font-bold ${config.ativo ? 'text-emerald-400' : 'text-red-400'}`}>
            {config.ativo ? '● ATIVO' : '○ DESATIVADO'}
          </span>
          <Switch
            checked={config.ativo}
            onCheckedChange={toggleAtivo}
            data-testid="toggle-master"
          />
        </div>
      </div>

      {/* Alerta importante */}
      {!config.ativo && (
        <div className="bg-amber-900/20 border border-amber-700 rounded-lg p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold text-amber-300 mb-1">Automação desligada — nada acontece automaticamente.</div>
            <div className="text-zinc-300">Recomendado antes de ligar: (1) rode o <strong>Simular</strong> abaixo para ver quem seria bloqueado, (2) adicione VIPs à whitelist, (3) revise as configurações. Só então ligue o toggle acima.</div>
          </div>
        </div>
      )}
      {config.ativo && (
        <div className="bg-emerald-900/20 border border-emerald-700 rounded-lg p-4 flex gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold text-emerald-300 mb-1">Automação ATIVA</div>
            <div className="text-zinc-300">O sistema vai executar o bloqueio automaticamente as <strong>{config.hora_bloqueio}h</strong> (horario Brasil) todos os dias. Desbloqueio via webhook Asaas: {config.desbloqueio_automatico ? '<strong>LIGADO</strong>' : 'DESLIGADO'}.</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="painel" className="w-full">
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="painel" data-testid="tab-painel">
            <LayoutDashboard className="w-4 h-4 mr-1" /> Painel Central
          </TabsTrigger>
          <TabsTrigger value="config" data-testid="tab-config">
            <Settings className="w-4 h-4 mr-1" /> Configurações & Ferramentas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="painel" className="mt-5">
          <PainelAutoBloqueio />
        </TabsContent>

        <TabsContent value="config" className="mt-5">
          {/* Grid de cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card: Configuracoes */}
        <div className="lg:col-span-2 bg-zinc-950 border border-zinc-800 rounded-lg p-5 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Clock className="w-5 h-5 text-cyan-400" /> Configurações</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400 block mb-1">Hora bloqueio (D-2 exp Tá)</label>
              <Input type="number" min={0} max={23} value={config.hora_bloqueio}
                onChange={e => setConfig({ ...config, hora_bloqueio: parseInt(e.target.value) })}
                className="bg-zinc-900 border-zinc-700" data-testid="input-hora-bloqueio" />
              <p className="text-xs text-zinc-500 mt-1">Padrão 14h (BRT) — dispara o job de bloqueio</p>
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1">Hora lembrete D-3 (WhatsApp)</label>
              <Input type="number" min={0} max={23} value={config.hora_aviso}
                onChange={e => setConfig({ ...config, hora_aviso: parseInt(e.target.value) })}
                className="bg-zinc-900 border-zinc-700" data-testid="input-hora-aviso" />
              <p className="text-xs text-zinc-500 mt-1">Padrão 9h — envia 3 dias antes do bloqueio (1x por ciclo)</p>
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1">Hora alerta D-0 (vence hoje)</label>
              <Input type="number" min={0} max={23} value={config.hora_alerta_d0 ?? 12}
                onChange={e => setConfig({ ...config, hora_alerta_d0: parseInt(e.target.value) })}
                className="bg-zinc-900 border-zinc-700" data-testid="input-hora-d0" />
              <p className="text-xs text-zinc-500 mt-1">Padrão 12h — alerta urgente no dia do bloqueio</p>
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1">Motivo Tá Telecom</label>
              <Input type="number" value={config.motivo_bloqueio}
                onChange={e => setConfig({ ...config, motivo_bloqueio: parseInt(e.target.value) })}
                className="bg-zinc-900 border-zinc-700" data-testid="input-motivo" />
              <p className="text-xs text-zinc-500 mt-1">Código de motivo (padrão 15)</p>
            </div>
            <div className="flex items-center justify-between bg-zinc-900 rounded-lg px-3">
              <label className="text-xs text-zinc-400">Enviar lembrete D-3</label>
              <Switch checked={config.enviar_lembrete_d3 ?? true}
                onCheckedChange={v => setConfig({ ...config, enviar_lembrete_d3: v })}
                data-testid="toggle-d3" />
            </div>
            <div className="flex items-center justify-between bg-zinc-900 rounded-lg px-3">
              <label className="text-xs text-zinc-400">Enviar alerta D-0</label>
              <Switch checked={config.enviar_alerta_d0 ?? true}
                onCheckedChange={v => setConfig({ ...config, enviar_alerta_d0: v })}
                data-testid="toggle-d0" />
            </div>
            <div className="flex items-center justify-between bg-zinc-900 rounded-lg px-3">
              <label className="text-xs text-zinc-400">Executar bloqueio automático</label>
              <Switch checked={config.executar_bloqueio_auto ?? true}
                onCheckedChange={v => setConfig({ ...config, executar_bloqueio_auto: v })}
                data-testid="toggle-bloq-auto" />
            </div>
            <div className="flex items-center justify-between bg-zinc-900 rounded-lg px-3">
              <label className="text-xs text-zinc-400">Desbloqueio automático (webhook Asaas)</label>
              <Switch checked={config.desbloqueio_automatico}
                onCheckedChange={v => setConfig({ ...config, desbloqueio_automatico: v })}
                data-testid="toggle-desbloqueio" />
            </div>
            <div className="flex items-center justify-between bg-zinc-900 rounded-lg px-3 col-span-2 border border-emerald-800/50">
              <div>
                <label className="text-xs text-emerald-300 block">🛡️ Sync Asaas ANTES do bloqueio (recomendado)</label>
                <p className="text-xs text-zinc-500 mt-0.5">Puxa status atualizado do Asaas antes de decidir bloquear — protege caso o webhook não esteja funcionando</p>
              </div>
              <Switch checked={config.sync_asaas_antes_bloqueio}
                onCheckedChange={v => setConfig({ ...config, sync_asaas_antes_bloqueio: v })}
                data-testid="toggle-sync-asaas" />
            </div>
          </div>

          <details className="bg-zinc-900 rounded-lg p-3">
            <summary className="cursor-pointer text-sm text-zinc-300 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-emerald-400" /> Mensagens WhatsApp (personalizar)
            </summary>
            <div className="space-y-3 mt-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Lembrete D-3 (3 dias antes)</label>
                <Textarea rows={4} value={config.mensagem_aviso}
                  onChange={e => setConfig({ ...config, mensagem_aviso: e.target.value })}
                  className="bg-zinc-950 border-zinc-700 text-xs font-mono" data-testid="msg-aviso" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Alerta D-0 (vence hoje)</label>
                <Textarea rows={4} value={config.mensagem_alerta_d0 || ''}
                  onChange={e => setConfig({ ...config, mensagem_alerta_d0: e.target.value })}
                  className="bg-zinc-950 border-zinc-700 text-xs font-mono" data-testid="msg-d0" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Ao bloquear</label>
                <Textarea rows={3} value={config.mensagem_bloqueado}
                  onChange={e => setConfig({ ...config, mensagem_bloqueado: e.target.value })}
                  className="bg-zinc-950 border-zinc-700 text-xs font-mono" data-testid="msg-bloq" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Ao desbloquear (pagamento confirmado)</label>
                <Textarea rows={2} value={config.mensagem_desbloqueado}
                  onChange={e => setConfig({ ...config, mensagem_desbloqueado: e.target.value })}
                  className="bg-zinc-950 border-zinc-700 text-xs font-mono" data-testid="msg-desb" />
              </div>
              <p className="text-xs text-zinc-500">Placeholders disponíveis: <code>{'{nome}'}</code>, <code>{'{msisdn}'}</code>, <code>{'{valor}'}</code>, <code>{'{vencimento}'}</code>, <code>{'{data_bloqueio}'}</code>, <code>{'{data_expiracao}'}</code>, <code>{'{link}'}</code></p>
            </div>
          </details>

          <div className="flex justify-end">
            <Button onClick={salvarConfig} disabled={saving} className="btn-primary" data-testid="btn-salvar-config">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Salvar Configurações
            </Button>
          </div>
        </div>

        {/* Card: Simulador */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-5 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2"><PlayCircle className="w-5 h-5 text-violet-400" /> Simular / Executar</h2>

          <Button onClick={sincronizarAsaas} disabled={executando} variant="outline"
            className="w-full border-cyan-700 text-cyan-300 hover:bg-cyan-900/20" data-testid="btn-sync-asaas">
            {executando ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Sincronizar TODAS as cobranças com Asaas
          </Button>
          <p className="text-xs text-zinc-500 -mt-2">Recomendado antes de simular/executar. Atualiza status das cobranças pendentes.</p>

          <Button onClick={simular} disabled={simulando} variant="outline"
            className="w-full border-zinc-700 hover:bg-zinc-800" data-testid="btn-simular">
            {simulando ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Simular agora (só leitura)
          </Button>

          {simulacao && (
            <div className="bg-zinc-900 rounded-lg p-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-zinc-400">Total inadimplentes:</span><span className="font-bold" data-testid="sim-total">{simulacao.total}</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Seriam bloqueados:</span><span className="font-bold text-orange-400" data-testid="sim-a-bloquear">{simulacao.a_bloquear}</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Poupados (whitelist):</span><span className="font-bold text-cyan-400" data-testid="sim-whitelist">{simulacao.skip_whitelist}</span></div>
            </div>
          )}

          {simulacao?.itens?.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Todos os {simulacao.itens.length} clientes:</span>
                <button onClick={() => {
                  const rows = [['Cliente', 'Documento', 'Telefone', 'Valor', 'Vencimento', 'Expira Tá', 'Origem', 'MSISDN', 'Status']];
                  simulacao.itens.forEach(it => {
                    rows.push([
                      it.cliente_nome || '',
                      it.documento || '',
                      it.telefone || '',
                      (it.valor || 0).toFixed(2),
                      it.vencimento || '',
                      it.data_expiracao_ta || '',
                      it.origem || 'cobranca',
                      (it.linhas_afetadas || []).map(l => l.msisdn).join(' | '),
                      it.na_whitelist ? 'VIP (poupado)' : 'Seria bloqueado',
                    ]);
                  });
                  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
                  const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `inadimplentes-${new Date().toISOString().slice(0,10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }} className="text-cyan-400 hover:text-cyan-300 underline text-xs" data-testid="btn-export-csv">
                  📥 Exportar CSV
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto space-y-1 text-xs border border-zinc-800 rounded p-1" data-testid="lista-inadimplentes">
                {simulacao.itens.map((it, idx) => (
                  <div key={it.cliente_id} className="flex justify-between bg-zinc-900 rounded px-2 py-1 gap-2 items-center" data-testid={`sim-item-${idx}`}>
                    <span className="truncate flex-1" title={`${it.cliente_nome} • Expira Tá: ${it.data_expiracao_ta || '—'} • Origem: ${it.origem || 'cobranca'}`}>
                      <span className="text-zinc-500 mr-1">{idx + 1}.</span>{it.cliente_nome}
                      {it.data_expiracao_ta && (
                        <span className="ml-2 text-[10px] text-zinc-500">exp Tá: {it.data_expiracao_ta}</span>
                      )}
                    </span>
                    <span className={`shrink-0 ${it.na_whitelist ? 'text-cyan-400' : 'text-orange-400'}`}>
                      {it.na_whitelist ? '★ VIP' : `R$ ${it.valor?.toFixed(2)}`}
                    </span>
                    <button onClick={() => diagnosticar(it.cliente_id)}
                      className="text-cyan-400 hover:text-cyan-300 text-xs px-1"
                      title="Ver detalhes do cliente"
                      data-testid={`btn-diag-${idx}`}>
                      🔍
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-zinc-800 pt-3 space-y-2">
            <div className="bg-emerald-900/20 border border-emerald-800/50 rounded p-2 text-xs text-emerald-300">
              🛡️ <strong>Proteção fail-safe ativa:</strong> Antes de bloquear CADA cliente, o sistema consulta o Asaas individualmente. Se pago ou erro na consulta, pula.
            </div>
            <Button onClick={() => executar(true)} disabled={executando} variant="outline"
              className="w-full border-zinc-700 hover:bg-zinc-800" data-testid="btn-executar-dry">
              {executando ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Simular Execução (sem bloquear)
            </Button>
            <Button onClick={() => executar(false)} disabled={executando}
              className="w-full bg-red-600 hover:bg-red-700" data-testid="btn-executar-real">
              {executando ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Zap className="w-4 h-4 mr-1" />}
              Executar Bloqueio Real Agora
            </Button>
          </div>
        </div>
      </div>

      {/* Whitelist */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-cyan-400" /> Whitelist VIP ({whitelist.length})
        </h2>
        <p className="text-xs text-zinc-400 mb-3">Clientes na lista NUNCA serão bloqueados automaticamente</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3 relative">
          <div className="md:col-span-2 relative">
            <Input placeholder="Buscar cliente por nome ou CPF..." value={buscaCliente}
              onChange={e => buscarClientes(e.target.value)}
              className="bg-zinc-900 border-zinc-700" data-testid="input-buscar-cliente" />
            {clientesBusca.length > 0 && (
              <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-zinc-900 border border-zinc-700 rounded-md max-h-48 overflow-y-auto">
                {clientesBusca.map(c => (
                  <button key={c.id} onClick={() => { setNovoCliente({ ...novoCliente, cliente_id: c.id }); setBuscaCliente(c.nome); setClientesBusca([]); }}
                    className="w-full text-left px-3 py-2 hover:bg-zinc-800 text-sm border-b border-zinc-800 last:border-0">
                    <div className="font-medium">{c.nome}</div>
                    <div className="text-xs text-zinc-500">{c.documento}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Input placeholder="Motivo (opcional)" value={novoCliente.motivo}
            onChange={e => setNovoCliente({ ...novoCliente, motivo: e.target.value })}
            className="bg-zinc-900 border-zinc-700" data-testid="input-motivo-vip" />
        </div>
        <Button onClick={adicionarWhitelist} disabled={!novoCliente.cliente_id} size="sm"
          className="btn-primary" data-testid="btn-add-vip">
          <Plus className="w-4 h-4 mr-1" /> Adicionar à Whitelist
        </Button>
        <Button onClick={abrirLote} size="sm" variant="outline"
          className="ml-2 border-emerald-600 text-emerald-300 hover:bg-emerald-900/20 mb-4" data-testid="btn-add-lote">
          <Users className="w-4 h-4 mr-1" /> Adicionar Vários Clientes
        </Button>

        <div className="border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900">
              <tr className="text-xs uppercase text-zinc-400">
                <th className="p-2 text-left">Cliente</th>
                <th className="p-2 text-left">Documento</th>
                <th className="p-2 text-left">Motivo</th>
                <th className="p-2 text-left">Adicionado</th>
                <th className="p-2 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {whitelist.length === 0 && (
                <tr><td colSpan={5} className="p-4 text-center text-zinc-500">Nenhum cliente na whitelist</td></tr>
              )}
              {whitelist.map(w => (
                <tr key={w.id} className="border-t border-zinc-800/60" data-testid={`vip-row-${w.cliente_id}`}>
                  <td className="p-2">{w.cliente_nome || '—'}</td>
                  <td className="p-2 text-zinc-400 text-xs">{w.documento || '—'}</td>
                  <td className="p-2 text-zinc-300 text-xs">{w.motivo || '—'}</td>
                  <td className="p-2 text-zinc-500 text-xs">{formatDateTime(w.added_at)}</td>
                  <td className="p-2 text-right">
                    <Button variant="ghost" size="sm" onClick={() => removerWhitelist(w.cliente_id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 w-7 p-0"
                      data-testid={`btn-remove-vip-${w.cliente_id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historico */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <History className="w-5 h-5 text-purple-400" /> Histórico
        </h2>
        <div className="max-h-96 overflow-y-auto space-y-1">
          {historico.length === 0 && <div className="text-zinc-500 text-sm p-4 text-center">Nenhuma execução registrada ainda</div>}
          {historico.map(h => (
            <div key={h.id} className="text-xs bg-zinc-900 rounded px-3 py-2 flex justify-between gap-2">
              <div className="flex-1">
                <div className="text-zinc-300">{h.descricao}</div>
                <div className="text-zinc-500 mt-0.5">{h.user_name} • {formatDateTime(h.data)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal - Adicionar Varios Clientes a Whitelist */}
        </TabsContent>
      </Tabs>

      {loteOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setLoteOpen(false)}>
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg max-w-3xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()} data-testid="modal-lote">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" /> Adicionar Vários Clientes à Whitelist
              </h3>
              <button onClick={() => setLoteOpen(false)} className="text-zinc-400 hover:text-white" data-testid="btn-fechar-lote">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 flex-1 overflow-hidden flex flex-col">
              <Input placeholder="Buscar por nome, CPF ou telefone..." value={buscaLote}
                onChange={e => setBuscaLote(e.target.value)}
                className="bg-zinc-900 border-zinc-700" data-testid="input-busca-lote" />

              <div className="flex items-center justify-between text-xs">
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={selecionarTodosLote}
                    className="border-zinc-700 hover:bg-zinc-800" data-testid="btn-selecionar-todos-lote">
                    Selecionar visíveis ({clientesFiltrados.filter(c => !whitelistIds.has(c.id)).length})
                  </Button>
                  <Button size="sm" variant="outline" onClick={limparLote}
                    className="border-zinc-700 hover:bg-zinc-800" data-testid="btn-limpar-lote">
                    Limpar seleção
                  </Button>
                </div>
                <div className="text-zinc-400">
                  Selecionados: <span className="text-emerald-400 font-bold" data-testid="lote-count">{selecionadosLote.size}</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto border border-zinc-800 rounded" data-testid="lista-clientes-lote">
                {carregandoClientes ? (
                  <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-emerald-400" /></div>
                ) : clientesFiltrados.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500 text-sm">Nenhum cliente encontrado</div>
                ) : (
                  clientesFiltrados.map(c => {
                    const jaEstaNaLista = whitelistIds.has(c.id);
                    const sel = selecionadosLote.has(c.id);
                    return (
                      <label key={c.id} className={`flex items-center gap-3 px-3 py-2 border-b border-zinc-800/60 cursor-pointer ${jaEstaNaLista ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-900'}`} data-testid={`cliente-lote-${c.id}`}>
                        <input type="checkbox"
                          checked={sel}
                          disabled={jaEstaNaLista}
                          onChange={() => toggleLote(c.id)}
                          className="accent-emerald-500 w-4 h-4"
                          data-testid={`check-lote-${c.id}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{c.nome}</div>
                          <div className="text-xs text-zinc-500">{c.documento || '—'} • {c.telefone || '—'}</div>
                        </div>
                        {jaEstaNaLista && <span className="text-xs text-cyan-400 shrink-0">★ Já é VIP</span>}
                      </label>
                    );
                  })
                )}
              </div>

              <Input placeholder="Motivo (opcional, aplicado a todos)" value={motivoLote}
                onChange={e => setMotivoLote(e.target.value)}
                className="bg-zinc-900 border-zinc-700" data-testid="input-motivo-lote" />
            </div>

            <div className="p-4 border-t border-zinc-800 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setLoteOpen(false)}
                className="border-zinc-700 hover:bg-zinc-800" data-testid="btn-cancelar-lote">
                Cancelar
              </Button>
              <Button onClick={adicionarLote} disabled={selecionadosLote.size === 0}
                className="btn-primary" data-testid="btn-confirmar-lote">
                <Plus className="w-4 h-4 mr-1" />
                Adicionar {selecionadosLote.size} cliente{selecionadosLote.size === 1 ? '' : 's'}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Modal - Diagnostico do Cliente */}
      {diagOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setDiagOpen(false)}>
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg max-w-3xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()} data-testid="modal-diag">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                🔍 Diagnóstico do Cliente
              </h3>
              <button onClick={() => setDiagOpen(false)} className="text-zinc-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {diagLoading && <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-emerald-400" /></div>}
              {diagData && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-lg font-semibold" data-testid="diag-nome">{diagData.cliente.nome}</h4>
                    <div className="text-xs text-zinc-500">{diagData.cliente.documento} • {diagData.cliente.telefone}</div>
                  </div>

                  <div className={`p-3 rounded border ${diagData.resumo.seria_bloqueado ? 'bg-orange-900/20 border-orange-700' : 'bg-emerald-900/20 border-emerald-700'}`}>
                    <div className="font-semibold mb-1" data-testid="diag-resumo">
                      {diagData.resumo.seria_bloqueado ? '⚠️ SERIA BLOQUEADO' : '✅ NÃO SERIA BLOQUEADO'}
                    </div>
                    <div className="text-xs text-zinc-300">Motivo: {diagData.resumo.motivo}</div>
                    {diagData.na_whitelist && <div className="text-xs text-cyan-400 mt-1">★ Cliente está na Whitelist VIP{diagData.motivo_whitelist ? `: ${diagData.motivo_whitelist}` : ''}</div>}
                  </div>

                  {diagData.linhas.length > 0 && (
                    <div>
                      <h5 className="text-sm font-semibold mb-2">Linhas ({diagData.linhas.length})</h5>
                      <div className="space-y-1">
                        {diagData.linhas.map(l => (
                          <div key={l.id} className="text-xs bg-zinc-900 rounded px-2 py-1 flex justify-between">
                            <span className="font-mono">{l.msisdn || '—'}</span>
                            <span className={l.status === 'ativo' ? 'text-emerald-400' : 'text-zinc-400'}>{l.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h5 className="text-sm font-semibold mb-2">Todas as cobranças ({diagData.total_cobrancas})</h5>
                    <div className="max-h-64 overflow-y-auto border border-zinc-800 rounded" data-testid="diag-cobrancas">
                      <table className="w-full text-xs">
                        <thead className="bg-zinc-900 sticky top-0">
                          <tr>
                            <th className="p-2 text-left">Vencimento</th>
                            <th className="p-2 text-left">Status</th>
                            <th className="p-2 text-right">Valor</th>
                            <th className="p-2 text-left">Pago em</th>
                          </tr>
                        </thead>
                        <tbody>
                          {diagData.cobrancas.map(c => (
                            <tr key={c.id} className="border-t border-zinc-800/60">
                              <td className="p-2 font-mono">{c.vencimento}</td>
                              <td className="p-2">
                                <span className={
                                  ['CONFIRMED','RECEIVED','RECEIVED_IN_CASH'].includes(c.status) ? 'text-emerald-400' :
                                  c.status === 'OVERDUE' ? 'text-red-400' : 'text-amber-400'
                                }>{c.status}</span>
                              </td>
                              <td className="p-2 text-right">R$ {(c.valor || 0).toFixed(2)}</td>
                              <td className="p-2 text-zinc-500">{c.paid_at ? c.paid_at.slice(0, 10) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
