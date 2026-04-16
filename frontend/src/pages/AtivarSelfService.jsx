import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Label } from '../components/ui/label';
import {
  QrCode, CreditCard, ArrowRight, ArrowLeft, CheckCircle, Clock,
  AlertCircle, Wifi, ScanLine, Loader2, Copy, ExternalLink, XCircle,
  ArrowRightLeft, Smartphone, MessageSquare,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const STEPS = [
  { id: 'scan', label: 'Chip' },
  { id: 'dados', label: 'Dados' },
  { id: 'pagamento', label: 'Pagamento' },
  { id: 'status', label: 'Status' },
];

export default function AtivarSelfService() {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(0);
  const [iccid, setIccid] = useState('');
  const [chipInfo, setChipInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scannerActive, setScannerActive] = useState(false);
  const scannerRef = useRef(null);
  const html5QrRef = useRef(null);
  const autoValidated = useRef(false);

  // Auto-fill ICCID from URL query (QR Code)
  useEffect(() => {
    const iccidParam = searchParams.get('iccid');
    if (iccidParam && !autoValidated.current) {
      const cleaned = iccidParam.replace(/\D/g, '');
      if (cleaned.length >= 18) {
        setIccid(cleaned);
        autoValidated.current = true;
      }
    }
  }, [searchParams]);

  // Auto-validate when ICCID comes from URL
  useEffect(() => {
    if (autoValidated.current && iccid && iccid.length >= 18 && !chipInfo && step === 0) {
      handleValidateChip();
    }
  }, [iccid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Form data
  const [form, setForm] = useState({
    nome: '', documento: '', telefone: '', data_nascimento: '',
    cep: '', endereco: '', numero_endereco: '', bairro: '',
    cidade: '', estado: '', email: '', billing_type: 'PIX',
    ddd: '', portability: false, port_ddd: '', port_number: '',
  });

  // Activation result
  const [activation, setActivation] = useState(null);
  const [statusPolling, setStatusPolling] = useState(false);

  const updateForm = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const [cpfSearching, setCpfSearching] = useState(false);

  const handleDocumentoLookup = async (rawVal) => {
    const cleaned = rawVal.replace(/\D/g, '');
    // Format CPF
    let formatted = cleaned;
    if (cleaned.length <= 3) formatted = cleaned;
    else if (cleaned.length <= 6) formatted = `${cleaned.slice(0,3)}.${cleaned.slice(3)}`;
    else if (cleaned.length <= 9) formatted = `${cleaned.slice(0,3)}.${cleaned.slice(3,6)}.${cleaned.slice(6)}`;
    else formatted = `${cleaned.slice(0,3)}.${cleaned.slice(3,6)}.${cleaned.slice(6,9)}-${cleaned.slice(9,11)}`;
    updateForm('documento', formatted);

    if (cleaned.length === 11) {
      setCpfSearching(true);
      try {
        const res = await axios.get(`${API_URL}/api/public/buscar-cpf/${cleaned}`);
        if (res.data?.found && res.data.data) {
          const d = res.data.data;
          setForm(prev => ({
            ...prev,
            nome: d.nome || prev.nome,
            telefone: d.telefone || prev.telefone,
            email: d.email || prev.email,
            data_nascimento: d.data_nascimento || prev.data_nascimento,
            cep: d.cep || prev.cep,
            endereco: d.endereco || prev.endereco,
            numero_endereco: d.numero_endereco || prev.numero_endereco,
            bairro: d.bairro || prev.bairro,
            cidade: d.cidade || prev.cidade,
            estado: d.estado || prev.estado,
          }));
        }
      } catch {} // eslint-disable-line no-empty
      setCpfSearching(false);
    }
  };

  // QR Scanner
  const startScanner = useCallback(async () => {
    if (scannerActive) return;
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode("qr-reader");
      html5QrRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          const cleaned = decodedText.replace(/\D/g, '');
          if (cleaned.length >= 18) {
            setIccid(cleaned);
            stopScanner();
          }
        },
        () => {}
      );
      setScannerActive(true);
    } catch (err) {
      setError('Nao foi possivel acessar a camera. Digite o ICCID manualmente.');
    }
  }, [scannerActive]);

  const stopScanner = useCallback(() => {
    if (html5QrRef.current) {
      html5QrRef.current.stop().catch(() => {});
      html5QrRef.current.clear().catch(() => {});
      html5QrRef.current = null;
    }
    setScannerActive(false);
  }, []);

  useEffect(() => {
    return () => { stopScanner(); };
  }, [stopScanner]);

  // Validate chip
  const handleValidateChip = async () => {
    if (!iccid || iccid.replace(/\D/g, '').length < 18) {
      setError('ICCID deve ter pelo menos 18 digitos');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/api/public/validar-chip/${iccid.replace(/\D/g, '')}`);
      setChipInfo(res.data);
      stopScanner();
      setStep(1);
    } catch (e) {
      setError(e.response?.data?.detail || 'Erro ao validar chip');
    }
    setLoading(false);
  };

  // CEP lookup
  const handleCepLookup = async (cep) => {
    const cleaned = cep.replace(/\D/g, '');
    updateForm('cep', cep);
    if (cleaned.length === 8) {
      try {
        const res = await axios.get(`https://viacep.com.br/ws/${cleaned}/json/`);
        if (!res.data.erro) {
          updateForm('endereco', res.data.logradouro || '');
          updateForm('bairro', res.data.bairro || '');
          updateForm('cidade', res.data.localidade || '');
          updateForm('estado', res.data.uf || '');
        }
      } catch {} // eslint-disable-line no-empty
    }
  };

  // Submit activation
  const handleSubmitActivation = async () => {
    if (!form.nome || !form.documento || !form.telefone || !form.data_nascimento || !form.cep || !form.numero_endereco) {
      setError('Preencha todos os campos obrigatorios');
      return;
    }
    if (form.portability) {
      const dddClean = (form.port_ddd || '').replace(/\D/g, '');
      const numClean = (form.port_number || '').replace(/\D/g, '');
      if (dddClean.length < 2 || numClean.length < 8) {
        setError('Informe o DDD e numero para portabilidade');
        return;
      }
    }
    setLoading(true);
    setError('');
    try {
      const payload = {
        iccid: iccid.replace(/\D/g, ''),
        nome: form.nome,
        documento: form.documento.replace(/\D/g, ''),
        telefone: form.telefone.replace(/\D/g, ''),
        data_nascimento: form.data_nascimento,
        cep: form.cep.replace(/\D/g, ''),
        endereco: form.endereco,
        numero_endereco: form.numero_endereco,
        bairro: form.bairro,
        cidade: form.cidade,
        estado: form.estado,
        email: form.email || undefined,
        billing_type: form.billing_type,
        ddd: form.ddd || undefined,
        portability: form.portability,
      };
      if (form.portability) {
        payload.port_ddd = form.port_ddd.replace(/\D/g, '');
        payload.port_number = form.port_number.replace(/\D/g, '');
      }
      const res = await axios.post(`${API_URL}/api/public/ativacao`, payload);
      setActivation(res.data);
      setStep(3);
    } catch (e) {
      setError(e.response?.data?.detail || 'Erro ao processar ativacao');
    }
    setLoading(false);
  };

  // Poll status
  useEffect(() => {
    if (!activation?.id || activation?.status === 'ativo' || activation?.status === 'erro' || activation?.status === 'cancelado') return;
    setStatusPolling(true);
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_URL}/api/public/ativacao/${activation.id}/status`);
        setActivation(prev => ({ ...prev, ...res.data }));
        if (res.data.status === 'ativo' || res.data.status === 'erro' || res.data.status === 'cancelado') {
          clearInterval(interval);
          setStatusPolling(false);
        }
      } catch {} // eslint-disable-line no-empty
    }, activation?.status === 'portabilidade_em_andamento' ? 30000 : activation?.status === 'retry_pendente' ? 30000 : 5000);
    return () => { clearInterval(interval); setStatusPolling(false); };
  }, [activation?.id, activation?.status]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  // ============ RENDER ============
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col" data-testid="ativar-selfservice-page">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center">
          <span className="text-white font-bold text-sm">M</span>
        </div>
        <div>
          <h1 className="text-white font-bold text-base">MVNO - Ativar Chip</h1>
          <p className="text-zinc-500 text-xs">Ativacao self-service</p>
        </div>
      </header>

      {/* Stepper */}
      <div className="px-4 py-3 bg-zinc-900/80 border-b border-zinc-800">
        <div className="flex items-center justify-center gap-1 max-w-md mx-auto">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                i === step ? 'bg-blue-600 text-white' :
                i < step ? 'bg-emerald-600/20 text-emerald-400' :
                'bg-zinc-800 text-zinc-500'
              }`}>
                {i < step ? <CheckCircle className="w-3 h-3" /> : <span>{i + 1}</span>}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-6 sm:w-10 h-px mx-1 ${i < step ? 'bg-emerald-600' : 'bg-zinc-700'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 max-w-lg mx-auto w-full">
        {error && (
          <div className="mb-4 p-3 bg-red-500/15 border border-red-500/40 rounded-lg text-red-400 text-sm flex items-start gap-2" data-testid="error-message">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError('')} className="ml-auto"><XCircle className="w-4 h-4" /></button>
          </div>
        )}

        {/* STEP 0: Scan / Enter ICCID */}
        {step === 0 && (
          <div className="space-y-4 animate-fade-in">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <ScanLine className="w-8 h-8 text-blue-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Escanear Chip</h2>
              <p className="text-zinc-300 text-sm mt-1">Escaneie o QR Code ou digite o ICCID do chip</p>
            </div>

            {/* QR Scanner area */}
            <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
              <CardContent className="p-0">
                <div id="qr-reader" ref={scannerRef}
                  className={`w-full ${scannerActive ? 'min-h-[280px]' : 'h-0'}`}
                  style={{ transition: 'min-height 0.3s' }}
                />
                {!scannerActive && (
                  <div className="p-6 text-center">
                    <Button
                      onClick={startScanner}
                      variant="outline"
                      className="w-full bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700 min-h-[48px]"
                      data-testid="start-scanner-btn"
                    >
                      <QrCode className="w-5 h-5 mr-2" />
                      Abrir Camera para Escanear
                    </Button>
                  </div>
                )}
                {scannerActive && (
                  <div className="p-3 text-center">
                    <Button onClick={stopScanner} variant="outline" size="sm" className="text-zinc-400 border-zinc-700">
                      Fechar Camera
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Manual ICCID */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-zinc-800" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-zinc-950 px-2 text-zinc-500">ou digite manualmente</span></div>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">ICCID do Chip</Label>
              <Input
                value={iccid}
                onChange={e => setIccid(e.target.value.replace(/\D/g, ''))}
                placeholder="Digite os numeros do ICCID"
                className="form-input text-center text-lg tracking-wider font-mono"
                maxLength={22}
                data-testid="iccid-input"
              />
              <p className="text-xs text-zinc-500 text-center">O ICCID esta impresso no chip ou na embalagem</p>
            </div>

            <Button
              onClick={handleValidateChip}
              disabled={loading || !iccid || iccid.length < 18}
              className="w-full btn-primary text-base min-h-[52px]"
              data-testid="validate-chip-btn"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <ArrowRight className="w-5 h-5 mr-2" />}
              Validar Chip
            </Button>
          </div>
        )}

        {/* STEP 1: Chip Info + Personal Data Form */}
        {step === 1 && chipInfo && (
          <div className="space-y-4 animate-fade-in">
            {/* Chip Info Card */}
            <Card className="bg-zinc-900 border-zinc-500/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-emerald-600/10 rounded-lg flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">{chipInfo.oferta_nome}</p>
                    <p className="text-zinc-300 text-xs">{chipInfo.plano_nome} - {chipInfo.franquia}</p>
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    {chipInfo.desconto > 0 && (
                      <p className="text-zinc-500 text-sm line-through">R$ {chipInfo.valor_original.toFixed(2)}</p>
                    )}
                    <p className="text-2xl font-bold text-white">
                      R$ {chipInfo.valor_final.toFixed(2)}
                    </p>
                  </div>
                  {chipInfo.desconto > 0 && (
                    <span className="bg-emerald-500/15 text-emerald-400 text-xs px-2 py-1 rounded-full border border-emerald-500/40">
                      -{' '}R$ {chipInfo.desconto.toFixed(2)} desconto
                    </span>
                  )}
                </div>
                {chipInfo.revendedor_nome && (
                  <p className="text-xs text-zinc-500 mt-2">Revendedor: {chipInfo.revendedor_nome}</p>
                )}
              </CardContent>
            </Card>

            {/* Personal Data Form */}
            <h3 className="text-white font-semibold text-sm">Seus Dados</h3>
            <div className="space-y-3">
              <div>
                <Label className="text-zinc-300 text-xs">Nome Completo *</Label>
                <Input value={form.nome} onChange={e => updateForm('nome', e.target.value)}
                  className="form-input" placeholder="Nome completo" data-testid="nome-input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-zinc-300 text-xs">CPF *</Label>
                  <div className="relative">
                    <Input value={form.documento} onChange={e => handleDocumentoLookup(e.target.value)}
                      className="form-input" placeholder="000.000.000-00" maxLength={14} data-testid="cpf-input" />
                    {cpfSearching && <div className="absolute right-2 top-1/2 -translate-y-1/2"><div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}
                  </div>
                </div>
                <div>
                  <Label className="text-zinc-300 text-xs">Telefone *</Label>
                  <Input value={form.telefone} onChange={e => updateForm('telefone', e.target.value)}
                    className="form-input" placeholder="(11) 99999-9999" data-testid="telefone-input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-zinc-300 text-xs">Data Nascimento *</Label>
                  <Input type="date" value={form.data_nascimento} onChange={e => updateForm('data_nascimento', e.target.value)}
                    className="form-input" data-testid="nascimento-input" />
                </div>
                <div>
                  <Label className="text-zinc-300 text-xs">E-mail</Label>
                  <Input type="email" value={form.email} onChange={e => updateForm('email', e.target.value)}
                    className="form-input" placeholder="email@exemplo.com" data-testid="email-input" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-zinc-300 text-xs">CEP *</Label>
                  <Input value={form.cep} onChange={e => handleCepLookup(e.target.value)}
                    className="form-input" placeholder="00000-000" maxLength={9} data-testid="cep-input" />
                </div>
                <div className="col-span-2">
                  <Label className="text-zinc-300 text-xs">Endereco</Label>
                  <Input value={form.endereco} onChange={e => updateForm('endereco', e.target.value)}
                    className="form-input" placeholder="Rua..." data-testid="endereco-input" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-zinc-300 text-xs">Numero *</Label>
                  <Input value={form.numero_endereco} onChange={e => updateForm('numero_endereco', e.target.value)}
                    className="form-input" placeholder="123" data-testid="numero-input" />
                </div>
                <div>
                  <Label className="text-zinc-300 text-xs">Bairro</Label>
                  <Input value={form.bairro} onChange={e => updateForm('bairro', e.target.value)}
                    className="form-input" data-testid="bairro-input" />
                </div>
                <div>
                  <Label className="text-zinc-300 text-xs">Cidade</Label>
                  <Input value={form.cidade} onChange={e => updateForm('cidade', e.target.value)}
                    className="form-input" data-testid="cidade-input" />
                </div>
              </div>
            </div>

            {/* DDD da nova linha */}
            <div className="space-y-1 mt-4">
              <Label className="text-zinc-300 text-xs">DDD da Linha</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  value={form.ddd}
                  onChange={(e) => updateForm('ddd', e.target.value.replace(/\D/g, '').slice(0, 2))}
                  placeholder="83"
                  className="form-input font-mono w-20"
                  data-testid="selfservice-ddd-input"
                />
                <span className="text-xs text-zinc-300">Ex: 11 SP, 21 RJ, 83 PB</span>
              </div>
            </div>

            {/* Portabilidade */}
            <div className="space-y-3 mt-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.portability}
                  onClick={() => updateForm('portability', !form.portability)}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${form.portability ? 'bg-blue-600' : 'bg-zinc-700'}`}
                  data-testid="selfservice-portability-toggle"
                >
                  <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${form.portability ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-zinc-300 text-sm flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-blue-400" />
                  Portabilidade (manter meu numero)
                </span>
              </div>

              {form.portability && (
                <div className="p-3 bg-blue-500/15 border border-blue-500/40 rounded-lg space-y-3">
                  <p className="text-xs text-zinc-400">
                    Informe o numero que deseja portar de outra operadora.
                  </p>
                  <div className="flex gap-3">
                    <div className="w-20">
                      <Label className="text-zinc-300 text-xs">DDD</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        maxLength={2}
                        value={form.port_ddd}
                        onChange={(e) => updateForm('port_ddd', e.target.value.replace(/\D/g, '').slice(0, 2))}
                        placeholder="83"
                        className="form-input font-mono"
                        data-testid="selfservice-port-ddd"
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-zinc-300 text-xs">Numero</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        maxLength={9}
                        value={form.port_number}
                        onChange={(e) => updateForm('port_number', e.target.value.replace(/\D/g, '').slice(0, 9))}
                        placeholder="999056284"
                        className="form-input font-mono"
                        data-testid="selfservice-port-number"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Payment Method */}
            <h3 className="text-white font-semibold text-sm mt-4">Forma de Pagamento</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => updateForm('billing_type', 'PIX')}
                className={`p-3 rounded-lg border text-center transition-all ${
                  form.billing_type === 'PIX'
                    ? 'border-blue-500 bg-blue-500/15 text-blue-400'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700'
                }`}
                data-testid="billing-pix"
              >
                <QrCode className="w-6 h-6 mx-auto mb-1" />
                <span className="text-sm font-medium">Pix</span>
              </button>
              <button
                onClick={() => updateForm('billing_type', 'BOLETO')}
                className={`p-3 rounded-lg border text-center transition-all ${
                  form.billing_type === 'BOLETO'
                    ? 'border-blue-500 bg-blue-500/15 text-blue-400'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700'
                }`}
                data-testid="billing-boleto"
              >
                <CreditCard className="w-6 h-6 mx-auto mb-1" />
                <span className="text-sm font-medium">Boleto</span>
              </button>
            </div>

            <div className="flex gap-3 mt-4">
              <Button onClick={() => { setStep(0); setError(''); }} variant="outline" className="flex-1 btn-secondary min-h-[48px]">
                <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
              </Button>
              <Button onClick={handleSubmitActivation} disabled={loading} className="flex-1 btn-primary min-h-[48px]" data-testid="submit-activation-btn">
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <ArrowRight className="w-5 h-5 mr-2" />}
                Pagar e Ativar
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2 is skipped (merged payment into step 1) */}

        {/* STEP 3: Status / Payment Info */}
        {step === 3 && activation && (
          <div className="space-y-4 animate-fade-in">
            {/* Status Header */}
            <div className="text-center mb-4">
              {activation.status === 'aguardando_pagamento' && (
                <>
                  <div className="w-16 h-16 bg-amber-500/15 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Clock className="w-8 h-8 text-amber-400" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Aguardando Pagamento</h2>
                  <p className="text-zinc-300 text-sm mt-1">Efetue o pagamento para ativar seu chip</p>
                </>
              )}
              {activation.status === 'pago' && (
                <>
                  <div className="w-16 h-16 bg-blue-500/15 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Pagamento Confirmado!</h2>
                  <p className="text-zinc-300 text-sm mt-1">Ativando seu chip na operadora...</p>
                </>
              )}
              {activation.status === 'ativando' && (
                <>
                  <div className="w-16 h-16 bg-blue-500/15 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Wifi className="w-8 h-8 text-blue-400 animate-pulse" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Ativando...</h2>
                  <p className="text-zinc-300 text-sm mt-1">Sua linha esta sendo ativada na operadora</p>
                </>
              )}
              {activation.status === 'portabilidade_em_andamento' && (
                <>
                  <div className="w-16 h-16 bg-amber-500/15 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Smartphone className="w-8 h-8 text-amber-400 animate-pulse" />
                  </div>
                  <h2 className="text-xl font-bold text-amber-400">Portabilidade Solicitada!</h2>
                  <p className="text-zinc-300 text-sm mt-2">Sua solicitacao de portabilidade foi enviada com sucesso.</p>
                </>
              )}
              {activation.status === 'ativo' && (
                <>
                  <div className="w-16 h-16 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                  </div>
                  <h2 className="text-xl font-bold text-emerald-400">Chip Ativado!</h2>
                  <p className="text-zinc-300 text-sm mt-1">Insira o chip no aparelho e aproveite</p>
                  {activation.msisdn && (
                    <p className="text-white font-mono text-lg mt-2">Seu numero: {activation.msisdn}</p>
                  )}
                </>
              )}
              {activation.status === 'erro' && (
                <>
                  <div className="w-16 h-16 bg-red-500/15 rounded-full flex items-center justify-center mx-auto mb-3">
                    <AlertCircle className="w-8 h-8 text-red-400" />
                  </div>
                  <h2 className="text-xl font-bold text-red-400">Erro na Ativacao</h2>
                  <p className="text-zinc-300 text-sm mt-1">Entre em contato com o suporte</p>
                </>
              )}
              {activation.status === 'retry_pendente' && (
                <>
                  <div className="w-16 h-16 bg-amber-500/15 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                  </div>
                  <h2 className="text-xl font-bold text-amber-400">Processando...</h2>
                  <p className="text-zinc-300 text-sm mt-1">Houve uma falha temporaria. Estamos retentando automaticamente.</p>
                  <p className="text-zinc-500 text-xs mt-2">Voce pode fechar esta pagina. A ativacao sera concluida em breve.</p>
                </>
              )}
            </div>

            {/* Portabilidade Info */}
            {activation.status === 'portabilidade_em_andamento' && (
              <Card className="bg-amber-950/30 border-amber-800/40">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-amber-300 font-medium text-sm">Confirme o SMS da operadora anterior</p>
                      <p className="text-zinc-300 text-xs mt-1">
                        Voce recebera um SMS no seu numero atual pedindo a confirmacao da portabilidade. 
                        Responda conforme as instrucoes para prosseguir.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-blue-300 font-medium text-sm">Apos confirmar, aguarde a janela de portabilidade</p>
                      <p className="text-zinc-300 text-xs mt-1">
                        A portabilidade sera concluida na proxima janela disponivel (geralmente durante a madrugada).
                      </p>
                    </div>
                  </div>
                  {activation.portability_status && (
                    <div className="mt-2 p-2 bg-zinc-900/50 rounded text-xs">
                      <span className="text-zinc-400">Status: </span>
                      <span className="text-white font-medium">{activation.portability_status}</span>
                      {activation.portability_window && (
                        <span className="text-zinc-400 ml-2">| Janela: <span className="text-white">{activation.portability_window}</span></span>
                      )}
                    </div>
                  )}
                  {activation.portability_msg && (
                    <p className="text-xs text-zinc-500 italic">{activation.portability_msg}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Payment Info */}
            {activation.status === 'aguardando_pagamento' && (
              <Card className="bg-zinc-900 border-zinc-500/60">
                <CardContent className="p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-300 text-sm">Valor</span>
                    <span className="text-white font-bold text-lg">R$ {activation.valor_final.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-300 text-sm">Metodo</span>
                    <span className="text-white text-sm">{activation.billing_type}</span>
                  </div>

                  {/* PIX */}
                  {activation.billing_type === 'PIX' && activation.asaas_pix_code && (
                    <div className="space-y-3">
                      {activation.asaas_pix_qrcode && (
                        <div className="flex justify-center p-4 bg-white rounded-lg">
                          <img src={`data:image/png;base64,${activation.asaas_pix_qrcode}`}
                            alt="QR Code Pix" className="w-48 h-48" data-testid="pix-qrcode" />
                        </div>
                      )}
                      <div>
                        <Label className="text-zinc-300 text-xs">Pix Copia e Cola</Label>
                        <div className="flex gap-2 mt-1">
                          <Input value={activation.asaas_pix_code} readOnly
                            className="form-input text-xs font-mono" data-testid="pix-code" />
                          <Button onClick={() => copyToClipboard(activation.asaas_pix_code)}
                            variant="outline" className="shrink-0 border-zinc-700" data-testid="copy-pix-btn">
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Boleto */}
                  {activation.billing_type === 'BOLETO' && (
                    <div className="space-y-3">
                      {activation.barcode && (
                        <div>
                          <Label className="text-zinc-300 text-xs">Codigo de Barras</Label>
                          <div className="flex gap-2 mt-1">
                            <Input value={activation.barcode} readOnly
                              className="form-input text-xs font-mono" data-testid="barcode" />
                            <Button onClick={() => copyToClipboard(activation.barcode)}
                              variant="outline" className="shrink-0 border-zinc-700">
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                      {activation.asaas_invoice_url && (
                        <a href={activation.asaas_invoice_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                          data-testid="view-boleto-btn">
                          <ExternalLink className="w-4 h-4" /> Ver Boleto Completo
                        </a>
                      )}
                    </div>
                  )}

                  {/* Invoice link */}
                  {activation.asaas_invoice_url && activation.billing_type === 'PIX' && (
                    <a href={activation.asaas_invoice_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 text-blue-400 hover:text-blue-300 text-sm">
                      <ExternalLink className="w-4 h-4" /> Ver fatura completa
                    </a>
                  )}

                  {/* No payment info (mock) */}
                  {!activation.asaas_pix_code && !activation.barcode && !activation.asaas_invoice_url && (
                    <div className="text-center p-4 bg-amber-500/15 border border-amber-500/40 rounded-lg">
                      <p className="text-amber-400 text-sm">Pagamento registrado no sistema.</p>
                      <p className="text-zinc-300 text-xs mt-1">O administrador ira confirmar o pagamento e ativar seu chip.</p>
                    </div>
                  )}

                  {statusPolling && (
                    <div className="flex items-center justify-center gap-2 text-zinc-400 text-xs mt-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Verificando pagamento automaticamente...
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Plan Summary */}
            <Card className="bg-zinc-900 border-zinc-500/60">
              <CardContent className="p-4">
                <h4 className="text-zinc-300 text-xs uppercase tracking-wider mb-2">Resumo</h4>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Plano</span>
                    <span className="text-white">{activation.plano_nome}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Oferta</span>
                    <span className="text-white">{activation.oferta_nome}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">ICCID</span>
                    <span className="text-white font-mono text-xs">{activation.chip_iccid}</span>
                  </div>
                  {activation.desconto > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Desconto</span>
                      <span>- R$ {activation.desconto.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            {activation.status === 'aguardando_pagamento' && (
              <Button
                onClick={async () => {
                  try {
                    const res = await axios.get(`${API_URL}/api/public/ativacao/${activation.id}/status`);
                    setActivation(prev => ({ ...prev, ...res.data }));
                  } catch {} // eslint-disable-line no-empty
                }}
                variant="outline"
                className="w-full btn-secondary min-h-[48px]"
                data-testid="check-status-btn"
              >
                <RefreshIcon className="w-4 h-4 mr-2" /> Verificar Status do Pagamento
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="p-4 text-center text-zinc-600 text-xs border-t border-zinc-800">
        MVNO Manager - Ta Telecom
      </footer>
    </div>
  );
}

function RefreshIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 21h5v-5" />
    </svg>
  );
}
