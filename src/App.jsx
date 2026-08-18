import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  LogIn, LogOut, LayoutDashboard, Building2, ClipboardList, BarChart3, Bell,
  FileDown, QrCode, Camera, Image as ImageIcon, CheckCircle2, AlertTriangle,
  XCircle, Search, Plus, Trash2, Pencil, User, Users, ChevronRight, X,
  MapPin, Clock, Calendar, Filter, Printer, Sheet, ClipboardCheck, ScanLine,
  ArrowLeft, Loader2, Inbox, UserPlus, KeyRound, ShieldCheck, Copy, Check, Sparkles, Sun, Moon,
  MessageCircle, Send, AlertCircle, Settings, Menu, ChevronDown, Gauge, Activity, CircleUserRound,
  Eye
} from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, LineChart, Line
} from "recharts";
import * as XLSX from "xlsx";
import { gerarQrDataUrl, linkDoAmbiente } from "./qr";
import { gerarPdfTodosQrCodes } from "./qrPdf";
import {
  fetchUsers, createUser, updateUser, deleteUser,
  fetchAmbientes, createAmbiente, updateAmbiente, deleteAmbiente,
  fetchInspecoes, createInspecao, updateInspecao, deleteInspecao, uploadFotoInspecao,
  fetchNotificacoes, createNotificacao, markNotificacaoLida, deleteNotificacao,
  gerarResumoIA, enviarEmailNotificacao, enviarMensagemChat,
} from "./api";

/* ----------------------------- constantes ----------------------------- */

const TIPOS_AMBIENTE = [
  "Sala de aula", "Laboratório", "Biblioteca", "Banheiro", "Auditório",
  "Coordenação", "Secretaria", "Corredor", "Área comum",
];

const STATUS = {
  limpo: { label: "Limpo", icon: CheckCircle2 },
  parcial: { label: "Limpeza Parcial", icon: AlertTriangle },
  nao_limpo: { label: "Não Limpo", icon: XCircle },
};

function statusStyle(status) {
  switch (status) {
    case "limpo":
      return { bg: "bg-emerald-50 dark:bg-emerald-950", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800", dot: "bg-emerald-500", chip: "bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200" };
    case "parcial":
      return { bg: "bg-amber-50 dark:bg-amber-950", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800", dot: "bg-amber-500", chip: "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200" };
    case "nao_limpo":
      return { bg: "bg-red-50 dark:bg-red-950", text: "text-red-700 dark:text-red-300", border: "border-red-200 dark:border-red-800", dot: "bg-red-500", chip: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200" };
    default:
      return { bg: "bg-gray-50 dark:bg-gray-800", text: "text-gray-700 dark:text-gray-200", border: "border-gray-200 dark:border-gray-700", dot: "bg-gray-400", chip: "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100" };
  }
}

function pad(n) { return String(n).padStart(2, "0"); }
function nowParts() {
  const d = new Date();
  return {
    data: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
    hora: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    iso: d.toISOString(),
    dataKey: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
  };
}

function resizeImage(file, maxWidth = 900) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function tempoRelativo(isoStr) {
  const diffMs = Date.now() - new Date(isoStr).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} minuto${min === 1 ? "" : "s"}`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} hora${h === 1 ? "" : "s"}`;
  const d = Math.floor(h / 24);
  return `há ${d} dia${d === 1 ? "" : "s"}`;
}

const SESSION_KEY = "rondalimpa_session";
const THEME_KEY = "rondalimpa_theme";

// Nome da unidade exibido no topo do sistema. Como o ZELO atende só uma
// unidade por enquanto, isso é só uma constante de exibição — não existe
// estrutura de múltiplas unidades no banco nem na interface.
const NOME_UNIDADE = "Estácio";

function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === "dark" ? "light" : "dark"));
  return [theme, toggleTheme];
}

function ThemeToggle({ theme, onToggle, className = "" }) {
  return (
    <button
      onClick={onToggle}
      title={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
      className={`flex items-center justify-center rounded-lg p-1.5 transition-colors ${className}`}
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

/* -------------------------------- app ----------------------------------- */

export default function App() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [theme, toggleTheme] = useTheme();
  const [users, setUsers] = useState([]);
  const [ambientes, setAmbientes] = useState([]);
  const [inspecoes, setInspecoes] = useState([]);
  const [notificacoes, setNotificacoes] = useState([]);
  const [tab, setTab] = useState("dashboard");
  const [erroCarregamento, setErroCarregamento] = useState("");
  const [urlAmbienteId, setUrlAmbienteId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("ambiente");
  });
  const clearUrlAmbiente = () => {
    setUrlAmbienteId(null);
    window.history.replaceState({}, "", window.location.pathname);
  };

  const reload = useCallback(async () => {
    try {
      const [u, a, i, n] = await Promise.all([
        fetchUsers(), fetchAmbientes(), fetchInspecoes(), fetchNotificacoes(),
      ]);
      setUsers(u);
      setAmbientes(a);
      setInspecoes(i);
      setNotificacoes(n);
      setErroCarregamento("");
    } catch (e) {
      console.error(e);
      setErroCarregamento(
        "Não foi possível conectar ao Supabase. Confira se VITE_SUPABASE_URL e " +
        "VITE_SUPABASE_ANON_KEY estão configurados e se o schema.sql foi executado."
      );
    }
  }, []);

  useEffect(() => {
    (async () => {
      await reload();
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        try { setCurrentUser(JSON.parse(saved)); } catch { /* ignora */ }
      }
      setLoading(false);
    })();
  }, [reload]);

  useEffect(() => {
    setTab(currentUser?.perfil === "inspetor" ? "ronda" : "dashboard");
  }, [currentUser]);

  const handleLogin = (u) => {
    setCurrentUser(u);
    localStorage.setItem(SESSION_KEY, JSON.stringify(u));
  };
  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem(SESSION_KEY);
  };

  if (loading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-blue-700" size={28} />
      </div>
    );
  }

  if (erroCarregamento) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-6">
        <div className="bg-white dark:bg-gray-800 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <AlertTriangle className="mx-auto text-red-500 mb-2" size={28} />
          <p className="text-sm text-gray-700 dark:text-gray-200">{erroCarregamento}</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen users={users} onLogin={handleLogin} onUsersChange={reload} theme={theme} toggleTheme={toggleTheme} />;
  }

  const isAdmin = currentUser.perfil === "administrador";

  if (!isAdmin) {
    // Fluxo do inspetor: mantém a navegação simples em abas no topo, pensada
    // pra uso no celular em campo — a sidebar corporativa é só pro admin.
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col font-sans">
        <header className="no-print bg-blue-800 text-white sticky top-0 z-20 shadow-md">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-white/15 rounded-lg p-1.5"><ShieldCheck size={20} /></div>
              <div>
                <div className="font-display font-bold text-[15px] leading-tight tracking-tight">ZELO</div>
                <div className="text-[11px] text-blue-200 leading-tight">{NOME_UNIDADE}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle theme={theme} onToggle={toggleTheme} className="bg-blue-700 hover:bg-blue-600 text-white" />
              <div className="hidden sm:flex flex-col items-end leading-tight">
                <span className="text-sm font-medium">{currentUser.nome}</span>
                <span className="text-[11px] text-blue-200 capitalize">{currentUser.perfil}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-600 transition-colors rounded-lg px-3 py-1.5 text-sm font-medium"
              >
                <LogOut size={15} /> Sair
              </button>
            </div>
          </div>
          <nav className="max-w-6xl mx-auto px-2 flex gap-1 overflow-x-auto">
            <NavBtn active={tab === "ronda"} onClick={() => setTab("ronda")} icon={ScanLine} label="Ronda" />
            <NavBtn active={tab === "minhas"} onClick={() => setTab("minhas")} icon={ClipboardList} label="Minhas Inspeções" />
          </nav>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-5">
          {tab === "ronda" && (
            <Ronda
              ambientes={ambientes}
              currentUser={currentUser}
              onSaved={reload}
              directAmbiente={urlAmbienteId ? ambientes.find(a => a.id === urlAmbienteId) : null}
              onClearDirect={clearUrlAmbiente}
              adminEmails={users.filter(u => u.perfil === "administrador").map(u => u.email)}
            />
          )}
          {tab === "minhas" && <InspecoesHistorico ambientes={ambientes} inspecoes={inspecoes.filter(i => i.inspetorId === currentUser.id)} users={users} minimalFilters onChange={reload} />}
        </main>

        <footer className="no-print text-center text-[11px] text-gray-400 dark:text-gray-500 py-3">ZELO · Estácio</footer>
      </div>
    );
  }

  // Fluxo do administrador: portal corporativo com sidebar fixa.
  return (
    <AdminShell
      currentUser={currentUser}
      onLogout={handleLogout}
      theme={theme}
      toggleTheme={toggleTheme}
      tab={tab}
      setTab={setTab}
      ocorrenciasAbertas={notificacoes.filter(n => !n.lida).length}
    >
      {tab === "dashboard" && <Dashboard ambientes={ambientes} inspecoes={inspecoes} currentUser={currentUser} />}
      {tab === "ambientes" && <AmbientesManager ambientes={ambientes} inspecoes={inspecoes} onChange={reload} />}
      {tab === "inspecoes" && <InspecoesHistorico ambientes={ambientes} inspecoes={inspecoes} users={users} onChange={reload} />}
      {tab === "ocorrencias" && <Ocorrencias notificacoes={notificacoes} onChange={reload} />}
      {tab === "relatorios" && <Relatorios ambientes={ambientes} inspecoes={inspecoes} />}
      {tab === "usuarios" && <UsuariosManager users={users} currentUser={currentUser} onChange={reload} />}
      {tab === "configuracoes" && <Configuracoes theme={theme} toggleTheme={toggleTheme} />}

      <ChatIA ambientes={ambientes} inspecoes={inspecoes} users={users} />
    </AdminShell>
  );
}

/* ------------------------------ layout admin (sidebar + topbar) --------------------------- */

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "ambientes", label: "Ambientes", icon: Building2 },
  { key: "inspecoes", label: "Inspeções", icon: ClipboardList },
  { key: "ocorrencias", label: "Ocorrências", icon: AlertCircle },
  { key: "relatorios", label: "Relatórios", icon: FileDown },
];

function AdminShell({ currentUser, onLogout, theme, toggleTheme, tab, setTab, ocorrenciasAbertas, children }) {
  const [sidebarAberta, setSidebarAberta] = useState(false);
  const [menuUsuario, setMenuUsuario] = useState(false);
  const iniciais = currentUser.nome.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase();

  const irPara = (key) => { setTab(key); setSidebarAberta(false); };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans flex">
      {/* sidebar */}
      <aside className={`no-print fixed lg:static inset-y-0 left-0 z-40 w-64 shrink-0 bg-slate-900 text-slate-200 flex flex-col transition-transform duration-200 ${sidebarAberta ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="bg-cyan-500/15 text-cyan-400 rounded-lg p-2"><ShieldCheck size={20} /></div>
          <div>
            <div className="font-display font-bold text-white text-[15px] leading-tight tracking-tight">ZELO</div>
            <div className="text-[11px] text-slate-400 leading-tight">Estácio</div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-0.5 mt-2">
          {NAV_ITEMS.map(item => {
            const active = tab === item.key;
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => irPara(item.key)}
                className={`relative w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                }`}
              >
                {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-cyan-400" />}
                <Icon size={17} />
                {item.label}
                {item.key === "ocorrencias" && ocorrenciasAbertas > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full h-[18px] min-w-[18px] px-1 flex items-center justify-center">{ocorrenciasAbertas}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="px-3 pb-4 pt-2 border-t border-slate-800 space-y-0.5">
          <button
            onClick={() => irPara("usuarios")}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === "usuarios" ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"}`}
          >
            <Users size={17} /> Usuários
          </button>
          <button
            onClick={() => irPara("configuracoes")}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === "configuracoes" ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"}`}
          >
            <Settings size={17} /> Configurações
          </button>
        </div>
      </aside>

      {sidebarAberta && <div className="lg:hidden fixed inset-0 bg-black/40 z-30" onClick={() => setSidebarAberta(false)} />}

      {/* conteúdo */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="no-print sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between px-4 lg:px-6 py-3">
            <div className="flex items-center gap-3">
              <button className="lg:hidden text-gray-500 dark:text-gray-400" onClick={() => setSidebarAberta(true)}><Menu size={22} /></button>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-full px-3 py-1">
                Unidade: {NOME_UNIDADE}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle theme={theme} onToggle={toggleTheme} className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" />
              <button
                onClick={() => irPara("ocorrencias")}
                className="relative flex items-center justify-center rounded-lg p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                title="Ocorrências"
              >
                <Bell size={17} />
                {ocorrenciasAbertas > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{ocorrenciasAbertas}</span>
                )}
              </button>

              <div className="relative">
                <button onClick={() => setMenuUsuario(v => !v)} className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                  <span className="w-8 h-8 rounded-full bg-blue-700 text-white text-xs font-bold flex items-center justify-center shrink-0">{iniciais}</span>
                  <span className="hidden sm:flex flex-col items-start leading-tight">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{currentUser.nome}</span>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500 capitalize">{currentUser.perfil}</span>
                  </span>
                  <ChevronDown size={14} className="text-gray-400 dark:text-gray-500" />
                </button>
                {menuUsuario && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setMenuUsuario(false)} />
                    <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-lg py-1.5 z-40">
                      <button onClick={() => { irPara("configuracoes"); setMenuUsuario(false); }} className="w-full flex items-center gap-2 px-3.5 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                        <CircleUserRound size={15} /> Perfil
                      </button>
                      <button onClick={onLogout} className="w-full flex items-center gap-2 px-3.5 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700">
                        <LogOut size={15} /> Sair
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-6 py-6">
          {children}
        </main>

        <footer className="no-print text-center text-[11px] text-gray-400 dark:text-gray-500 py-4">ZELO · {NOME_UNIDADE} · Gestão e qualidade dos ambientes</footer>
      </div>
    </div>
  );
}

function NavBtn({ active, onClick, icon: Icon, label, badge }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
        active ? "border-white text-white" : "border-transparent text-blue-200 hover:text-white"
      }`}
    >
      <Icon size={16} /> {label}
      {badge > 0 && (
        <span className="ml-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );
}

/* ------------------------------ login ----------------------------------- */

function LoginScreen({ users, onLogin, onUsersChange, theme, toggleTheme }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [err, setErr] = useState("");

  // Configuração inicial: só aparece quando ainda não existe NENHUM usuário no banco.
  // Depois que o primeiro administrador é criado, o cadastro público some — só o
  // administrador cria novos acessos, na tela "Usuários".
  const precisaConfigurarPrimeiroAdmin = users.length === 0;

  const handleEntrar = async (e) => {
    e.preventDefault();
    setErr("");
    const u = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!u || u.senha !== senha) { setErr("E-mail ou senha inválidos."); return; }
    onLogin(u);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4 font-sans relative">
      <ThemeToggle theme={theme} onToggle={toggleTheme} className="absolute top-4 right-4 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" />
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-700 text-white mb-3">
            <ShieldCheck size={26} />
          </div>
          <h1 className="font-display font-extrabold text-2xl tracking-tight text-gray-900 dark:text-white">ZELO</h1>
          <p className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 tracking-wide uppercase mt-0.5">Estácio</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">Gestão e qualidade dos ambientes</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          {precisaConfigurarPrimeiroAdmin ? (
            <ConfiguracaoInicial onUsersChange={onUsersChange} onLogin={onLogin} />
          ) : (
            <form onSubmit={handleEntrar} className="space-y-3">
              <Field label="E-mail"><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input" placeholder="seu@email.com" required /></Field>
              <Field label="Senha"><input type="password" value={senha} onChange={e => setSenha(e.target.value)} className="input" placeholder="••••••" required /></Field>
              {err && <p className="text-red-600 text-xs font-medium">{err}</p>}
              <button className="btn-primary w-full mt-1"><LogIn size={16} /> Entrar</button>
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center pt-1">Não tem acesso? Peça ao administrador para criar seu usuário.</p>
            </form>
          )}
        </div>
        <p className="text-center text-[11px] text-gray-400 dark:text-gray-600 mt-5">Unidade: {NOME_UNIDADE}</p>
      </div>
    </div>
  );
}

function ConfiguracaoInicial({ onUsersChange, onLogin }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const criar = async (e) => {
    e.preventDefault();
    setErr("");
    if (!nome.trim() || !email.trim() || !senha) { setErr("Preencha todos os campos."); return; }
    setBusy(true);
    try {
      const novo = await createUser({ nome: nome.trim(), email: email.trim(), senha, perfil: "administrador" });
      await onUsersChange();
      onLogin(novo);
    } catch (e) {
      setErr("Não foi possível criar o administrador. " + (e.message || ""));
    }
    setBusy(false);
  };

  return (
    <form onSubmit={criar} className="space-y-3">
      <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-300 rounded-lg px-3 py-2 mb-1">
        <ShieldCheck size={16} className="shrink-0" />
        <p className="text-xs font-medium">Primeiro acesso: crie sua conta de administrador. Depois disso, só você cria os acessos dos inspetores.</p>
      </div>
      <Field label="Seu nome"><input value={nome} onChange={e => setNome(e.target.value)} className="input" placeholder="Seu nome completo" required /></Field>
      <Field label="E-mail"><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input" placeholder="seu@email.com" required /></Field>
      <Field label="Senha"><input type="password" value={senha} onChange={e => setSenha(e.target.value)} className="input" placeholder="Crie uma senha" required /></Field>
      {err && <p className="text-red-600 text-xs font-medium">{err}</p>}
      <button disabled={busy} className="btn-primary w-full mt-1">{busy ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />} Criar administrador e entrar</button>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{label}</span>
      {children}
    </label>
  );
}

/* ----------------------------- dashboard --------------------------------- */

function Dashboard({ ambientes, inspecoes, currentUser }) {
  const [periodo, setPeriodo] = useState("hoje");
  const [customIni, setCustomIni] = useState("");
  const [customFim, setCustomFim] = useState("");

  const rangeInicio = useMemo(() => {
    const hoje = new Date();
    if (periodo === "hoje") return hoje;
    if (periodo === "semana") { const d = new Date(hoje); d.setDate(d.getDate() - 6); return d; }
    if (periodo === "mes") { const d = new Date(hoje); d.setDate(d.getDate() - 29); return d; }
    return customIni ? new Date(customIni + "T00:00:00") : null;
  }, [periodo, customIni]);

  const rangeFim = useMemo(() => {
    if (periodo === "personalizado") return customFim ? new Date(customFim + "T23:59:59") : null;
    return new Date();
  }, [periodo, customFim]);

  const inspecoesPeriodo = useMemo(() => {
    if (!rangeInicio || !rangeFim) return inspecoes;
    return inspecoes.filter(i => {
      const d = new Date(i.criadoEm);
      return d >= rangeInicio && d <= rangeFim;
    });
  }, [inspecoes, rangeInicio, rangeFim]);

  const { dataKey } = nowParts();
  const inspHoje = inspecoes.filter(i => i.dataKey === dataKey);

  const ultimasPorAmbiente = useMemo(() => {
    const map = {};
    for (const i of inspecoes) {
      if (!map[i.ambienteId] || new Date(i.criadoEm) > new Date(map[i.ambienteId].criadoEm)) map[i.ambienteId] = i;
    }
    return map;
  }, [inspecoes]);

  const limpos = Object.values(ultimasPorAmbiente).filter(i => i.status === "limpo").length;
  const parciais = Object.values(ultimasPorAmbiente).filter(i => i.status === "parcial").length;
  const naoLimpos = Object.values(ultimasPorAmbiente).filter(i => i.status === "nao_limpo").length;
  const pendentes = Math.max(ambientes.length - Object.keys(ultimasPorAmbiente).length, 0);
  const conformidade = ambientes.length > 0 ? Math.round((limpos / ambientes.length) * 100) : 0;

  const pieData = [
    { name: "Limpos", value: limpos, color: "#10b981" },
    { name: "Parciais", value: parciais, color: "#f59e0b" },
    { name: "Não limpos", value: naoLimpos, color: "#ef4444" },
    { name: "Pendentes", value: pendentes, color: "#94a3b8" },
  ].filter(d => d.value > 0);

  const ambientesComProblemas = useMemo(() => {
    const map = {};
    for (const i of inspecoes) {
      if (i.status === "nao_limpo" || i.status === "parcial") {
        const amb = ambientes.find(a => a.id === i.ambienteId);
        const nome = amb ? amb.nome : "—";
        map[nome] = (map[nome] || 0) + 1;
      }
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [inspecoes, ambientes]);

  const ocorrenciasTotal = inspecoes.filter(i => i.status === "nao_limpo" || i.status === "parcial").length;
  const ambientesAvaliados = Object.keys(ultimasPorAmbiente).length;

  const atividades = useMemo(() => {
    return [...inspecoes]
      .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm))
      .slice(0, 8);
  }, [inspecoes]);

  const primeiroNome = (currentUser?.nome || "").trim().split(" ")[0];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-xl text-gray-900 dark:text-white">{saudacao()}, {primeiroNome}.</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Acompanhe a qualidade dos ambientes da sua unidade.</p>
        </div>
        <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1">
          {[
            { key: "hoje", label: "Hoje" },
            { key: "semana", label: "Esta semana" },
            { key: "mes", label: "Este mês" },
            { key: "personalizado", label: "Personalizado" },
          ].map(op => (
            <button
              key={op.key}
              onClick={() => setPeriodo(op.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${periodo === op.key ? "bg-blue-700 text-white" : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
            >
              {op.label}
            </button>
          ))}
        </div>
      </div>

      {periodo === "personalizado" && (
        <div className="flex items-center gap-2">
          <input type="date" className="input !w-auto !text-xs" value={customIni} onChange={e => setCustomIni(e.target.value)} />
          <span className="text-xs text-gray-400 dark:text-gray-500">até</span>
          <input type="date" className="input !w-auto !text-xs" value={customFim} onChange={e => setCustomFim(e.target.value)} />
        </div>
      )}

      {/* indicadores */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard label="Total de ambientes" value={ambientes.length} color="blue" icon={Building2} />
        <StatCard label="Inspeções hoje" value={inspHoje.length} color="blue" icon={ClipboardList} />
        <StatCard label="Limpos" value={limpos} color="emerald" icon={CheckCircle2} />
        <StatCard label="Parciais" value={parciais} color="amber" icon={AlertTriangle} />
        <StatCard label="Não limpos" value={naoLimpos} color="red" icon={XCircle} />
        <StatCard label="Pendentes" value={pendentes} color="gray" icon={Clock} />
        <StatCard label="Conformidade" value={`${conformidade}%`} color="cyan" icon={Gauge} />
      </div>

      {/* gráfico + ranking de problemas */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Status das inspeções">
          {pieData.length === 0 ? <EmptyMini text="Sem inspeções ainda" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={2}>
                  {pieData.map((d, idx) => <Cell key={idx} fill={d.color} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Ambientes com problemas">
          {ambientesComProblemas.length === 0 ? <EmptyMini text="Nenhum problema registrado" /> : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {ambientesComProblemas.map(([nome, total], idx) => (
                <li key={nome} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs font-semibold flex items-center justify-center shrink-0">{idx + 1}</span>
                    <span className="text-sm text-gray-700 dark:text-gray-200 truncate">{nome}</span>
                  </div>
                  <span className="text-sm font-semibold text-red-600 dark:text-red-400 shrink-0">{total} ocorrência{total === 1 ? "" : "s"}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* desempenho da unidade */}
      <Card title="Desempenho da unidade" right={<Activity size={15} className="text-gray-400 dark:text-gray-500" />}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <DesempenhoItem label="Conformidade" value={conformidade} sufixo="%" barColor="bg-emerald-500" />
          <DesempenhoItem label="Inspeções realizadas" value={inspecoesPeriodo.length} barColor="bg-blue-600" max={Math.max(inspecoesPeriodo.length, 1)} semBarra />
          <DesempenhoItem label="Ambientes avaliados" value={ambientesAvaliados} max={Math.max(ambientes.length, 1)} barColor="bg-cyan-500" />
          <DesempenhoItem label="Ocorrências" value={ocorrenciasTotal} barColor="bg-red-500" max={Math.max(ocorrenciasTotal, 1)} semBarra />
        </div>
      </Card>

      {/* atividades recentes */}
      <Card title="Atividades recentes">
        {atividades.length === 0 ? <EmptyMini text="Nenhuma atividade ainda" /> : (
          <ul className="space-y-3">
            {atividades.map(i => {
              const info = {
                limpo: { icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", label: "Inspeção concluída" },
                parcial: { icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400", label: "Pendência registrada" },
                nao_limpo: { icon: AlertCircle, color: "text-red-600 dark:text-red-400", label: "Ocorrência registrada" },
              }[i.status];
              const Icon = info.icon;
              return (
                <li key={i.id} className="flex items-center gap-3">
                  <Icon size={16} className={`${info.color} shrink-0`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-700 dark:text-gray-200 truncate">{info.label} <span className="text-gray-400 dark:text-gray-500">·</span> <span className="font-medium">{i.ambienteNome}</span></p>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{tempoRelativo(i.criadoEm)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function DesempenhoItem({ label, value, sufixo = "", max = 100, barColor, semBarra }) {
  const pct = semBarra ? null : Math.min(100, Math.round((value / max) * 100));
  return (
    <div>
      <p className="text-2xl font-display font-extrabold text-gray-900 dark:text-white">{value}{sufixo}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-2">{label}</p>
      {!semBarra && (
        <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, span, icon: Icon }) {
  const colors = {
    blue: { text: "text-blue-700 dark:text-blue-300", bg: "bg-blue-50 dark:bg-blue-950" },
    emerald: { text: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950" },
    amber: { text: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950" },
    red: { text: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950" },
    gray: { text: "text-gray-600 dark:text-gray-300", bg: "bg-gray-100 dark:bg-gray-700" },
    cyan: { text: "text-cyan-700 dark:text-cyan-400", bg: "bg-cyan-50 dark:bg-cyan-950" },
  };
  const c = colors[color] || colors.gray;
  return (
    <div className={`rounded-xl p-3.5 bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 ${span ? "col-span-2 md:col-span-1" : ""}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
        {Icon && <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${c.bg} ${c.text}`}><Icon size={13} /></span>}
      </div>
      <div className="text-xl font-display font-extrabold text-gray-900 dark:text-white">{value}</div>
    </div>
  );
}

function Card({ title, children, right }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-200">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function EmptyMini({ text }) {
  return <div className="h-[180px] flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">{text}</div>;
}

/* --------------------------- ambientes (admin) ---------------------------- */

function AmbientesManager({ ambientes, inspecoes, onChange }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [selectedQr, setSelectedQr] = useState(null);
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [erroPdf, setErroPdf] = useState("");

  const imprimirTodos = async () => {
    setGerandoPdf(true);
    setErroPdf("");
    try {
      await gerarPdfTodosQrCodes(ambientes);
    } catch (e) {
      setErroPdf("Não foi possível gerar o PDF: " + (e.message || e));
    }
    setGerandoPdf(false);
  };

  const linhas = useMemo(() => {
    return ambientes.map(a => {
      const doAmbiente = inspecoes.filter(i => i.ambienteId === a.id);
      const ultima = doAmbiente.length > 0
        ? doAmbiente.reduce((mais, i) => new Date(i.criadoEm) > new Date(mais.criadoEm) ? i : mais)
        : null;
      const ocorrencias = doAmbiente.filter(i => i.status === "nao_limpo" || i.status === "parcial").length;
      return { ambiente: a, ultima, ocorrencias };
    });
  }, [ambientes, inspecoes]);

  const filtered = linhas.filter(({ ambiente: a, ultima }) => {
    const buscaOk = a.nome.toLowerCase().includes(search.toLowerCase()) || a.codigo.toLowerCase().includes(search.toLowerCase());
    const statusOk = !filtroStatus || (ultima ? ultima.status === filtroStatus : filtroStatus === "pendente");
    const tipoOk = !filtroTipo || a.tipo === filtroTipo;
    return buscaOk && statusOk && tipoOk;
  });

  const salvar = async (dados) => {
    setBusy(true);
    try {
      if (editing) {
        await updateAmbiente(editing.id, dados);
      } else {
        const codigo = `AMB-${String(ambientes.length + 1).padStart(3, "0")}-${uidCurto()}`;
        await createAmbiente({ ...dados, codigo });
      }
      await onChange();
      setShowForm(false);
      setEditing(null);
    } catch (e) {
      alert("Erro ao salvar ambiente: " + (e.message || e));
    }
    setBusy(false);
  };

  const excluir = async (a) => {
    if (!confirm(`Excluir o ambiente "${a.nome}"? O histórico de inspeções permanecerá registrado.`)) return;
    await deleteAmbiente(a.id);
    await onChange();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display font-bold text-xl text-gray-900 dark:text-white">Ambientes</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{ambientes.length} ambiente(s) cadastrado(s)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={imprimirTodos} disabled={gerandoPdf || ambientes.length === 0} className="btn-secondary !w-auto px-4 disabled:opacity-40">
            {gerandoPdf ? <Loader2 className="animate-spin" size={16} /> : <FileDown size={16} />} {gerandoPdf ? "Gerando PDF..." : "QR Codes (PDF)"}
          </button>
          <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary !w-auto px-4"><Plus size={16} /> Novo ambiente</button>
        </div>
      </div>
      {erroPdf && <p className="text-red-600 text-xs font-medium">{erroPdf}</p>}

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou código..." className="input !pl-9" />
        </div>
        <select className="input !w-auto" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="">Status: todos</option>
          {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          <option value="pendente">Pendente</option>
        </select>
        <select className="input !w-auto" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="">Tipo: todos</option>
          {TIPOS_AMBIENTE.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-10 text-center text-gray-400 dark:text-gray-500">
          <Building2 className="mx-auto mb-2" size={26} />
          Nenhum ambiente encontrado.
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-950 text-gray-500 dark:text-gray-400 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Ambiente</th>
                <th className="text-left px-4 py-2.5 font-medium">Tipo</th>
                <th className="text-left px-4 py-2.5 font-medium">Última inspeção</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium">Responsável</th>
                <th className="text-left px-4 py-2.5 font-medium">Ocorrências</th>
                <th className="text-right px-4 py-2.5 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ ambiente: a, ultima, ocorrencias }) => {
                const st = ultima ? statusStyle(ultima.status) : statusStyle(null);
                return (
                  <tr key={a.id} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-800 dark:text-gray-100">{a.nome}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{a.codigo} · Bloco {a.bloco} · {a.andar}º andar</p>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">{a.tipo}</td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{ultima ? `${ultima.data} ${ultima.hora}` : "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${st.chip}`}>
                        {ultima ? STATUS[ultima.status].label : "Pendente"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">{ultima ? ultima.inspetorNome : "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={ocorrencias > 0 ? "text-red-600 dark:text-red-400 font-semibold" : "text-gray-400 dark:text-gray-500"}>{ocorrencias}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => setSelectedQr(a)} title="QR Code" className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"><QrCode size={15} /></button>
                        <button onClick={() => { setEditing(a); setShowForm(true); }} title="Editar" className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"><Pencil size={15} /></button>
                        <button onClick={() => excluir(a)} title="Excluir" className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <Modal onClose={() => { setShowForm(false); setEditing(null); }} title={editing ? "Editar ambiente" : "Novo ambiente"}>
          <AmbienteForm initial={editing} busy={busy} onSubmit={salvar} onCancel={() => { setShowForm(false); setEditing(null); }} />
        </Modal>
      )}

      {selectedQr && (
        <Modal onClose={() => setSelectedQr(null)} title="QR Code do ambiente">
          <AmbienteQrView ambiente={selectedQr} />
        </Modal>
      )}
    </div>
  );
}

function AmbienteQrView({ ambiente }) {
  const [qr, setQr] = useState(null);
  const url = linkDoAmbiente(ambiente.id);

  useEffect(() => {
    let ativo = true;
    setQr(null);
    gerarQrDataUrl(url).then(d => { if (ativo) setQr(d); });
    return () => { ativo = false; };
  }, [url]);

  return (
    <div className="text-center py-2">
      <div className="mx-auto w-52 h-52 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-center bg-white dark:bg-gray-800 p-3">
        {qr ? <img src={qr} alt={`QR code de ${ambiente.nome}`} className="w-full h-full" /> : <Loader2 className="animate-spin text-blue-700" size={22} />}
      </div>
      <p className="font-mono font-bold text-lg text-blue-800 dark:text-blue-300 mt-3">{ambiente.codigo}</p>
      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{ambiente.nome}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 leading-relaxed">
        Aponte a câmera do celular pra este QR (não precisa abrir o app antes) — ele leva direto
        pra ficha de inspeção deste ambiente. O inspetor precisa estar logado no navegador do celular.
      </p>
      <button onClick={() => window.print()} className="btn-secondary mx-auto mt-4 !w-auto px-4"><Printer size={15} /> Imprimir</button>
    </div>
  );
}

function uidCurto() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function AmbienteForm({ initial, busy, onSubmit, onCancel }) {
  const [nome, setNome] = useState(initial?.nome || "");
  const [bloco, setBloco] = useState(initial?.bloco || "");
  const [andar, setAndar] = useState(initial?.andar || "");
  const [tipo, setTipo] = useState(initial?.tipo || TIPOS_AMBIENTE[0]);

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ nome, bloco, andar, tipo }); }} className="space-y-3">
      <Field label="Nome do ambiente"><input value={nome} onChange={e => setNome(e.target.value)} className="input" placeholder="Ex: Sala 301" required /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Bloco"><input value={bloco} onChange={e => setBloco(e.target.value)} className="input" placeholder="A" required /></Field>
        <Field label="Andar"><input value={andar} onChange={e => setAndar(e.target.value)} className="input" placeholder="3" required /></Field>
      </div>
      <Field label="Tipo de ambiente">
        <select value={tipo} onChange={e => setTipo(e.target.value)} className="input">
          {TIPOS_AMBIENTE.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancelar</button>
        <button disabled={busy} className="btn-primary flex-1">{busy ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Salvar</button>
      </div>
    </form>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 print-area" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-gray-800 dark:text-gray-100">{title}</h3>
          <button onClick={onClose} className="no-print text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* -------------------------------- usuários (admin) -------------------------------- */

function UsuariosManager({ users, currentUser, onChange }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  const salvar = async (dados) => {
    setErr("");
    const emailExiste = users.some(u => u.email.toLowerCase() === dados.email.trim().toLowerCase() && u.id !== editing?.id);
    if (emailExiste) { setErr("Já existe um usuário com este e-mail."); return; }
    setBusy(true);
    try {
      const payload = { ...dados, email: dados.email.trim() };
      if (editing) await updateUser(editing.id, payload);
      else await createUser(payload);
      await onChange();
      setShowForm(false);
      setEditing(null);
    } catch (e) {
      setErr("Erro ao salvar: " + (e.message || e));
    }
    setBusy(false);
  };

  const excluir = async (u) => {
    if (u.id === currentUser.id) { alert("Você não pode excluir sua própria conta enquanto está logado nela."); return; }
    if (!confirm(`Remover o acesso de "${u.nome}"? O histórico de inspeções feitas por ela permanece registrado.`)) return;
    await deleteUser(u.id);
    await onChange();
  };

  const copiarCredenciais = (u) => {
    const texto = `Acesso ao RondaLimpa\nLink: (endereço do app no Vercel)\nE-mail: ${u.email}\nSenha: ${u.senha}`;
    navigator.clipboard?.writeText(texto).then(() => {
      setCopiedId(u.id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display font-bold text-xl text-gray-900 dark:text-white">Usuários</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Crie um acesso para cada inspetor e envie e-mail/senha para eles.</p>
        </div>
        <button onClick={() => { setEditing(null); setErr(""); setShowForm(true); }} className="btn-primary !w-auto px-4"><UserPlus size={16} /> Novo usuário</button>
      </div>

      <div className="space-y-2">
        {users.map(u => (
          <div key={u.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-3.5 flex items-center gap-3">
            <span className={`shrink-0 rounded-lg p-2 ${u.perfil === "administrador" ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"}`}>
              {u.perfil === "administrador" ? <ShieldCheck size={16} /> : <User size={16} />}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-800 dark:text-gray-100 truncate">{u.nome} {u.id === currentUser.id && <span className="text-xs font-normal text-gray-400 dark:text-gray-500">(você)</span>}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{u.email} · <span className="capitalize">{u.perfil}</span></p>
            </div>
            <button onClick={() => copiarCredenciais(u)} className="shrink-0 flex items-center gap-1 text-xs font-medium border border-gray-200 dark:border-gray-700 rounded-lg py-1.5 px-2.5 hover:bg-gray-50 dark:hover:bg-gray-700">
              {copiedId === u.id ? <><Check size={13} className="text-emerald-600" /> Copiado</> : <><Copy size={13} /> Credenciais</>}
            </button>
            <button onClick={() => { setEditing(u); setErr(""); setShowForm(true); }} className="shrink-0 flex items-center justify-center text-xs font-medium border border-gray-200 dark:border-gray-700 rounded-lg py-1.5 px-2.5 hover:bg-gray-50 dark:hover:bg-gray-700"><Pencil size={13} /></button>
            <button onClick={() => excluir(u)} className="shrink-0 flex items-center justify-center text-xs font-medium border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 rounded-lg py-1.5 px-2.5 hover:bg-red-50 dark:hover:bg-red-950"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>

      {showForm && (
        <Modal onClose={() => { setShowForm(false); setEditing(null); }} title={editing ? "Editar usuário" : "Novo usuário"}>
          <UsuarioForm initial={editing} busy={busy} err={err} onSubmit={salvar} onCancel={() => { setShowForm(false); setEditing(null); }} />
        </Modal>
      )}
    </div>
  );
}

function UsuarioForm({ initial, busy, err, onSubmit, onCancel }) {
  const [nome, setNome] = useState(initial?.nome || "");
  const [email, setEmail] = useState(initial?.email || "");
  const [senha, setSenha] = useState(initial?.senha || "");
  const [perfil, setPerfil] = useState(initial?.perfil || "inspetor");

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ nome, email, senha, perfil }); }} className="space-y-3">
      <Field label="Nome"><input value={nome} onChange={e => setNome(e.target.value)} className="input" placeholder="Nome completo" required /></Field>
      <Field label="E-mail"><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input" placeholder="email@estacio.br" required /></Field>
      <Field label="Senha">
        <div className="flex items-center gap-2">
          <KeyRound size={14} className="text-gray-400 dark:text-gray-500 shrink-0" />
          <input value={senha} onChange={e => setSenha(e.target.value)} className="input" placeholder="Defina uma senha" required />
        </div>
      </Field>
      <Field label="Perfil de acesso">
        <div className="flex gap-2">
          <button type="button" onClick={() => setPerfil("inspetor")} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border ${perfil === "inspetor" ? "bg-blue-50 dark:bg-blue-950 border-blue-600 dark:border-blue-500 text-blue-800 dark:text-blue-300" : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"}`}><User size={14} /> Inspetor</button>
          <button type="button" onClick={() => setPerfil("administrador")} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border ${perfil === "administrador" ? "bg-blue-50 dark:bg-blue-950 border-blue-600 dark:border-blue-500 text-blue-800 dark:text-blue-300" : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"}`}><Users size={14} /> Admin</button>
        </div>
      </Field>
      {err && <p className="text-red-600 text-xs font-medium">{err}</p>}
      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancelar</button>
        <button disabled={busy} className="btn-primary flex-1">{busy ? <Loader2 className="animate-spin" size={16} /> : <UserPlus size={16} />} Salvar</button>
      </div>
    </form>
  );
}

/* -------------------------------- ronda ----------------------------------- */

function Ronda({ ambientes, currentUser, onSaved, directAmbiente, onClearDirect, adminEmails }) {
  const [selected, setSelected] = useState(directAmbiente || null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (directAmbiente) setSelected(directAmbiente);
  }, [directAmbiente]);

  const filtered = ambientes.filter(a =>
    a.nome.toLowerCase().includes(search.toLowerCase()) || a.codigo.toLowerCase().includes(search.toLowerCase())
  );

  const voltar = () => {
    setSelected(null);
    onClearDirect?.();
  };

  if (selected) {
    return (
      <FichaInspecao
        ambiente={selected}
        currentUser={currentUser}
        onBack={voltar}
        onSaved={() => { onSaved(); voltar(); }}
        adminEmails={adminEmails}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900 rounded-xl p-4 flex items-start gap-3">
        <ScanLine className="text-blue-700 shrink-0 mt-0.5" size={20} />
        <div>
          <h2 className="font-display font-bold text-gray-800 dark:text-gray-100">Nova ronda</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">
            Escaneie o QR Code na porta do ambiente com a câmera do celular, ou toque no ambiente abaixo pra abrir a ficha manualmente.
          </p>
        </div>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar ambiente por nome ou código..." className="input !pl-9" />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-10 text-center text-gray-400 dark:text-gray-500">
          <Building2 className="mx-auto mb-2" size={26} /> Nenhum ambiente encontrado.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(a => (
            <button key={a.id} onClick={() => setSelected(a)} className="text-left bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 hover:border-blue-400 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-800 dark:text-gray-100">{a.nome}</span>
                <ChevronRight size={16} className="text-gray-300" />
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{a.tipo} · Bloco {a.bloco} · {a.andar}º andar</p>
              <span className="inline-block mt-2 text-[10px] font-mono bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">{a.codigo}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FichaInspecao({ ambiente, currentUser, onBack, onSaved, adminEmails }) {
  const [status, setStatus] = useState("limpo");
  const [observacao, setObservacao] = useState("");
  const [fotoPreview, setFotoPreview] = useState(null);
  const [fotoData, setFotoData] = useState(null);
  const [geo, setGeo] = useState(null);
  const [geoStatus, setGeoStatus] = useState("idle");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const cameraRef = useRef(null);
  const galeriaRef = useRef(null);
  const { data, hora, iso, dataKey } = nowParts();

  const pedirGeo = () => {
    setGeoStatus("buscando");
    if (!navigator.geolocation) { setGeoStatus("indisponível"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGeo({ lat: pos.coords.latitude.toFixed(5), lng: pos.coords.longitude.toFixed(5) }); setGeoStatus("ok"); },
      () => setGeoStatus("indisponível"),
      { timeout: 6000 }
    );
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await resizeImage(file);
    setFotoPreview(dataUrl);
    setFotoData(dataUrl);
  };

  const obrigatorioObs = status === "nao_limpo" || status === "parcial";

  const salvar = async (e) => {
    e.preventDefault();
    setErr("");
    if (!fotoData) { setErr("A foto é obrigatória para registrar a inspeção."); return; }
    if (obrigatorioObs && !observacao.trim()) { setErr("Observação obrigatória para este status."); return; }

    setBusy(true);
    try {
      const registro = {
        ambienteId: ambiente.id, ambienteNome: ambiente.nome,
        inspetorId: currentUser.id, inspetorNome: currentUser.nome,
        status, observacao: observacao.trim(), foto: fotoData,
        data, hora, dataKey, criadoEm: iso, geo,
      };
      const { fotoUrl } = await createInspecao(registro);

      if (status === "nao_limpo") {
        await createNotificacao({
          ambienteNome: ambiente.nome, observacao: observacao.trim(),
          data, hora, inspetorNome: currentUser.nome, criadoEm: iso,
        }, fotoUrl);

        // Envio de e-mail é "melhor esforço": se falhar, não impede o
        // registro da inspeção, que já foi salvo com sucesso acima.
        if (adminEmails && adminEmails.length > 0) {
          try {
            await enviarEmailNotificacao({
              ambienteNome: ambiente.nome,
              ambienteCodigo: ambiente.codigo,
              bloco: ambiente.bloco,
              andar: ambiente.andar,
              tipo: ambiente.tipo,
              observacao: observacao.trim(),
              data, hora,
              inspetorNome: currentUser.nome,
              fotoUrl,
              destinatarios: adminEmails,
            });
          } catch (emailErr) {
            console.error("Falha ao enviar e-mail de notificação:", emailErr);
            alert("Inspeção salva, mas o e-mail não pôde ser enviado: " + (emailErr.message || emailErr));
          }
        } else {
          console.warn("Nenhum e-mail de administrador encontrado — e-mail de notificação não foi tentado.");
          alert("Inspeção salva, mas nenhum administrador com e-mail foi encontrado para notificar.");
        }
      }
      onSaved();
    } catch (e) {
      setErr("Erro ao salvar a inspeção: " + (e.message || e));
    }
    setBusy(false);
  };

  return (
    <div className="max-w-xl">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200 mb-3"><ArrowLeft size={15} /> Voltar</button>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display font-bold text-lg text-gray-800 dark:text-gray-100">{ambiente.nome}</h2>
          <span className="text-[10px] font-mono bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">{ambiente.codigo}</span>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">{ambiente.tipo} · Bloco {ambiente.bloco} · {ambiente.andar}º andar</p>

        <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400 mb-4">
          <span className="flex items-center gap-1"><Calendar size={13} /> {data}</span>
          <span className="flex items-center gap-1"><Clock size={13} /> {hora}</span>
          <span className="flex items-center gap-1"><User size={13} /> {currentUser.nome}</span>
        </div>

        <form onSubmit={salvar} className="space-y-4">
          <Field label="Status da limpeza">
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(STATUS).map(([key, s]) => {
                const st = statusStyle(key);
                const Icon = s.icon;
                return (
                  <button type="button" key={key} onClick={() => setStatus(key)}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border-2 text-xs font-medium transition-colors ${status === key ? `${st.border} ${st.bg} ${st.text}` : "border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500"}`}>
                    <Icon size={18} /> {s.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label={`Foto ${!fotoData ? "(obrigatória)" : ""}`}>
            {fotoPreview ? (
              <div className="relative w-32 h-32">
                <img src={fotoPreview} alt="evidência" className="w-32 h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
                <button type="button" onClick={() => { setFotoPreview(null); setFotoData(null); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"><X size={12} /></button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button type="button" onClick={() => cameraRef.current?.click()} className="flex-1 flex flex-col items-center gap-1 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg py-4 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600"><Camera size={20} /><span className="text-xs">Câmera</span></button>
                <button type="button" onClick={() => galeriaRef.current?.click()} className="flex-1 flex flex-col items-center gap-1 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg py-4 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600"><ImageIcon size={20} /><span className="text-xs">Galeria</span></button>
              </div>
            )}
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
            <input ref={galeriaRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </Field>

          <Field label={`Observações ${obrigatorioObs ? "(obrigatória)" : "(opcional)"}`}>
            <textarea value={observacao} onChange={e => setObservacao(e.target.value)} rows={3} className="input resize-none" placeholder='Ex: "Lixo no fundo da sala.", "Piso molhado."' />
          </Field>

          <Field label="Geolocalização (opcional)">
            {geo ? (
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1"><MapPin size={13} /> Lat {geo.lat}, Lng {geo.lng}</p>
            ) : (
              <button type="button" onClick={pedirGeo} className="btn-secondary !w-auto px-3 text-xs py-1.5">
                <MapPin size={13} /> {geoStatus === "buscando" ? "Buscando..." : geoStatus === "indisponível" ? "Indisponível — tentar novamente" : "Capturar localização"}
              </button>
            )}
          </Field>

          {err && <p className="text-red-600 text-xs font-medium">{err}</p>}

          <button disabled={busy} className="btn-primary w-full">{busy ? <Loader2 className="animate-spin" size={16} /> : <ClipboardCheck size={16} />} Registrar inspeção</button>
        </form>
      </div>
    </div>
  );
}

/* ------------------------- histórico / filtros ---------------------------- */

function InspecoesHistorico({ ambientes, inspecoes, users, minimalFilters, onChange }) {
  const [filtros, setFiltros] = useState({ dataIni: "", dataFim: "", bloco: "", andar: "", tipo: "", inspetor: "", status: "", ambiente: "" });
  const [detalhe, setDetalhe] = useState(null);
  const [editando, setEditando] = useState(null);

  const excluirInspecao = async (i) => {
    if (!confirm(`Excluir esta inspeção de "${i.ambienteNome}" (${i.data} às ${i.hora})? Essa ação não pode ser desfeita.`)) return;
    await deleteInspecao(i.id);
    setDetalhe(null);
    await onChange?.();
  };

  const blocos = [...new Set(ambientes.map(a => a.bloco))];
  const andares = [...new Set(ambientes.map(a => a.andar))];
  const inspetores = [...new Set(inspecoes.map(i => i.inspetorNome))];

  const filtered = inspecoes.filter(i => {
    const amb = ambientes.find(a => a.id === i.ambienteId);
    if (filtros.dataIni && i.dataKey < filtros.dataIni) return false;
    if (filtros.dataFim && i.dataKey > filtros.dataFim) return false;
    if (filtros.bloco && amb?.bloco !== filtros.bloco) return false;
    if (filtros.andar && amb?.andar !== filtros.andar) return false;
    if (filtros.tipo && amb?.tipo !== filtros.tipo) return false;
    if (filtros.inspetor && i.inspetorNome !== filtros.inspetor) return false;
    if (filtros.status && i.status !== filtros.status) return false;
    if (filtros.ambiente && i.ambienteId !== filtros.ambiente) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display font-bold text-xl text-gray-900 dark:text-white">{minimalFilters ? "Minhas inspeções" : "Inspeções"}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{filtered.length} registro(s)</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3"><Filter size={14} /> Filtros</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <input type="date" className="input !text-xs" value={filtros.dataIni} onChange={e => setFiltros(f => ({ ...f, dataIni: e.target.value }))} />
          <input type="date" className="input !text-xs" value={filtros.dataFim} onChange={e => setFiltros(f => ({ ...f, dataFim: e.target.value }))} />
          <select className="input !text-xs" value={filtros.status} onChange={e => setFiltros(f => ({ ...f, status: e.target.value }))}>
            <option value="">Status: todos</option>
            {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
          <select className="input !text-xs" value={filtros.ambiente} onChange={e => setFiltros(f => ({ ...f, ambiente: e.target.value }))}>
            <option value="">Ambiente: todos</option>
            {ambientes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
          {!minimalFilters && (
            <>
              <select className="input !text-xs" value={filtros.bloco} onChange={e => setFiltros(f => ({ ...f, bloco: e.target.value }))}>
                <option value="">Bloco: todos</option>
                {blocos.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <select className="input !text-xs" value={filtros.andar} onChange={e => setFiltros(f => ({ ...f, andar: e.target.value }))}>
                <option value="">Andar: todos</option>
                {andares.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select className="input !text-xs" value={filtros.tipo} onChange={e => setFiltros(f => ({ ...f, tipo: e.target.value }))}>
                <option value="">Tipo: todos</option>
                {TIPOS_AMBIENTE.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select className="input !text-xs" value={filtros.inspetor} onChange={e => setFiltros(f => ({ ...f, inspetor: e.target.value }))}>
                <option value="">Inspetor: todos</option>
                {inspetores.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-10 text-center text-gray-400 dark:text-gray-500">
          <Inbox className="mx-auto mb-2" size={26} /> Nenhuma inspeção encontrada com os filtros atuais.
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-950 text-gray-500 dark:text-gray-400 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Ambiente</th>
                <th className="text-left px-4 py-2.5 font-medium">Responsável</th>
                <th className="text-left px-4 py-2.5 font-medium">Data</th>
                <th className="text-left px-4 py-2.5 font-medium">Horário</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium">Observação</th>
                <th className="text-center px-4 py-2.5 font-medium">Foto</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(i => {
                const st = statusStyle(i.status);
                return (
                  <tr key={i.id} onClick={() => setDetalhe(i)} className="border-t border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-100">{i.ambienteNome}</td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">{i.inspetorNome}</td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{i.data}</td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{i.hora}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${st.chip}`}>{STATUS[i.status].label}</span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 max-w-[220px] truncate">{i.observacao || "—"}</td>
                    <td className="px-4 py-2.5 text-center">
                      {i.foto ? <img src={i.foto} alt="evidência" className="w-9 h-9 object-cover rounded-md mx-auto" /> : <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {detalhe && (
        <Modal onClose={() => setDetalhe(null)} title="Detalhes da inspeção">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800 dark:text-gray-100">{detalhe.ambienteNome}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{detalhe.data} às {detalhe.hora} · {detalhe.inspetorNome}</p>
              </div>
              <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${statusStyle(detalhe.status).chip}`}>{STATUS[detalhe.status].label}</span>
            </div>
            {detalhe.foto && <img src={detalhe.foto} alt="evidência" className="w-full max-h-64 object-cover rounded-lg border border-gray-200 dark:border-gray-700" />}
            {detalhe.observacao && (
              <p className="text-sm text-gray-600 dark:text-gray-300"><span className="font-semibold text-gray-700 dark:text-gray-200">Observação:</span> {detalhe.observacao}</p>
            )}
            {detalhe.geo && (
              <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1"><MapPin size={12} /> {detalhe.geo.lat}, {detalhe.geo.lng}</p>
            )}
            <div className="flex gap-2 pt-2">
              <button onClick={() => { setEditando(detalhe); setDetalhe(null); }} className="btn-secondary flex-1"><Pencil size={14} /> Editar</button>
              <button onClick={() => excluirInspecao(detalhe)} className="flex-1 flex items-center justify-center gap-1.5 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 rounded-lg py-2 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950"><Trash2 size={14} /> Excluir</button>
            </div>
          </div>
        </Modal>
      )}

      {editando && (
        <Modal onClose={() => setEditando(null)} title="Editar inspeção">
          <EditarInspecaoForm
            inspecao={editando}
            onCancel={() => setEditando(null)}
            onSaved={async () => { await onChange?.(); setEditando(null); }}
          />
        </Modal>
      )}
    </div>
  );
}


function EditarInspecaoForm({ inspecao, onCancel, onSaved }) {
  const [status, setStatus] = useState(inspecao.status);
  const [observacao, setObservacao] = useState(inspecao.observacao || "");
  const [fotoPreview, setFotoPreview] = useState(inspecao.foto);
  const [fotoData, setFotoData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const cameraRef = useRef(null);
  const galeriaRef = useRef(null);

  const obrigatorioObs = status === "nao_limpo" || status === "parcial";

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await resizeImage(file);
    setFotoPreview(dataUrl);
    setFotoData(dataUrl);
  };

  const salvar = async (e) => {
    e.preventDefault();
    setErr("");
    if (obrigatorioObs && !observacao.trim()) { setErr("Observação obrigatória para este status."); return; }
    setBusy(true);
    try {
      let fotoUrl = null;
      if (fotoData) fotoUrl = await uploadFotoInspecao(fotoData, inspecao.ambienteId);
      await updateInspecao(inspecao.id, { status, observacao: observacao.trim(), fotoUrl });
      onSaved();
    } catch (e) {
      setErr("Erro ao salvar: " + (e.message || e));
    }
    setBusy(false);
  };

  return (
    <form onSubmit={salvar} className="space-y-4">
      <div className="text-sm text-gray-500 dark:text-gray-400">
        <p className="font-semibold text-gray-700 dark:text-gray-200">{inspecao.ambienteNome}</p>
        <p className="text-xs">{inspecao.data} às {inspecao.hora} · {inspecao.inspetorNome}</p>
      </div>

      <Field label="Status da limpeza">
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(STATUS).map(([key, s]) => {
            const st = statusStyle(key);
            const Icon = s.icon;
            return (
              <button type="button" key={key} onClick={() => setStatus(key)}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border-2 text-xs font-medium transition-colors ${status === key ? `${st.border} ${st.bg} ${st.text}` : "border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500"}`}>
                <Icon size={18} /> {s.label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Foto">
        <div className="relative w-32 h-32">
          <img src={fotoPreview} alt="evidência" className="w-32 h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
        </div>
        <div className="flex gap-2 mt-2">
          <button type="button" onClick={() => cameraRef.current?.click()} className="btn-secondary !w-auto px-3 text-xs py-1.5"><Camera size={13} /> Trocar (câmera)</button>
          <button type="button" onClick={() => galeriaRef.current?.click()} className="btn-secondary !w-auto px-3 text-xs py-1.5"><ImageIcon size={13} /> Trocar (galeria)</button>
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
        <input ref={galeriaRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </Field>

      <Field label={`Observações ${obrigatorioObs ? "(obrigatória)" : "(opcional)"}`}>
        <textarea value={observacao} onChange={e => setObservacao(e.target.value)} rows={3} className="input resize-none" />
      </Field>

      {err && <p className="text-red-600 text-xs font-medium">{err}</p>}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancelar</button>
        <button disabled={busy} className="btn-primary flex-1">{busy ? <Loader2 className="animate-spin" size={16} /> : <Pencil size={16} />} Salvar alterações</button>
      </div>
    </form>
  );
}

/* -------------------------------- relatórios ------------------------------- */

function Relatorios({ ambientes, inspecoes }) {
  const [filtros, setFiltros] = useState({ dataIni: "", dataFim: "", status: "" });
  const [resumo, setResumo] = useState("");
  const [resumoBusy, setResumoBusy] = useState(false);
  const [resumoErr, setResumoErr] = useState("");

  const filtered = inspecoes.filter(i => {
    if (filtros.dataIni && i.dataKey < filtros.dataIni) return false;
    if (filtros.dataFim && i.dataKey > filtros.dataFim) return false;
    if (filtros.status && i.status !== filtros.status) return false;
    return true;
  });

  const periodoLabel = filtros.dataIni || filtros.dataFim
    ? `${filtros.dataIni || "início"} até ${filtros.dataFim || "hoje"}`
    : "todos os registros disponíveis";

  const gerarResumo = async () => {
    setResumoBusy(true);
    setResumoErr("");
    setResumo("");
    try {
      const texto = await gerarResumoIA(filtered, periodoLabel);
      setResumo(texto);
    } catch (e) {
      setResumoErr("Não foi possível gerar o resumo: " + (e.message || e));
    }
    setResumoBusy(false);
  };

  const linhas = filtered.map(i => ({
    Ambiente: i.ambienteNome, Status: STATUS[i.status].label, Observacao: i.observacao || "",
    Responsavel: i.inspetorNome, Data: i.data, Hora: i.hora,
  }));

  const exportarCSV = () => {
    const header = Object.keys(linhas[0] || { Ambiente: "", Status: "", Observacao: "", Responsavel: "", Data: "", Hora: "" });
    const rows = linhas.map(l => header.map(h => `"${String(l[h] ?? "").replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "zelo_relatorio.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const exportarExcel = () => {
    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inspeções");
    XLSX.writeFile(wb, "zelo_relatorio.xlsx");
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display font-bold text-xl text-gray-900 dark:text-white">Relatórios</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Conformidade, inspeções e ocorrências da unidade.</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <input type="date" className="input !text-xs" value={filtros.dataIni} onChange={e => setFiltros(f => ({ ...f, dataIni: e.target.value }))} />
          <input type="date" className="input !text-xs" value={filtros.dataFim} onChange={e => setFiltros(f => ({ ...f, dataFim: e.target.value }))} />
          <select className="input !text-xs" value={filtros.status} onChange={e => setFiltros(f => ({ ...f, status: e.target.value }))}>
            <option value="">Status: todos</option>
            {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">{filtered.length} registro(s) no período selecionado.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportarCSV} disabled={filtered.length === 0} className="btn-secondary !w-auto px-3.5 disabled:opacity-40"><FileDown size={15} /> Exportar CSV</button>
          <button onClick={exportarExcel} disabled={filtered.length === 0} className="btn-secondary !w-auto px-3.5 disabled:opacity-40"><Sheet size={15} /> Exportar Excel</button>
          <button onClick={() => window.print()} disabled={filtered.length === 0} className="btn-secondary !w-auto px-3.5 disabled:opacity-40"><Printer size={15} /> Exportar PDF (imprimir)</button>
        </div>
      </div>

      <div className="no-print bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200"><Sparkles size={16} className="text-blue-700" /> Resumo com IA</div>
          <button onClick={gerarResumo} disabled={resumoBusy || filtered.length === 0} className="btn-primary !w-auto px-3.5 disabled:opacity-40">
            {resumoBusy ? <Loader2 className="animate-spin" size={15} /> : <Sparkles size={15} />} {resumoBusy ? "Gerando..." : "Gerar resumo"}
          </button>
        </div>
        {resumoErr && <p className="text-red-600 text-xs font-medium">{resumoErr}</p>}
        {resumo && <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-line bg-blue-50 dark:bg-blue-950 rounded-lg p-3">{resumo}</p>}
        {!resumo && !resumoErr && !resumoBusy && (
          <p className="text-xs text-gray-400 dark:text-gray-500">Gera um resumo em português das inspeções filtradas acima — destaques, problemas recorrentes e uma recomendação.</p>
        )}
      </div>

      <div className="print-area bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-950 text-gray-500 dark:text-gray-400 text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2">Ambiente</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Observação</th>
              <th className="text-left px-3 py-2">Responsável</th>
              <th className="text-left px-3 py-2">Data</th>
              <th className="text-left px-3 py-2">Hora</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, idx) => (
              <tr key={idx} className="border-t border-gray-100 dark:border-gray-700">
                <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-200">{l.Ambiente}</td>
                <td className="px-3 py-2">{l.Status}</td>
                <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{l.Observacao || "—"}</td>
                <td className="px-3 py-2">{l.Responsavel}</td>
                <td className="px-3 py-2">{l.Data}</td>
                <td className="px-3 py-2">{l.Hora}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {linhas.length === 0 && <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-8">Nenhum dado para exportar.</p>}
      </div>
    </div>
  );
}

/* --------------------------------- chat IA ---------------------------------- */

function ChatIA({ ambientes, inspecoes, users }) {
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState([
    { role: "assistant", content: "Oi! Pode me perguntar coisas sobre os ambientes e inspeções — por exemplo: \"quantas inspeções foram feitas essa semana?\" ou \"qual ambiente tem mais ocorrências de não limpo?\"." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    if (aberto && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensagens, aberto, busy]);

  const enviar = async (e) => {
    e.preventDefault();
    const texto = input.trim();
    if (!texto || busy) return;
    setErr("");
    const novasMensagens = [...mensagens, { role: "user", content: texto }];
    setMensagens(novasMensagens);
    setInput("");
    setBusy(true);
    try {
      const resposta = await enviarMensagemChat(novasMensagens, ambientes, inspecoes, users);
      setMensagens(m => [...m, { role: "assistant", content: resposta }]);
    } catch (e) {
      setErr("Não foi possível responder: " + (e.message || e));
    }
    setBusy(false);
  };

  return (
    <div className="no-print">
      <button
        onClick={() => setAberto(v => !v)}
        className="fixed bottom-5 right-5 z-40 bg-blue-700 hover:bg-blue-800 text-white rounded-full p-3.5 shadow-lg transition-colors"
        title="Assistente ZELO"
      >
        {aberto ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {aberto && (
        <div className="fixed bottom-20 right-5 z-40 w-[92vw] max-w-sm h-[70vh] max-h-[520px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
          <div className="bg-blue-800 text-white px-4 py-3 flex items-center gap-2">
            <Sparkles size={16} />
            <div>
              <p className="text-sm font-semibold leading-tight">Assistente ZELO</p>
              <p className="text-[11px] text-blue-200 leading-tight">Pergunte sobre ambientes e inspeções</p>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {mensagens.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-line ${
                  m.role === "user"
                    ? "bg-blue-700 text-white rounded-br-sm"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-sm"
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-700 rounded-xl rounded-bl-sm px-3 py-2">
                  <Loader2 className="animate-spin text-gray-400 dark:text-gray-500" size={15} />
                </div>
              </div>
            )}
            {err && <p className="text-red-600 dark:text-red-400 text-xs font-medium">{err}</p>}
          </div>

          <form onSubmit={enviar} className="border-t border-gray-100 dark:border-gray-700 p-2.5 flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Digite sua pergunta..."
              className="input flex-1 !py-2"
            />
            <button type="submit" disabled={busy || !input.trim()} className="btn-primary !w-auto px-3 disabled:opacity-40">
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function Ocorrencias({ notificacoes, onChange }) {
  const [detalhe, setDetalhe] = useState(null);

  const resolver = async (n) => {
    await markNotificacaoLida(n.id);
    setDetalhe(null);
    await onChange();
  };

  const excluir = async (n) => {
    if (!confirm(`Excluir esta ocorrência de "${n.ambienteNome}"?`)) return;
    await deleteNotificacao(n.id);
    setDetalhe(null);
    await onChange();
  };

  const limparResolvidas = async () => {
    const resolvidas = notificacoes.filter(n => n.lida);
    if (resolvidas.length === 0) return;
    if (!confirm(`Excluir todas as ${resolvidas.length} ocorrências já resolvidas?`)) return;
    await Promise.all(resolvidas.map(n => deleteNotificacao(n.id)));
    await onChange();
  };

  const abertas = notificacoes.filter(n => !n.lida).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display font-bold text-xl text-gray-900 dark:text-white">Ocorrências</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{abertas} aberta(s) de {notificacoes.length} no total</p>
        </div>
        {notificacoes.some(n => n.lida) && (
          <button onClick={limparResolvidas} className="btn-secondary !w-auto px-3.5 text-xs"><Trash2 size={13} /> Limpar resolvidas</button>
        )}
      </div>

      {notificacoes.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-10 text-center text-gray-400 dark:text-gray-500">
          <AlertCircle className="mx-auto mb-2" size={26} /> Nenhuma ocorrência registrada até o momento.
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-950 text-gray-500 dark:text-gray-400 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Ambiente</th>
                <th className="text-left px-4 py-2.5 font-medium">Tipo de ocorrência</th>
                <th className="text-left px-4 py-2.5 font-medium">Data</th>
                <th className="text-left px-4 py-2.5 font-medium">Responsável</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-center px-4 py-2.5 font-medium">Foto</th>
              </tr>
            </thead>
            <tbody>
              {notificacoes.map(n => (
                <tr key={n.id} onClick={() => setDetalhe(n)} className="border-t border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40">
                  <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-100">{n.ambienteNome}</td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">Não conformidade de limpeza</td>
                  <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{n.data} {n.hora}</td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">{n.inspetorNome}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${n.lida ? "bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200" : "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"}`}>
                      {n.lida ? "Resolvida" : "Aberta"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {n.foto ? <img src={n.foto} alt="evidência" className="w-9 h-9 object-cover rounded-md mx-auto" /> : <span className="text-gray-300 dark:text-gray-600">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detalhe && (
        <Modal onClose={() => setDetalhe(null)} title="Detalhes da ocorrência">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800 dark:text-gray-100">{detalhe.ambienteNome}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{detalhe.data} às {detalhe.hora} · {detalhe.inspetorNome}</p>
              </div>
              <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${detalhe.lida ? "bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200" : "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"}`}>
                {detalhe.lida ? "Resolvida" : "Aberta"}
              </span>
            </div>
            {detalhe.foto && <img src={detalhe.foto} alt="evidência" className="w-full max-h-64 object-cover rounded-lg border border-gray-200 dark:border-gray-700" />}
            {detalhe.observacao && (
              <p className="text-sm text-gray-600 dark:text-gray-300"><span className="font-semibold text-gray-700 dark:text-gray-200">Observação:</span> {detalhe.observacao}</p>
            )}
            <div className="flex gap-2 pt-2">
              {!detalhe.lida && (
                <button onClick={() => resolver(detalhe)} className="btn-primary flex-1"><CheckCircle2 size={14} /> Marcar como resolvida</button>
              )}
              <button onClick={() => excluir(detalhe)} className="flex-1 flex items-center justify-center gap-1.5 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 rounded-lg py-2 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950"><Trash2 size={14} /> Excluir</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* -------------------------------- configurações / perfil ---------------------------- */

function Configuracoes({ theme, toggleTheme }) {
  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <h1 className="font-display font-bold text-xl text-gray-900 dark:text-white">Configurações</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Preferências do sistema ZELO.</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Tema da interface</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Alterne entre os modos claro e escuro.</p>
        </div>
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          {theme === "dark" ? <><Sun size={15} /> Claro</> : <><Moon size={15} /> Escuro</>}
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Sobre</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">ZELO — Gestão e qualidade dos ambientes. Unidade: {NOME_UNIDADE}.</p>
      </div>
    </div>
  );
}
