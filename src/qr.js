import QRCode from "qrcode";

// Gera uma imagem (data URL) de um QR Code real a partir de um texto/URL.
export async function gerarQrDataUrl(texto) {
  return await QRCode.toDataURL(texto, {
    width: 320,
    margin: 1,
    color: { dark: "#1d4ed8", light: "#ffffff" },
  });
}

// Monta o link que o QR do ambiente vai abrir: o próprio site, com o
// ambiente identificado na URL (?ambiente=ID). Ao escanear com a câmera
// do celular, o navegador abre esse link direto — sem precisar de um
// leitor de QR dentro do app.
export function linkDoAmbiente(ambienteId) {
  return `${window.location.origin}${window.location.pathname}?ambiente=${ambienteId}`;
}
