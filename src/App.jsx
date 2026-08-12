import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  LogIn, LogOut, LayoutDashboard, Building2, ClipboardList, BarChart3, Bell,
  FileDown, QrCode, Camera, Image as ImageIcon, CheckCircle2, AlertTriangle,
  XCircle, Search, Plus, Trash2, Pencil, User, Users, ChevronRight, X,
  MapPin, Clock, Calendar, Filter, Printer, Sheet, ClipboardCheck, ScanLine,
  ArrowLeft, Loader2, Inbox, UserPlus, KeyRound, ShieldCheck, Copy, Check, Sparkles
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
  fetchInspecoes, createInspecao,
  fetchNotificacoes, createNotificacao, markNotificacaoLida,
  gerarResumoIA,
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
      return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-800" };
    case "parcial":
      return { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500", chip: "bg-amber-100 text-amber-800" };
    case "nao_limpo":
      return { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-500", chip: "bg-red-100 text-red-800" };
    default:
      return { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200", dot: "bg-gray-400", chip: "bg-gray-100 text-gray-800" };
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

const SESSION_KEY = "rondalimpa_session";

/* -------------------------------- app ----------------------------------- */

export default function App() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white border border-red-200 rounded-xl p-6 max-w-md text-center">
          <AlertTriangle className="mx-auto text-red-500 mb-2" size={28} />
          <p className="text-sm text-gray-700">{erroCarregamento}</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen users={users} onLogin={handleLogin} onUsersChange={reload} />;
  }

  const isAdmin = currentUser.perfil === "administrador";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* topo */}
      <header className="no-print bg-blue-800 text-white sticky top-0 z-20 shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-white/15 rounded-lg p-1.5"><ClipboardCheck size={20} /></div>
            <div>
              <div className="font-display font-bold text-[15px] leading-tight tracking-tight">RondaLimpa</div>
              <div className="text-[11px] text-blue-200 leading-tight">Controle de Limpeza de Ambientes</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
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
          {isAdmin ? (
            <>
              <NavBtn active={tab === "dashboard"} onClick={() => setTab("dashboard")} icon={LayoutDashboard} label="Dashboard" />
              <NavBtn active={tab === "ambientes"} onClick={() => setTab("ambientes")} icon={Building2} label="Ambientes" />
              <NavBtn active={tab === "inspecoes"} onClick={() => setTab("inspecoes")} icon={ClipboardList} label="Inspeções" />
              <NavBtn active={tab === "relatorios"} onClick={() => setTab("relatorios")} icon={FileDown} label="Relatórios" />
              <NavBtn active={tab === "notificacoes"} onClick={() => setTab("notificacoes")} icon={Bell} label="Notificações"
                badge={notificacoes.filter(n => !n.lida).length} />
              <NavBtn active={tab === "usuarios"} onClick={() => setTab("usuarios")} icon={Users} label="Usuários" />
            </>
          ) : (
            <>
              <NavBtn active={tab === "ronda"} onClick={() => setTab("ronda")} icon={ScanLine} label="Ronda" />
              <NavBtn active={tab === "minhas"} onClick={() => setTab("minhas")} icon={ClipboardList} label="Minhas Inspeções" />
            </>
          )}
        </nav>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-5">
        {isAdmin && tab === "dashboard" && <Dashboard ambientes={ambientes} inspecoes={inspecoes} />}
        {isAdmin && tab === "ambientes" && <AmbientesManager ambientes={ambientes} inspecoes={inspecoes} onChange={reload} />}
        {isAdmin && tab === "inspecoes" && <InspecoesHistorico ambientes={ambientes} inspecoes={inspecoes} users={users} />}
        {isAdmin && tab === "relatorios" && <Relatorios ambientes={ambientes} inspecoes={inspecoes} />}
        {isAdmin && tab === "notificacoes" && <Notificacoes notificacoes={notificacoes} onChange={reload} />}
        {isAdmin && tab === "usuarios" && <UsuariosManager users={users} currentUser={currentUser} onChange={reload} />}
        {!isAdmin && tab === "ronda" && (
          <Ronda
            ambientes={ambientes}
            currentUser={currentUser}
            onSaved={reload}
            directAmbiente={urlAmbienteId ? ambientes.find(a => a.id === urlAmbienteId) : null}
            onClearDirect={clearUrlAmbiente}
          />
        )}
        {!isAdmin && tab === "minhas" && <InspecoesHistorico ambientes={ambientes} inspecoes={inspecoes.filter(i => i.inspetorId === currentUser.id)} users={users} minimalFilters />}
      </main>

      <footer className="no-print text-center text-[11px] text-gray-400 py-3">
        Dados salvos no Supabase. QR Code é simulado (seleção do ambiente na Ronda); notificações são internas ao app.
      </footer>
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

function LoginScreen({ users, onLogin, onUsersChange }) {
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
    <div className="min-h-screen bg-gradient-to-br from-blue-800 to-blue-600 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6 text-white">
          <div className="logo3d-wrap inline-block mb-3">
            <img src="/logo-estacio.png" alt="Estácio" className="logo3d-spin w-20 h-20 mx-auto" />
          </div>
          <h1 className="font-display font-extrabold text-2xl tracking-tight">RondaLimpa</h1>
          <p className="text-blue-100 text-sm mt-1">Fiscalização de limpeza dos ambientes</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-5">
          {precisaConfigurarPrimeiroAdmin ? (
            <ConfiguracaoInicial onUsersChange={onUsersChange} onLogin={onLogin} />
          ) : (
            <form onSubmit={handleEntrar} className="space-y-3">
              <Field label="E-mail"><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input" placeholder="seu@email.com" required /></Field>
              <Field label="Senha"><input type="password" value={senha} onChange={e => setSenha(e.target.value)} className="input" placeholder="••••••" required /></Field>
              {err && <p className="text-red-600 text-xs font-medium">{err}</p>}
              <button className="btn-primary w-full mt-1"><LogIn size={16} /> Entrar</button>
              <p className="text-xs text-gray-400 text-center pt-1">Não tem acesso? Peça ao administrador para criar seu usuário.</p>
            </form>
          )}
        </div>
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
      <div className="flex items-center gap-2 bg-blue-50 text-blue-800 rounded-lg px-3 py-2 mb-1">
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
      <span className="block text-xs font-semibold text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

/* ----------------------------- dashboard --------------------------------- */

function Dashboard({ ambientes, inspecoes }) {
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
  const pendentes = ambientes.length - Object.keys(ultimasPorAmbiente).length;
  const conformidade = ambientes.length > 0 ? Math.round((limpos / ambientes.length) * 100) : 0;

  const pieData = [
    { name: "Limpo", value: limpos, color: "#10b981" },
    { name: "Parcial", value: parciais, color: "#f59e0b" },
    { name: "Não Limpo", value: naoLimpos, color: "#ef4444" },
    { name: "Pendente", value: Math.max(pendentes, 0), color: "#d1d5db" },
  ].filter(d => d.value > 0);

  const problemasPorAmbiente = useMemo(() => {
    const map = {};
    for (const i of inspecoes) {
      if (i.status === "nao_limpo" || i.status === "parcial") {
        const amb = ambientes.find(a => a.id === i.ambienteId);
        const nome = amb ? amb.nome : "—";
        map[nome] = (map[nome] || 0) + 1;
      }
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([nome, total]) => ({ nome, total }));
  }, [inspecoes, ambientes]);

  const historicoDiario = useMemo(() => {
    const days = [];
    for (let k = 6; k >= 0; k--) {
      const d = new Date();
      d.setDate(d.getDate() - k);
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const label = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
      const total = inspecoes.filter(i => i.dataKey === key).length;
      days.push({ dia: label, inspecoes: total });
    }
    return days;
  }, [inspecoes]);

  const rankingAmbientes = useMemo(() => {
    const map = {};
    for (const i of inspecoes) {
      if (i.status !== "limpo") {
        const amb = ambientes.find(a => a.id === i.ambienteId);
        const nome = amb ? amb.nome : "—";
        map[nome] = (map[nome] || 0) + 1;
      }
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [inspecoes, ambientes]);

  const rankingInspetores = useMemo(() => {
    const map = {};
    for (const i of inspecoes) map[i.inspetorNome] = (map[i.inspetorNome] || 0) + 1;
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [inspecoes]);

  return (
    <div className="space-y-5">
      <h2 className="font-display font-bold text-xl text-gray-800">Dashboard</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total de ambientes" value={ambientes.length} color="blue" />
        <StatCard label="Inspeções hoje" value={inspHoje.length} color="blue" />
        <StatCard label="Limpos" value={limpos} color="emerald" />
        <StatCard label="Parciais" value={parciais} color="amber" />
        <StatCard label="Não limpos" value={naoLimpos} color="red" />
        <StatCard label="Pendentes" value={Math.max(pendentes, 0)} color="gray" />
        <StatCard label="Conformidade" value={`${conformidade}%`} color="blue" span />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Status das inspeções">
          {pieData.length === 0 ? <EmptyMini text="Sem inspeções ainda" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {pieData.map((d, idx) => <Cell key={idx} fill={d.color} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Problemas por ambiente">
          {problemasPorAmbiente.length === 0 ? <EmptyMini text="Nenhum problema registrado" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={problemasPorAmbiente}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="nome" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="total" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Histórico diário (últimos 7 dias)">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={historicoDiario}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="inspecoes" stroke="#1d4ed8" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Rankings">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Mais ocorrências</p>
              {rankingAmbientes.length === 0 ? <EmptyMini text="—" /> : (
                <ul className="space-y-1.5">
                  {rankingAmbientes.map(([nome, total], idx) => (
                    <li key={nome} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 truncate pr-2">{idx + 1}. {nome}</span>
                      <span className="font-semibold text-red-600">{total}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Ranking inspetores</p>
              {rankingInspetores.length === 0 ? <EmptyMini text="—" /> : (
                <ul className="space-y-1.5">
                  {rankingInspetores.map(([nome, total], idx) => (
                    <li key={nome} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 truncate pr-2">{idx + 1}. {nome}</span>
                      <span className="font-semibold text-blue-700">{total}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, span }) {
  const colors = {
    blue: "text-blue-800 bg-blue-50", emerald: "text-emerald-700 bg-emerald-50",
    amber: "text-amber-700 bg-amber-50", red: "text-red-700 bg-red-50", gray: "text-gray-600 bg-gray-100",
  };
  return (
    <div className={`rounded-xl p-3.5 bg-white shadow-sm border border-gray-100 ${span ? "col-span-2 md:col-span-1" : ""}`}>
      <div className={`text-2xl font-display font-extrabold ${colors[color].split(" ")[0]}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function Card({ title, children, right }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm text-gray-700">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function EmptyMini({ text }) {
  return <div className="h-[180px] flex items-center justify-center text-sm text-gray-400">{text}</div>;
}

/* --------------------------- ambientes (admin) ---------------------------- */

function AmbientesManager({ ambientes, inspecoes, onChange }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [selectedQr, setSelectedQr] = useState(null);
  const [search, setSearch] = useState("");
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

  const filtered = ambientes.filter(a =>
    a.nome.toLowerCase().includes(search.toLowerCase()) || a.codigo.toLowerCase().includes(search.toLowerCase())
  );

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
        <h2 className="font-display font-bold text-xl text-gray-800">Ambientes</h2>
        <div className="flex gap-2">
          <button onClick={imprimirTodos} disabled={gerandoPdf || ambientes.length === 0} className="btn-secondary !w-auto px-4 disabled:opacity-40">
            {gerandoPdf ? <Loader2 className="animate-spin" size={16} /> : <FileDown size={16} />} {gerandoPdf ? "Gerando PDF..." : "Imprimir todos os QR Codes"}
          </button>
          <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary !w-auto px-4"><Plus size={16} /> Novo ambiente</button>
        </div>
      </div>
      {erroPdf && <p className="text-red-600 text-xs font-medium">{erroPdf}</p>}

      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou código..." className="input !pl-9" />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-400">
          <Building2 className="mx-auto mb-2" size={26} />
          Nenhum ambiente cadastrado ainda.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(a => {
            const total = inspecoes.filter(i => i.ambienteId === a.id).length;
            return (
              <div key={a.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800">{a.nome}</h3>
                    <p className="text-xs text-gray-400">{a.tipo} · Bloco {a.bloco} · {a.andar}º andar</p>
                  </div>
                  <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{a.codigo}</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">{total} inspeção(ões) registrada(s)</p>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setSelectedQr(a)} className="flex-1 flex items-center justify-center gap-1 text-xs font-medium border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50"><QrCode size={13} /> Código</button>
                  <button onClick={() => { setEditing(a); setShowForm(true); }} className="flex items-center justify-center gap-1 text-xs font-medium border border-gray-200 rounded-lg py-1.5 px-2.5 hover:bg-gray-50"><Pencil size={13} /></button>
                  <button onClick={() => excluir(a)} className="flex items-center justify-center gap-1 text-xs font-medium border border-red-200 text-red-600 rounded-lg py-1.5 px-2.5 hover:bg-red-50"><Trash2 size={13} /></button>
                </div>
              </div>
            );
          })}
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
      <div className="mx-auto w-52 h-52 border border-gray-200 rounded-xl flex items-center justify-center bg-white p-3">
        {qr ? <img src={qr} alt={`QR code de ${ambiente.nome}`} className="w-full h-full" /> : <Loader2 className="animate-spin text-blue-700" size={22} />}
      </div>
      <p className="font-mono font-bold text-lg text-blue-800 mt-3">{ambiente.codigo}</p>
      <p className="text-sm text-gray-600 mt-1">{ambiente.nome}</p>
      <p className="text-xs text-gray-400 mt-3 leading-relaxed">
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 print-area" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="no-print text-gray-400 hover:text-gray-600"><X size={18} /></button>
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
          <h2 className="font-display font-bold text-xl text-gray-800">Usuários</h2>
          <p className="text-xs text-gray-400 mt-0.5">Crie um acesso para cada inspetor e envie e-mail/senha para eles.</p>
        </div>
        <button onClick={() => { setEditing(null); setErr(""); setShowForm(true); }} className="btn-primary !w-auto px-4"><UserPlus size={16} /> Novo usuário</button>
      </div>

      <div className="space-y-2">
        {users.map(u => (
          <div key={u.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3.5 flex items-center gap-3">
            <span className={`shrink-0 rounded-lg p-2 ${u.perfil === "administrador" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
              {u.perfil === "administrador" ? <ShieldCheck size={16} /> : <User size={16} />}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-800 truncate">{u.nome} {u.id === currentUser.id && <span className="text-xs font-normal text-gray-400">(você)</span>}</p>
              <p className="text-xs text-gray-400 truncate">{u.email} · <span className="capitalize">{u.perfil}</span></p>
            </div>
            <button onClick={() => copiarCredenciais(u)} className="shrink-0 flex items-center gap-1 text-xs font-medium border border-gray-200 rounded-lg py-1.5 px-2.5 hover:bg-gray-50">
              {copiedId === u.id ? <><Check size={13} className="text-emerald-600" /> Copiado</> : <><Copy size={13} /> Credenciais</>}
            </button>
            <button onClick={() => { setEditing(u); setErr(""); setShowForm(true); }} className="shrink-0 flex items-center justify-center text-xs font-medium border border-gray-200 rounded-lg py-1.5 px-2.5 hover:bg-gray-50"><Pencil size={13} /></button>
            <button onClick={() => excluir(u)} className="shrink-0 flex items-center justify-center text-xs font-medium border border-red-200 text-red-600 rounded-lg py-1.5 px-2.5 hover:bg-red-50"><Trash2 size={13} /></button>
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
          <KeyRound size={14} className="text-gray-400 shrink-0" />
          <input value={senha} onChange={e => setSenha(e.target.value)} className="input" placeholder="Defina uma senha" required />
        </div>
      </Field>
      <Field label="Perfil de acesso">
        <div className="flex gap-2">
          <button type="button" onClick={() => setPerfil("inspetor")} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border ${perfil === "inspetor" ? "bg-blue-50 border-blue-600 text-blue-800" : "border-gray-200 text-gray-500"}`}><User size={14} /> Inspetor</button>
          <button type="button" onClick={() => setPerfil("administrador")} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border ${perfil === "administrador" ? "bg-blue-50 border-blue-600 text-blue-800" : "border-gray-200 text-gray-500"}`}><Users size={14} /> Admin</button>
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

function Ronda({ ambientes, currentUser, onSaved, directAmbiente, onClearDirect }) {
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
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
        <ScanLine className="text-blue-700 shrink-0 mt-0.5" size={20} />
        <div>
          <h2 className="font-display font-bold text-gray-800">Nova ronda</h2>
          <p className="text-sm text-gray-600 mt-0.5">
            Escaneie o QR Code na porta do ambiente com a câmera do celular, ou toque no ambiente abaixo pra abrir a ficha manualmente.
          </p>
        </div>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar ambiente por nome ou código..." className="input !pl-9" />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-400">
          <Building2 className="mx-auto mb-2" size={26} /> Nenhum ambiente encontrado.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(a => (
            <button key={a.id} onClick={() => setSelected(a)} className="text-left bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:border-blue-400 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-800">{a.nome}</span>
                <ChevronRight size={16} className="text-gray-300" />
              </div>
              <p className="text-xs text-gray-400 mt-1">{a.tipo} · Bloco {a.bloco} · {a.andar}º andar</p>
              <span className="inline-block mt-2 text-[10px] font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{a.codigo}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FichaInspecao({ ambiente, currentUser, onBack, onSaved }) {
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
      }
      onSaved();
    } catch (e) {
      setErr("Erro ao salvar a inspeção: " + (e.message || e));
    }
    setBusy(false);
  };

  return (
    <div className="max-w-xl">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"><ArrowLeft size={15} /> Voltar</button>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display font-bold text-lg text-gray-800">{ambiente.nome}</h2>
          <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{ambiente.codigo}</span>
        </div>
        <p className="text-xs text-gray-400 mb-4">{ambiente.tipo} · Bloco {ambiente.bloco} · {ambiente.andar}º andar</p>

        <div className="flex gap-4 text-xs text-gray-500 mb-4">
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
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border-2 text-xs font-medium transition-colors ${status === key ? `${st.border} ${st.bg} ${st.text}` : "border-gray-200 text-gray-400"}`}>
                    <Icon size={18} /> {s.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label={`Foto ${!fotoData ? "(obrigatória)" : ""}`}>
            {fotoPreview ? (
              <div className="relative w-32 h-32">
                <img src={fotoPreview} alt="evidência" className="w-32 h-32 object-cover rounded-lg border border-gray-200" />
                <button type="button" onClick={() => { setFotoPreview(null); setFotoData(null); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"><X size={12} /></button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button type="button" onClick={() => cameraRef.current?.click()} className="flex-1 flex flex-col items-center gap-1 border-2 border-dashed border-gray-300 rounded-lg py-4 text-gray-500 hover:border-blue-400 hover:text-blue-600"><Camera size={20} /><span className="text-xs">Câmera</span></button>
                <button type="button" onClick={() => galeriaRef.current?.click()} className="flex-1 flex flex-col items-center gap-1 border-2 border-dashed border-gray-300 rounded-lg py-4 text-gray-500 hover:border-blue-400 hover:text-blue-600"><ImageIcon size={20} /><span className="text-xs">Galeria</span></button>
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
              <p className="text-xs text-gray-500 flex items-center gap-1"><MapPin size={13} /> Lat {geo.lat}, Lng {geo.lng}</p>
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

function InspecoesHistorico({ ambientes, inspecoes, users, minimalFilters }) {
  const [filtros, setFiltros] = useState({ dataIni: "", dataFim: "", bloco: "", andar: "", tipo: "", inspetor: "", status: "", ambiente: "" });
  const [expanded, setExpanded] = useState(null);

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
      <h2 className="font-display font-bold text-xl text-gray-800">{minimalFilters ? "Minhas inspeções" : "Histórico de inspeções"}</h2>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-3"><Filter size={14} /> Filtros</div>
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
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-400">
          <Inbox className="mx-auto mb-2" size={26} /> Nenhuma inspeção encontrada com os filtros atuais.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(i => {
            const st = statusStyle(i.status);
            const Icon = STATUS[i.status].icon;
            const open = expanded === i.id;
            return (
              <div key={i.id} className={`bg-white rounded-xl border ${st.border} shadow-sm overflow-hidden`}>
                <button onClick={() => setExpanded(open ? null : i.id)} className="w-full flex items-center gap-3 p-3.5 text-left">
                  <span className={`shrink-0 ${st.chip} rounded-lg p-2`}><Icon size={16} /></span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800 truncate">{i.ambienteNome}</p>
                    <p className="text-xs text-gray-400">{i.data} às {i.hora} · {i.inspetorNome}</p>
                  </div>
                  <span className={`text-xs font-semibold ${st.text} shrink-0`}>{STATUS[i.status].label}</span>
                </button>
                {open && (
                  <div className="px-3.5 pb-3.5 flex gap-3 border-t border-gray-100 pt-3">
                    {i.foto && <img src={i.foto} alt="evidência" className="w-24 h-24 object-cover rounded-lg border border-gray-200 shrink-0" />}
                    <div className="text-sm text-gray-600 space-y-1">
                      {i.observacao && <p><span className="font-semibold text-gray-700">Observação:</span> {i.observacao}</p>}
                      {i.geo && <p className="text-xs text-gray-400 flex items-center gap-1"><MapPin size={12} /> {i.geo.lat}, {i.geo.lng}</p>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
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
    a.href = url; a.download = "relatorio_limpeza.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const exportarExcel = () => {
    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inspeções");
    XLSX.writeFile(wb, "relatorio_limpeza.xlsx");
  };

  return (
    <div className="space-y-4">
      <h2 className="font-display font-bold text-xl text-gray-800">Relatórios</h2>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <input type="date" className="input !text-xs" value={filtros.dataIni} onChange={e => setFiltros(f => ({ ...f, dataIni: e.target.value }))} />
          <input type="date" className="input !text-xs" value={filtros.dataFim} onChange={e => setFiltros(f => ({ ...f, dataFim: e.target.value }))} />
          <select className="input !text-xs" value={filtros.status} onChange={e => setFiltros(f => ({ ...f, status: e.target.value }))}>
            <option value="">Status: todos</option>
            {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
        </div>
        <p className="text-xs text-gray-400">{filtered.length} registro(s) no período selecionado.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportarCSV} disabled={filtered.length === 0} className="btn-secondary !w-auto px-3.5 disabled:opacity-40"><FileDown size={15} /> Exportar CSV</button>
          <button onClick={exportarExcel} disabled={filtered.length === 0} className="btn-secondary !w-auto px-3.5 disabled:opacity-40"><Sheet size={15} /> Exportar Excel</button>
          <button onClick={() => window.print()} disabled={filtered.length === 0} className="btn-secondary !w-auto px-3.5 disabled:opacity-40"><Printer size={15} /> Exportar PDF (imprimir)</button>
        </div>
      </div>

      <div className="no-print bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-700"><Sparkles size={16} className="text-blue-700" /> Resumo com IA</div>
          <button onClick={gerarResumo} disabled={resumoBusy || filtered.length === 0} className="btn-primary !w-auto px-3.5 disabled:opacity-40">
            {resumoBusy ? <Loader2 className="animate-spin" size={15} /> : <Sparkles size={15} />} {resumoBusy ? "Gerando..." : "Gerar resumo"}
          </button>
        </div>
        {resumoErr && <p className="text-red-600 text-xs font-medium">{resumoErr}</p>}
        {resumo && <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line bg-blue-50 rounded-lg p-3">{resumo}</p>}
        {!resumo && !resumoErr && !resumoBusy && (
          <p className="text-xs text-gray-400">Gera um resumo em português das inspeções filtradas acima — destaques, problemas recorrentes e uma recomendação.</p>
        )}
      </div>

      <div className="print-area bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
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
              <tr key={idx} className="border-t border-gray-100">
                <td className="px-3 py-2 font-medium text-gray-700">{l.Ambiente}</td>
                <td className="px-3 py-2">{l.Status}</td>
                <td className="px-3 py-2 text-gray-500">{l.Observacao || "—"}</td>
                <td className="px-3 py-2">{l.Responsavel}</td>
                <td className="px-3 py-2">{l.Data}</td>
                <td className="px-3 py-2">{l.Hora}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {linhas.length === 0 && <p className="text-center text-gray-400 text-sm py-8">Nenhum dado para exportar.</p>}
      </div>
    </div>
  );
}

/* ------------------------------ notificações -------------------------------- */

function Notificacoes({ notificacoes, onChange }) {
  const marcarLida = async (n) => {
    await markNotificacaoLida(n.id);
    await onChange();
  };

  return (
    <div className="space-y-4">
      <h2 className="font-display font-bold text-xl text-gray-800">Notificações</h2>
      <p className="text-xs text-gray-400 -mt-2">Geradas automaticamente sempre que um ambiente é marcado como "Não Limpo". (Envio por e-mail simulado aqui como notificação interna.)</p>

      {notificacoes.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-400">
          <Bell className="mx-auto mb-2" size={26} /> Nenhuma notificação até o momento.
        </div>
      ) : (
        <div className="space-y-2">
          {notificacoes.map(n => (
            <div key={n.id} className={`bg-white rounded-xl border shadow-sm p-3.5 flex gap-3 ${n.lida ? "border-gray-100 opacity-70" : "border-red-200"}`}>
              {n.foto && <img src={n.foto} className="w-16 h-16 object-cover rounded-lg shrink-0" alt="evidência" />}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-800">{n.ambienteNome} marcado como Não Limpo</p>
                <p className="text-xs text-gray-400">{n.data} às {n.hora} · {n.inspetorNome}</p>
                {n.observacao && <p className="text-xs text-gray-600 mt-1">{n.observacao}</p>}
              </div>
              {!n.lida && (
                <button onClick={() => marcarLida(n)} className="shrink-0 text-xs font-medium text-blue-700 hover:underline self-start">Marcar como lida</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
