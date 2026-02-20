import { payload } from "pix-payload";
import {
  allowCors,
  getUserFromRequest,
  json,
  normalizePixCity,
  normalizePixName,
  releaseExpiredReservations,
  supabaseAdmin,
} from "./_lib/supabase.js";

function transactionId() {
  return `RIFA${Date.now()}`.slice(0, 25);
}

export default async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const user = await getUserFromRequest(req);
  if (!user) return json(res, 401, { error: "Nao autenticado." });

  const reservationId = req.body?.reservationId;
  if (!reservationId) return json(res, 400, { error: "Missing reservation id." });

  const { data: reservation, error: reservationError } = await supabaseAdmin
    .from("raffle_reservations")
    .select("id,raffle_id,buyer_id,total_price,status,expires_at,payment_id")
    .eq("id", reservationId)
    .eq("buyer_id", user.id)
    .single();

  if (reservationError || !reservation) {
    return json(res, 404, { error: "Reserva nao encontrada." });
  }

  await releaseExpiredReservations(reservation.raffle_id);

  const { data: freshReservation } = await supabaseAdmin
    .from("raffle_reservations")
    .select("id,raffle_id,buyer_id,total_price,status,expires_at,payment_id")
    .eq("id", reservationId)
    .single();

  if (!freshReservation || freshReservation.status === "expired") {
    return json(res, 410, { error: "Reserva expirada. Refaca a compra." });
  }

  const { data: raffle, error: raffleError } = await supabaseAdmin
    .from("raffles")
    .select("pix_key,pix_full_name,pix_city")
    .eq("id", freshReservation.raffle_id)
    .single();

  if (raffleError || !raffle) {
    return json(res, 404, { error: "Rifa nao encontrada." });
  }

  const paymentId = freshReservation.payment_id || transactionId();

  const pix = payload({
    key: raffle.pix_key,
    name: normalizePixName(raffle.pix_full_name),
    city: normalizePixCity(raffle.pix_city || "SAO PAULO"),
    amount: Number(freshReservation.total_price),
    transactionId: paymentId,
  });

  await Promise.all([
    supabaseAdmin
      .from("raffle_reservations")
      .update({ payment_id: paymentId, updated_at: new Date().toISOString() })
      .eq("id", freshReservation.id),
    supabaseAdmin
      .from("tickets")
      .update({ payment_id: paymentId })
      .eq("reservation_id", freshReservation.id),
  ]);

  return json(res, 200, { copyAndPaste: pix, paymentId });
}
