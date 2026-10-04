const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_PUBLIC_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const COSTS = {
  "product-video": 12,
  "ai-video": 18,
  ugc: 18,
  avatar: 18,
  thumbnail: 4,
  "image-enhancer": 4,
  "video-enhancer": 4,
  background: 4,
  "remove-object": 4,
  captions: 3,
  noise: 3,
  translator: 3,
};

export function jsonError(message, status = 400, extra = {}) {
  return Response.json({ error: message, ...extra }, { status });
}

export function providerConfig() {
  return {
    gemini: Boolean(process.env.GEMINI_API_KEY),
    fal: Boolean(process.env.FAL_KEY),
    runway: Boolean(process.env.RUNWAYML_API_SECRET || process.env.RUNWAY_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    supabase: Boolean(SUPABASE_URL && SUPABASE_PUBLIC_KEY && SUPABASE_SECRET_KEY),
    mercadopago: Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN),
  };
}

export async function getUserFromRequest(request) {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ") || !SUPABASE_URL || !SUPABASE_PUBLIC_KEY) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: auth },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

function adminHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SECRET_KEY,
    Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export async function getProfile(userId) {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,email,credits`, {
    headers: adminHeaders(), cache: "no-store",
  });
  if (!r.ok) return null;
  const rows = await r.json();
  return rows?.[0] || null;
}

export async function ensureProfile(user) {
  if (!user || !SUPABASE_URL || !SUPABASE_SECRET_KEY) return null;
  const existing = await getProfile(user.id);
  if (existing) return existing;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: "POST",
    headers: adminHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify({ id: user.id, email: user.email || null, credits: 120 }),
  });
  if (!r.ok) return null;
  const rows = await r.json();
  return rows?.[0] || null;
}

export async function consumeCredits(userId, amount) {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) return { ok: false, unavailable: true };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consume_credits`, {
    method: "POST", headers: adminHeaders(), body: JSON.stringify({ p_user_id: userId, p_amount: amount }),
  });
  if (!r.ok) return { ok: false, error: await safeText(r) };
  const value = await r.json();
  return { ok: Boolean(value) };
}

export async function addCredits(userId, amount) {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) return { ok: false };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/add_credits`, {
    method: "POST", headers: adminHeaders(), body: JSON.stringify({ p_user_id: userId, p_amount: amount }),
  });
  return { ok: r.ok, value: r.ok ? await r.json() : null };
}

export async function saveProject(userId, project) {
  if (!userId || !SUPABASE_URL || !SUPABASE_SECRET_KEY) return;
  await fetch(`${SUPABASE_URL}/rest/v1/projects`, {
    method: "POST", headers: adminHeaders(),
    body: JSON.stringify({
      id: project.id, user_id: userId, tool: project.tool, provider: project.provider,
      provider_ref: project.providerRef || null, status: project.status, prompt: project.prompt || "",
      aspect: project.aspect || null, quality: project.quality || null, result_url: project.resultUrl || null,
      metadata: project.metadata || {},
    }),
  });
}

export async function recordPayment({ providerPaymentId, userId, credits, amount, status, raw }) {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) return { inserted: false };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/payments?on_conflict=provider_payment_id`, {
    method: "POST",
    headers: adminHeaders({ Prefer: "return=representation,resolution=ignore-duplicates" }),
    body: JSON.stringify({ provider_payment_id: String(providerPaymentId), user_id: userId, credits, amount, status, raw }),
  });
  if (!r.ok) return { inserted: false };
  const rows = await r.json().catch(() => []);
  return { inserted: Array.isArray(rows) && rows.length > 0 };
}

export function getSupabasePublicConfig() {
  return { url: SUPABASE_URL, publicKey: SUPABASE_PUBLIC_KEY };
}

export function getSupabaseAdminConfig() {
  return { url: SUPABASE_URL, secretKey: SUPABASE_SECRET_KEY };
}

export function dataUrlToInline(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

export function chooseProvider({ requested, kind, hasInput }) {
  const cfg = providerConfig();
  if (requested === "veo" && cfg.gemini) return "veo";
  if (requested === "runway" && cfg.runway) return "runway";
  if (requested === "kling" && cfg.fal) return "kling";
  if (requested === "openai" && kind === "image" && cfg.openai) return "openai";
  if (kind === "image" && cfg.openai) return "openai";
  // Automatic video routing: prefer Runway because it accepts the uploaded
  // image data URI directly and provides the most reliable photo-to-video path.
  if (kind === "video" && cfg.runway) return "runway";
  if (kind === "video" && cfg.gemini) return "veo";
  if (kind === "video" && cfg.fal) return "kling";
  return "demo";
}

export function resolutionForOpenAI(aspect = "9:16") {
  if (aspect === "16:9") return "1536x864";
  if (aspect === "1:1") return "1024x1024";
  return "1024x1536";
}

export function clampVeoDuration(duration) {
  const n = Number(duration);
  return [4, 6, 8].includes(n) ? n : n <= 5 ? 4 : 8;
}

export async function safeJson(res) {
  try { return await res.json(); } catch { return { error: await safeText(res) }; }
}

export async function safeText(res) {
  try { return await res.text(); } catch { return "Erro desconhecido"; }
}

const MEDIA_BUCKET = process.env.SUPABASE_MEDIA_BUCKET || "viralup-media";

function safeObjectPath(path) {
  return String(path || "media").replace(/[^a-zA-Z0-9._/-]+/g, "-").replace(/^\/+/, "");
}

export async function uploadBufferToStorage(path, buffer, contentType = "application/octet-stream") {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) return null;
  const objectPath = safeObjectPath(path);
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${MEDIA_BUCKET}/${objectPath}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: buffer,
  });
  if (!res.ok) throw new Error(`Falha ao salvar mídia: ${await safeText(res)}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${objectPath}`;
}

export async function uploadDataUrlToStorage(path, dataUrl) {
  const inline = dataUrlToInline(dataUrl);
  if (!inline) return null;
  return uploadBufferToStorage(path, Buffer.from(inline.data, "base64"), inline.mimeType || "application/octet-stream");
}

export async function mirrorRemoteToStorage(path, url, headers = {}) {
  if (!url || !SUPABASE_URL || !SUPABASE_SECRET_KEY) return url || null;
  const remote = await fetch(url, { headers, cache: "no-store" });
  if (!remote.ok) throw new Error(`Falha ao baixar mídia gerada (${remote.status}).`);
  const contentType = remote.headers.get("content-type") || "application/octet-stream";
  const bytes = Buffer.from(await remote.arrayBuffer());
  return uploadBufferToStorage(path, bytes, contentType);
}
