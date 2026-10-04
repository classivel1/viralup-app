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
    return jsonError(error?.message || "Falha ao iniciar geração.", 502);
  }
}

async function createVeoJob({ prompt, aspect, quality, duration, inputDataUrl }) {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.VEO_MODEL || "veo-3.1-generate-preview";
  const inline = dataUrlToInline(inputDataUrl);
  const instance = { prompt: prompt || "Create a polished social media product video." };
  if (inline?.mimeType?.startsWith("image/")) instance.image = { inlineData: inline };
  const parameters = {
    aspectRatio: aspect === "1:1" ? "9:16" : aspect,
    durationSeconds: clampVeoDuration(duration),
    resolution: quality === "4k" ? "4k" : quality === "1080p" ? "1080p" : "720p",
    numberOfVideos: 1,
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
