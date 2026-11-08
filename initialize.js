import { configuredSupabase, getAuthenticatedUser, json, missingConfig, serviceHeaders } from "../../_shared/supabase.js";

export async function onRequestPost({ request, env }) {
  const missing = missingConfig(env, ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "PAYSTACK_SECRET_KEY"]);
  if (missing.length || !configuredSupabase(env)) {
    return json({ error: "Online payment is not configured yet. Please contact the team." }, 503);
  }

  const { user, error: authError } = await getAuthenticatedUser(request, env);
  if (authError) return json({ error: authError.message }, 401);
  if (!user) return json({ error: "Please sign in before paying an invoice." }, 401);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid payment request." }, 400); }
  const invoiceId = String(body?.invoice_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(invoiceId)) return json({ error: "A valid invoice is required." }, 400);

  const lookupUrl = new URL(`${env.SUPABASE_URL}/rest/v1/invoices`);
  lookupUrl.searchParams.set("id", `eq.${invoiceId}`);
  lookupUrl.searchParams.set("client_id", `eq.${user.id}`);
  lookupUrl.searchParams.set("select", "id,invoice_number,amount,currency,status");
  const invoiceResponse = await fetch(lookupUrl, { headers: serviceHeaders(env) });
  if (!invoiceResponse.ok) return json({ error: "Could not load this invoice." }, 502);
  const invoices = await invoiceResponse.json();
  const invoice = invoices?.[0];
  if (!invoice) return json({ error: "Invoice not found for this account." }, 404);

  const amount = Number(invoice.amount);
  const currency = String(invoice.currency || "NGN").toUpperCase();
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(Math.round(amount * 100))) {
    return json({ error: "This invoice has an invalid payment amount. Please contact the team." }, 422);
  }
  if (["paid", "cancelled"].includes(String(invoice.status).toLowerCase())) {
    return json({ error: "This invoice cannot be paid." }, 409);
  }
  if (currency !== "NGN") return json({ error: "Only NGN invoices are currently supported by this checkout." }, 422);

  const reference = `KST-${invoice.id}-${crypto.randomUUID()}`;
  const callbackUrl = env.PAYSTACK_CALLBACK_URL || `${new URL(request.url).origin}/payment-success.html`;
  const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      email: user.email,
      amount: Math.round(amount * 100),
      currency,
      reference,
      callback_url: callbackUrl,
      metadata: {
        invoice_id: invoice.id,
        user_id: user.id,
        invoice_number: invoice.invoice_number
      }
    })
  });
  const result = await paystackResponse.json().catch(() => ({}));
  if (!paystackResponse.ok || !result.status || !result.data?.authorization_url) {
    return json({ error: result.message || "Paystack could not initialize payment." }, 502);
  }

  const updateUrl = new URL(`${env.SUPABASE_URL}/rest/v1/invoices`);
  updateUrl.searchParams.set("id", `eq.${invoice.id}`);
  const updateResponse = await fetch(updateUrl, {
    method: "PATCH",
    headers: serviceHeaders(env, {
      "content-type": "application/json",
      Prefer: "return=minimal"
    }),
    body: JSON.stringify({ paystack_reference: reference })
  });
  if (!updateResponse.ok) return json({ error: "Payment was initialized but the invoice reference could not be saved. Please contact support before retrying." }, 502);

  return json({ authorization_url: result.data.authorization_url, reference });
}
