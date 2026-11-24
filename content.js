/* CS Simples - content.js
   Baseada na CS Visual Plus. Mantém o visual e as funções do site e acrescenta:
     1) Ao logar, entra direto na GEF 1.3.1 (FAZ SANTA MARIA)
     2) Dashboard clean de atalhos na tela inicial
   Não altera dados do APEX: só aparência e navegação.
*/
(() => {
  if (/\/por-favor-aguarde/i.test(location.pathname)) return;
  const DEFAULTS = {
    enabled: true,
    theme: "light", // light | dark
    primary: "#1a7a3a",
    stickyHeader: true,
    zebra: true,
    hover: true,
    exportBar: true,
    fontSize: 14,
    maxWidth: 1400,
    gefLogin: true,   // envia a GEF 1.3.1 junto com o login (campo DL_GEF_LINK)
    autoPilot: true,  // confere a GEF depois do login e troca se precisar
    dashboard: true,  // abre o dashboard sozinho na tela inicial
    cleanHome: true,  // oculta gráficos da inicial da Manutenção Automotiva
    userName: "",     // nome na saudação do dashboard (vazio = só "Bom dia")
    cleanDialog: true, // janelas do sistema (ex.: Nova OS) com fundo limpo
    fitGrids: true,    // grades mostram quantas linhas couberem na tela
    rows1000: true,    // relatórios com 1000 linhas por página
    osVerso: true,     // O.S. impressa com o RG AOO_001 no verso (os-verso.js)
    osVersoPrint: true // abre a janela de impressão sozinho
  };

  const KEY = "cssSettings"; // chaves próprias: não conflita com a CS Visual Plus
  let settings = { ...DEFAULTS };

  // GEF alvo. "value" é o valor interno do item FILTRO_FILIAL no APEX.
  const GEF_ALVO = { value: "1-3-1", display: "1.3.1 - FAZ SANTA MARIA" };

  const LOGO_FILE = "logo-usl-crop.png";
  function logoUrl() {
    try { return chrome.runtime.getURL(LOGO_FILE); } catch { return ""; }
  }

  // Depois de recarregar a extensão, o script antigo continua na aba mas perde o chrome.*
  function extAlive() {
    try { return !!(chrome.runtime && chrome.runtime.id); } catch { return false; }
  }
  function saveSettings() {
    if (!extAlive()) return;
    try { chrome.storage.sync.set({ [KEY]: settings }); } catch { /* ignore */ }
  }
  function ss(k, v) {
    try {
      if (v === undefined) return sessionStorage.getItem(k);
      if (v === null) sessionStorage.removeItem(k);
      else sessionStorage.setItem(k, v);
    } catch { /* ignore */ }
    return null;
  }

  // Pede ao popup aberto para copiar. Se ele não estiver aberto, o callback
  // recebe lastError e a função devolve null (sem falso sucesso).
  function askPopupToCopy(text) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (!done) { done = true; resolve(v); } };
      try {
        chrome.runtime.sendMessage({ type: "cs-copy", text }, (r) => {
          if (chrome.runtime.lastError) return finish(null);
          finish(r);
        });
      } catch { finish(null); }
      setTimeout(() => finish(null), 1200);
    });
  }

  // Copiar só funciona com a página em foco; se o comando veio do popup, o popup copia.
  async function copyOrRelay(text, okMsg, failMsg) {
    try {
      if (document.hasFocus()) {
        await navigator.clipboard.writeText(text);
        toast(okMsg);
        return;
      }
    } catch { /* tenta o popup */ }
    const viaPopup = await askPopupToCopy(text);
    if (viaPopup && viaPopup.ok) {
      toast(okMsg);
      return;
    }
    // Popup fechado: deixa o texto pronto e avisa para abrir o popup.
    // Nada de dizer "copiado" antes de alguém realmente copiar.
    try {
      if (extAlive()) {
        chrome.storage.local.set({ cssClipboard: { text, at: Date.now() } });
        toast("Diagnóstico pronto — abra o popup para copiar");
        return;
      }
    } catch { /* ignore */ }
    toast(failMsg);
  }

  function toast(msg) {
    let el = document.getElementById("cs-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "cs-toast";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      el.setAttribute("aria-atomic", "true");
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 2200);
  }

  // ===== Ponte com o APEX (page-bridge.js) =====
  let reqSeq = 0;
  function bridge(type, payload, timeoutMs = 2500) {
    return new Promise((resolve) => {
      const id = "r" + (++reqSeq) + "-" + Date.now();
      const onRes = (ev) => {
        let res;
        try { res = JSON.parse(ev.detail); } catch { return; }
        if (res.id !== id) return;
        clearTimeout(t);
        window.removeEventListener("cs-simples:res", onRes);
        resolve(res);
      };
      const t = setTimeout(() => {
        window.removeEventListener("cs-simples:res", onRes);
        resolve({ ok: false, err: "page-bridge não respondeu" });
      }, timeoutMs);
      window.addEventListener("cs-simples:res", onRes);
      window.dispatchEvent(new CustomEvent("cs-simples:req", { detail: JSON.stringify({ id, type, payload }) }));
    });
  }

  // ===== Aparência =====
  function applySettings() {
    const html = document.documentElement;
    html.classList.toggle("cs-visual-on", settings.enabled);
    html.classList.toggle("cs-sticky-header", settings.stickyHeader);
    html.classList.toggle("cs-zebra", settings.zebra);
    html.classList.toggle("cs-hover", settings.hover);
    html.classList.toggle("css-clean-dialog", settings.enabled && settings.cleanDialog);
    html.classList.toggle("css-fit-grids", settings.enabled && settings.fitGrids);
    html.dataset.csTheme = settings.theme || "light";

    html.style.setProperty("--cs-primary", settings.primary);
    html.style.setProperty("--cs-font-size", settings.fontSize + "px");
    html.style.setProperty("--cs-max-width", settings.maxWidth + "px");
    html.style.setProperty("--cs-primary-dark", `color-mix(in srgb, ${settings.primary} 80%, black)`);
    html.style.setProperty("--cs-primary-light", settings.theme === "dark"
      ? `color-mix(in srgb, ${settings.primary} 22%, #121815)`
      : `color-mix(in srgb, ${settings.primary} 12%, white)`);
    html.style.setProperty("--cs-table-header", settings.theme === "dark"
      ? `color-mix(in srgb, ${settings.primary} 45%, #121815)`
      : settings.primary);

    toggleFabs();
  }

  function toggleFabs() {
    let fab = document.getElementById("cs-theme-fab");
    let dfab = document.getElementById("css-dash-fab");
    let sfab = document.getElementById("css-save-fab");
    if (!settings.enabled || isLoginPage()) {
      const hb = document.getElementById("css-home-btn");
      if (hb) hb.remove();
      if (fab) fab.remove();
      if (dfab) dfab.remove();
      if (sfab) sfab.remove();
      return;
    }
    // Botão "Voltar para a Home": só aparece (via CSS) com formulário aberto em fundo limpo
    if (!document.getElementById("css-home-btn")) {
      const hb = document.createElement("button");
      hb.id = "css-home-btn";
      hb.type = "button";
      hb.innerHTML = `${ICONS.back}<span>Voltar para a Home</span>`;
      hb.addEventListener("click", goHome);
      document.body.appendChild(hb);
    }
    if (!sfab) {
      sfab = document.createElement("button");
      sfab.id = "css-save-fab";
      sfab.addEventListener("click", toggleSaveCurrent);
      document.body.appendChild(sfab);
    }
    updateSaveFab();
    if (!fab) {
      fab = document.createElement("button");
      fab.id = "cs-theme-fab";
      fab.title = "Alternar claro / escuro";
      fab.addEventListener("click", () => {
        settings.theme = settings.theme === "dark" ? "light" : "dark";
        saveSettings();
        applySettings();
        toast(settings.theme === "dark" ? "🌙 Modo escuro ativado" : "☀️ Modo claro ativado");
      });
      document.body.appendChild(fab);
    }
    fab.textContent = settings.theme === "dark" ? "☀️" : "🌙";
    if (!dfab) {
      dfab = document.createElement("button");
      dfab.id = "css-dash-fab";
      dfab.title = "Abrir dashboard (CS Simples)";
      dfab.innerHTML = ICONS.grid;
      dfab.addEventListener("click", () => openDashboard(true));
      document.body.appendChild(dfab);
    }
  }

  function isLoginPage() {
    const url = location.href.toLowerCase();
    if (/\/r\/apex\/|workspace-sign-in/.test(url)) return true; // login do próprio Oracle APEX (workspace), não é o CS
    if (/\/login(\?|$|\/)/.test(url) || url.includes("p=40010:9999") || url.includes(":9999:")) return true;
    if (document.getElementById("P9999_USERNAME") || document.getElementById("P101_USERNAME")) return true;
    return !!document.querySelector(".apex-login-page, .t-Login-region");
  }

  // ===== 1) Login direto na GEF 1.3.1 =====
  // A tela de login tem o item oculto DL_GEF_LINK (vem do parâmetro dl_gef_link
  // da URL). Preenchendo com a GEF alvo, o sistema já entra nela. Se o sistema
  // ignorar esse valor, a troca pelo APEX logo após o login garante a 1.3.1.
  function prepLoginGef() {
    if (!settings.enabled) return;
    ss("csPilotDone", null);
    ss("csGefTry", null);
    pilotClearResume();
    ss("cssAfterLogin", String(Date.now())); // próxima página = recém-logado
    if (!settings.gefLogin) return;
    const it = document.getElementById("DL_GEF_LINK");
    if (it && !it.value) {
      it.value = GEF_ALVO.value;
      console.log("[CS Simples] DL_GEF_LINK =", GEF_ALVO.value);
    }
  }

  function justLoggedIn() {
    const t = +ss("cssAfterLogin") || 0;
    return t && Date.now() - t < 10 * 60 * 1000;
  }

  // ===== Relatórios e Grades Interativas =====
  const TABLE_SELECTORS = [
    "table.a-IRR-table",
    "table.t-Report-report",
    "table.uReport",
    ".t-Report table"
  ].join(", ");

  function badgeKind(raw) {
    const v = norm(raw).replace(/[\s.]+/g, "");
    if (!v || v === "-" || v.length > 28) return "";
    if (/^(aberta|aberto)$/.test(v)) return "open";
    if (/encerrad|concluid|finalizad|fechad|aprovad|atendid|realizad|liberado|liberada|quitad|baixad/.test(v)) return "done";
    if (/andamento|execucao|manutencao|iniciad|oficina|emservico|ativo|ativa/.test(v)) return "prog";
    if (/pendente|aguard|planejad|programad|analise|parcial|media|medio|atrasad|bloquead/.test(v)) return "warn";
    if (/cancelad|rejeitad|reprovad|inativ|excluid|alta|critica|critico|emergenc|urgente/.test(v)) return "cancel";
    if (/^(baixa|baixo|normal|rotina)$/.test(v)) return "neutral";
    return "";
  }

  function decorateTable(table) {
    const ths = Array.from(table.querySelectorAll("thead th, tr:first-child th"));
    if (!ths.length) return;
    const statusCols = [];
    const numCols = [];
    ths.forEach((th, idx) => {
      const f = norm(th.innerText || th.textContent).replace(/[\s.]+/g, "");
      if (/^(status|situacao|criticidade|urgencia|prioridade|estado|fase)$/.test(f)) statusCols.push(idx);
      else if (/^(ano|numero|os|numos|codigo|cod|data|dt|valor|qtd|quantidade|total|horimetro|hodometro|km|horas)/.test(f)) numCols.push(idx);
    });
    table.querySelectorAll("tbody tr").forEach((tr) => {
      if (tr.dataset.cssDec === "1") return;
      for (const idx of statusCols) {
        const td = tr.children[idx];
        if (!td || td.childElementCount > 0) continue;
        const txt = (td.textContent || "").trim();
        const kind = badgeKind(txt);
        if (kind) {
          const sp = document.createElement("span");
          sp.className = "css-badge css-badge--" + kind;
          sp.textContent = txt;
          td.textContent = "";
          td.appendChild(sp);
        }
      }
      for (const idx of numCols) {
        const td = tr.children[idx];
        if (td) td.classList.add("css-num");
      }
      tr.dataset.cssDec = "1";
    });
  }

  function findReportTables() {
    return Array.from(document.querySelectorAll(TABLE_SELECTORS)).filter((t) => {
      if (t.dataset.csDone) return false;
      if (t.closest(".a-GV, .cs-export-bar, #css-dash")) return false;
      if (!t.querySelector("td")) return false;
      return true;
    });
  }

  function wrapTable(table) {
    if (table.parentElement && table.parentElement.classList.contains("cs-table-wrap")) return table.parentElement;
    if (!table.parentNode) return null;
    const wrap = document.createElement("div");
    wrap.className = "cs-table-wrap";
    table.parentNode.insertBefore(wrap, table);
    wrap.appendChild(table);
    return wrap;
  }

  function extractTableMatrix(table) {
    const allTr = Array.from(table.querySelectorAll("tr")).filter((tr) => tr.style.display !== "none");
    if (!allTr.length) return { headers: [], rows: [] };
    const headTr = table.querySelector("thead tr") || allTr[0];
    const headers = Array.from(headTr.querySelectorAll("th, td")).map((c) => (c.innerText || "").replace(/\s+/g, " ").trim());
    const bodyTrs = allTr.filter((tr) => tr !== headTr && tr.querySelector("td"));
    const rows = bodyTrs.map((tr) =>
      Array.from(tr.querySelectorAll("td")).map((c) => (c.innerText || "").replace(/\s+/g, " ").trim())
    );
    return { headers, rows };
  }

  function igHeaderCols(headTable) {
    if (!headTable) return [];
    return Array.from(headTable.querySelectorAll("thead tr:last-child th")).map((th, idx) => {
      if (th.offsetWidth === 0 || th.classList.contains("a-GV-rowSelector")) return null;
      const lblEl = th.querySelector(".a-GV-headerLabel") || th;
      const label = (lblEl.innerText || lblEl.textContent || "").replace(/\s+/g, " ").trim();
      if (!label || /^(selecionar|acoes|ações|menu de linha)$/i.test(fold(label))) return null;
      return { idx, label };
    }).filter(Boolean);
  }

  function extractIgMatrix(igEl) {
    const simple = () => {
      const sc = igEl.querySelector(".a-GV-w-scroll") || igEl;
      const ths = Array.from(sc.querySelectorAll(".a-GV-w-hdr th"));
      const cols = [];
      ths.forEach((th, idx) => {
        if (th.offsetWidth === 0 || th.classList.contains("a-GV-rowSelector")) return;
        const lblEl = th.querySelector(".a-GV-headerLabel") || th;
        const label = (lblEl.innerText || lblEl.textContent || "").replace(/\s+/g, " ").trim();
        if (label && !/^(selecionar|acoes|ações|menu de linha)$/i.test(fold(label))) {
          cols.push({ idx, label });
        }
      });
      const trs = Array.from(sc.querySelectorAll(".a-GV-bdy tr.a-GV-row")).filter((tr) => tr.style.display !== "none");
      const rows = trs.map((tr) =>
        cols.map((c) => {
          const td = tr.children[c.idx];
          return td ? (td.innerText || td.textContent || "").replace(/\s+/g, " ").trim() : "";
        })
      );
      return { headers: cols.map((c) => c.label), rows };
    };

    // Com colunas congeladas o APEX usa quatro tabelas (cabeçalho/corpo da
    // parte congelada e da parte rolável). O índice do <th> não corresponde
    // ao <td> quando as tabelas são misturadas; por isso casamos cada tabela
    // de corpo com a sua tabela de cabeçalho e juntamos as partes na ordem.
    const headTables = Array.from(igEl.querySelectorAll(".a-GV-w-hdr table.a-GV-table"));
    const bodyTables = Array.from(igEl.querySelectorAll(".a-GV-bdy table.a-GV-table"));
    if (!bodyTables.length || headTables.length !== bodyTables.length) return simple();

    const pairs = bodyTables.map((bt, i) => ({ bt, cols: igHeaderCols(headTables[i]) }));
    const total = pairs.reduce((n, p) => n + p.cols.length, 0);
    if (!total) return simple();

    const rowSets = pairs.map(({ bt }) =>
      Array.from(bt.querySelectorAll("tr.a-GV-row")).filter((tr) => tr.style.display !== "none")
    );
    const useId = rowSets.every((rows) => rows.length && rows.every((tr) => tr.hasAttribute("data-id")));
    const byKey = new Map();
    const order = [];
    rowSets.forEach((rows, ti) => {
      let offset = 0;
      for (let i = 0; i < ti; i++) offset += pairs[i].cols.length;
      rows.forEach((tr, ri) => {
        const key = useId ? "id:" + tr.getAttribute("data-id") : "i:" + ri;
        let row = byKey.get(key);
        if (!row) { row = new Array(total).fill(""); byKey.set(key, row); order.push(key); }
        pairs[ti].cols.forEach((c, ci) => {
          const td = tr.children[c.idx];
          row[offset + ci] = td ? (td.innerText || td.textContent || "").replace(/\s+/g, " ").trim() : "";
        });
      });
    });

    const headers = pairs.flatMap((p) => p.cols.map((c) => c.label));
    return { headers, rows: order.map((k) => byKey.get(k)) };
  }

  function matrixToCSV(m) {
    const all = m.headers.length ? [m.headers, ...m.rows] : m.rows;
    return all.map((row) =>
      row.map((v) => {
        let s = String(v == null ? "" : v);
        // Evita fórmula do Excel (=, +, -, @) em célula vinda da grade.
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
        if (/[",;\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
        return s;
      }).join(";")
    ).join("\n");
  }

  function matrixToTSV(m) {
    const all = m.headers.length ? [m.headers, ...m.rows] : m.rows;
    return all.map((row) => row.map((v) => {
      let s = String(v == null ? "" : v);
      if (/^[=+\-@]/.test(s)) s = "'" + s;
      return s.replace(/[\t\r\n]+/g, " ");
    }).join("\t")).join("\n");
  }

  function download(filename, content, mime) {
    const blob = new Blob(["\uFEFF" + content], { type: mime + ";charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }

  function printMatrix(reportName, m, filterQuery) {
    const w = window.open("", "_blank", "width=1100,height=760");
    // Pop-up bloqueado: imprimir a página do APEX imprimiria a tela errada.
    if (!w) { toast("Permita pop-ups para imprimir o relatório"); return; }
    const now = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    const gefDisp = (document.getElementById("FILTRO_FILIAL") && document.getElementById("FILTRO_FILIAL").value) || GEF_ALVO.display;
    const thHtml = m.headers.map((h) => `<th>${esc(h)}</th>`).join("");
    const trHtml = m.rows.map((r) => `<tr>${r.map((c) => {
      const k = badgeKind(c);
      return k ? `<td><span class="badge ${k}">${esc(c)}</span></td>` : `<td>${esc(c)}</td>`;
    }).join("")}</tr>`).join("");
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(reportName)}</title><style>
      @page { size: landscape; margin: 10mm; }
      * { box-sizing: border-box; }
      body { font-family: "Segoe UI", system-ui, -apple-system, sans-serif; color: #0f172a; margin: 0; padding: 16px; font-size: 11.5px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .hdr { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #1a7a3a; padding-bottom: 10px; margin-bottom: 12px; gap: 16px; }
      .hdr-left { display: flex; align-items: center; gap: 12px; }
      .hdr-logo { height: 34px; width: auto; }
      .hdr-title h1 { margin: 0; font-size: 16px; color: #1f3158; }
      .hdr-title small { color: #64748b; font-size: 11px; }
      .hdr-meta { text-align: right; font-size: 11px; color: #475569; line-height: 1.4; font-variant-numeric: tabular-nums; }
      .hdr-meta b { color: #0f172a; }
      table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
      thead { display: table-header-group; }
      th { background: #1f3158; color: #fff; font-weight: 700; text-align: left; padding: 7px 8px; border: 1px solid #cbd5e1; font-size: 11px; white-space: nowrap; }
      td { padding: 5.5px 8px; border: 1px solid #cbd5e1; vertical-align: middle; }
      tbody tr:nth-child(even) td { background: #f8fafc; }
      .badge { display: inline-block; padding: 1.5px 7px; border-radius: 999px; font-weight: 700; font-size: 10.5px; }
      .badge.open { background: #fef3c7; color: #92400e; }
      .badge.done { background: #dcfce7; color: #166534; }
      .badge.prog { background: #dbeafe; color: #1e40af; }
      .badge.warn { background: #ffedd5; color: #9a3412; }
      .badge.cancel { background: #fee2e2; color: #991b1b; }
      .badge.neutral { background: #f1f5f9; color: #334155; }
    </style></head><body>
      <header class="hdr">
        <div class="hdr-left">
          ${logoUrl() ? `<img class="hdr-logo" src="${logoUrl()}" alt="USL">` : ""}
          <div class="hdr-title">
            <h1>${esc(reportName)}</h1>
            <small>Usina São Luiz • ${esc(gefDisp)}</small>
          </div>
        </div>
        <div class="hdr-meta">
          <div>Emitido em: <b>${esc(now)}</b></div>
          <div>Registros: <b>${m.rows.length}</b>${filterQuery ? ` (filtro: "${esc(filterQuery)}")` : ""}</div>
        </div>
      </header>
      <table><thead><tr>${thHtml}</tr></thead><tbody>${trHtml}</tbody></table>
    </body></html>`);
    w.document.close();
    // Sem <script> inline: se a página tiver CSP, o script não roda e a
    // impressão nunca abre. Como a janela é same-origin, chamamos print()
    // daqui, com fallback caso o evento load não dispare.
    let printed = false;
    const imprimir = () => {
      if (printed) return;
      printed = true;
      try { w.focus(); w.print(); } catch { /* ignore */ }
    };
    if (w.document.readyState === "complete") setTimeout(imprimir, 150);
    else w.addEventListener("load", () => setTimeout(imprimir, 150), { once: true });
    setTimeout(imprimir, 1800);
  }

  function bindExportActions(bar, reportName, getMatrix, filterInput) {
    bar.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const act = btn.dataset.act;
      const date = new Date().toISOString().slice(0, 10);
      const m = getMatrix();
      if (!m.rows.length && !m.headers.length) { toast("Nenhum dado visível para exportar"); return; }
      if (act === "csv") {
        download(`${reportName}-${date}.csv`, matrixToCSV(m), "text/csv");
        toast(`CSV exportado (${m.rows.length} linhas) ✔`);
      } else if (act === "xls") {
        download(`${reportName}-${date}.xls`, matrixToTSV(m), "application/vnd.ms-excel");
        toast(`Excel exportado (${m.rows.length} linhas) ✔`);
      } else if (act === "copy") {
        try {
          await navigator.clipboard.writeText(matrixToTSV(m));
          toast(`${m.rows.length} linhas copiadas! Cole no Excel ✔`);
        } catch { toast("Não foi possível copiar"); }
      } else if (act === "print") {
        printMatrix(reportName, m, filterInput ? filterInput.value.trim() : "");
      }
    });
  }

  function addExportBar(table, index) {
    table.dataset.csDone = "1";
    decorateTable(table);
    const wrap = wrapTable(table);
    if (!wrap) return;
    const prev = wrap.previousElementSibling;
    if (prev && prev.classList.contains("cs-export-bar")) return;

    const region = table.closest(".t-Region, .a-IRR, .t-IRR-region") || wrap;
    const liveTable = () => (bar.nextElementSibling && bar.nextElementSibling.querySelector("table")) || region.querySelector(TABLE_SELECTORS) || table;
    const countRows = (t) => t.querySelectorAll("tbody tr").length || Math.max(0, t.rows.length - 1);
    const totalRows = countRows(table);
    const bar = document.createElement("div");
    bar.className = "cs-export-bar";
    const title = region === wrap ? null : region.querySelector(".t-Region-title, .t-Region-header, h2");
    const reportName = (title ? title.innerText.trim().slice(0, 44) : document.title.split(/\s[-–|]\s/).pop() || "relatorio-" + (index + 1)).replace(/[\\/:*?"<>|]+/g, "-").trim() || ("relatorio-" + (index + 1));

    bar.innerHTML = `
      <span class="cs-label">📊 Relatório</span>
      <input class="cs-quick-filter" type="search" placeholder="🔍 Filtrar nesta tabela..." aria-label="Filtro rápido">
      <div class="cs-export-btns">
        <button type="button" data-act="csv" title="Baixar CSV">⬇ CSV</button>
        <button type="button" data-act="xls" title="Baixar planilha Excel">⬇ Excel</button>
        <button type="button" data-act="copy" title="Copiar para colar no Excel">⧉ Copiar</button>
        <button type="button" data-act="print" title="Imprimir com layout formatado">🖨 Imprimir</button>
      </div>
      <span class="cs-count">${totalRows} linhas</span>
    `;
    wrap.parentNode.insertBefore(bar, wrap);

    const filterInput = bar.querySelector(".cs-quick-filter");
    filterInput.addEventListener("input", () => {
      const curT = liveTable();
      decorateTable(curT);
      const q = fold(filterInput.value).toLowerCase().trim();
      const trs = curT.querySelectorAll("tbody tr");
      let visible = 0;
      trs.forEach((tr) => {
        const hit = !q || fold(tr.innerText).toLowerCase().includes(q);
        tr.style.display = hit ? "" : "none";
        if (hit) visible++;
      });
      bar.querySelector(".cs-count").textContent = q ? `${visible} / ${trs.length} linhas` : `${trs.length} linhas`;
    });

    bindExportActions(bar, reportName, () => extractTableMatrix(liveTable()), filterInput);
  }

  function addIgExportBar(igEl, index) {
    if (igEl.dataset.csBarDone || igEl.closest("#css-dash")) return;
    const body = igEl.querySelector(".a-IG-body");
    if (!body) return;

    const region = igEl.closest(".t-Region") || igEl;
    const titleEl = region.querySelector(".t-Region-title, h2") || document.querySelector(".t-Breadcrumb-item.is-active .t-Breadcrumb-label, h1");
    const reportName = (titleEl ? titleEl.innerText.trim().slice(0, 44) : document.title.split(/\s[-–|]\s/).pop() || "grade-" + (index + 1)).replace(/[\\/:*?"<>|]+/g, "-").trim() || ("grade-" + (index + 1));

    const bar = document.createElement("div");
    bar.className = "cs-export-bar cs-ig-bar";
    bar.innerHTML = `
      <span class="cs-label">⚡ Filtro &amp; Exportação</span>
      <input class="cs-quick-filter" type="search" placeholder="🔍 Buscar equipamento, código, nº O.S., status..." aria-label="Filtro rápido na grade">
      <div class="cs-export-btns">
        <button type="button" data-act="csv" title="Baixar CSV das linhas visíveis">⬇ CSV</button>
        <button type="button" data-act="xls" title="Baixar Excel das linhas visíveis">⬇ Excel</button>
        <button type="button" data-act="copy" title="Copiar linhas visíveis para o Excel">⧉ Copiar</button>
        <button type="button" data-act="print" title="Imprimir grade formatada">🖨 Imprimir</button>
      </div>
      <span class="cs-count">0 linhas</span>
    `;
    try {
      body.parentNode.insertBefore(bar, body);
      igEl.dataset.csBarDone = "1";
    } catch (e) {
      console.warn("[CS Simples] barra da grade:", e);
      return;
    }

    const filterInput = bar.querySelector(".cs-quick-filter");
    const countEl = bar.querySelector(".cs-count");

    const applyFilter = () => {
      const q = fold(filterInput.value).toLowerCase().trim();
      const sc = igEl.querySelector(".a-GV-w-scroll") || igEl;
      const mainRows = sc.querySelectorAll(".a-GV-bdy tr.a-GV-row[data-id]");
      const hitIds = new Set();
      let visible = 0;
      mainRows.forEach((tr) => {
        const hit = !q || fold(tr.innerText).toLowerCase().includes(q);
        tr.style.display = hit ? "" : "none";
        if (hit) {
          visible++;
          hitIds.add(tr.getAttribute("data-id"));
        }
      });
      const frozen = igEl.querySelector(".a-GV-w-frozen");
      if (frozen) {
        frozen.querySelectorAll(".a-GV-bdy tr.a-GV-row[data-id]").forEach((tr) => {
          const id = tr.getAttribute("data-id");
          tr.style.display = (!q || hitIds.has(id)) ? "" : "none";
        });
      }
      const total = mainRows.length;
      countEl.textContent = q ? `${visible} / ${total} linhas` : `${total} linhas`;
    };

    filterInput.addEventListener("input", applyFilter);
    bindExportActions(bar, reportName, () => extractIgMatrix(igEl), filterInput);

    // Atualiza o contador sempre que o APEX carregar novas linhas (ex.: 1000 linhas)
    let countTimer = null;
    const obs = new MutationObserver(() => {
      clearTimeout(countTimer);
      countTimer = setTimeout(applyFilter, 120);
    });
    obs.observe(body, { childList: true, subtree: true });
    applyFilter();
  }

  function improveReports() {
    if (!settings.enabled) return;
    findReportTables().forEach((t, i) => {
      if (settings.exportBar) addExportBar(t, document.querySelectorAll(".cs-export-bar").length + i);
      else { t.dataset.csDone = "1"; decorateTable(t); wrapTable(t); }
    });
    if (settings.exportBar) {
      document.querySelectorAll(".a-IG").forEach((ig, i) => addIgExportBar(ig, i));
    }
  }

  // ===== Card "Gestão / Módulo" maior (igual à CS Visual Plus) =====
  function improveModulos() {
    const heads = document.querySelectorAll(".t-Region-title, .t-Region-header h2, .t-Region-header h3, h1, h2, h3");
    for (const h of heads) {
      const t = (h.textContent || "").replace(/\s+/g, " ").trim();
      if (!/^gest[aã]o\s*\/\s*m[oó]dulos?$/i.test(t)) continue;
      const region = h.closest(".t-Region, section, [id^='R']");
      if (!region || region.classList.contains("cs-modulos")) continue;
      region.classList.add("cs-modulos");
      document.documentElement.classList.add("cs-has-modulos");
      let el = region.parentElement;
      for (let i = 0; el && i < 6 && !el.classList.contains("t-Body-contentInner"); i++, el = el.parentElement) {
        if (/\bcol(-|\b)/.test(el.className || "")) {
          el.style.setProperty("max-width", "100%", "important");
          el.style.setProperty("flex", "0 0 100%", "important");
          el.style.setProperty("width", "100%", "important");
        }
      }
    }
  }

  // Botões de criar ("+ Nova Ordem de Serviço", "Novo ...") no topo das regiões:
  // ficam em destaque e ganham uma estrela para virar atalho direto
  const CTA_RE = /^\+?\s*(nov[oa]s?|adicionar|incluir|criar)\b/i;
  function improveCta() {
    if (!settings.enabled) return;
    let added = false;
    document.querySelectorAll(".t-Region-headerItems--buttons .t-Button, .t-ButtonRegion-buttons .t-Button, .t-Region-buttons .t-Button").forEach((b) => {
      if (b.dataset.cssCta || b.closest("#css-dash")) return;
      const label = btnLabel(b);
      if (!label || !CTA_RE.test(label)) return;
      b.dataset.cssCta = "1";
      b.classList.add("css-cta");
      const star = document.createElement("button");
      star.type = "button";
      star.className = "css-cta-star";
      star.dataset.label = label;
      star.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); toggleSaveAction(label); });
      b.insertAdjacentElement("afterend", star);
      if (b.parentElement) b.parentElement.classList.add("css-has-cta");
      added = true;
    });
    if (added) updateCtaStars();
  }
  async function updateCtaStars() {
    const stars = document.querySelectorAll(".css-cta-star");
    if (!stars.length) return;
    if (!pageInfo) pageInfo = await currentPageInfo();
    stars.forEach((st) => {
      const on = !!findShortcut(pageInfo.app, pageInfo.path, st.dataset.label);
      st.classList.toggle("on", on);
      st.innerHTML = on ? ICONS.starFill : ICONS.star;
      st.title = on ? "Remover “" + st.dataset.label + "” dos atalhos" : "Salvar “" + st.dataset.label + "” nos atalhos (abre direto)";
    });
  }
  async function toggleSaveAction(label) {
    pageInfo = await currentPageInfo();
    const s = findShortcut(pageInfo.app, pageInfo.path, label);
    if (s) { removeShortcut(s.id); toast("Removido dos atalhos"); }
    else { addShortcut({ ...pageInfo, action: label, label }); toast("⭐ Atalho criado: " + label); }
    updateCtaStars();
  }

  // O sistema copia os botões do cabeçalho da página do modal (ex.: "Gerar
  // relatório", ids terminados em _pam) para a barra de título a cada recarga
  // do iframe, sem apagar os anteriores. Esconde as cópias e deixa só a mais
  // nova (a última na barra).
  function dedupeDialogButtons() {
    document.querySelectorAll(".ui-dialog-titlebar").forEach((tb) => {
      const vistos = new Set();
      Array.from(tb.querySelectorAll("button[id$='_pam']")).reverse().forEach((b) => {
        if (vistos.has(b.id)) {
          b.dataset.cssDup = "1";
          b.style.setProperty("display", "none", "important");
        }
        vistos.add(b.id);
      });
      tb.querySelectorAll(".t-BreadcrumbRegion-buttons").forEach((g) => {
        if (!g.querySelector("button:not([data-css-dup])")) g.style.setProperty("display", "none", "important");
      });
    });
  }

  function refreshAll() {
    document.documentElement.classList.toggle("css-has-grid", !!document.querySelector(".a-IG, .a-IRR, .t-Report"));
    dedupeDialogButtons();
    improveModulos();
    improveCta();
    addColsButtons();
    improveReports();
    cleanHomePage();
    schedulePrepNewGrids();
  }

  // Observa a página, mas ignora o que muda DENTRO das grades (1000 linhas
  // redesenhando geravam milhares de avisos) e nos elementos da extensão.
  // O trabalho roda quando o navegador está livre, não no meio da rolagem.
  const IGNORE_SEL = ".a-GV, .a-IG-body, #css-dash, .cs-veil, #cs-toast, .css-cols-pop, .cs-export-bar";
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1));
  let observer = null;
  function observe() {
    if (observer) return;
    let pending = false;
    observer = new MutationObserver((recs) => {
      if (!settings.enabled || pending) return;
      let relevant = false;
      for (let i = 0; i < recs.length && !relevant; i++) {
        const t = recs[i].target;
        relevant = !(t.nodeType === 1 && t.closest(IGNORE_SEL));
      }
      if (!relevant) return;
      pending = true;
      setTimeout(() => idle(() => {
        pending = false;
        if (!extAlive()) { observer.disconnect(); return; }
        refreshAll();
      }, { timeout: 800 }), 200);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    // janela do sistema aberta (ex.: Nova OS) -> classe no <html>, sem :has() no CSS
    const dlg = () => document.documentElement.classList.toggle("css-dialog-open",
      !!document.querySelector('body > .ui-dialog--apex[class*="t-Dialog-page"]'));
    new MutationObserver(dlg).observe(document.body, { childList: true });
    dlg();
  }

  // ===== Piloto (reserva): navega até Manutenção Automotiva se a tela não tiver o seletor de GEF =====
  const PILOT_STEPS = ["Gestão", "Módulo Automotivo", "Controle de Pneus", "Manutenção Automotiva"];
  let pilotRunning = false;
  const RESUME_KEY = "csPilotResume";

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
  function pilotMarkResume() { ss(RESUME_KEY, String(Date.now())); }
  function pilotClearResume() { ss(RESUME_KEY, null); }
  function pilotShouldResume() {
    const t = +ss(RESUME_KEY);
    return !!t && Date.now() - t < 30000;
  }
  function fold(t) {
    return (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
  }
  function norm(t) { return fold(t).replace(/\s+/g, " ").trim().toLowerCase(); }
  function visible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const s = getComputedStyle(el);
    return s.display !== "none" && s.visibility !== "hidden";
  }

  function findClick(text) {
    const target = norm(text);
    const all = Array.from(document.querySelectorAll("a, button, li, [role='menuitem'], [role='treeitem'], [role='option'], [role='link'], [title], [aria-label]"))
      .filter((el) => !el.closest("#css-dash"));
    const label = (el) => norm(el.innerText || el.textContent);
    let hit = all.find((el) => visible(el) && label(el) === target);
    if (!hit) hit = all.find((el) => { if (!visible(el)) return false; const t = label(el); return t && t.length < 80 && t.includes(target); });
    if (!hit) hit = all.find((el) => {
      if (!visible(el)) return false;
      const t = norm(el.getAttribute("title") || "") + " " + norm(el.getAttribute("aria-label") || "");
      return t.trim().length > 1 && t.includes(target);
    });
    if (!hit) return null;
    return hit.closest ? (hit.closest("a, button, [role='menuitem'], [role='treeitem'], [role='option']") || hit) : hit;
  }

  async function pilotEnsureNav() {
    if (findClick("Gestão")) return;
    await sleep(800);
    if (findClick("Gestão")) return;
    const btns = Array.from(document.querySelectorAll("#t_Button_navControl, .t-Button--navControl, .t-Header-navBar, button.t-Header-nav, [title='Menu'], [aria-label='Menu']")).filter(visible);
    for (const b of btns) {
      if (b.id === "cs-theme-fab" || b.id === "css-dash-fab") continue;
      if (b.getAttribute && b.getAttribute("aria-expanded") === "true") continue;
      b.click();
      await sleep(1500);
      if (findClick("Gestão")) return;
    }
  }

  function onManutencao() {
    return location.href.toLowerCase().includes("manutencao-automotiva") || norm(document.title).includes("manutencao automotiva");
  }

  // ===== Véu (mascara a espera da troca de GEF) =====
  function showVeil(txt) {
    let v = document.getElementById("cs-veil");
    if (!v) {
      v = document.createElement("div");
      v.id = "cs-veil";
      v.className = "cs-veil";
      v.setAttribute("role", "status");
      v.setAttribute("aria-live", "polite");
      v.innerHTML = '<div class="cs-spin" aria-hidden="true"></div><div class="cs-veil-txt"></div>';
      document.body.appendChild(v);
    }
    v.querySelector(".cs-veil-txt").textContent = txt || "Aguarde...";
    clearTimeout(v._t);
    v._t = setTimeout(() => v.remove(), 15000); // nunca fica preso na tela
  }
  function hideVeil() {
    // remove (antes só escondia, e o CSS com !important mantinha o véu na tela)
    document.querySelectorAll(".cs-veil").forEach((v) => v.remove());
  }

  // ===== Inicial clean: oculta gráficos da home da Manutenção Automotiva =====
  const HOME_CHART_RES = [/abertas x encerradas/i, /por criticidade/i];
  let homeCleanAt = 0;
  function cleanHomePage() {
    const onHome = onManutencao() && /^(home|inicio)?$/i.test(curParts().page);
    document.querySelectorAll("[data-cs-home-hidden]").forEach((el) => {
      if (!settings.cleanHome || !onHome) { el.style.display = ""; el.removeAttribute("data-cs-home-hidden"); }
    });
    if (!settings.enabled || !settings.cleanHome || !onHome || isLoginPage()) return;
    const now = Date.now();
    if (now - homeCleanAt < 1500) return;
    homeCleanAt = now;
    document.querySelectorAll(".t-Region, .a-Region").forEach((r) => {
      if (r.hasAttribute("data-cs-home-hidden") || r.closest("#css-dash")) return;
      const head = Array.from(r.querySelectorAll(".t-Region-title, .a-Region-title, h2, h3")).find((h) => h.closest(".t-Region, .a-Region") === r);
      const t = head ? (head.innerText || "").replace(/\s+/g, " ").trim() : "";
      if (t && HOME_CHART_RES.some((re) => re.test(t))) {
        r.style.display = "none";
        r.setAttribute("data-cs-home-hidden", "1");
      }
    });
  }

  // ===== Troca de GEF =====
  function gefAtual() {
    const h = document.getElementById("FILTRO_FILIAL_HIDDENVALUE");
    return h ? h.value : null;
  }

  // true = trocou (ou já estava) | false = não deu
  async function trocarGefViaApex() {
    if (!document.getElementById("FILTRO_FILIAL")) return false;
    if (gefAtual() === GEF_ALVO.value) { ss("csPilotDone", "1"); return true; }
    document.querySelectorAll(".ui-dialog-popuplov .ui-dialog-titlebar-close").forEach((b) => { if (visible(b)) b.click(); });
    ss("csPilotDone", "1"); // a troca recarrega a página
    const res = await bridge("set-filial", GEF_ALVO);
    if (!res.ok) {
      console.log("[CS Simples] troca via APEX falhou:", res.err);
      ss("csPilotDone", null);
      return false;
    }
    toast(res.already ? "GEF já está em 1.3.1 ✔" : "Entrando na GEF 1.3.1 - FAZ SANTA MARIA...");
    return true;
  }

  // Reserva: seletor <select> ou lista (para telas antigas/diferentes)
  function switchBySelect() {
    for (const sel of Array.from(document.querySelectorAll("select")).filter(visible)) {
      const opt = Array.from(sel.options).find((o) => norm(o.text).includes("1.3.1") || norm(o.text).includes("santa maria"));
      if (!opt) continue;
      if (sel.value !== opt.value) {
        sel.value = opt.value;
        sel.dispatchEvent(new Event("input", { bubbles: true }));
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return true;
    }
    return false;
  }

  async function runGefSwitch() {
    if (gefAtual() === GEF_ALVO.value) { ss("csPilotDone", "1"); return true; }
    showVeil("Entrando na GEF 1.3.1 - Santa Maria...");
    try {
      if (await trocarGefViaApex()) {
        await sleep(8000); // o sistema recarrega sozinho; se não recarregar, libera a tela
        return true;
      }
      if (switchBySelect()) { ss("csPilotDone", "1"); toast("GEF: 1.3.1 Santa Maria"); return true; }
      const opener = findClick("1.1.1") || findClick("USL MATRIZ");
      if (opener) {
        opener.click();
        for (let i = 0; i < 20; i++) {
          const opt = findClick("1.3.1") || findClick("FAZ SANTA MARIA");
          if (opt) { ss("csPilotDone", "1"); opt.click(); toast("GEF: 1.3.1 Santa Maria"); return true; }
          await sleep(300);
        }
        toast("Lista aberta — escolha 1.3.1 manualmente");
        return false;
      }
      toast("Seletor de GEF não encontrado nesta tela");
      return false;
    } finally {
      hideVeil();
    }
  }

  async function runPilot(manual) {
    if (pilotRunning) return;
    if (!settings.enabled) { if (manual) toast("Extensão desativada"); return; }
    pilotRunning = true;
    try {
      if (isLoginPage()) { if (manual) toast("Faça login primeiro"); return; }
      if (!document.getElementById("FILTRO_FILIAL") && !onManutencao()) {
        showVeil("Abrindo Manutenção Automotiva...");
        await pilotEnsureNav();
        for (const step of PILOT_STEPS) {
          let el = null;
          for (let i = 0; i < 10 && !el; i++) {
            el = findClick(step);
            if (!el) await sleep(800);
          }
          if (!el) {
            hideVeil();
            pilotClearResume();
            toast("Não achei o menu: " + step + " (use 🔍 Diagnosticar)");
            return;
          }
          el.scrollIntoView({ block: "center" });
          await sleep(300);
          pilotMarkResume(); // se o clique trocar de página, continua na próxima
          el.click();
          await sleep(1400);
          if (onManutencao() || document.getElementById("FILTRO_FILIAL")) break;
        }
        hideVeil();
      }
      pilotClearResume();
      await runGefSwitch();
    } finally {
      pilotRunning = false;
    }
  }

  async function runGefOnly() {
    if (pilotRunning) return;
    if (!settings.enabled) { toast("Extensão desativada"); return; }
    if (isLoginPage()) { toast("Faça login primeiro"); return; }
    pilotRunning = true;
    try { await runGefSwitch(); } finally { pilotRunning = false; }
  }

  // ===== 2) Dashboard =====
  const svg = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const ICONS = {
    tire: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M12 3v5.5M12 15.5V21M3 12h5.5M15.5 12H21"/>'),
    wrench: svg('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8V21h3.2l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.5 2.5-2.6-.6-.6-2.6z"/>'),
    fuel: svg('<path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M3 21h13M7 8h5"/><path d="M15 10h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V9l-3-3"/>'),
    drop: svg('<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>'),
    truck: svg('<path d="M2 6h12v10H2zM14 9h4l3 3.5V16h-7"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>'),
    chart: svg('<path d="M3 21h18M6 17v-6M11 17V5M16 17v-9M21 17v-3"/>'),
    clipboard: svg('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v3H9zM9 11h6M9 15h4"/>'),
    box: svg('<path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8"/>'),
    user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    calendar: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
    gauge: svg('<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-6"/>'),
    cart: svg('<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.5 12h12L22 7H6"/>'),
    alert: svg('<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/>'),
    gear: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>'),
    home: svg('<path d="M3 11l9-8 9 8M5 10v10h14V10"/>'),
    grid: svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
    star: svg('<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/>'),
    pin: svg('<path d="M12 21s7-6.3 7-11.5A7 7 0 0 0 5 9.5C5 14.7 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
    close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    car: svg('<path d="M5 11l1.6-4.2A2 2 0 0 1 8.5 5.5h7a2 2 0 0 1 1.9 1.3L19 11"/><rect x="3" y="11" width="18" height="6" rx="2"/><path d="M6 17v2M18 17v2"/><circle cx="7.5" cy="14" r=".6"/><circle cx="16.5" cy="14" r=".6"/>'),
    factory: svg('<path d="M3 21V10l5 3v-3l5 3v-3l5 3V4h3v17z"/><path d="M7 17h2M12 17h2"/>'),
    users: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>'),
    archive: svg('<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4"/>'),
    starFill: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/></svg>',
    back: svg('<path d="M15 18l-6-6 6-6"/><path d="M9 12h11"/>'),
    columns: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>'),
    chev: svg('<path d="M9 6l6 6-6 6"/>'),
    folder: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    check: svg('<path d="M5 12.5l4.5 4.5L19 7"/>'),
    edit: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'),
    trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
    arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>')
  };

  // Ícone pelo assunto (rótulo primeiro, depois o caminho no menu)
  const ICON_RULES = [
    [/^automotivo$/, "car"],
    [/^industrial$/, "factory"],
    [/^recursos humanos$|pessoal/, "users"],
    [/^suprimentos?$/, "archive"],
    [/^geral$/, "grid"],
    [/pneu|borrach|recap|ressolag/, "tire"],
    [/abastec|combust|diesel|etanol|gasolin|bomba|tanque/, "fuel"],
    [/lubrif|oleo|graxa|filtro/, "drop"],
    [/preventiv|plano|agenda|program|calend|revis|cronogram/, "calendar"],
    [/hodomet|horimet|odomet|\bkm\b|medic|leitura/, "gauge"],
    [/ordem|\bo\.?s\.?\b|servic|manutenc|oficina|reparo|conserto|corretiv|mecan/, "wrench"],
    [/veicul|frota|equipament|caminh|maquin|trator|placa|automot|implement|colhed/, "truck"],
    [/estoque|peca|materia|almox|produto|\bitens?\b|inventar/, "box"],
    [/compra|requisic|pedido|cotac|fornecedor/, "cart"],
    [/motorista|operador|funcion|colaborador|usuario|pessoa|equipe/, "user"],
    [/relat|consult|painel|dashboard|indicador|grafic|analis|kpi/, "chart"],
    [/ocorr|sinistr|avaria|alerta|pendenc|multa/, "alert"],
    [/config|parametr|ajuste|seguranc|perfil|permiss/, "gear"],
    [/cadastr|registr|lancament|apontament|ficha|controle/, "clipboard"],
    [/inicio|home|principal|pagina inicial/, "home"]
  ];
  function iconFor(label, path) {
    const a = norm(label);
    for (const [re, ic] of ICON_RULES) if (re.test(a)) return ic;
    const b = norm((path || []).join(" "));
    for (const [re, ic] of ICON_RULES) if (re.test(b)) return ic;
    return "arrow";
  }

  function esc(s) {
    return (s == null ? "" : String(s)).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function safeUrl(url) {
    try {
      const u = new URL(url, location.href);
      ["session", "cs", "clear"].forEach((k) => u.searchParams.delete(k));
      return u.href;
    } catch { return String(url || "").replace(/[?&](session|cs|clear)=[^&]*/g, ""); }
  }
  // Chave estável do link (sem o número da sessão), p/ contar os mais usados
  function linkKey(link) {
    try {
      const u = new URL(link, location.href);
      u.searchParams.delete("session");
      u.searchParams.delete("cs");
      u.searchParams.delete("clear");
      return u.pathname + u.search;
    } catch { return String(link).replace(/[?&]session=\d+/, ""); }
  }

  // Módulos da tela "Gestão / Módulo": título, cor do ícone (a mesma do sistema) e telas
  function moduleInfo() {
    const out = new Map();
    document.querySelectorAll(".t-MediaList-item").forEach((li) => {
      if (li.closest("#css-dash")) return;
      const t = li.querySelector(".t-MediaList-title");
      if (!t) return;
      const title = (t.innerText || "").trim();
      const ic = li.querySelector(".t-MediaList-icon");
      const color = ic ? getComputedStyle(ic).backgroundColor : "";
      const links = Array.from(li.querySelectorAll("a[href]"))
        .filter((a) => !/^javascript:|^#/.test(a.getAttribute("href") || ""));
      const head = links.find((a) => norm(a.innerText) === norm(title));
      const items = links.filter((a) => a !== head)
        .map((a) => ({ label: (a.innerText || "").trim(), link: a.getAttribute("href"), path: [title] }))
        .filter((x) => x.label);
      out.set(norm(title), { title, color, link: head ? head.getAttribute("href") : "", items });
    });
    return out;
  }

  // Cores no estilo dos ícones do sistema, p/ grupos sem cor própria
  const PALETTE = ["#309fdb", "#13b6cf", "#2ebfbc", "#3caf85", "#81bb5f", "#e9a23b", "#8a6fd1", "#e5677a"];

  function greeting() {
    const h = new Date().getHours();
    return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  }
  function displayName(user) {
    const n = (settings.userName || "").trim();
    if (n) return n;
    // Só usa o login se der para separar o primeiro nome (ex.: joao.silva)
    if (!user || !/[.\s_]/.test(user)) return "";
    const first = user.split(/[.\s_@]/)[0];
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  }

  function closeDashboard() {
    const d = document.getElementById("css-dash");
    if (d) d.remove();
    document.documentElement.classList.remove("css-dash-open", "css-picker-open");
    document.removeEventListener("keydown", dashKeys, true);
  }
  function dashKeys(e) {
    if (e.key === "Escape") {
      if (document.activeElement && document.activeElement.classList.contains("css-rename")) return;
      e.stopPropagation();
      const p = document.querySelector("#css-dash .css-picker");
      if (p && !p.hidden) openPicker(false);
      else closeDashboard();
    }
    else if (e.key === "/" && document.activeElement && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) {
      const q = document.getElementById("css-q");
      if (q) { e.preventDefault(); q.focus(); }
    }
  }

  // Monta os grupos: cada pasta do menu vira um bloco; a própria tela (Home) sai
  function buildGroups(navItems) {
    const mods = moduleInfo();
    const curKey = linkKey(location.href);
    const groups = new Map();
    const ensure = (name) => {
      const k = norm(name);
      if (!groups.has(k)) groups.set(k, { name, link: "", color: "", items: [], seen: new Set() });
      return groups.get(k);
    };
    const put = (g, it) => {
      const key = linkKey(it.link);
      if (key === curKey || g.seen.has(key + "|" + norm(it.label))) return;
      g.seen.add(key + "|" + norm(it.label));
      g.items.push({ ...it, key });
    };
    for (const it of navItems) {
      const path = it.path || [];
      if (linkKey(it.link) === curKey) continue;
      if (!path.length && it.kids) { ensure(it.label).link = it.link; continue; }
      put(ensure(path.length ? path[0] : "Atalhos"), it);
    }
    // Completa com a tela de módulos (cor + telas que o menu não trouxe)
    for (const m of mods.values()) {
      const g = ensure(m.title);
      g.color = m.color || g.color;
      if (!g.link) g.link = m.link;
      m.items.forEach((it) => put(g, it));
    }
    const list = Array.from(groups.values()).filter((g) => g.items.length || g.link);
    list.forEach((g, i) => {
      if (!g.color) g.color = PALETTE[i % PALETTE.length];
      // Módulo sem telas listadas: vira um atalho para ele mesmo
      if (!g.items.length && g.link) g.items.push({ label: g.name, link: g.link, path: [g.name], key: linkKey(g.link) });
    });
    return list;
  }

  // ===== Atalhos salvos (chrome.storage.sync: acompanham o seu Chrome) =====
  // Cada atalho guarda o CAMINHO pelos menus (ex.: Manutenção Automotiva ›
  // Processos › Ordem de Serviço › Abertura) e o app de destino. Os links do
  // APEX têm um código (cs) que só vale na sessão em que foram gerados, então
  // ao abrir a extensão percorre o caminho usando os links da sessão atual.
  const SC_KEY = "cssShortcuts";
  const GO_KEY = "cssGo";
  let shortcuts = [];

  // /ords/apex/r/<workspace>/<app>/<pagina>
  function apexParts(url) {
    try {
      const p = new URL(url, location.href).pathname.split("/").filter(Boolean);
      const i = p.indexOf("r");
      if (i < 0) return null;
      return { base: "/" + p.slice(0, i + 2).join("/"), ws: p[i + 1], app: p[i + 2] || "", page: p[i + 3] || "" };
    } catch { return null; }
  }
  function curParts() { return apexParts(location.href) || { base: "", app: "", page: "" }; }
  const LAUNCHER_APP = "cs-principal";

  function scKey(app, path, action) { return (app || "") + "|" + (path || []).map(norm).join(">") + (action ? "#" + norm(action) : ""); }
  function migrate(list) {
    return (Array.isArray(list) ? list : []).map((s) => {
      if (s.path && s.app) return s;
      const pp = apexParts(s.url || "");
      return { ...s, app: pp ? pp.app : "", path: [s.label], page: pp ? pp.page : "" };
    });
  }
  function loadShortcuts() {
    return new Promise((resolve) => {
      if (!extAlive()) return resolve(shortcuts);
      try {
        chrome.storage.sync.get([SC_KEY], (r) => {
          shortcuts = migrate(r && r[SC_KEY]);
          resolve(shortcuts);
        });
      } catch { resolve(shortcuts); }
    });
  }
  function saveShortcuts() {
    if (!extAlive()) { toast("Recarregue a página para salvar"); return; }
    try {
      chrome.storage.sync.set({ [SC_KEY]: shortcuts }, () => {
        if (chrome.runtime.lastError) toast("Não salvou: " + chrome.runtime.lastError.message);
      });
    } catch { /* ignore */ }
  }
  function currentSession() {
    try { return new URL(location.href).searchParams.get("session") || ""; } catch { return ""; }
  }
  function findShortcut(app, path, action) {
    const k = scKey(app, path, action);
    return shortcuts.find((s) => scKey(s.app, s.path, s.action) === k);
  }
  function colorFor(name) {
    let h = 0;
    for (const ch of norm(name || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return PALETTE[h % PALETTE.length];
  }
  function addShortcut(it) {
    if (findShortcut(it.app, it.path, it.action)) return false;
    const pp = apexParts(it.url || "");
    shortcuts.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      label: (it.label || it.action || it.path[it.path.length - 1] || "Atalho").slice(0, 60),
      app: it.app,
      path: it.path,
      action: it.action || "",
      page: pp ? pp.page : "",
      color: it.color || colorFor(it.path[0])
    });
    saveShortcuts();
    return true;
  }
  function removeShortcut(id) {
    shortcuts = shortcuts.filter((s) => s.id !== id);
    saveShortcuts();
  }

  // ---- Navegação pelo caminho ----
  // Acha no menu da tela atual o item pelo caminho de rótulos
  function findInNav(items, rest) {
    if (!rest.length) return null;
    const want = rest.map(norm);
    const last = want[want.length - 1];
    const cands = items.filter((it) => norm(it.label) === last);
    const exact = cands.find((it) => {
      const p = (it.path || []).map(norm);
      return p.length === want.length - 1 && p.every((x, i) => x === want[i]);
    });
    if (exact) return exact;
    const tail = cands.find((it) => {
      const p = (it.path || []).map(norm);
      const w = want.slice(0, -1);
      return w.every((x) => p.includes(x));
    });
    return tail || (cands.length === 1 ? cands[0] : null);
  }
  // Link vivo (da sessão atual) para a home de um app, achado na própria tela
  function liveAppLink(app) {
    const a = Array.from(document.querySelectorAll("a[href]")).find((x) => {
      if (x.closest("#css-dash")) return false;
      const pp = apexParts(x.getAttribute("href"));
      return pp && pp.app === app;
    });
    return a ? a.getAttribute("href") : "";
  }
  function launcherUrl() {
    const c = curParts();
    const s = currentSession();
    return c.base ? `${c.base}/${LAUNCHER_APP}/home${s ? "?session=" + s : ""}` : "";
  }
  function setGo(g) { ss(GO_KEY, g ? JSON.stringify(g) : null); }
  function getGo() {
    try {
      const g = JSON.parse(ss(GO_KEY) || "null");
      if (g && Date.now() - g.t < 60000 && (g.hops || 0) < 5) return g;
    } catch { /* ignore */ }
    setGo(null);
    return null;
  }

  // ---- Ação na página (ex.: botão "Nova Ordem de Serviço") ----
  const ACT_KEY = "cssAct";
  function setAct(label) { ss(ACT_KEY, JSON.stringify({ label, t: Date.now() })); }
  function getAct() {
    try {
      const a = JSON.parse(ss(ACT_KEY) || "null");
      if (a && Date.now() - a.t < 60000) return a;
    } catch { /* ignore */ }
    ss(ACT_KEY, null);
    return null;
  }
  function btnLabel(b) {
    const l = b.querySelector(".t-Button-label");
    return ((l ? l.textContent : b.textContent) || "").replace(/\s+/g, " ").trim();
  }
  function findActionButton(label) {
    const want = norm(label);
    return Array.from(document.querySelectorAll("button, a.t-Button, a[role='button']"))
      .find((b) => !b.closest("#css-dash") && visible(b) && norm(btnLabel(b)) === want);
  }
  async function runAction(label) {
    ss(ACT_KEY, null);
    showVeil("Abrindo " + label + "...");
    let b = null;
    for (let i = 0; i < 120 && !b; i++) { // até ~12s, verificando a cada 0,1s
      b = findActionButton(label);
      if (!b) await sleep(100);
    }
    hideVeil();
    if (!b) { toast("Não achei o botão “" + label + "” nesta tela"); return false; }
    b.scrollIntoView({ block: "center" });
    b.click();
    return true;
  }

  // ---- Telas mais acessadas (contadas neste Chrome) ----
  const VISITS_KEY = "cssVisits";
  function loadVisits() {
    return new Promise((resolve) => {
      try { chrome.storage.local.get([VISITS_KEY], (r) => resolve((r && r[VISITS_KEY]) || {})); }
      catch { resolve({}); }
    });
  }
  async function recordVisit() {
    if (!extAlive() || curParts().app === LAUNCHER_APP || getGo() || getAct()) return;
    const info = pageInfo || (pageInfo = await currentPageInfo());
    if (!info || !info.app || !info.path.length) return;
    const all = await loadVisits();
    const k = scKey(info.app, info.path);
    const v = all[k] || { app: info.app, path: info.path, label: info.label, n: 0 };
    v.n++; v.t = Date.now(); v.label = info.label; v.path = info.path;
    all[k] = v;
    // ponytail: guarda as 60 mais usadas, o resto sai
    const keep = Object.entries(all).sort((a, b) => b[1].n - a[1].n || b[1].t - a[1].t).slice(0, 60);
    try { chrome.storage.local.set({ [VISITS_KEY]: Object.fromEntries(keep) }); } catch { /* ignore */ }
  }
  async function topVisits(n) {
    return Object.values(await loadVisits()).sort((a, b) => b.n - a.n || b.t - a.t).slice(0, n);
  }

  // ---- Link direto (resolvido em segundo plano) ----
  // Lê o menu do módulo pelo HTML (sem abrir a página) e acha o link da tela
  // na sessão atual. Guarda por sessão: os próximos cliques são imediatos.
  async function fetchDoc(url) {
    const res = await fetch(new URL(url, location.href).href, { credentials: "same-origin" });
    return new DOMParser().parseFromString(await res.text(), "text/html");
  }
  function directShortcutUrl(s) {
    if (!s || !s.app || !s.page) return "";
    const c = curParts();
    if (!c.base) return "";
    try {
      const u = new URL(c.base + "/" + s.app + "/" + s.page, location.origin);
      const session = currentSession();
      if (session) u.searchParams.set("session", session);
      return u.href;
    } catch { return ""; }
  }
  function linkCacheKey(s) { return "cssLink:" + currentSession() + ":" + scKey(s.app, s.path, "") + ":" + (s.page || ""); }
  const resolving = {};
  function resolveShortcut(s) {
    const ck = linkCacheKey(s);
    const cached = ss(ck);
    if (cached) return Promise.resolve(cached);
    if (!resolving[ck]) {
      resolving[ck] = (async () => {
        const c = curParts();
        const rest = s.path.slice(1);
        // A página salva é a fonte mais confiável. O menu só é usado quando
        // o atalho antigo não tem page (migração) ou a URL direta não existe.
        let url = directShortcutUrl(s);
        if (!url) {
          if (c.app === s.app) {
            const nav = await bridge("nav");
            const items = nav.items || [];
            if (rest.length) {
              const hit = findInNav(items, rest);
              url = hit ? hit.link : "";
            } else {
              const home = items.find((it) => { const pp = apexParts(it.link); return pp && pp.app === s.app && /^(home|inicio)$/i.test(pp.page); });
              url = home ? home.link : "";
            }
          } else {
            let appLink = liveAppLink(s.app);
            if (!appLink && c.app !== LAUNCHER_APP && launcherUrl()) {
              const doc = await fetchDoc(launcherUrl());
              const a = Array.from(doc.querySelectorAll("a[href]")).find((x) => { const pp = apexParts(x.getAttribute("href")); return pp && pp.app === s.app; });
              appLink = a ? a.getAttribute("href") : "";
            }
            if (appLink) {
              if (!rest.length) url = appLink;
              else {
                const tree = await fetchAppNav(appLink);
                const hit = tree ? findInNav(tree.filter((it) => it.link && it.link !== "#" && !/^javascript:/i.test(it.link)), rest) : null;
                url = hit ? hit.link : "";
              }
            }
          }
        }
        if (url) ss(ck, url);
        return url;
      })().catch((e) => { console.log("[CS Simples] resolver atalho:", e); return ""; })
        .finally(() => { delete resolving[ck]; });
    }
    return resolving[ck];
  }

  // Resolve todos os atalhos em segundo plano, mas com no máximo 3 requisições
  // simultâneas: 60 fetch/bridge de uma vez sobrecarregava o APEX.
  async function prefetchShortcuts() {
    if (!document.querySelector("#css-dash")) return;
    const list = shortcuts.slice();
    let next = 0;
    const worker = async () => {
      while (next < list.length) {
        const s = list[next++];
        const url = await resolveShortcut(s);
        const a = document.querySelector(`#css-dash .css-tile-wrap[data-id="${CSS.escape(s.id)}"] a.css-tile`);
        if (a && url) a.setAttribute("href", url); // permite abrir em nova aba (Ctrl+clique)
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, list.length) }, worker));
  }

  // Vai para a tela inicial do CS (onde abre o dashboard)
  function goHome() {
    const url = launcherUrl();
    showVeil("Voltando para a Home...");
    if (url && curParts().app !== LAUNCHER_APP) { location.href = url; return; }
    if (url && !/^(home|inicio)$/i.test(curParts().page)) { location.href = url; return; }
    // já está na home: recarrega para fechar o formulário e abrir o dashboard
    location.href = url || location.href;
  }

  async function goShortcut(s) {
    showVeil("Abrindo " + s.label + "...");
    const url = await resolveShortcut(s);
    if (url) {
      let samePage = false;
      try { samePage = new URL(url, location.href).pathname === location.pathname; } catch { /* ignore */ }
      if (s.action && samePage) { closeDashboard(); runAction(s.action); return; }
      if (s.action) setAct(s.action);
      location.href = url;
      return;
    }
    // Sem link direto: segue o caminho página a página (modo antigo)
    setGo({ id: s.id, app: s.app, path: s.path, action: s.action || "", label: s.label, t: Date.now(), hops: 0 });
    const ok = await continueGo();
    if (!ok) hideVeil();
  }

  // Dá o próximo passo do caminho. true = navegou / vai navegar
  async function continueGo() {
    const g = getGo();
    if (!g) return false;
    const c = curParts();
    const rest = g.path.slice(1);
    const step = (url, msg) => {
      setGo({ ...g, hops: (g.hops || 0) + 1, t: Date.now() });
      showVeil(msg || "Abrindo " + g.label + "...");
      location.href = url;
      return true;
    };

    if (c.app === g.app) {
      if (!rest.length) { // home do app
        setGo(null);
        if (g.action) { runAction(g.action); return true; }
        hideVeil();
        return false;
      }
      const nav = await bridge("nav");
      const hit = findInNav(nav.items || [], rest);
      if (hit) {
        setGo(null);
        let samePage = false;
        try { samePage = new URL(hit.link, location.href).pathname === location.pathname; } catch { /* ignore */ }
        if (g.action && samePage) { runAction(g.action); return true; }
        if (g.action) setAct(g.action);
        showVeil("Abrindo " + g.label + "...");
        location.href = hit.link;
        return true;
      }
      setGo(null);
      hideVeil();
      toast("Não achei “" + rest.join(" › ") + "” no menu deste módulo");
      return false;
    }
    const live = liveAppLink(g.app);
    if (live) {
      if (!rest.length) { setGo(null); if (g.action) setAct(g.action); }
      return rest.length ? step(live, "Abrindo " + g.path[0] + "...") : (showVeil("Abrindo " + g.label + "..."), location.href = live, true);
    }
    if (c.app !== LAUNCHER_APP) {
      const home = launcherUrl();
      if (home) return step(home, "Abrindo " + g.label + "...");
    }
    setGo(null);
    hideVeil();
    toast("Não achei o módulo “" + g.path[0] + "” na tela inicial");
    return false;
  }

  // Caminho da tela atual: item ativo no menu (com as pastas) + nome do app
  async function currentPageInfo() {
    const c = curParts();
    const nav = await bridge("nav");
    const items = nav.items || [];
    const here = location.pathname;
    let hit = items.find((it) => { try { return new URL(it.link, location.href).pathname === here; } catch { return false; } });
    const pick = (sel) => {
      const el = document.querySelector(sel);
      return el ? (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim() : "";
    };
    const appName = pick(".t-Breadcrumb-item:first-child .t-Breadcrumb-label") ||
      pick(".t-Breadcrumb-item:first-child") ||
      (document.title || "").split(/\s[-–|]\s/)[0].trim() || c.app;
    if (!hit) {
      const lab = pick("#t_TreeNav .is-current .a-TreeView-label") || pick(".t-Breadcrumb-item.is-active .t-Breadcrumb-label");
      if (lab) hit = items.find((it) => norm(it.label) === norm(lab));
    }
    const isHome = /^(home|inicio)$/i.test(c.page);
    const path = hit && !isHome ? [appName, ...(hit.path || []), hit.label] : [appName];
    return { app: c.app, path, label: path[path.length - 1], url: location.href };
  }

  // Estrela flutuante: salva / remove a tela atual dos atalhos
  let pageInfo = null;
  async function updateSaveFab() {
    const b = document.getElementById("css-save-fab");
    if (!b) return;
    if (!pageInfo) pageInfo = await currentPageInfo();
    const saved = !!findShortcut(pageInfo.app, pageInfo.path);
    b.classList.toggle("on", saved);
    b.innerHTML = saved ? ICONS.starFill : ICONS.star;
    b.title = (saved ? "Remover dos atalhos: " : "Salvar nos atalhos: ") + pageInfo.path.join(" › ");
  }
  async function toggleSaveCurrent() {
    pageInfo = await currentPageInfo();
    const s = findShortcut(pageInfo.app, pageInfo.path);
    if (s) {
      removeShortcut(s.id);
      toast("Removida dos atalhos");
    } else {
      addShortcut(pageInfo);
      toast("⭐ Salvo: " + pageInfo.path.join(" › "));
    }
    updateSaveFab();
  }

  // ---- Menu de outro módulo (para o painel "Adicionar") ----
  // Abre a home do app em segundo plano e lê o menu lateral do HTML (com cache em sessionStorage).
  const appNavCache = {};
  const appNavInflight = {};
  async function fetchAppNav(link) {
    const pp = apexParts(link);
    if (!pp) return null;
    if (appNavCache[pp.app]) return appNavCache[pp.app];
    const sk = "cssAppNav:" + (currentSession() || "0") + ":" + pp.app;
    const saved = ss(sk);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) {
          appNavCache[pp.app] = parsed;
          return parsed;
        }
      } catch { /* ignore */ }
    }
    if (!appNavInflight[pp.app]) {
      appNavInflight[pp.app] = (async () => {
        const res = await fetch(new URL(link, location.href).href, { credentials: "same-origin" });
        const doc = new DOMParser().parseFromString(await res.text(), "text/html");
        const root = doc.querySelector("#t_TreeNav, .t-TreeNav");
        const ul = root && (root.querySelector(":scope > ul") || root.querySelector("ul"));
        if (!ul) return null;
        const out = [];
        const walk = (list, path, depth) => {
          if (depth > 6) return;
          Array.from(list.children).forEach((li) => {
            if (li.tagName !== "LI") return;
            const a = li.querySelector(":scope > a, :scope > div a, :scope > span a");
            const lab = ((a ? a.textContent : (li.querySelector(":scope > span, :scope > div") || li).textContent) || "").replace(/\s+/g, " ").trim();
            const sub = li.querySelector(":scope > ul");
            if (lab) out.push({ label: lab, path, kids: !!sub, link: a ? a.getAttribute("href") : "" });
            if (sub) walk(sub, path.concat(lab), depth + 1);
          });
        };
        walk(ul, [], 0);
        appNavCache[pp.app] = out;
        try { ss(sk, JSON.stringify(out)); } catch { /* ignore */ }
        return out;
      })().finally(() => { delete appNavInflight[pp.app]; });
    }
    return appNavInflight[pp.app];
  }

  let dashBusy = false;
  let dashCtx = null; // { env, groups, appName }

  async function openDashboard(manual) {
    if (dashBusy || document.getElementById("css-dash")) return;
    if (!settings.enabled || isLoginPage()) { if (manual) toast("Faça login primeiro"); return; }
    dashBusy = true;
    try {
      const [env, navRes] = await Promise.all([bridge("env"), bridge("nav"), loadShortcuts()]);
      const c = curParts();
      dashCtx = {
        env,
        groups: buildGroups(navRes.items || []),
        app: c.app,
        appName: (document.title || "").split(/\s[-–|]\s/)[0].trim(),
        open: new Set(),
        trees: {}
      };

      const gefTxt = env.gefTxt || (env.gef ? env.gef.replace(/-/g, ".") : "");
      const gefOk = !env.gef || env.gef === GEF_ALVO.value;
      const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
      const name = displayName(env.user);

      const d = document.createElement("div");
      d.id = "css-dash";
      d.setAttribute("role", "dialog");
      d.setAttribute("aria-label", "Dashboard CS Simples");
      d.innerHTML = `
        <header class="css-top">
          <div class="css-brand">
            <img class="css-logo" src="${logoUrl()}" alt="USL">
            <div class="css-brand-txt"><strong>${esc(dashCtx.appName || "CS")}</strong><small>CS Simples</small></div>
          </div>
          <div class="css-chips">
            ${gefTxt ? `<span class="css-chip ${gefOk ? "ok" : "warn"}" title="GEF atual">${ICONS.pin}${esc(gefTxt)}</span>` : ""}
            ${env.user ? `<span class="css-chip" title="Usuário">${ICONS.user}${esc(env.user.toLowerCase())}</span>` : ""}
          </div>
          <button class="css-close" type="button" title="Ir para o sistema (Esc)">Ir para o sistema ${ICONS.close}</button>
        </header>
        <main class="css-body">
          <div class="css-hero">
            <div class="css-hello">
              <h1>${greeting()}${name ? ", " + esc(name) : ""}</h1>
              <p>${esc(today)}</p>
            </div>
            <label class="css-search">${ICONS.search}<input id="css-q" type="search" placeholder="Buscar nos atalhos…" autocomplete="off"><kbd>/</kbd></label>
          </div>
          ${!gefOk ? `<div class="css-warn">${ICONS.alert}<span>Você está na GEF <b>${esc(gefTxt)}</b>.</span><button type="button" class="css-gef-btn">Ir para 1.3.1</button></div>` : ""}
          <section id="css-top" hidden>
            <h2 class="css-sec-t"><span class="css-sec-ico">${ICONS.chart}</span>Mais acessados</h2>
            <div class="css-tiles"></div>
          </section>
          <div class="css-sc-head">
            <h2 class="css-sec-t"><span class="css-sec-ico">${ICONS.star}</span>Meus atalhos <span class="css-sec-n" id="css-sc-n"></span></h2>
            <button type="button" class="css-btn css-add-open">${ICONS.plus}Adicionar atalho</button>
          </div>
          <div id="css-sc"></div>
          <p class="css-none" hidden>Nenhum atalho com esse nome.</p>
          <details id="css-menus">
            <summary><span class="css-sec-ico">${ICONS.grid}</span>Todos os menus<span class="css-menus-chev">${ICONS.chev}</span></summary>
            <div class="css-menus-list"></div>
          </details>
        </main>
        <div class="css-picker-bg" hidden></div>
        <aside class="css-picker" hidden aria-label="Adicionar atalhos">
          <header class="css-picker-h">
            <div><h3>Adicionar atalhos</h3><small>Abra o módulo (▸) para escolher a tela</small></div>
            <button type="button" class="css-icon-btn css-picker-x" title="Fechar">${ICONS.close}</button>
          </header>
          <label class="css-search css-search-sm">${ICONS.search}<input id="css-pq" type="search" placeholder="Buscar tela…" autocomplete="off"></label>
          <div class="css-picker-list"></div>
          <p class="css-picker-tip">${ICONS.starFill}<span>Dica: em qualquer tela do sistema, clique na estrela no canto da tela para salvá-la aqui com o caminho completo.</span></p>
        </aside>`;
      document.body.appendChild(d);
      document.documentElement.classList.add("css-dash-open");
      document.addEventListener("keydown", dashKeys, true);

      renderShortcuts();
      renderPicker();
      renderTop();
      bindDashboard(d);
      prefetchShortcuts();
      // lembra se "Todos os menus" estava aberto
      const det = d.querySelector("#css-menus");
      if (ss("cssMenusOpen") === "1") det.open = true;
      det.addEventListener("toggle", () => ss("cssMenusOpen", det.open ? "1" : null));
      setTimeout(() => { const q = d.querySelector("#css-q"); if (q && shortcuts.length) q.focus(); }, 50);
    } finally {
      dashBusy = false;
    }
  }

  async function renderTop() {
    const box = document.querySelector("#css-dash #css-top");
    if (!box) return;
    const list = await topVisits(4);
    dashCtx.top = list;
    box.hidden = !list.length;
    box.querySelector(".css-tiles").innerHTML = list.map((v, i) => `
      <a class="css-card css-tile" href="#" data-top="${i}" title="${esc(v.path.join(" › "))}" style="--g:${esc(colorFor(v.path[0]))}">
        <span class="css-ico">${scIcon(v.label, v.path)}</span>
        <span class="css-card-txt"><span class="css-card-t">${esc(v.label)}</span><span class="css-card-s">${esc(v.path.length > 2 ? v.path.slice(1, -1).join(" › ") : v.path[0])} · ${v.n}×</span></span>
      </a>`).join("");
  }

  function scIcon(label, path) {
    const ic = iconFor(label, path);
    if (ic !== "arrow") return ICONS[ic];
    for (const p of [...(path || [])].reverse()) {
      const x = iconFor(p, []);
      if (x !== "arrow") return ICONS[x];
    }
    return ICONS.grid;
  }

  // ---- Grade de atalhos ----
  function renderShortcuts() {
    const d = document.getElementById("css-dash");
    if (!d || !dashCtx) return;
    const box = d.querySelector("#css-sc");
    d.querySelector("#css-sc-n").textContent = shortcuts.length || "";
    d.querySelector(".css-add-open").hidden = !shortcuts.length;
    d.querySelector(".css-search").hidden = !shortcuts.length;

    if (!shortcuts.length) {
      box.innerHTML = `
        <div class="css-blank">
          <div class="css-blank-ico">${ICONS.star}</div>
          <h3>Sua tela inicial está vazia</h3>
          <p>Salve as telas que você mais usa para abrir com um clique.</p>
          <button type="button" class="css-btn css-btn-primary css-add-open">${ICONS.plus}Adicionar atalho</button>
          <small>ou clique na <b>estrela</b> no canto de qualquer tela do sistema</small>
        </div>`;
      return;
    }
    const tile = (s) => {
      const crumbs = s.action
        ? (s.path.length > 1 ? s.path.slice(1).join(" › ") : s.path[0])
        : s.path.length > 2 ? s.path.slice(1, -1).join(" › ") : (s.path.length === 2 ? s.path[0] : (norm(s.label) !== norm(s.path[0]) ? s.path[0] : ""));
      return `
      <div class="css-tile-wrap" draggable="true" data-id="${esc(s.id)}" data-q="${esc(norm(s.label + " " + s.path.join(" ")))}">
        <a class="css-card css-tile" draggable="false" href="#" title="${esc(s.path.join(" › ") + (s.action ? " › " + s.action : ""))}" style="--g:${esc(s.color || colorFor(s.path[0]))}">
          <span class="css-ico">${s.action ? ICONS.plus : scIcon(s.label, s.path)}</span>
          <span class="css-card-txt"><span class="css-card-t">${esc(s.label)}</span>${crumbs ? `<span class="css-card-s">${esc(crumbs)}</span>` : ""}</span>
        </a>
        <div class="css-tile-act">
          <button type="button" class="css-icon-btn" data-act="rename" title="Renomear">${ICONS.edit}</button>
          <button type="button" class="css-icon-btn" data-act="remove" title="Remover">${ICONS.trash}</button>
        </div>
      </div>`;
    };
    box.innerHTML = `<div class="css-tiles">${shortcuts.map(tile).join("")}
      <button type="button" class="css-tile-add css-add-open">${ICONS.plus}<span>Adicionar</span></button></div>`;
    const q = d.querySelector("#css-q");
    if (q && q.value) q.dispatchEvent(new Event("input"));
  }

  // ---- Painel "Adicionar atalhos" ----
  // Na tela inicial do CS: módulos > apps (▸ abre o menu completo do app).
  // Dentro de um app: o menu do próprio app.
  let treeMode = "add"; // "add" = painel Adicionar | "go" = Todos os menus (abre a tela)
  function pickRow(o) {
    const on = !!findShortcut(o.app, o.path);
    const sc = esc(JSON.stringify({ app: o.app, path: o.path, color: o.color }));
    const go = treeMode === "go" && !o.folder;
    return `
      <div class="css-prow" style="--lvl:${o.lvl || 0}">
        ${o.expand ? `<button type="button" class="css-pexp ${o.isOpen ? "open" : ""}" data-exp="${esc(o.expand)}" title="${o.isOpen ? "Fechar" : "Ver telas"}">${ICONS.chev}</button>` : `<span class="css-pexp-sp"></span>`}
        <button type="button" class="css-pitem ${on ? "on" : ""} ${o.folder ? "folder" : ""}" ${o.folder ? `data-exp="${esc(o.expand)}"` : go ? `data-go="${sc}"` : `data-sc="${sc}"`} data-q="${esc(norm(o.path.join(" ")))}">
          <span class="css-row-ico">${o.folder ? ICONS.folder : scIcon(o.path[o.path.length - 1], o.path)}</span>
          <span class="css-card-txt"><span class="css-card-t">${esc(o.path[o.path.length - 1])}</span>${o.sub ? `<span class="css-card-s">${esc(o.sub)}</span>` : ""}</span>
          ${o.folder || go ? "" : `<span class="css-pitem-st">${on ? ICONS.check : ICONS.plus}</span>`}
        </button>
        ${go ? `<button type="button" class="css-pstar ${on ? "on" : ""}" data-sc="${sc}" title="${on ? "Tirar dos atalhos" : "Salvar nos atalhos"}">${on ? ICONS.starFill : ICONS.star}</button>` : ""}
      </div>`;
  }

  // Árvore (itens com path) -> linhas, respeitando pastas abertas
  function treeRows(items, app, base, color, keyPrefix, lvl0) {
    const html = [];
    const ctx = dashCtx;
    const visible = (it) => {
      for (let i = 1; i <= (it.path || []).length; i++) {
        if (!ctx.open.has(keyPrefix + (it.path || []).slice(0, i).join(">"))) return false;
      }
      return true;
    };
    items.forEach((it) => {
      if (!visible(it)) return;
      const full = [...base, ...(it.path || []), it.label];
      const lvl = lvl0 + (it.path || []).length;
      if (it.kids) {
        const k = keyPrefix + [...(it.path || []), it.label].join(">");
        // Pasta sem link abre/fecha; pasta com link continua clicável
        // (o botão de expandir continua aparecendo ao lado).
        html.push(pickRow({ app, path: full, color, lvl, folder: !it.link, expand: k, isOpen: ctx.open.has(k) }));
      } else if (it.link) {
        html.push(pickRow({ app, path: full, color, lvl }));
      }
    });
    return html.join("");
  }

  // Desenha a mesma árvore no painel "Adicionar" e em "Todos os menus"
  function renderPicker() {
    const d = document.getElementById("css-dash");
    if (!d || !dashCtx) return;
    treeMode = "go";
    renderTree(d, d.querySelector(".css-menus-list"));
    treeMode = "add";
    renderTree(d, d.querySelector(".css-picker-list"));
  }
  function renderTree(d, list) {
    if (!list) return;
    const ctx = dashCtx;
    const pq = d.querySelector("#css-pq");
    const searching = pq && pq.value.trim();

    if (ctx.app === LAUNCHER_APP) {
      // Módulos (blocos) -> apps; cada app abre o menu completo
      list.innerHTML = ctx.groups.map((g) => `
        <section class="css-pgroup" style="--g:${esc(g.color)}">
          <h4><span class="css-pgroup-dot"></span>${esc(g.name)}</h4>
          ${g.items.map((it) => {
            const pp = apexParts(it.link);
            const app = pp ? pp.app : "";
            const k = "app:" + app;
            const isOpen = ctx.open.has(k);
            const tree = ctx.trees[app];
            let inner = "";
            if (isOpen) {
              if (tree === "loading") inner = `<p class="css-ploading" style="--lvl:1">Carregando menu…</p>`;
              else if (!tree || !tree.length) inner = `<p class="css-ploading" style="--lvl:1">Não consegui ler o menu deste módulo. Abra o módulo e use a estrela ⭐ na tela desejada.</p>`;
              else inner = treeRows(tree, app, [it.label], g.color, k + "/", 1);
            }
            return pickRow({ app, path: [it.label], color: g.color, lvl: 0, expand: k, isOpen, sub: "Tela inicial do módulo" }) + inner;
          }).join("")}
        </section>`).join("");
    } else {
      const flat = [];
      ctx.groups.forEach((g) => g.items.forEach((it) => flat.push({ ...it, path: it.path || [] })));
      // dentro de um app: lista direta (pastas viram título)
      list.innerHTML = ctx.groups.map((g) => `
        <section class="css-pgroup" style="--g:${esc(g.color)}">
          <h4><span class="css-pgroup-dot"></span>${esc(g.name)}</h4>
          ${g.items.map((it) => pickRow({
            app: ctx.app, path: [ctx.appName, ...(it.path || []), it.label], color: g.color, lvl: 0,
            sub: (it.path || []).slice(1).join(" › ")
          })).join("")}
        </section>`).join("") || `<p class="css-picker-empty">Não encontrei o menu nesta tela.</p>`;
    }
    if (searching) pq.dispatchEvent(new Event("input"));
  }

  async function toggleExpand(key) {
    const ctx = dashCtx;
    if (ctx.open.has(key)) {
      // fecha a pasta e tudo abaixo dela
      Array.from(ctx.open).forEach((k) => { if (k === key || k.startsWith(key + ">") || k.startsWith(key + "/")) ctx.open.delete(k); });
      renderPicker();
      return;
    }
    ctx.open.add(key);
    if (key.startsWith("app:") && !key.includes("/")) {
      const app = key.slice(4);
      if (!ctx.trees[app]) {
        ctx.trees[app] = "loading";
        renderPicker();
        let tree = null;
        try {
          const link = liveAppLink(app);
          tree = link ? await fetchAppNav(link) : null;
        } catch (e) { console.log("[CS Simples] menu do módulo:", e); }
        ctx.trees[app] = tree || [];
      }
    }
    renderPicker();
  }

  function startRename(wrap) {
    const s = shortcuts.find((x) => x.id === wrap.dataset.id);
    if (!s) return;
    const t = wrap.querySelector(".css-card-t");
    const inp = document.createElement("input");
    inp.className = "css-rename";
    inp.value = s.label;
    inp.maxLength = 60;
    t.replaceWith(inp);
    wrap.draggable = false;
    inp.focus();
    inp.select();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      const v = inp.value.trim();
      if (ok && v && v !== s.label) { s.label = v; saveShortcuts(); }
      renderShortcuts();
    };
    inp.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") { e.preventDefault(); finish(true); }
      else if (e.key === "Escape") { e.preventDefault(); finish(false); }
    });
    inp.addEventListener("blur", () => finish(true));
    inp.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); });
  }

  function bindDashboard(d) {
    d.querySelector(".css-close").addEventListener("click", closeDashboard);
    const gb = d.querySelector(".css-gef-btn");
    if (gb) gb.addEventListener("click", () => { closeDashboard(); runGefOnly(); });

    d.addEventListener("click", (e) => {
      if (e.target.closest(".css-add-open")) { openPicker(true); return; }
      if (e.target.closest(".css-picker-x") || e.target.closest(".css-picker-bg")) { openPicker(false); return; }

      const act = e.target.closest("[data-act]");
      if (act) {
        e.preventDefault();
        const wrap = act.closest(".css-tile-wrap");
        if (act.dataset.act === "remove") {
          const s = shortcuts.find((x) => x.id === wrap.dataset.id);
          removeShortcut(wrap.dataset.id);
          renderShortcuts();
          renderPicker();
          if (s) toast("“" + s.label + "” removido");
        } else if (act.dataset.act === "rename") {
          startRename(wrap);
        }
        return;
      }

      const exp = e.target.closest("[data-exp]");
      if (exp) { toggleExpand(exp.dataset.exp); return; }

      const gi = e.target.closest("[data-go]");
      if (gi) {
        let o;
        try { o = JSON.parse(gi.dataset.go); } catch { return; }
        goShortcut({ id: "menu", app: o.app, path: o.path, label: o.path[o.path.length - 1] });
        return;
      }
      const tp = e.target.closest("[data-top]");
      if (tp) {
        e.preventDefault();
        const v = (dashCtx.top || [])[+tp.dataset.top];
        if (v) goShortcut({ id: "top", app: v.app, path: v.path, label: v.label });
        return;
      }

      const pi = e.target.closest("[data-sc]");
      if (pi) {
        let o;
        try { o = JSON.parse(pi.dataset.sc); } catch { return; }
        const s = findShortcut(o.app, o.path);
        if (s) removeShortcut(s.id);
        else addShortcut({ app: o.app, path: o.path, color: o.color });
        renderShortcuts();
        renderPicker();
        return;
      }

      const a = e.target.closest("a.css-tile");
      if (a) {
        if ((e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) && a.getAttribute("href") !== "#") return;
        e.preventDefault();
        const s = shortcuts.find((x) => x.id === a.closest(".css-tile-wrap").dataset.id);
        if (s) goShortcut(s);
      }
    });

    // Busca nos atalhos
    const q = d.querySelector("#css-q");
    q.addEventListener("input", () => {
      const v = norm(q.value);
      let n = 0;
      d.querySelectorAll(".css-tile-wrap").forEach((w) => {
        const hit = !v || w.dataset.q.includes(v);
        w.hidden = !hit;
        if (hit) n++;
      });
      const add = d.querySelector(".css-tile-add");
      if (add) add.hidden = !!v;
      d.querySelector(".css-none").hidden = !v || n > 0 || !shortcuts.length;
    });
    q.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const first = d.querySelector(".css-tile-wrap:not([hidden]) a.css-tile");
      if (first) first.click();
    });

    // Busca no painel (filtra o que já está carregado/aberto)
    const pq = d.querySelector("#css-pq");
    pq.addEventListener("input", () => {
      const v = norm(pq.value);
      d.querySelectorAll(".css-pgroup").forEach((sec) => {
        let n = 0;
        sec.querySelectorAll(".css-prow").forEach((r) => {
          const b = r.querySelector(".css-pitem");
          const hit = !v || (b && b.dataset.q.includes(v));
          r.hidden = !hit;
          if (hit) n++;
        });
        sec.hidden = n === 0;
      });
    });

    // Arrastar para reordenar
    let dragId = null;
    d.addEventListener("dragstart", (e) => {
      const w = e.target.closest && e.target.closest(".css-tile-wrap");
      if (!w) return;
      dragId = w.dataset.id;
      w.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", dragId); } catch { /* ignore */ }
    });
    d.addEventListener("dragover", (e) => {
      if (!dragId) return;
      const w = e.target.closest && e.target.closest(".css-tile-wrap");
      if (!w || w.dataset.id === dragId) return;
      e.preventDefault();
      const r = w.getBoundingClientRect();
      const after = e.clientX > r.left + r.width / 2;
      const src = d.querySelector(`.css-tile-wrap[data-id="${CSS.escape(dragId)}"]`);
      if (src) w.parentNode.insertBefore(src, after ? w.nextSibling : w);
    });
    d.addEventListener("dragend", () => {
      if (!dragId) return;
      dragId = null;
      const order = Array.from(d.querySelectorAll(".css-tile-wrap")).map((w) => w.dataset.id);
      shortcuts.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      saveShortcuts();
      renderShortcuts();
    });
  }

  function openPicker(open) {
    const d = document.getElementById("css-dash");
    if (!d) return;
    d.querySelector(".css-picker").hidden = !open;
    d.querySelector(".css-picker-bg").hidden = !open;
    document.documentElement.classList.toggle("css-picker-open", !!open);
    if (open) setTimeout(() => d.querySelector("#css-pq").focus(), 30);
  }
  // Tela inicial do app = página 1 do APEX (ou URL /home)
  async function isHomePage() {
    if (/\/r\/apex\//i.test(location.pathname)) return false; // páginas do próprio Oracle APEX (ex.: entrar no workspace)
    if (/\/(home|inicio|pagina-inicial)(\?|$)/i.test(location.pathname + location.search)) return true;
    const env = await bridge("env");
    return env.ok && env.pageId === "1";
  }

  // ===== Diagnóstico (botão no popup) =====
  async function runDiag() {
    const env = await bridge("env");
    const nav = await bridge("nav");
    const lines = [];
    lines.push("URL: " + safeUrl(location.href));
    lines.push("TITLE: " + document.title);
    lines.push("LOGIN PAGE: " + isLoginPage());
    lines.push("APEX: app=" + env.appId + " page=" + env.pageId + " user=" + env.user);
    lines.push("GEF: " + env.gef + " / " + env.gefTxt + " (alvo " + GEF_ALVO.value + ")");
    lines.push("DL_GEF_LINK na tela: " + (document.getElementById("DL_GEF_LINK") ? JSON.stringify(document.getElementById("DL_GEF_LINK").value) : "-"));
    lines.push("MENU (" + ((nav.items || []).length) + " itens):");
    (nav.items || []).slice(0, 80).forEach((it) => lines.push("  " + (it.path || []).concat(it.label).join(" › ") + "  ->  " + linkKey(it.link)));
    lines.push("ATALHOS SALVOS: " + shortcuts.length);
    lines.push("MÓDULOS NA TELA: " + Array.from(moduleInfo().values()).map((m) => m.title + " (" + m.items.length + ")").join(" | "));
    const report = lines.join("\n");
    console.log("[CS Simples] DIAGNÓSTICO:\n" + report);
    await copyOrRelay(report, "Diagnóstico copiado! Cole aqui no chat", "Abra o console (F12) e copie o diagnóstico");
  }

  // ===== Início =====
  // Grades: preencher a altura da tela (a grade carrega depois da página)
  // Relatórios (grade interativa): 1000 linhas por página, como em
  // Ações › Formato › Linhas por Página. A grade carrega depois da página,
  // então tenta algumas vezes até ela existir.
  async function applyRowsMax() {
    if (!settings.enabled || !settings.rows1000) return false;
    for (let i = 0; i < 20; i++) {
      if (document.querySelector(".a-IG")) {
        if (i) await sleep(150);
        const r = await bridge("rows-max", { rows: 1000 });
        if (r.ok && (r.grids || []).length) {
          console.log("[CS Simples] linhas por página:", JSON.stringify(r.grids));
          return true;
        }
      }
      await sleep(250);
    }
    return false;
  }

  // ===== Colunas escondidas por tela =====
  // Guardado por tela (app/página). Já vem com a escolha da Abertura de OS.
  const COLS_KEY = "cssHideCols";
  const COLS_DEFAULT = {
    "cs-manutencao-automotiva/ordem-servico": ["Responsável", "Tipo de O.S.", "Placa", "Marca", "Modelo", "Operação"]
  };
  // Ajustes de layout por tela: juntar colunas e deixar a grade compacta
  const GRID_LAYOUT = {
    "cs-manutencao-automotiva/ordem-servico": {
      // hideFrom:false mantém "Objeto de Custo" visível até o merge ser
      // confirmado em todas as linhas; evita esconder dado sem copiar.
      merges: [{ into: "Equipamento", from: "Objeto de Custo", title: "Equipamento/Obj. Custo", hideFrom: false }],
      split: { source: "Equipamento/Obj. Custo", vessel: "Urgência", title: "Código", width: 80 },
      order: ["Ano", "Número", "Código", "Equipamento/Obj. Custo", "Data de Abertura", "Previsão de Entrega", "Data de Encerramento", "Status"],
      stretch: "Equipamento/Obj. Custo"
    }
  };
  // Mapa página numérica -> alias. O APEX às vezes navega por /100/20 em vez
  // de /app/pagina; sem isso, as colunas/layout salvos não seriam encontrados.
  const PAGE_MAP_KEY = "cssPageMap";
  let pageMap = {};
  let pageMapPromise = null;
  let pageKeyRememberedFor = "";
  function loadPageMap() {
    if (pageMapPromise) return pageMapPromise;
    pageMapPromise = new Promise((resolve) => {
      try {
        chrome.storage.local.get([PAGE_MAP_KEY], (r) => {
          pageMap = (r && r[PAGE_MAP_KEY]) || {};
          resolve();
        });
      } catch { resolve(); }
    });
    return pageMapPromise;
  }
  async function rememberPageKey() {
    const c = curParts();
    if (!c.app || !c.page || /^\d+$/.test(c.app)) return;
    const current = c.app + "/" + c.page;
    if (pageKeyRememberedFor === current) return;
    try {
      const env = await bridge("env");
      if (!env || !env.appId) return;
      const nk = env.appId + "/" + (env.pageId || c.page);
      if (!nk || nk === current) return;
      if (pageMap[nk] !== current) {
        pageMap[nk] = current;
        try { chrome.storage.local.set({ [PAGE_MAP_KEY]: pageMap }); } catch { /* ignore */ }
      }
      pageKeyRememberedFor = current;
    } catch { /* sem bridge: tenta de novo na próxima */ }
  }
  function pageKey() {
    const c = curParts();
    const key = c.app + "/" + c.page;
    return pageMap[key] || key;
  }
  function loadHideCols() {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get([COLS_KEY], (r) => resolve({ ...COLS_DEFAULT, ...((r && r[COLS_KEY]) || {}) }));
      } catch { resolve({ ...COLS_DEFAULT }); }
    });
  }
  async function saveHideColsFor(key, list) {
    const all = await loadHideCols();
    all[key] = list;
    try {
      chrome.storage.sync.set({ [COLS_KEY]: all }, () => {
        if (chrome.runtime.lastError) toast("Não salvou as colunas: " + chrome.runtime.lastError.message);
      });
    } catch (e) { toast("Não salvou as colunas"); }
  }
  // Um pedido só à grade: esconder + juntar + código + ordem + largura + badges
  function layoutFor(key, hide) {
    return { hide: hide || [], ...(GRID_LAYOUT[key] || {}) };
  }
  async function applyHiddenCols() {
    if (!settings.enabled) return;
    await loadPageMap();
    await rememberPageKey();
    const key = pageKey();
    const list = (await loadHideCols())[key] || [];
    // Tenta logo e repete em intervalos curtos até o APEX criar a grade (ativa também os badges de Status)
    for (let i = 0; i < 40; i++) {
      if (document.querySelector(".a-IG")) {
        const r = await bridge("grid-layout", layoutFor(key, list));
        if (r.ok && (r.res || []).length) return;
      }
      await sleep(100);
    }
  }

  // ===== Grade pronta: só então aparece (sem mostrar as colunas trocando) =====
  function gridReady() { document.documentElement.classList.add("css-grid-ready"); }
  setTimeout(gridReady, 5000); // segurança: nunca deixa a grade escondida
  // Espera a grade parar de mudar: nenhuma busca no servidor em andamento e
  // a quantidade de linhas igual em 3 leituras seguidas.
  async function waitGridSettled(maxMs) {
    const t0 = Date.now();
    let last = -1, same = 0;
    while (Date.now() - t0 < (maxMs || 4000)) {
      const r = await bridge("grid-busy");
      const n = document.querySelectorAll(".a-IG .a-GV-bdy tr[data-id]").length;
      if (!r.busy && n === last) { if (++same >= 2) return; } else same = 0;
      last = n;
      await sleep(80);
    }
  }
  let prepRunning = false;
  async function prepGrids() {
    if (prepRunning) return;
    prepRunning = true;
    const initial = new Set(document.querySelectorAll(".a-IG"));
    try {
      let found = false;
      for (let i = 0; i < 25; i++) { // até ~3s esperando a grade existir
        if (document.querySelector(".a-IG")) { found = true; break; }
        await sleep(120);
      }
      if (!found) return;
      await applyHiddenCols();
      if (settings.rows1000) await applyRowsMax();
      else if (settings.fitGrids) await bridge("fit-grids");
      await waitGridSettled(4000);
      if (settings.fitGrids) await bridge("fill-height");
      // Marca só as grades que já existiam quando este ciclo começou.
      initial.forEach((ig) => { ig.dataset.csPrep = "1"; });
    } finally {
      prepRunning = false;
      // Grade nova que apareceu durante o ciclo (modal, dynamic action).
      if (document.querySelector(".a-IG:not([data-cs-prep])")) setTimeout(schedulePrepNewGrids, 400);
    }
  }

  // Grades criadas depois da carga (modais/dynamic actions) também recebem
  // 1000 linhas e o layout da tela.
  let gridPrepTimer = null;
  function schedulePrepNewGrids() {
    if (!settings.enabled || prepRunning) return;
    if (!document.querySelector(".a-IG:not([data-cs-prep])")) return;
    clearTimeout(gridPrepTimer);
    gridPrepTimer = setTimeout(() => {
      if (!settings.enabled || prepRunning) return;
      if (document.querySelector(".a-IG:not([data-cs-prep])")) prepGrids().catch(() => {});
    }, 300);
  }

  // Botão "Colunas" na barra de cada grade: marcar o que aparece
  function addColsButtons() {
    if (!settings.enabled) return;
    document.querySelectorAll(".a-IG .a-Toolbar").forEach((tb) => {
      if (tb.querySelector(".css-cols-btn") || tb.closest("#css-dash")) return;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "a-Button css-cols-btn";
      b.innerHTML = `${ICONS.columns}<span>Colunas</span>`;
      b.title = "Escolher colunas visíveis (CS Simples)";
      b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); openColsPanel(b); });
      const group = tb.querySelector(".a-Toolbar-group") || tb;
      group.appendChild(b);
    });
  }
  async function openColsPanel(anchor) {
    document.querySelectorAll(".css-cols-pop").forEach((p) => p.remove());
    const r = await bridge("grid-cols");
    const igEl = anchor.closest(".a-IG");
    const grid = (r.grids || []).find((g) => g.id === igEl.id) || (r.grids || [])[0];
    if (!grid) { toast("Não consegui ler as colunas"); return; }
    await loadPageMap();
    await rememberPageKey();
    const key = pageKey();
    const all = await loadHideCols();
    const ck = (t) => norm(t).replace(/[\s.]+/g, "");
    const hidden = new Set((all[key] || []).map(ck));
    const pop = document.createElement("div");
    pop.className = "css-cols-pop";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", "Colunas visíveis");
    pop.innerHTML = `<div class="css-cols-h"><b>Colunas visíveis</b><button type="button" class="css-cols-x" aria-label="Fechar" title="Fechar">${ICONS.close}</button></div>
      <div class="css-cols-list">${grid.cols.filter((c) => !c.hidden || c.mine || hidden.has(ck(c.heading))).map((c) => `
        <label><input type="checkbox" data-h="${esc(c.heading)}" ${hidden.has(ck(c.heading)) ? "" : "checked"}> ${esc(c.heading)}</label>`).join("")}</div>
      <div class="css-cols-f"><button type="button" class="css-cols-all">Mostrar todas</button></div>`;
    document.body.appendChild(pop);
    const close = () => {
      pop.remove();
      try { anchor.focus(); } catch { /* ignore */ }
    };
    const rc = anchor.getBoundingClientRect();
    pop.style.top = Math.round(rc.bottom + 6) + "px";
    pop.style.left = Math.round(Math.min(rc.left, window.innerWidth - 280)) + "px";
    const apply = async () => {
      const list = Array.from(pop.querySelectorAll("input:not(:checked)")).map((i) => i.dataset.h);
      await saveHideColsFor(key, list);
      await bridge("grid-layout", layoutFor(key, list));
    };
    pop.addEventListener("change", apply);
    pop.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } });
    pop.querySelector(".css-cols-all").addEventListener("click", () => { pop.querySelectorAll("input").forEach((i) => { i.checked = true; }); apply(); });
    pop.querySelector(".css-cols-x").addEventListener("click", close);
    setTimeout(() => { const first = pop.querySelector("input"); if (first) first.focus(); }, 0);
    setTimeout(() => document.addEventListener("mousedown", function off(e) {
      if (!pop.contains(e.target) && e.target !== anchor) { pop.remove(); document.removeEventListener("mousedown", off); }
    }), 0);
  }

  let fitTimer = null;
  function scheduleFitGrids(delay) {
    if (!settings.enabled || !settings.fitGrids || settings.rows1000) return;
    clearTimeout(fitTimer);
    fitTimer = setTimeout(async () => {
      if (!document.querySelector(".a-IG")) return;
      const r1 = await bridge("fit-grids");
      // segunda passada: depois de redesenhar, corrige pela altura real
      if (r1.ok && (r1.grids || []).some((g) => g.to !== g.from)) setTimeout(() => bridge("fit-grids"), 700);
    }, delay == null ? 400 : delay);
  }
  // Grades de altura fixa: esticar até o rodapé (na carga e ao redimensionar)
  let fillTimer = null;
  function scheduleFillHeight(delay) {
    if (!settings.enabled || !settings.fitGrids) return;
    clearTimeout(fillTimer);
    fillTimer = setTimeout(() => { if (document.querySelector(".a-IG")) bridge("fill-height"); }, delay);
  }
  window.addEventListener("resize", () => { scheduleFitGrids(400); scheduleFillHeight(250); });

  async function afterLoad() {
    if (!settings.enabled) { gridReady(); return; }
    if (isLoginPage()) { gridReady(); prepLoginGef(); return; }
    prepGrids().catch(() => {}).then(gridReady);
    if (!settings.rows1000) scheduleFitGrids(2500); // 2ª passada pela altura real

    let pilotStarted = false;
    if (pilotShouldResume()) {
      pilotStarted = true;
      setTimeout(() => runPilot(true), 1200);
    } else if (settings.autoPilot) {
      const g = gefAtual();
      if (g && g !== GEF_ALVO.value) {
        // A tela tem o seletor de GEF e não está na 1.3.1: troca já
        // (no máximo 1 tentativa a cada 20s, contra loop)
        const last = +ss("csGefTry") || 0;
        if (Date.now() - last > 20000) {
          ss("csGefTry", String(Date.now()));
          pilotStarted = true;
          setTimeout(() => runGefOnly(), 600);
        }
      } else if (!g && justLoggedIn() && !ss("csPilotDone")) {
        // Recém-logado numa tela sem seletor de GEF: vai até a Manutenção Automotiva
        pilotStarted = true;
        setTimeout(() => runPilot(false), 2000);
      } else if (g === GEF_ALVO.value) {
        ss("csPilotDone", "1");
      }
    }

    if (!pilotStarted) idle(() => recordVisit(), { timeout: 3000 });

    if (getAct() && !pilotStarted) {
      runAction(getAct().label);
      return;
    }
    if (!pilotStarted && getGo()) {
      await sleep(300);
      if (await continueGo()) return;
    }
    if (!pilotStarted && settings.dashboard) {
      await sleep(400);
      if (await isHomePage()) openDashboard(false);
    }
  }

  // ===== Aviso de versão nova =====
  // O motor (background.js) compara a versão ativa com o version.json do
  // repositório público (no máximo a cada 6 h) e diz o que dá para fazer:
  //   - código novo e "Permitir scripts de usuário" ligado: botão Atualizar
  //     (1 clique, o motor baixa e a página recarrega);
  //   - opção desligada: botão que abre a página da extensão para ligar;
  //   - motor novo (manifest/popup/O.S.): pede o ATUALIZAR-CS-SIMPLES.bat;
  //   - .bat já rodou (disco mais novo): botão Aplicar recarrega a extensão.
  function versaoMaior(a, b) {
    const pa = String(a || "0").split(".").map(Number), pb = String(b || "0").split(".").map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d) return d > 0;
    }
    return false;
  }
  function avisoAtualizacao(texto, botao, acao) {
    document.getElementById("css-update")?.remove();
    const el = document.createElement("div");
    el.id = "css-update";
    el.setAttribute("role", "status");
    el.innerHTML = `<span></span><button type="button" class="css-update-go"></button><button type="button" class="css-update-x" aria-label="Fechar aviso">✕</button>`;
    el.querySelector("span").textContent = texto;
    const go = el.querySelector(".css-update-go");
    if (botao) { go.textContent = botao; go.addEventListener("click", () => acao(go)); } else go.remove();
    el.querySelector(".css-update-x").addEventListener("click", () => el.remove());
    document.body.appendChild(el);
  }
  function pedirMotor(msg) {
    return new Promise((r) => {
      try {
        chrome.runtime.sendMessage(msg, (x) => { void chrome.runtime.lastError; r(x || {}); });
      } catch { r({}); }
    });
  }
  async function verificarAtualizacao() {
    if (!extAlive() || window !== window.top) return;
    const st = await pedirMotor({ type: "css-update-state" });
    if (!st.motor) return;
    if (st.disco && versaoMaior(st.disco, st.motor)) {
      avisoAtualizacao(`CS Simples ${st.disco} já foi baixado.`, "Aplicar atualização", () => {
        pedirMotor({ type: "css-reload" });
        setTimeout(() => location.reload(), 900);
      });
      return;
    }
    if (!st.remota || !versaoMaior(st.remota, st.ativa)) return;
    if (versaoMaior(st.engine, st.motor)) {
      avisoAtualizacao(`Nova versão do CS Simples (${st.remota}) precisa ser instalada: rode "ATUALIZAR-CS-SIMPLES" na pasta C:\\CS-Simples.`);
      return;
    }
    if (!st.userScripts) {
      avisoAtualizacao(`Nova versão do CS Simples (${st.remota}). Para atualizar com 1 clique, ligue "Permitir scripts de usuário" na página da extensão (só uma vez).`,
        "Abrir configuração", () => pedirMotor({ type: "css-open-ext" }));
      return;
    }
    avisoAtualizacao(`Nova versão do CS Simples (${st.remota}).`, "Atualizar", async (btn) => {
      btn.disabled = true;
      btn.textContent = "Atualizando…";
      const r = await pedirMotor({ type: "css-update-apply" });
      if (r.ok) { location.reload(); return; }
      btn.disabled = false;
      btn.textContent = "Tentar de novo";
      toast("Não consegui atualizar agora" + (r.err ? ": " + r.err : ""));
    });
  }

  function init() {
    setTimeout(() => verificarAtualizacao(), 3000);
    try {
      chrome.storage.sync.get([KEY], (res) => {
        if (res && res[KEY]) settings = { ...DEFAULTS, ...res[KEY] };
        loadShortcuts().then(() => {
          applySettings();
          refreshAll();
          observe();
          afterLoad();
        });
      });
    } catch {
      gridReady();
      applySettings();
      refreshAll();
      observe();
    }
  }

  const fresh = (c) => c && c.newValue && Date.now() - c.newValue < 5000;

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (changes[SC_KEY]) {
      shortcuts = migrate(changes[SC_KEY].newValue);
      updateSaveFab();
      updateCtaStars();
      if (document.getElementById("css-dash") && !document.querySelector("#css-dash .css-rename")) { renderShortcuts(); renderPicker(); }
    }
    if (changes.cssGoNow || changes.cssGefNow || changes.cssDiagReq || changes.cssDashNow) {
      if (document.visibilityState !== "visible") return; // só a aba visível executa
      if (fresh(changes.cssGoNow)) { ss("csPilotDone", null); runPilot(true); return; }
      if (fresh(changes.cssGefNow)) { runGefOnly(); return; }
      if (fresh(changes.cssDiagReq)) { runDiag(); return; }
      if (fresh(changes.cssDashNow)) { openDashboard(true); return; }
      return;
    }
    if (changes[KEY]) {
      const old = settings;
      settings = { ...DEFAULTS, ...changes[KEY].newValue };
      if (old.enabled !== settings.enabled) { location.reload(); return; }
      const gridChanged = old.rows1000 !== settings.rows1000 || old.fitGrids !== settings.fitGrids;
      if (old.exportBar !== settings.exportBar) {
        if (!settings.exportBar) {
          document.querySelectorAll(".cs-export-bar").forEach((b) => b.remove());
          document.querySelectorAll(".cs-table-wrap tbody tr, .a-IG .a-GV-bdy tr.a-GV-row").forEach((tr) => { tr.style.display = ""; });
        }
        document.querySelectorAll("table[data-cs-done]").forEach((t) => delete t.dataset.csDone);
        document.querySelectorAll(".a-IG[data-cs-bar-done]").forEach((ig) => delete ig.dataset.csBarDone);
      }
      applySettings();
      refreshAll();
      if (gridChanged) {
        if (old.rows1000 && !settings.rows1000) toast("Recarregue para voltar ao número original de linhas");
        prepGrids().catch(() => {});
      }
    }
  });

  // Comandos do popup via mensagem direta (não usam storage.sync, então não
  // vazam para outra aba/dispositivo e não dependem de visibilityState).
  const COMMANDS = {
    cssDashNow: () => openDashboard(true),
    cssGefNow: () => runGefOnly(),
    cssGoNow: () => { ss("csPilotDone", null); runPilot(true); },
    cssDiagReq: () => runDiag()
  };
  try {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (!msg || msg.type !== "cs-command") return;
      const fn = COMMANDS[msg.name];
      if (!fn) { sendResponse({ ok: false, err: "comando desconhecido" }); return; }
      try { fn(); sendResponse({ ok: true }); }
      catch (e) { sendResponse({ ok: false, err: String((e && e.message) || e) }); }
    });
  } catch { /* extensão recarregada: sem comandos até dar F5 */ }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
