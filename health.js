export async function onRequestGet() {
  return Response.json({
    ok: true,
    service: "Kingdom Spirit Technology",
    platform: "Cloudflare Pages Functions",
    version: "cloudflare-repair-2026-11-07"
  }, { headers: { "Cache-Control": "no-store" } });
}
