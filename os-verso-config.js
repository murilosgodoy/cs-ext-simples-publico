/* CS Simples - os-verso-config.js
   Mundo isolado, só na janela "Por favor aguarde". Lê as opções da extensão e
   avisa o os-verso.js (mundo da página) por atributos no <html>:
     data-css-os-verso="1|0"        juntar o RG AOO_001 no verso da O.S.
     data-css-os-verso-print="1|0"  abrir a janela de impressão sozinho
*/
(() => {
  const KEY = "cssSettings";
  const html = document.documentElement;
  function aplica(s) {
    s = s || {};
    const on = s.enabled !== false && s.osVerso !== false;
    html.dataset.cssOsVerso = on ? "1" : "0";
    html.dataset.cssOsVersoPrint = s.osVersoPrint === false ? "0" : "1";
  }
  // Começa desligado: se a leitura do storage falhar, nada é mesclado/impresso
  // sem o usuário ter pedido. O valor real chega no callback abaixo.
  html.dataset.cssOsVerso = "0";
  html.dataset.cssOsVersoPrint = "1";
  try {
    chrome.storage.sync.get([KEY], (res) => aplica(res && res[KEY]));
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area === "sync" && ch[KEY]) aplica(ch[KEY].newValue);
    });
  } catch { /* extensão recarregada: fica desligado por segurança */ }
})();
