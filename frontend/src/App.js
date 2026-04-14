import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { MainLayout } from "./components/layout/MainLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Clientes } from "./pages/Clientes";
import { Chips } from "./pages/Chips";
import { Planos } from "./pages/Planos";
import { Ofertas } from "./pages/Ofertas";
import { Ativacoes } from "./pages/Ativacoes";
import { Linhas } from "./pages/Linhas";
import { Logs } from "./pages/Logs";
import { Usuarios } from "./pages/Usuarios";
import { CarteiraMovel } from "./pages/CarteiraMovel";
import { Assinaturas } from "./pages/Assinaturas";
import { GestaoCobrancas } from "./pages/GestaoCobrancas";
import { Revendedores } from "./pages/Revendedores";
import { AtivacoesSelfService } from "./pages/AtivacoesSelfService";
import AtivarSelfService from "./pages/AtivarSelfService";
import PortalLogin from "./pages/PortalLogin";
import PortalDashboard from "./pages/PortalDashboard";
import Divulgacao from "./pages/Divulgacao";
import LandingPage from "./pages/LandingPage";

function AppRoutes() {
  const location = useLocation();
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/saas" element={<LandingPage />} />
      <Route path="/ativar" element={<ErrorBoundary resetKey={location.pathname}><AtivarSelfService /></ErrorBoundary>} />
      <Route path="/portal" element={<ErrorBoundary resetKey={location.pathname}><PortalLogin /></ErrorBoundary>} />
      <Route path="/portal/dashboard" element={<ErrorBoundary resetKey={location.pathname}><PortalDashboard /></ErrorBoundary>} />
      <Route element={<MainLayout />}>
        <Route path="/" element={<ErrorBoundary resetKey={location.pathname}><Dashboard /></ErrorBoundary>} />
        <Route path="/clientes" element={<ErrorBoundary resetKey={location.pathname}><Clientes /></ErrorBoundary>} />
        <Route path="/chips" element={<ErrorBoundary resetKey={location.pathname}><Chips /></ErrorBoundary>} />
        <Route path="/planos" element={<ErrorBoundary resetKey={location.pathname}><Planos /></ErrorBoundary>} />
        <Route path="/ofertas" element={<ErrorBoundary resetKey={location.pathname}><Ofertas /></ErrorBoundary>} />
        <Route path="/ativacoes" element={<ErrorBoundary resetKey={location.pathname}><Ativacoes /></ErrorBoundary>} />
        <Route path="/linhas" element={<ErrorBoundary resetKey={location.pathname}><Linhas /></ErrorBoundary>} />
        <Route path="/carteira" element={<ErrorBoundary resetKey={location.pathname}><CarteiraMovel /></ErrorBoundary>} />
        <Route path="/cobrancas" element={<ErrorBoundary resetKey={location.pathname}><GestaoCobrancas /></ErrorBoundary>} />
        <Route path="/assinaturas" element={<ErrorBoundary resetKey={location.pathname}><Assinaturas /></ErrorBoundary>} />
        <Route path="/revendedores" element={<ErrorBoundary resetKey={location.pathname}><Revendedores /></ErrorBoundary>} />
        <Route path="/ativacoes-selfservice" element={<ErrorBoundary resetKey={location.pathname}><AtivacoesSelfService /></ErrorBoundary>} />
        <Route path="/divulgacao" element={<ErrorBoundary resetKey={location.pathname}><Divulgacao /></ErrorBoundary>} />
        <Route path="/usuarios" element={<ErrorBoundary resetKey={location.pathname}><Usuarios /></ErrorBoundary>} />
        <Route path="/logs" element={<ErrorBoundary resetKey={location.pathname}><Logs /></ErrorBoundary>} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
