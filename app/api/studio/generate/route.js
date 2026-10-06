import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  COSTS, addCredits, chooseProvider, clampVeoDuration, consumeCredits, dataUrlToInline, ensureProfile,
  getUserFromRequest, jsonError, resolutionForOpenAI, safeJson, safeText, saveProject, uploadBufferToStorage, uploadDataUrlToStorage
} from "../../../../lib/studio";

export const runtime = "nodejs";
export const maxDuration = 300;

const execFileAsync = promisify(execFile);

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const tool = String(body.tool || "ai-video");
  const kind = body.kind === "image" ? "image" : body.kind === "audio" ? "audio" : "video";
  const toolCost = COSTS[tool] || 4;
  const prompt = String(body.prompt || "").trim().slice(0, 12000);
  const aspect = ["9:16", "16:9", "1:1"].includes(body.aspect) ? body.aspect : "9:16";
  const quality = ["720p", "1080p", "4k"].includes(body.quality) ? body.quality : "720p";
  const inputDataUrl = typeof body.inputDataUrl === "string" && body.inputDataUrl.length < 18_000_000 ? body.inputDataUrl : null;
  let provider = chooseProvider({ requested: body.provider, kind, hasInput: Boolean(inputDataUrl) });
  const cost = ["pollinations", "ffmpeg"].includes(provider) ? 0 : toolCost;
  const user = await getUserFromRequest(request);

  if (provider !== "demo" && provider !== "ffmpeg" && !user) return jsonError("Entre na sua conta para usar a geração real.", 401);

  let debited = false;
  if (user && provider !== "demo" && cost > 0) {
    await ensureProfile(user);
    const debit = await consumeCredits(user.id, cost);
    if (!debit.ok) return jsonError(debit.unavailable ? "Banco de créditos indisponível." : "Créditos insuficientes.", debit.unavailable ? 503 : 402);
    debited = true;
  }

  const id = randomUUID();
  try {
    if (provider === "pollinations") {
      try {
        const result = await createPollinationsVideo({ id, userId: user.id, prompt, aspect, duration: body.duration, inputDataUrl });
        const project = { id, tool, provider: "pollinations", providerRef: null, status: "completed", prompt, aspect, quality, resultUrl: result.resultUrl, metadata: { model: result.model } };
        await saveProject(user?.id, project);
        return Response.json({ id, provider: "pollinations", providerLabel: "Pollinations", model: result.model, status: "completed", progress: 100, resultUrl: result.resultUrl, cost: 0 });
      } catch (pollinationsError) {
        console.warn("[studio/pollinations] fallback", String(pollinationsError?.message || pollinationsError));
        if (inputDataUrl && process.env.FREE_VIDEO_FALLBACK !== "off") {
          const local = await createLocalPhotoVideo({ id, userId: user?.id, aspect, duration: body.duration, inputDataUrl, prompt, productName: body.productName, price: body.price, cta: body.cta, style: body.style, voice: body.voice });
          const project = { id, tool, provider: "ffmpeg", providerRef: null, status: "completed", prompt, aspect, quality, resultUrl: local.resultUrl, metadata: { fallbackFrom: "pollinations", model: "ffmpeg-local" } };
          await saveProject(user?.id, project);
          return Response.json({ id, provider: "ffmpeg", providerLabel: "FFmpeg Local · fallback grátis", model: "ffmpeg-local", status: "completed", progress: 100, resultUrl: local.resultUrl, cost: 0, fallbackFrom: "pollinations" });
        }
        throw pollinationsError;
      }
    }
    if (provider === "ffmpeg") {
      if (!inputDataUrl) return jsonError("O modo FFmpeg Local precisa de uma foto de entrada.", 400);
      const local = await createLocalPhotoVideo({ id, userId: user?.id, aspect, duration: body.duration, inputDataUrl, prompt, productName: body.productName, price: body.price, cta: body.cta, style: body.style, voice: body.voice });
      const project = { id, tool, provider: "ffmpeg", providerRef: null, status: "completed", prompt, aspect, quality, resultUrl: local.resultUrl, metadata: { model: "ffmpeg-local" } };
      await saveProject(user?.id, project);
      return Response.json({ id, provider: "ffmpeg", providerLabel: "FFmpeg Local · grátis", model: "ffmpeg-local", status: "completed", progress: 100, resultUrl: local.resultUrl, cost: 0 });
    }
    if (provider === "veo") {
      const job = await createVeoJob({ prompt, aspect, quality, duration: body.duration, inputDataUrl });
      const project = { id, tool, provider: "veo", providerRef: job.ref, status: "queued", prompt, aspect, quality, metadata: { model: job.model } };
      await saveProject(user?.id, project);
      return Response.json({ id, provider: "veo", providerLabel: "Google Veo 3.1", providerRef: job.ref, model: job.model, status: "queued", progress: 10 });
    }
    if (provider === "runway") {
      const job = await createRunwayJob({ prompt, aspect, duration: body.duration, inputDataUrl });
      const project = { id, tool, provider: "runway", providerRef: job.ref, status: "queued", prompt, aspect, quality, metadata: { model: job.model } };
      await saveProject(user?.id, project);
      return Response.json({ id, provider: "runway", providerLabel: "Runway Gen-4.5", providerRef: job.ref, model: job.model, status: "queued", progress: 10 });
    }
    if (provider === "kling") {
      const job = await createKlingJob({ prompt, aspect, duration: body.duration, inputDataUrl });
      const project = { id, tool, provider: "kling", providerRef: job.ref, status: "queued", prompt, aspect, quality, metadata: { model: job.model } };
      await saveProject(user?.id, project);
      return Response.json({ id, provider: "kling", providerLabel: "Kling 2.6 via fal.ai", providerRef: job.ref, model: job.model, status: "queued", progress: 8 });
    }
    if (provider === "openai" && kind === "image") {
      const result = await createOpenAIImage({ prompt, aspect });
      const storedUrl = await uploadDataUrlToStorage(`${user.id}/${id}.webp`, result.url);
      const resultUrl = storedUrl || result.url;
      const project = { id, tool, provider: "openai", providerRef: null, status: "completed", prompt, aspect, quality, resultUrl, metadata: { model: result.model } };
      await saveProject(user?.id, project);
      return Response.json({ id, provider: "openai", providerLabel: "OpenAI GPT Image 2.5", model: result.model, status: "completed", progress: 100, resultUrl });
    }

    const demoUrl = null;
    const project = { id, tool, provider: "demo", providerRef: null, status: "completed", prompt, aspect, quality, resultUrl: demoUrl, metadata: { demo: true } };
    await saveProject(user?.id, project);
    return Response.json({ id, provider: "demo", providerLabel: "Demonstração", status: "completed", progress: 100, resultUrl: demoUrl, demo: true });
  } catch (error) {
    if (debited && user) await addCredits(user.id, cost).catch(() => {});
    const rawMessage = String(error?.message || error || "Falha ao iniciar geração.");
    const status = Number(error?.status || error?.statusCode || error?.response?.status || 0);
    console.error("[studio/generate]", {
      provider,
      status: status || undefined,
      message: rawMessage,
      code: error?.code || undefined,
    });
    if (provider === "pollinations" && /credit|pollen|balance|quota|budget/i.test(rawMessage)) {
      return jsonError("A Pollinations ficou sem Pollen/créditos disponíveis. Use FFmpeg Local para continuar sem custo externo.", 402, { provider: "pollinations" });
    }
    if (provider === "runway" && /not enough credits|insufficient credits/i.test(rawMessage)) {
      return jsonError("Sua conta da Runway está sem créditos suficientes para gerar este vídeo. Os 120 créditos do ViralUp são internos e não substituem os créditos cobrados pela Runway.", 402, { provider: "runway", upstreamStatus: status || 400 });
    }
    if (provider === "runway" && (status === 403 || /forbidden/i.test(rawMessage))) {
      return jsonError("A Runway recusou o acesso (403). Verifique se a RUNWAYML_API_SECRET está válida e se a conta possui créditos disponíveis.", 502, { provider: "runway", upstreamStatus: 403 });
    }
    if (provider === "runway" && (status === 401 || /unauthorized|invalid.*key|authentication/i.test(rawMessage))) {
      return jsonError("A chave da Runway foi recusada. Gere uma nova API secret e atualize RUNWAYML_API_SECRET no Render.", 502, { provider: "runway", upstreamStatus: 401 });
    }
    if (provider === "kling" && (status === 403 || /forbidden/i.test(rawMessage))) {
      return jsonError("A fal.ai recusou o acesso ao Kling (403). Verifique se a FAL_KEY continua válida e se sua conta fal.ai possui créditos/saldo disponível.", 502, { provider: "kling", upstreamStatus: 403 });
    }
    if (provider === "kling" && (status === 401 || /unauthorized|invalid.*key|authentication/i.test(rawMessage))) {
      return jsonError("A FAL_KEY foi recusada pela fal.ai. Gere uma nova chave com escopo API e atualize FAL_KEY no Render.", 502, { provider: "kling", upstreamStatus: 401 });
    }
    return jsonError(rawMessage, 502);
  }
}


async function createPollinationsVideo({ id, userId, prompt, aspect, duration, inputDataUrl }) {
  const key = process.env.POLLINATIONS_API_KEY;
  if (!key) throw new Error("Pollinations não configurado.");
  const model = process.env.POLLINATIONS_VIDEO_MODEL || "alibaba/wan-2.2-fast";
  const seconds = Math.max(4, Math.min(10, Number(duration) || 5));
  let referenceUrl = null;

  if (/^data:image\//.test(inputDataUrl || "")) {
    const inline = dataUrlToInline(inputDataUrl);
    const ext = inline?.mimeType === "image/png" ? "png" : inline?.mimeType === "image/webp" ? "webp" : "jpg";
    referenceUrl = await uploadDataUrlToStorage(`${userId}/pollinations-input-${id}.${ext}`, inputDataUrl);
  }

  const qs = new URLSearchParams({
    model,
    duration: String(seconds),
    aspectRatio: aspect,
  });
  if (referenceUrl) qs.append("image[0]", referenceUrl);

  const url = `https://gen.pollinations.ai/video/${encodeURIComponent(prompt || "Natural cinematic motion from the reference image")}?${qs.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const message = await safeText(res);
    const error = new Error(message || `Pollinations recusou a geração (${res.status}).`);
    error.status = res.status;
    throw error;
  }

  const contentType = res.headers.get("content-type") || "video/mp4";
  if (contentType.includes("application/json")) {
    const data = await res.json();
    const remoteUrl = data?.data?.[0]?.url || data?.url;
    const b64 = data?.data?.[0]?.b64_json || data?.b64_json;
    if (b64) {
      const resultUrl = await uploadBufferToStorage(`${userId}/pollinations-${id}.mp4`, Buffer.from(b64, "base64"), "video/mp4");
      return { resultUrl, model };
    }
    if (remoteUrl) {
      const remote = await fetch(remoteUrl, { cache: "no-store" });
      if (!remote.ok) throw new Error("Pollinations gerou o vídeo, mas o arquivo não pôde ser baixado.");
      const bytes = Buffer.from(await remote.arrayBuffer());
      const resultUrl = await uploadBufferToStorage(`${userId}/pollinations-${id}.mp4`, bytes, remote.headers.get("content-type") || "video/mp4");
      return { resultUrl, model };
    }
    throw new Error("Pollinations não retornou um vídeo utilizável.");
  }

  const bytes = Buffer.from(await res.arrayBuffer());
  if (!bytes.length) throw new Error("Pollinations retornou um vídeo vazio.");
  const resultUrl = await uploadBufferToStorage(`${userId}/pollinations-${id}.mp4`, bytes, contentType);
  return { resultUrl, model };
}

function cleanText(value, max = 120) {
  return String(value || "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function escapeDrawtext(value) {
  return cleanText(value, 100)
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/%/g, "\\%");
}

function buildFreeScript({ prompt, productName, price, cta, style }) {
  if (cleanText(prompt, 380)) return cleanText(prompt, 380);
  const name = cleanText(productName, 90) || "este produto";
  const priceText = cleanText(price, 30);
  const action = cleanText(cta, 80) || "Confira agora";
  const hooks = {
    oferta: "Olha essa oferta que vale a pena conhecer.",
    country: "Para quem gosta de estilo e praticidade no dia a dia.",
    ugc: "Eu encontrei uma opção que chamou minha atenção.",
    clean: "Destaque para uma escolha simples, bonita e funcional."
  };
  const hook = hooks[cleanText(style, 20)] || hooks.oferta;
  return `${hook} ${name}${priceText ? ` por ${priceText}` : ""}. Veja os detalhes e aproveite. ${action}.`;
}

async function createLocalPhotoVideo({ id, userId, aspect, duration, inputDataUrl, prompt, productName, price, cta, style, voice }) {
  const inline = dataUrlToInline(inputDataUrl);
  if (!inline?.mimeType?.startsWith("image/")) throw new Error("O NewViral Free precisa de uma imagem válida.");

  const seconds = Math.max(4, Math.min(12, Number(duration) || 8));
  const dims = aspect === "16:9" ? [1280, 720] : aspect === "1:1" ? [720, 720] : [720, 1280];
  const [w, h] = dims;
  const frames = seconds * 30;
  const token = randomUUID();
  const inputExt = inline.mimeType === "image/png" ? "png" : inline.mimeType === "image/webp" ? "webp" : "jpg";
  const inputPath = join(tmpdir(), `newviral-${token}.${inputExt}`);
  const audioPath = join(tmpdir(), `newviral-${token}.wav`);
  const outputPath = join(tmpdir(), `newviral-free-${id}.mp4`);
  const narration = buildFreeScript({ prompt, productName, price, cta, style });
  let keepOutput = false;

  try {
    await writeFile(inputPath, Buffer.from(inline.data, "base64"));

    const voiceMap = {
      "pt-br-f": "pt-br+f3",
      "pt-br-m": "pt-br+m3",
      "pt": "pt"
    };
    const selectedVoice = voiceMap[cleanText(voice, 20)] || "pt-br+f3";
    await execFileAsync("espeak-ng", ["-v", selectedVoice, "-s", "155", "-p", "48", "-w", audioPath, narration], { maxBuffer: 2 * 1024 * 1024 });

    const headline = escapeDrawtext(productName || "Oferta em destaque");
    const priceLine = escapeDrawtext(price || "");
    const ctaLine = escapeDrawtext(cta || "Confira agora");
    const font = "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf";
    const base = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=0x101114,zoompan=z='min(zoom+0.0006,1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${w}x${h}:fps=30`;
    const overlay = [
      `drawbox=x=0:y=h*0.72:w=w:h=h*0.28:color=black@0.58:t=fill`,
      `drawtext=fontfile=${font}:text='${headline}':fontcolor=white:fontsize=${Math.max(28, Math.round(w * 0.045))}:x=(w-text_w)/2:y=h*0.76`,
      priceLine ? `drawtext=fontfile=${font}:text='${priceLine}':fontcolor=white:fontsize=${Math.max(26, Math.round(w * 0.04))}:x=(w-text_w)/2:y=h*0.82` : null,
      `drawtext=fontfile=${font}:text='${ctaLine}':fontcolor=white:fontsize=${Math.max(22, Math.round(w * 0.032))}:x=(w-text_w)/2:y=h*0.89`,
      "format=yuv420p"
    ].filter(Boolean).join(",");
    const filter = `${base},${overlay}`;

    await execFileAsync("ffmpeg", [
      "-y", "-loop", "1", "-i", inputPath,
      "-i", audioPath,
      "-t", String(seconds),
      "-vf", filter,
      "-af", "apad",
      "-map", "0:v:0", "-map", "1:a:0",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
      "-c:a", "aac", "-b:a", "128k",
      "-pix_fmt", "yuv420p", "-movflags", "+faststart",
      outputPath,
    ], { maxBuffer: 12 * 1024 * 1024 });

    const bytes = await readFile(outputPath);
    const storedUrl = await uploadBufferToStorage(`${userId || "guest"}/local-${id}.mp4`, bytes, "video/mp4");
    if (storedUrl) return { resultUrl: storedUrl, script: narration };

    keepOutput = true;
    return { resultUrl: `/api/studio/free-media?id=${encodeURIComponent(id)}`, script: narration };
  } finally {
    await Promise.allSettled([
      rm(inputPath, { force: true }),
      rm(audioPath, { force: true }),
      ...(keepOutput ? [] : [rm(outputPath, { force: true })]),
    ]);
  }
}

async function createVeoJob({ prompt, aspect, quality, duration, inputDataUrl }) {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.VEO_MODEL || "veo-3.1-generate-preview";
  const inline = dataUrlToInline(inputDataUrl);
  const instance = { prompt: prompt || "Create a polished social media product video." };
  if (inline?.mimeType?.startsWith("image/")) {
    instance.image = { mimeType: inline.mimeType, bytesBase64Encoded: inline.data };
  }
  const parameters = {
    aspectRatio: aspect === "1:1" ? "9:16" : aspect,
    durationSeconds: clampVeoDuration(duration),
    resolution: quality === "4k" ? "4k" : quality === "1080p" ? "1080p" : "720p",
  };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ instances: [instance], parameters }),
    cache: "no-store",
  });
  const data = await safeJson(res);
  if (!res.ok || !data.name) throw new Error(data?.error?.message || "Veo não aceitou a solicitação.");
  return { ref: data.name, model };
}

async function createRunwayJob({ prompt, aspect, duration, inputDataUrl }) {
  const key = process.env.RUNWAYML_API_SECRET || process.env.RUNWAY_API_KEY;
  const model = process.env.RUNWAY_MODEL || "gen4.5";
  const n = Number(duration);
  const seconds = Math.max(2, Math.min(10, Number.isFinite(n) ? Math.round(n) : 5));
  const ratioMap = { "9:16": "720:1280", "16:9": "1280:720", "1:1": "960:960" };
  const payload = {
    model,
    promptText: prompt || "Cinematic social media product video with natural camera movement.",
    ratio: ratioMap[aspect] || "720:1280",
    duration: seconds,
  };
  if (/^data:image\//.test(inputDataUrl || "")) payload.promptImage = inputDataUrl;
  const res = await fetch("https://api.dev.runwayml.com/v1/image_to_video", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-Runway-Version": "2024-11-06",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const data = await safeJson(res);
  if (!res.ok || !data?.id) {
    const error = new Error(data?.error || data?.message || `Runway não aceitou a solicitação (${res.status}).`);
    error.status = res.status;
    throw error;
  }
  return { ref: data.id, model };
}

async function createKlingJob({ prompt, aspect, duration, inputDataUrl }) {
  const { fal } = await import("@fal-ai/client");
  fal.config({ credentials: process.env.FAL_KEY });
  const hasImage = /^data:image\//.test(inputDataUrl || "");
  const model = hasImage ? "fal-ai/kling-video/v2.6/pro/image-to-video" : "fal-ai/kling-video/v2.6/pro/text-to-video";
  const input = hasImage ? {
    prompt: prompt || "Cinematic product presentation with natural movement.",
    start_image_url: inputDataUrl,
    duration: Number(duration) >= 10 ? "10" : "5",
    generate_audio: true,
  } : {
    prompt: prompt || "Cinematic social media product video.",
    duration: Number(duration) >= 10 ? "10" : "5",
    aspect_ratio: ["9:16", "16:9", "1:1"].includes(aspect) ? aspect : "9:16",
    generate_audio: true,
  };
  const result = await fal.queue.submit(model, { input });
  const ref = result?.request_id || result?.requestId;
  if (!ref) throw new Error("Kling não retornou o identificador da fila.");
  return { ref, model };
}

async function createOpenAIImage({ prompt, aspect }) {
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare";
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: prompt || "Premium social media product cover", size: resolutionForOpenAI(aspect), quality: "high", output_format: "webp", n: 1 }),
    cache: "no-store",
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.error?.message || "OpenAI Image não aceitou a solicitação.");
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI não retornou a imagem esperada.");
  return { url: `data:image/webp;base64,${b64}`, model };
}
