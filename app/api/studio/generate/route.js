import { randomUUID } from "node:crypto";
import {
  COSTS, addCredits, chooseProvider, clampVeoDuration, consumeCredits, dataUrlToInline, ensureProfile,
  getUserFromRequest, jsonError, resolutionForOpenAI, safeJson, saveProject, uploadDataUrlToStorage
} from "../../../../lib/studio";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const tool = String(body.tool || "ai-video");
  const kind = body.kind === "image" ? "image" : body.kind === "audio" ? "audio" : "video";
  const cost = COSTS[tool] || 4;
  const prompt = String(body.prompt || "").trim().slice(0, 12000);
  const aspect = ["9:16", "16:9", "1:1"].includes(body.aspect) ? body.aspect : "9:16";
  const quality = ["720p", "1080p", "4k"].includes(body.quality) ? body.quality : "720p";
  const inputDataUrl = typeof body.inputDataUrl === "string" && body.inputDataUrl.length < 18_000_000 ? body.inputDataUrl : null;
  let provider = chooseProvider({ requested: body.provider, kind, hasInput: Boolean(inputDataUrl) });
  const user = await getUserFromRequest(request);

  if (provider !== "demo" && !user) return jsonError("Entre na sua conta para usar a geração real.", 401);

  let debited = false;
  if (user && provider !== "demo") {
    await ensureProfile(user);
    const debit = await consumeCredits(user.id, cost);
    if (!debit.ok) return jsonError(debit.unavailable ? "Banco de créditos indisponível." : "Créditos insuficientes.", debit.unavailable ? 503 : 402);
    debited = true;
  }

  const id = randomUUID();
  try {
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
