import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  QrCode, Package, Printer, RotateCcw, CheckCircle2, Clock, AlertTriangle, Plus, Search, Ruler,
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import { StatCard } from '../components/StatCard';
import { formatDateTimeBR } from '../lib/dateFormat';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const statusBadge = (s) => {
  const map = {
    pendente: { text: 'Pendente', bg: 'bg-amber-500/15', border: 'border-amber-500/40', color: 'text-amber-400', icon: Clock },
    impresso: { text: 'Impresso', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', color: 'text-emerald-400', icon: CheckCircle2 },
    parcialmente_reimpresso: { text: 'Parcialmente reimpresso', bg: 'bg-orange-500/15', border: 'border-orange-500/40', color: 'text-orange-400', icon: AlertTriangle },
  };
  const cfg = map[s] || map.pendente;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${cfg.bg} ${cfg.border} ${cfg.color} border`}>
      <Icon className="w-3 h-3" /> {cfg.text}
    </span>
  );
};

const downloadPDF = (url, filename) => {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'lote.pdf';
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  a.remove();
};

export default function QrLotes() {
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [creating, setCreating] = useState(false);
  const [filtro, setFiltro] = useState({ status: 'disponivel', apenas_sem_lote: true, limite: 40 });
  const [detailsLote, setDetailsLote] = useState(null);

  const loadLotes = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/qr-lotes?limit=100`, { withCredentials: true });
      setLotes(res.data.lotes || []);
      setTotal(res.data.total || 0);
    } catch (e) {
      toast.error('Falha ao carregar lotes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLotes(); }, []);

  const openCreate = () => {
    setPreviewData(null);
    setFiltro({ status: 'disponivel', apenas_sem_lote: true, limite: 40 });
    setDialogOpen(true);
  };

  const runPreview = async () => {
    try {
      const res = await axios.post(`${API_URL}/api/qr-lotes/preview`, filtro, { withCredentials: true });
      setPreviewData(res.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro no preview');
    }
  };

  const criarLote = async () => {
    if (!previewData || previewData.limite_aplicado === 0) {
      toast.error('Nenhum chip corresponde ao filtro');
      return;
    }
    setCreating(true);
    try {
      const res = await axios.post(`${API_URL}/api/qr-lotes`, filtro, { withCredentials: true });
      toast.success(`Lote ${res.data.numero} criado com ${res.data.quantidade} chips`);
      setDialogOpen(false);
      loadLotes();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao criar lote');
    } finally {
      setCreating(false);
    }
  };

  const baixarPdf = async (lote, formato) => {
    const url = `${API_URL}/api/qr-lotes/${lote._id}/pdf?formato=${formato}&marcar_impresso=true`;
    downloadPDF(url, `lote_${lote.numero}_${formato}.pdf`);
    toast.success('PDF gerado — verifique seus downloads');
    setTimeout(loadLotes, 1500);
  };

  const baixarCalibracao = (formato) => {
    downloadPDF(`${API_URL}/api/qr-lotes/calibracao/pdf?formato=${formato}`, `calibracao_${formato}.pdf`);
  };

  const marcarImpresso = async (lote) => {
    try {
      await axios.post(`${API_URL}/api/qr-lotes/${lote._id}/marcar-impresso`, {}, { withCredentials: true });
      toast.success('Lote marcado como impresso');
      loadLotes();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro');
    }
  };

  const reimprimir = async (lote, iccid) => {
    const url = `${API_URL}/api/qr-lotes/${lote._id}/reimprimir/${iccid}`;
    try {
      const res = await fetch(url, { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error('Falha');
      const blob = await res.blob();
      const objurl = URL.createObjectURL(blob);
      downloadPDF(objurl, `reimpressao_${lote.numero}_${iccid}.pdf`);
      toast.success('Reimpressão gerada');
      setTimeout(loadLotes, 1000);
    } catch (e) {
      toast.error('Erro ao reimprimir');
    }
  };

  const pendentes = lotes.filter(l => l.status === 'pendente').length;
  const impressos = lotes.filter(l => l.status === 'impresso').length;
  const totalChips = lotes.reduce((acc, l) => acc + (l.quantidade || 0), 0);

  return (
    <div className="space-y-6" data-testid="qr-lotes-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <QrCode className="w-6 h-6 text-blue-400" /> Lotes de QR Code
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Gere etiquetas QR para os chips físicos e organize por lote impresso.</p>
        </div>
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 gap-2" data-testid="qr-lotes-novo-btn">
          <Plus className="w-4 h-4" /> Novo Lote
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Lotes cadastrados" value={total} icon={Package} testId="stat-lotes-total" />
        <StatCard label="Pendentes de impressão" value={pendentes} icon={Clock} color="amber" testId="stat-lotes-pendentes" />
        <StatCard label="Impressos" value={impressos} icon={CheckCircle2} color="emerald" testId="stat-lotes-impressos" />
        <StatCard label="Chips em lotes" value={totalChips} icon={QrCode} testId="stat-chips-em-lotes" />
      </div>

      {/* Calibração */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                <Ruler className="w-4 h-4 text-blue-400" /> Calibração da impressora
              </h3>
              <p className="text-zinc-400 text-xs mt-1">
                Antes de imprimir um lote pela primeira vez, baixe a folha de calibração, imprima em <strong>Tamanho real 100%</strong> e verifique o alinhamento com as etiquetas.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => baixarCalibracao('pimaco_6081')} data-testid="calib-pimaco-btn">
                Calibração Pimaco 6081
              </Button>
              <Button variant="outline" size="sm" onClick={() => baixarCalibracao('a4_grid')} data-testid="calib-a4grid-btn">
                Calibração A4 Grid
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-0">
          {loading && (
            <div className="p-6 text-center text-zinc-400 text-sm">Carregando…</div>
          )}
          {!loading && lotes.length === 0 && (
            <div className="p-8 text-center text-zinc-400 text-sm">
              Nenhum lote criado ainda. Clique em <strong>Novo Lote</strong> para começar.
            </div>
          )}
          {!loading && lotes.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-950/60 text-zinc-500 uppercase text-xs">
                  <tr>
                    <th className="text-left px-4 py-3">Lote</th>
                    <th className="text-left px-4 py-3">Chips</th>
                    <th className="text-left px-4 py-3">Criado em</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {lotes.map(lote => (
                    <tr key={lote._id} className="hover:bg-zinc-950/40">
                      <td className="px-4 py-3 text-white font-mono font-bold">{lote.numero}</td>
                      <td className="px-4 py-3 text-zinc-300">{lote.quantidade}</td>
                      <td className="px-4 py-3 text-zinc-400 text-xs">{formatDateTimeBR(lote.criado_em)}</td>
                      <td className="px-4 py-3">{statusBadge(lote.status)}</td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <Button size="sm" variant="ghost" onClick={() => setDetailsLote(lote)} data-testid={`lote-detalhes-${lote.numero}`}>Detalhes</Button>
                        <Button size="sm" variant="outline" onClick={() => baixarPdf(lote, 'pimaco_6081')} data-testid={`lote-pdf-pimaco-${lote.numero}`}>
                          <Printer className="w-3.5 h-3.5 mr-1" /> Pimaco
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => baixarPdf(lote, 'a4_grid')} data-testid={`lote-pdf-a4-${lote.numero}`}>
                          <Printer className="w-3.5 h-3.5 mr-1" /> A4 Grid
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Novo Lote */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md" data-testid="qr-lotes-dialog">
          <DialogHeader>
            <DialogTitle className="text-white">Novo Lote de QR Code</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-zinc-300 text-xs">Status dos chips</Label>
              <select
                className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-white text-sm"
                value={filtro.status}
                onChange={(e) => { setFiltro({...filtro, status: e.target.value}); setPreviewData(null); }}
                data-testid="filtro-status-select"
              >
                <option value="disponivel">Disponíveis</option>
                <option value="reservado">Reservados</option>
                <option value="">Todos</option>
              </select>
            </div>
            <div>
              <Label className="text-zinc-300 text-xs">Quantidade máxima</Label>
              <Input
                type="number"
                min={1}
                max={5000}
                value={filtro.limite}
                onChange={(e) => { setFiltro({...filtro, limite: parseInt(e.target.value) || 1}); setPreviewData(null); }}
                className="mt-1 bg-zinc-950 border-zinc-800"
                data-testid="filtro-limite-input"
              />
              <p className="text-[10px] text-zinc-500 mt-1">Pimaco 6081: 40 por folha • A4 Grid: 30 por folha</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="apenas-sem-lote"
                checked={filtro.apenas_sem_lote}
                onChange={(e) => { setFiltro({...filtro, apenas_sem_lote: e.target.checked}); setPreviewData(null); }}
                data-testid="filtro-sem-lote-checkbox"
              />
              <label htmlFor="apenas-sem-lote" className="text-sm text-zinc-300">Apenas chips ainda sem lote</label>
            </div>

            <Button variant="outline" onClick={runPreview} className="w-full gap-2" data-testid="preview-btn">
              <Search className="w-4 h-4" /> Ver quantos chips serão incluídos
            </Button>

            {previewData && (
              <div className="bg-zinc-950 border border-zinc-800 rounded-md p-3 space-y-1">
                <p className="text-sm text-white">
                  <span className="font-bold text-2xl text-emerald-400">{previewData.limite_aplicado}</span> chips serão incluídos
                </p>
                <p className="text-xs text-zinc-500">
                  {previewData.total > previewData.limite_aplicado
                    ? `${previewData.total} chips correspondem ao filtro — apenas os primeiros ${previewData.limite_aplicado} serão usados.`
                    : `Todos os ${previewData.total} chips que correspondem ao filtro.`}
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={criarLote}
              disabled={creating || !previewData || previewData.limite_aplicado === 0}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="criar-lote-btn"
            >
              {creating ? 'Criando…' : 'Criar Lote'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Detalhes do Lote */}
      <Dialog open={!!detailsLote} onOpenChange={() => setDetailsLote(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="qr-lotes-detalhes-dialog">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              Lote {detailsLote?.numero} · {detailsLote?.quantidade} chips {detailsLote && statusBadge(detailsLote.status)}
            </DialogTitle>
          </DialogHeader>
          {detailsLote && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-zinc-500 text-xs">Criado em</p>
                  <p className="text-white">{formatDateTimeBR(detailsLote.criado_em)}</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-xs">Impresso em</p>
                  <p className="text-white">{detailsLote.impresso_em ? formatDateTimeBR(detailsLote.impresso_em) : '—'}</p>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button size="sm" onClick={() => baixarPdf(detailsLote, 'pimaco_6081')} className="bg-blue-600 gap-2">
                  <Printer className="w-3.5 h-3.5" /> Baixar PDF Pimaco 6081
                </Button>
                <Button size="sm" variant="outline" onClick={() => baixarPdf(detailsLote, 'a4_grid')} className="gap-2">
                  <Printer className="w-3.5 h-3.5" /> Baixar PDF A4 Grid
                </Button>
                {detailsLote.status === 'pendente' && (
                  <Button size="sm" variant="outline" onClick={() => marcarImpresso(detailsLote)} className="gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Marcar como impresso
                  </Button>
                )}
              </div>

              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Chips do lote</p>
                <div className="max-h-72 overflow-y-auto space-y-1">
                  {detailsLote.chips?.map((c, i) => (
                    <div key={c.iccid} className="flex items-center justify-between bg-zinc-950/60 border border-zinc-800 rounded px-3 py-2 text-xs">
                      <div>
                        <p className="text-zinc-500 font-mono">{i + 1}.</p>
                      </div>
                      <p className="flex-1 text-zinc-300 font-mono truncate px-2">{c.iccid}</p>
                      {c.reimpresso_em && (
                        <span className="text-orange-400 text-[10px]">Reimpresso {formatDateTimeBR(c.reimpresso_em)}</span>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => reimprimir(detailsLote, c.iccid)} className="ml-2 h-7 px-2" data-testid={`reimprimir-${c.iccid}`}>
                        <RotateCcw className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
