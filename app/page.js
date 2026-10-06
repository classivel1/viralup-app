"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck, ChevronRight, Clapperboard, Coins, Download, Film, FolderClock, Image as ImageIcon,
  Layers3, LogIn, LogOut, Menu, Mic2, MonitorUp, PackageOpen, Play, Plus, Settings2, Sparkles,
  Subtitles, Upload, UserRound, Video, Wand2, X, Zap
} from "lucide-react";
import styles from "./studio.module.css";

const SESSION_KEY = "viralup_studio_session";
const PROJECTS_KEY = "viralup_studio_projects";
const DEMO_CREDITS_KEY = "viralup_studio_demo_credits";

const TOOLS = [
  { id: "free-ad", title: "NewViral Free", desc: "Foto → anúncio 9:16 com voz e CTA, sem API e sem créditos.", icon: Zap, tag: "GRÁTIS", kind: "video", accepts: "image/*", cost: 0 },
  { id: "product-video", title: "Foto → Vídeo", desc: "Anime fotos de produtos em anúncios verticais.", icon: Sparkles, tag: "MAIS USADO", kind: "video", accepts: "image/*", cost: 12 },
  { id: "ai-video", title: "Gerador de Vídeo", desc: "Texto ou imagem para vídeo com IA.", icon: Video, tag: "IA", kind: "video", accepts: "image/*,video/*", cost: 18 },
  { id: "ugc", title: "Vídeo UGC", desc: "Roteiros de review, demonstração e unboxing.", icon: UserRound, tag: "VENDA", kind: "video", accepts: "image/*,video/*", cost: 18 },
  { id: "avatar", title: "Avatar IA", desc: "Apresentador virtual para oferta e produto.", icon: Mic2, tag: "IA", kind: "video", accepts: "image/*", cost: 18 },
  { id: "thumbnail", title: "Miniatura IA", desc: "Capas de TikTok, Reels, Shorts e YouTube.", icon: ImageIcon, tag: "IMAGEM", kind: "image", accepts: "image/*", cost: 4 },
  { id: "image-enhancer", title: "Melhorar Imagem", desc: "Recupere definição e prepare fotos para venda.", icon: Wand2, kind: "image", accepts: "image/*", cost: 4 },
  { id: "video-enhancer", title: "Melhorar Vídeo", desc: "Fluxo preparado para upscale e restauração.", icon: MonitorUp, kind: "video", accepts: "video/*", cost: 4 },
  { id: "background", title: "Remover Fundo", desc: "Ferramenta de edição para imagens de produto.", icon: Layers3, kind: "image", accepts: "image/*", cost: 4 },
  { id: "remove-object", title: "Remover Objeto", desc: "Limpeza visual de texto e elementos indesejados.", icon: Wand2, kind: "image", accepts: "image/*", cost: 4 },
  { id: "captions", title: "Legendas IA", desc: "Transcrição, estilo e sincronização de legendas.", icon: Subtitles, kind: "video", accepts: "video/*,audio/*", cost: 3 },
  { id: "noise", title: "Limpar Áudio", desc: "Redução de ruído e preparação de voz.", icon: Mic2, kind: "audio", accepts: "video/*,audio/*", cost: 3 },
  { id: "translator", title: "Traduzir Vídeo", desc: "Fluxo de tradução e dublagem para novos públicos.", icon: Clapperboard, kind: "video", accepts: "video/*", cost: 3 },
];

function loadJson(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
}

function persistJson(key, value) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function tokenHeaders(session) {
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

function formatDate(iso) {
  try { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso)); }
  catch { return "agora"; }
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function StudioPage() {
  const [tab, setTab] = useState("home");
  const [config, setConfig] = useState({ mode: "demo", providers: {}, auth: false, billing: false });
  const [session, setSession] = useState(null);
  const [projects, setProjects] = useState([]);
  const [credits, setCredits] = useState(120);
  const [tool, setTool] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const pollers = useRef(new Map());

  useEffect(() => {
    setSession(loadJson(SESSION_KEY, null));
    setProjects(loadJson(PROJECTS_KEY, []));
    setCredits(Number(localStorage.getItem(DEMO_CREDITS_KEY) || 120));
    fetch("/api/studio/config").then(r => r.json()).then(setConfig).catch(() => {});
    return () => {
      for (const id of pollers.current.values()) clearInterval(id);
      pollers.current.clear();
    };
  }, []);

  useEffect(() => {
    persistJson(PROJECTS_KEY, projects.slice(0, 50));
  }, [projects]);

  useEffect(() => {
    if (session?.access_token) refreshCredits(session);
  }, [session]);

  async function refreshCredits(s = session) {
    if (!s?.access_token) return;
    try {
      const r = await fetch("/api/studio/credits", { headers: tokenHeaders(s) });
      const data = await r.json();
      if (r.ok && Number.isFinite(data.credits)) setCredits(data.credits);
      if (r.status === 401) logout();
    } catch {}
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setCredits(Number(localStorage.getItem(DEMO_CREDITS_KEY) || 120));
  }

  function saveDemoCredits(value) {
    setCredits(value);
    localStorage.setItem(DEMO_CREDITS_KEY, String(value));
  }

  function startPolling(project) {
    if (!project?.providerRef || project.provider === "demo" || project.status === "completed") return;
    if (pollers.current.has(project.id)) return;
    const timer = setInterval(async () => {
      try {
        const q = new URLSearchParams({ provider: project.provider, ref: project.providerRef, model: project.model || "" });
        const r = await fetch(`/api/studio/status?${q}`, { headers: tokenHeaders(session) });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Falha ao consultar processamento");
        setProjects(prev => prev.map(p => p.id === project.id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p));
        if (data.status === "completed" || data.status === "failed") {
          clearInterval(timer);
          pollers.current.delete(project.id);
          refreshCredits();
        }
      } catch (error) {
        setProjects(prev => prev.map(p => p.id === project.id ? { ...p, status: "failed", error: error.message } : p));
        clearInterval(timer);
        pollers.current.delete(project.id);
      }
    }, 6000);
    pollers.current.set(project.id, timer);
  }

  useEffect(() => {
    projects.filter(p => ["queued", "processing"].includes(p.status)).forEach(startPolling);
  }, [projects.length, session?.access_token]);

  async function handleCheckout(pack) {
    if (!session?.access_token) {
      setAuthOpen(true);
      return;
    }
    try {
      const r = await fetch("/api/studio/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...tokenHeaders(session) },
        body: JSON.stringify({ pack })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Não foi possível abrir o pagamento");
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
    } catch (e) { alert(e.message); }
  }

  const providerCount = Object.values(config.providers || {}).filter(Boolean).length;
  const nav = [
    ["home", Zap, "Início"], ["create", Plus, "Criar"], ["projects", FolderClock, "Projetos"], ["credits", Coins, "Créditos"], ["settings", Settings2, "Ajustes"]
  ];

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.brandWrap}>
          <div className={styles.logo}>V</div>
          <div>
            <strong>NewViral Studio</strong>
            <span>AI Creative Suite</span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.creditPill} onClick={() => setTab("credits")}><Coins size={16}/> {credits}</button>
          <button className={styles.userBtn} onClick={() => session ? logout() : setAuthOpen(true)} title={session ? "Sair" : "Entrar"}>
            {session ? <LogOut size={18}/> : <LogIn size={18}/>}<span>{session?.user?.email?.split("@")[0] || "Entrar"}</span>
          </button>
        </div>
      </header>

      <main className={styles.main}>
        {tab === "home" && <HomeView setTab={setTab} setTool={setTool} providerCount={providerCount} config={config}/>} 
        {tab === "create" && <CreateView setTool={setTool}/>} 
        {tab === "projects" && <ProjectsView projects={projects}/>} 
        {tab === "credits" && <CreditsView credits={credits} session={session} billing={config.billing} onCheckout={handleCheckout} onDemoAdd={() => saveDemoCredits(credits + 100)}/>} 
        {tab === "settings" && <SettingsView config={config} session={session}/>} 
      </main>

      <nav className={styles.nav}>
        {nav.map(([id, Icon, label]) => (
          <button key={id} className={tab === id ? styles.navActive : ""} onClick={() => setTab(id)}>
            <Icon size={19}/><span>{label}</span>
          </button>
        ))}
      </nav>

      {tool && <ToolModal tool={tool} config={config} session={session} credits={credits} onClose={() => setTool(null)} onNeedAuth={() => setAuthOpen(true)} onCreated={(project, cost) => {
        setProjects(prev => [project, ...prev]);
        if (!session) saveDemoCredits(Math.max(0, credits - cost));
        setTool(null);
        setTab("projects");
        startPolling(project);
        refreshCredits();
      }}/>} 
      {authOpen && <AuthModal config={config} onClose={() => setAuthOpen(false)} onSession={(s) => {
        setSession(s); persistJson(SESSION_KEY, s); setAuthOpen(false);
      }}/>} 
    </div>
  );
}

function HomeView({ setTab, setTool, providerCount, config }) {
  return <>
    <section className={styles.hero}>
      <div className={styles.heroCopy}>
        <span className={styles.kicker}><Sparkles size={14}/> MODO FREE · SEM API</span>
        <h1>Transforme produtos em conteúdo que vende.</h1>
        <p>Comece grátis: envie uma foto e gere vídeo vertical com movimento, voz local e CTA sem chave de API.</p>
        <div className={styles.heroButtons}>
          <button className={styles.primary} onClick={() => setTool(TOOLS[0])}><Play size={18}/> Criar vídeo</button>
          <button className={styles.secondary} onClick={() => setTab("create")}><Wand2 size={18}/> Ver ferramentas</button>
        </div>
      </div>
      <div className={styles.heroPanel}>
        <div className={styles.phonePreview}>
          <div className={styles.previewTop}><span>9:16</span><span>AI</span></div>
          <div className={styles.previewCenter}><Film size={44}/><strong>Produto → Reel</strong><span>movimento · áudio · CTA</span></div>
          <div className={styles.previewProgress}><i/></div>
        </div>
        <div className={styles.statusCard}>
          <span className={styles.statusDot}/><div><b>{providerCount ? `${providerCount} provedores prontos` : "Modo demonstração"}</b><small>{config.providers?.gemini ? "Veo 3.1 disponível" : "Adicione as chaves no servidor"}</small></div>
        </div>
      </div>
    </section>

    <div className={styles.sectionTitle}><div><span>Ferramentas</span><h2>Comece por aqui</h2></div><button onClick={() => setTab("create")}>Ver todas <ChevronRight size={16}/></button></div>
    <div className={styles.toolGrid}>{TOOLS.slice(0, 8).map(t => <ToolCard key={t.id} tool={t} onClick={() => setTool(t)}/>)}</div>

    <section className={styles.pipelineBanner}>
      <div className={styles.pipelineIcon}><PackageOpen size={28}/></div>
      <div><span>SEU FLUXO ANTERIOR FOI PRESERVADO</span><h3>Pipeline NewViral de episódios e pacotes</h3><p>Continue usando o sistema de edição, capas, ZIP e publicação que já existia.</p></div>
      <a href="/pipeline">Abrir pipeline <ChevronRight size={17}/></a>
    </section>
  </>;
}

function CreateView({ setTool }) {
  const groups = [
    ["Criar com IA", TOOLS.slice(0,5)],
    ["Editar e melhorar", TOOLS.slice(5,9)],
    ["Áudio e idioma", TOOLS.slice(9)]
  ];
  return <>
    <PageHead title="Criar" text="Escolha uma ferramenta e monte seu próximo conteúdo."/>
    {groups.map(([name, items]) => <section key={name} className={styles.group}><h3>{name}</h3><div className={styles.toolGrid}>{items.map(t => <ToolCard key={t.id} tool={t} onClick={() => setTool(t)}/>)}</div></section>)}
  </>;
}

function ToolCard({ tool, onClick }) {
  const Icon = tool.icon;
  return <button className={styles.toolCard} onClick={onClick}>
    {tool.tag && <span className={styles.toolTag}>{tool.tag}</span>}
    <span className={styles.toolIcon}><Icon size={22}/></span>
    <strong>{tool.title}</strong><p>{tool.desc}</p>
    <span className={styles.toolFooter}>{tool.cost === 0 ? "Grátis · sem API" : `${tool.cost} créditos`} <ChevronRight size={15}/></span>
  </button>;
}

function ProjectsView({ projects }) {
  return <>
    <PageHead title="Projetos" text="Acompanhe gerações e resultados recentes."/>
    {!projects.length ? <div className={styles.empty}><FolderClock size={34}/><strong>Nenhum projeto ainda</strong><p>Crie seu primeiro conteúdo no Studio.</p></div> : <div className={styles.projectList}>{projects.map(p => <ProjectCard key={p.id} project={p}/>)}</div>}
  </>;
}

function ProjectCard({ project }) {
  const done = project.status === "completed";
  const failed = project.status === "failed";
  const pct = done ? 100 : failed ? 100 : Math.max(1, Math.min(99, Number(project.progress) || 8));
  const stage = done ? "Concluído" : failed ? "Falhou" : pct < 15 ? "Preparando tarefa" : pct < 30 ? "Enviando para o modelo" : pct < 75 ? "IA gerando o vídeo" : pct < 95 ? "Finalizando render" : "Salvando resultado";
  return <article className={styles.projectCard}>
    <div className={styles.projectThumb}>
      {project.resultUrl && project.kind === "image" ? <img src={project.resultUrl} alt="resultado"/> : project.resultUrl && project.kind === "video" ? <video src={project.resultUrl} controls playsInline/> : <Film size={28}/>} 
    </div>
    <div className={styles.projectBody}>
      <div className={styles.projectTop}><div><strong>{project.title}</strong><span>{project.providerLabel || project.provider} · {project.aspect || "9:16"}</span></div><span className={`${styles.state} ${done ? styles.done : failed ? styles.failed : styles.running}`}>{done ? "Concluído" : failed ? "Erro" : project.status === "queued" ? "Na fila" : "Processando"}</span></div>
      {!failed && <div className={styles.projectProgressWrap}>
        <div className={styles.projectProgressMeta}><span>{stage}</span><strong>{pct}%</strong></div>
        <div className={styles.progress}><i style={{width: `${pct}%`}}/></div>
      </div>}
      {project.error && <p className={styles.errorText}>{project.error}</p>}
      <div className={styles.projectBottom}><small>{formatDate(project.createdAt)}</small>{project.resultUrl && <a href={project.resultUrl} target="_blank" rel="noreferrer"><Download size={15}/> Abrir resultado</a>}</div>
    </div>
  </article>;
}

function CreditsView({ credits, session, billing, onCheckout, onDemoAdd }) {
  const packs = [
    { id: "starter", credits: 120, price: "R$ 29,90", label: "Inicial" },
    { id: "creator", credits: 350, price: "R$ 69,90", label: "Creator", popular: true },
    { id: "pro", credits: 900, price: "R$ 149,90", label: "Pro" },
  ];
  return <>
    <PageHead title="Créditos" text="Cada geração desconta apenas o recurso utilizado."/>
    <div className={styles.balanceCard}><div><span>SALDO DISPONÍVEL</span><strong>{credits}</strong><small>créditos</small></div><Coins size={42}/></div>
    <div className={styles.packGrid}>{packs.map(p => <button key={p.id} className={`${styles.packCard} ${p.popular ? styles.popular : ""}`} onClick={() => billing ? onCheckout(p.id) : !session ? onDemoAdd() : alert("Configure MERCADOPAGO_ACCESS_TOKEN no servidor para ativar pagamentos reais.")}>
      {p.popular && <span>MAIS VANTAJOSO</span>}<b>{p.label}</b><strong>{p.credits} créditos</strong><small>{p.price}</small>
    </button>)}</div>
    <div className={styles.infoCard}><BadgeCheck size={20}/><div><b>{billing ? "Mercado Pago conectado" : "Pagamento em modo de configuração"}</b><p>{billing ? "O crédito é liberado após confirmação do pagamento." : "O fluxo está pronto; falta apenas cadastrar a credencial privada no ambiente do servidor."}</p></div></div>
  </>;
}

function SettingsView({ config, session }) {
  const providers = [
    ["free", "NewViral Free", "Foto → vídeo + voz local · sem API"],
    ["pollinations", "Pollinations", "Vídeo IA · usa Pollen disponível"],
    ["ffmpeg", "FFmpeg Local", "Motor interno do modo grátis"],
    ["gemini", "Google Veo 3.1", "Vídeo premium"],
    ["runway", "Runway Gen-4.5", "Vídeo premium alternativo"],
    ["fal", "Kling 2.6 / fal.ai", "Vídeo de reserva"],
    ["openai", "OpenAI GPT Image 2.5", "Capas e imagens"],
    ["supabase", "Supabase", "Login, banco e créditos"],
    ["mercadopago", "Mercado Pago", "Compra de créditos"],
  ];
  return <>
    <PageHead title="Ajustes" text="Estado das integrações do seu Studio."/>
    <div className={styles.settingCard}>
      <div className={styles.settingHead}><strong>Modo atual</strong><span className={`${styles.state} ${config.mode === "live" ? styles.done : styles.running}`}>{config.mode === "live" ? "Produção" : "Demonstração"}</span></div>
      <p>As chaves ficam somente no servidor. O aplicativo Android nunca recebe seus segredos.</p>
    </div>
    <div className={styles.settingCard}><strong>Integrações</strong><div className={styles.providerList}>{providers.map(([key, name, desc]) => {
      const ok = key === "supabase" ? config.auth : key === "mercadopago" ? config.billing : config.providers?.[key];
      return <div className={styles.providerRow} key={key}><span className={`${styles.providerDot} ${ok ? styles.providerOn : ""}`}/><div><b>{name}</b><small>{desc}</small></div><em>{ok ? "Conectado" : "Pendente"}</em></div>;
    })}</div></div>
    <div className={styles.settingCard}><strong>Conta</strong><p>{session?.user?.email || "Você está usando o modo local. Entre para sincronizar saldo e projetos no banco."}</p></div>
    <a className={styles.legacyLink} href="/pipeline"><PackageOpen size={18}/> Abrir pipeline NewViral anterior <ChevronRight size={17}/></a>
  </>;
}

function PageHead({ title, text }) { return <div className={styles.pageHead}><h1>{title}</h1><p>{text}</p></div>; }

function ToolModal({ tool, config, session, credits, onClose, onNeedAuth, onCreated }) {
  const isFreeTool = tool.id === "free-ad";
  const [prompt, setPrompt] = useState("");
  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState("");
  const [cta, setCta] = useState("Confira agora");
  const [style, setStyle] = useState("oferta");
  const [voice, setVoice] = useState("pt-br-f");
  const [aspect, setAspect] = useState("9:16");
  const [quality, setQuality] = useState("720p");
  const [duration, setDuration] = useState("8");
  const [provider, setProvider] = useState(isFreeTool ? "ffmpeg" : "auto");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState("");
  const progressTimer = useRef(null);
  const fileRef = useRef(null);
  const Icon = tool.icon;

  useEffect(() => () => {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    if (progressTimer.current) clearInterval(progressTimer.current);
  }, [preview]);

  function chooseFile(f) {
    if (!f) return;
    if (f.size > 12 * 1024 * 1024) return alert("Use um arquivo de até 12 MB nesta versão.");
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setFile(f); setPreview(URL.createObjectURL(f));
  }

  const videoTool = tool.kind === "video";
  const realPossible = isFreeTool || (videoTool ? (config.providers?.pollinations || config.providers?.ffmpeg || config.providers?.gemini || config.providers?.runway || config.providers?.fal) : config.providers?.openai);
  const freeVideoSelected = isFreeTool || (videoTool && (
    provider === "pollinations" ||
    provider === "ffmpeg" ||
    (provider === "auto" && (config.providers?.pollinations || (config.providers?.ffmpeg && file)))
  ));
  const generationCost = freeVideoSelected ? 0 : tool.cost;

  async function generate() {
    if (credits < generationCost) return alert("Créditos insuficientes.");
    if (isFreeTool && !file) return alert("Adicione uma foto do produto para usar o NewViral Free.");
    if (!prompt.trim() && ["product-video","ai-video","ugc","avatar","thumbnail"].includes(tool.id)) return alert("Escreva uma instrução para a IA.");
    setBusy(true);
    setLoadingProgress(4);
    setLoadingStage("Preparando sua tarefa");
    if (progressTimer.current) clearInterval(progressTimer.current);
    try {
      let inputDataUrl = null;
      if (file) {
        setLoadingProgress(10);
        setLoadingStage("Carregando a mídia");
        inputDataUrl = await readAsDataUrl(file);
      }
      setLoadingProgress(22);
      const selectedProvider = isFreeTool ? "NewViral Free" : provider === "auto"
        ? (config.providers?.ffmpeg && file ? "NewViral Free" : config.providers?.pollinations ? "Pollinations" : config.providers?.runway ? "Runway" : config.providers?.gemini ? "Veo" : config.providers?.fal ? "Kling" : "modelo")
        : provider === "pollinations" ? "Pollinations"
        : provider === "ffmpeg" ? "FFmpeg Local"
        : provider === "runway" ? "Runway"
        : provider === "veo" ? "Veo"
        : provider === "kling" ? "Kling" : "modelo";
      setLoadingStage(`Enviando para ${selectedProvider}`);
      progressTimer.current = setInterval(() => {
        setLoadingProgress(current => {
          if (current >= 92) return current;
          if (current < 40) return current + 3;
          if (current < 70) return current + 2;
          return current + 1;
        });
      }, 1100);
      setTimeout(() => setLoadingStage(`Gerando com ${selectedProvider}`), 1600);
      const r = await fetch("/api/studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...tokenHeaders(session) },
        body: JSON.stringify({ tool: tool.id, prompt, aspect, quality, duration, provider: isFreeTool ? "ffmpeg" : provider, inputDataUrl, inputMime: file?.type || null, kind: tool.kind, productName, price, cta, style, voice })
      });
      const data = await r.json();
      if (progressTimer.current) { clearInterval(progressTimer.current); progressTimer.current = null; }
      if (r.status === 401) { onNeedAuth(); throw new Error("Entre na conta para usar este saldo."); }
      if (!r.ok) throw new Error(data.error || "Não foi possível iniciar a geração.");
      const project = {
        id: data.id || crypto.randomUUID(), title: tool.title, tool: tool.id, kind: tool.kind,
        prompt, aspect, quality, duration, provider: data.provider || "demo", providerLabel: data.providerLabel,
        providerRef: data.providerRef || null, model: data.model || "", status: data.status || "queued", progress: data.progress || 8,
        resultUrl: data.resultUrl || null, createdAt: new Date().toISOString()
      };
      setLoadingProgress(96);
      setLoadingStage(data.status === "completed" ? "Finalizando e salvando o vídeo" : "Tarefa criada · acompanhando processamento");
      await new Promise(resolve => setTimeout(resolve, 450));
      setLoadingProgress(100);
      setLoadingStage(data.status === "completed" ? "Concluído" : "Enviado para processamento");
      await new Promise(resolve => setTimeout(resolve, 350));
      onCreated(project, Number.isFinite(data.cost) ? data.cost : generationCost);
    } catch (e) {
      if (progressTimer.current) { clearInterval(progressTimer.current); progressTimer.current = null; }
      setLoadingStage("Não foi possível concluir");
      alert(e.message);
    }
    finally {
      if (progressTimer.current) { clearInterval(progressTimer.current); progressTimer.current = null; }
      setBusy(false);
    }
  }

  return <div className={styles.overlay} onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className={styles.modal}>
      <div className={styles.modalHead}><div className={styles.modalTitle}><span><Icon size={22}/></span><div><small>CRIAR COM IA</small><strong>{tool.title}</strong></div></div><button onClick={onClose}><X size={20}/></button></div>
      <div className={styles.modalBody}>
        <button className={styles.uploadBox} onClick={() => fileRef.current?.click()}>
          {preview ? (file?.type.startsWith("video/") ? <video src={preview} muted playsInline/> : <img src={preview} alt="prévia"/>) : <><Upload size={30}/><strong>Adicionar mídia</strong><span>{tool.accepts?.includes("image") ? "Foto ou arquivo compatível" : "Vídeo ou áudio"}</span></>}
        </button>
        <input ref={fileRef} hidden type="file" accept={tool.accepts} onChange={e => chooseFile(e.target.files?.[0])}/>
        {isFreeTool && <div className={styles.formGrid}>
          <div><label>Produto</label><input value={productName} onChange={e => setProductName(e.target.value)} placeholder="Ex.: Camisa country"/></div>
          <div><label>Preço (opcional)</label><input value={price} onChange={e => setPrice(e.target.value)} placeholder="Ex.: R$ 79,90"/></div>
          <div><label>Estilo</label><select value={style} onChange={e => setStyle(e.target.value)}><option value="oferta">Oferta direta</option><option value="country">Country</option><option value="ugc">UGC simples</option><option value="clean">Clean</option></select></div>
          <div><label>Voz</label><select value={voice} onChange={e => setVoice(e.target.value)}><option value="pt-br-f">Feminina PT-BR</option><option value="pt-br-m">Masculina PT-BR</option><option value="pt">Português neutro</option></select></div>
        </div>}
        {isFreeTool && <><label>CTA</label><input value={cta} onChange={e => setCta(e.target.value)} placeholder="Ex.: Acesse o link na bio"/></>}
        <label>{isFreeTool ? "Narração (opcional)" : "Instrução para a IA"}</label>
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder={isFreeTool ? "Deixe em branco para o NewViral montar uma narração automática, ou escreva aqui exatamente o que a voz deve falar." : "Ex.: mantenha o produto fiel à foto, movimentos naturais de câmera, iluminação de loja premium, foco nos detalhes, anúncio vertical para Reels..."}/>
        <div className={styles.formGrid}>
          <div><label>Formato</label><select value={aspect} onChange={e => setAspect(e.target.value)}><option>9:16</option><option>16:9</option><option>1:1</option></select></div>
          <div><label>Duração</label><select value={duration} onChange={e => setDuration(e.target.value)}><option value="4">4 s</option><option value="5">5 s</option><option value="8">8 s</option><option value="10">10 s</option><option value="12">12 s</option></select></div>
          <div><label>Qualidade</label><select value={quality} onChange={e => setQuality(e.target.value)}><option value="720p">720p</option><option value="1080p">1080p</option><option value="4k">4K</option></select></div>
          {!isFreeTool && <div><label>Modelo</label><select value={provider} onChange={e => setProvider(e.target.value)}><option value="auto">{config.providers?.ffmpeg ? "Automático (grátis primeiro)" : config.providers?.pollinations ? "Automático (Pollinations primeiro)" : "Automático"}</option><option value="ffmpeg">NewViral Free · sem API</option><option value="pollinations">Pollinations</option><option value="runway">Runway Gen-4.5</option><option value="veo">Veo 3.1</option><option value="kling">Kling 2.6</option>{tool.kind === "image" && <option value="openai">GPT Image 2.5</option>}</select></div>}
        </div>
        <div className={styles.modalNotice}><span className={`${styles.statusDot} ${realPossible ? styles.green : ""}`}/><div><b>{isFreeTool ? "Modo Free pronto" : realPossible ? "Há provedor real configurado" : "Modo demonstração ativo"}</b><small>{isFreeTool ? "Sem API, sem login obrigatório e sem consumo de créditos. O vídeo é processado localmente no servidor." : realPossible ? "A solicitação será enviada pelo servidor sem expor a chave." : "O fluxo será simulado até configurar uma API."}</small></div></div>
        {busy && <div className={styles.generationLoader}>
          <div className={styles.loaderTop}>
            <div className={styles.loaderIdentity}><span className={styles.spinner}/><div><strong>{loadingStage || "Preparando"}</strong><small>Não feche esta tela enquanto a tarefa é enviada.</small></div></div>
            <b>{loadingProgress}%</b>
          </div>
          <div className={styles.loaderTrack}><i style={{width: `${loadingProgress}%`}}/></div>
          <div className={styles.loaderSteps}>
            <span className={loadingProgress >= 10 ? styles.loaderStepOn : ""}>Mídia</span>
            <span className={loadingProgress >= 22 ? styles.loaderStepOn : ""}>Envio</span>
            <span className={loadingProgress >= 40 ? styles.loaderStepOn : ""}>Geração</span>
            <span className={loadingProgress >= 90 ? styles.loaderStepOn : ""}>Finalização</span>
          </div>
        </div>}
        <button className={styles.generateBtn} disabled={busy} onClick={generate}>{busy ? <>{loadingProgress}% · {loadingStage || "Processando"}</> : <><Sparkles size={18}/> {generationCost === 0 ? "Gerar agora · grátis" : `Gerar agora · ${generationCost} créditos`}</>}</button>
      </div>
    </div>
  </div>;
}

function AuthModal({ config, onClose, onSession }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!config.auth) return alert("Configure Supabase no servidor para ativar login real.");
    setBusy(true);
    try {
      const r = await fetch("/api/studio/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: mode, email, password }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Falha na autenticação");
      if (mode === "signup" && !data.access_token) return alert("Cadastro criado. Confirme seu e-mail antes de entrar.");
      onSession(data);
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  }

  return <div className={styles.overlay} onMouseDown={e => e.target === e.currentTarget && onClose()}><div className={`${styles.modal} ${styles.authModal}`}>
    <div className={styles.modalHead}><div className={styles.modalTitle}><span><UserRound size={22}/></span><div><small>CONTA VIRALUP</small><strong>{mode === "login" ? "Entrar" : "Criar conta"}</strong></div></div><button onClick={onClose}><X size={20}/></button></div>
    <div className={styles.modalBody}>
      <div className={styles.authSwitch}><button className={mode === "login" ? styles.switchActive : ""} onClick={() => setMode("login")}>Entrar</button><button className={mode === "signup" ? styles.switchActive : ""} onClick={() => setMode("signup")}>Cadastrar</button></div>
      <label>E-mail</label><input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="voce@email.com"/>
      <label>Senha</label><input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="mínimo 8 caracteres"/>
      <button className={styles.generateBtn} onClick={submit} disabled={busy || !email || password.length < 8}>{busy ? "Aguarde..." : mode === "login" ? "Entrar na conta" : "Criar minha conta"}</button>
      {!config.auth && <p className={styles.errorText}>Supabase ainda não está configurado no servidor.</p>}
    </div>
  </div></div>;
}
