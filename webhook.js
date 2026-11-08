import { missingConfig, serviceHeaders } from "../../_shared/supabase.js";

const toHex = (buffer) => [...new Uint8Array(buffer)].map((value) => value.toString(16).padStart(2, "0")).join("");

async function hmacSha512(secret, payloadBytes) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, payloadBytes));
}

function constantTimeEqualBytes(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index];
  return difference === 0;
}

function hexToBytes(hex) {
  if (!/^[0-9a-f]{128}$/i.test(hex)) return null;
  const output = new Uint8Array(64);
  for (let index = 0; index < output.length; index++) {
    output[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return output;
}

async function verifyCurrentPaystackSignature(rawBody, header, secret, now = Math.floor(Date.now() / 1000)) {
  if (!header || !secret) return false;
  let timestamp = null;
  const signatures = [];

  for (const part of header.split(",")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name === "t") {
      if (timestamp !== null || !/^\d+$/.test(value)) return false;
      timestamp = Number(value);
    } else if (name === "v1") {
      const colon = value.indexOf(":");
      if (colon > 0) signatures.push(value.slice(colon + 1));
    }
  }

  if (timestamp === null || !Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > 300 || !signatures.length) {
    return false;
  }

  const prefix = new TextEncoder().encode(`${timestamp}.`);
  const signedPayload = new Uint8Array(prefix.length + rawBody.length);
  signedPayload.set(prefix, 0);
  signedPayload.set(rawBody, prefix.length);
  const expected = await hmacSha512(secret, signedPayload);

  return signatures.some((signature) => {
    const candidate = hexToBytes(signature);
    return candidate ? constantTimeEqualBytes(expected, candidate) : false;
  });
}

async function verifyLegacyPaystackSignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  const candidate = hexToBytes(signature);
  if (!candidate) return false;
  const expected = await hmacSha512(secret, rawBody);
  return constantTimeEqualBytes(expected, candidate);
}

export async function onRequestPost({ request, env }) {
  if (missingConfig(env, ["SUPABASE_URL", "SUPABASE_SECRET_KEY"]).length) {
    return new Response("Not configured", { status: 503 });
  }

  const rawBody = new Uint8Array(await request.arrayBuffer());
  if (rawBody.length > 1_000_000) return new Response("Payload too large", { status: 413 });

  // Prefer Paystack's current timestamped signing secret/header. Keep the
  // legacy x-paystack-signature check available during migration.
  const currentSignature = request.headers.get("paystack-signature") || "";
  const legacySignature = request.headers.get("x-paystack-signature") || "";
  let signatureValid = false;

  if (currentSignature) {
    if (!env.PAYSTACK_WEBHOOK_SECRET) return new Response("Webhook signing secret not configured", { status: 503 });
    signatureValid = await verifyCurrentPaystackSignature(rawBody, currentSignature, env.PAYSTACK_WEBHOOK_SECRET);
  } else if (legacySignature) {
    if (!env.PAYSTACK_SECRET_KEY) return new Response("Legacy webhook verification secret not configured", { status: 503 });
    signatureValid = await verifyLegacyPaystackSignature(rawBody, legacySignature, env.PAYSTACK_SECRET_KEY);
  }

  if (!signatureValid) return new Response("Invalid signature", { status: 401 });

  let event;
  try { event = JSON.parse(new TextDecoder().decode(rawBody)); }
  catch { return new Response("Invalid JSON", { status: 400 }); }

  // Paystack endpoint pings and unrelated event types are acknowledged after
  // signature validation so they do not trigger unnecessary retries.
  if (event.event !== "charge.success" || event.data?.status !== "success" || !event.data?.reference) {
    return new Response("ok", { status: 200 });
  }

  const lookupUrl = new URL(`${env.SUPABASE_URL}/rest/v1/invoices`);
  lookupUrl.searchParams.set("paystack_reference", `eq.${String(event.data.reference)}`);
  lookupUrl.searchParams.set("select", "id,amount,currency,status");
  const lookup = await fetch(lookupUrl, { headers: serviceHeaders(env) });
  if (!lookup.ok) return new Response("Invoice lookup failed", { status: 500 });
  const invoice = (await lookup.json())?.[0];
  if (!invoice) return new Response("Invoice not found", { status: 404 });

  const expectedAmount = Math.round(Number(invoice.amount) * 100);
  const paidAmount = Number(event.data.amount);
  const expectedCurrency = String(invoice.currency || "NGN").toUpperCase();
  const paidCurrency = String(event.data.currency || "").toUpperCase();
  if (expectedAmount !== paidAmount || expectedCurrency !== paidCurrency) {
    return new Response("Payment amount or currency mismatch", { status: 409 });
  }

  if (invoice.status !== "paid") {
    const updateUrl = new URL(`${env.SUPABASE_URL}/rest/v1/invoices`);
    updateUrl.searchParams.set("id", `eq.${invoice.id}`);
    const update = await fetch(updateUrl, {
      method: "PATCH",
      headers: serviceHeaders(env, { "content-type": "application/json", Prefer: "return=minimal" }),
      body: JSON.stringify({ status: "paid", paid_at: event.data.paid_at || new Date().toISOString() })
    });
    if (!update.ok) return new Response("Invoice update failed", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
