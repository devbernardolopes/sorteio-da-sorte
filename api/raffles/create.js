import {
  allowCors,
  getUserFromRequest,
  json,
  supabaseAdmin,
} from "../_lib/supabase.js";

function validateInput(payload) {
  if (!payload.title || !payload.description) return "Titulo e descricao sao obrigatorios.";
  if (!payload.draw_date) return "Data do sorteio e obrigatoria.";
  if (!payload.total_tickets || payload.total_tickets < 1) return "Total de tickets invalido.";
  if (!payload.max_tickets_per_user || payload.max_tickets_per_user < 1)
    return "Maximo por usuario invalido.";
  if (payload.max_tickets_per_user > payload.total_tickets)
    return "Maximo por usuario nao pode ser maior que o total.";
  if (!payload.ticket_price || payload.ticket_price <= 0) return "Preco do ticket invalido.";
  if (!payload.pix_key || !payload.pix_key_kind || !payload.pix_full_name)
    return "Dados PIX incompletos.";
  return null;
}

export default async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const user = await getUserFromRequest(req);
  if (!user) return json(res, 401, { error: "Nao autenticado." });

  const body = req.body || {};
  const validationError = validateInput(body);
  if (validationError) return json(res, 400, { error: validationError });

  await supabaseAdmin.from("profiles").upsert(
    {
      id: user.id,
      full_name: user.user_metadata?.full_name || body.pix_full_name,
      avatar_url: user.user_metadata?.avatar_url || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  const { data: raffle, error } = await supabaseAdmin
    .from("raffles")
    .insert({
      creator_id: user.id,
      title: body.title,
      description: body.description,
      ticket_price: body.ticket_price,
      total_tickets: body.total_tickets,
      max_tickets_per_user: body.max_tickets_per_user,
      draw_date: body.draw_date,
      hold_minutes: body.hold_minutes || 15,
      pix_key: body.pix_key,
      pix_key_kind: body.pix_key_kind,
      pix_full_name: body.pix_full_name,
    })
    .select("id,title")
    .single();

  if (error) return json(res, 500, { error: error.message });

  return json(res, 200, { raffle });
}
