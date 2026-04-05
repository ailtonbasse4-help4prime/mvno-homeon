import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/ativar" element={<ErrorBoundary><AtivarSelfService /></ErrorBoundary>} />
          <Route path="/portal" element={<ErrorBoundary><PortalLogin /></ErrorBoundary>} />
          <Route path="/portal/dashboard" element={<ErrorBoundary><PortalDashboard /></ErrorBoundary>} />
          <Route element={<MainLayout />}>
            <Route path="/" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
            <Route path="/clientes" element={<ErrorBoundary><Clientes /></ErrorBoundary>} />
            <Route path="/chips" element={<ErrorBoundary><Chips /></ErrorBoundary>} />
            <Route path="/planos" element={<ErrorBoundary><Planos /></ErrorBoundary>} />
            <Route path="/ofertas" element={<ErrorBoundary><Ofertas /></ErrorBoundary>} />
            <Route path="/ativacoes" element={<ErrorBoundary><Ativacoes /></ErrorBoundary>} />
            <Route path="/linhas" element={<ErrorBoundary><Linhas /></ErrorBoundary>} />
            <Route path="/carteira" element={<ErrorBoundary><CarteiraMovel /></ErrorBoundary>} />
            <Route path="/cobrancas" element={<ErrorBoundary><GestaoCobrancas /></ErrorBoundary>} />
            <Route path="/assinaturas" element={<ErrorBoundary><Assinaturas /></ErrorBoundary>} />
            <Route path="/revendedores" element={<ErrorBoundary><Revendedores /></ErrorBoundary>} />
            <Route path="/ativacoes-selfservice" element={<ErrorBoundary><AtivacoesSelfService /></ErrorBoundary>} />
            <Route path="/usuarios" element={<ErrorBoundary><Usuarios /></ErrorBoundary>} />
            <Route path="/logs" element={<ErrorBoundary><Logs /></ErrorBoundary>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
