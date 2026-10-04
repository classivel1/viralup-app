import { jsonError } from "../../../../lib/studio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider");
  const uri = searchParams.get("uri");
  if (provider !== "veo" || !uri) return jsonError("Mídia inválida.", 400);
  if (!process.env.GEMINI_API_KEY) return jsonError("Veo não configurado.", 503);

  let target;
  try { target = new URL(uri); } catch { return jsonError("URL de mídia inválida.", 400); }
  const allowed = ["generativelanguage.googleapis.com", "aiplatform.googleapis.com", "storage.googleapis.com"];
  if (!allowed.some(host => target.hostname === host || target.hostname.endsWith(`.${host}`))) {
    return jsonError("Origem de mídia não permitida.", 400);
  }

  const upstream = await fetch(target, {
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY },
    redirect: "follow",
    cache: "no-store",
  });
  if (!upstream.ok || !upstream.body) return jsonError("Não foi possível carregar o vídeo gerado.", 502);

  const headers = new Headers();
  headers.set("content-type", upstream.headers.get("content-type") || "video/mp4");
  headers.set("cache-control", "private, max-age=3600");
  const length = upstream.headers.get("content-length");
  if (length) headers.set("content-length", length);
  return new Response(upstream.body, { status: 200, headers });
}
