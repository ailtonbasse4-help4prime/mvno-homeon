import { useState, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

/**
 * useSecureAction - Hook para executar acoes destrutivas com confirmacao de senha.
 * 
 * Retorna:
 *  - executeSecureDelete(url, description): abre modal, confirma senha, executa DELETE
 *  - confirmState: { open, description, onConfirmed }
 *  - closeConfirm: fecha o modal
 */
export function useSecureAction() {
  const [confirmState, setConfirmState] = useState({
    open: false,
    description: '',
    onConfirmed: null,
  });

  const closeConfirm = useCallback(() => {
    setConfirmState({ open: false, description: '', onConfirmed: null });
  }, []);

  const executeSecureDelete = useCallback((url, description) => {
    return new Promise((resolve, reject) => {
      setConfirmState({
        open: true,
        description,
        onConfirmed: async (confirmToken) => {
          try {
            const res = await axios.delete(`${API_URL}${url}`, {
              withCredentials: true,
              headers: { 'X-Confirm-Token': confirmToken },
            });
            setConfirmState({ open: false, description: '', onConfirmed: null });
            resolve(res);
          } catch (error) {
            setConfirmState({ open: false, description: '', onConfirmed: null });
            reject(error);
          }
        },
      });
    });
  }, []);

  return { executeSecureDelete, confirmState, closeConfirm };
}
