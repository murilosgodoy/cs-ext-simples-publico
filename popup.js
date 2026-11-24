const DEFAULTS = {
  enabled: true,
  theme: "light",
  primary: "#1a7a3a",
  stickyHeader: true,
  zebra: true,
  hover: true,
  exportBar: true,
  fontSize: 14,
  maxWidth: 1400,
  gefLogin: true,
  autoPilot: true,
  dashboard: true,
  cleanHome: true,
  userName: "",
  cleanDialog: true,
  fitGrids: true,
  rows1000: true,
  osVerso: true,
  osVersoPrint: true,
  reportsPlus: true
};
const KEY = "cssSettings";
const CHECKS = ["enabled", "exportBar", "stickyHeader", "zebra", "hover", "cleanHome", "gefLogin", "autoPilot", "dashboard", "cleanDialog", "fitGrids", "rows1000", "osVerso", "osVersoPrint", "reportsPlus"];

const $ = (id) => document.getElementById(id);
let settings = { ...DEFAULTS };

function saved(msg) {
  const s = $("status");
  s.textContent = msg || "✔ salvo";
  s.classList.add("show");
  clearTimeout(s._t);
  s._t = setTimeout(() => s.classList.remove("show"), 1400);
}

function copyText(text) {
  const fallback = () => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    if (!ok) throw new Error("clipboard indisponível");
  };
  if (!navigator.clipboard || !navigator.clipboard.writeText) return Promise.resolve().then(fallback);
  return navigator.clipboard.writeText(text).catch(fallback);
}

function clearClipboard() {
  try { chrome.storage.local.remove("cssClipboard"); } catch { /* ignore */ }
}

// Ao abrir o popup, copia um diagnóstico que ficou pendente (popup fechado).
function takeClipboard() {
  try {
    chrome.storage.local.get(["cssClipboard"], (r) => {
      const c = r && r.cssClipboard;
      if (!c || !c.text) return;
      copyText(c.text)
        .then(() => { clearClipboard(); saved("✔ copiado — cole no chat"); })
        .catch((e) => { console.warn("[CS Simples] não copiou:", e); saved("⚠ não copiou — use o console"); });
    });
  } catch { /* ignore */ }
}

// storage.sync aceita poucas gravações por minuto: agrupa (slider gravava a cada pixel)
let persistTimer = null;
let saving = false;
function persistNow() {
  clearTimeout(persistTimer);
  persistTimer = null;
  saving = true;
  try {
    chrome.storage.sync.set({ [KEY]: settings }, () => {
      saving = false;
      if (chrome.runtime.lastError) { console.warn("[CS Simples]", chrome.runtime.lastError.message); return; }
      saved();
    });
  } catch (e) {
    saving = false;
    console.warn("[CS Simples]", e);
  }
}
function persist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persistNow, 250);
}

function command(name, msg, close) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || tab.id == null) { saved("⚠ abra a aba do CS"); return; }
    const pronto = (res) => {
      if (!res || !res.ok) { saved("⚠ abra a aba do CS"); return; }
      saved(msg);
      if (close) setTimeout(() => window.close(), 250);
    };
    chrome.tabs.sendMessage(tab.id, { type: "cs-command", name }, (res) => {
      if (!chrome.runtime.lastError) { pronto(res); return; }
      // Código atualizado pelo botão "Atualizar" roda como user script e não
      // recebe tabs.sendMessage: o motor (background.js) repassa pela porta.
      chrome.runtime.sendMessage({ type: "css-tab-command", tabId: tab.id, name }, (r) => {
        void chrome.runtime.lastError;
        pronto(r);
      });
    });
  });
}

// A página não consegue copiar com o popup aberto: ela manda o texto e o popup copia.
// Também aceita chrome.runtime.sendMessage (quando o popup está aberto) para
// confirmar a cópia antes de a página dizer "copiado".
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.cssClipboard || !changes.cssClipboard.newValue) return;
  const c = changes.cssClipboard.newValue;
  copyText(c.text)
    .then(() => { clearClipboard(); saved("✔ copiado — cole no chat"); })
    .catch((e) => console.warn("[CS Simples] não copiou:", e));
});

// Se outra aba/extensão alterar as configurações (ex.: botão de tema na
// página), o popup não pode regravar o objeto antigo por cima.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync" || !changes[KEY] || !changes[KEY].newValue || saving) return;
  settings = { ...DEFAULTS, ...changes[KEY].newValue };
  render();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== "cs-copy" || !msg.text) return;
  copyText(msg.text)
    .then(() => { clearClipboard(); sendResponse({ ok: true }); })
    .catch((e) => {
      console.warn("[CS Simples] não copiou:", e);
      sendResponse({ ok: false, err: String((e && e.message) || e) });
    });
  return true;
});

function render() {
  CHECKS.forEach((k) => { $(k).checked = !!settings[k]; });
  // Melhorias dos relatórios desligadas: as opções abaixo não fazem efeito.
  const rep = settings.reportsPlus !== false;
  document.querySelectorAll("#reportsOpts input").forEach((i) => { i.disabled = !rep; });
  $("reportsOpts").classList.toggle("off", !rep);
  $("fontSize").value = settings.fontSize;
  $("fontVal").textContent = settings.fontSize;
  $("maxWidth").value = settings.maxWidth;
  $("widthVal").textContent = settings.maxWidth;
  $("primary").value = settings.primary;
  $("userName").value = settings.userName || "";
  $("theme-light").classList.toggle("active", settings.theme === "light");
  $("theme-dark").classList.toggle("active", settings.theme === "dark");
  $("theme-light").setAttribute("aria-pressed", String(settings.theme === "light"));
  $("theme-dark").setAttribute("aria-pressed", String(settings.theme === "dark"));
  document.documentElement.dataset.theme = settings.theme || "light";
  document.documentElement.style.setProperty("--p", settings.primary || "#1a7a3a");
  document.querySelectorAll(".colors button[data-color]").forEach((b) => {
    const on = b.dataset.color.toLowerCase() === (settings.primary || "").toLowerCase();
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", String(on));
  });
}

function bind() {
  CHECKS.forEach((k) => { $(k).onchange = (e) => { settings[k] = e.target.checked; if (k === "reportsPlus") render(); persistNow(); }; });
  $("userName").oninput = (e) => { settings.userName = e.target.value.trim(); persist(); };
  $("userName").onchange = () => persistNow();
  $("dashNow").onclick = () => command("cssDashNow", "✔ abrindo...", true);
  $("gefNow").onclick = () => command("cssGefNow", "✔ trocando GEF...");
  $("goNow").onclick = () => command("cssGoNow", "✔ indo...");
  $("diag").onclick = () => command("cssDiagReq", "✔ diagnosticando...");
  $("diag").title = "Diagnosticar (copia dados da tela para colar no chat)";
  $("fontSize").oninput = (e) => { settings.fontSize = +e.target.value; $("fontVal").textContent = e.target.value; persist(); };
  $("fontSize").onchange = () => persistNow();
  $("maxWidth").oninput = (e) => { settings.maxWidth = +e.target.value; $("widthVal").textContent = e.target.value; persist(); };
  $("maxWidth").onchange = () => persistNow();
  $("primary").oninput = (e) => { settings.primary = e.target.value; render(); persist(); };
  $("primary").onchange = () => persistNow();
  $("theme-light").onclick = () => { settings.theme = "light"; render(); persistNow(); };
  $("theme-dark").onclick = () => { settings.theme = "dark"; render(); persistNow(); };
  document.querySelectorAll(".colors button[data-color]").forEach((b) =>
    b.onclick = () => { settings.primary = b.dataset.color; render(); persistNow(); }
  );
  $("reset").onclick = () => { settings = { ...DEFAULTS }; render(); persistNow(); };
  window.addEventListener("pagehide", persistNow);
}

chrome.storage.sync.get([KEY], (res) => {
  if (res && res[KEY]) settings = { ...DEFAULTS, ...res[KEY] };
  render();
  bind();
  takeClipboard();
});

// Versão no topo + "Verificar atualização". O motor (background.js) diz o
// estado e o popup mostra o próximo passo com um botão só.
(function atualizacao() {
  const badge = $("ver-badge"), txt = $("upd-txt"), btn = $("upd-btn");
  if (!badge || !txt || !btn) return;
  const motor = chrome.runtime.getManifest().version;
  badge.textContent = "v" + motor;
  const pedir = (m) => new Promise((r) => {
    try { chrome.runtime.sendMessage(m, (x) => { void chrome.runtime.lastError; r(x || {}); }); }
    catch { r({}); }
  });
  const maior = (a, b) => {
    const pa = String(a || "0").split(".").map(Number), pb = String(b || "0").split(".").map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d) return d > 0;
    }
    return false;
  };
  let acao = null;
  btn.addEventListener("click", () => { if (acao) acao(); });
  function mostrar(texto, rotulo, fn, destaque) {
    txt.textContent = texto;
    btn.hidden = !rotulo;
    btn.textContent = rotulo || "";
    btn.classList.toggle("hot", !!destaque);
    acao = fn || null;
  }
  function versao(st) {
    if (!st.ativa) return;
    badge.textContent = "v" + st.ativa;
    badge.title = st.ativa !== motor ? "Código das telas " + st.ativa + " · motor " + motor : "";
  }
  function decidir(st, consultou) {
    versao(st);
    const ativa = st.ativa || motor;
    if (st.disco && maior(st.disco, st.motor)) {
      return mostrar(`Versão ${st.disco} já baixada. Falta aplicar.`, "Aplicar atualização",
        () => { mostrar("Aplicando… as abas do CS vão recarregar."); pedir({ type: "css-reload-apply" }); }, true);
    }
    if (!st.remota) {
      return consultou
        ? mostrar("Não consegui consultar o GitHub agora.", "Tentar de novo", verificar)
        : mostrar(`Versão em uso: ${ativa}`, "Verificar atualização", verificar);
    }
    if (!maior(st.remota, ativa)) {
      return mostrar(consultou ? `Você está na versão mais recente (${ativa}).` : `Versão em uso: ${ativa}`, "Verificar atualização", verificar);
    }
    if (maior(st.engine, st.motor)) {
      return mostrar(`Versão ${st.remota} precisa ser instalada: rode C:\\CS-Simples\\ATUALIZAR-CS-SIMPLES.bat e clique em Verificar.`, "Verificar", verificar);
    }
    if (!st.userScripts) {
      return mostrar(`Versão ${st.remota} disponível. Ligue "Permitir scripts de usuário" para atualizar com 1 clique.`, "Abrir configuração",
        () => pedir({ type: "css-open-ext" }), true);
    }
    mostrar(`Versão ${st.remota} disponível.`, "Atualizar agora", async () => {
      mostrar("Atualizando…");
      const r = await pedir({ type: "css-update-apply", recarregarAbas: true });
      if (r.ok) { versao({ ativa: r.version }); mostrar(`Atualizado para ${r.version} ✔ As abas do CS recarregaram.`); return; }
      const motivo = r.err === "userScripts" ? ' Ligue "Permitir scripts de usuário".'
        : r.err === "engine" ? " Rode o ATUALIZAR-CS-SIMPLES.bat." : r.err ? " (" + r.err + ")" : "";
      mostrar("Não consegui atualizar." + motivo, "Tentar de novo", verificar);
    }, true);
  }
  async function verificar() {
    mostrar("Verificando…");
    decidir(await pedir({ type: "css-update-check" }), true);
  }
  mostrar(`Versão em uso: ${motor}`, "Verificar atualização", verificar);
  pedir({ type: "css-update-state" }).then((st) => { if (st.motor) decidir(st, false); });
})();
