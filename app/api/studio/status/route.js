import { getUserFromRequest, jsonError, mirrorRemoteToStorage, safeJson } from "../../../../lib/studio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider");
  const ref = searchParams.get("ref") || "";
  const model = searchParams.get("model") || "";
  if (!provider || !ref) return jsonError("Parâmetros incompletos.");
  const user = await getUserFromRequest(request);
  if (!user) return jsonError("Sessão necessária.", 401);
  try {
    if (provider === "veo") return Response.json(await veoStatus(ref, user.id));
    if (provider === "kling") return Response.json(await klingStatus(ref, model, user.id));
    return Response.json({ status: "completed", progress: 100 });
  } catch (e) { return jsonError(e.message || "Falha ao consultar geração.", 502); }
}

async function veoStatus(ref, userId) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${ref}`, {
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY }, cache: "no-store",
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.error?.message || "Veo não retornou o status.");
  if (!data.done) return { status: "processing", progress: 58 };
  if (data.error) return { status: "failed", progress: 100, error: data.error.message || "Geração bloqueada ou falhou." };
  const sample = data?.response?.generateVideoResponse?.generatedSamples?.[0]?.video || data?.response?.generatedVideos?.[0]?.video;
  const rawUrl = sample?.uri || sample?.url || null;
  const resultUrl = rawUrl ? await mirrorRemoteToStorage(`${userId}/${encodeURIComponent(ref).replace(/%/g, "-")}.mp4`, rawUrl, { "x-goog-api-key": process.env.GEMINI_API_KEY }) : null;
  return { status: "completed", progress: 100, resultUrl };
}

async function klingStatus(ref, model, userId) {
  const { fal } = await import("@fal-ai/client");
  fal.config({ credentials: process.env.FAL_KEY });
  const selected = model || "fal-ai/kling-video/v2.6/pro/text-to-video";
  const status = await fal.queue.status(selected, { requestId: ref, logs: false });
  const s = String(status?.status || "").toUpperCase();
  if (s === "COMPLETED") {
    const result = await fal.queue.result(selected, { requestId: ref });
    const rawUrl = result?.data?.video?.url || result?.video?.url || null;
    const resultUrl = rawUrl ? await mirrorRemoteToStorage(`${userId}/${ref}.mp4`, rawUrl) : null;
    return { status: "completed", progress: 100, resultUrl };
  }
  if (["FAILED", "CANCELLED"].includes(s)) return { status: "failed", progress: 100, error: "A geração do Kling falhou." };
  return { status: s === "IN_QUEUE" ? "queued" : "processing", progress: s === "IN_QUEUE" ? 18 : 62 };
}
