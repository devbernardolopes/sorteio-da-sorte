import {
  bindAuthButton,
  renderHeader,
  apiFetch,
  formatMoney,
  formatDate,
  getUser,
  showMessage,
  loadingMarkup,
} from "/app.js";

renderHeader({ active: "created" });
await bindAuthButton();

const listEl = document.getElementById("created-list");
listEl.innerHTML = loadingMarkup("Carregando suas rifas...");

if (!(await getUser())) {
  listEl.innerHTML = '<p class="muted">Entre com Google para ver suas rifas criadas.</p>';
  showMessage("created-message", "Login necessario para acessar esta area.");
} else {
  try {
    const data = await apiFetch("/api/raffles/my-created");
    if (!data.items?.length) {
      listEl.innerHTML = '<p class="muted">Voce ainda nao criou nenhuma rifa.</p>';
    } else {
      listEl.innerHTML = data.items
        .map(
          (raffle) => `
            <a class="raffle-item" href="/raffle.html?id=${raffle.id}">
              <div style="display:flex;justify-content:space-between;gap:0.8rem;align-items:center;">
                <h2 class="text-lg font-semibold" style="margin:0">${raffle.title}</h2>
                <span class="stat-pill">${raffle.sold_count}/${raffle.total_tickets} vendidos</span>
              </div>
              <p class="muted" style="margin:0.3rem 0 0.6rem">${raffle.description || "Sem descricao"}</p>
              <div style="display:flex;justify-content:space-between;gap:0.8rem;flex-wrap:wrap">
                <span><strong>${formatMoney(raffle.ticket_price)}</strong> por ticket</span>
                <span class="muted">Sorteio: ${formatDate(raffle.draw_date)}</span>
              </div>
            </a>
          `,
        )
        .join("");
    }
  } catch (error) {
    showMessage("created-message", error.message);
  }
}
