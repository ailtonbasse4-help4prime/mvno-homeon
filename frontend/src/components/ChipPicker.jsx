import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Search, Package, ScanLine, QrCode } from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

/**
 * Componente reutilizavel para selecionar chips em massa.
 *
 * Duas abas: "Por ICCID" (sufixo + Enter) e "Por Lote" (numero L001).
 * Retorna a lista de chips selecionados via prop onChange e o botao de acao
 * eh renderizado externamente com base em `selecionados` (props).
 *
 * Props:
 *  - selecionados: array de {iccid, status}
 *  - onChange: fn(newList)
 *  - onlyAvailable: bool - se true, filtra apenas status=disponivel
 */
export function ChipPicker({ selecionados = [], onChange, onlyAvailable = false }) {
  const [tab, setTab] = useState('iccid');
  const [sufixo, setSufixo] = useState('');
  const [matches, setMatches] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [loteNumero, setLoteNumero] = useState('');
  const [loteInfo, setLoteInfo] = useState(null);
  const [loadingLote, setLoadingLote] = useState(false);
  const sufixoRef = useRef(null);
  const loteRef = useRef(null);

  useEffect(() => {
    if (tab === 'iccid') setTimeout(() => sufixoRef.current?.focus(), 50);
    if (tab === 'lote') setTimeout(() => loteRef.current?.focus(), 50);
  }, [tab]);

  const addChip = (chip) => {
    if (onlyAvailable && chip.status !== 'disponivel') {
      toast.error(`Chip está com status "${chip.status}" — só é permitido adicionar chips disponíveis`);
      return;
    }
    if (selecionados.some(s => s.iccid === chip.iccid)) {
      toast.info('Chip já adicionado');
      return;
    }
    onChange([...selecionados, chip]);
  };

  const removeChip = (iccid) => onChange(selecionados.filter(s => s.iccid !== iccid));

  const buscarChipPorSufixo = async () => {
    const t = sufixo.replace(/\D/g, '');
    if (t.length < 3) {
      toast.error('Digite ao menos 3 dígitos');
      return;
    }
    setBuscando(true);
    setMatches(null);
    try {
      const res = await axios.get(`${API_URL}/api/qr-lotes/buscar-chip?termo=${t}`, { withCredentials: true });
      const found = res.data.matches || [];
      const disponiveis = found.filter(m => !selecionados.some(s => s.iccid === m.iccid));
      if (disponiveis.length === 0) {
        if (found.length === 0) toast.error(`Nenhum chip encontrado com final "${t}"`);
        else toast.info('Todos os chips encontrados já estão na lista');
        setMatches([]);
        return;
      }
      if (disponiveis.length === 1) {
        addChip(disponiveis[0]);
        setSufixo('');
        setMatches(null);
        toast.success(`Chip ...${disponiveis[0].iccid.slice(-6)} adicionado`);
        setTimeout(() => sufixoRef.current?.focus(), 50);
      } else {
        setMatches(disponiveis);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro na busca');
    } finally {
      setBuscando(false);
    }
  };

  const buscarLote = async () => {
    const num = loteNumero.trim().toUpperCase();
    if (!num) {
      toast.error('Digite o número do lote');
      return;
    }
    setLoadingLote(true);
    setLoteInfo(null);
    try {
      const res = await axios.get(`${API_URL}/api/qr-lotes/por-numero/${num}`, { withCredentials: true });
      // Busca detalhes de cada chip pra ter status
      const iccids = (res.data.chips || []).map(c => c.iccid);
      // Consulta status de todos os chips via /api/chips (por status filter multi query = fazer 1 query e filtrar client-side)
      const chipsRes = await axios.get(`${API_URL}/api/chips?limit=5000`, { withCredentials: true });
      const chipsAll = Array.isArray(chipsRes.data) ? chipsRes.data : (chipsRes.data.items || []);
      const chipsDoLote = chipsAll.filter(c => iccids.includes(c.iccid));
      const disponiveis = chipsDoLote.filter(c => c.status === 'disponivel');
      const jaAdicionados = disponiveis.filter(c => selecionados.some(s => s.iccid === c.iccid)).length;
      setLoteInfo({
        numero: res.data.numero,
        total: iccids.length,
        no_banco: chipsDoLote.length,
        disponiveis: disponiveis.length,
        ja_na_lista: jaAdicionados,
        chips_para_adicionar: disponiveis.filter(c => !selecionados.some(s => s.iccid === c.iccid)),
        outros_status: chipsDoLote.filter(c => c.status !== 'disponivel'),
      });
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Lote não encontrado');
    } finally {
      setLoadingLote(false);
    }
  };

  const adicionarLoteInteiro = () => {
    if (!loteInfo || loteInfo.chips_para_adicionar.length === 0) return;
    const novos = loteInfo.chips_para_adicionar.map(c => ({ iccid: c.iccid, status: c.status }));
    onChange([...selecionados, ...novos]);
    toast.success(`${novos.length} chips do lote ${loteInfo.numero} adicionados`);
    setLoteNumero('');
    setLoteInfo(null);
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-950/60 rounded-md p-1">
        <button
          type="button"
          onClick={() => setTab('iccid')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded text-xs font-medium transition-colors ${
            tab === 'iccid' ? 'bg-blue-500/25 text-blue-300' : 'text-zinc-400 hover:text-white'
          }`}
          data-testid="picker-tab-iccid"
        >
          <ScanLine className="w-3.5 h-3.5" /> Por ICCID
        </button>
        <button
          type="button"
          onClick={() => setTab('lote')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded text-xs font-medium transition-colors ${
            tab === 'lote' ? 'bg-blue-500/25 text-blue-300' : 'text-zinc-400 hover:text-white'
          }`}
          data-testid="picker-tab-lote"
        >
          <QrCode className="w-3.5 h-3.5" /> Por Lote
        </button>
      </div>

      {/* TAB: Por ICCID */}
      {tab === 'iccid' && (
        <div>
          <Label className="text-zinc-300 text-xs">Últimos dígitos do ICCID</Label>
          <div className="flex gap-2 mt-1">
            <Input
              ref={sufixoRef}
              type="text"
              inputMode="numeric"
              placeholder="Ex: 4567"
              value={sufixo}
              onChange={(e) => setSufixo(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscarChipPorSufixo(); } }}
              className="bg-zinc-950 border-zinc-800 font-mono text-base"
              maxLength={22}
              data-testid="picker-sufixo-input"
            />
            <Button
              onClick={buscarChipPorSufixo}
              disabled={buscando || sufixo.length < 3}
              className="bg-blue-600 hover:bg-blue-700 gap-1"
              data-testid="picker-buscar-btn"
            >
              <Search className="w-4 h-4" />
              {buscando ? '...' : 'Buscar'}
            </Button>
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">Mínimo 3 dígitos • Enter busca rápido</p>

          {matches && matches.length > 1 && (
            <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-md p-3">
              <p className="text-xs text-amber-300 mb-2 font-semibold">
                {matches.length} chips terminam com "{sufixo}" — escolha:
              </p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {matches.map(m => (
                  <button
                    key={m.iccid}
                    type="button"
                    onClick={() => {
                      addChip(m);
                      setSufixo('');
                      setMatches(null);
                    }}
                    className="w-full text-left px-3 py-2 rounded-md text-xs font-mono flex items-center justify-between bg-zinc-950 hover:bg-zinc-800 text-zinc-200"
                    data-testid={`picker-match-${m.iccid}`}
                  >
                    <span>{m.iccid}</span>
                    <span className="text-[10px] text-emerald-400">{m.status}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: Por Lote */}
      {tab === 'lote' && (
        <div>
          <Label className="text-zinc-300 text-xs">Número do lote</Label>
          <div className="flex gap-2 mt-1">
            <Input
              ref={loteRef}
              type="text"
              placeholder="Ex: L001"
              value={loteNumero}
              onChange={(e) => setLoteNumero(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscarLote(); } }}
              className="bg-zinc-950 border-zinc-800 font-mono text-base uppercase"
              maxLength={10}
              data-testid="picker-lote-input"
            />
            <Button
              onClick={buscarLote}
              disabled={loadingLote || !loteNumero.trim()}
              className="bg-blue-600 hover:bg-blue-700 gap-1"
              data-testid="picker-buscar-lote-btn"
            >
              <Search className="w-4 h-4" />
              {loadingLote ? '...' : 'Buscar'}
            </Button>
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">Digite o número do lote (L001, L002…) e adicione todos os chips de uma vez</p>

          {loteInfo && (
            <div className="mt-3 bg-zinc-950/60 border border-zinc-800 rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white font-bold">Lote {loteInfo.numero}</p>
                <p className="text-xs text-zinc-500">{loteInfo.total} chips no total</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded p-2">
                  <p className="text-emerald-300 font-bold text-lg">{loteInfo.chips_para_adicionar.length}</p>
                  <p className="text-emerald-400 text-[10px]">disponíveis para adicionar</p>
                </div>
                {loteInfo.ja_na_lista > 0 && (
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded p-2">
                    <p className="text-blue-300 font-bold text-lg">{loteInfo.ja_na_lista}</p>
                    <p className="text-blue-400 text-[10px]">já na lista</p>
                  </div>
                )}
                {loteInfo.outros_status.length > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded p-2 col-span-2">
                    <p className="text-amber-300 font-bold text-sm">{loteInfo.outros_status.length}</p>
                    <p className="text-amber-400 text-[10px]">
                      {onlyAvailable ? 'não disponíveis (serão ignorados)' : 'com outro status'}
                    </p>
                  </div>
                )}
              </div>
              <Button
                onClick={adicionarLoteInteiro}
                disabled={loteInfo.chips_para_adicionar.length === 0}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                data-testid="picker-adicionar-lote-btn"
              >
                Adicionar {loteInfo.chips_para_adicionar.length} chips do lote {loteInfo.numero}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Lista de selecionados */}
      <div>
        <div className="flex items-center justify-between mb-2 pt-2 border-t border-zinc-800">
          <Label className="text-zinc-300 text-xs">Chips selecionados</Label>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-400" data-testid="picker-count">
              {selecionados.length} {selecionados.length === 1 ? 'chip' : 'chips'}
            </span>
            {selecionados.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[10px] text-zinc-500 hover:text-red-400"
                data-testid="picker-limpar"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
        {selecionados.length === 0 ? (
          <div className="bg-zinc-950/60 border border-dashed border-zinc-800 rounded-md p-4 text-center">
            <Package className="w-6 h-6 text-zinc-700 mx-auto mb-1" />
            <p className="text-xs text-zinc-500">Nenhum chip adicionado</p>
          </div>
        ) : (
          <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
            {selecionados.map((s, i) => (
              <div
                key={s.iccid}
                className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5"
                data-testid={`picker-selecionado-${s.iccid}`}
              >
                <span className="text-zinc-500 text-xs w-6 flex-none">{i + 1}.</span>
                <span className="text-white font-mono text-xs flex-1 truncate">{s.iccid}</span>
                {s.status && <span className="text-[10px] text-emerald-400 flex-none">{s.status}</span>}
                <button
                  type="button"
                  onClick={() => removeChip(s.iccid)}
                  className="flex-none text-zinc-500 hover:text-red-400 transition-colors"
                  aria-label="Remover"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
