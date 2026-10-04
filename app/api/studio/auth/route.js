import { getSupabasePublicConfig, jsonError, safeJson } from "../../../../lib/studio";

export async function POST(request) {
  const { url, publicKey } = getSupabasePublicConfig();
  if (!url || !publicKey) return jsonError("Supabase não configurado no servidor.", 503);
  const body = await request.json().catch(() => ({}));
  const action = body.action === "signup" ? "signup" : "login";
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email.includes("@") || password.length < 8) return jsonError("Informe e-mail válido e senha com pelo menos 8 caracteres.");
  const endpoint = action === "signup" ? `${url}/auth/v1/signup` : `${url}/auth/v1/token?grant_type=password`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { apikey: publicKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  const data = await safeJson(res);
  if (!res.ok) return jsonError(data?.msg || data?.error_description || data?.error || "Falha na autenticação.", res.status);
  return Response.json(data);
}
