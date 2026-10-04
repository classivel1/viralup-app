import { ensureProfile, getUserFromRequest, jsonError } from "../../../../lib/studio";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const user = await getUserFromRequest(request);
  if (!user) return jsonError("Sessão inválida.", 401);
  const profile = await ensureProfile(user);
  if (!profile) return jsonError("Banco de créditos indisponível.", 503);
  return Response.json({ credits: Number(profile.credits || 0) });
}
