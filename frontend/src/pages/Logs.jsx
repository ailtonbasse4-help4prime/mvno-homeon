import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { FileText, Filter, Zap, AlertCircle, Lock, Unlock, LogIn, LogOut, UserPlus } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export function Logs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = useCallback(async () => {
    try {
      const params = { limit: 100 };
      if (actionFilter) params.action = actionFilter;
      
      const response = await axios.get(`${API_URL}/api/logs`, {
        params,
        withCredentials: true
      });
      setLogs(response.data);
    } catch (error) {
      toast.error('Erro ao carregar logs');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getActionIcon = (action) => {
    switch (action) {
      case 'ativacao':
        return <Zap className="w-4 h-4 text-emerald-500" />;
      case 'erro':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'bloqueio':
        return <Lock className="w-4 h-4 text-red-400" />;
      case 'desbloqueio':
        return <Unlock className="w-4 h-4 text-blue-400" />;
      case 'login':
        return <LogIn className="w-4 h-4 text-blue-500" />;
      case 'logout':
        return <LogOut className="w-4 h-4 text-zinc-500" />;
      case 'cadastro':
        return <UserPlus className="w-4 h-4 text-purple-500" />;
      default:
        return <FileText className="w-4 h-4 text-zinc-500" />;
    }
  };

  const getActionBadge = (action) => {
    switch (action) {
      case 'ativacao':
        return <span className="badge-active">{action}</span>;
      case 'erro':
        return <span className="badge-blocked">{action}</span>;
      case 'bloqueio':
        return <span className="badge-blocked">{action}</span>;
      case 'desbloqueio':
        return <span className="badge-available">{action}</span>;
      case 'login':
        return <span className="badge-available">{action}</span>;
      case 'logout':
        return <span className="badge-inactive">{action}</span>;
      case 'cadastro':
        return <span className="badge-pending">{action}</span>;
      default:
        return <span className="badge-inactive">{action}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="logs-page">
      <div>
        <h1 className="page-title flex items-center gap-3">
          <FileText className="w-7 h-7 text-zinc-400" />
          Logs do Sistema
        </h1>
        <p className="text-zinc-400 text-sm -mt-4">Histórico de ações e eventos</p>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-500" />
          <span className="text-sm text-zinc-400">Filtrar por ação:</span>
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-48 form-input" data-testid="log-action-filter">
            <SelectValue placeholder="Todas as ações" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="">Todas as ações</SelectItem>
            <SelectItem value="ativacao">Ativação</SelectItem>
            <SelectItem value="bloqueio">Bloqueio</SelectItem>
            <SelectItem value="desbloqueio">Desbloqueio</SelectItem>
            <SelectItem value="cadastro">Cadastro</SelectItem>
            <SelectItem value="login">Login</SelectItem>
            <SelectItem value="logout">Logout</SelectItem>
            <SelectItem value="erro">Erro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Logs List */}
      <div className="dashboard-card">
        <div className="space-y-1">
          {logs.length === 0 ? (
            <div className="text-center text-zinc-500 py-12">
              Nenhum log encontrado
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-4 p-4 hover:bg-zinc-800/30 rounded-sm transition-colors"
                data-testid={`log-entry-${log.id}`}
              >
                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {getActionIcon(log.action)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    {getActionBadge(log.action)}
                    {log.user_name && (
                      <span className="text-sm text-zinc-500">
                        por <span className="text-zinc-300">{log.user_name}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-300 mt-1">{log.details}</p>
                </div>
                
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-zinc-500">
                    {new Date(log.created_at).toLocaleDateString('pt-BR')}
                  </p>
                  <p className="text-xs text-zinc-600">
                    {new Date(log.created_at).toLocaleTimeString('pt-BR')}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
