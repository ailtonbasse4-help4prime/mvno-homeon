import { useState } from 'react';
import axios from 'axios';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from './ui/dialog';
import { toast } from 'sonner';
import { ShieldAlert } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

/**
 * ConfirmPasswordDialog - Modal de confirmacao de senha para acoes destrutivas.
 * 
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - onConfirmed: (confirmToken: string) => void
 *  - actionDescription: string (ex: "Remover cliente Fulano")
 */
export function ConfirmPasswordDialog({ open, onClose, onConfirmed, actionDescription }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!password) {
      toast.error('Digite sua senha');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/auth/confirm-password`, { password }, { withCredentials: true });
      if (res.data.confirmed && res.data.confirm_token) {
        onConfirmed(res.data.confirm_token);
        setPassword('');
      }
    } catch (error) {
      const msg = error.response?.data?.detail || 'Senha incorreta';
      toast.error(typeof msg === 'string' ? msg : 'Erro na confirmacao');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md" data-testid="confirm-password-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-400">
            <ShieldAlert className="w-5 h-5" />
            Confirmacao de Seguranca
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-zinc-400">
            Para executar esta acao, confirme sua senha:
          </p>
          {actionDescription && (
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
              <p className="text-sm text-zinc-300 font-medium">{actionDescription}</p>
            </div>
          )}
          <div>
            <Label htmlFor="confirm-pwd" className="text-zinc-300">Sua senha</Label>
            <Input
              id="confirm-pwd"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
              placeholder="Digite sua senha..."
              className="form-input mt-1"
              autoFocus
              data-testid="confirm-password-input"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} className="border-zinc-700" data-testid="confirm-cancel-btn">
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={loading} className="bg-amber-600 hover:bg-amber-700" data-testid="confirm-submit-btn">
            {loading ? 'Verificando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
