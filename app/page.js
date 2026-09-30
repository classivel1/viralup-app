"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Clapperboard,
  Download,
  Film,
  Play,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  Video
} from "lucide-react";

const DB_NAME = "viralup-studio";
const STORE = "videos";

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

async function getAllVideos() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => b.createdAt - a.createdAt));
    req.onerror = () => reject(req.error);
  });
}

async function saveVideo(item) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(item);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteVideo(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

function bytes(size) {
  if (!size) return "0 MB";
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export default function Home() {
  const fileInput = useRef(null);
  const [library, setLibrary] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({
    title: "",
    source: "",
    campaign: "",
    authorization: "",
    cta: "Siga a ViralUp"
  });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const refresh = async () => setLibrary(await getAllVideos());

  useEffect(() => {
    refresh().catch(() => setStatus("Não foi possível abrir a biblioteca deste aparelho."));
  }, []);

  const stats = useMemo(() => ({
    imported: library.length,
    processing: busy ? 1 : 0,
    ready: library.filter((x) => x.status === "ready").length
  }), [library, busy]);

  function chooseFile() {
    fileInput.current?.click();
  }

  async function onFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setStatus("Escolha um arquivo de vídeo.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setStatus("Nesta primeira versão, o limite é 25 MB por vídeo.");
      return;
    }
    setSelected(file);
    setForm((current) => ({
      ...current,
      title: current.title || file.name.replace(/\.[^.]+$/, "")
    }));
    setStatus("Vídeo selecionado. Preencha a autorização e processe.");
  }

  async function processVideo(event) {
    event.preventDefault();
    if (!selected) return setStatus("Selecione um vídeo primeiro.");
    if (!form.source.trim() || !form.authorization.trim()) {
      return setStatus("Informe a origem e a autorização de uso.");
    }

    setBusy(true);
    setStatus("Processando vídeo em 9:16...");
    try {
      const data = new FormData();
      data.append("video", selected);
      data.append("cta", form.cta);

      const response = await fetch("/api/process", { method: "POST", body: data });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Falha no processamento");
      }
      const processedBlob = await response.blob();
      const item = {
        id: crypto.randomUUID(),
        title: form.title.trim() || selected.name,
        source: form.source.trim(),
        campaign: form.campaign.trim(),
        authorization: form.authorization.trim(),
        cta: form.cta.trim(),
        originalName: selected.name,
        size: processedBlob.size,
        createdAt: Date.now(),
        status: "ready",
        blob: processedBlob
      };
      await saveVideo(item);
      await refresh();
      setSelected(null);
      setForm({ title: "", source: "", campaign: "", authorization: "", cta: "Siga a ViralUp" });
      if (fileInput.current) fileInput.current.value = "";
      setStatus("Vídeo processado e salvo na biblioteca deste aparelho.");
    } catch (error) {
      setStatus(error.message || "Erro ao processar o vídeo.");
    } finally {
      setBusy(false);
    }
  }

  function playItem(item) {
    const url = URL.createObjectURL(item.blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function downloadItem(item) {
    const url = URL.createObjectURL(item.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${item.title || "viralup"}.mp4`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function removeItem(item) {
    await deleteVideo(item.id);
    await refresh();
    setStatus("Vídeo removido da biblioteca.");
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brandIcon"><Play size={18} fill="currentColor" /></span>
          <span>Viral<span className="up">Up</span></span>
        </div>
        <span className="studioTag">STUDIO</span>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">PIPELINE DE CONTEÚDO VERTICAL</p>
          <h1>Importe, autorize, processe e publique.</h1>
          <p className="heroText">
            O ViralUp Studio agora recebe vídeos autorizados, registra campanha e direitos,
            converte para 9:16 e mantém uma biblioteca local pronta para publicação.
          </p>
          <div className="actions">
            <button className="primaryButton" type="button" onClick={chooseFile}>
              <Upload size={19} /> Importar vídeo autorizado
            </button>
            <button className="ghostButton" type="button" onClick={() => document.getElementById("biblioteca")?.scrollIntoView({behavior:"smooth"})}>
              <Video size={19} /> Ver biblioteca
            </button>
          </div>
          <input ref={fileInput} hidden type="file" accept="video/*" onChange={onFileChange} />
        </div>
      </section>

      <section className="metrics">
        <article><Upload size={18}/><div><strong>{stats.imported}</strong><span>Importados</span></div></article>
        <article><Clapperboard size={18}/><div><strong>{stats.processing}</strong><span>Processando</span></div></article>
        <article><Film size={18}/><div><strong>{stats.ready}</strong><span>Prontos</span></div></article>
      </section>

      <section className="section">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow">NOVA IMPORTAÇÃO</p>
            <h2>Dados de uso e processamento</h2>
          </div>
          <span className="safeBadge"><ShieldCheck size={16}/> Direitos primeiro</span>
        </div>

        <form className="importPanel" onSubmit={processVideo}>
          <div className="fileCard">
            <span className="libraryIcon"><Video /></span>
            <div>
              <strong>{selected ? selected.name : "Nenhum vídeo selecionado"}</strong>
              <span>{selected ? bytes(selected.size) : "MP4, MOV, WebM • até 25 MB"}</span>
            </div>
            <button type="button" className="miniButton" onClick={chooseFile}>Escolher</button>
          </div>

          <div className="formGrid">
            <label>
              <span>Título</span>
              <input value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})} placeholder="Ex.: Episódio 01" />
            </label>
            <label>
              <span>Origem / programa</span>
              <input value={form.source} onChange={(e)=>setForm({...form,source:e.target.value})} placeholder="Ex.: campanha oficial" required />
            </label>
            <label>
              <span>Campanha</span>
              <input value={form.campaign} onChange={(e)=>setForm({...form,campaign:e.target.value})} placeholder="Nome ou código da campanha" />
            </label>
            <label>
              <span>Autorização de uso</span>
              <input value={form.authorization} onChange={(e)=>setForm({...form,authorization:e.target.value})} placeholder="Link, código ou observação" required />
            </label>
            <label className="wide">
              <span>CTA</span>
              <input value={form.cta} onChange={(e)=>setForm({...form,cta:e.target.value})} placeholder="Siga a ViralUp" />
            </label>
          </div>

          <button className="primaryButton processButton" disabled={busy} type="submit">
            <Clapperboard size={19}/>
            {busy ? "Processando..." : "Processar em 9:16"}
          </button>
          {status && <p className="statusMessage">{status}</p>}
        </form>
      </section>

      <section className="section" id="biblioteca">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow">BIBLIOTECA</p>
            <h2>Prontos para publicar</h2>
          </div>
        </div>

        {library.length === 0 ? (
          <div className="emptyLibrary">
            <Video size={34}/>
            <strong>Nenhum vídeo processado ainda</strong>
            <span>Importe um vídeo autorizado para começar.</span>
          </div>
        ) : (
          <div className="videoGrid">
            {library.map((item) => (
              <article className="videoItem" key={item.id}>
                <div className="videoThumb" onClick={() => playItem(item)}>
                  <Play size={27} fill="currentColor"/>
                </div>
                <div className="videoMeta">
                  <div className="readyLine"><BadgeCheck size={15}/> PRONTO</div>
                  <h3>{item.title}</h3>
                  <p>{item.source}{item.campaign ? ` • ${item.campaign}` : ""}</p>
                  <small>{bytes(item.size)} • 1080×1920</small>
                </div>
                <div className="itemActions">
                  <button onClick={() => playItem(item)} title="Visualizar"><Play size={17}/></button>
                  <button onClick={() => downloadItem(item)} title="Baixar"><Download size={17}/></button>
                  <button onClick={() => removeItem(item)} title="Excluir"><Trash2 size={17}/></button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="publishNote">
        <Send size={20}/>
        <div>
          <strong>Publicação no Kwai</strong>
          <span>O arquivo final fica pronto para baixar e publicar manualmente enquanto não houver API oficial habilitada para sua conta.</span>
        </div>
      </section>

      <footer>
        <span>ViralUp Studio</span>
        <span>Conteúdo autorizado primeiro.</span>
      </footer>
    </main>
  );
}
