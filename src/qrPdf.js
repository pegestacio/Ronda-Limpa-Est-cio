import jsPDF from "jspdf";
import { gerarQrDataUrl, linkDoAmbiente } from "./qr";

// Gera um PDF (A4) com o QR Code de todos os ambientes, em grade (2 colunas x
// 3 linhas por página), cada um com nome/código/localização embaixo — pronto
// pra imprimir e recortar de uma vez, em vez de um por um.
export async function gerarPdfTodosQrCodes(ambientes) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 15;
  const pageWidth = 210;
  const pageHeight = 297;
  const cols = 2;
  const rows = 3;
  const cellW = (pageWidth - margin * 2) / cols;
  const cellH = (pageHeight - margin * 2) / rows;
  const qrSize = 55;

  let col = 0;
  let row = 0;

  for (const a of ambientes) {
    if (row >= rows) {
      doc.addPage();
      row = 0;
    }

    const x = margin + col * cellW;
    const y = margin + row * cellH;
    const qrX = x + (cellW - qrSize) / 2;
    const centerX = x + cellW / 2;

    const qrDataUrl = await gerarQrDataUrl(linkDoAmbiente(a.id));
    doc.addImage(qrDataUrl, "PNG", qrX, y, qrSize, qrSize);

    doc.setFont(undefined, "bold");
    doc.setFontSize(12);
    doc.text(a.nome, centerX, y + qrSize + 6, { align: "center" });

    doc.setFont(undefined, "normal");
    doc.setFontSize(9);
    doc.text(a.codigo, centerX, y + qrSize + 11, { align: "center" });
    doc.text(`${a.tipo} · Bloco ${a.bloco} · ${a.andar}º andar`, centerX, y + qrSize + 15.5, { align: "center" });

    col++;
    if (col >= cols) {
      col = 0;
      row++;
    }
  }

  doc.save("qr-codes-ambientes.pdf");
}
