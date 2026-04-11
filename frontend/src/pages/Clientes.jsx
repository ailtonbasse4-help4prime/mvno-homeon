import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { safeArray } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { Plus, Search, Edit, Trash2, Users, CheckCircle, AlertCircle, RefreshCw, Phone, Wrench } from 'lucide-react';
import { ConfirmPasswordDialog } from '../components/ConfirmPasswordDialog';
import { useSecureAction } from '../hooks/useSecureAction';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const emptyForm = {
  nome: '', tipo_pessoa: 'pf', documento: '', telefone: '', email: '',
  data_nascimento: '', cep: '', endereco: '', numero_endereco: '',
  bairro: '', cidade: '', estado: '', city_code: '', complemento: '',
  status: 'ativo',
};

export function Clientes() {
  const { isAdmin } = useAuth();
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef(null);

  // Debounce search - triggers after 400ms of no typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
  const [clienteToDelete, setClienteToDelete] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const { executeSecureDelete, confirmState, closeConfirm } = useSecureAction();

  const fetchClientes = useCallback(async () => {
    try {
      const params = debouncedSearch ? { search: debouncedSearch } : {};
      const response = await axios.get(`${API_URL}/api/clientes`, { params, withCredentials: true });
      setClientes(safeArray(response.data));
    } catch (error) {
      toast.error('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => { fetchClientes(); }, [fetchClientes]);

  const handleOpenDialog = (cliente = null) => {
    if (cliente) {
      setEditingCliente(cliente);
      setFormData({
        nome: cliente.nome, tipo_pessoa: cliente.tipo_pessoa || 'pf',
        documento: cliente.documento, telefone: cliente.telefone,
        email: cliente.email || '',
        data_nascimento: cliente.data_nascimento || '',
        cep: cliente.cep || '', endereco: cliente.endereco || '',
        numero_endereco: cliente.numero_endereco || '',
        bairro: cliente.bairro || '', cidade: cliente.cidade || '',
        estado: cliente.estado || '', city_code: cliente.city_code || '',
        complemento: cliente.complemento || '', status: cliente.status,
      });
    } else {
      setEditingCliente(null);
      setFormData(emptyForm);
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...formData };
      if (editingCliente) {
        await axios.put(`${API_URL}/api/clientes/${editingCliente.id}`, payload, { withCredentials: true });
        toast.success('Cliente atualizado com sucesso');
      } else {
        await axios.post(`${API_URL}/api/clientes`, payload, { withCredentials: true });
        toast.success('Cliente cadastrado com sucesso');
      }
      setDialogOpen(false);
      fetchClientes();
    } catch (error) {
      const message = error.response?.data?.detail || 'Erro ao salvar cliente';
      toast.error(typeof message === 'string' ? message : 'Erro ao salvar cliente');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!clienteToDelete) return;
    setDeleteDialogOpen(false);
    try {
      await executeSecureDelete(`/api/clientes/${clienteToDelete.id}`, `Remover cliente: ${clienteToDelete.nome}`);
      toast.success('Cliente removido com sucesso');
      setClienteToDelete(null);
      fetchClientes();
    } catch (error) {
      const msg = error.response?.data?.detail || 'Erro ao remover';
      toast.error(typeof msg === 'string' ? msg : 'Erro ao remover');
    }
  };

  const handleSyncClients = async () => {
    setSyncing(true);
    try {
      const response = await axios.post(`${API_URL}/api/operadora/sincronizar-clientes`, {}, { withCredentials: true });
      const d = response.data;
      toast.success(`${d.clients_created} clientes importados, ${d.clients_updated} atualizados, ${d.lines_created} linhas criadas`);
      if (d.errors && d.errors.length > 0) {
        toast.warning(`${d.errors.length} erros durante a sincronizacao`);
      }
      fetchClientes();
    } catch (error) {
      const msg = error.response?.data?.detail || 'Erro ao sincronizar clientes';
      toast.error(typeof msg === 'string' ? msg : 'Erro ao sincronizar');
    } finally {
      setSyncing(false);
    }
  };

  const handleRepairClients = async () => {
    setRepairing(true);
    try {
      // Etapa 1: Reparar clientes sem linha
      const res1 = await axios.post(`${API_URL}/api/operadora/reparar-clientes`, {}, { withCredentials: true });
      if (!res1.data.success) {
        // If repair already running, just poll
        toast.info(res1.data.message);
      } else {
        toast.info('Etapa 1: Reparando clientes sem dados...');
      }

      // Poll until step 1 is done
      const waitForDone = () => new Promise((resolve) => {
        const poll = setInterval(async () => {
          try {
            const s = await axios.get(`${API_URL}/api/operadora/reparar-status`, { withCredentials: true });
            if (s.data.status === 'done' || s.data.status === 'error' || s.data.status === 'idle') {
              clearInterval(poll);
              resolve(s.data);
            }
          } catch { clearInterval(poll); resolve({ status: 'error' }); }
        }, 5000);
      });

      const result1 = await waitForDone();
      if (result1.repaired > 0) toast.success(`${result1.repaired} clientes reparados!`);

      // Etapa 2: Completar planos de todas as linhas
      toast.info('Etapa 2: Atualizando planos de todos os clientes...');
      await axios.post(`${API_URL}/api/operadora/completar-planos`, {}, { withCredentials: true });

      // Poll until step 2 is done
      const result2 = await waitForDone();
      if (result2.repaired > 0) {
        toast.success(`${result2.repaired} planos atualizados!`);
      } else {
        toast.info(result2.message || 'Planos ja estavam corretos.');
      }
      if (result2.errors?.length > 0) toast.warning(`${result2.errors.length} erros`);

      fetchClientes();
    } catch (error) {
      const msg = error.response?.data?.detail || 'Erro ao iniciar reparo';
      toast.error(typeof msg === 'string' ? msg : 'Erro ao reparar');
    } finally {
      setRepairing(false);
    }
  };

  const formatDoc = (val, tipo) => {
    const n = val.replace(/\D/g, '');
    if (tipo === 'pj') {
      if (n.length <= 2) return n;
      if (n.length <= 5) return `${n.slice(0,2)}.${n.slice(2)}`;
      if (n.length <= 8) return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5)}`;
      if (n.length <= 12) return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5,8)}/${n.slice(8)}`;
      return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5,8)}/${n.slice(8,12)}-${n.slice(12,14)}`;
    }
    if (n.length <= 3) return n;
    if (n.length <= 6) return `${n.slice(0,3)}.${n.slice(3)}`;
    if (n.length <= 9) return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6)}`;
    return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6,9)}-${n.slice(9,11)}`;
  };

  const formatPhone = (val) => {
    const n = val.replace(/\D/g, '');
    if (n.length <= 2) return n.length ? `(${n}` : '';
    if (n.length <= 7) return `(${n.slice(0,2)}) ${n.slice(2)}`;
    return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7,11)}`;
  };

  const f = (field, val) => setFormData(prev => ({ ...prev, [field]: val }));

  const handleCepLookup = async (rawCep) => {
    const cleaned = rawCep.replace(/\D/g, '').slice(0, 8);
    f('cep', cleaned);
    if (cleaned.length === 8) {
      try {
        const res = await axios.get(`https://viacep.com.br/ws/${cleaned}/json/`);
        if (res.data && !res.data.erro) {
          setFormData(prev => ({
            ...prev,
            endereco: res.data.logradouro || prev.endereco,
            bairro: res.data.bairro || prev.bairro,
            cidade: res.data.localidade || prev.cidade,
            estado: res.data.uf || prev.estado,
          }));
        }
      } catch {} // eslint-disable-line no-empty
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6" data-testid="clientes-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-3"><Users className="w-7 h-7 text-blue-500" />Clientes</h1>
          <p className="text-zinc-400 text-sm -mt-4">Gerenciamento de clientes</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {isAdmin && (
            <>
              <Button onClick={handleRepairClients} disabled={repairing || syncing} variant="outline" className="flex items-center gap-2 w-full sm:w-auto border-amber-700 text-amber-400 hover:bg-amber-950" data-testid="repair-clientes-button">
                <Wrench className={`w-4 h-4 ${repairing ? 'animate-spin' : ''}`} />
                {repairing ? 'Reparando...' : 'Reparar Dados'}
              </Button>
              <Button onClick={handleSyncClients} disabled={syncing || repairing} variant="outline" className="flex items-center gap-2 w-full sm:w-auto border-zinc-700 hover:bg-zinc-800" data-testid="sync-clientes-button">
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Sincronizando...' : 'Sincronizar Clientes'}
              </Button>
            </>
          )}
          <Button onClick={() => handleOpenDialog()} className="btn-primary flex items-center gap-2 w-full sm:w-auto" data-testid="add-cliente-button">
            <Plus className="w-4 h-4" />Novo Cliente
          </Button>
        </div>
      </div>

      <div className="relative max-w-full sm:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <Input type="text" placeholder="Buscar por nome, documento ou telefone..." value={search} onChange={(e) => setSearch(e.target.value)} className="form-input pl-10" data-testid="search-clientes" />
      </div>

      <div className="dashboard-card overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
          <table className="data-table w-full min-w-[1600px]" data-testid="clientes-table">
            <thead className="sticky top-0 z-10">
              <tr className="bg-blue-950/80 backdrop-blur-sm border-b border-blue-800/50">
                <th className="text-blue-300 min-w-[180px]">Nome</th>
                <th className="text-blue-300 w-[40px]">Tipo</th>
                <th className="text-blue-300 min-w-[130px]">Documento</th>
                <th className="text-blue-300 min-w-[155px]">Telefone</th>
                <th className="text-blue-300 min-w-[155px]">Numero</th>
                <th className="text-blue-300 min-w-[200px]">ICCID</th>
                <th className="text-blue-300 min-w-[130px]">Plano</th>
                <th className="text-blue-300 min-w-[100px]">Dados</th>
                <th className="text-blue-300 w-[80px]">Status</th>
                <th className="text-blue-300 text-right w-[90px]">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {clientes.length === 0 ? (
                <tr><td colSpan={10} className="text-center text-zinc-500 py-8">Nenhum cliente encontrado</td></tr>
              ) : [...clientes].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR')).flatMap((c) => {
                const linhas = c.linhas || [];
                if (linhas.length === 0) {
                  return [(
                    <tr key={c.id} data-testid={`cliente-row-${c.id}`}>
                      <td className="font-medium text-white text-sm whitespace-nowrap">{c.nome}</td>
                      <td className="text-zinc-400 text-xs uppercase whitespace-nowrap">{c.tipo_pessoa === 'pj' ? 'PJ' : 'PF'}</td>
                      <td className="font-mono text-zinc-300 text-sm whitespace-nowrap">{c.documento}</td>
                      <td className="font-mono text-zinc-300 text-sm whitespace-nowrap">{c.telefone}</td>
                      <td className="text-xs text-zinc-500 whitespace-nowrap">-</td>
                      <td className="text-xs text-zinc-500 whitespace-nowrap">-</td>
                      <td className="text-xs text-zinc-500 whitespace-nowrap">-</td>
                      <td className="whitespace-nowrap">
                        {c.dados_completos ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-400 whitespace-nowrap"><CheckCircle className="w-3 h-3" />Completo</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-400 whitespace-nowrap"><AlertCircle className="w-3 h-3" />Incompleto</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap"><span className={`whitespace-nowrap ${c.status === 'ativo' ? 'badge-active' : 'badge-inactive'}`}>{c.status}</span></td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(c)} className="text-zinc-400 hover:text-white" data-testid={`edit-cliente-${c.id}`}><Edit className="w-4 h-4" /></Button>
                          {isAdmin && <Button variant="ghost" size="sm" onClick={() => { setClienteToDelete(c); setDeleteDialogOpen(true); }} className="text-zinc-400 hover:text-red-400" data-testid={`delete-cliente-${c.id}`}><Trash2 className="w-4 h-4" /></Button>}
                        </div>
                      </td>
                    </tr>
                  )];
                }
                return linhas.map((l, i) => (
                  <tr key={`${c.id}-${i}`} data-testid={`cliente-row-${c.id}-${i}`}>
                    <td className="font-medium text-white text-sm whitespace-nowrap">{c.nome}</td>
                    <td className="text-zinc-400 text-xs uppercase whitespace-nowrap">{c.tipo_pessoa === 'pj' ? 'PJ' : 'PF'}</td>
                    <td className="font-mono text-zinc-300 text-sm whitespace-nowrap">{c.documento}</td>
                    <td className="font-mono text-zinc-300 text-sm whitespace-nowrap">{c.telefone}</td>
                    <td className="font-mono text-zinc-300 text-sm whitespace-nowrap">{l.numero || '-'}</td>
                    <td className="font-mono text-zinc-400 text-xs whitespace-nowrap">{l.iccid || '-'}</td>
                    <td className="text-zinc-300 text-sm whitespace-nowrap">{l.plano_nome || '-'}</td>
                    <td className="whitespace-nowrap">
                      {c.dados_completos ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-400 whitespace-nowrap"><CheckCircle className="w-3 h-3" />Completo</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-400 whitespace-nowrap"><AlertCircle className="w-3 h-3" />Incompleto</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap"><span className={`whitespace-nowrap ${l.status === 'ativo' ? 'badge-active' : l.status === 'bloqueado' ? 'badge-blocked' : 'badge-inactive'}`}>{l.status}</span></td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(c)} className="text-zinc-400 hover:text-white" data-testid={`edit-cliente-${c.id}`}><Edit className="w-4 h-4" /></Button>
                        {isAdmin && <Button variant="ghost" size="sm" onClick={() => { setClienteToDelete(c); setDeleteDialogOpen(true); }} className="text-zinc-400 hover:text-red-400" data-testid={`delete-cliente-${c.id}`}><Trash2 className="w-4 h-4" /></Button>}
                      </div>
                    </td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">{editingCliente ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.preventDefault(); }} className="space-y-4">
            {/* Dados Pessoais */}
            <div className="border border-zinc-800 rounded-sm p-4 space-y-3">
              <h3 className="text-sm font-semibold text-zinc-300 mb-2">Dados Pessoais</h3>
              <div className={`grid gap-3 ${editingCliente ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-xs">Tipo de Pessoa</Label>
                  <Select value={formData.tipo_pessoa} onValueChange={(v) => f('tipo_pessoa', v)}>
                    <SelectTrigger className="form-input" data-testid="cliente-tipo-pessoa"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="pf">Pessoa Fisica (PF)</SelectItem>
                      <SelectItem value="pj">Pessoa Juridica (PJ)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editingCliente && (
                  <div className="space-y-1">
                    <Label className="text-zinc-400 text-xs">Status</Label>
                    <Select value={formData.status} onValueChange={(v) => f('status', v)}>
                      <SelectTrigger className="form-input" data-testid="cliente-status-select"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-zinc-400 text-xs">{formData.tipo_pessoa === 'pj' ? 'Razao Social' : 'Nome Completo'}</Label>
                <Input value={formData.nome} onChange={(e) => f('nome', e.target.value)} className="form-input" required data-testid="cliente-nome-input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-xs">{formData.tipo_pessoa === 'pj' ? 'CNPJ' : 'CPF'}</Label>
                  <Input value={formData.documento} onChange={(e) => f('documento', formatDoc(e.target.value, formData.tipo_pessoa))} className="form-input font-mono" placeholder={formData.tipo_pessoa === 'pj' ? '00.000.000/0000-00' : '000.000.000-00'} maxLength={formData.tipo_pessoa === 'pj' ? 18 : 14} required data-testid="cliente-documento-input" />
                </div>
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-xs">Telefone</Label>
                  <Input value={formData.telefone} onChange={(e) => f('telefone', formatPhone(e.target.value))} className="form-input font-mono" placeholder="(00) 00000-0000" maxLength={15} required data-testid="cliente-telefone-input" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-zinc-400 text-xs">Email</Label>
                <Input type="email" value={formData.email} onChange={(e) => f('email', e.target.value)} className="form-input" placeholder="cliente@email.com" data-testid="cliente-email-input" />
              </div>
              <div className="space-y-1">
                <Label className="text-zinc-400 text-xs">Data de Nascimento</Label>
                <Input type="date" value={formData.data_nascimento} onChange={(e) => f('data_nascimento', e.target.value)} className="form-input" data-testid="cliente-nascimento-input" />
              </div>
            </div>

            {/* Endereco */}
            <div className="border border-zinc-800 rounded-sm p-4 space-y-3">
              <h3 className="text-sm font-semibold text-zinc-300 mb-2">Endereco</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-xs">CEP</Label>
                  <Input value={formData.cep} onChange={(e) => handleCepLookup(e.target.value)} className="form-input font-mono" placeholder="00000000" maxLength={8} data-testid="cliente-cep-input" />
                </div>
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-xs">Numero</Label>
                  <Input value={formData.numero_endereco} onChange={(e) => f('numero_endereco', e.target.value)} className="form-input" placeholder="123" data-testid="cliente-numero-input" />
                </div>
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-xs">Estado</Label>
                  <Select value={formData.estado} onValueChange={(v) => f('estado', v)}>
                    <SelectTrigger className="form-input" data-testid="cliente-estado-select"><SelectValue placeholder="UF" /></SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 max-h-48">
                      {ESTADOS.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-zinc-400 text-xs">Endereco</Label>
                <Input value={formData.endereco} onChange={(e) => f('endereco', e.target.value)} className="form-input" placeholder="Rua, Avenida..." data-testid="cliente-endereco-input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-xs">Bairro</Label>
                  <Input value={formData.bairro} onChange={(e) => f('bairro', e.target.value)} className="form-input" data-testid="cliente-bairro-input" />
                </div>
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-xs">Cidade</Label>
                  <Input value={formData.cidade} onChange={(e) => f('cidade', e.target.value)} className="form-input" data-testid="cliente-cidade-input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-xs">Codigo da Cidade</Label>
                  <Input value={formData.city_code} onChange={(e) => f('city_code', e.target.value)} className="form-input font-mono" placeholder="3550308" data-testid="cliente-citycode-input" />
                </div>
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-xs">Complemento</Label>
                  <Input value={formData.complemento} onChange={(e) => f('complemento', e.target.value)} className="form-input" placeholder="Apto, Sala..." data-testid="cliente-complemento-input" />
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="btn-secondary w-full sm:w-auto">Cancelar</Button>
              <Button type="submit" disabled={submitting} className="btn-primary w-full sm:w-auto" data-testid="cliente-submit-button">{submitting ? 'Salvando...' : 'Salvar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader><DialogTitle className="text-white">Confirmar Exclusao</DialogTitle></DialogHeader>
          <p className="text-zinc-400">Tem certeza que deseja remover o cliente <span className="text-white font-medium">{clienteToDelete?.nome}</span>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="btn-secondary">Cancelar</Button>
            <Button onClick={handleDelete} className="btn-danger" data-testid="confirm-delete-button">Remover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Confirmation Dialog */}
      <ConfirmPasswordDialog
        open={confirmState.open}
        onClose={closeConfirm}
        onConfirmed={confirmState.onConfirmed}
        actionDescription={confirmState.description}
      />
    </div>
  );
}
