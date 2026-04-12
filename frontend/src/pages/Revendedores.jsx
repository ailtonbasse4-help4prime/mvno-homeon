import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { safeArray } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { QRCodeSVG } from 'qrcode.react';
import {
  Plus, Edit, Trash2, Search, Store, Package, CheckCircle, Link,
  QrCode, Printer,
} from 'lucide-react';
import { ConfirmPasswordDialog } from '../components/ConfirmPasswordDialog';
import { useSecureAction } from '../hooks/useSecureAction';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';
const SITE_URL = process.env.REACT_APP_SITE_URL || '';

function getSiteUrl() {
  if (SITE_URL) return SITE_URL;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

export function Revendedores() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [revendedores, setRevendedores] = useState([]);
  const [chipsDisponiveis, setChipsDisponiveis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [vincularDialogOpen, setVincularDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedRevId, setSelectedRevId] = useState(null);
  const [selectedRevName, setSelectedRevName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [chipSearch, setChipSearch] = useState('');
  const [selectedIccids, setSelectedIccids] = useState([]);
  const { executeSecureDelete, confirmState, closeConfirm } = useSecureAction();

  // QR Code state
  const [revChips, setRevChips] = useState([]);
  const [qrSelectedIccids, setQrSelectedIccids] = useState([]);
  const [qrChipSearch, setQrChipSearch] = useState('');
  const [showQrPrint, setShowQrPrint] = useState(false);

  const [form, setForm] = useState({
    nome: '', contato: '', telefone: '', desconto_valor: '', observacoes: '',
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [revRes, chipRes] = await Promise.all([
        axios.get(`${API_URL}/api/revendedores`, { withCredentials: true }),
        axios.get(`${API_URL}/api/chips`, { withCredentials: true }),
      ]);
      setRevendedores(safeArray(revRes.data));
      setChipsDisponiveis(safeArray(chipRes.data).filter(c => c.status === 'disponivel'));
    } catch (e) { toast.error('Erro ao carregar dados'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleOpenDialog = (rev = null) => {
    if (rev) {
      setEditingId(rev.id);
      setForm({
        nome: rev.nome, contato: rev.contato || '', telefone: rev.telefone || '',
        desconto_valor: rev.desconto_valor.toString(), observacoes: rev.observacoes || '',
      });
    } else {
      setEditingId(null);
      setForm({ nome: '', contato: '', telefone: '', desconto_valor: '', observacoes: '' });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nome) { toast.error('Nome obrigatorio'); return; }
    setSubmitting(true);
    try {
      const payload = { ...form, desconto_valor: parseFloat(form.desconto_valor) || 0 };
      if (editingId) {
        await axios.put(`${API_URL}/api/revendedores/${editingId}`, payload, { withCredentials: true });
        toast.success('Revendedor atualizado');
      } else {
        await axios.post(`${API_URL}/api/revendedores`, payload, { withCredentials: true });
        toast.success('Revendedor criado');
      }
      setDialogOpen(false);
      fetchAll();
    } catch (e) { toast.error(e.response?.data?.detail || 'Erro ao salvar'); }
    setSubmitting(false);
  };

  const handleDelete = async (id, nome) => {
    if (!window.confirm(`Remover revendedor ${nome}? Os chips serao desvinculados.`)) return;
    try {
      await executeSecureDelete(`/api/revendedores/${id}`, `Remover revendedor: ${nome}`);
      toast.success('Revendedor removido');
      fetchAll();
    } catch (e) { toast.error(e.response?.data?.detail || 'Erro ao remover'); }
  };

  const handleOpenVincular = (revId) => {
    setSelectedRevId(revId);
    setSelectedIccids([]);
    setChipSearch('');
    setVincularDialogOpen(true);
  };

  const handleVincular = async () => {
    if (!selectedIccids.length) { toast.error('Selecione ao menos um chip'); return; }
    setSubmitting(true);
    try {
      const res = await axios.post(`${API_URL}/api/revendedores/${selectedRevId}/vincular-chips`,
        { iccids: selectedIccids }, { withCredentials: true });
      toast.success(`${res.data.linked} chips vinculados`);
      setVincularDialogOpen(false);
      fetchAll();
    } catch (e) { toast.error('Erro ao vincular chips'); }
    setSubmitting(false);
  };

  const toggleIccid = (iccid) => {
    setSelectedIccids(prev =>
      prev.includes(iccid) ? prev.filter(i => i !== iccid) : [...prev, iccid]
    );
  };

  // =================== QR CODE ===================
  const handleOpenQrDialog = async (revId, revNome) => {
    setSelectedRevId(revId);
    setSelectedRevName(revNome);
    setQrSelectedIccids([]);
    setQrChipSearch('');
    setShowQrPrint(false);
    try {
      const res = await axios.get(`${API_URL}/api/revendedores/${revId}/chips`, { withCredentials: true });
      const chips = safeArray(res.data).filter(c => c.status === 'disponivel');
      setRevChips(chips);
      if (chips.length === 0) {
        toast.error('Nenhum chip disponivel vinculado a este revendedor');
        return;
      }
    } catch (e) {
      toast.error('Erro ao carregar chips');
      return;
    }
    setQrDialogOpen(true);
  };

  const toggleQrIccid = (iccid) => {
    setQrSelectedIccids(prev =>
      prev.includes(iccid) ? prev.filter(i => i !== iccid) : [...prev, iccid]
    );
  };

  const selectAllQrChips = () => {
    const filtered = revChips.filter(c => !qrChipSearch || c.iccid.includes(qrChipSearch));
    const allIccids = filtered.map(c => c.iccid);
    setQrSelectedIccids(prev =>
      prev.length === allIccids.length ? [] : allIccids
    );
  };

  const getChipUrl = (iccid) => `${getSiteUrl()}/ativar?iccid=${iccid}`;

  const handlePrintQrCodes = () => {
    if (!qrSelectedIccids.length) { toast.error('Selecione ao menos um chip'); return; }
    setShowQrPrint(true);
  };

  const handlePrintSingle = (iccid) => {
    setQrSelectedIccids([iccid]);
    setShowQrPrint(true);
    if (!qrDialogOpen) setQrDialogOpen(true);
  };

  const executePrint = () => {
    const printContent = document.getElementById('qr-print-area');
    if (!printContent) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html><head><title>Cartoes de Ativacao - ${selectedRevName}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; }
        @page { margin: 8mm; }
        .cards-container { display: flex; flex-direction: column; gap: 6mm; }
        .activation-card {
          width: 150mm; height: 50mm;
          border: 1.5px solid #1e3a5f;
          border-radius: 4mm;
          display: flex; flex-direction: row;
          overflow: hidden;
          page-break-inside: avoid;
          background: #fff;
        }
        .card-left {
          width: 48mm; min-width: 48mm;
          background: linear-gradient(135deg, #0f2942 0%, #1e3a5f 100%);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 3mm;
          color: white;
        }
        .card-left svg { background: white; padding: 3px; border-radius: 2mm; }
        .card-left .iccid-label { font-size: 5.5pt; font-family: monospace; margin-top: 2mm; word-break: break-all; text-align: center; line-height: 1.3; color: #a0c4e8; }
        .card-left .logo-text { font-size: 8pt; font-weight: bold; margin-bottom: 2mm; letter-spacing: 0.5px; }
        .card-right {
          flex: 1; padding: 3mm 4mm;
          display: flex; flex-direction: column;
          justify-content: center;
        }
        .card-right .title { font-size: 9pt; font-weight: bold; color: #1e3a5f; margin-bottom: 1.5mm; text-transform: uppercase; letter-spacing: 0.3px; }
        .steps { list-style: none; padding: 0; margin: 0; }
        .steps li { font-size: 6.5pt; color: #333; padding: 0.4mm 0; display: flex; align-items: flex-start; gap: 1.5mm; line-height: 1.4; }
        .step-num { background: #1e3a5f; color: white; border-radius: 50%; width: 10px; height: 10px; min-width: 10px; display: flex; align-items: center; justify-content: center; font-size: 5pt; font-weight: bold; margin-top: 0.5px; }
        .card-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 1.5mm; padding-top: 1.5mm; border-top: 0.5px dashed #ccc; }
        .card-footer .help { font-size: 5.5pt; color: #666; }
        .card-footer .portal { font-size: 5pt; color: #999; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style></head><body>
      ${printContent.innerHTML}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); };
  };

  const filtered = revendedores.filter(r =>
    !search || r.nome.toLowerCase().includes(search.toLowerCase()) ||
    (r.contato || '').toLowerCase().includes(search.toLowerCase())
  );

  const filteredChips = chipsDisponiveis.filter(c =>
    !chipSearch || c.iccid.includes(chipSearch)
  );

  const filteredQrChips = revChips.filter(c =>
    !qrChipSearch || c.iccid.includes(qrChipSearch)
  );

  return (
    <div className="space-y-6" data-testid="revendedores-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Revendedores</h1>
          <p className="text-sm text-zinc-400 mt-1">{revendedores.length} revendedores cadastrados</p>
        </div>
        {isAdmin && (
          <Button onClick={() => handleOpenDialog()} className="btn-primary flex items-center gap-2 w-full sm:w-auto" data-testid="novo-revendedor-btn">
            <Plus className="w-4 h-4" />Novo Revendedor
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 w-4 h-4" />
        <Input placeholder="Buscar revendedor..." value={search} onChange={e => setSearch(e.target.value)}
          className="pl-10 bg-zinc-900 border-zinc-700" data-testid="search-revendedores" />
      </div>

      {loading ? (
        <p className="text-center text-zinc-500 py-8">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-zinc-500 py-8">Nenhum revendedor cadastrado</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(r => (
            <Card key={r.id} className="bg-zinc-900 border-zinc-500/60" data-testid={`revendedor-card-${r.id}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Store className="w-5 h-5 text-blue-400" />
                    <h3 className="font-semibold text-lg">{r.nome}</h3>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button onClick={() => handleOpenDialog(r)} className="p-1.5 hover:bg-zinc-800 rounded">
                        <Edit className="w-4 h-4 text-zinc-400" />
                      </button>
                      <button onClick={() => handleDelete(r.id, r.nome)} className="p-1.5 hover:bg-zinc-800 rounded">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  )}
                </div>

                {r.contato && <p className="text-sm text-zinc-400 mb-1">Contato: {r.contato}</p>}
                {r.telefone && <p className="text-sm text-zinc-400 mb-1">Tel: {r.telefone}</p>}

                <div className="mt-3 p-3 bg-zinc-800/50 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-zinc-400">Desconto na ativacao:</span>
                    <span className="font-bold text-emerald-400">R$ {r.desconto_valor.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-zinc-400 flex items-center gap-1"><Package className="w-3.5 h-3.5" /> Chips vinculados:</span>
                    <span className="font-medium">{r.total_chips}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-400 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Ativados:</span>
                    <span className="font-medium text-emerald-400">{r.chips_ativados}</span>
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex gap-2 mt-3">
                    <Button onClick={() => handleOpenVincular(r.id)} variant="outline" size="sm"
                      className="flex-1 border-zinc-700 hover:bg-zinc-800 flex items-center justify-center gap-2" data-testid={`vincular-btn-${r.id}`}>
                      <Link className="w-4 h-4" />Vincular
                    </Button>
                    <Button onClick={() => handleOpenQrDialog(r.id, r.nome)} variant="outline" size="sm"
                      className="flex-1 border-zinc-700 hover:bg-zinc-800 flex items-center justify-center gap-2 text-blue-400 hover:text-blue-300"
                      disabled={r.total_chips === 0}
                      data-testid={`qrcode-btn-${r.id}`}>
                      <QrCode className="w-4 h-4" />QR Codes
                    </Button>
                  </div>
                )}

                {r.observacoes && <p className="text-xs text-zinc-500 mt-2">{r.observacoes}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog Novo/Editar Revendedor */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Revendedor' : 'Novo Revendedor'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="revendedor-form">
            <div>
              <label className="text-sm text-zinc-400">Nome *</label>
              <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })}
                className="bg-zinc-900 border-zinc-700 mt-1" placeholder="Ex: Padaria do Ze" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-zinc-400">Contato</label>
                <Input value={form.contato} onChange={e => setForm({ ...form, contato: e.target.value })}
                  className="bg-zinc-900 border-zinc-700 mt-1" placeholder="Nome contato" />
              </div>
              <div>
                <label className="text-sm text-zinc-400">Telefone</label>
                <Input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })}
                  className="bg-zinc-900 border-zinc-700 mt-1" placeholder="(11) 99999-9999" />
              </div>
            </div>
            <div>
              <label className="text-sm text-zinc-400">Desconto na Ativacao (R$)</label>
              <Input type="number" step="0.01" value={form.desconto_valor} onChange={e => setForm({ ...form, desconto_valor: e.target.value })}
                className="bg-zinc-900 border-zinc-700 mt-1" placeholder="10.00" />
              <p className="text-xs text-zinc-500 mt-1">Desconto aplicado automaticamente na primeira mensalidade do cliente</p>
            </div>
            <div>
              <label className="text-sm text-zinc-400">Observacoes</label>
              <Input value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })}
                className="bg-zinc-900 border-zinc-700 mt-1" placeholder="Observacoes..." />
            </div>
            <Button type="submit" disabled={submitting} className="w-full btn-primary">
              {submitting ? 'Salvando...' : editingId ? 'Salvar' : 'Criar Revendedor'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Vincular Chips */}
      <Dialog open={vincularDialogOpen} onOpenChange={setVincularDialogOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vincular Chips ao Revendedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 w-4 h-4" />
              <Input placeholder="Buscar ICCID..." value={chipSearch} onChange={e => setChipSearch(e.target.value)}
                className="pl-10 bg-zinc-900 border-zinc-700" />
            </div>
            <p className="text-sm text-zinc-400">{selectedIccids.length} selecionados de {filteredChips.length} disponiveis</p>
            <div className="max-h-64 overflow-y-auto border border-zinc-800 rounded-md p-2 space-y-1">
              {filteredChips.slice(0, 100).map(c => (
                <label key={c.iccid} className="flex items-center gap-2 p-1.5 hover:bg-zinc-900 rounded cursor-pointer text-sm font-mono">
                  <input type="checkbox" checked={selectedIccids.includes(c.iccid)}
                    onChange={() => toggleIccid(c.iccid)} className="rounded" />
                  {c.iccid}
                </label>
              ))}
              {filteredChips.length > 100 && <p className="text-xs text-zinc-500 text-center py-2">Mostrando 100 de {filteredChips.length}. Use a busca para filtrar.</p>}
            </div>
            <Button onClick={handleVincular} disabled={submitting || !selectedIccids.length} className="w-full btn-primary">
              {submitting ? 'Vinculando...' : `Vincular ${selectedIccids.length} Chips`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog QR Codes */}
      <Dialog open={qrDialogOpen} onOpenChange={(open) => { setQrDialogOpen(open); if (!open) setShowQrPrint(false); }}>
        <DialogContent className="bg-zinc-950 border-zinc-800 max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-blue-400" />
              QR Codes - {selectedRevName}
            </DialogTitle>
          </DialogHeader>

          {!showQrPrint ? (
            <div className="space-y-4">
              <p className="text-sm text-zinc-400">
                Selecione os chips para gerar QR Codes de ativacao. O cliente escaneia e ativa direto pelo celular.
              </p>

              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 w-4 h-4" />
                  <Input placeholder="Buscar ICCID..." value={qrChipSearch} onChange={e => setQrChipSearch(e.target.value)}
                    className="pl-10 bg-zinc-900 border-zinc-700" data-testid="qr-chip-search" />
                </div>
                <Button onClick={selectAllQrChips} variant="outline" size="sm" className="border-zinc-700 text-xs shrink-0" data-testid="select-all-qr">
                  {qrSelectedIccids.length === filteredQrChips.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                </Button>
              </div>

              <p className="text-sm text-zinc-400">
                {qrSelectedIccids.length} selecionados de {revChips.length} chips disponiveis
              </p>

              <div className="max-h-64 overflow-y-auto border border-zinc-800 rounded-md p-2 space-y-1">
                {filteredQrChips.map(c => (
                  <label key={c.iccid} className="flex items-center justify-between gap-2 p-2 hover:bg-zinc-900 rounded cursor-pointer">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={qrSelectedIccids.includes(c.iccid)}
                        onChange={() => toggleQrIccid(c.iccid)} className="rounded" />
                      <span className="text-sm font-mono text-zinc-300">{c.iccid}</span>
                    </div>
                    <button onClick={(e) => { e.preventDefault(); handlePrintSingle(c.iccid); }}
                      className="p-1 text-zinc-500 hover:text-blue-400 transition-colors" title="Gerar QR individual">
                      <QrCode className="w-4 h-4" />
                    </button>
                  </label>
                ))}
                {revChips.length === 0 && (
                  <p className="text-zinc-500 text-sm text-center py-4">Nenhum chip disponivel vinculado</p>
                )}
              </div>

              <Button onClick={handlePrintQrCodes} disabled={!qrSelectedIccids.length}
                className="w-full btn-primary flex items-center justify-center gap-2" data-testid="generate-qr-btn">
                <QrCode className="w-4 h-4" />
                Gerar {qrSelectedIccids.length} QR Code{qrSelectedIccids.length !== 1 ? 's' : ''}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button onClick={() => setShowQrPrint(false)} variant="outline" size="sm" className="border-zinc-700 text-zinc-400">
                  Voltar
                </Button>
                <Button onClick={executePrint} className="btn-primary flex items-center gap-2" data-testid="print-qr-btn">
                  <Printer className="w-4 h-4" /> Imprimir {qrSelectedIccids.length} Cartao{qrSelectedIccids.length !== 1 ? 'es' : ''}
                </Button>
              </div>

              {/* Preview */}
              <div className="border border-zinc-500/60 rounded-lg p-4 bg-white overflow-auto max-h-[500px]">
                <div id="qr-print-area">
                  <div className="cards-container" style={{ display: 'flex', flexDirection: 'column', gap: '6mm' }}>
                    {qrSelectedIccids.map(iccid => (
                      <div key={iccid} className="activation-card" style={{
                        width: '150mm', height: '50mm', border: '1.5px solid #1e3a5f',
                        borderRadius: '4mm', display: 'flex', flexDirection: 'row',
                        overflow: 'hidden', pageBreakInside: 'avoid', background: '#fff',
                      }}>
                        {/* Left side - QR + Logo */}
                        <div style={{
                          width: '48mm', minWidth: '48mm',
                          background: 'linear-gradient(135deg, #0f2942 0%, #1e3a5f 100%)',
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center',
                          padding: '3mm', color: 'white',
                        }}>
                          <div style={{ fontSize: '8pt', fontWeight: 'bold', marginBottom: '2mm', letterSpacing: '0.5px' }}>
                            HomeOn Internet
                          </div>
                          <div style={{ background: 'white', padding: '3px', borderRadius: '2mm' }}>
                            <QRCodeSVG value={getChipUrl(iccid)} size={90} level="M" />
                          </div>
                          <div style={{
                            fontFamily: 'monospace', fontSize: '5.5pt', marginTop: '2mm',
                            wordBreak: 'break-all', textAlign: 'center', lineHeight: '1.3', color: '#a0c4e8',
                          }}>
                            {iccid}
                          </div>
                        </div>

                        {/* Right side - Steps */}
                        <div style={{
                          flex: 1, padding: '3mm 4mm',
                          display: 'flex', flexDirection: 'column', justifyContent: 'center',
                        }}>
                          <div style={{ fontSize: '9pt', fontWeight: 'bold', color: '#1e3a5f', marginBottom: '1.5mm', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                            Ativacao do Chip
                          </div>
                          <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {[
                              'Escaneie o QR Code ao lado',
                              'Preencha seus dados',
                              'Verifique se seus dados estao corretos',
                              'Clique em Ativar',
                              'Insira o chip no celular',
                              'Pronto! Seu chip esta ativado',
                            ].map((step, i) => (
                              <li key={i} style={{
                                fontSize: '6.5pt', color: '#333', padding: '0.4mm 0',
                                display: 'flex', alignItems: 'flex-start', gap: '1.5mm', lineHeight: '1.4',
                              }}>
                                <span style={{
                                  background: '#1e3a5f', color: 'white', borderRadius: '50%',
                                  width: '10px', height: '10px', minWidth: '10px',
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '5pt', fontWeight: 'bold', marginTop: '0.5px',
                                }}>{i + 1}</span>
                                {step}
                              </li>
                            ))}
                          </ol>
                          <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            marginTop: '1.5mm', paddingTop: '1.5mm', borderTop: '0.5px dashed #ccc',
                          }}>
                            <span style={{ fontSize: '5.5pt', color: '#666' }}>
                              Ajuda: (19) 92005-1397
                            </span>
                            <span style={{ fontSize: '5pt', color: '#999' }}>
                              Meu plano: {getSiteUrl()}/portal
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <p className="text-xs text-zinc-400 text-center">
                Cada cartao mede 15x5cm. Cabem 5 por folha A4. Use papel adesivo ou cartolina.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
          <ConfirmPasswordDialog open={confirmState.open} onClose={closeConfirm} onConfirmed={confirmState.onConfirmed} actionDescription={confirmState.description} />
    </div>
  );
}
