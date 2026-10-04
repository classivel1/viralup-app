import { addCredits, jsonError, recordPayment, safeJson } from "../../../../lib/studio";

export async function POST(request) {
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) return jsonError("Billing não configurado.", 503);
  const payload = await request.json().catch(() => ({}));
  const url = new URL(request.url);
  const paymentId = payload?.data?.id || url.searchParams.get("data.id") || url.searchParams.get("id");
  if (!paymentId) return Response.json({ ok: true, ignored: true });
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` }, cache: "no-store",
  });
  const payment = await safeJson(res);
  if (!res.ok) return jsonError("Não foi possível validar o pagamento.", 502);
  const ref = String(payment.external_reference || "");
  const [userId, creditsRaw] = ref.split("|");
  const credits = Number(creditsRaw);
  if (!userId || !Number.isFinite(credits) || credits <= 0) return Response.json({ ok: true, ignored: true });
  const recorded = await recordPayment({ providerPaymentId: payment.id, userId, credits, amount: payment.transaction_amount || 0, status: payment.status || "unknown", raw: payment });
  if (payment.status === "approved" && recorded.inserted) await addCredits(userId, credits);
  return Response.json({ ok: true });
}
