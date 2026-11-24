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
  osVersoPrint: true
};
const KEY = "cssSettings";
const CHECKS = ["enabled", "exportBar", "stickyHeader", "zebra", "hover", "cleanHome", "gefLogin", "autoPilot", "dashboard", "cleanDialog", "fitGrids", "rows1000", "osVerso", "osVersoPrint"];

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
  CHECKS.forEach((k) => { $(k).onchange = (e) => { settings[k] = e.target.checked; persistNow(); }; });
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

// Versão no topo: a do código ativo (pode ter vindo pelo botão "Atualizar")
// e, se for diferente, a do motor instalado na pasta.
(function mostrarVersao() {
  const el = $("ver-badge");
  if (!el) return;
  const motor = chrome.runtime.getManifest().version;
  el.textContent = "v" + motor;
  chrome.runtime.sendMessage({ type: "css-update-state" }, (st) => {
    void chrome.runtime.lastError;
    if (!st || !st.ativa) return;
    el.textContent = "v" + st.ativa;
    if (st.ativa !== motor) el.title = "Código das telas " + st.ativa + " · motor " + motor;
  });
})();
