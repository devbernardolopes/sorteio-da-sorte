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

if (!(await getUser())) {
  await signInWithGoogle();
}

const reservationId = getQueryParam("reservationId");
if (!reservationId) {
  showMessage("checkout-message", "Reserva invalida.");
  throw new Error("Missing reservation ID");
}

const generateBtn = document.getElementById("generate-pix");
const copyBtn = document.getElementById("copy-btn");
let currentPix = "";

try {
  const data = await apiFetch(`/api/tickets/reservation?id=${reservationId}`);
  const reservation = data.reservation;

  document.getElementById("raffle-title").textContent = reservation.raffle_title;
  document.getElementById("quantity").textContent = reservation.quantity;
  document.getElementById("total").textContent = formatMoney(reservation.total_price);
  document.getElementById("expires-at").textContent = formatDate(reservation.expires_at);
  document.getElementById("ticket-numbers").textContent = reservation.ticket_numbers.join(", ");
} catch (error) {
  showMessage("checkout-message", error.message);
  generateBtn.disabled = true;
}

generateBtn.addEventListener("click", async () => {
  try {
    const data = await apiFetch("/api/generate-pix", {
      method: "POST",
      body: { reservationId },
    });

    currentPix = data.copyAndPaste;
    document.getElementById("pix-code").textContent = currentPix;
    const qrContainer = document.getElementById("qrcode");
    qrContainer.innerHTML = "";
    new window.QRCode(qrContainer, {
      text: currentPix,
      width: 200,
      height: 200,
    });

    copyBtn.disabled = false;
  } catch (error) {
    showMessage("checkout-message", error.message);
  }
});

copyBtn.addEventListener("click", async () => {
  if (!currentPix) return;
  await navigator.clipboard.writeText(currentPix);
  alert("Codigo PIX copiado.");
});
