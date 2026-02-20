import {
  allowCors,
  json,
  releaseExpiredReservations,
  supabaseAdmin,
} from "../_lib/supabase.js";

export default async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  await releaseExpiredReservations();

  const { data: raffles, error } = await supabaseAdmin
    .from("raffles")
    .select("id,title,description,ticket_price,total_tickets,draw_date,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return json(res, 500, { error: error.message });

  const items = await Promise.all(
    (raffles || []).map(async (raffle) => {
      const { data: usedRows } = await supabaseAdmin
        .from("tickets")
        .select("id")
        .eq("raffle_id", raffle.id)
        .in("status", ["reserved", "paid"]);

      const usedCount = usedRows?.length || 0;
      return {
        ...raffle,
        available_count: Math.max(0, Number(raffle.total_tickets || 0) - usedCount),
      };
    }),
  );

  return json(res, 200, { items });
}
