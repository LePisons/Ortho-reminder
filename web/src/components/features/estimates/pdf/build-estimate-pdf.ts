import type { EstimateData } from "@/lib/api/estimates.api";

// Alnix brand palette (must stay hex — jsPDF has no CSS color parsing)
const BRAND_PURPLE = { r: 0xa0, g: 0x66, b: 0xf8 };
const BRAND_BLUE = { r: 0x64, g: 0x69, b: 0xfc };
const INK = { r: 0x1b, g: 0x1b, b: 0x1b };
const MUTED = { r: 0x6b, g: 0x6b, b: 0x6b };
const LINE = { r: 0xeb, g: 0xe7, b: 0xde };
const ROW_TINT = { r: 0xf6, g: 0xf4, b: 0xfe };

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;

export const formatClp = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;

export function computeTotals(data: EstimateData) {
  const numericItems = data.items.filter((i) => typeof i.price === "number");
  const hasConsultar = data.items.some((i) => i.price === "Consultar");
  const subtotal = numericItems.reduce((sum, i) => sum + (i.price as number), 0);
  const discountAmount = data.discount?.amount ?? 0;
  const total = Math.max(0, subtotal - discountAmount);
  const cashTotal = Math.round(total * (1 - data.cashDiscountPct / 100));
  const installments = data.installmentMonths.map((months) => ({
    months,
    amount: Math.round(total / months),
  }));
  return { subtotal, discountAmount, total, cashTotal, installments, hasConsultar };
}

export function estimateFileName(data: EstimateData) {
  const safeName = data.patient.name
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\p{L}\p{N}_-]/gu, "");
  return `Presupuesto_Alnix_${safeName || "Paciente"}_${data.date.slice(0, 10)}.pdf`;
}

export async function buildEstimatePdf(data: EstimateData): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }, fonts] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    import("./fonts"),
  ]);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.addFileToVFS("Montserrat-Regular.ttf", fonts.MONTSERRAT_REGULAR);
  doc.addFont("Montserrat-Regular.ttf", "Montserrat", "normal");
  doc.addFileToVFS("Montserrat-Bold.ttf", fonts.MONTSERRAT_BOLD);
  doc.addFont("Montserrat-Bold.ttf", "Montserrat", "bold");
  doc.setFont("Montserrat", "normal");

  const totals = computeTotals(data);
  const dateLabel = new Date(`${data.date.slice(0, 10)}T12:00:00`).toLocaleDateString(
    "es-CL",
    { day: "numeric", month: "long", year: "numeric" },
  );

  // --- Header: purple→blue gradient band ---
  const bandH = 32;
  const steps = 120;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    doc.setFillColor(
      Math.round(BRAND_PURPLE.r + (BRAND_BLUE.r - BRAND_PURPLE.r) * t),
      Math.round(BRAND_PURPLE.g + (BRAND_BLUE.g - BRAND_PURPLE.g) * t),
      Math.round(BRAND_PURPLE.b + (BRAND_BLUE.b - BRAND_PURPLE.b) * t),
    );
    doc.rect((PAGE_W / steps) * i, 0, PAGE_W / steps + 0.5, bandH, "F");
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("Montserrat", "bold");
  doc.setFontSize(24);
  doc.text("Alnix", MARGIN, 15);
  doc.setFont("Montserrat", "normal");
  doc.setFontSize(9);
  doc.text("Alineadores invisibles", MARGIN, 21.5);

  doc.setFont("Montserrat", "bold");
  doc.setFontSize(14);
  doc.text("PRESUPUESTO", PAGE_W - MARGIN, 14, { align: "right" });
  doc.setFont("Montserrat", "normal");
  doc.setFontSize(9);
  doc.text(dateLabel, PAGE_W - MARGIN, 20, { align: "right" });
  doc.text(`Válido por ${data.validityDays} días`, PAGE_W - MARGIN, 25, {
    align: "right",
  });

  // --- Patient + treatment info ---
  let y = bandH + 12;
  const colW = CONTENT_W / 2;

  const sectionTitle = (title: string, x: number, atY: number, width: number) => {
    doc.setFont("Montserrat", "bold");
    doc.setFontSize(10);
    doc.setTextColor(BRAND_BLUE.r, BRAND_BLUE.g, BRAND_BLUE.b);
    doc.text(title.toUpperCase(), x, atY);
    doc.setDrawColor(LINE.r, LINE.g, LINE.b);
    doc.setLineWidth(0.4);
    doc.line(x, atY + 1.8, x + width, atY + 1.8);
  };

  const field = (label: string, value: string, x: number, atY: number) => {
    doc.setFont("Montserrat", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text(label.toUpperCase(), x, atY);
    doc.setFontSize(10);
    doc.setTextColor(INK.r, INK.g, INK.b);
    doc.text(value, x, atY + 4.6);
  };

  sectionTitle("Datos del paciente", MARGIN, y, colW - 8);
  let fy = y + 8;
  field("Nombre", data.patient.name, MARGIN, fy);
  fy += 11;
  if (data.patient.rut) {
    field("RUT", data.patient.rut, MARGIN, fy);
    fy += 11;
  }
  if (data.patient.phone) {
    field("Teléfono", data.patient.phone, MARGIN, fy);
    fy += 11;
  }
  if (data.patient.email) {
    field("Email", data.patient.email, MARGIN, fy);
    fy += 11;
  }

  const tx = MARGIN + colW + 8;
  const t = data.treatment;
  if (t && (t.durationMonths || t.alignerCount || t.controlsCount)) {
    sectionTitle("Tratamiento", tx, y, colW - 8);
    let ty = y + 8;
    if (t.durationMonths) {
      field("Duración estimada", t.durationMonths, tx, ty);
      ty += 11;
    }
    if (t.alignerCount) {
      field("N° de alineadores", t.alignerCount, tx, ty);
      ty += 11;
    }
    if (t.controlsCount) {
      field("Controles sugeridos", t.controlsCount, tx, ty);
      ty += 11;
    }
    fy = Math.max(fy, ty);
  }

  // --- Items table ---
  autoTable(doc, {
    startY: fy + 4,
    margin: { left: MARGIN, right: MARGIN, bottom: 24 },
    head: [["Prestación", "Detalle", "Valor"]],
    body: data.items.map((item) => [
      item.name,
      item.details ?? "",
      typeof item.price === "number" ? formatClp(item.price) : "Consultar",
    ]),
    styles: {
      font: "Montserrat",
      fontSize: 9,
      textColor: [INK.r, INK.g, INK.b],
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
      lineWidth: 0,
    },
    headStyles: {
      fillColor: [BRAND_BLUE.r, BRAND_BLUE.g, BRAND_BLUE.b],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    alternateRowStyles: { fillColor: [ROW_TINT.r, ROW_TINT.g, ROW_TINT.b] },
    columnStyles: {
      0: { cellWidth: 62, fontStyle: "bold" },
      2: { cellWidth: 32, halign: "right" },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 6;

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_H - 26) {
      doc.addPage();
      y = MARGIN;
    }
  };

  // --- Totals ---
  ensureSpace(30);
  const totalsX = PAGE_W - MARGIN - 70;
  const totalLine = (label: string, value: string, bold = false) => {
    doc.setFont("Montserrat", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 12 : 9.5);
    doc.setTextColor(bold ? INK.r : MUTED.r, bold ? INK.g : MUTED.g, bold ? INK.b : MUTED.b);
    doc.text(label, totalsX, y);
    doc.text(value, PAGE_W - MARGIN, y, { align: "right" });
    y += bold ? 8 : 6;
  };

  if (totals.discountAmount > 0) {
    totalLine("Subtotal", formatClp(totals.subtotal));
    totalLine(
      `Descuento${data.discount?.label ? ` (${data.discount.label})` : ""}`,
      `-${formatClp(totals.discountAmount)}`,
    );
  }
  doc.setDrawColor(BRAND_BLUE.r, BRAND_BLUE.g, BRAND_BLUE.b);
  doc.setLineWidth(0.6);
  doc.line(totalsX, y - 2, PAGE_W - MARGIN, y - 2);
  y += 3;
  totalLine("TOTAL", formatClp(totals.total), true);

  if (totals.hasConsultar) {
    doc.setFont("Montserrat", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text(
      "* Las prestaciones marcadas “Consultar” no están incluidas en el total.",
      MARGIN,
      y,
    );
    y += 5;
  }

  // --- Payment options ---
  const showInstallments = totals.installments.length > 0;
  const boxCount = showInstallments ? 3 : 2;
  const gap = 5;
  const boxW = (CONTENT_W - gap * (boxCount - 1)) / boxCount;
  const boxH = showInstallments
    ? Math.max(30, 20 + totals.installments.length * 5)
    : 30;

  ensureSpace(boxH + 14);
  y += 4;
  doc.setFont("Montserrat", "bold");
  doc.setFontSize(10);
  doc.setTextColor(BRAND_BLUE.r, BRAND_BLUE.g, BRAND_BLUE.b);
  doc.text("OPCIONES DE PAGO", MARGIN, y);
  y += 4;

  const paymentBox = (
    x: number,
    title: string,
    lines: { text: string; bold?: boolean; size?: number }[],
  ) => {
    doc.setFillColor(ROW_TINT.r, ROW_TINT.g, ROW_TINT.b);
    doc.setDrawColor(LINE.r, LINE.g, LINE.b);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, boxW, boxH, 2.5, 2.5, "FD");
    doc.setFont("Montserrat", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(BRAND_PURPLE.r, BRAND_PURPLE.g, BRAND_PURPLE.b);
    doc.text(title, x + 4, y + 6.5);
    let ly = y + 13;
    for (const line of lines) {
      doc.setFont("Montserrat", line.bold ? "bold" : "normal");
      doc.setFontSize(line.size ?? 8);
      doc.setTextColor(
        line.bold ? INK.r : MUTED.r,
        line.bold ? INK.g : MUTED.g,
        line.bold ? INK.b : MUTED.b,
      );
      doc.text(line.text, x + 4, ly);
      ly += line.bold ? 6.5 : 4.8;
    }
  };

  paymentBox(MARGIN, "PAGO AL CONTADO", [
    { text: formatClp(totals.cashTotal), bold: true, size: 13 },
    { text: `Incluye ${data.cashDiscountPct}% de descuento` },
    { text: "Efectivo o transferencia" },
  ]);
  paymentBox(MARGIN + boxW + gap, "TARJETA DE CRÉDITO", [
    { text: formatClp(totals.total), bold: true, size: 13 },
    { text: "Cuotas según su banco" },
  ]);
  if (showInstallments) {
    paymentBox(MARGIN + (boxW + gap) * 2, "PAGO EN CUOTAS", [
      ...totals.installments.map((inst) => ({
        text: `${inst.months} cuotas de ${formatClp(inst.amount)}`,
      })),
      { text: "Directo con la clínica" },
    ]);
  }
  y += boxH + 10;

  // --- Notes ---
  const notes: string[] = [
    `Presupuesto válido por ${data.validityDays} días desde su fecha de emisión.`,
    "Los controles clínicos no están incluidos, salvo que se indiquen como prestación.",
    "Alineadores con defectos de fabricación se reponen sin costo.",
  ];
  if (data.notes?.trim()) notes.push(data.notes.trim());

  const noteLines = notes.flatMap((n) => doc.splitTextToSize(`•  ${n}`, CONTENT_W));
  ensureSpace(noteLines.length * 4 + 12);
  doc.setFont("Montserrat", "bold");
  doc.setFontSize(9);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text("Consideraciones", MARGIN, y);
  y += 5;
  doc.setFont("Montserrat", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text(noteLines, MARGIN, y);

  // --- Footer on every page ---
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setDrawColor(LINE.r, LINE.g, LINE.b);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, PAGE_H - 16, PAGE_W - MARGIN, PAGE_H - 16);
    doc.setFont("Montserrat", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text("Alnix Alineadores  ·  alnixalineadores.cl", MARGIN, PAGE_H - 11);
    doc.text(`Página ${p} de ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 11, {
      align: "right",
    });
  }

  return doc.output("blob");
}
