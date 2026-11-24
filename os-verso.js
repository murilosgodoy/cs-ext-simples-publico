/* CS Simples - os-verso.js (Turbo)
   Roda no "mundo" da página (world: MAIN) dentro da janela "Por favor aguarde"
   (cs-principal/por-favor-aguarde), onde aparecem os botões Visualizar/Download
   depois de "Gerar relatório".

   Modo Turbo para Ordens de Serviço (página 1570):
     1) Espera o botão "Visualizar" aparecer (sem sobrescrever timers do APEX);
     2) Pré-carrega o PDF do RG AOO_001 na memória enquanto o servidor gera a O.S.;
     3) Clica sozinho em "Visualizar" no exato instante em que o relatório fica pronto;
     4) Mescla O.S. + RG AOO_001 em memória (com cache) e abre a impressão imediatamente
        (em nova guia ou direto dentro do modal se o Chrome bloquear pop-up automático).
*/
(() => {
  if (window.__cssOsVerso) return;
  window.__cssOsVerso = true;

  const PAGINAS_OS = ["1570"]; // Relatórios › Ordens de Serviço (Imprimir Ordem de Serviço)

  const qs = new URLSearchParams(location.search);
  const pagina = qs.get("p100_page_id") || "";
  const isPaginaOs = PAGINAS_OS.includes(pagina);

  const rawSetTimeout = window.setTimeout.bind(window);

  // Só liga quando o os-verso-config confirmou "1". Sem atributo (extensão
  // recarregada, storage lento), fica desligado em vez de ligar sozinho.
  function ligado() {
    return document.documentElement.dataset.cssOsVerso === "1";
  }
  function autoImprimir() {
    return document.documentElement.dataset.cssOsVersoPrint === "1";
  }

  function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // 2) Pré-carrega o documento RG AOO_001 em segundo plano enquanto o servidor gera a O.S.
  let rgDocPromise = null;
  function getRgDoc() {
    if (!rgDocPromise) {
      rgDocPromise = (async () => {
        const L = window.__cssPDFLib;
        if (!L) throw new Error("pdf-lib não carregou");
        if (!window.__cssRgVersoB64) throw new Error("RG do verso não carregou");
        return L.PDFDocument.load(b64ToBytes(window.__cssRgVersoB64));
      })();
    }
    return rgDocPromise;
  }
  if (isPaginaOs) {
    rawSetTimeout(() => { if (ligado()) getRgDoc().catch(() => {}); }, 15);
  }

  // Frente = páginas da O.S.; depois de cada página entra o RG (verso).
  async function juntar(osBytes) {
    const L = window.__cssPDFLib;
    if (!L) throw new Error("pdf-lib não carregou");
    const [os, rgDoc] = await Promise.all([
      L.PDFDocument.load(osBytes, { ignoreEncryption: true }),
      getRgDoc()
    ]);
    const out = await L.PDFDocument.create();
    const [rg] = await out.embedPdf(rgDoc, [0]);
    const frentes = await out.copyPages(os, os.getPageIndices());
    frentes.forEach((pg) => {
      out.addPage(pg);
      const { width: W, height: H } = pg.getSize();
      const verso = out.addPage([W, H]);
      const esc = Math.min(W / rg.width, H / rg.height);
      const w = rg.width * esc, h = rg.height * esc;
      verso.drawPage(rg, { x: (W - w) / 2, y: H - h, width: w, height: h });
    });
    out.setTitle("O.S. + verso RG AOO_001");
    out.setProducer("CS Simples");
    return out.save();
  }

  // Cache em memória por URL para não baixar/mesclar duas vezes.
  const mergeCache = new Map();
  function obterBytesMesclados(url) {
    if (mergeCache.has(url)) return mergeCache.get(url);
    if (mergeCache.size > 4) mergeCache.delete(mergeCache.keys().next().value);
    const p = (async () => {
      const r = await fetch(url, { credentials: "include" });
      const tipo = r.headers.get("content-type") || "";
      const buf = await r.arrayBuffer();
      const sig = new TextDecoder().decode(new Uint8Array(buf.slice(0, 5)));
      if (!r.ok || (!/pdf/i.test(tipo) && sig !== "%PDF-")) {
        throw new Error("resposta não é PDF (" + r.status + " " + tipo + ")");
      }
      return juntar(buf);
    })().catch((err) => {
      mergeCache.delete(url);
      throw err;
    });
    mergeCache.set(url, p);
    return p;
  }

  function telaEspera(win) {
    try {
      win.document.open();
      win.document.write(
        '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>O.S. + verso</title>' +
        '<style>html,body{margin:0;height:100%;background:#f1f5f9;font:600 15px "Segoe UI",system-ui,sans-serif;color:#1e293b}' +
        '#msg{display:flex;height:100%;align-items:center;justify-content:center;gap:10px}' +
        'iframe{border:0;width:100%;height:100%;display:block}</style></head>' +
        '<body><div id="msg">⚡ Preparando O.S. com verso (RG AOO_001)…</div></body></html>'
      );
      win.document.close();
    } catch { /* ignore */ }
  }

  // Quando a janela de impressão fecha, o foco volta (ou chega "afterprint"):
  // aí fecha o modal "Por favor aguarde". Antes ele ficava aberto, escuro,
  // esperando o "Fechar", e parecia uma tela preta.
  function fecharAposImprimir(fr) {
    let feito = false;
    const fechar = () => {
      if (feito) return;
      feito = true;
      rawSetTimeout(() => liberarFechar(true), 700);
    };
    rawSetTimeout(() => {
      try { fr.contentWindow.addEventListener("afterprint", fechar, { once: true }); } catch { /* ignore */ }
      window.addEventListener("afterprint", fechar, { once: true });
      try { window.top.addEventListener("focus", fechar, { once: true }); } catch { /* ignore */ }
    }, 500);
  }

  function acionarImpressao(fr, noModal) {
    if (!autoImprimir()) return;
    let done = false;
    const imprimir = () => {
      if (done) return;
      done = true;
      try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch { /* ignore */ }
      if (noModal) fecharAposImprimir(fr);
    };
    // O listener entra antes do src, então o load nunca se perde. Sem reserva
    // por tempo: ele chamava print() antes do PDF carregar e travava o "done".
    fr.addEventListener("load", () => rawSetTimeout(imprimir, 300), { once: true });
  }

  // Pop-up bloqueado (auto-clique sem gesto do mouse): o APEX fecha o
  // "Por favor aguarde" logo depois do openInNewWindow e o PDF sumia junto.
  // Seguramos esse fechamento até o usuário clicar em "Fechar".
  let segurarFechar = false;
  let fecharPendente = null;
  function prenderFechar() {
    const dlg = window.apex && window.apex.navigation && window.apex.navigation.dialog;
    if (!dlg || dlg.__cssHold || typeof dlg.close !== "function") return;
    const orig = dlg.close;
    dlg.close = function (...args) {
      if (segurarFechar) {
        fecharPendente = () => orig.apply(this, args);
        return;
      }
      return orig.apply(this, args);
    };
    dlg.__cssHold = true;
  }
  function liberarFechar(executar) {
    segurarFechar = false;
    const f = fecharPendente;
    fecharPendente = null;
    if (executar && f) f();
  }

  function mostrar(win, bytes) {
    const d = win.document;
    const url = win.URL.createObjectURL(new win.Blob([bytes], { type: "application/pdf" }));
    d.body.innerHTML = "";
    d.body.style.background = "#525659";
    const fr = d.createElement("iframe");
    fr.title = "O.S. + verso";
    acionarImpressao(fr);
    fr.src = url;
    d.body.appendChild(fr);
  }

  // Fallback quando o auto-clique roda sem gesto recente do mouse e o Chrome bloqueia nova guia:
  // expande o próprio modal "Por favor aguarde", mostra o PDF nele e já abre a janela de impressão!
  function expandirModalPai() {
    try {
      if (!window.parent || window.parent === window) return;
      const pd = window.parent.document;
      const dlg = pd.querySelector(".ui-dialog--apex:has(iframe[src*='por-favor-aguarde'])") ||
                  Array.from(pd.querySelectorAll(".ui-dialog--apex")).pop();
      if (!dlg) return;
      const w = Math.min(1080, Math.round(window.parent.innerWidth * 0.94));
      const h = Math.round(window.parent.innerHeight * 0.9);
      dlg.style.setProperty("width", w + "px", "important");
      dlg.style.setProperty("height", h + "px", "important");
      dlg.style.setProperty("left", Math.round((window.parent.innerWidth - w) / 2) + "px", "important");
      dlg.style.setProperty("top", Math.round((window.parent.innerHeight - h) / 2) + "px", "important");
      const content = dlg.querySelector(".ui-dialog-content");
      if (content) content.style.setProperty("height", (h - 48) + "px", "important");
    } catch { /* ignore */ }
  }

  function mostrarNoModal(bytes) {
    expandirModalPai();
    const blobUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    document.body.style.cssText = "margin:0;height:100vh;display:flex;flex-direction:column;background:#f1f5f9;font:13px 'Segoe UI',system-ui,sans-serif;overflow:hidden";
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 14px;background:#1f3158;color:#fff;flex:0 0 auto">
        <strong style="margin-right:auto">✔ O.S. + Verso (RG AOO_001) prontos</strong>
        <button id="css-print-now" type="button" style="border:0;background:#22c55e;color:#fff;padding:6px 12px;border-radius:7px;font:600 12.5px inherit;cursor:pointer">🖨 Imprimir</button>
        <a href="${blobUrl}" target="_blank" rel="noopener" style="background:rgba(255,255,255,.15);color:#fff;text-decoration:none;padding:6px 12px;border-radius:7px;font:600 12.5px inherit">↗ Abrir em nova guia</a>
        <button id="css-close-now" type="button" style="border:0;background:rgba(255,255,255,.15);color:#fff;padding:6px 12px;border-radius:7px;font:600 12.5px inherit;cursor:pointer">✕ Fechar</button>
      </div>
      <iframe id="css-pdf-fr" src="${blobUrl}" title="O.S. + verso" style="border:0;width:100%;flex:1;display:block;background:#525659"></iframe>
    `;
    const fr = document.getElementById("css-pdf-fr");
    const btn = document.getElementById("css-print-now");
    if (btn && fr) {
      btn.addEventListener("click", () => {
        try { fr.contentWindow.focus(); fr.contentWindow.print(); fecharAposImprimir(fr); } catch { window.open(blobUrl, "_blank"); }
      });
    }
    const fechar = document.getElementById("css-close-now");
    if (fechar) fechar.addEventListener("click", () => liberarFechar(true));
    if (fr) acionarImpressao(fr, true);
  }

  function interceptar(nav) {
    if (!nav || nav.__cssOsVerso) return !!nav;
    const original = nav.openInNewWindow;
    if (typeof original !== "function") return false;
    nav.openInNewWindow = function (url, ...resto) {
      if (!ligado() || !isPaginaOs || !/wwv_flow\.show/i.test(String(url))) {
        return original.call(this, url, ...resto);
      }
      // Clique manual e auto-clique compartilham a mesma trava: evita abrir
      // duas janelas/mesclar o mesmo PDF duas vezes.
      autoClicou = true;
      const win = window.open("", "_blank");
      segurarFechar = true;
      prenderFechar();
      if (win) telaEspera(win);
      (async () => {
        try {
          const bytes = await obterBytesMesclados(url);
          if (win) { mostrar(win, bytes); liberarFechar(true); }
          else mostrarNoModal(bytes);
        } catch (e) {
          console.warn("[CS Simples] verso da O.S.: abrindo o PDF original —", e);
          if (win) {
            try { win.location.href = url; } catch { original.call(this, url, ...resto); }
            liberarFechar(true);
          } else {
            liberarFechar(false); // mantém o modal aberto mostrando o PDF original
            location.href = url;
          }
        }
      })();
      return win || window;
    };
    nav.__cssOsVerso = true;
    prenderFechar();
    return true;
  }

  // 3) Auto-clica no botão "Visualizar" no exato milissegundo em que ele aparece na tela
  let autoClicou = false;
  function tentarAutoVisualizar() {
    if (autoClicou || !ligado() || !isPaginaOs) return;
    if (window.apex && window.apex.navigation) interceptar(window.apex.navigation);
    if (!document.body) return;
    const botoes = document.querySelectorAll("button, a.t-Button, a[role='button'], input[type='button']");
    for (const b of botoes) {
      const txt = (b.innerText || b.textContent || b.value || "").replace(/\s+/g, " ").trim();
      if (!/^visualizar$/i.test(txt)) continue;
      if (b.disabled || b.classList.contains("is-disabled") || b.getAttribute("aria-disabled") === "true") continue;
      const r = b.getBoundingClientRect();
      const st = window.getComputedStyle(b);
      if (r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none") {
        autoClicou = true;
        // Mostra feedback imediato no botão enquanto baixa/junta o PDF
        const lbl = b.querySelector(".t-Button-label") || b;
        lbl.textContent = "⚡ Abrindo O.S. + Verso…";
        rawSetTimeout(() => b.click(), 20);
        return;
      }
    }
  }

  function iniciarObservador() {
    if (!isPaginaOs || !document.body) return;
    tentarAutoVisualizar();
    const obs = new MutationObserver(() => {
      if (autoClicou) { obs.disconnect(); return; }
      tentarAutoVisualizar();
    });
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "disabled", "hidden"] });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarObservador, { once: true });
  } else {
    iniciarObservador();
  }

  let n = 0;
  (function tenta() {
    interceptar(window.apex && window.apex.navigation);
    tentarAutoVisualizar();
    if (++n < 60 && !autoClicou) rawSetTimeout(tenta, 150);
  })();
})();

