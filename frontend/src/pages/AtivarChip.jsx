import { useState } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Zap, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function formatCPF(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0,3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6)}`;
  return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
}

export function AtivarChip() {
  const [form, setForm] = useState({ nome: '', cpf: '', iccid: '', plano: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const f = (field, value) => setForm({ ...form, [field]: value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      await axios.post(`${API_URL}/api/ativar-chip`, {
        nome: form.nome,
        cpf: form.cpf.replace(/\D/g, ''),
        iccid: form.iccid.replace(/\D/g, ''),
        plano: form.plano,
      }, { withCredentials: true });

      setResult('success');
      toast.success('Chip ativado com sucesso');
      setForm({ nome: '', cpf: '', iccid: '', plano: '' });
    } catch (error) {
      setResult('error');
      toast.error('Erro ao ativar chip');
    } finally {
      setLoading(false);
    }
  };

  const isValid = form.nome.trim() && form.cpf.replace(/\D/g, '').length >= 11 && form.iccid.trim() && form.plano.trim();

  return (
    <div className="max-w-lg mx-auto space-y-6" data-testid="ativar-chip-page">
      <div>
        <h1 className="page-title flex items-center gap-3">
          <Zap className="w-7 h-7 text-amber-500" />Ativar Chip
        </h1>
        <p className="text-zinc-400 text-sm -mt-4">Preencha os dados para ativar o chip</p>
      </div>

      {/* Result Banner */}
      {result === 'success' && (
        <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-sm" data-testid="ativar-chip-success">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-emerald-400 font-medium">Chip ativado com sucesso</span>
        </div>
      )}
      {result === 'error' && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-sm" data-testid="ativar-chip-error">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span className="text-red-400 font-medium">Erro ao ativar chip</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="dashboard-card space-y-5">
        <div className="space-y-2">
          <Label className="text-zinc-300">Nome</Label>
          <Input
            value={form.nome}
            onChange={(e) => f('nome', e.target.value)}
            className="form-input"
            placeholder="Nome completo"
            required
            data-testid="ativar-chip-nome"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-zinc-300">CPF</Label>
          <Input
            value={form.cpf}
            onChange={(e) => f('cpf', formatCPF(e.target.value))}
            className="form-input font-mono"
            placeholder="000.000.000-00"
            inputMode="numeric"
            maxLength={14}
            required
            data-testid="ativar-chip-cpf"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-zinc-300">ICCID</Label>
          <Input
            value={form.iccid}
            onChange={(e) => f('iccid', e.target.value.replace(/\D/g, ''))}
            className="form-input font-mono"
            placeholder="Ex: 8955010012345678901"
            inputMode="numeric"
            maxLength={20}
            required
            data-testid="ativar-chip-iccid"
          />
          <p className="text-xs text-zinc-500">Numero impresso no chip (19-20 digitos)</p>
        </div>

        <div className="space-y-2">
          <Label className="text-zinc-300">Plano</Label>
          <Input
            value={form.plano}
            onChange={(e) => f('plano', e.target.value)}
            className="form-input"
            placeholder="Ex: Movel 10GB"
            required
            data-testid="ativar-chip-plano"
          />
        </div>

        <Button
          type="submit"
          disabled={loading || !isValid}
          className="btn-primary w-full h-14 text-base font-bold"
          data-testid="ativar-chip-button"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />Ativando...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Zap className="w-5 h-5" />ATIVAR CHIP
            </span>
          )}
        </Button>
      </form>
    </div>
  );
}
