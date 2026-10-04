import { addCredits, jsonError, recordPayment, safeJson } from "../../../../lib/studio";

export async function POST(request) {
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) return jsonError("Billing não configurado.", 503);
  const payload = await request.json().catch(() => ({}));
  const url = new URL(request.url);
  const paymentId = payload?.data?.id || url.searchParams.get("data.id") || url.searchParams.get("id");
  if (!paymentId) return Response.json({ ok: true, ignored: true });

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` },
    cache: "no-store",
  });
  const payment = await safeJson(res);
  if (!res.ok) return jsonError("Não foi possível validar o pagamento.", 502);

  // Mercado Pago envia novos Webhooks quando o status muda. Só persistimos
  // a transação quando ela estiver aprovada; assim um evento "pending"
  // nunca bloqueia a liberação posterior dos créditos.
  if (payment.status !== "approved") {
    return Response.json({ ok: true, status: payment.status || "unknown", credited: false });
  }

  const ref = String(payment.external_reference || "");
  const [userId, creditsRaw] = ref.split("|");
  const credits = Number(creditsRaw);
  if (!userId || !Number.isFinite(credits) || credits <= 0) {
    return Response.json({ ok: true, ignored: true });
  }

  const recorded = await recordPayment({
    providerPaymentId: payment.id,
    userId,
    credits,
    amount: payment.transaction_amount || 0,
    status: "approved",
    raw: payment,
  });

  // provider_payment_id é UNIQUE; repetições do mesmo webhook não creditam novamente.
  if (recorded.inserted) await addCredits(userId, credits);
  return Response.json({ ok: true, credited: recorded.inserted });
}
