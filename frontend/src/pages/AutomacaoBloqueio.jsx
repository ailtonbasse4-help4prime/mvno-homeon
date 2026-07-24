import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import {
  Shield, ShieldAlert, ShieldCheck, Zap, Clock, Users, PlayCircle,
  RefreshCw, Trash2, Plus, AlertTriangle, CheckCircle2, XCircle,
  MessageCircle, History, Loader2,
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
      toast.success(`${dry_run ? '[DRY RUN]' : '[REAL]'} ${r.data.bloqueadas} bloqueadas | ${r.data.puladas_whitelist} whitelist | ${r.data.erros?.length || 0} erros`);
      await fetchAll();
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

      {/* Grid de cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card: Configuracoes */}
        <div className="lg:col-span-2 bg-zinc-950 border border-zinc-800 rounded-lg p-5 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Clock className="w-5 h-5 text-cyan-400" /> Configurações</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400 block mb-1">Hora do bloqueio (0-23)</label>
              <Input type="number" min={0} max={23} value={config.hora_bloqueio}
                onChange={e => setConfig({ ...config, hora_bloqueio: parseInt(e.target.value) })}
                className="bg-zinc-900 border-zinc-700" data-testid="input-hora-bloqueio" />
              <p className="text-xs text-zinc-500 mt-1">Padrão 23h (antes da Tá recarregar)</p>
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1">Hora do aviso (WhatsApp)</label>
              <Input type="number" min={0} max={23} value={config.hora_aviso}
                onChange={e => setConfig({ ...config, hora_aviso: parseInt(e.target.value) })}
                className="bg-zinc-900 border-zinc-700" data-testid="input-hora-aviso" />
              <p className="text-xs text-zinc-500 mt-1">1 dia antes do bloqueio</p>
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1">Motivo Tá Telecom</label>
              <Input type="number" value={config.motivo_bloqueio}
                onChange={e => setConfig({ ...config, motivo_bloqueio: parseInt(e.target.value) })}
                className="bg-zinc-900 border-zinc-700" data-testid="input-motivo" />
              <p className="text-xs text-zinc-500 mt-1">Código de motivo (padrão 15)</p>
            </div>
            <div className="flex items-center justify-between bg-zinc-900 rounded-lg px-3">
              <label className="text-xs text-zinc-400">Aviso WhatsApp 1 dia antes</label>
              <Switch checked={config.aviso_dia_anterior}
                onCheckedChange={v => setConfig({ ...config, aviso_dia_anterior: v })}
                data-testid="toggle-aviso" />
            </div>
            <div className="flex items-center justify-between bg-zinc-900 rounded-lg px-3">
              <label className="text-xs text-zinc-400">Desbloqueio automático (webhook)</label>
              <Switch checked={config.desbloqueio_automatico}
                onCheckedChange={v => setConfig({ ...config, desbloqueio_automatico: v })}
                data-testid="toggle-desbloqueio" />
            </div>
            <div className="flex items-center justify-between bg-zinc-900 rounded-lg px-3">
              <label className="text-xs text-zinc-400">Notificar cliente (WhatsApp) ao bloquear</label>
              <Switch checked={config.notificar_admin}
                onCheckedChange={v => setConfig({ ...config, notificar_admin: v })}
                data-testid="toggle-notif" />
            </div>
          </div>

          <details className="bg-zinc-900 rounded-lg p-3">
            <summary className="cursor-pointer text-sm text-zinc-300 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-emerald-400" /> Mensagens WhatsApp (personalizar)
            </summary>
            <div className="space-y-3 mt-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Aviso 1 dia antes</label>
                <Textarea rows={2} value={config.mensagem_aviso}
                  onChange={e => setConfig({ ...config, mensagem_aviso: e.target.value })}
                  className="bg-zinc-950 border-zinc-700 text-xs" data-testid="msg-aviso" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Ao bloquear</label>
                <Textarea rows={2} value={config.mensagem_bloqueado}
                  onChange={e => setConfig({ ...config, mensagem_bloqueado: e.target.value })}
                  className="bg-zinc-950 border-zinc-700 text-xs" data-testid="msg-bloq" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Ao desbloquear (pagamento confirmado)</label>
                <Textarea rows={2} value={config.mensagem_desbloqueado}
                  onChange={e => setConfig({ ...config, mensagem_desbloqueado: e.target.value })}
                  className="bg-zinc-950 border-zinc-700 text-xs" data-testid="msg-desb" />
              </div>
              <p className="text-xs text-zinc-500">Placeholders: <code>{'{nome}'}</code>, <code>{'{valor}'}</code>, <code>{'{vencimento}'}</code></p>
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
            <div className="max-h-48 overflow-y-auto space-y-1 text-xs">
              {simulacao.itens.slice(0, 20).map(it => (
                <div key={it.cliente_id} className="flex justify-between bg-zinc-900 rounded px-2 py-1">
                  <span className="truncate">{it.cliente_nome}</span>
                  <span className={it.na_whitelist ? 'text-cyan-400' : 'text-orange-400'}>
                    {it.na_whitelist ? '★ VIP' : `R$ ${it.valor?.toFixed(2)}`}
                  </span>
                </div>
              ))}
              {simulacao.itens.length > 20 && <div className="text-zinc-500 text-center">+ {simulacao.itens.length - 20} outros</div>}
            </div>
          )}

          <div className="border-t border-zinc-800 pt-3 space-y-2">
            <Button onClick={() => executar(true)} disabled={executando} variant="outline"
              className="w-full border-zinc-700 hover:bg-zinc-800" data-testid="btn-executar-dry">
              {executando ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Executar DRY RUN
            </Button>
            <Button onClick={() => executar(false)} disabled={executando}
              className="w-full bg-red-600 hover:bg-red-700" data-testid="btn-executar-real">
              {executando ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Zap className="w-4 h-4 mr-1" />}
              Executar REAL (bloqueia)
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
          className="btn-primary mb-4" data-testid="btn-add-vip">
          <Plus className="w-4 h-4 mr-1" /> Adicionar à Whitelist
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
    </div>
  );
}
