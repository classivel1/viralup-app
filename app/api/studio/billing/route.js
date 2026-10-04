import { getUserFromRequest, jsonError, safeJson } from "../../../../lib/studio";

const PACKS = {
  starter: { credits: 120, amount: 29.90, title: "ViralUp Studio - 120 créditos" },
  creator: { credits: 350, amount: 69.90, title: "ViralUp Studio - 350 créditos" },
  pro: { credits: 900, amount: 149.90, title: "ViralUp Studio - 900 créditos" },
};

export async function POST(request) {
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) return jsonError("Mercado Pago não configurado.", 503);
  const user = await getUserFromRequest(request);
  if (!user) return jsonError("Entre na sua conta para comprar créditos.", 401);
  const body = await request.json().catch(() => ({}));
  const pack = PACKS[body.pack] || PACKS.creator;
  const origin = new URL(request.url).origin;
  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [{ title: pack.title, quantity: 1, unit_price: pack.amount, currency_id: "BRL" }],
      payer: user.email ? { email: user.email } : undefined,
      external_reference: `${user.id}|${pack.credits}`,
      metadata: { user_id: user.id, credits: pack.credits },
      back_urls: { success: `${origin}/?payment=success`, pending: `${origin}/?payment=pending`, failure: `${origin}/?payment=failure` },
      auto_return: "approved",
      notification_url: `${origin}/api/studio/webhook`,
    }),
    cache: "no-store",
  });
  const data = await safeJson(res);
  if (!res.ok) return jsonError(data?.message || "Mercado Pago recusou a preferência.", 502);
  return Response.json({ checkoutUrl: data.init_point || data.sandbox_init_point, preferenceId: data.id, credits: pack.credits });
}
