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
import PlanilhaOperacional from "./pages/PlanilhaOperacional";
import Custos from "./pages/Custos";
import DemoAcessos from "./pages/DemoAcessos";
import AutomacaoBloqueio from "./pages/AutomacaoBloqueio";
import QrLotes from "./pages/QrLotes";
import ChipLanding from "./pages/ChipLanding";
import Homeon from "./pages/Homeon";
import Help4Prime from "./pages/Help4Prime";
import DemoLogin from "./pages/demo/DemoLogin";
import DemoLayout from "./pages/demo/DemoLayout";
import DemoDashboard from "./pages/demo/DemoDashboard";
import DemoPlanilha from "./pages/demo/DemoPlanilha";
import DemoCobrancas from "./pages/demo/DemoCobrancas";
import DemoCustos from "./pages/demo/DemoCustos";
import DemoAtivacoesReais from "./pages/demo/DemoAtivacoesReais";
import DemoLinhasReais from "./pages/demo/DemoLinhasReais";
import DemoClientesReais from "./pages/demo/DemoClientesReais";
import DemoChipsReais from "./pages/demo/DemoChipsReais";
import DemoPlanosReais from "./pages/demo/DemoPlanosReais";
import DemoOfertasReais from "./pages/demo/DemoOfertasReais";
import {
  DemoCarteira, DemoAssinaturas,
  DemoRevendedores, DemoSelfService, DemoDivulgacao,
  DemoUsuarios, DemoLogs,
} from "./pages/demo/DemoPlaceholders";

function AppRoutes() {
  const location = useLocation();
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/saas" element={<LandingPage />} />
      <Route path="/homeon" element={<ErrorBoundary resetKey={location.pathname}><Homeon /></ErrorBoundary>} />
      <Route path="/help4prime" element={<ErrorBoundary resetKey={location.pathname}><Help4Prime /></ErrorBoundary>} />
      <Route path="/ativar" element={<ErrorBoundary resetKey={location.pathname}><AtivarSelfService /></ErrorBoundary>} />
      <Route path="/chip/:iccid" element={<ErrorBoundary resetKey={location.pathname}><ChipLanding /></ErrorBoundary>} />
      <Route path="/portal" element={<ErrorBoundary resetKey={location.pathname}><PortalLogin /></ErrorBoundary>} />
      <Route path="/portal/dashboard" element={<ErrorBoundary resetKey={location.pathname}><PortalDashboard /></ErrorBoundary>} />
      {/* Demo publica (sem auth) */}
      <Route path="/demo" element={<ErrorBoundary resetKey={location.pathname}><DemoLogin /></ErrorBoundary>} />
      <Route element={<DemoLayout />}>
        <Route path="/demo/dashboard" element={<DemoDashboard />} />
        <Route path="/demo/operacional" element={<DemoPlanilha />} />
        <Route path="/demo/cobrancas" element={<DemoCobrancas />} />
        <Route path="/demo/custos" element={<DemoCustos />} />
        {/* Placeholders com destaque de diferenciais */}
        <Route path="/demo/ativacoes" element={<DemoAtivacoesReais />} />
        <Route path="/demo/linhas" element={<DemoLinhasReais />} />
        <Route path="/demo/clientes" element={<DemoClientesReais />} />
        <Route path="/demo/chips" element={<DemoChipsReais />} />
        <Route path="/demo/carteira" element={<DemoCarteira />} />
        <Route path="/demo/assinaturas" element={<DemoAssinaturas />} />
        <Route path="/demo/planos" element={<DemoPlanosReais />} />
        <Route path="/demo/ofertas" element={<DemoOfertasReais />} />
        <Route path="/demo/revendedores" element={<DemoRevendedores />} />
        <Route path="/demo/self-service" element={<DemoSelfService />} />
        <Route path="/demo/divulgacao" element={<DemoDivulgacao />} />
        <Route path="/demo/usuarios" element={<DemoUsuarios />} />
        <Route path="/demo/logs" element={<DemoLogs />} />
      </Route>
      <Route element={<MainLayout />}>
        <Route path="/" element={<ErrorBoundary resetKey={location.pathname}><Dashboard /></ErrorBoundary>} />
        <Route path="/operacional" element={<ErrorBoundary resetKey={location.pathname}><PlanilhaOperacional /></ErrorBoundary>} />
        <Route path="/custos" element={<ErrorBoundary resetKey={location.pathname}><Custos /></ErrorBoundary>} />
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
        <Route path="/demo-acessos" element={<ErrorBoundary resetKey={location.pathname}><DemoAcessos /></ErrorBoundary>} />
        <Route path="/automacao-bloqueio" element={<ErrorBoundary resetKey={location.pathname}><AutomacaoBloqueio /></ErrorBoundary>} />
        <Route path="/qr-lotes" element={<ErrorBoundary resetKey={location.pathname}><QrLotes /></ErrorBoundary>} />
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
