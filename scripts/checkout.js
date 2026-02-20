import {
  bindAuthButton,
  renderHeader,
  apiFetch,
  formatMoney,
  formatDate,
  getQueryParam,
  getUser,
  showMessage,
  loadingMarkup,
  toast,
} from "/app.js";

renderHeader({ active: "home" });
await bindAuthButton();

const reservationId = getQueryParam("reservationId");
if (!reservationId) {
  showMessage("checkout-message", "Reserva invalida.");
  throw new Error("Missing reservation ID");
}

const generateBtn = document.getElementById("generate-pix");
const copyBtn = document.getElementById("copy-btn");
let currentPix = "";
document.getElementById("pix-code").innerHTML = loadingMarkup("Carregando reserva...");

if (!(await getUser())) {
  showMessage("checkout-message", "Entre com Google para acessar o checkout.");
  document.getElementById("pix-code").textContent = "Login necessario.";
  generateBtn.disabled = true;
}

if (!generateBtn.disabled) {
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
}

generateBtn.addEventListener("click", async () => {
  const previousText = generateBtn.textContent;
  generateBtn.disabled = true;
  generateBtn.innerHTML = loadingMarkup("Gerando PIX...");
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
    generateBtn.textContent = "PIX gerado";
  } catch (error) {
    showMessage("checkout-message", error.message);
    generateBtn.disabled = false;
    generateBtn.textContent = previousText;
  }
});

copyBtn.addEventListener("click", async () => {
  if (!currentPix) return;
  await navigator.clipboard.writeText(currentPix);
  toast("Codigo PIX copiado.", "success");
});
