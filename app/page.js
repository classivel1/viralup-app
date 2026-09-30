"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck, Clapperboard, Download, Film, Play, Send,
  Settings, ShieldCheck, Trash2, Upload, Video, Zap
} from "lucide-react";

const DB_NAME = "viralup-studio";
const STORE = "videos";
const SETTINGS_KEY = "viralup-auto-settings";

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

export default function Home() {
  const inputRef = useRef(null);
  const [library, setLibrary] = useState([]);
  const [queue, setQueue] = useState([]);
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState("");
  const [status, setStatus] = useState("");
  const [settings, setSettings] = useState({
    source: "",
    campaign: "",
    authorization: "",
    cta: "Siga a ViralUp",
    autoMode: true,
    autoDownload: false
  });

  const refresh = async () => setLibrary(await getAllVideos());

  useEffect(() => {
    refresh().catch(() => setStatus("Não foi possível abrir a biblioteca deste aparelho."));
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
      if (saved) setSettings((s) => ({ ...s, ...saved }));
    } catch {}
  }, []);

  const stats = useMemo(() => ({
    imported: library.length,
    processing: busy ? 1 : 0,
    ready: library.filter((x) => x.status === "ready").length
  }), [library, busy]);

  const configured = Boolean(settings.source.trim() && settings.authorization.trim());

  function saveSettings(next = settings) {
    setSettings(next);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    setStatus("Padrão automático salvo neste aparelho.");
  }

  function pickFiles() {
    inputRef.current?.click();
  }

  async function onFiles(event) {
    const list = Array.from(event.target.files || []);
    const valid = list.filter((file) => file.type.startsWith("video/") && file.size <= 25 * 1024 * 1024);
    const rejected = list.length - valid.length;
    setQueue(valid);
    if (rejected) setStatus(`${rejected} arquivo(s) ignorado(s): formato inválido ou acima de 25 MB.`);
    else setStatus(`${valid.length} vídeo(s) adicionados à fila.`);

    if (valid.length && settings.autoMode && configured) {
      await runBatch(valid);
    }
  }

  function triggerDownload(blob, title) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "viralup"}.mp4`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  async function runBatch(files = queue) {
    if (!files.length) return setStatus("Adicione um ou mais vídeos.");
    if (!configured) return setStatus("Preencha origem e autorização de uso antes de automatizar.");

    setBusy(true);
    let done = 0;

    for (const file of files) {
      const title = baseName(file.name);
      setCurrent(file.name);
      setStatus(`Processando ${done + 1} de ${files.length}: ${file.name}`);

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
        const item = {
          id: crypto.randomUUID(),
          title,
          source: settings.source.trim(),
          campaign: settings.campaign.trim(),
          authorization: settings.authorization.trim(),
          cta: settings.cta.trim(),
          originalName: file.name,
          size: blob.size,
          createdAt: Date.now(),
          status: "ready",
          blob
        };

        await saveVideo(item);
        if (settings.autoDownload) triggerDownload(blob, title);
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
    setStatus(`${done} de ${files.length} vídeo(s) processado(s). Prontos para publicar.`);
  }

  function openVideo(item) {
    const url = URL.createObjectURL(item.blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function removeItem(item) {
    await deleteVideo(item.id);
    await refresh();
    setStatus("Vídeo removido.");
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brandIcon"><Play size={18} fill="currentColor"/></span>
          <span>Viral<span className="up">Up</span></span>
        </div>
        <span className="studioTag">AUTO STUDIO</span>
      </header>

      <section className="hero">
        <p className="eyebrow">AUTOMAÇÃO DE VÍDEO VERTICAL</p>
        <h1>Selecione os vídeos. O ViralUp faz o resto.</h1>
        <p className="heroText">
          Salve uma vez a origem e a autorização. Depois envie vários vídeos de uma vez:
          o sistema processa em sequência, aplica 9:16, identidade ViralUp e deixa tudo pronto.
        </p>
        <div className="actions">
          <button className="primaryButton" onClick={pickFiles} disabled={busy}>
            <Upload size={19}/> Selecionar vídeos
          </button>
          <button className="ghostButton" onClick={() => document.getElementById("automacao")?.scrollIntoView({behavior:"smooth"})}>
            <Settings size={19}/> Configurar automação
          </button>
        </div>
        <input ref={inputRef} hidden type="file" accept="video/*" multiple onChange={onFiles}/>
      </section>

      <section className="metrics">
        <article><Upload size={18}/><div><strong>{stats.imported}</strong><span>Importados</span></div></article>
        <article><Clapperboard size={18}/><div><strong>{stats.processing}</strong><span>Processando</span></div></article>
        <article><Film size={18}/><div><strong>{stats.ready}</strong><span>Prontos</span></div></article>
      </section>

      <section className="section" id="automacao">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow">MODO AUTOMÁTICO</p>
            <h2>Padrão da campanha</h2>
          </div>
          <span className={configured ? "safeBadge ok" : "safeBadge"}>
            <ShieldCheck size={16}/> {configured ? "Configurado" : "Falta autorização"}
          </span>
        </div>

        <div className="importPanel">
          <div className="formGrid">
            <label><span>Origem / programa</span><input value={settings.source} onChange={(e)=>setSettings({...settings,source:e.target.value})} placeholder="Ex.: material oficial autorizado"/></label>
            <label><span>Campanha</span><input value={settings.campaign} onChange={(e)=>setSettings({...settings,campaign:e.target.value})} placeholder="Nome ou código"/></label>
            <label className="wide"><span>Autorização de uso</span><input value={settings.authorization} onChange={(e)=>setSettings({...settings,authorization:e.target.value})} placeholder="Link, código ou observação da autorização"/></label>
            <label className="wide"><span>CTA padrão</span><input value={settings.cta} onChange={(e)=>setSettings({...settings,cta:e.target.value})} placeholder="Siga a ViralUp"/></label>
          </div>

          <div className="toggles">
            <label className="toggleRow">
              <input type="checkbox" checked={settings.autoMode} onChange={(e)=>setSettings({...settings,autoMode:e.target.checked})}/>
              <span><strong>Processar automaticamente</strong><small>Ao selecionar vídeos, iniciar a fila sem outro clique.</small></span>
            </label>
            <label className="toggleRow">
              <input type="checkbox" checked={settings.autoDownload} onChange={(e)=>setSettings({...settings,autoDownload:e.target.checked})}/>
              <span><strong>Baixar automaticamente</strong><small>Baixar cada MP4 final assim que terminar.</small></span>
            </label>
          </div>

          <div className="panelActions">
            <button className="ghostButton" type="button" onClick={() => saveSettings()}>
              <Settings size={18}/> Salvar padrão
            </button>
            <button className="primaryButton" type="button" onClick={pickFiles} disabled={busy || !configured}>
              <Zap size={18}/> Adicionar e automatizar
            </button>
          </div>
          {status && <p className="statusMessage">{status}</p>}
          {busy && <div className="progressLine"><span className="pulse"/><strong>Processando:</strong> {current}</div>}
        </div>
      </section>

      {queue.length > 0 && !busy && (
        <section className="section">
          <div className="queueBox">
            <div>
              <strong>{queue.length} vídeo(s) na fila</strong>
              <span>{queue.map((f)=>f.name).join(" • ")}</span>
            </div>
            <button className="primaryButton" onClick={()=>runBatch()}><Clapperboard size={18}/> Processar fila</button>
          </div>
        </section>
      )}

      <section className="section" id="biblioteca">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow">BIBLIOTECA</p>
            <h2>Prontos para publicar</h2>
          </div>
        </div>

        {library.length === 0 ? (
          <div className="emptyLibrary">
            <Video size={34}/><strong>Nenhum vídeo pronto ainda</strong><span>Configure o modo automático e selecione seus vídeos.</span>
          </div>
        ) : (
          <div className="videoGrid">
            {library.map((item)=>(
              <article className="videoItem" key={item.id}>
                <div className="videoThumb" onClick={()=>openVideo(item)}><Play size={27} fill="currentColor"/></div>
                <div className="videoMeta">
                  <div className="readyLine"><BadgeCheck size={15}/> PRONTO</div>
                  <h3>{item.title}</h3>
                  <p>{item.source}{item.campaign ? ` • ${item.campaign}` : ""}</p>
                  <small>{mb(item.size)} • 1080×1920 • ViralUp</small>
                </div>
                <div className="itemActions">
                  <button onClick={()=>openVideo(item)} title="Visualizar"><Play size={17}/></button>
                  <button onClick={()=>triggerDownload(item.blob,item.title)} title="Baixar"><Download size={17}/></button>
                  <button onClick={()=>removeItem(item)} title="Excluir"><Trash2 size={17}/></button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="publishNote">
        <Send size={20}/>
        <div>
          <strong>Automatizado até o ponto seguro de publicação</strong>
          <span>Importação, fila, 9:16, marca ViralUp, metadados, biblioteca e download estão automatizados. A postagem no Kwai continua manual até existir uma API oficial habilitada para a conta.</span>
        </div>
      </section>

      <footer><span>ViralUp Studio</span><span>Conteúdo autorizado primeiro.</span></footer>
    </main>
  );
}
