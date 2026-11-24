/* CS Simples - page-bridge.js
   Roda no "mundo" da página (world: MAIN) para ter acesso ao objeto apex.
   O content.js (mundo isolado) não enxerga o apex, então pede por evento:

     cs-simples:req  { id, type, payload }  ->  cs-simples:res { id, ...resultado }

   Tipos:
     set-filial  troca a GEF com apex.item().setValue() (dispara a ação
                 dinâmica do próprio sistema: salva e recarrega)
     env         APP_ID, APP_PAGE_ID, APP_USER e a GEF atual (valor + texto)
     nav         itens do menu lateral (Navegação) com rótulo, link e caminho
*/
(() => {
  const FILIAL = "FILTRO_FILIAL";

  function setFilial(req) {
    if (!window.apex || !apex.item) return { ok: false, err: "apex indisponível" };
    if (!document.getElementById(FILIAL)) return { ok: false, err: "campo " + FILIAL + " não está nesta tela" };
    const it = apex.item(FILIAL);
    if (it.getValue() === req.value) return { ok: true, already: true };
    it.setValue(req.value, req.display);
    return { ok: true };
  }

  function env() {
    const e = (window.apex && apex.env) || {};
    let gef = null, gefTxt = null;
    try {
      if (document.getElementById(FILIAL)) {
        const it = apex.item(FILIAL);
        gef = it.getValue();
        gefTxt = it.displayValueFor ? it.displayValueFor(gef) : null;
      }
    } catch { /* ignore */ }
    if (!gefTxt) {
      const disp = document.getElementById(FILIAL);
      gefTxt = disp ? (disp.value || disp.textContent || "").trim() : null;
    }
    return {
      ok: true,
      appId: String(e.APP_ID || ""),
      pageId: String(e.APP_PAGE_ID || ""),
      user: String(e.APP_USER || ""),
      session: String(e.APP_SESSION || ""),
      gef, gefTxt
    };
  }

  // Lê o menu lateral pelo adaptador do treeView (pega também os itens de
  // pastas fechadas, que não existem no DOM). Se não der, raspa o DOM.
  function nav() {
    const out = [];
    const seen = new Set();
    const push = (label, link, path, kids) => {
      label = (label || "").replace(/\s+/g, " ").trim();
      if (!label || !link || /^javascript:/i.test(link) || link === "#") return;
      const key = link.split("&session=")[0].split("?session=")[0] + "|" + label;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ label, link, path, kids: !!kids });
    };
    try {
      const $ = window.apex && apex.jQuery;
      const $t = $ && $("#t_TreeNav");
      if ($t && $t.length && $t.treeView) {
        const a = $t.treeView("getNodeAdapter");
        const walk = (n, path, depth) => {
          if (depth > 6) return;
          const cnt = a.childCount(n) || 0;
          for (let i = 0; i < cnt; i++) {
            const ch = a.child(n, i);
            if (!ch) continue;
            const label = a.getLabel(ch);
            const kids = a.childCount(ch) || 0;
            push(label, ch.link || (a.getLink && a.getLink(ch)) || "", path, kids);
            if (kids) walk(ch, path.concat(label), depth + 1);
          }
        };
        walk(a.root(), [], 0);
      }
    } catch { /* cai no DOM */ }
    if (!out.length) {
      document.querySelectorAll("#t_TreeNav a[href], .t-TreeNav a[href]").forEach((el) => {
        const path = [];
        let li = el.closest("li");
        while (li && (li = li.parentElement && li.parentElement.closest("li"))) {
          const lab = li.querySelector(":scope > div a, :scope > a, :scope > span");
          if (lab) path.unshift((lab.textContent || "").trim());
        }
        const li0 = el.closest("li");
        push(el.textContent, el.getAttribute("href"), path, li0 && li0.querySelector("ul li"));
      });
    }
    return { ok: true, items: out };
  }

  // Grades interativas com paginação: mostra quantas linhas couberem na tela
  // (antes ficavam 15 linhas e sobrava espaço vazio). Só muda a exibição,
  // não salva nada no relatório do sistema.
  function fitGrids() {
    const out = [];
    if (!window.apex || !apex.jQuery) return { ok: false, err: "apex indisponível" };
    document.querySelectorAll(".a-IG").forEach((igEl) => {
      try {
        const ig = apex.jQuery(igEl);
        if (!ig.interactiveGrid) return;
        const v = ig.interactiveGrid("getViews", "grid");
        if (!v || !v.view$ || ig.interactiveGrid("getCurrentViewId") !== "grid") return;
        const g = v.view$;
        if (g.grid("option", "hasSize")) return; // altura fixa: a própria grade rola
        const pag = g.grid("option", "pagination") || {};
        if (pag.scroll) return;
        const tbl = igEl.querySelector(".a-GV-w-scroll table") || igEl;
        const rows = tbl.querySelectorAll("tr.a-GV-row");
        if (rows.length < 2) return;
        const first = rows[0].getBoundingClientRect();
        const last = rows[rows.length - 1].getBoundingClientRect();
        const rh = (last.bottom - first.top) / rows.length;
        if (!rh) return;
        const cur = g.grid("option", "rowsPerPage") || rows.length;
        if (!igEl.dataset.cssRpp) igEl.dataset.cssRpp = String(cur); // valor original
        const orig = +igEl.dataset.cssRpp;
        const footer = document.querySelector(".t-Footer");
        const footerH = footer ? footer.getBoundingClientRect().height : 0;
        const free = window.innerHeight - igEl.getBoundingClientRect().bottom - footerH - 24;
        let n = Math.floor(cur + free / rh);
        n = Math.max(Math.min(orig, 15), Math.min(n, 200));
        if (n !== cur) g.grid("option", "rowsPerPage", n);
        out.push({ id: igEl.id, from: cur, to: n });
      } catch (e) { out.push({ id: igEl.id, err: String(e && e.message || e) }); }
    });
    return { ok: true, grids: out };
  }

  // "Ações › Formato › Linhas por Página" = N (o mesmo que escolher no menu).
  // Usa a ação oficial da grade; se o sistema não oferecer N, usa o maior valor.
  function rowsMax(req) {
    const want = +(req && req.rows) || 1000;
    const out = [];
    if (!window.apex || !apex.jQuery) return { ok: false, err: "apex indisponível" };
    document.querySelectorAll(".a-IG").forEach((igEl) => {
      try {
        const ig = apex.jQuery(igEl);
        if (!ig.interactiveGrid) return;
        const acts = ig.interactiveGrid("getActions");
        const a = acts && acts.lookup("change-rows-per-page");
        if (!a || a.disabled) { out.push({ id: igEl.id, skip: "sem ação" }); return; }
        const nums = (a.choices || []).map((c) => +c.value).filter((x) => x > 0);
        // Nunca salta para a maior opção (ex.: 5000). Usa a maior que caiba
        // no limite pedido; se não houver nenhuma, deixa a grade como está.
        const le = nums.filter((x) => x <= want);
        if (!le.length) { out.push({ id: igEl.id, skip: "sem opção <= " + want }); return; }
        const target = Math.max(...le);
        const cur = acts.get("change-rows-per-page");
        if (+cur !== target) acts.set("change-rows-per-page", target);
        out.push({ id: igEl.id, from: cur, to: target });
      } catch (e) { out.push({ id: igEl.id, err: String(e && e.message || e) }); }
    });
    return { ok: true, grids: out, found: document.querySelectorAll(".a-IG").length };
  }

  // ---- Colunas das grades ----
  // compara títulos ignorando acentos, espaços e pontos ("Tipo de O. S." = "Tipo de O.S.")
  const fold = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\s.]+/g, "").toLowerCase();
  function gridViews() {
    const out = [];
    document.querySelectorAll(".a-IG").forEach((igEl) => {
      try {
        const ig = apex.jQuery(igEl);
        if (!ig.interactiveGrid) return;
        const v = ig.interactiveGrid("getViews", "grid");
        if (v && v.view$) out.push({ igEl, g: v.view$, model: v.model });
      } catch { /* ignore */ }
    });
    return out;
  }
  const headCache = new WeakMap();
  function colHeading(c) {
    const h = c.heading || c.label || "";
    if (!/[<&]/.test(h)) return h.replace(/\s+/g, " ").trim();
    let t = headCache.get(c);
    if (t == null || c._cssH !== h) {
      // DOMParser não executa scripts (innerHTML no MAIN world poderia).
      const doc = new DOMParser().parseFromString(h, "text/html");
      t = ((doc.body && doc.body.textContent) || "").replace(/\s+/g, " ").trim();
      headCache.set(c, t);
      c._cssH = h;
    }
    return t;
  }
  function gridCols() {
    return {
      ok: true,
      grids: gridViews().map(({ igEl, g }) => ({
        id: igEl.id,
        cols: (g.grid("getColumns") || [])
          .filter((c) => colHeading(c) && !c.noHeading)
          .map((c) => ({ heading: colHeading(c), hidden: !!c.hidden, mine: (igEl.dataset.cssHidden || "").split("|").includes(fold(colHeading(c))) }))
      }))
    };
  }

  // Verifica se a coluna já tem valor real em alguma linha (ignora "-").
  function columnHasData(igEl, title) {
    const idx = headerIndex(igEl, title);
    if (idx < 0) return false;
    const rows = igEl.querySelectorAll(".a-GV-bdy tr[data-id]");
    for (const tr of rows) {
      const td = tr.children[idx];
      const txt = td && td.textContent.trim();
      if (txt && txt !== "-") return true;
    }
    return false;
  }

  // A coluna "Código" é a Urgência reaproveitada: o código só é escrito na
  // tela. O filtro do cabeçalho roda no servidor e procurava o texto na
  // urgência (HTML do badge), então nunca achava nada. Manda o filtro dessa
  // coluna para a coluna de origem (Equipamento, "757 - JOHN DEERE...") e
  // tira a lista de sugestões com HTML.
  function redirecionarFiltro(igEl, ves, src) {
    try {
      const ig = apex.jQuery(igEl);
      const cfgCol = (ig.interactiveGrid("option", "config").columns || [])
        .find((c) => c.id === ves.id || c.name === ves.property);
      if (cfgCol && cfgCol.filter) cfgCol.filter.hasLov = false;
      const inst = ig.interactiveGrid("instance");
      if (!inst || inst.__cssFiltro) return;
      const original = inst.addFilter;
      inst.addFilter = function (f, ...resto) {
        if (f && f.type === "column" && String(f.columnId) === String(ves.id)) {
          const txt = String(f.value == null ? "" : f.value).replace(/<[^>]*>/g, "").trim();
          // Código sozinho (757, FLQ0F82): "começa com '757 - '" acha só esse
          // equipamento, não o 2757. Texto com espaço continua "contém".
          f = /^[\w.\/]+$/.test(txt)
            ? { ...f, columnId: src.id, operator: "S", value: txt + " - ", isCaseSensitive: false }
            : { ...f, columnId: src.id, operator: "C", value: txt, isCaseSensitive: false };
        }
        return original.call(this, f, ...resto);
      };
      inst.__cssFiltro = true;
    } catch { /* ignore: filtro fica como o APEX fizer */ }
  }

  // Layout da grade num passo só: esconder, juntar, código, ordem e largura.
  // Antes eram 5 chamadas e cada uma redesenhava as 1000 linhas; agora só
  // as propriedades das colunas mudam e a grade é redesenhada UMA vez.
  //   req = { hide:[títulos], merges:[{into,from,title}], split:{source,vessel,title,width},
  //           order:[títulos], stretch:"título" }
  function gridLayout(req) {
    const out = [];
    const hide = new Set((req.hide || []).map(fold));
    gridViews().forEach(({ igEl, g, model }) => {
      try {
        const cols = g.grid("getColumns") || [];
        const by = (t) => cols.find((c) => fold(colHeading(c)) === fold(t));
        const mine = new Set((igEl.dataset.cssHidden || "").split("|").filter(Boolean));
        let changed = false;
        const set = (c, k, v) => { if (c[k] !== v) { c[k] = v; changed = true; } };

        // 1) esconder / reexibir (só o que a extensão escondeu)
        cols.forEach((c) => {
          const h = fold(colHeading(c));
          if (!h) return;
          if (hide.has(h) && !c.hidden) { set(c, "hidden", true); mine.add(h); }
          else if (!hide.has(h) && c.hidden && mine.has(h)) { set(c, "hidden", false); mine.delete(h); }
        });
        igEl.dataset.cssHidden = Array.from(mine).join("|");

        // 2) juntar colunas
        const fill = { merges: [], split: null };
        (req.merges || []).forEach((mg) => {
          const into = by(mg.into) || by(mg.title);
          const from = by(mg.from);
          if (!into || !from) return;
          // Só esconde a origem quando o chamador confirmou que o merge é seguro.
          if (mg.hideFrom !== false) set(from, "hidden", true);
          if (mg.title) { set(into, "heading", mg.title); set(into, "label", mg.title); }
          fill.merges.push({ into: mg.title || mg.into, fromProp: from.property, fromTitle: mg.from });
        });

        // 3) coluna "Código" reaproveitando uma coluna escondida
        const sp = req.split;
        if (sp) {
          const src = by(sp.source);
          const ves = by(sp.title) || by(sp.vessel);
          // Já aplicamos esse split nesta grade? Então pode continuar mesmo
          // que a coluna "Código" já tenha os códigos preenchidos.
          const already = igEl.dataset.cssSplit === sp.title;
          // Se a coluna que seria reaproveitada já tem dado real, não mexe.
          const hasData = columnHasData(igEl, sp.vessel) || (by(sp.title) ? columnHasData(igEl, sp.title) : false);
          if (src && ves && (already || !hasData)) {
            set(ves, "heading", sp.title); set(ves, "label", sp.title);
            set(ves, "width", sp.width || 80); set(ves, "hidden", false);
            ves.noStretch = true; ves.canSort = false;
            fill.split = { source: sp.source, title: sp.title };
            igEl.dataset.cssSplit = sp.title;
            redirecionarFiltro(igEl, ves, src);
          }
        }

        // 4) ordem
        if (req.order && req.order.length) {
          const order = req.order.map(fold);
          cols.forEach((c) => {
            const i = order.indexOf(fold(colHeading(c)));
            set(c, "seq", i >= 0 ? 100 + i : (c.seq < 100 ? c.seq : 500 + (c.seq || 0)));
          });
          cols.sort((a, b) => (a.seq || 0) - (b.seq || 0));
        }

        // 5) só uma coluna estica; títulos longos ganham largura
        if (req.stretch) {
          cols.forEach((c) => {
            if (c.hidden) return;
            const h = colHeading(c);
            const st = fold(h) === fold(req.stretch);
            set(c, "noStretch", !st);
            if (!st && h && c.width && c.width < h.length * 7.6 + 34) set(c, "width", Math.round(h.length * 7.6 + 34));
          });
        }

        if (changed) { g.grid("refreshColumns"); g.grid("refresh"); }
        igEl._cssFill = (fill.merges.length || fill.split) ? fill : null;
        watchRows(igEl, model);
        out.push({ id: igEl.id, changed });
      } catch (e) { out.push({ id: igEl.id, err: String(e && e.message || e) }); }
    });
    return { ok: true, res: out };
  }

  // Classifica texto de Status / Situação / Criticidade em variante de badge
  function badgeKind(raw) {
    const v = fold(raw);
    if (!v || v === "-" || v.length > 28) return "";
    if (/^(aberta|aberto)$/.test(v)) return "open";
    if (/encerrad|concluid|finalizad|fechad|aprovad|atendid|realizad|liberado|liberada|quitad|baixad/.test(v)) return "done";
    if (/andamento|execucao|manutencao|iniciad|oficina|emservico|ativo|ativa/.test(v)) return "prog";
    if (/pendente|aguard|planejad|programad|analise|parcial|media|medio|atrasad|bloquead/.test(v)) return "warn";
    if (/cancelad|rejeitad|reprovad|inativ|excluid|alta|critica|critico|emergenc|urgente/.test(v)) return "cancel";
    if (/^(baixa|baixo|normal|rotina)$/.test(v)) return "neutral";
    return "";
  }

  // Preenche só as linhas NOVAS (o observador olha só as <tr> que entram no
  // corpo da grade, não a página toda) e marca a linha como feita.
  function headerIndex(igEl, title) {
    const ths = igEl.querySelectorAll(".a-GV-w-hdr th");
    const f = fold(title);
    for (let i = 0; i < ths.length; i++) if (fold(ths[i].textContent) === f) return i;
    return -1;
  }
  function fillRows(igEl, model, rows) {
    if (!rows.length) return;
    const fl = igEl._cssFill;
    const mIdx = fl ? fl.merges.map((m) => headerIndex(igEl, m.into)) : [];
    const sIdx = fl && fl.split ? headerIndex(igEl, fl.split.source) : -1;
    const cIdx = fl && fl.split ? headerIndex(igEl, fl.split.title) : -1;
    const ths = Array.from(igEl.querySelectorAll(".a-GV-w-hdr th"));
    const statusCols = [];
    const numCols = [];
    ths.forEach((th, idx) => {
      const f = fold(th.textContent);
      if (/^(status|situacao|criticidade|urgencia|prioridade|estado|fase)$/.test(f)) statusCols.push(idx);
      else if (/^(ano|numero|os|numos|codigo|cod|data|dt|valor|qtd|quantidade|total|horimetro|hodometro|km|horas)/.test(f)) numCols.push(idx);
    });
    const RE = /^\s*([^\s-][^-]*?)\s+-\s+(.+)$/;
    for (const tr of rows) {
      if (tr.dataset.cssFill === "1") continue;
      const id = tr.getAttribute("data-id");
      if (id == null) continue;
      if (fl && model) {
        let rec = null;
        fl.merges.forEach((m, k) => {
          const td = tr.children[mIdx[k]];
          if (!td) return;
          const txt = td.textContent.trim();
          if (txt && txt !== "-") return;
          rec = rec || model.getRecord(id);
          const val = rec ? String(model.getValue(rec, m.fromProp) || "").trim() : "";
          if (val && val !== "-") { td.textContent = val; td.classList.add("css-merged"); }
        });
        if (sIdx >= 0 && cIdx >= 0) {
          const s = tr.children[sIdx], c = tr.children[cIdx];
          if (s && c) {
            const full = tr.dataset.cssFullEquip || s.textContent.trim();
            const mt = full && full !== "-" ? full.match(RE) : null;
            if (mt) {
              // A coluna já virou "Código": a urgência que vinha nela (badge
              // "Alta"/"Baixa") deixava o código vazio e o equipamento sem dividir.
              tr.dataset.cssFullEquip = full;
              c.textContent = mt[1];
              s.textContent = mt[2];
              s.title = full;
              c.classList.add("css-code");
            }
          }
        }
      }
      for (const idx of statusCols) {
        const td = tr.children[idx];
        if (!td || td.childElementCount > 0) continue;
        const txt = td.textContent.trim();
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
      tr.dataset.cssFill = "1";
    }
  }
  // Observa a grade INTEIRA (igEl), não o ".a-GV-bdy": quando o APEX troca
  // linhas por página / redesenha a grade, o ".a-GV-bdy" antigo pode ser
  // descartado e o observador ficava preso num elemento morto — a coluna
  // "Código" aparecia vazia. Preenche direto no callback (sem rAF), antes
  // da pintura, para não piscar o texto original.
  function currentModel(igEl) {
    try {
      const v = apex.jQuery(igEl).interactiveGrid("getViews", "grid");
      if (v && v.model) return v.model;
    } catch { /* ignore */ }
    return igEl._cssModel;
  }
  function watchRows(igEl, model) {
    if (model) igEl._cssModel = model;
    const all = () => fillRows(igEl, currentModel(igEl), igEl.querySelectorAll(".a-GV-bdy tr[data-id]"));
    if (igEl._cssRowsObs) { all(); return; }
    igEl._cssRowsObs = new MutationObserver((recs) => {
      const pending = [];
      for (const r of recs) for (const n of r.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.nodeName === "TR") { if (n.hasAttribute("data-id") && n.closest(".a-GV-bdy")) pending.push(n); }
        else if (n.querySelectorAll) n.querySelectorAll(".a-GV-bdy tr[data-id], tr[data-id]").forEach((t) => { if (t.closest(".a-GV-bdy")) pending.push(t); });
      }
      if (pending.length) fillRows(igEl, currentModel(igEl), pending);
    });
    igEl._cssRowsObs.observe(igEl, { childList: true, subtree: true });
    all();
  }

  // Alguma grade buscando dados no servidor agora? (para só mostrar a grade
  // depois que as 1000 linhas chegaram)
  function gridBusy() {
    let busy = false;
    gridViews().forEach(({ model }) => {
      try {
        const p = model && model._requestsInProgress;
        if (p && Object.keys(p).some((k) => p[k])) busy = true;
      } catch { /* ignore */ }
    });
    return { ok: true, busy };
  }

  // Grades de altura fixa (rolam por dentro, ex.: Vida Equipamento): esticam
  // até o rodapé da tela. Só aumenta, nunca diminui do tamanho original.
  function fillHeight() {
    const out = [];
    const footer = document.querySelector(".t-Footer");
    const fh = footer ? footer.getBoundingClientRect().height : 0;
    gridViews().forEach(({ igEl, g }) => {
      try {
        if (!igEl.offsetParent || !g.grid("option", "hasSize") || igEl.closest(".ui-dialog")) return;
        const h0 = +igEl.dataset.cssH0 || igEl.getBoundingClientRect().height;
        igEl.dataset.cssH0 = String(h0);
        const avail = Math.floor(window.innerHeight - igEl.getBoundingClientRect().top - fh - 36);
        const h = Math.max(h0, avail);
        if (Math.abs(igEl.getBoundingClientRect().height - h) < 4) return;
        igEl.style.height = h + "px";
        apex.jQuery(igEl).interactiveGrid("resize");
        out.push({ id: igEl.id, h });
      } catch (e) { out.push({ id: igEl.id, err: String(e && e.message || e) }); }
    });
    return { ok: true, res: out };
  }

  window.addEventListener("cs-simples:req", (ev) => {
    let req = {};
    let res;
    try {
      req = JSON.parse(ev.detail || "{}");
      if (req.type === "set-filial") res = setFilial(req.payload || {});
      else if (req.type === "env") res = env();
      else if (req.type === "nav") res = nav();
      else if (req.type === "fit-grids") res = fitGrids();
      else if (req.type === "rows-max") res = rowsMax(req.payload || {});
      else if (req.type === "grid-cols") res = gridCols();
      else if (req.type === "grid-layout") res = gridLayout(req.payload || {});
      else if (req.type === "fill-height") res = fillHeight();
      else if (req.type === "grid-busy") res = gridBusy();
      else res = { ok: false, err: "tipo desconhecido" };
    } catch (e) {
      res = { ok: false, err: String((e && e.message) || e) };
    }
    res.id = req.id;
    // Só strings atravessam com segurança entre os dois "mundos"
    window.dispatchEvent(new CustomEvent("cs-simples:res", { detail: JSON.stringify(res) }));
  });
})();
