import {
  allowCors,
  getUserFromRequest,
  json,
  releaseExpiredReservations,
  supabaseAdmin,
} from "../_lib/supabase.js";

export default async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  const user = await getUserFromRequest(req);
  if (!user) return json(res, 401, { error: "Nao autenticado." });

  await releaseExpiredReservations();

  const { data: raffles, error } = await supabaseAdmin
    .from("raffles")
    .select("id,title,description,ticket_price,total_tickets,draw_date,created_at")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return json(res, 500, { error: error.message });

  const items = await Promise.all(
    (raffles || []).map(async (raffle) => {
      const { data: soldRows } = await supabaseAdmin
        .from("tickets")
        .select("id")
        .eq("raffle_id", raffle.id)
        .eq("status", "paid");

      return {
        ...raffle,
        sold_count: soldRows?.length || 0,
      };
    }),
  );

  return json(res, 200, { items });
}
