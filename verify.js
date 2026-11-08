import { json, missingConfig, serviceHeaders } from "../../_shared/supabase.js";

export async function onRequestGet({ request, env }) {
  if (missingConfig(env, ["PAYSTACK_SECRET_KEY", "SUPABASE_URL", "SUPABASE_SECRET_KEY"]).length) {
    return json({ error: "Payment verification is not configured." }, 503);
  }
  const reference = new URL(request.url).searchParams.get("reference") || "";
  if (!/^[A-Za-z0-9_-]{8,160}$/.test(reference)) return json({ error: "A valid payment reference is required." }, 400);

  const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` }
  });
  const verification = await paystackResponse.json().catch(() => ({}));
  if (!paystackResponse.ok || !verification.status) {
    return json({ error: verification.message || "Unable to verify this transaction." }, 502);
  }
  if (String(verification.data?.reference || "") !== reference) {
    return json({ error: "Paystack returned a different payment reference." }, 409);
  }
  if (verification.data?.status !== "success") {
    return json({ verified: false, status: verification.data?.status || "pending" });
  }

  const lookupUrl = new URL(`${env.SUPABASE_URL}/rest/v1/invoices`);
  lookupUrl.searchParams.set("paystack_reference", `eq.${reference}`);
  lookupUrl.searchParams.set("select", "id,amount,currency,status");
  const lookup = await fetch(lookupUrl, { headers: serviceHeaders(env) });
  if (!lookup.ok) return json({ error: "Could not find the invoice for this payment." }, 502);
  const invoice = (await lookup.json())?.[0];
  if (!invoice) return json({ error: "No invoice matches this payment reference." }, 404);

  const expectedAmount = Math.round(Number(invoice.amount) * 100);
  const paidAmount = Number(verification.data.amount);
  const expectedCurrency = String(invoice.currency || "NGN").toUpperCase();
  const paidCurrency = String(verification.data.currency || "").toUpperCase();
  if (expectedAmount !== paidAmount || expectedCurrency !== paidCurrency) {
    return json({ error: "The payment amount or currency does not match the invoice." }, 409);
  }

  if (invoice.status !== "paid") {
    const updateUrl = new URL(`${env.SUPABASE_URL}/rest/v1/invoices`);
    updateUrl.searchParams.set("id", `eq.${invoice.id}`);
    const update = await fetch(updateUrl, {
      method: "PATCH",
      headers: serviceHeaders(env, { "content-type": "application/json", Prefer: "return=minimal" }),
      body: JSON.stringify({ status: "paid", paid_at: verification.data.paid_at || new Date().toISOString() })
    });
    if (!update.ok) return json({ error: "Payment was verified but the invoice could not be updated." }, 502);
  }

  return json({ verified: true, status: "paid", invoice_id: invoice.id });
}
