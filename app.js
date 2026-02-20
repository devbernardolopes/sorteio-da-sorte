import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

let cachedClient;
let cachedSession;
const PUBLIC_CONFIG_CACHE_KEY = "sorteio_public_config_v1";
const AUTH_POPUP_NAME = "sorteio-auth-popup";

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
  const redirectTo = `${window.location.origin}/auth-callback.html`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });
  if (error) throw error;

  if (!data?.url) {
    throw new Error("Nao foi possivel iniciar autenticacao Google.");
  }

  const width = 520;
  const height = 720;
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
  const popup = window.open(
    data.url,
    AUTH_POPUP_NAME,
    `popup=yes,width=${width},height=${height},left=${left},top=${top}`,
  );

  if (!popup) {
    throw new Error("Popup bloqueado. Permita popups para entrar com Google.");
  }
  popup.focus();

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Tempo esgotado na autenticacao."));
    }, 120000);

    const closeWatcher = setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error("Login cancelado."));
      }
    }, 400);

    const onMessage = async (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "supabase-auth-success") {
        cleanup();
        await getSession();
        window.focus();
        resolve();
      } else if (event.data?.type === "supabase-auth-error") {
        cleanup();
        reject(new Error(event.data.message || "Falha na autenticacao."));
      }
    };

    function cleanup() {
      clearTimeout(timeout);
      clearInterval(closeWatcher);
      window.removeEventListener("message", onMessage);
    }

    window.addEventListener("message", onMessage);
  });
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
      `<a class="${className}" id="nav-${link.key}" href="${link.href}">${link.label}</a>`,
    );
  });

  nav.insertAdjacentHTML("beforeend", '<button class="btn btn-outline" id="auth-btn"></button>');
}

export async function bindAuthButton({ requireAuth = false } = {}) {
  const authBtn = document.getElementById("auth-btn");
  const joinedNav = document.getElementById("nav-joined");
  const createdNav = document.getElementById("nav-created");
  if (!authBtn) return;

  authBtn.className = "btn btn-outline";
  authBtn.textContent = "Carregando...";
  authBtn.disabled = true;

  const setPrivateNavEnabled = (enabled) => {
    [joinedNav, createdNav].forEach((el) => {
      if (!el) return;
      el.classList.toggle("btn-disabled", !enabled);
      el.setAttribute("aria-disabled", String(!enabled));
      el.tabIndex = enabled ? 0 : -1;
      if (!enabled) {
        el.onclick = (event) => event.preventDefault();
      } else {
        el.onclick = null;
      }
    });
  };

  const applyLoggedOut = () => {
    setPrivateNavEnabled(false);
    authBtn.disabled = false;
    authBtn.className = "btn btn-primary";
    authBtn.textContent = "Entrar com Google";
  };

  const applyLoggedIn = (user) => {
    setPrivateNavEnabled(true);
    authBtn.disabled = false;
    const name = user.user_metadata?.full_name || user.email || "Conta";
    authBtn.className = "btn btn-danger";
    authBtn.textContent = `Sair (${name.split(" ")[0]})`;
    authBtn.onclick = async () => {
      try {
        await signOut();
      } catch (error) {
        toast(error.message, "error");
      }
    };
  };

  applyLoggedOut();
  authBtn.onclick = async () => {
    try {
      await signInWithGoogle();
      const user = await getUser();
      if (user) applyLoggedIn(user);
    } catch (error) {
      toast(error.message, "error");
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
    applyLoggedIn(user);
    return;
  }

  if (requireAuth) {
    toast("Voce precisa entrar com Google para continuar.", "error");
    try {
      await signInWithGoogle();
      const refreshedUser = await getUser();
      if (refreshedUser) applyLoggedIn(refreshedUser);
    } catch (error) {
      toast(error.message, "error");
    }
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

export function loadingMarkup(text = "Carregando...") {
  return `<div class="loading-inline"><span class="spinner"></span><span>${text}</span></div>`;
}

function getToastRoot() {
  let root = document.getElementById("toast-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "toast-root";
    root.className = "toast-root";
    document.body.appendChild(root);
  }
  return root;
}

export function toast(message, type = "info", timeoutMs = 3200) {
  const root = getToastRoot();
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.textContent = message;
  root.appendChild(el);

  setTimeout(() => {
    el.classList.add("toast-hide");
    setTimeout(() => el.remove(), 180);
  }, timeoutMs);
}
