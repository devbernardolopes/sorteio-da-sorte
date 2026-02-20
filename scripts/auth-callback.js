import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const statusEl = document.getElementById("auth-status");

async function run() {
  try {
    const configResp = await fetch("/api/public-config");
    if (!configResp.ok) throw new Error("Configuracao indisponivel.");
    const config = await configResp.json();

    const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

    // Wait briefly for Supabase to process OAuth callback URL and persist session.
    let session = null;
    for (let i = 0; i < 10; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const { data } = await supabase.auth.getSession();
      session = data.session;
      if (session) break;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    if (!session) {
      throw new Error("Nao foi possivel concluir o login.");
    }

    statusEl.textContent = "Login concluido. Voltando para o site...";

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: "supabase-auth-success" }, window.location.origin);
      window.close();
      return;
    }
  } catch (error) {
    statusEl.textContent = error.message;
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        { type: "supabase-auth-error", message: error.message },
        window.location.origin,
      );
    }
  }
}

run();
