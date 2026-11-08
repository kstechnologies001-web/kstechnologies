import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const cfg = window.KST_CONFIG || {};
export const isConfigured = Boolean(
  cfg.SUPABASE_URL &&
  cfg.SUPABASE_PUBLISHABLE_KEY &&
  !cfg.SUPABASE_URL.includes("YOUR_") &&
  !cfg.SUPABASE_PUBLISHABLE_KEY.includes("YOUR_")
);

export const supabase = isConfigured
  ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;

export function configMessage() {
  return "Account access is temporarily unavailable. Please contact our team.";
}

const LOGIN_URL = "/account/login.html";
const DASHBOARD_URL = "/account/client-dashboard.html";

export async function requireUser() {
  if (!supabase) {
    location.replace(`${LOGIN_URL}?setup=required`);
    return null;
  }

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) {
    const next = encodeURIComponent(location.pathname + location.search + location.hash);
    location.replace(`${LOGIN_URL}?next=${next}`);
    return null;
  }
  return session;
}

export async function profileFor(user) {
  if (!supabase || !user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,phone,role")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export { DASHBOARD_URL };
