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

  const reservationId = req.query.id;
  if (!reservationId) return json(res, 400, { error: "Missing reservation id." });

  const { data: reservation, error } = await supabaseAdmin
    .from("raffle_reservations")
    .select("id,raffle_id,buyer_id,quantity,total_price,status,expires_at")
    .eq("id", reservationId)
    .eq("buyer_id", user.id)
    .single();

  if (error || !reservation) return json(res, 404, { error: "Reserva nao encontrada." });

  await releaseExpiredReservations(reservation.raffle_id);

  const { data: refreshedReservation } = await supabaseAdmin
    .from("raffle_reservations")
    .select("id,raffle_id,buyer_id,quantity,total_price,status,expires_at")
    .eq("id", reservationId)
    .single();

  if (!refreshedReservation || refreshedReservation.status === "expired") {
    return json(res, 410, { error: "Sua reserva expirou." });
  }

  const [{ data: raffle }, { data: tickets }] = await Promise.all([
    supabaseAdmin.from("raffles").select("title").eq("id", reservation.raffle_id).single(),
    supabaseAdmin
      .from("tickets")
      .select("number_selected")
      .eq("reservation_id", reservation.id)
      .in("status", ["reserved", "paid"])
      .order("number_selected", { ascending: true }),
  ]);

  return json(res, 200, {
    reservation: {
      id: refreshedReservation.id,
      raffle_title: raffle?.title || "Rifa",
      quantity: refreshedReservation.quantity,
      total_price: refreshedReservation.total_price,
      expires_at: refreshedReservation.expires_at,
      ticket_numbers: (tickets || []).map((t) => t.number_selected),
    },
  });
}
