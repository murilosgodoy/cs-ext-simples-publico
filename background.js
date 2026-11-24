/* CS Simples - background.js
   Ajuda o aviso de atualização do content.js:
     css-disk-version  lê o manifest.json da pasta (versão que está no disco)
     css-reload        recarrega a extensão; numa extensão carregada da pasta,
                       isso aplica os arquivos que o ATUALIZAR-CS-SIMPLES baixou */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;
  if (msg.type === "css-reload") {
    chrome.runtime.reload();
    return;
  }
  if (msg.type === "css-disk-version") {
    fetch(chrome.runtime.getURL("manifest.json"), { cache: "no-store" })
      .then((r) => r.json())
      .then((m) => sendResponse({ version: m.version }))
      .catch(() => sendResponse({}));
    return true; // resposta assíncrona
  }
});
