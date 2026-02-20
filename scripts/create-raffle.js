import {
  bindAuthButton,
  renderHeader,
  apiFetch,
  showMessage,
  hideMessage,
  getUser,
  signInWithGoogle,
  loadingMarkup,
  toast,
} from "/app.js";

renderHeader({ active: "create" });
await bindAuthButton();

const form = document.getElementById("create-form");
const submitBtn = form.querySelector('button[type="submit"]');

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideMessage("form-message");
  const previousText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.innerHTML = loadingMarkup("Salvando rifa...");

  const formData = new FormData(form);
  const payload = {
    title: formData.get("title"),
    description: formData.get("description"),
    draw_date: formData.get("draw_date"),
    total_tickets: Number(formData.get("total_tickets")),
    max_tickets_per_user: Number(formData.get("max_tickets_per_user")),
    ticket_price: Number(formData.get("ticket_price")),
    hold_minutes: Number(formData.get("hold_minutes")),
    pix_full_name: formData.get("pix_full_name"),
    pix_key_kind: formData.get("pix_key_kind"),
    pix_key: formData.get("pix_key"),
  };

  try {
    if (!(await getUser())) {
      await signInWithGoogle();
      if (!(await getUser())) throw new Error("Login nao concluido.");
    }

    const result = await apiFetch("/api/raffles/create", { method: "POST", body: payload });
    window.location.href = `/raffle.html?id=${result.raffle.id}`;
  } catch (error) {
    toast(error.message, "error");
    showMessage("form-message", error.message);
    submitBtn.disabled = false;
    submitBtn.textContent = previousText;
  }
});
