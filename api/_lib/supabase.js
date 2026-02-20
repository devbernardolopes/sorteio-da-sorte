import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for API routes.");
}

export const supabaseAdmin = createClient(supabaseUrl, serviceKey);

export function json(res, status, body) {
  res.status(status).json(body);
}

export function allowCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

export async function getUserFromRequest(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return null;
  return data.user || null;
}

export async function releaseExpiredReservations(raffleId = null) {
  const nowIso = new Date().toISOString();

  let ticketQuery = supabaseAdmin
    .from("tickets")
    .update({ status: "expired" })
    .eq("status", "reserved")
    .lt("expires_at", nowIso);

  let reservationQuery = supabaseAdmin
    .from("raffle_reservations")
    .update({ status: "expired" })
    .eq("status", "reserved")
    .lt("expires_at", nowIso);

  if (raffleId) {
    ticketQuery = ticketQuery.eq("raffle_id", raffleId);
    reservationQuery = reservationQuery.eq("raffle_id", raffleId);
  }

  await Promise.all([ticketQuery, reservationQuery]);
}

export function normalizePixName(name) {
  return (name || "SORTEIO DA SORTE")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .slice(0, 25);
}

export function normalizePixCity(city) {
  return (city || "SAO PAULO")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .slice(0, 15);
}
