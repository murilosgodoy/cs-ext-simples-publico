/* CS Simples - background.js (motor)

   Atualização com 1 clique, sem loja e sem .bat:
   - O código das telas (content.js, page-bridge.js, styles.css) pode vir
     do repositório público. O clique em "Atualizar" baixa esses arquivos,
     guarda no chrome.storage.local e registra como user scripts.
   - Sem versão baixada, ou sem a opção "Permitir scripts de usuário"
     ligada, roda o código que veio no pacote (mesmos arquivos da pasta).
   - O manifest, este motor, o popup e a O.S. com verso continuam no pacote.
     Quando eles mudam, o version.json traz "engine" maior e o aviso pede o
     ATUALIZAR-CS-SIMPLES.bat.

   No modo user script o content.js não tem chrome.storage nem
   chrome.runtime completos: o prelude() cria um "chrome" que pede tudo a
   este motor (mensagens + uma porta para eventos). */

const RAW = "https://raw.githubusercontent.com/murilosgodoy/cs-ext-simples-publico/main/";
const MATCHES = ["https://cs.usinasaoluiz.com.br/ords/apex/*"];
const BUNDLE_KEY = "cssBundle";      // { version, engine, content, bridge, css }
const CHECK_KEY = "cssUpdateCheck";  // { at, version, engine }
const SEIS_HORAS = 6 * 3600 * 1000;

const motor = () => chrome.runtime.getManifest().version;

function maior(a, b) {
  const pa = String(a || "0").split(".").map(Number), pb = String(b || "0").split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0;
  }
  return false;
}

// Recomendação da documentação: com a opção desligada, as chamadas lançam erro.
function userScriptsOk() {
  try { chrome.userScripts.getScripts(); return true; } catch { return false; }
}

async function lerBundle() {
  const r = await chrome.storage.local.get(BUNDLE_KEY);
  const b = r[BUNDLE_KEY];
  // Só vale se for mais novo que o pacote e couber neste motor.
  if (!b || !maior(b.version, motor()) || maior(b.engine, motor())) return null;
  return b;
}

// ---------- "chrome" para o content.js no modo user script ----------
function prelude(b) {
  const man = { ...chrome.runtime.getManifest(), version: b.version };
  return `(function () {
const __rt = globalThis.chrome && globalThis.chrome.runtime;
const __ID = ${JSON.stringify(chrome.runtime.id)};
const __BASE = ${JSON.stringify(chrome.runtime.getURL(""))};
const __MAN = ${JSON.stringify(man)};
const __changed = [], __onmsg = [];
let __port = null;
function __conectar() {
  try {
    __port = __rt.connect({ name: "css-us" });
    __port.onMessage.addListener((m) => {
      if (m.t === "changed") __changed.forEach((f) => { try { f(m.changes, m.area); } catch (e) { console.warn(e); } });
      else if (m.t === "cmd") {
        let feito = false;
        const responder = (r) => { if (!feito) { feito = true; try { __port.postMessage({ t: "reply", id: m.id, r }); } catch (e) {} } };
        __onmsg.forEach((f) => { try { f(m.msg, {}, responder); } catch (e) { console.warn(e); } });
      }
    });
    // O motor dorme depois de um tempo e a porta cai: reconecta (isso o acorda).
    __port.onDisconnect.addListener(() => { __port = null; setTimeout(__conectar, 1000); });
  } catch (e) { __port = null; }
}
__conectar();
const chrome = {
  runtime: {
    id: __ID,
    lastError: undefined,
    getURL: (p) => __BASE + String(p || "").replace(/^\\//, ""),
    getManifest: () => __MAN,
    sendMessage: (msg, cb) => __chamar(msg, cb),
    onMessage: { addListener: (f) => __onmsg.push(f) }
  },
  storage: {
    sync: __area("sync"),
    local: __area("local"),
    onChanged: { addListener: (f) => __changed.push(f) }
  }
};
function __chamar(msg, cb) {
  return new Promise((ok) => {
    try {
      __rt.sendMessage(msg, (r) => {
        const err = __rt.lastError || (r && r.__err ? { message: r.__err } : null);
        chrome.runtime.lastError = err ? { message: err.message } : undefined;
        const v = err ? undefined : r;
        try { if (cb) cb(v); } finally { chrome.runtime.lastError = undefined; }
        ok(v);
      });
    } catch (e) {
      chrome.runtime.lastError = { message: String(e && e.message || e) };
      try { if (cb) cb(undefined); } finally { chrome.runtime.lastError = undefined; }
      ok(undefined);
    }
  });
}
function __area(area) {
  return {
    get: (arg, cb) => __chamar({ type: "css-st", area, op: "get", arg }, (r) => { if (cb) cb(r || {}); }).then((r) => r || {}),
    set: (arg, cb) => __chamar({ type: "css-st", area, op: "set", arg }, () => { if (cb) cb(); }),
    remove: (arg, cb) => __chamar({ type: "css-st", area, op: "remove", arg }, () => { if (cb) cb(); })
  };
}
if (!document.getElementById("css-remote-css")) {
  const st = document.createElement("style");
  st.id = "css-remote-css";
  st.textContent = ${JSON.stringify(b.css)};
  (document.head || document.documentElement).appendChild(st);
}
`;
}
const PRELUDE_FIM = "\n})();\n";

// ---------- registro dos scripts das telas ----------
async function registrar() {
  const b = await lerBundle();
  const remoto = !!b && userScriptsOk();
  try { await chrome.scripting.unregisterContentScripts(); } catch { /* nada registrado */ }
  if (userScriptsOk()) { try { await chrome.userScripts.unregister(); } catch { /* nada registrado */ } }
  if (remoto) {
    await chrome.userScripts.configureWorld({ messaging: true });
    await chrome.userScripts.register([
      { id: "css-content", matches: MATCHES, runAt: "document_idle", world: "USER_SCRIPT",
        js: [{ code: prelude(b) + b.content + PRELUDE_FIM }] },
      { id: "css-bridge", matches: MATCHES, runAt: "document_idle", world: "MAIN",
        js: [{ code: b.bridge }] }
    ]);
  } else {
    await chrome.scripting.registerContentScripts([
      { id: "css-content", matches: MATCHES, runAt: "document_idle", js: ["content.js"], css: ["styles.css"] },
      { id: "css-bridge", matches: MATCHES, runAt: "document_idle", world: "MAIN", js: ["page-bridge.js"] }
    ]);
  }
  return remoto ? b.version : motor();
}
async function modoAtual() {
  try {
    if (userScriptsOk() && (await chrome.userScripts.getScripts()).length) return "remoto";
  } catch { /* ignore */ }
  try {
    if ((await chrome.scripting.getRegisteredContentScripts()).length) return "pacote";
  } catch { /* ignore */ }
  return "";
}

chrome.runtime.onInstalled.addListener(async () => {
  try { await registrar(); } catch (e) { console.warn("[CS Simples]", e); }
  // "Aplicar atualização" pelo popup: recarrega as abas do CS só nesse caso
  // (um F5 automático em outras horas poderia perder um formulário aberto).
  const r = await chrome.storage.local.get("cssReloadTabs");
  if (!r.cssReloadTabs) return;
  await chrome.storage.local.remove("cssReloadTabs");
  recarregarAbasCS();
});
function recarregarAbasCS() {
  chrome.tabs.query({ url: "https://cs.usinasaoluiz.com.br/*" }, (abas) => {
    void chrome.runtime.lastError;
    (abas || []).forEach((a) => chrome.tabs.reload(a.id));
  });
}
chrome.runtime.onStartup.addListener(() => { registrar().catch((e) => console.warn("[CS Simples]", e)); });

// ---------- versões ----------
async function checarRemoto(forcar) {
  const r = await chrome.storage.local.get(CHECK_KEY);
  const c = r[CHECK_KEY] || {};
  if (!forcar && c.at && Date.now() - c.at < SEIS_HORAS) return c;
  try {
    const res = await fetch(RAW + "version.json?t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) return c;
    const v = await res.json();
    const novo = { at: Date.now(), version: v.version, engine: v.engine || v.version };
    await chrome.storage.local.set({ [CHECK_KEY]: novo });
    return novo;
  } catch { return c; }
}
async function versaoNoDisco() {
  try { return (await (await fetch(chrome.runtime.getURL("manifest.json"), { cache: "no-store" })).json()).version; }
  catch { return null; }
}
async function estado(forcar) {
  const b = await lerBundle();
  const us = userScriptsOk();
  // Opção ligada depois de baixar a versão: registra sem pedir novo clique.
  const modo = await modoAtual();
  if ((b && us && modo !== "remoto") || (!(b && us) && modo !== "pacote")) await registrar();
  const ativa = b && us ? b.version : motor();
  const r = await checarRemoto(!!forcar);
  return { ativa, motor: motor(), disco: await versaoNoDisco(), remota: r.version, engine: r.engine, userScripts: us };
}

async function baixar(arquivo) {
  const res = await fetch(RAW + arquivo + "?t=" + Date.now(), { cache: "no-store" });
  if (!res.ok) throw new Error(arquivo + ": HTTP " + res.status);
  return res.text();
}
async function aplicar() {
  if (!userScriptsOk()) return { ok: false, err: "userScripts" };
  const v = JSON.parse(await baixar("version.json"));
  const engine = v.engine || v.version;
  if (maior(engine, motor())) return { ok: false, err: "engine", engine };
  const [content, bridge, css] = await Promise.all([baixar("content.js"), baixar("page-bridge.js"), baixar("styles.css")]);
  await chrome.storage.local.set({ [BUNDLE_KEY]: { version: v.version, engine, content, bridge, css } });
  await chrome.storage.local.set({ [CHECK_KEY]: { at: Date.now(), version: v.version, engine } });
  return { ok: true, version: await registrar() };
}

// ---------- mensagens ----------
const portas = new Set();
const pendentes = new Map();
let seq = 0;

function tratar(msg, sender, sendResponse, doUserScript) {
  if (!msg) return;
  if (msg.type === "css-st") {
    const area = chrome.storage[msg.area];
    if (!area || !["get", "set", "remove"].includes(msg.op)) { sendResponse({ __err: "operação inválida" }); return; }
    area[msg.op](msg.arg).then((r) => sendResponse(r || {}), (e) => sendResponse({ __err: String(e && e.message || e) }));
    return true;
  }
  if (msg.type === "css-update-state") { estado(false).then(sendResponse, () => sendResponse({})); return true; }
  // Botão "Verificar atualização" do popup: consulta o GitHub agora.
  if (msg.type === "css-update-check") { estado(true).then(sendResponse, () => sendResponse({})); return true; }
  if (msg.type === "css-update-apply") {
    aplicar().then((r) => {
      if (r && r.ok && msg.recarregarAbas) recarregarAbasCS();
      sendResponse(r);
    }, (e) => sendResponse({ ok: false, err: String(e && e.message || e) }));
    return true;
  }
  if (msg.type === "css-reload-apply") {
    chrome.storage.local.set({ cssReloadTabs: true }).then(() => chrome.runtime.reload());
    return;
  }
  if (msg.type === "css-reload") { chrome.runtime.reload(); return; }
  if (msg.type === "css-open-ext") { chrome.tabs.create({ url: "chrome://extensions/?id=" + chrome.runtime.id }); return; }
  if (msg.type === "css-tab-command") {
    const porta = [...portas].find((p) => p.sender && p.sender.tab && p.sender.tab.id === msg.tabId);
    if (!porta) { sendResponse({ ok: false, err: "aba sem CS Simples" }); return; }
    const id = ++seq;
    const t = setTimeout(() => { pendentes.delete(id); sendResponse({ ok: false, err: "sem resposta" }); }, 4000);
    pendentes.set(id, (r) => { clearTimeout(t); sendResponse(r); });
    porta.postMessage({ t: "cmd", id, msg: { type: "cs-command", name: msg.name } });
    return true;
  }
  // Pedido de cópia: no modo pacote o popup já recebe direto; no modo
  // user script a mensagem só chega aqui e é repassada ao popup.
  if (doUserScript && msg.type === "cs-copy") {
    chrome.runtime.sendMessage(msg, (r) => { void chrome.runtime.lastError; sendResponse(r); });
    return true;
  }
}
chrome.runtime.onMessage.addListener((m, s, r) => tratar(m, s, r, false));
if (chrome.runtime.onUserScriptMessage) {
  chrome.runtime.onUserScriptMessage.addListener((m, s, r) => tratar(m, s, r, true));
}
if (chrome.runtime.onUserScriptConnect) {
  chrome.runtime.onUserScriptConnect.addListener((porta) => {
    if (porta.name !== "css-us") return;
    portas.add(porta);
    porta.onMessage.addListener((m) => {
      if (m && m.t === "reply" && pendentes.has(m.id)) {
        const f = pendentes.get(m.id);
        pendentes.delete(m.id);
        f(m.r);
      }
    });
    porta.onDisconnect.addListener(() => portas.delete(porta));
  });
}
chrome.storage.onChanged.addListener((changes, area) => {
  portas.forEach((p) => { try { p.postMessage({ t: "changed", changes, area }); } catch { /* porta fechada */ } });
});
