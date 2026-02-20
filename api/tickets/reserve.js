import {
  allowCors,
  getUserFromRequest,
  json,
  releaseExpiredReservations,
  supabaseAdmin,
} from "../_lib/supabase.js";

function pickAvailableNumbers(totalTickets, usedNumbersSet, quantity) {
  const selected = [];
  for (let number = 1; number <= totalTickets; number += 1) {
    if (!usedNumbersSet.has(number)) selected.push(number);
    if (selected.length === quantity) break;
  }
  return selected;
}

export default async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const user = await getUserFromRequest(req);
  if (!user) return json(res, 401, { error: "Nao autenticado." });

  const raffleId = req.body?.raffleId;
  const quantity = Number(req.body?.quantity);
  if (!raffleId || !quantity || quantity < 1) {
    return json(res, 400, { error: "Dados de reserva invalidos." });
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await releaseExpiredReservations(raffleId);

    const { data: raffle, error: raffleError } = await supabaseAdmin
      .from("raffles")
      .select("id,total_tickets,max_tickets_per_user,ticket_price,hold_minutes")
      .eq("id", raffleId)
      .single();

    if (raffleError || !raffle) return json(res, 404, { error: "Rifa nao encontrada." });

    if (quantity > raffle.max_tickets_per_user) {
      return json(res, 400, {
        error: `Quantidade acima do maximo permitido (${raffle.max_tickets_per_user}).`,
      });
    }

    const [{ data: existingByUser }, { data: usedRows }] = await Promise.all([
      supabaseAdmin
        .from("tickets")
        .select("id")
        .eq("raffle_id", raffleId)
        .eq("buyer_id", user.id)
        .in("status", ["reserved", "paid"]),
      supabaseAdmin
        .from("tickets")
        .select("number_selected")
        .eq("raffle_id", raffleId)
        .in("status", ["reserved", "paid"]),
    ]);

    const userCurrentCount = existingByUser?.length || 0;
    if (userCurrentCount + quantity > raffle.max_tickets_per_user) {
      return json(res, 400, {
        error: `Voce ja tem ${userCurrentCount} tickets nessa rifa. Limite: ${raffle.max_tickets_per_user}.`,
      });
    }

    const usedNumbersSet = new Set((usedRows || []).map((row) => row.number_selected));
    const available = pickAvailableNumbers(raffle.total_tickets, usedNumbersSet, quantity);

    if (available.length < quantity) {
      return json(res, 400, { error: "Nao ha tickets suficientes disponiveis." });
    }

    const holdMinutes = Number(raffle.hold_minutes || 15);
    const expiresAt = new Date(Date.now() + holdMinutes * 60 * 1000).toISOString();
    const totalPrice = Number(raffle.ticket_price) * quantity;

    const { data: reservation, error: reservationError } = await supabaseAdmin
      .from("raffle_reservations")
      .insert({
        raffle_id: raffleId,
        buyer_id: user.id,
        quantity,
        total_price: totalPrice,
        status: "reserved",
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (reservationError || !reservation) {
      return json(res, 500, { error: reservationError?.message || "Erro ao criar reserva." });
    }

    const ticketRows = available.map((number) => ({
      raffle_id: raffleId,
      reservation_id: reservation.id,
      buyer_id: user.id,
      number_selected: number,
      status: "reserved",
      expires_at: expiresAt,
    }));

    const { error: ticketError } = await supabaseAdmin.from("tickets").insert(ticketRows);

    if (!ticketError) {
      return json(res, 200, { reservationId: reservation.id });
    }

    await supabaseAdmin.from("raffle_reservations").delete().eq("id", reservation.id);

    if (!ticketError.message?.toLowerCase().includes("duplicate")) {
      return json(res, 500, { error: ticketError.message });
    }
  }

  return json(res, 409, { error: "Conflito de concorrencia, tente novamente." });
}
