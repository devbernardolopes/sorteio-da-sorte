import {
  bindAuthButton,
  renderHeader,
  apiFetch,
  formatMoney,
  formatDate,
  getUser,
  signInWithGoogle,
  showMessage,
} from "/app.js";

renderHeader({ active: "joined" });
await bindAuthButton();

if (!(await getUser())) {
  await signInWithGoogle();
}

const listEl = document.getElementById("joined-list");

try {
  const data = await apiFetch("/api/raffles/my-joined");
  if (!data.items?.length) {
    listEl.innerHTML = '<p class="muted">Voce ainda nao participa de nenhuma rifa.</p>';
  } else {
    listEl.innerHTML = data.items
      .map(
        (item) => `
          <a class="raffle-item" href="/raffle.html?id=${item.raffle_id}">
            <div style="display:flex;justify-content:space-between;gap:0.8rem;align-items:center;">
              <h2 class="text-lg font-semibold" style="margin:0">${item.raffle_title}</h2>
              <span class="stat-pill">${item.status}</span>
            </div>
            <p class="muted" style="margin:0.4rem 0">Tickets: ${item.ticket_numbers.join(", ")}</p>
            <p><strong>Total:</strong> ${formatMoney(item.total_price)}</p>
            <p class="muted">Atualizado: ${formatDate(item.updated_at)}</p>
          </a>
        `,
      )
      .join("");
  }
} catch (error) {
  showMessage("joined-message", error.message);
}
