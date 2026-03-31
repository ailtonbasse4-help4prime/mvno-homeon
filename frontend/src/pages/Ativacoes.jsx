import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { IccidInput } from '../components/IccidInput';
import { toast } from 'sonner';
import { Zap, CheckCircle, Clock, AlertCircle, CreditCard } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export function Ativacoes() {
  const [clientes, setClientes] = useState([]);
  const [chips, setChips] = useState([]);
  const [allChips, setAllChips] = useState([]); // Todos os chips para validação
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [activationResult, setActivationResult] = useState(null);

  const [selectedCliente, setSelectedCliente] = useState('');
  const [selectedChip, setSelectedChip] = useState('');
  const [selectedChipData, setSelectedChipData] = useState(null);
  const [selectedPlano, setSelectedPlano] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [clientesRes, chipsDisponiveisRes, allChipsRes, planosRes] = await Promise.all([
        axios.get(`${API_URL}/api/clientes`, { withCredentials: true }),
        axios.get(`${API_URL}/api/chips?status=disponivel`, { withCredentials: true }),
        axios.get(`${API_URL}/api/chips`, { withCredentials: true }),
        axios.get(`${API_URL}/api/planos`, { withCredentials: true })
      ]);
      
      setClientes(clientesRes.data.filter(c => c.status === 'ativo'));
      setChips(chipsDisponiveisRes.data);
      setAllChips(allChipsRes.data);
      setPlanos(planosRes.data);
    } catch (error) {
      toast.error('Erro ao carregar dados');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleActivate = async () => {
    if (!selectedCliente || !selectedChip || !selectedPlano) {
      toast.error('Selecione cliente, chip e plano');
      return;
    }

    setActivating(true);
    setActivationResult(null);

    try {
      const response = await axios.post(
        `${API_URL}/api/ativacao`,
        {
          cliente_id: selectedCliente,
          chip_id: selectedChip,
          plano_id: selectedPlano
        },
        { withCredentials: true }
      );

      setActivationResult(response.data);

      if (response.data.success) {
        if (response.data.status === 'ativo') {
          toast.success('Linha ativada com sucesso!');
        } else {
          toast.info('Ativação em processamento');
        }
        // Reset form
        setSelectedCliente('');
        setSelectedChip('');
        setSelectedChipData(null);
        setSelectedPlano('');
        // Refresh chips list
        fetchData();
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      const message = error.response?.data?.detail || 'Erro ao ativar linha';
      toast.error(typeof message === 'string' ? message : 'Erro ao ativar linha');
      setActivationResult({
        success: false,
        status: 'erro',
        message: typeof message === 'string' ? message : 'Erro ao ativar linha'
      });
    } finally {
      setActivating(false);
    }
  };

  const getSelectedClienteData = () => {
    return clientes.find(c => c.id === selectedCliente);
  };

  const getSelectedPlanoData = () => {
    return planos.find(p => p.id === selectedPlano);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="ativacoes-page">
      <div>
        <h1 className="page-title flex items-center gap-3">
          <Zap className="w-7 h-7 text-amber-500" />
          Ativação de Linha
        </h1>
        <p className="text-zinc-400 text-sm -mt-4">Ative uma nova linha para o cliente</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activation Form */}
        <div className="dashboard-card">
          <h2 className="section-title mb-6">Nova Ativação</h2>

          <div className="space-y-5">
            {/* Cliente */}
            <div className="space-y-2">
              <Label className="text-zinc-300">1. Selecione o Cliente</Label>
              <Select value={selectedCliente} onValueChange={setSelectedCliente}>
                <SelectTrigger className="form-input" data-testid="select-cliente">
                  <SelectValue placeholder="Escolha um cliente" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 max-h-60">
                  {clientes.length === 0 ? (
                    <SelectItem value="__none__" disabled>Nenhum cliente ativo disponível</SelectItem>
                  ) : (
                    clientes.map((cliente) => (
                      <SelectItem key={cliente.id} value={cliente.id}>
                        {cliente.nome} - CPF: {cliente.cpf}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* ICCID com input inteligente */}
            <div className="space-y-2">
              <Label className="text-zinc-300 flex items-center gap-2">
                <span>2. Digite ou Selecione o ICCID</span>
                <CreditCard className="w-4 h-4 text-zinc-500" />
              </Label>
              <IccidInput
                value={selectedChip}
                onChange={setSelectedChip}
                onChipSelect={setSelectedChipData}
                chips={allChips}
                disabled={activating}
              />
              <p className="text-xs text-zinc-500">
                Digite o ICCID manualmente ou selecione da lista de chips disponíveis
              </p>
            </div>

            {/* Plano */}
            <div className="space-y-2">
              <Label className="text-zinc-300">3. Selecione o Plano</Label>
              <Select value={selectedPlano} onValueChange={setSelectedPlano}>
                <SelectTrigger className="form-input" data-testid="select-plano">
                  <SelectValue placeholder="Escolha um plano" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 max-h-60">
                  {planos.length === 0 ? (
                    <SelectItem value="__none__" disabled>Nenhum plano disponível</SelectItem>
                  ) : (
                    planos.map((plano) => (
                      <SelectItem key={plano.id} value={plano.id}>
                        {plano.nome} - R$ {plano.valor.toFixed(2)} ({plano.franquia})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleActivate}
              disabled={activating || !selectedCliente || !selectedChip || !selectedPlano}
              className="btn-primary w-full h-12 text-base mt-6"
              data-testid="activate-button"
            >
              {activating ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Ativando...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  <span>Ativar Linha</span>
                </div>
              )}
            </Button>
          </div>
        </div>

        {/* Preview / Result */}
        <div className="space-y-4">
          {/* Preview */}
          {(selectedCliente || selectedChip || selectedPlano) && !activationResult && (
            <div className="dashboard-card">
              <h2 className="section-title mb-4">Resumo da Ativação</h2>
              <div className="space-y-3">
                {selectedCliente && (
                  <div className="p-3 bg-zinc-800/50 rounded-sm">
                    <p className="text-xs text-zinc-500 mb-1">Cliente</p>
                    <p className="text-white">
                      {getSelectedClienteData()?.nome} - CPF: {getSelectedClienteData()?.cpf}
                    </p>
                  </div>
                )}
                {selectedChipData && (
                  <div className="p-3 bg-zinc-800/50 rounded-sm">
                    <p className="text-xs text-zinc-500 mb-1">ICCID</p>
                    <p className="text-white font-mono">{selectedChipData.iccid}</p>
                    <p className="text-xs text-emerald-500 mt-1">Status: {selectedChipData.status}</p>
                  </div>
                )}
                {selectedPlano && (
                  <div className="p-3 bg-zinc-800/50 rounded-sm">
                    <p className="text-xs text-zinc-500 mb-1">Plano</p>
                    <p className="text-white">
                      {getSelectedPlanoData()?.nome} - R$ {getSelectedPlanoData()?.valor.toFixed(2)}
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Franquia: {getSelectedPlanoData()?.franquia}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Result */}
          {activationResult && (
            <div 
              className={`dashboard-card border-2 ${
                activationResult.status === 'ativo' 
                  ? 'border-emerald-500/50' 
                  : activationResult.status === 'pendente'
                  ? 'border-amber-500/50'
                  : 'border-red-500/50'
              }`}
              data-testid="activation-result"
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  activationResult.status === 'ativo'
                    ? 'bg-emerald-500/20'
                    : activationResult.status === 'pendente'
                    ? 'bg-amber-500/20'
                    : 'bg-red-500/20'
                }`}>
                  {activationResult.status === 'ativo' ? (
                    <CheckCircle className="w-6 h-6 text-emerald-500" />
                  ) : activationResult.status === 'pendente' ? (
                    <Clock className="w-6 h-6 text-amber-500" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-red-500" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className={`text-lg font-semibold ${
                    activationResult.status === 'ativo'
                      ? 'text-emerald-400'
                      : activationResult.status === 'pendente'
                      ? 'text-amber-400'
                      : 'text-red-400'
                  }`}>
                    {activationResult.status === 'ativo'
                      ? 'Ativação Realizada!'
                      : activationResult.status === 'pendente'
                      ? 'Ativação Pendente'
                      : 'Erro na Ativação'}
                  </h3>
                  <p className="text-zinc-400 mt-1">{activationResult.message}</p>
                  
                  {activationResult.numero && (
                    <div className="mt-4 p-4 bg-zinc-800/50 rounded-sm">
                      <p className="text-xs text-zinc-500 mb-1">Número da Linha</p>
                      <p className="text-2xl font-mono font-bold text-white">
                        {activationResult.numero}
                      </p>
                    </div>
                  )}

                  {activationResult.response_time_ms && (
                    <p className="text-xs text-zinc-600 mt-2">
                      Tempo de resposta: {activationResult.response_time_ms}ms
                    </p>
                  )}
                </div>
              </div>

              <Button
                onClick={() => setActivationResult(null)}
                variant="outline"
                className="btn-secondary mt-4 w-full"
              >
                Nova Ativação
              </Button>
            </div>
          )}

          {/* Info */}
          <div className="dashboard-card bg-blue-500/5 border-blue-500/20">
            <h3 className="text-sm font-semibold text-blue-400 mb-2">Sobre a Ativação</h3>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>• Digite ou cole o ICCID diretamente no campo</li>
              <li>• O sistema valida automaticamente o ICCID</li>
              <li>• Apenas chips com status "disponível" podem ser ativados</li>
              <li>• A ativação é processada via API da operadora</li>
            </ul>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-sm p-3 text-center">
              <p className="text-xl font-bold text-white font-mono">{clientes.length}</p>
              <p className="text-xs text-zinc-500">Clientes Ativos</p>
            </div>
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-sm p-3 text-center">
              <p className="text-xl font-bold text-emerald-400 font-mono">{chips.length}</p>
              <p className="text-xs text-zinc-500">Chips Disponíveis</p>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-sm p-3 text-center">
              <p className="text-xl font-bold text-white font-mono">{planos.length}</p>
              <p className="text-xs text-zinc-500">Planos</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
