import {
  bindAuthButton,
  renderHeader,
  apiFetch,
  formatMoney,
  formatDate,
  getQueryParam,
  getUser,
  signInWithGoogle,
  showMessage,
} from "/app.js";

renderHeader({ active: "home" });
await bindAuthButton();

const raffleId = getQueryParam("id");
if (!raffleId) {
  showMessage("raffle-message", "Rifa invalida.");
  throw new Error("Missing raffle ID");
}

const form = document.getElementById("reserve-form");
const quantityInput = form.elements.quantity;
let raffle;

try {
  const result = await apiFetch(`/api/raffles/get?id=${raffleId}`);
  raffle = result.raffle;

  document.getElementById("raffle-title").textContent = raffle.title;
  document.getElementById("raffle-description").textContent = raffle.description || "Sem descricao.";
  document.getElementById("ticket-price").textContent = formatMoney(raffle.ticket_price);
  document.getElementById("draw-date").textContent = formatDate(raffle.draw_date);
  document.getElementById("available-count").textContent = raffle.available_count;
  document.getElementById("max-per-user").textContent = raffle.max_tickets_per_user;

  quantityInput.max = Math.min(raffle.max_tickets_per_user, raffle.available_count);
  quantityInput.value = Math.min(1, Number(quantityInput.max));
} catch (error) {
  showMessage("raffle-message", error.message);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!(await getUser())) {
    await signInWithGoogle();
    return;
  }

  try {
    const quantity = Number(quantityInput.value);
    const result = await apiFetch("/api/tickets/reserve", {
      method: "POST",
      body: { raffleId, quantity },
    });

    window.location.href = `/checkout.html?reservationId=${result.reservationId}`;
  } catch (error) {
    showMessage("raffle-message", error.message);
  }
});
