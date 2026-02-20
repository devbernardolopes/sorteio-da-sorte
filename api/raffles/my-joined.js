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

  const { data: reservations, error } = await supabaseAdmin
    .from("raffle_reservations")
    .select("id, raffle_id, quantity, total_price, status, updated_at")
    .eq("buyer_id", user.id)
    .in("status", ["reserved", "paid"])
    .order("updated_at", { ascending: false });

  if (error) return json(res, 500, { error: error.message });

  const items = await Promise.all(
    (reservations || []).map(async (reservation) => {
      const [{ data: raffle }, { data: tickets }] = await Promise.all([
        supabaseAdmin
          .from("raffles")
          .select("title")
          .eq("id", reservation.raffle_id)
          .single(),
        supabaseAdmin
          .from("tickets")
          .select("number_selected")
          .eq("reservation_id", reservation.id)
          .order("number_selected", { ascending: true }),
      ]);

      return {
        raffle_id: reservation.raffle_id,
        raffle_title: raffle?.title || "Rifa",
        status: reservation.status,
        ticket_numbers: (tickets || []).map((t) => t.number_selected),
        total_price: reservation.total_price,
        updated_at: reservation.updated_at,
      };
    }),
  );

  return json(res, 200, { items });
}
