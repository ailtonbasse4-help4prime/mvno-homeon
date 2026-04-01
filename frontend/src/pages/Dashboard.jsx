import { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, CreditCard, Package, Tag, Phone, Zap, AlertCircle, CheckCircle, Clock, Wifi, WifiOff } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/dashboard/stats`, {
        withCredentials: true
      });
      setStats(response.data);
    } catch (err) {
      setError('Erro ao carregar estatísticas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-sm">
        {error}
      </div>
    );
  }

  const StatCard = ({ icon: Icon, label, value, subValue, color = 'blue' }) => (
    <div className="stat-card animate-fade-in" data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="stat-value">{value}</p>
          <p className="stat-label">{label}</p>
          {subValue && (
            <p className="text-xs text-zinc-500 mt-1">{subValue}</p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-sm bg-${color}-500/10 flex items-center justify-center`}>
          <Icon className={`w-5 h-5 text-${color}-500`} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-zinc-400 text-sm -mt-4">Visao geral do sistema MVNO</p>
        </div>
        {/* Indicador Mock/Real */}
        {stats?.operadora && (
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-sm border text-sm font-medium ${
              stats.operadora.mode === 'real'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}
            data-testid="operadora-mode-indicator"
          >
            {stats.operadora.mode === 'real' ? (
              <><Wifi className="w-4 h-4" />API REAL</>
            ) : (
              <><WifiOff className="w-4 h-4" />MODO MOCK</>
            )}
          </div>
        )}
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          icon={Users}
          label="Total de Clientes"
          value={stats?.clientes?.total || 0}
          subValue={`${stats?.clientes?.ativos || 0} ativos`}
          color="blue"
        />
        <StatCard
          icon={CreditCard}
          label="Total de Chips"
          value={stats?.chips?.total || 0}
          subValue={`${stats?.chips?.disponiveis || 0} disponíveis`}
          color="emerald"
        />
        <StatCard
          icon={Phone}
          label="Linhas Ativas"
          value={stats?.linhas?.ativas || 0}
          subValue={`${stats?.linhas?.total || 0} total`}
          color="purple"
        />
        <StatCard
          icon={Package}
          label="Planos"
          value={stats?.planos?.total || 0}
          color="amber"
        />
        <StatCard
          icon={Tag}
          label="Ofertas Ativas"
          value={stats?.ofertas?.ativas || 0}
          subValue={`${stats?.ofertas?.total || 0} total`}
          color="blue"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chips Status */}
        <div className="dashboard-card">
          <h2 className="section-title flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-500" />
            Status dos Chips
          </h2>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="text-center p-4 bg-zinc-800/50 rounded-sm">
              <p className="text-2xl font-mono font-bold text-blue-400">{stats?.chips?.disponiveis || 0}</p>
              <p className="text-xs text-zinc-400 mt-1">Disponíveis</p>
            </div>
            <div className="text-center p-4 bg-zinc-800/50 rounded-sm">
              <p className="text-2xl font-mono font-bold text-emerald-400">{stats?.chips?.ativados || 0}</p>
              <p className="text-xs text-zinc-400 mt-1">Ativados</p>
            </div>
            <div className="text-center p-4 bg-zinc-800/50 rounded-sm">
              <p className="text-2xl font-mono font-bold text-red-400">{stats?.chips?.bloqueados || 0}</p>
              <p className="text-xs text-zinc-400 mt-1">Bloqueados</p>
            </div>
          </div>
        </div>

        {/* Lines Status */}
        <div className="dashboard-card">
          <h2 className="section-title flex items-center gap-2">
            <Phone className="w-5 h-5 text-purple-500" />
            Status das Linhas
          </h2>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="text-center p-4 bg-zinc-800/50 rounded-sm">
              <div className="flex items-center justify-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-mono font-bold text-emerald-400">{stats?.linhas?.ativas || 0}</p>
              <p className="text-xs text-zinc-400 mt-1">Ativas</p>
            </div>
            <div className="text-center p-4 bg-zinc-800/50 rounded-sm">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl font-mono font-bold text-amber-400">{stats?.linhas?.pendentes || 0}</p>
              <p className="text-xs text-zinc-400 mt-1">Pendentes</p>
            </div>
            <div className="text-center p-4 bg-zinc-800/50 rounded-sm">
              <div className="flex items-center justify-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
              </div>
              <p className="text-2xl font-mono font-bold text-red-400">{stats?.linhas?.bloqueadas || 0}</p>
              <p className="text-xs text-zinc-400 mt-1">Bloqueadas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="dashboard-card">
        <h2 className="section-title flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" />
          Atividade Recente
        </h2>
        
        {stats?.recent_logs?.length > 0 ? (
          <div className="space-y-3 mt-4">
            {stats.recent_logs.map((log, index) => (
              <div 
                key={log.id || index} 
                className="flex items-start gap-3 p-3 bg-zinc-800/30 rounded-sm"
              >
                <div className={`w-2 h-2 rounded-full mt-2 ${
                  log.action === 'ativacao' ? 'bg-emerald-500' :
                  log.action === 'erro' ? 'bg-red-500' :
                  log.action === 'bloqueio' ? 'bg-red-400' :
                  log.action === 'desbloqueio' ? 'bg-blue-500' :
                  'bg-zinc-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-300 truncate">{log.details}</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    {new Date(log.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-sm ${
                  log.action === 'ativacao' ? 'badge-active' :
                  log.action === 'erro' ? 'badge-blocked' :
                  log.action === 'bloqueio' ? 'badge-blocked' :
                  log.action === 'desbloqueio' ? 'badge-active' :
                  'badge-pending'
                }`}>
                  {log.action}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-zinc-500 text-sm mt-4">Nenhuma atividade recente</p>
        )}
      </div>
    </div>
  );
}
