import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { MessageCircle, Send, X as XIcon, CheckCircle2, AlertCircle, Loader2, Settings } from 'lucide-react';
import { formatDateBR } from '../lib/formatters';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const PAID = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'REFUNDED'];

export function WhatsAppLoteDialog({ open, onClose, cobrancas, clientes }) {
  const [config, setConfig] = useState(null);
  const [statusZapi, setStatusZapi] = useState(null);
  const [filtro, setFiltro] = useState('vencidas');
  const [selecionadas, setSelecionadas] = useState(new Set());
  const [enviando, setEnviando] = useState(false);
  const [job, setJob] = useState(null);
  const [showConfig, setShowConfig] = useState(false);
  const [configForm, setConfigForm] = useState({ instance_id: '', token: '', client_token: '' });
  const [savingConfig, setSavingConfig] = useState(false);
  const [template, setTemplate] = useState('');
  const [showTemplate, setShowTemplate] = useState(false);

  const clienteMap = useMemo(() => {
    const m = {};
    clientes?.forEach(c => { m[c.id] = c; });
    return m;
  }, [clientes]);

  useEffect(() => {
    if (!open) return;
    loadConfig();
    loadStatus();
    loadJob();
  }, [open]);

  const loadConfig = async () => {
    try {
      const r = await axios.get(`${API_URL}/api/whatsapp/config`, { withCredentials: true });
      setConfig(r.data);
      setTemplate(r.data.template || '');
    } catch (e) { toast.error('Erro ao carregar config'); }
  };

  const loadStatus = async () => {
    try {
      const r = await axios.get(`${API_URL}/api/whatsapp/status`, { withCredentials: true });
      setStatusZapi(r.data);
    } catch { setStatusZapi(null); }
  };

  const loadJob = async () => {
    try {
      const r = await axios.get(`${API_URL}/api/whatsapp/job-status`, { withCredentials: true });
      if (r.data.status === 'running') {
        setJob(r.data);
        setEnviando(true);
        pollJob();
      } else {
        setJob(r.data);
      }
    } catch {}
  };

  const pollJob = () => {
    const t = setInterval(async () => {
      try {
        const r = await axios.get(`${API_URL}/api/whatsapp/job-status`, { withCredentials: true });
        setJob(r.data);
        if (r.data.status !== 'running') {
          clearInterval(t);
          setEnviando(false);
          if (r.data.status === 'completed') {
            toast.success(`Lote concluído: ${r.data.enviadas}/${r.data.total} enviadas (${r.data.erros} erros)`);
          }
        }
      } catch {}
    }, 3000);
  };

  // Filtragem das cobrancas
  const cobrancasFiltradas = useMemo(() => {
    if (!cobrancas) return [];
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const hojeIso = hoje.toISOString().slice(0,10);
    const limite7 = new Date(hoje); limite7.setDate(limite7.getDate() + 7);
    const limite7Iso = limite7.toISOString().slice(0,10);
    const limite3 = new Date(hoje); limite3.setDate(limite3.getDate() + 3);
    const limite3Iso = limite3.toISOString().slice(0,10);

    return cobrancas.filter(c => {
      if (PAID.includes(c.status)) return false;  // pagas nunca enviam
      const venc = (c.vencimento || '').slice(0,10);
      if (!venc) return false;
      if (filtro === 'vencidas') return venc < hojeIso;
      if (filtro === 'hoje') return venc === hojeIso;
      if (filtro === 'venc_3') return venc >= hojeIso && venc <= limite3Iso;
      if (filtro === 'venc_7') return venc >= hojeIso && venc <= limite7Iso;
      if (filtro === 'pendentes') return true;
      return true;
    });
  }, [cobrancas, filtro]);

  // Sincroniza selecao com filtro
  useEffect(() => {
    setSelecionadas(new Set(cobrancasFiltradas.map(c => c.id)));
  }, [cobrancasFiltradas]);

  const toggleSelecao = (id) => {
    const s = new Set(selecionadas);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelecionadas(s);
  };

  const toggleAll = () => {
    if (selecionadas.size === cobrancasFiltradas.length) {
      setSelecionadas(new Set());
    } else {
      setSelecionadas(new Set(cobrancasFiltradas.map(c => c.id)));
    }
  };

  const salvarConfig = async () => {
    if (!configForm.instance_id || !configForm.token || !configForm.client_token) {
      toast.error('Preencha as 3 chaves');
      return;
    }
    setSavingConfig(true);
    try {
      await axios.post(`${API_URL}/api/whatsapp/config`, configForm, { withCredentials: true });
      toast.success('Z-API configurado!');
      setShowConfig(false);
      setConfigForm({ instance_id: '', token: '', client_token: '' });
      loadConfig();
      loadStatus();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao salvar');
    }
    setSavingConfig(false);
  };

  const salvarTemplate = async () => {
    try {
      await axios.post(`${API_URL}/api/whatsapp/template`, { template }, { withCredentials: true });
      toast.success('Template salvo!');
      setShowTemplate(false);
      loadConfig();
    } catch (e) {
      toast.error('Erro ao salvar template');
    }
  };

  const enviarLote = async () => {
    if (selecionadas.size === 0) {
      toast.error('Selecione ao menos 1 cobrança'); return;
    }
    const total = selecionadas.size;
    const msg = `Enviar ${total} mensagem(ns) via WhatsApp?\n\nDelay anti-banimento: 5-8s entre cada.\nTempo estimado: ~${Math.ceil(total * 6.5 / 60)} min`;
    if (!window.confirm(msg)) return;

    setEnviando(true);
    try {
      const r = await axios.post(`${API_URL}/api/whatsapp/enviar-lote`, {
        cobranca_ids: Array.from(selecionadas),
      }, { withCredentials: true });
      if (r.data.status === 'already_running') {
        toast.info('Já existe um envio em andamento');
      } else {
        toast.success('Envio iniciado em background');
      }
      pollJob();
    } catch (e) {
      setEnviando(false);
      toast.error(e.response?.data?.detail || 'Erro ao iniciar envio');
    }
  };

  const cancelar = async () => {
    if (!job?.job_id) return;
    if (!window.confirm('Cancelar envio em andamento?')) return;
    try {
      await axios.post(`${API_URL}/api/whatsapp/cancelar-job?job_id=${job.job_id}`, {}, { withCredentials: true });
      toast.info('Cancelamento solicitado');
    } catch {}
  };

  // Renderizacao
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-zinc-950 border-zinc-800" data-testid="whatsapp-lote-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-400">
            <MessageCircle className="w-5 h-5" /> Enviar Cobranças via WhatsApp (Z-API)
          </DialogTitle>
        </DialogHeader>

        {/* Status conexao */}
        <div className="bg-zinc-900 rounded-md p-3 border border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            {!config?.configured ? (
              <span className="text-amber-400 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> Z-API não configurado</span>
            ) : statusZapi?.data?.connected ? (
              <span className="text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Z-API conectado e pronto</span>
            ) : (
              <span className="text-amber-400 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> Z-API configurado mas não conectado</span>
            )}
            <span className="text-zinc-500 text-xs ml-3">{config?.instance_id_masked}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowTemplate(true)} className="border-zinc-700" data-testid="btn-template">
              Editar mensagem
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowConfig(true)} className="border-zinc-700" data-testid="btn-config-zapi">
              <Settings className="w-4 h-4 mr-1" /> Credenciais
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2">
          {[
            { v: 'vencidas', l: 'Vencidas (em atraso)', c: 'red' },
            { v: 'hoje', l: 'Vencem hoje', c: 'amber' },
            { v: 'venc_3', l: 'Próximos 3 dias', c: 'amber' },
            { v: 'venc_7', l: 'Próximos 7 dias', c: 'blue' },
            { v: 'pendentes', l: 'Todas pendentes', c: 'zinc' },
          ].map(o => (
            <button
              key={o.v}
              onClick={() => setFiltro(o.v)}
              className={`px-3 py-1.5 rounded-md text-sm border ${filtro === o.v ? `bg-${o.c}-500/20 border-${o.c}-500 text-${o.c}-300` : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'}`}
              data-testid={`filter-${o.v}`}
            >
              {o.l}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="border border-zinc-800 rounded-md overflow-hidden">
          <div className="bg-zinc-900 px-3 py-2 flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={selecionadas.size === cobrancasFiltradas.length && cobrancasFiltradas.length > 0} onChange={toggleAll} />
              <span className="text-zinc-300 font-semibold">{selecionadas.size} de {cobrancasFiltradas.length} selecionadas</span>
            </label>
            <span className="text-zinc-500">Cobranças que serão enviadas no lote</span>
          </div>
          <div className="max-h-[40vh] overflow-y-auto">
            {cobrancasFiltradas.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-sm">Nenhuma cobrança no filtro selecionado</div>
            ) : (
              cobrancasFiltradas.map(c => {
                const cli = clienteMap[c.cliente_id] || {};
                const sel = selecionadas.has(c.id);
                const hojeIso = new Date().toISOString().slice(0,10);
                const venc = (c.vencimento || '').slice(0,10);
                const atrasada = venc < hojeIso;
                return (
                  <label key={c.id} className={`flex items-center gap-3 px-3 py-2.5 border-t border-zinc-800 hover:bg-zinc-900 cursor-pointer ${sel ? 'bg-zinc-900/50' : ''}`}>
                    <input type="checkbox" checked={sel} onChange={() => toggleSelecao(c.id)} data-testid={`cb-${c.id}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-zinc-200 truncate">{cli.nome || c.cliente_nome || '?'}</div>
                      <div className="text-xs text-zinc-500">
                        {cli.telefone || cli.celular || <span className="text-red-400">SEM TELEFONE</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-emerald-400 font-mono">R$ {Number(c.valor || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                      <div className={`text-xs ${atrasada ? 'text-red-400' : 'text-zinc-500'}`}>{venc ? formatDateBR(venc) : '-'}</div>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* Progresso do job */}
        {job && job.status === 'running' && (
          <div className="bg-blue-950/30 border border-blue-700 rounded-md p-3 text-sm">
            <div className="flex items-center gap-2 text-blue-300">
              <Loader2 className="w-4 h-4 animate-spin" />
              Enviando: {job.processadas || 0}/{job.total} ({job.enviadas} ✅, {job.erros} ❌)
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-2 mt-2">
              <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${job.total ? (job.processadas/job.total*100) : 0}%` }} />
            </div>
            <Button size="sm" variant="outline" onClick={cancelar} className="mt-2 border-red-700 text-red-400 hover:bg-red-950" data-testid="btn-cancelar-lote">
              Cancelar envio
            </Button>
          </div>
        )}
        {job && job.status === 'completed' && (
          <div className="bg-emerald-950/30 border border-emerald-700 rounded-md p-3 text-sm text-emerald-300">
            ✅ Último lote: {job.enviadas}/{job.total} enviadas, {job.erros} erros
          </div>
        )}

        {/* Erros do ultimo lote */}
        {job?.erros_detalhes?.length > 0 && (
          <details className="bg-zinc-900 rounded-md p-3 text-xs text-zinc-400">
            <summary className="cursor-pointer text-amber-400">Ver {job.erros_detalhes.length} erro(s)</summary>
            <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {job.erros_detalhes.map((e, i) => (
                <li key={i}>• {e.cliente || e.cobranca_id}: {e.error}</li>
              ))}
            </ul>
          </details>
        )}

        {/* Botoes */}
        <div className="flex justify-between items-center pt-3 border-t border-zinc-800">
          <span className="text-xs text-zinc-500">
            ⚡ Delay 5-8s anti-banimento • Tempo estimado: ~{Math.ceil(selecionadas.size * 6.5 / 60)} min
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="border-zinc-700" data-testid="btn-fechar">Fechar</Button>
            <Button
              onClick={enviarLote}
              disabled={enviando || selecionadas.size === 0 || !config?.configured || !statusZapi?.data?.connected}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
              data-testid="btn-enviar-lote"
            >
              <Send className="w-4 h-4 mr-1.5" />
              {enviando ? 'Enviando...' : `Enviar para ${selecionadas.size}`}
            </Button>
          </div>
        </div>

        {/* Sub-modal: Configurar Z-API */}
        {showConfig && (
          <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4" onClick={() => !savingConfig && setShowConfig(false)}>
            <div className="bg-zinc-900 border border-zinc-700 rounded-lg max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-emerald-400 mb-1">Credenciais Z-API</h3>
              <p className="text-xs text-zinc-400 mb-4">Atual: {config?.instance_id_masked}</p>
              <div className="space-y-3">
                <input type="text" placeholder="Instance ID" value={configForm.instance_id} onChange={e => setConfigForm({...configForm, instance_id: e.target.value})} className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm" data-testid="input-instance-id" />
                <input type="text" placeholder="Token" value={configForm.token} onChange={e => setConfigForm({...configForm, token: e.target.value})} className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm" data-testid="input-token" />
                <input type="text" placeholder="Client-Token (Account Security Token)" value={configForm.client_token} onChange={e => setConfigForm({...configForm, client_token: e.target.value})} className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm" data-testid="input-client-token" />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={() => setShowConfig(false)} disabled={savingConfig} className="border-zinc-700">Cancelar</Button>
                <Button size="sm" onClick={salvarConfig} disabled={savingConfig} className="bg-emerald-600 hover:bg-emerald-500" data-testid="btn-salvar-config">
                  {savingConfig ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Sub-modal: Editar template */}
        {showTemplate && (
          <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4" onClick={() => setShowTemplate(false)}>
            <div className="bg-zinc-900 border border-zinc-700 rounded-lg max-w-lg w-full p-5" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-emerald-400 mb-1">Template da mensagem</h3>
              <p className="text-xs text-zinc-400 mb-3">
                Variáveis disponíveis: <code className="text-emerald-400">{'{nome}'}</code>{' '}
                <code className="text-emerald-400">{'{primeiro_nome}'}</code>{' '}
                <code className="text-emerald-400">{'{valor}'}</code>{' '}
                <code className="text-emerald-400">{'{data}'}</code>{' '}
                <code className="text-emerald-400">{'{link}'}</code>{' '}
                <code className="text-emerald-400">{'{pix}'}</code>{' '}
                <code className="text-emerald-400">{'{boleto_codigo}'}</code>
              </p>
              <textarea
                value={template}
                onChange={e => setTemplate(e.target.value)}
                rows={10}
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm font-mono"
                data-testid="textarea-template"
              />
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={() => setShowTemplate(false)} className="border-zinc-700">Cancelar</Button>
                <Button size="sm" onClick={salvarTemplate} className="bg-emerald-600 hover:bg-emerald-500" data-testid="btn-salvar-template">
                  Salvar template
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
