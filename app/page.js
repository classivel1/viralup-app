"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import {
  BadgeCheck, Clapperboard, Copy, Download, ExternalLink, Film, Home as HomeIcon, Image as ImageIcon,
  ChevronRight, Library, Link as LinkIcon, Package, Play, Plus, Send, Settings, ShieldCheck, Smartphone,
  Trash2, Upload, UserCheck, Video, Zap
} from "lucide-react";

const DB_NAME = "viralup-studio";
const STORE = "videos";
const SETTINGS_KEY = "viralup-auto-settings";
const ACCOUNTS_KEY = "viralup-authorized-accounts";
const EMBEDS_KEY = "viralup-official-embeds";
const OFFICIAL_EMBEDS = {
  "ReelShort / RS Boost": [
    {
      episode: 1,
      title: "Episódio 1",
      src: "https://www.reelshort.com/pt/embed/6aad002ad47530b9bc0fa1d1-0keqwyvo48?show_controls=true&cps_id=18416&code=4994030"
    }
  ]
};
const DEFAULT_ACCOUNTS = [{ id: "reelshort-tiktok-viralup", platform: "TikTok", account: "@viralup", source: "ReelShort / RS Boost", status: "Pending Update", note: "Cadastro enviado ao Creator Safelist", updatedAt: "2026-09-30" }];

const SOURCE_PRESETS = {
  "ReelShort / RS Boost": {
    rightsType: "Campanha promocional autorizada",
    campaign: "Apaixonada pelo Dr. Papai do Bebê!",
    authorization: "RS Boost Creator Safelist | TikTok @viralup | Status: Pending Update | Cadastro: 30/09/2026",
    cta: "Siga a @viralup para mais episódios",
    totalEpisodes: 85,
    freeEpisodes: 7,
    promoLink: "https://reelslink.com/cps/hlj7F0",
    appPromoLink: "https://reelslink.com/cps/7VN12i",
    contentReferralCode: "4993960",
    episodeStrategy: "Funil de 7 episódios autorizados",
    sourcePage: "https://cps.reelshort.com/resource-square/detail/67f790bf2e5020721707e329?app=reelshort&book_type=0"
  },
  "NetShort": {
    rightsType: "Parceria / afiliado",
    campaign: "",
    authorization: "",
    cta: "Siga a @viralup para mais episódios"
  },
  "Upload próprio": {
    rightsType: "Conteúdo próprio",
    campaign: "ViralUp Original",
    authorization: "Conteúdo próprio da ViralUp",
    cta: "Siga a @viralup para mais vídeos"
  },
  "Outro parceiro": {
    rightsType: "Outro",
    campaign: "",
    authorization: "",
    cta: "Siga a @viralup para mais vídeos"
  }
};

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbAction(mode, action) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    action(tx.objectStore(STORE), resolve, reject);
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllVideos() {
  return dbAction("readonly", (store, resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result.sort((a,b)=>b.createdAt-a.createdAt));
    req.onerror = () => reject(req.error);
  });
}

async function saveVideo(item) {
  return dbAction("readwrite", (store, resolve) => {
    store.put(item);
    resolve();
  });
}

async function deleteVideo(id) {
  return dbAction("readwrite", (store, resolve) => {
    store.delete(id);
    resolve();
  });
}

function mb(size) {
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function baseName(name) {
  return name.replace(/\.[^.]+$/, "");
}

function titleize(value) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function slug(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 70) || "viralup-video";
}

function buildMetadata(file, settings, index) {
  const raw = titleize(baseName(file.name));
  const campaign = titleize(settings.campaign || "");
  const episodeNumber = index + 1;
  const isReelShort = settings.source === "ReelShort / RS Boost";
  const isLastFreeEpisode = isReelShort && Number(settings.freeEpisodes) > 0 && episodeNumber === Number(settings.freeEpisodes);
  const title = campaign ? `${campaign} • Episódio ${episodeNumber} • ${raw}` : `Episódio ${episodeNumber} • ${raw}`;

  const hooks = [
    "Você precisa ver isso até o fim.",
    "O final muda tudo.",
    "Esse momento merece atenção.",
    "A decisão dela muda tudo.",
    "Você faria o mesmo nessa situação?",
    "Espere até ver o que acontece depois."
  ];
  const hook = hooks[index % hooks.length];

  const standardCta = settings.cta?.trim() || "Siga a @viralup para mais episódios";
  const finalCta = settings.promoLink?.trim()
    ? "Quer continuar a história? Assista aos próximos episódios pelo link da bio."
    : "Quer continuar a história? Procure o link oficial da campanha na bio.";
  const cta = isLastFreeEpisode ? finalCta : standardCta;

  const hashtags = ["#ViralUp", "#MiniDrama", "#SerieCurta", "#TikTokSeries", "#Entretenimento"];
  const caption = `${hook} Episódio ${episodeNumber}: ${campaign || raw}. ${cta} ${hashtags.join(" ")}`;
  const filename = `${slug(campaign || raw)}-ep-${String(episodeNumber).padStart(2,"0")}-viralup`;

  return {
    title,
    caption,
    hashtags,
    filename,
    episodeNumber,
    isLastFreeEpisode,
    promoLink: settings.promoLink || "",
    funnelStage: isLastFreeEpisode ? "redirect" : "retention"
  };
}

async function makeCover(videoBlob, title) {
  const url = URL.createObjectURL(videoBlob);
  try {
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;

    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = reject;
    });

    const seekTo = Math.min(Math.max(video.duration * 0.18, 0.5), Math.max(video.duration - 0.2, 0.5));
    video.currentTime = seekTo;
    await new Promise((resolve) => {
      video.onseeked = resolve;
      setTimeout(resolve, 1200);
    });

    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#08090b";
    ctx.fillRect(0, 0, 1080, 1920);

    const vw = video.videoWidth || 1080;
    const vh = video.videoHeight || 1920;
    const scale = Math.min(1080 / vw, 1920 / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    ctx.drawImage(video, (1080-dw)/2, (1920-dh)/2, dw, dh);

    const grad = ctx.createLinearGradient(0, 1250, 0, 1920);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,.88)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 1180, 1080, 740);

    ctx.fillStyle = "#ff6422";
    ctx.font = "900 58px Arial";
    ctx.fillText("ViralUp", 64, 120);

    ctx.fillStyle = "#fff";
    ctx.font = "900 72px Arial";
    const words = title.split(" ");
    const lines = [];
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > 900 && line) {
        lines.push(line);
        line = word;
      } else line = test;
      if (lines.length === 2) break;
    }
    if (line && lines.length < 3) lines.push(line);
    lines.slice(0,3).forEach((text, i)=>ctx.fillText(text, 64, 1540 + i*88));

    ctx.fillStyle = "#ff6a22";
    ctx.font = "700 36px Arial";
    ctx.fillText("@ViralUp", 64, 1845);

    return await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1500);
}

export default function Home() {
  const inputRef = useRef(null);
  const [library, setLibrary] = useState([]);
  const [queue, setQueue] = useState([]);
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState("");
  const [status, setStatus] = useState("");
  const [installPrompt, setInstallPrompt] = useState(null);
  const [accounts, setAccounts] = useState(DEFAULT_ACCOUNTS);
  const [embeds, setEmbeds] = useState(OFFICIAL_EMBEDS["ReelShort / RS Boost"] || []);
  const [embedEpisode, setEmbedEpisode] = useState(2);
  const [embedCode, setEmbedCode] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [linkEpisode, setLinkEpisode] = useState(1);
  const [importingUrl, setImportingUrl] = useState(false);
  const [publishPlatform, setPublishPlatform] = useState("TikTok");
  const [kwaiEpisodeTitle, setKwaiEpisodeTitle] = useState("");
  const [kwaiEpisodeNumber, setKwaiEpisodeNumber] = useState(1);
  const [settings, setSettings] = useState({
    source: "ReelShort / RS Boost",
    sourceCustom: "",
    ...SOURCE_PRESETS["ReelShort / RS Boost"],
    autoMode: true,
    autoDownload: false
  });

  const refresh = async () => setLibrary(await getAllVideos());

  useEffect(() => {
    refresh().catch(() => setStatus("Não foi possível abrir a biblioteca deste aparelho."));
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
      if (saved) {
        const source = saved.source || "ReelShort / RS Boost";
        const preset = SOURCE_PRESETS[source] || {};
        const hydrated = { ...preset, ...saved };
        if (source === "ReelShort / RS Boost" && !hydrated.authorization) {
          Object.assign(hydrated, SOURCE_PRESETS["ReelShort / RS Boost"]);
        }
        setSettings((s) => ({ ...s, ...hydrated }));
      }
      const savedAccounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "null");
      if (savedAccounts?.length) setAccounts(savedAccounts);
      else localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(DEFAULT_ACCOUNTS));

      const savedEmbeds = JSON.parse(localStorage.getItem(EMBEDS_KEY) || "null");
      if (savedEmbeds?.length) setEmbeds(savedEmbeds);
      else localStorage.setItem(EMBEDS_KEY, JSON.stringify(OFFICIAL_EMBEDS["ReelShort / RS Boost"] || []));
    } catch {}

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const onInstall = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    return () => window.removeEventListener("beforeinstallprompt", onInstall);
  }, []);

  const stats = useMemo(() => ({
    imported: library.length,
    processing: busy ? 1 : 0,
    ready: library.filter((x) => x.status === "ready").length
  }), [library, busy]);

  const resolvedSource = settings.source === "Outro parceiro"
    ? settings.sourceCustom.trim()
    : settings.source.trim();
  const configured = Boolean(resolvedSource && settings.authorization.trim());

  function saveSettings(next = settings) {
    setSettings(next);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    setStatus("Padrão automático salvo neste aparelho.");
  }

  function applySourcePreset(source) {
    const preset = SOURCE_PRESETS[source] || SOURCE_PRESETS["Outro parceiro"];
    const next = {
      ...settings,
      source,
      sourceCustom: source === "Outro parceiro" ? settings.sourceCustom : "",
      ...preset
    };
    setSettings(next);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    setStatus(source === "ReelShort / RS Boost"
      ? "Fonte ReelShort configurada automaticamente com a Safelist do TikTok @viralup."
      : `Fonte ${source} configurada. Complete a autorização quando necessário.`);
  }

  function pickFiles() {
    inputRef.current?.click();
  }

  function saveEmbed() {
    const raw = embedCode.trim();
    if (!raw) return setStatus("Cole o código Embed do episódio.");

    const match = raw.match(/src=["']([^"']+)["']/i);
    if (!match?.[1]) return setStatus("Não encontrei o endereço do player dentro desse código Embed.");

    const src = match[1].replace(/\s+/g, "");
    if (!/^https:\/\/(www\.)?reelshort\.com\//i.test(src)) {
      return setStatus("Esse Embed não parece ser um player oficial do ReelShort.");
    }

    const episode = Number(embedEpisode);
    if (!episode || episode < 1) return setStatus("Informe um número de episódio válido.");

    const next = [
      ...embeds.filter((item) => item.episode !== episode),
      { episode, title: `Episódio ${episode}`, src }
    ].sort((a,b)=>a.episode-b.episode);

    setEmbeds(next);
    localStorage.setItem(EMBEDS_KEY, JSON.stringify(next));
    setEmbedCode("");
    setEmbedEpisode(episode + 1);
    setStatus(`Episódio ${episode} salvo no player oficial.`);
  }

  function removeEmbed(episode) {
    const next = embeds.filter((item)=>item.episode !== episode);
    setEmbeds(next);
    localStorage.setItem(EMBEDS_KEY, JSON.stringify(next));
    setStatus(`Episódio ${episode} removido do player.`);
  }

  async function importVideoUrl(urlOverride) {
    const url = (urlOverride ?? videoUrl).trim();
    if (!url || importingUrl) return;
    if (!configured) return setStatus("Configure a origem e a autorização antes de importar por link.");

    setImportingUrl(true);
    setStatus("Importando vídeo pelo link...");

    try {
      const response = await fetch("/api/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Não foi possível importar esse link.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const nameMatch = disposition.match(/filename="?([^"]+)"?/i);
      const fallbackName = `episodio-${linkEpisode}.mp4`;
      const filename = nameMatch?.[1] || fallbackName;
      const file = new File([blob], filename, { type: blob.type || "video/mp4" });

      setVideoUrl("");
      await runBatch([file], Math.max(Number(linkEpisode) - 1, 0));
      setLinkEpisode((n) => Number(n) + 1);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setImportingUrl(false);
    }
  }

  async function installApp() {
    if (!installPrompt) {
      setStatus("No Android/Chrome, abra o menu do navegador e escolha “Adicionar à tela inicial” ou “Instalar app”.");
      return;
    }
    await installPrompt.prompt();
    await installPrompt.userChoice.catch(() => null);
    setInstallPrompt(null);
  }

  function goTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function onFiles(event) {
    const list = Array.from(event.target.files || []);
    const valid = list.filter((file) => file.type.startsWith("video/") && file.size <= 25 * 1024 * 1024);
    const rejected = list.length - valid.length;
    setQueue(valid);
    if (rejected) setStatus(`${rejected} arquivo(s) ignorado(s): formato inválido ou acima de 25 MB.`);
    else setStatus(`${valid.length} vídeo(s) adicionados à fila.`);

    if (valid.length && settings.autoMode && configured) await runBatch(valid);
  }

  async function runBatch(files = queue, startIndex = 0) {
    if (!files.length) return setStatus("Adicione um ou mais vídeos.");
    if (!configured) return setStatus("Preencha origem e autorização de uso antes de automatizar.");

    setBusy(true);
    let done = 0;

    for (const [index, file] of files.entries()) {
      const meta = buildMetadata(file, settings, index + startIndex);
      setCurrent(file.name);
      setStatus(`Processando ${index + 1} de ${files.length}: ${file.name}`);

      try {
        const data = new FormData();
        data.append("video", file);
        data.append("cta", settings.cta || "Siga a ViralUp");

        const response = await fetch("/api/process", { method: "POST", body: data });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || "Falha no processamento");
        }

        const blob = await response.blob();
        const cover = await makeCover(blob, meta.title);
        const item = {
          id: crypto.randomUUID(),
          ...meta,
          source: resolvedSource,
          sourceType: settings.source,
          rightsType: settings.rightsType,
          campaign: settings.campaign.trim(),
          authorization: settings.authorization.trim(),
          cta: meta.isLastFreeEpisode
            ? "Quer continuar a história? Assista aos próximos episódios pelo link da bio."
            : settings.cta.trim(),
          totalEpisodes: Number(settings.totalEpisodes) || null,
          freeEpisodes: Number(settings.freeEpisodes) || null,
          promoLink: settings.promoLink?.trim() || "",
          appPromoLink: settings.appPromoLink?.trim() || "",
          contentReferralCode: settings.contentReferralCode?.trim() || "",
          episodeStrategy: settings.episodeStrategy || "",
          sourcePage: settings.sourcePage?.trim() || "",
          episodeNumber: meta.episodeNumber,
          funnelStage: meta.funnelStage,
          isLastFreeEpisode: meta.isLastFreeEpisode,
          originalName: file.name,
          size: blob.size,
          createdAt: Date.now(),
          status: "ready",
          blob,
          cover
        };

        await saveVideo(item);
        if (settings.autoDownload) await downloadPackage(item);
        done++;
      } catch (error) {
        setStatus(`Erro em ${file.name}: ${error.message}`);
      }
    }

    await refresh();
    setQueue([]);
    setCurrent("");
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    setStatus(`${done} de ${files.length} vídeo(s) prontos com vídeo, capa, legenda e hashtags.`);
  }

  function openVideo(item) {
    const url = URL.createObjectURL(item.blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function downloadPackage(item) {
    const zip = new JSZip();
    zip.file(`${item.filename}.mp4`, item.blob);
    if (item.cover) zip.file(`${item.filename}-capa.jpg`, item.cover);
    zip.file("legenda.txt", item.caption || "");
    zip.file("dados.json", JSON.stringify({
      title: item.title,
      caption: item.caption,
      hashtags: item.hashtags,
      source: item.source,
      sourceType: item.sourceType,
      rightsType: item.rightsType,
      campaign: item.campaign,
      authorization: item.authorization,
      cta: item.cta,
      totalEpisodes: item.totalEpisodes,
      freeEpisodes: item.freeEpisodes,
      episodeNumber: item.episodeNumber,
      promoLink: item.promoLink,
      appPromoLink: item.appPromoLink,
      contentReferralCode: item.contentReferralCode,
      episodeStrategy: item.episodeStrategy,
      sourcePage: item.sourcePage,
      funnelStage: item.funnelStage,
      isLastFreeEpisode: item.isLastFreeEpisode
    }, null, 2));
    const out = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    downloadBlob(out, `${item.filename}-pacote.zip`);
  }

  async function copyCaption(item) {
    await navigator.clipboard.writeText(item.caption || "");
    setStatus("Legenda e hashtags copiadas.");
  }

  function downloadVideoOnly(item) {
    downloadBlob(item.blob, `${item.filename}.mp4`);
    setStatus("Vídeo baixado. Agora abra o TikTok e selecione o arquivo.");
  }

  function openTikTok(item) {
    const url = "https://www.tiktok.com/upload";
    window.open(url, "_blank", "noopener,noreferrer");
    setStatus(`TikTok aberto para publicar o Episódio ${item.episodeNumber || ""}. Use a legenda já preparada no ViralUp.`);
  }

  async function copyKwaiEpisodeData(item) {
    const payload = [
      `Título: ${kwaiEpisodeTitle || item.title || `Episódio ${item.episodeNumber || kwaiEpisodeNumber}`}`,
      `Episódio: ${item.episodeNumber || kwaiEpisodeNumber}`,
      `Legenda: ${item.caption || ""}`
    ].join("\n");
    await navigator.clipboard.writeText(payload);
    setStatus("Dados do episódio copiados para o cadastro no Kwai.");
  }

  function openKwai() {
    window.open("https://www.kwai.com/", "_blank", "noopener,noreferrer");
    setStatus("Kwai aberto. Continue o cadastro do episódio na plataforma.");
  }

  async function removeItem(item) {
    await deleteVideo(item.id);
    await refresh();
    setStatus("Vídeo removido.");
  }

  return (
    <main className="shell">
      <header className="topbar appTopbar">
        <div className="brand">
          <span className="brandIcon"><Play size={18} fill="currentColor"/></span>
          <span>Viral<span className="up">Up</span></span>
        </div>
        <button className="installButton" type="button" onClick={installApp}>
          <Smartphone size={16}/> Instalar
        </button>
      </header>

      <section className="hero appHero" id="inicio">
        <div className="appStatus"><span className="statusDot"/> AUTO STUDIO ATIVO</div>
        <p className="eyebrow">AUTOMAÇÃO DE VÍDEO VERTICAL</p>
        <h1>Seu estúdio ViralUp no celular.</h1>
        <p className="heroText">Importe, organize e prepare vídeos autorizados para publicação em poucos passos.</p>
        <input ref={inputRef} hidden type="file" accept="video/*" multiple onChange={onFiles}/>
      </section>

      <section className="moduleHub" aria-label="Blocos funcionais">
        <div className="moduleHubHead">
          <div>
            <p className="eyebrow">CENTRAL DE TRABALHO</p>
            <h2>Escolha o que você quer fazer</h2>
          </div>
          <span className="moduleHint">Cada função em seu próprio bloco</span>
        </div>

        <div className="moduleGrid">
          <button type="button" onClick={()=>goTo("importar")} className="moduleCard">
            <span className="moduleIcon"><Download size={19}/></span>
            <span><strong>1. Importar</strong><small>Link ou arquivo do aparelho</small></span>
            <ChevronRight size={17}/>
          </button>
          <button type="button" onClick={()=>goTo("episodios")} className="moduleCard">
            <span className="moduleIcon"><Clapperboard size={19}/></span>
            <span><strong>2. Episódios</strong><small>Embed e organização da série</small></span>
            <ChevronRight size={17}/>
          </button>
          <button type="button" onClick={()=>goTo("automacao")} className="moduleCard">
            <span className="moduleIcon"><Settings size={19}/></span>
            <span><strong>3. Campanha</strong><small>Fonte, CTA e autorização</small></span>
            <ChevronRight size={17}/>
          </button>
          <button type="button" onClick={()=>goTo("biblioteca")} className="moduleCard">
            <span className="moduleIcon"><Library size={19}/></span>
            <span><strong>4. Biblioteca</strong><small>Vídeos processados e pacotes</small></span>
            <ChevronRight size={17}/>
          </button>
          <button type="button" onClick={()=>goTo("publicacao")} className="moduleCard">
            <span className="moduleIcon"><Send size={19}/></span>
            <span><strong>5. Publicar</strong><small>TikTok e fluxo de postagem</small></span>
            <ChevronRight size={17}/>
          </button>
          <button type="button" onClick={()=>goTo("contas")} className="moduleCard">
            <span className="moduleIcon"><UserCheck size={19}/></span>
            <span><strong>6. Contas</strong><small>Safelist e autorizações</small></span>
            <ChevronRight size={17}/>
          </button>
        </div>
      </section>

      <section className="quickBlocks" id="importar" aria-label="Ações principais">
        <article className="quickBlock primaryQuick">
          <div className="quickBlockTitle"><LinkIcon size={18}/><div><strong>Importar por link</strong><span>Link direto de vídeo autorizado</span></div></div>
          <div className="urlImportRow">
            <input
              value={videoUrl}
              onChange={(e)=>setVideoUrl(e.target.value)}
              onPaste={(e)=>{
                const pasted = e.clipboardData.getData("text");
                if (/^https?:\/\//i.test(pasted.trim())) setTimeout(()=>importVideoUrl(pasted), 0);
              }}
              onKeyDown={(e)=>{ if(e.key === "Enter") importVideoUrl(); }}
              placeholder="Cole o link direto do vídeo"
              inputMode="url"
            />
            <input
              className="episodeMiniInput"
              type="number"
              min="1"
              value={linkEpisode}
              onChange={(e)=>setLinkEpisode(e.target.value)}
              title="Número do episódio"
            />
            <button type="button" onClick={()=>importVideoUrl()} disabled={importingUrl || !videoUrl.trim()}>
              {importingUrl ? <span className="miniSpinner"/> : <Download size={17}/>}
              {importingUrl ? "Importando" : "Importar"}
            </button>
          </div>
          <small>Ao colar um link direto, a importação inicia automaticamente. Páginas comuns não são extraídas nem raspadas.</small>
        </article>

        <article className="quickBlock">
          <div className="quickBlockTitle"><Upload size={18}/><div><strong>Arquivo do aparelho</strong><span>MP4, MOV, WebM • até 25 MB</span></div></div>
          <button className="compactAction" type="button" onClick={pickFiles} disabled={busy}>
            <Upload size={16}/> Selecionar vídeos
          </button>
        </article>

        <article className="quickBlock">
          <div className="quickBlockTitle"><Settings size={18}/><div><strong>Campanha</strong><span>{settings.campaign || settings.source}</span></div></div>
          <button className="compactAction" type="button" onClick={()=>goTo("automacao")}>
            <Settings size={16}/> Configurar
          </button>
        </article>
      </section>

      <section className="metrics">
        <article><Upload size={18}/><div><strong>{stats.imported}</strong><span>Importados</span></div></article>
        <article><Clapperboard size={18}/><div><strong>{stats.processing}</strong><span>Processando</span></div></article>
        <article><Film size={18}/><div><strong>{stats.ready}</strong><span>Prontos</span></div></article>
      </section>

      <section className="section functionalSection" id="contas">
        <div className="sectionHeading">
          <div><p className="eyebrow">CONTAS AUTORIZADAS</p><h2>Safelist e publicação</h2></div>
          <span className="safeBadge ok"><UserCheck size={16}/> {accounts.length} conta cadastrada</span>
        </div>

        <div className="accountsGrid">
          {accounts.map((account)=>(
            <article className="accountCard" key={account.id}>
              <div className="accountIcon"><UserCheck size={22}/></div>
              <div className="accountInfo">
                <div className="accountTopline">
                  <strong>{account.platform} {account.account}</strong>
                  <span className="pendingBadge">{account.status}</span>
                </div>
                <p><b>Fonte:</b> {account.source}</p>
                <p><b>Situação:</b> {account.note}</p>
                <small>Atualizado em {account.updatedAt}</small>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section functionalSection" id="automacao">
        <div className="sectionHeading">
          <div><p className="eyebrow">MODO AUTOMÁTICO</p><h2>Padrão da campanha</h2></div>
          <span className={configured ? "safeBadge ok" : "safeBadge"}><ShieldCheck size={16}/> {configured ? "Configurado" : "Falta autorização"}</span>
        </div>

        <div className="importPanel">
          <div className="formGrid">
            <label>
              <span>Fonte de conteúdo</span>
              <select value={settings.source} onChange={(e)=>applySourcePreset(e.target.value)}>
                <option>ReelShort / RS Boost</option>
                <option>NetShort</option>
                <option>Upload próprio</option>
                <option>Outro parceiro</option>
              </select>
            </label>
            <label>
              <span>Tipo de autorização</span>
              <select value={settings.rightsType} onChange={(e)=>setSettings({...settings,rightsType:e.target.value})}>
                <option>Campanha promocional autorizada</option>
                <option>Licença de uso</option>
                <option>Conteúdo próprio</option>
                <option>Parceria / afiliado</option>
                <option>Outro</option>
              </select>
            </label>
            {settings.source === "Outro parceiro" && (
              <label className="wide">
                <span>Nome do parceiro</span>
                <input value={settings.sourceCustom} onChange={(e)=>setSettings({...settings,sourceCustom:e.target.value})} placeholder="Ex.: plataforma ou estúdio parceiro"/>
              </label>
            )}
            <label><span>Campanha</span><input value={settings.campaign} onChange={(e)=>setSettings({...settings,campaign:e.target.value})} placeholder="Nome ou código"/></label>
            <label><span>CTA padrão</span><input value={settings.cta} onChange={(e)=>setSettings({...settings,cta:e.target.value})} placeholder="Siga a @viralup para mais episódios"/></label>
            {settings.source === "ReelShort / RS Boost" && (
              <>
                <label><span>Total de episódios</span><input type="number" min="1" value={settings.totalEpisodes ?? ""} onChange={(e)=>setSettings({...settings,totalEpisodes:e.target.value})}/></label>
                <label><span>Episódios liberados</span><input type="number" min="1" value={settings.freeEpisodes ?? ""} onChange={(e)=>setSettings({...settings,freeEpisodes:e.target.value})}/></label>
                <label className="wide"><span>Link promocional do conteúdo</span><input value={settings.promoLink ?? ""} onChange={(e)=>setSettings({...settings,promoLink:e.target.value})} placeholder="https://..."/></label>
                <label className="wide"><span>Link promocional do aplicativo</span><input value={settings.appPromoLink ?? ""} onChange={(e)=>setSettings({...settings,appPromoLink:e.target.value})} placeholder="https://..."/></label>
                <label className="wide"><span>Código de indicação do conteúdo</span><input value={settings.contentReferralCode ?? ""} onChange={(e)=>setSettings({...settings,contentReferralCode:e.target.value})} placeholder="Código"/></label>
                <div className="wide funnelCard">
                  <strong>Funil automático</strong>
                  <span>Episódios 1 a {settings.freeEpisodes || 0}: CTA para seguir @viralup. Episódio {settings.freeEpisodes || 0}: CTA muda automaticamente para continuar pelo link da bio.</span>
                </div>
              </>
            )}
            <label className="wide"><span>Autorização de uso</span><input value={settings.authorization} onChange={(e)=>setSettings({...settings,authorization:e.target.value})} placeholder="Link, código, e-mail ou observação da autorização"/></label>
          </div>

          {settings.source === "ReelShort / RS Boost" && (
            <div className="remoteSourcePanel modulePanel" id="episodios">
              <div className="blockKicker">BLOCO 2 • EPISÓDIOS</div>
              <div>
                <strong>Player oficial ReelShort</strong>
                <span>O episódio fica incorporado no ViralUp sem baixar o arquivo de vídeo.</span>
              </div>
              <div className="embedManager">
                <div className="embedManagerHead">
                  <div>
                    <strong>Adicionar episódio por Embed</strong>
                    <span>Copie o Embed no RS Boost e cole abaixo. O ViralUp extrai o player automaticamente.</span>
                  </div>
                </div>
                <div className="embedManagerForm">
                  <label>
                    <span>Episódio</span>
                    <input type="number" min="1" value={embedEpisode} onChange={(e)=>setEmbedEpisode(e.target.value)} />
                  </label>
                  <label className="embedCodeField">
                    <span>Código Embed</span>
                    <textarea
                      value={embedCode}
                      onChange={(e)=>setEmbedCode(e.target.value)}
                      placeholder={'<iframe ... src="https://www.reelshort.com/..." ...></iframe>'}
                    />
                  </label>
                  <button className="primaryButton" type="button" onClick={saveEmbed}>
                    <Plus size={18}/> Adicionar episódio
                  </button>
                </div>
              </div>

              <div className="embedGrid">
                {embeds.map((embed)=>(
                  <article className="embedCard" key={embed.episode}>
                    <div className="embedTitle">
                      <strong>{embed.title}</strong>
                      <div className="embedTitleActions">
                        <span>OFICIAL</span>
                        <button type="button" onClick={()=>removeEmbed(embed.episode)} title="Remover episódio"><Trash2 size={14}/></button>
                      </div>
                    </div>
                    <div className="embedFrame">
                      <iframe
                        id={`reelshort_player_${embed.episode}`}
                        src={embed.src}
                        title={`ReelShort video player - Episódio ${embed.episode}`}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                      />
                    </div>
                  </article>
                ))}
              </div>

              <div>
                <strong>Episódios oficiais da campanha</strong>
                <span>Sem baixar e sem copiar mídia: abra diretamente os episódios liberados no RS Boost.</span>
              </div>
              <div className="episodeButtons">
                {Array.from({ length: Number(settings.freeEpisodes) || 0 }, (_, i) => i + 1).map((ep)=>(
                  <button key={ep} type="button" onClick={()=>window.open(settings.sourcePage, "_blank", "noopener,noreferrer")}>
                    <Play size={14}/> Ep. {ep}
                  </button>
                ))}
              </div>
              <a className="sourceLinkButton" href={settings.sourcePage} target="_blank" rel="noreferrer">
                <ExternalLink size={16}/> Abrir campanha oficial no RS Boost
              </a>
              <small>O ViralUp não faz scraping nem baixa episódios automaticamente. O conteúdo continua sendo servido pela plataforma oficial.</small>
            </div>
          )}

          <div className="toggles">
            <label className="toggleRow">
              <input type="checkbox" checked={settings.autoMode} onChange={(e)=>setSettings({...settings,autoMode:e.target.checked})}/>
              <span><strong>Processar automaticamente</strong><small>Ao selecionar vídeos, iniciar a fila sem outro clique.</small></span>
            </label>
            <label className="toggleRow">
              <input type="checkbox" checked={settings.autoDownload} onChange={(e)=>setSettings({...settings,autoDownload:e.target.checked})}/>
              <span><strong>Baixar pacote automaticamente</strong><small>Baixa ZIP com vídeo, capa, legenda e dados.</small></span>
            </label>
          </div>

          <div className="panelActions">
            <button className="ghostButton" type="button" onClick={() => saveSettings()}><Settings size={18}/> Salvar padrão</button>
            <button className="primaryButton" type="button" onClick={pickFiles} disabled={busy || !configured}><Zap size={18}/> Adicionar e automatizar</button>
          </div>
          {status && <p className="statusMessage">{status}</p>}
          {busy && <div className="progressLine"><span className="pulse"/><strong>Processando:</strong> {current}</div>}
        </div>
      </section>

      {queue.length > 0 && !busy && (
        <section className="section">
          <div className="queueBox">
            <div><strong>{queue.length} vídeo(s) na fila</strong><span>{queue.map((f)=>f.name).join(" • ")}</span></div>
            <button className="primaryButton" onClick={()=>runBatch()}><Clapperboard size={18}/> Processar fila</button>
          </div>
        </section>
      )}

      <section className="section functionalSection" id="biblioteca">
        <div className="sectionHeading"><div><p className="eyebrow">BIBLIOTECA</p><h2>Pacotes prontos para publicar</h2></div></div>

        {library.length === 0 ? (
          <div className="emptyLibrary"><Video size={34}/><strong>Nenhum pacote pronto ainda</strong><span>Configure o modo automático e selecione seus vídeos.</span></div>
        ) : (
          <div className="videoGrid">
            {library.map((item)=>(
              <article className="videoItem rich" key={item.id}>
                <div className="coverThumb" onClick={()=>openVideo(item)}>
                  {item.cover ? <img src={URL.createObjectURL(item.cover)} alt="" /> : <Play size={27} fill="currentColor"/>}
                </div>
                <div className="videoMeta">
                  <div className="readyLine"><BadgeCheck size={15}/> PACOTE PRONTO</div>
                  <h3>{item.title}</h3>
                  <p className="captionPreview">{item.caption}</p>
                  {item.isLastFreeEpisode && <span className="redirectBadge">ÚLTIMO GRATUITO • REDIRECIONAR</span>}
                  <small>{mb(item.size)} • 1080×1920 • MP4 + capa + legenda</small>
                </div>
                <div className="itemActions">
                  <button onClick={()=>openVideo(item)} title="Visualizar"><Play size={17}/></button>
                  <button onClick={()=>copyCaption(item)} title="Copiar legenda"><Copy size={17}/></button>
                  <button onClick={()=>item.cover && downloadBlob(item.cover,`${item.filename}-capa.jpg`)} title="Baixar capa"><ImageIcon size={17}/></button>
                  <button onClick={()=>downloadVideoOnly(item)} title="Baixar vídeo"><Download size={17}/></button>
                  <button onClick={()=>downloadPackage(item)} title="Baixar pacote ZIP"><Package size={17}/></button>
                  <button onClick={()=>removeItem(item)} title="Excluir"><Trash2 size={17}/></button>
                </div>
                <div className="tiktokPublish">
                  <div>
                    <strong>Publicar no TikTok</strong>
                    <span>Episódio {item.episodeNumber || "—"} • @viralup</span>
                  </div>
                  <div className="tiktokButtons">
                    <button type="button" onClick={()=>copyCaption(item)}><Copy size={16}/> Copiar legenda</button>
                    <button type="button" onClick={()=>downloadVideoOnly(item)}><Download size={16}/> Baixar vídeo</button>
                    <button className="tiktokPrimary" type="button" onClick={()=>openTikTok(item)}><Send size={16}/> Abrir TikTok</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="functionalSection publishWorkspace" id="publicacao">
        <div className="sectionHeading publishHeading">
          <div>
            <p className="eyebrow">PUBLICAÇÃO</p>
            <h2>TikTok e Kwai</h2>
          </div>
          <div className="publishTabs" role="tablist">
            <button type="button" className={publishPlatform==="TikTok" ? "active" : ""} onClick={()=>setPublishPlatform("TikTok")}>TikTok</button>
            <button type="button" className={publishPlatform==="Kwai" ? "active" : ""} onClick={()=>setPublishPlatform("Kwai")}>Kwai</button>
          </div>
        </div>

        {publishPlatform === "TikTok" ? (
          <div className="publishPlatformCard">
            <div className="platformLead">
              <Send size={20}/>
              <div>
                <strong>Publicar no TikTok</strong>
                <span>Use os botões de cada vídeo da biblioteca para copiar legenda, baixar o vídeo e abrir a página de publicação.</span>
              </div>
            </div>
            <button className="compactAction" type="button" onClick={()=>window.open("https://www.tiktok.com/upload","_blank","noopener,noreferrer")}>
              <ExternalLink size={16}/> Abrir TikTok
            </button>
          </div>
        ) : (
          <div className="publishPlatformCard kwaiCard">
            <div className="platformLead">
              <Clapperboard size={20}/>
              <div>
                <strong>Cadastrar episódios no Kwai</strong>
                <span>Fluxo separado para organizar título, número do episódio e os arquivos que serão enviados.</span>
              </div>
            </div>

            <div className="kwaiForm">
              <label>
                <span>Título do episódio</span>
                <input value={kwaiEpisodeTitle} onChange={(e)=>setKwaiEpisodeTitle(e.target.value)} placeholder="Ex.: Episódio 1" />
              </label>
              <label>
                <span>Número</span>
                <input type="number" min="1" value={kwaiEpisodeNumber} onChange={(e)=>setKwaiEpisodeNumber(e.target.value)} />
              </label>
            </div>

            <div className="kwaiEpisodeList">
              {library.length === 0 ? (
                <div className="emptyLibrary compactEmpty"><Video size={26}/><strong>Nenhum vídeo pronto</strong><span>Importe ou processe um episódio primeiro.</span></div>
              ) : (
                library.slice(0,8).map((item)=>(
                  <article className="kwaiEpisodeRow" key={item.id}>
                    <div className="kwaiEpisodeInfo">
                      <strong>{item.title}</strong>
                      <span>Episódio {item.episodeNumber || "—"} • {mb(item.size)}</span>
                    </div>
                    <div className="kwaiEpisodeActions">
                      <button type="button" onClick={()=>copyKwaiEpisodeData(item)}><Copy size={15}/> Dados</button>
                      <button type="button" onClick={()=>downloadVideoOnly(item)}><Download size={15}/> Vídeo</button>
                    </div>
                  </article>
                ))
              )}
            </div>

            <div className="kwaiBottomActions">
              <button className="ghostButton" type="button" onClick={()=>goTo("biblioteca")}><Library size={16}/> Biblioteca</button>
              <button className="primaryButton" type="button" onClick={openKwai}><ExternalLink size={16}/> Abrir Kwai</button>
            </div>
          </div>
        )}
      </section>

      <nav className="mobileNav" aria-label="Navegação principal">
        <button type="button" onClick={()=>goTo("inicio")}><HomeIcon size={20}/><span>Início</span></button>
        <button type="button" onClick={()=>goTo("biblioteca")}><Library size={20}/><span>Biblioteca</span></button>
        <button className="navCreate" type="button" onClick={()=>goTo("importar")}><Plus size={25}/></button>
        <button type="button" onClick={()=>goTo("automacao")}><Settings size={20}/><span>Automação</span></button>
        <button type="button" onClick={()=>goTo("contas")}><UserCheck size={20}/><span>Contas</span></button>
      </nav>

      <footer><span>ViralUp Studio</span><span>Conteúdo autorizado primeiro.</span></footer>
    </main>
  );
}
