import { useState, useEffect, useCallback } from 'react';
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel,
} from '../components/ui/select';
import { toast } from 'sonner';
import { Plus, CreditCard, Trash2, Filter, Tag, RefreshCw, Edit, Smartphone, Radio, ArrowRightLeft, RotateCcw } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

function OfertaGroupedSelect({ value, onValueChange, ofertas, testId }) {
  const movelOfertas = ofertas.filter(o => o.categoria === 'movel');
  const m2mOfertas = ofertas.filter(o => o.categoria === 'm2m');
  const outrasOfertas = ofertas.filter(o => !o.categoria || (o.categoria !== 'movel' && o.categoria !== 'm2m'));

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="form-input" data-testid={testId}>
        <SelectValue placeholder="Selecione uma oferta" />
      </SelectTrigger>
      <SelectContent className="bg-zinc-900 border-zinc-800 max-h-60">
        {ofertas.length === 0 ? (
          <SelectItem value="__none__" disabled>Nenhuma oferta ativa</SelectItem>
        ) : (
          <>
            {movelOfertas.length > 0 && (
              <SelectGroup>
                <SelectLabel className="flex items-center gap-1.5 text-blue-400 text-xs px-2 py-1.5">
                  <Smartphone className="w-3 h-3" />Movel
                </SelectLabel>
                {movelOfertas.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.nome} - R$ {o.valor.toFixed(2)} ({o.franquia || '-'})
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
            {m2mOfertas.length > 0 && (
              <SelectGroup>
                <SelectLabel className="flex items-center gap-1.5 text-violet-400 text-xs px-2 py-1.5">
                  <Radio className="w-3 h-3" />M2M
                </SelectLabel>
                {m2mOfertas.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.nome} - R$ {o.valor.toFixed(2)} ({o.franquia || '-'})
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
            {outrasOfertas.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-zinc-400 text-xs px-2 py-1.5">Outras</SelectLabel>
                {outrasOfertas.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.nome} - R$ {o.valor.toFixed(2)} ({o.franquia || '-'})
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </>
        )}
      </SelectContent>
    </Select>
  );
}

export function Chips() {
  const { isAdmin } = useAuth();
  const [chips, setChips] = useState([]);
  const [ofertas, setOfertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [chipToDelete, setChipToDelete] = useState(null);
  const [chipToEdit, setChipToEdit] = useState(null);
  const [formData, setFormData] = useState({ iccid: '', oferta_id: '' });
  const [editFormData, setEditFormData] = useState({ oferta_id: '' });
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const r = await axios.post(`${API_URL}/api/operadora/sincronizar-estoque`, {}, { withCredentials: true });
      toast.success(r.data.message);
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao sincronizar estoque');
    } finally { setSyncing(false); }
  };

  const fetchData = useCallback(async () => {
    try {
      const params = statusFilter && statusFilter !== 'all' ? { status: statusFilter } : {};
      const [chipsRes, ofertasRes] = await Promise.all([
        axios.get(`${API_URL}/api/chips`, { params, withCredentials: true }),
        axios.get(`${API_URL}/api/ofertas?ativo=true`, { withCredentials: true }),
      ]);
      setChips(safeArray(chipsRes.data));
      setOfertas(safeArray(ofertasRes.data));
    } catch (error) {
      toast.error('Erro ao carregar dados');
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/api/chips`, { iccid: formData.iccid, oferta_id: formData.oferta_id }, { withCredentials: true });
      toast.success('Chip cadastrado com sucesso');
      setDialogOpen(false);
      setFormData({ iccid: '', oferta_id: '' });
      fetchData();
    } catch (error) {
      const msg = error.response?.data?.detail || 'Erro ao cadastrar chip';
      toast.error(typeof msg === 'string' ? msg : 'Erro ao cadastrar chip');
    } finally { setSubmitting(false); }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!chipToEdit) return;
    setSubmitting(true);
    try {
      await axios.put(`${API_URL}/api/chips/${chipToEdit.id}`, { oferta_id: editFormData.oferta_id }, { withCredentials: true });
      toast.success('Oferta do chip atualizada');
      setEditDialogOpen(false);
      setChipToEdit(null);
      fetchData();
    } catch (error) {
      const msg = error.response?.data?.detail || 'Erro ao atualizar chip';
      toast.error(typeof msg === 'string' ? msg : 'Erro ao atualizar chip');
    } finally { setSubmitting(false); }
  };

  const openEditDialog = (chip) => {
    setChipToEdit(chip);
    setEditFormData({ oferta_id: chip.oferta_id || '' });
    setEditDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!chipToDelete) return;
    try {
      await axios.delete(`${API_URL}/api/chips/${chipToDelete.id}`, { withCredentials: true });
      toast.success('Chip removido com sucesso');
      setDeleteDialogOpen(false);
      setChipToDelete(null);
      fetchData();
    } catch (error) {
      const msg = error.response?.data?.detail || 'Erro ao remover chip';
      toast.error(typeof msg === 'string' ? msg : 'Erro ao remover chip');
    }
  };

  const [checkingPort, setCheckingPort] = useState(null);
  const [resettingChip, setResettingChip] = useState(null);

  const handleVerificarPortabilidade = async (chip) => {
    setCheckingPort(chip.iccid);
    try {
      const res = await axios.post(`${API_URL}/api/chips/${chip.iccid}/verificar-portabilidade`, {}, { withCredentials: true });
      const d = res.data;
      if (d.atualizado) {
        toast.success(`Chip atualizado: ${d.chip_status_anterior} → ${d.chip_status_novo}${d.operadora_msisdn ? ' | MSISDN: ' + d.operadora_msisdn : ''}`);
      } else {
        toast.info(`Portabilidade: ${d.portabilidade_status || 'Sem info'}${d.portabilidade_janela ? ' | Janela: ' + d.portabilidade_janela : ''}${d.portabilidade_msg ? ' | ' + d.portabilidade_msg : ''}`);
      }
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao verificar portabilidade');
    }
    setCheckingPort(null);
  };

  const handleResetarChip = async (chip) => {
    if (!window.confirm(`Resetar chip ${chip.iccid} para Disponivel?\n\nIsso vai:\n- Remover vinculo com cliente\n- Cancelar ativacoes pendentes\n- Permitir nova ativacao\n\nContinuar?`)) return;
    setResettingChip(chip.iccid);
    try {
      const res = await axios.post(`${API_URL}/api/chips/${chip.iccid}/resetar`, {}, { withCredentials: true });
      toast.success(res.data.message);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao resetar chip');
    }
    setResettingChip(null);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'disponivel':
        return <span className="badge-available">Disponivel</span>;
      case 'ativado':
        return <span className="badge-active">Ativado</span>;
      case 'bloqueado':
        return <span className="badge-blocked">Bloqueado</span>;
      case 'cancelado':
        return <span className="badge-inactive">Cancelado</span>;
      case 'reservado':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-sm text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">Reservado</span>;
      default:
        return <span className="badge-inactive">{status}</span>;
    }
  };

  const getCategoriaBadge = (categoria) => {
    if (categoria === 'm2m') {
      return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20"><Radio className="w-3 h-3" />M2M</span>;
    }
    if (categoria === 'movel') {
      return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20"><Smartphone className="w-3 h-3" />Movel</span>;
    }
    return null;
  };

  const canEdit = (chip) => chip.status === 'disponivel' || chip.status === 'reservado';

  const formatCurrency = (value) => {
    if (value == null) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6" data-testid="chips-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <CreditCard className="w-7 h-7 text-emerald-500" />Chips (SIM Cards)
          </h1>
          <p className="text-zinc-400 text-sm -mt-4">Gerenciamento de chips vinculados a ofertas</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <Button onClick={handleSync} variant="outline" className="btn-secondary flex items-center gap-2 flex-1 sm:flex-initial" disabled={syncing} data-testid="sync-estoque-button">
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{syncing ? 'Sincronizando...' : 'Sincronizar Estoque'}</span>
              <span className="sm:hidden">{syncing ? 'Sync...' : 'Sync'}</span>
            </Button>
          )}
          {isAdmin && (
            <Button onClick={() => { setFormData({ iccid: '', oferta_id: '' }); setDialogOpen(true); }} className="btn-primary flex items-center gap-2 flex-1 sm:flex-initial" data-testid="add-chip-button">
              <Plus className="w-4 h-4" />Novo Chip
            </Button>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
          <Input
            type="text"
            placeholder="Buscar por ICCID, MSISDN ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input max-w-sm"
            data-testid="chip-search-input"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-500" />
          <span className="text-sm text-zinc-300">Status:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 form-input" data-testid="chip-status-filter">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800">
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="disponivel">Disponivel</SelectItem>
              <SelectItem value="ativado">Ativado</SelectItem>
              <SelectItem value="bloqueado">Bloqueado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      {(() => {
        const term = searchTerm.trim().toLowerCase();
        const filteredChips = term
          ? chips.filter(c =>
              (c.iccid && c.iccid.toLowerCase().includes(term)) ||
              (c.msisdn && c.msisdn.toLowerCase().includes(term)) ||
              (c.cliente_nome && c.cliente_nome.toLowerCase().includes(term))
            )
          : chips;

        return (
      <div className="dashboard-card overflow-hidden">
        {term && (
          <div className="px-4 py-2 border-b border-zinc-800 text-xs text-zinc-400">
            {filteredChips.length} resultado{filteredChips.length !== 1 ? 's' : ''} para "{searchTerm}"
          </div>
        )}
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)]">
          <table className="data-table w-full min-w-[1400px]" data-testid="chips-table">
            <thead className="sticky top-0 z-10">
              <tr className="bg-blue-950/80 backdrop-blur-sm border-b border-blue-800/50">
                <th className="text-blue-300 min-w-[200px]">ICCID</th>
                <th className="text-blue-300 min-w-[120px]">MSISDN</th>
                <th className="text-blue-300 w-[90px]">Status</th>
                <th className="text-blue-300 min-w-[100px]">Oferta</th>
                <th className="text-blue-300 w-[90px]">Categoria</th>
                <th className="text-blue-300 min-w-[180px]">Plano / Franquia</th>
                <th className="text-blue-300 w-[80px]">Valor</th>
                <th className="text-blue-300 min-w-[130px]">Cliente</th>
                <th className="text-blue-300 w-[90px]">Data</th>
                {isAdmin && <th className="text-blue-300 text-right min-w-[120px]">Acoes</th>}
              </tr>
            </thead>
            <tbody>
              {filteredChips.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 10 : 9} className="text-center text-zinc-500 py-8">
                    {term ? 'Nenhum chip encontrado para esta busca' : 'Nenhum chip encontrado'}
                  </td>
                </tr>
              ) : (
                filteredChips.map((chip) => (
                  <tr key={chip.id} data-testid={`chip-row-${chip.id}`}>
                    <td className="font-mono text-white text-xs sm:text-sm whitespace-nowrap">{chip.iccid}</td>
                    <td className="font-mono text-zinc-400 text-sm whitespace-nowrap">{chip.msisdn || '-'}</td>
                    <td className="whitespace-nowrap">{getStatusBadge(chip.status)}</td>
                    <td className="text-zinc-300 text-sm whitespace-nowrap">{chip.oferta_nome || <span className="text-amber-400 italic">Sem oferta</span>}</td>
                    <td className="whitespace-nowrap">{getCategoriaBadge(chip.categoria)}</td>
                    <td className="text-zinc-400 text-sm whitespace-nowrap">
                      {chip.plano_nome ? `${chip.plano_nome} (${chip.franquia})` : '-'}
                    </td>
                    <td className="text-emerald-400 font-mono text-sm whitespace-nowrap">{formatCurrency(chip.valor)}</td>
                    <td className="text-zinc-400 whitespace-nowrap">{chip.cliente_nome || '-'}</td>
                    <td className="text-zinc-400 text-sm whitespace-nowrap">{new Date(chip.created_at).toLocaleDateString('pt-BR')}</td>
                    {isAdmin && (
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit(chip) && (
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => openEditDialog(chip)}
                              className="text-zinc-400 hover:text-blue-400"
                              data-testid={`edit-chip-${chip.id}`}
                              title="Vincular/Alterar oferta"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
                          {chip.status !== 'ativado' && (
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => { setChipToDelete(chip); setDeleteDialogOpen(true); }}
                              className="text-zinc-400 hover:text-red-400"
                              data-testid={`delete-chip-${chip.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                          {chip.status === 'reservado' && (
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => handleVerificarPortabilidade(chip)}
                              disabled={checkingPort === chip.iccid}
                              className="text-amber-400 hover:text-amber-300"
                              data-testid={`check-port-${chip.id}`}
                              title="Verificar portabilidade na operadora"
                            >
                              <ArrowRightLeft className={`w-4 h-4 ${checkingPort === chip.iccid ? 'animate-spin' : ''}`} />
                            </Button>
                          )}
                          {chip.status === 'reservado' && (
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => handleResetarChip(chip)}
                              disabled={resettingChip === chip.iccid}
                              className="text-red-400 hover:text-red-300"
                              data-testid={`reset-chip-${chip.id}`}
                              title="Resetar chip para Disponivel (permite nova ativacao)"
                            >
                              <RotateCcw className={`w-4 h-4 ${resettingChip === chip.iccid ? 'animate-spin' : ''}`} />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
        );
      })()}

      {/* Add Chip Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Novo Chip</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="iccid" className="text-zinc-300">ICCID</Label>
              <Input
                id="iccid"
                value={formData.iccid}
                onChange={(e) => setFormData({ ...formData, iccid: e.target.value.replace(/\D/g, '') })}
                className="form-input font-mono"
                placeholder="Ex: 8955010012345678901"
                maxLength={20}
                required
                data-testid="chip-iccid-input"
              />
              <p className="text-xs text-zinc-500">Numero de identificacao unico do chip (19-20 digitos)</p>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 flex items-center gap-2">
                <Tag className="w-4 h-4 text-zinc-500" />Oferta Vinculada
              </Label>
              <OfertaGroupedSelect
                value={formData.oferta_id}
                onValueChange={(val) => setFormData({ ...formData, oferta_id: val })}
                ofertas={ofertas}
                testId="chip-oferta-select"
              />
              <p className="text-xs text-zinc-500">Cada chip deve estar vinculado a uma oferta comercial</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setFormData({ iccid: '', oferta_id: '' }); }} className="btn-secondary">Cancelar</Button>
              <Button type="submit" disabled={submitting || !formData.oferta_id} className="btn-primary" data-testid="chip-submit-button">
                {submitting ? 'Cadastrando...' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Chip Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Vincular Oferta ao Chip</DialogTitle>
          </DialogHeader>
          {chipToEdit && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="p-3 bg-zinc-800/50 rounded-sm border border-zinc-700 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">ICCID:</span>
                  <span className="font-mono text-white text-sm" data-testid="edit-chip-iccid">{chipToEdit.iccid}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">Status:</span>
                  {getStatusBadge(chipToEdit.status)}
                </div>
                {chipToEdit.oferta_nome && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">Oferta atual:</span>
                    <span className="text-sm text-zinc-300">{chipToEdit.oferta_nome}</span>
                    {getCategoriaBadge(chipToEdit.categoria)}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-zinc-500" />Nova Oferta
                </Label>
                <OfertaGroupedSelect
                  value={editFormData.oferta_id}
                  onValueChange={(val) => setEditFormData({ oferta_id: val })}
                  ofertas={ofertas}
                  testId="edit-chip-oferta-select"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)} className="btn-secondary">Cancelar</Button>
                <Button type="submit" disabled={submitting || !editFormData.oferta_id} className="btn-primary" data-testid="edit-chip-submit-button">
                  {submitting ? 'Salvando...' : 'Salvar'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Confirmar Exclusao</DialogTitle>
          </DialogHeader>
          <p className="text-zinc-400">
            Tem certeza que deseja remover o chip <span className="text-white font-mono">{chipToDelete?.iccid}</span>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="btn-secondary">Cancelar</Button>
            <Button onClick={handleDelete} className="btn-danger" data-testid="confirm-delete-chip">Remover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
