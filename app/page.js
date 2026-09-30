"use client";

import {
  BadgeCheck,
  Clapperboard,
  Clock3,
  Film,
  Play,
  Send,
  ShieldCheck,
  Upload,
  Video
} from "lucide-react";

const stages = [
  {
    title: "Fonte autorizada",
    description:
      "Registre campanha, origem e autorização antes de qualquer processamento.",
    icon: ShieldCheck
  },
  {
    title: "Preparar 9:16",
    description:
      "Padronize para vídeo vertical, mantendo o conteúdo legível e sem cortes ruins.",
    icon: Clapperboard
  },
  {
    title: "Identidade ViralUp",
    description:
      "Aplique a marca ViralUp de forma limpa, sem esconder o conteúdo principal.",
    icon: BadgeCheck
  },
  {
    title: "Pronto para publicar",
    description:
      "Revise CTA, legenda e direitos. Depois, envie manualmente ao Kwai.",
    icon: Send
  }
];

const queue = [
  { label: "Importados", value: "0", icon: Upload },
  { label: "Processando", value: "0", icon: Clock3 },
  { label: "Prontos", value: "0", icon: Film }
];

export default function Home() {
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
          <h1>Do material autorizado ao vídeo pronto para publicar.</h1>
          <p className="heroText">
            Organize fontes, campanhas e direitos. Prepare vídeos em 9:16,
            aplique a identidade ViralUp e deixe tudo pronto para publicação.
          </p>
          <div className="actions">
            <button className="primaryButton" type="button">
              <Upload size={19} />
              Importar vídeo autorizado
            </button>
            <button className="ghostButton" type="button">
              <Video size={19} />
              Ver biblioteca
            </button>
          </div>
        </div>

        <div className="previewCard" aria-label="Prévia do vídeo vertical">
          <div className="phoneFrame">
            <div className="phoneTop" />
            <div className="videoPreview">
              <div className="previewLogo">Viral<span>Up</span></div>
              <div className="previewCenter">
                <span className="previewPlay"><Play size={28} fill="currentColor" /></span>
                <strong>Prévia 9:16</strong>
                <small>1080 × 1920</small>
              </div>
              <div className="previewHandle">@ViralUp</div>
            </div>
          </div>
        </div>
      </section>

      <section className="metrics">
        {queue.map(({ label, value, icon: Icon }) => (
          <article key={label}>
            <Icon size={18} />
            <div>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          </article>
        ))}
      </section>

      <section className="section">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow">FLUXO VIRALUP</p>
            <h2>Processo simples e rastreável</h2>
          </div>
          <span className="safeBadge"><ShieldCheck size={16} /> Direitos primeiro</span>
        </div>

        <div className="workflowGrid">
          {stages.map(({ title, description, icon: Icon }, index) => (
            <article className="workflowCard" key={title}>
              <div className="cardTop">
                <span className="cardIcon"><Icon size={21} /></span>
                <small>ETAPA {index + 1}</small>
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="libraryPanel">
        <div className="libraryInfo">
          <span className="libraryIcon"><Video /></span>
          <div>
            <p className="eyebrow">BIBLIOTECA</p>
            <h2>Nenhum vídeo importado ainda</h2>
            <p>
              O próximo passo será conectar upload, metadados de autorização,
              processamento com FFmpeg e fila de publicação.
            </p>
          </div>
        </div>
        <button className="secondaryButton" type="button">
          Adicionar primeiro vídeo
        </button>
      </section>

      <footer>
        <span>ViralUp Studio</span>
        <span>Conteúdo autorizado primeiro.</span>
      </footer>
    </main>
  );
}
