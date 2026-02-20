import {
  allowCors,
  json,
  releaseExpiredReservations,
  supabaseAdmin,
} from "../_lib/supabase.js";

export default async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  const raffleId = req.query.id;
  if (!raffleId) return json(res, 400, { error: "Missing raffle id." });

  await releaseExpiredReservations(raffleId);

  const { data: raffle, error } = await supabaseAdmin
    .from("raffles")
    .select("id,title,description,ticket_price,total_tickets,max_tickets_per_user,draw_date")
    .eq("id", raffleId)
    .single();

  if (error || !raffle) return json(res, 404, { error: "Rifa nao encontrada." });

  const { data: usedRows } = await supabaseAdmin
    .from("tickets")
    .select("number_selected")
    .eq("raffle_id", raffleId)
    .in("status", ["reserved", "paid"]);

  return json(res, 200, {
    raffle: {
      ...raffle,
      available_count: Math.max(0, Number(raffle.total_tickets || 0) - (usedRows?.length || 0)),
    },
  });
}
