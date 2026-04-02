import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { 
  FileText, Filter, Zap, AlertCircle, Lock, Unlock, LogIn, LogOut, 
  UserPlus, Eye, Server, Clock, CheckCircle, XCircle, RefreshCw 
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export function Logs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = useCallback(async () => {
    try {
      const params = { limit: 100 };
      if (actionFilter && actionFilter !== 'all') params.action = actionFilter;
      
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
      case 'api_call':
        return <Server className="w-4 h-4 text-cyan-500" />;
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
      case 'api_call':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            {action}
          </span>
        );
      default:
        return <span className="badge-inactive">{action}</span>;
    }
  };

  const hasApiDetails = (log) => {
    return log.api_request || log.api_response;
  };

  const formatJson = (obj) => {
    if (!obj) return 'N/A';
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <FileText className="w-7 h-7 text-zinc-400" />
            Logs do Sistema
          </h1>
          <p className="text-zinc-400 text-sm -mt-4">Histórico de ações e chamadas de API</p>
        </div>
        <Button
          onClick={fetchLogs}
          variant="outline"
          className="btn-secondary flex items-center gap-2 w-full sm:w-auto"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </Button>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-500" />
          <span className="text-sm text-zinc-400">Filtrar:</span>
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-44 sm:w-48 form-input" data-testid="log-action-filter">
            <SelectValue placeholder="Todas as ações" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="all">Todas as ações</SelectItem>
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

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-sm p-4">
          <p className="text-2xl font-bold text-white font-mono">{logs.length}</p>
          <p className="text-xs text-zinc-500">Total de Logs</p>
        </div>
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-sm p-4">
          <p className="text-2xl font-bold text-emerald-400 font-mono">
            {logs.filter(l => l.action === 'ativacao').length}
          </p>
          <p className="text-xs text-zinc-500">Ativações</p>
        </div>
        <div className="bg-red-500/5 border border-red-500/20 rounded-sm p-4">
          <p className="text-2xl font-bold text-red-400 font-mono">
            {logs.filter(l => l.action === 'erro').length}
          </p>
          <p className="text-xs text-zinc-500">Erros</p>
        </div>
        <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-sm p-4">
          <p className="text-2xl font-bold text-cyan-400 font-mono">
            {logs.filter(l => l.api_request).length}
          </p>
          <p className="text-xs text-zinc-500">Chamadas API</p>
        </div>
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
                className="flex items-start gap-4 p-4 hover:bg-zinc-800/30 rounded-sm transition-colors cursor-pointer"
                onClick={() => {
                  setSelectedLog(log);
                  setDetailDialogOpen(true);
                }}
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
                    {log.is_mock !== null && log.is_mock !== undefined && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${log.is_mock ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'}`}>
                        {log.is_mock ? 'MOCK' : 'REAL'}
                      </span>
                    )}
                    {hasApiDetails(log) && (
                      <span className="text-xs text-cyan-400 flex items-center gap-1">
                        <Server className="w-3 h-3" />
                        API
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-300 mt-1 truncate">{log.details}</p>
                </div>
                
                <div className="text-right flex-shrink-0 flex items-center gap-2">
                  <div>
                    <p className="text-xs text-zinc-500">
                      {new Date(log.created_at).toLocaleDateString('pt-BR')}
                    </p>
                    <p className="text-xs text-zinc-600">
                      {new Date(log.created_at).toLocaleTimeString('pt-BR')}
                    </p>
                  </div>
                  {hasApiDetails(log) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-zinc-500 hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLog(log);
                        setDetailDialogOpen(true);
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-zinc-400" />
              Detalhes do Log
            </DialogTitle>
          </DialogHeader>
          
          {selectedLog && (
            <div className="space-y-4 py-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-zinc-800/50 rounded-sm">
                  <p className="text-xs text-zinc-500 mb-1">Ação</p>
                  {getActionBadge(selectedLog.action)}
                </div>
                <div className="p-3 bg-zinc-800/50 rounded-sm">
                  <p className="text-xs text-zinc-500 mb-1">Data/Hora</p>
                  <p className="text-white text-sm">
                    {new Date(selectedLog.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-zinc-800/50 rounded-sm">
                <p className="text-xs text-zinc-500 mb-1">Detalhes</p>
                <p className="text-white text-sm">{selectedLog.details}</p>
              </div>

              {selectedLog.user_name && (
                <div className="p-3 bg-zinc-800/50 rounded-sm">
                  <p className="text-xs text-zinc-500 mb-1">Usuário</p>
                  <p className="text-white text-sm">{selectedLog.user_name}</p>
                </div>
              )}

              {/* API Request */}
              {selectedLog.api_request && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-semibold text-cyan-400">Requisição API</h3>
                  </div>
                  <div className="p-3 bg-zinc-950 rounded-sm border border-zinc-800">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">
                        {selectedLog.api_request.method}
                      </span>
                      <span className="text-zinc-400 text-sm font-mono">
                        {selectedLog.api_request.endpoint}
                      </span>
                    </div>
                    <pre className="text-xs text-zinc-300 overflow-x-auto whitespace-pre-wrap font-mono">
                      {formatJson(selectedLog.api_request.payload)}
                    </pre>
                  </div>
                </div>
              )}

              {/* API Response */}
              {selectedLog.api_response && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {selectedLog.api_response.success ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                    <h3 className="text-sm font-semibold text-white">Resposta API</h3>
                    {selectedLog.api_response.response_time_ms && (
                      <span className="text-xs text-zinc-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {selectedLog.api_response.response_time_ms}ms
                      </span>
                    )}
                  </div>
                  <div className={`p-3 rounded-sm border ${
                    selectedLog.api_response.success 
                      ? 'bg-emerald-500/5 border-emerald-500/20' 
                      : 'bg-red-500/5 border-red-500/20'
                  }`}>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <p className="text-xs text-zinc-500 mb-1">Status</p>
                        <p className={`text-sm font-medium ${
                          selectedLog.api_response.success ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {selectedLog.api_response.status}
                        </p>
                      </div>
                      {selectedLog.api_response.error_code && (
                        <div>
                          <p className="text-xs text-zinc-500 mb-1">Código de Erro</p>
                          <p className="text-sm font-mono text-red-400">
                            {selectedLog.api_response.error_code}
                          </p>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 mb-1">Mensagem</p>
                      <p className="text-sm text-white">{selectedLog.api_response.message}</p>
                    </div>
                    {selectedLog.api_response.raw_response && (
                      <div className="mt-3 pt-3 border-t border-zinc-800">
                        <p className="text-xs text-zinc-500 mb-1">Resposta Bruta</p>
                        <pre className="text-xs text-zinc-400 overflow-x-auto whitespace-pre-wrap font-mono">
                          {selectedLog.api_response.raw_response}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Mock indicator */}
              {selectedLog.is_mock !== null && selectedLog.is_mock !== undefined && (
                <div className={`p-3 rounded-sm ${
                  selectedLog.is_mock 
                    ? 'bg-amber-500/10 border border-amber-500/20' 
                    : 'bg-blue-500/10 border border-blue-500/20'
                }`}>
                  <p className={`text-sm ${selectedLog.is_mock ? 'text-amber-400' : 'text-blue-400'}`}>
                    {selectedLog.is_mock 
                      ? '⚠️ Esta chamada foi simulada (MOCK). Dados não são reais.' 
                      : '✓ Esta chamada foi realizada com a API real da operadora.'}
                  </p>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setDetailDialogOpen(false)} className="btn-secondary">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
