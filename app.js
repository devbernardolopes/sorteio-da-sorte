import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

let cachedClient;
let cachedSession;
const PUBLIC_CONFIG_CACHE_KEY = "sorteio_public_config_v1";

async function getPublicConfig() {
  const cached = sessionStorage.getItem(PUBLIC_CONFIG_CACHE_KEY);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      sessionStorage.removeItem(PUBLIC_CONFIG_CACHE_KEY);
    }
  }

  const response = await fetch("/api/public-config");
  if (!response.ok) {
    throw new Error("Nao foi possivel carregar a configuracao publica.");
  }
  const config = await response.json();
  sessionStorage.setItem(PUBLIC_CONFIG_CACHE_KEY, JSON.stringify(config));
  return config;
}

export async function getSupabaseClient() {
  if (cachedClient) return cachedClient;
  const config = await getPublicConfig();
  cachedClient = createClient(config.supabaseUrl, config.supabaseAnonKey);
  return cachedClient;
}

export async function getSession() {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  cachedSession = data.session;
  return cachedSession;
}

export async function getUser() {
  const session = await getSession();
  return session?.user ?? null;
}

export async function signInWithGoogle() {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.href,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });
  if (error) throw error;
}

export async function signOut() {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  cachedSession = null;
  window.location.href = "/";
}

export async function apiFetch(path, options = {}) {
  const session = await getSession();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const response = await fetch(path, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.error || "Erro na requisicao.";
    throw new Error(message);
  }

  return payload;
}

export function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

export function formatDate(dateStr) {
  if (!dateStr) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(dateStr));
}

export function renderHeader({ active = "home", containerId = "header-slot" } = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <header class="site-header">
      <a class="brand" href="/">
        <span class="brand-badge">R$</span>
        <span>Sorteio da Sorte</span>
      </a>
      <nav class="nav-row" id="main-nav"></nav>
    </header>
  `;

  const nav = container.querySelector("#main-nav");
  const links = [
    { key: "home", href: "/", label: "Rifas" },
    { key: "create", href: "/create-raffle.html", label: "Criar rifa" },
    { key: "joined", href: "/my-participations.html", label: "Participando" },
    { key: "created", href: "/my-raffles.html", label: "Criadas" },
  ];

  links.forEach((link) => {
    const className = active === link.key ? "btn btn-primary" : "btn btn-outline";
    nav.insertAdjacentHTML(
      "beforeend",
      `<a class="${className}" href="${link.href}">${link.label}</a>`,
    );
  });

  nav.insertAdjacentHTML("beforeend", '<button class="btn btn-outline" id="auth-btn"></button>');
}

export async function bindAuthButton({ requireAuth = false } = {}) {
  const authBtn = document.getElementById("auth-btn");
  if (!authBtn) return;

  // Show neutral loading state to avoid green/red flicker on navigation.
  authBtn.className = "btn btn-outline";
  authBtn.textContent = "Carregando...";
  authBtn.disabled = true;

  const applyLoggedOut = () => {
    authBtn.disabled = false;
    authBtn.className = "btn btn-primary";
    authBtn.textContent = "Entrar com Google";
  };

  applyLoggedOut();
  authBtn.onclick = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      alert(error.message);
    }
  };

  let user = null;
  try {
    user = await getUser();
  } catch (error) {
    console.error("Auth bootstrap error:", error);
    applyLoggedOut();
    return;
  }

  if (user) {
    authBtn.disabled = false;
    const name = user.user_metadata?.full_name || user.email || "Conta";
    authBtn.className = "btn btn-danger";
    authBtn.textContent = `Sair (${name.split(" ")[0]})`;
    authBtn.onclick = async () => {
      try {
        await signOut();
      } catch (error) {
        alert(error.message);
      }
    };
    return;
  }

  if (requireAuth) {
    alert("Voce precisa entrar com Google para continuar.");
    await signInWithGoogle();
  }
}

export function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

export function showMessage(containerId, message, type = "error") {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.className = `alert ${type === "success" ? "alert-success" : "alert-error"}`;
  el.textContent = message;
  el.hidden = false;
}

export function hideMessage(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.hidden = true;
}
