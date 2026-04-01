import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { MainLayout } from "./components/layout/MainLayout";
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

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<MainLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/chips" element={<Chips />} />
            <Route path="/planos" element={<Planos />} />
            <Route path="/ofertas" element={<Ofertas />} />
            <Route path="/ativacoes" element={<Ativacoes />} />
            <Route path="/linhas" element={<Linhas />} />
            <Route path="/carteira" element={<CarteiraMovel />} />
            <Route path="/assinaturas" element={<Assinaturas />} />
            <Route path="/usuarios" element={<Usuarios />} />
            <Route path="/logs" element={<Logs />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
