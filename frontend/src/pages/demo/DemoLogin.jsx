import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';

const DEMO_AUTH_KEY = 'demo_authed_v1';

/**
 * /demo agora e acesso livre. Marca sessionStorage e redireciona ao dashboard.
 * Mantido como pagina separada para suportar bookmarks antigos.
 */
export default function DemoLogin() {
  useEffect(() => {
    sessionStorage.setItem(DEMO_AUTH_KEY, 'yes');
  }, []);
  return <Navigate to="/demo/dashboard" replace />;
}
