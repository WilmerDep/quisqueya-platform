import { jsPDF } from 'jspdf';

export type PlatformPdfPaperSize = 'A4' | 'Carta' | 'Oficio';
export type PlatformPdfOrientation = 'Vertical' | 'Horizontal';
export type PlatformPdfMarginPreset = 'Compacto' | 'Normal' | 'Amplio';
export type PlatformPdfVisualPreset = 'CORPORATIVA_CLASICA' | 'FISCAL_ELECTRONICA' | 'FACTURA_FINANCIERA';
export type PlatformPdfRgb = [number, number, number];

export interface PlatformPdfTemplateConfig {
  visualPreset: PlatformPdfVisualPreset;
  paperSize: PlatformPdfPaperSize;
  orientation: PlatformPdfOrientation;
  marginPreset: PlatformPdfMarginPreset;
  documentStyle: 'Reporte premium' | 'Recibo de pago';
}

export const platformPdfMarginByPreset: Record<PlatformPdfMarginPreset, number> = {
  Compacto: 30,
  Normal: 44,
  Amplio: 60,
};

export const platformPdfVisualPresets: Record<
  PlatformPdfVisualPreset,
  PlatformPdfTemplateConfig & {
    label: string;
    description: string;
    accent: [number, number, number];
    accentSoft: [number, number, number];
    neutral: [number, number, number];
  }
> = {
  CORPORATIVA_CLASICA: {
    visualPreset: 'CORPORATIVA_CLASICA',
    label: 'Corporativa clasica',
    description: 'Minimalista, sobria y limpia para facturas o reportes formales.',
    paperSize: 'A4',
    orientation: 'Vertical',
    marginPreset: 'Normal',
    documentStyle: 'Reporte premium',
    accent: [37, 99, 235],
    accentSoft: [239, 246, 255],
    neutral: [15, 23, 42],
  },
  FISCAL_ELECTRONICA: {
    visualPreset: 'FISCAL_ELECTRONICA',
    label: 'Fiscal electronica',
    description: 'Compacta, informativa y centrada en metadata, totales y trazabilidad.',
    paperSize: 'Carta',
    orientation: 'Vertical',
    marginPreset: 'Compacto',
    documentStyle: 'Reporte premium',
    accent: [14, 116, 144],
    accentSoft: [240, 249, 255],
    neutral: [17, 24, 39],
  },
  FACTURA_FINANCIERA: {
    visualPreset: 'FACTURA_FINANCIERA',
    label: 'Financiera ejecutiva',
    description: 'Visual premium con jerarquia tipo factura moderna y bloques institucionales.',
    paperSize: 'Carta',
    orientation: 'Vertical',
    marginPreset: 'Normal',
    documentStyle: 'Reporte premium',
    accent: [29, 78, 216],
    accentSoft: [219, 234, 254],
    neutral: [15, 23, 42],
  },
};

export const resolvePlatformPdfTemplateConfig = (
  config: Partial<PlatformPdfTemplateConfig> = {},
): PlatformPdfTemplateConfig => {
  const preset = platformPdfVisualPresets[config.visualPreset || 'FACTURA_FINANCIERA'];
  return {
    visualPreset: preset.visualPreset,
    paperSize: config.paperSize || preset.paperSize,
    orientation: config.orientation || preset.orientation,
    marginPreset: config.marginPreset || preset.marginPreset,
    documentStyle: config.documentStyle || preset.documentStyle,
  };
};

export const getPlatformPdfVisualPreset = (visualPreset?: PlatformPdfVisualPreset) =>
  platformPdfVisualPresets[visualPreset || 'FACTURA_FINANCIERA'];

export const resolvePlatformPdfFormat = (paperSize: PlatformPdfPaperSize) => {
  if (paperSize === 'Carta') return 'letter';
  if (paperSize === 'Oficio') return 'legal';
  return 'a4';
};

export const resolvePlatformPdfOrientation = (orientation: PlatformPdfOrientation) =>
  orientation === 'Horizontal' ? 'landscape' : 'portrait';

export const createPlatformPdfDoc = ({
  paperSize = 'A4',
  orientation = 'Vertical',
}: {
  paperSize?: PlatformPdfPaperSize;
  orientation?: PlatformPdfOrientation;
}) =>
  new jsPDF({
    unit: 'pt',
    format: resolvePlatformPdfFormat(paperSize),
    orientation: resolvePlatformPdfOrientation(orientation),
  });

export const buildPlatformPdfFileName = (baseName: string) =>
  `${baseName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '') || 'documento'}-${Date.now()}.pdf`;

export const drawPlatformPdfCard = ({
  doc,
  x,
  y,
  width,
  height,
  fill,
  border,
  radius = 18,
}: {
  doc: jsPDF;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: PlatformPdfRgb;
  border: PlatformPdfRgb;
  radius?: number;
}) => {
  doc.setFillColor(fill[0], fill[1], fill[2]);
  doc.setDrawColor(border[0], border[1], border[2]);
  doc.roundedRect(x, y, width, height, radius, radius, 'FD');
};

export const drawPlatformPdfDivider = ({
  doc,
  x1,
  x2,
  y,
  color = [229, 231, 235],
}: {
  doc: jsPDF;
  x1: number;
  x2: number;
  y: number;
  color?: PlatformPdfRgb;
}) => {
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.line(x1, y, x2, y);
};

export const drawPlatformPdfFooter = ({
  doc,
  left,
  right,
  y,
  note,
  presetLabel,
}: {
  doc: jsPDF;
  left: number;
  right: number;
  y: number;
  note: string;
  presetLabel: string;
}) => {
  drawPlatformPdfDivider({ doc, x1: left, x2: right, y: y - 12 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(note, left, y + 4, { maxWidth: (right - left) * 0.66 });
  doc.text(`Plantilla aplicada: ${presetLabel}`, right, y + 4, { align: 'right' });
};

export interface PlatformPdfPartyBlock {
  title: string;
  lines: string[];
}

export interface PlatformPdfLineItem {
  description: string;
  detail?: string;
  quantity?: string;
  unit?: string;
  price?: string;
  tax?: string;
  amount: string;
}

export interface PlatformPdfTotalRow {
  label: string;
  value: string;
  emphasis?: boolean;
}

export interface PlatformPdfDocumentModel {
  documentKind?: 'default' | 'report' | 'statement' | 'history' | 'route';
  title: string;
  subtitle?: string;
  documentNumber?: string;
  issueDate?: string;
  dueDate?: string;
  companyName: string;
  companyLogo?: string;
  companyLines: string[];
  seller?: PlatformPdfPartyBlock;
  buyer?: PlatformPdfPartyBlock;
  shipTo?: PlatformPdfPartyBlock;
  summaryTitle?: string;
  summaryValue?: string;
  summaryMeta?: string[];
  lineItems: PlatformPdfLineItem[];
  tableHeaders?: string[];
  tableRows?: string[][];
  tableColumnWidths?: number[];
  totals: PlatformPdfTotalRow[];
  notesTitle?: string;
  notesLines?: string[];
  footerNote: string;
  presetLabel: string;
}

const drawPdfInitialMark = ({
  doc,
  x,
  y,
  letters,
  preset,
}: {
  doc: jsPDF;
  x: number;
  y: number;
  letters: string;
  preset: ReturnType<typeof getPlatformPdfVisualPreset>;
}) => {
  const [accentR, accentG, accentB] = preset.accent;
  const [softR, softG, softB] = preset.accentSoft;
  doc.setFillColor(softR, softG, softB);
  doc.setDrawColor(accentR, accentG, accentB);
  doc.roundedRect(x, y, 56, 56, 16, 16, 'FD');
  doc.setTextColor(accentR, accentG, accentB);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text(letters, x + 28, y + 36, { align: 'center' });
};

const drawPdfLogoOrMark = ({
  doc,
  x,
  y,
  width,
  height,
  logo,
  letters,
  preset,
}: {
  doc: jsPDF;
  x: number;
  y: number;
  width: number;
  height: number;
  logo?: string;
  letters: string;
  preset: ReturnType<typeof getPlatformPdfVisualPreset>;
}) => {
  if (logo && /^data:image\/[a-zA-Z+]+;base64,/.test(logo)) {
    try {
      const format = (logo.match(/^data:image\/([a-zA-Z+]+);base64,/)?.[1] || 'PNG').toUpperCase();
      doc.addImage(logo, format === 'JPG' ? 'JPEG' : format, x, y, width, height);
      return;
    } catch {
      // fallback controlado
    }
  }

  drawPdfInitialMark({ doc, x, y, letters, preset });
};

export const renderPlatformPdfDocument = ({
  doc,
  preset,
  left,
  top,
  right,
  model,
}: {
  doc: jsPDF;
  preset: ReturnType<typeof getPlatformPdfVisualPreset>;
  left: number;
  top: number;
  right: number;
  model: PlatformPdfDocumentModel;
}) => {
  const width = right - left;
  const pageHeight = doc.internal.pageSize.getHeight();
  const baseTop = top;
  const bottomReserve = 44;
  const [accentR, accentG, accentB] = preset.accent;
  const [neutralR, neutralG, neutralB] = preset.neutral;
  let y = top;
  const cardFill: PlatformPdfRgb = [255, 255, 255];
  const borderSoft: PlatformPdfRgb = [226, 232, 240];
  const textPrimary: PlatformPdfRgb = [17, 24, 39];
  const textMuted: PlatformPdfRgb = [100, 116, 139];
  const sellerLines = model.seller?.lines?.filter(Boolean) || model.companyLines;
  const buyerLines = model.buyer?.lines?.filter(Boolean) || [];
  const shipToLines = model.shipTo?.lines?.filter(Boolean) || [];
  const lineItems = model.lineItems.length
    ? model.lineItems
    : [{ description: 'Sin detalle disponible', amount: '-', price: '-', quantity: '-', unit: '-', tax: '-', detail: '' }];
  const customTableHeaders = model.tableHeaders?.filter(Boolean) || [];
  const customTableRows = model.tableRows?.length
    ? model.tableRows.map(row => row.map(cell => String(cell ?? '-')))
    : null;

  const emitFooter = (footerY: number) =>
    drawPlatformPdfFooter({
      doc,
      left,
      right,
      y: footerY,
      note: model.footerNote,
      presetLabel: model.presetLabel,
    });

  const startNewPage = () => {
    emitFooter(pageHeight - 20);
    doc.addPage();
    y = baseTop;
  };

  const ensurePageSpace = (requiredHeight: number, onBreak?: () => void) => {
    if (y + requiredHeight <= pageHeight - bottomReserve) return;
    startNewPage();
    onBreak?.();
  };

  const resolveTableWidths = (fallback: number[], columnCount: number) => {
    const configuredWidths = model.tableColumnWidths;
    if (configuredWidths?.length === columnCount) {
      const total = configuredWidths.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
      if (!total) return fallback.length === columnCount ? fallback : Array.from({ length: columnCount }, () => width / columnCount);
      if (total <= 1.05) {
        return configuredWidths.map(value => width * value);
      }
      return configuredWidths.map(value => (value / total) * width);
    }
    if (fallback.length === columnCount) return fallback;
    if (!columnCount) return fallback;
    return Array.from({ length: columnCount }, () => width / columnCount);
  };

  const drawMetaStack = (items: Array<[string, string | undefined]>, x: number, startY: number, align: 'left' | 'right' = 'left') => {
    let cursorY = startY;
    items.filter(([, value]) => Boolean(value)).forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text(label.toUpperCase(), x, cursorY, { align });
      cursorY += 11;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(textPrimary[0], textPrimary[1], textPrimary[2]);
      doc.text(String(value), x, cursorY, { align, maxWidth: width * 0.26 });
      cursorY += 16;
    });
  };

  const drawCompactMetaLines = ({
    x,
    startY,
    lines,
    align = 'left',
    maxWidth,
  }: {
    x: number;
    startY: number;
    lines: string[];
    align?: 'left' | 'right';
    maxWidth: number;
  }) => {
    let cursorY = startY;
    lines.filter(Boolean).forEach(line => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.8);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text(doc.splitTextToSize(line, maxWidth), x, cursorY, { align, maxWidth });
      cursorY += 12;
    });
    return cursorY;
  };

  const drawFieldBox = ({
    x,
    boxY,
    boxWidth,
    boxHeight,
    title,
    lines,
    fill = cardFill,
    border = borderSoft,
    titleColor = textMuted,
    valueColor = textPrimary,
  }: {
    x: number;
    boxY: number;
    boxWidth: number;
    boxHeight: number;
    title: string;
    lines: string[];
    fill?: PlatformPdfRgb;
    border?: PlatformPdfRgb;
    titleColor?: PlatformPdfRgb;
    valueColor?: PlatformPdfRgb;
  }) => {
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.setDrawColor(border[0], border[1], border[2]);
    doc.roundedRect(x, boxY, boxWidth, boxHeight, 14, 14, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.4);
    doc.setTextColor(titleColor[0], titleColor[1], titleColor[2]);
    doc.text(title.toUpperCase(), x + 12, boxY + 16);
    doc.setFont('helvetica', lines.length > 1 ? 'normal' : 'bold');
    doc.setFontSize(lines.length > 1 ? 9.3 : 10.8);
    doc.setTextColor(valueColor[0], valueColor[1], valueColor[2]);
    let cursorY = boxY + 34;
    lines.filter(Boolean).slice(0, 4).forEach(line => {
      doc.text(doc.splitTextToSize(line, boxWidth - 24), x + 12, cursorY, { maxWidth: boxWidth - 24 });
      cursorY += 13;
    });
  };

  const drawInvoiceTable = ({
    labels,
    colWidths,
    columnFields,
    headerFill,
    headerText,
    rowStripe,
  }: {
    labels: string[];
    colWidths: number[];
    columnFields?: Array<keyof PlatformPdfLineItem>;
    headerFill: PlatformPdfRgb;
    headerText: PlatformPdfRgb;
    rowStripe: PlatformPdfRgb;
  }) => {
    const activeLabels = customTableHeaders.length ? customTableHeaders : labels;
    const resolvedWidths = resolveTableWidths(colWidths, activeLabels.length);
    const fields = columnFields?.length
      ? columnFields
      : (['description', 'quantity', 'unit', 'price', 'tax', 'amount'] satisfies Array<keyof PlatformPdfLineItem>);
    const activeRows = customTableRows
      ? customTableRows.map(row =>
          activeLabels.map((_, index) => {
            const value = row[index];
            const normalized = String(value ?? '-').trim();
            return normalized.length ? normalized : '-';
          }),
        )
      : null;

    const drawTableHeader = () => {
      doc.setFillColor(headerFill[0], headerFill[1], headerFill[2]);
      doc.setDrawColor(borderSoft[0], borderSoft[1], borderSoft[2]);
      doc.roundedRect(left, y, width, 24, 10, 10, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.setTextColor(headerText[0], headerText[1], headerText[2]);
      let headerX = left + 10;
      activeLabels.forEach((label, index) => {
        doc.text(label.toUpperCase(), headerX, y + 15, { maxWidth: resolvedWidths[index] - 10 });
        headerX += resolvedWidths[index];
      });
      y += 32;
    };

    ensurePageSpace(36);
    drawTableHeader();

    const renderRow = (cells: string[][], index: number, detailLines: string[] = []) => {
      const isRouteDocument = model.documentKind === 'route';
      const rowTopPadding = isRouteDocument ? 11 : 9;
      const rowBottomPadding = isRouteDocument ? 11 : 8;
      const mainLineCount = Math.max(1, ...cells.map(lines => Math.max(lines.length, 1)));
      const detailLineCount = detailLines.length;
      const mainLineStep = isRouteDocument ? 6.7 : 6.2;
      const detailLineStep = isRouteDocument ? 5.6 : 5.1;
      const rowTextStartY = y + 11;
      const detailTextStartY = rowTextStartY + mainLineCount * mainLineStep + (detailLineCount ? 4 : 0);
      const rowHeight = Math.max(
        30,
        rowTopPadding + mainLineCount * mainLineStep + (detailLineCount ? 4 + detailLineCount * detailLineStep : 0) + rowBottomPadding,
      );
      ensurePageSpace(rowHeight + 10, drawTableHeader);
      if (index % 2 === 0) {
        doc.setFillColor(rowStripe[0], rowStripe[1], rowStripe[2]);
        doc.roundedRect(left, y, width, rowHeight, 8, 8, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(isRouteDocument ? 9.0 : 9.1);
      doc.setTextColor(textPrimary[0], textPrimary[1], textPrimary[2]);
      let cellX = left + 10;
      cells.forEach((lines, cellIndex) => {
        doc.text(lines, cellX, rowTextStartY, {
          maxWidth: resolvedWidths[cellIndex] - 10,
          lineHeightFactor: isRouteDocument ? 1.15 : 1.1,
        });
        cellX += resolvedWidths[cellIndex];
      });
      if (detailLines.length) {
        doc.setFontSize(isRouteDocument ? 8.3 : 8.1);
        doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
        doc.text(detailLines, left + 10, detailTextStartY, {
          maxWidth: resolvedWidths[0] - 10,
          lineHeightFactor: isRouteDocument ? 1.2 : 1.1,
        });
      }
      y += rowHeight;
      drawPlatformPdfDivider({ doc, x1: left, x2: right, y: y - 2, color: [241, 245, 249] });
      y += 4;
    };

    if (activeRows) {
      activeRows.forEach((row, index) => {
        const rowLines = row.map((cell, cellIndex) => doc.splitTextToSize(cell, resolvedWidths[cellIndex] - 10));
        renderRow(rowLines, index);
      });
      return;
    }

    lineItems.forEach((item, index) => {
      const rowLines = fields.map((field, cellIndex) =>
        doc.splitTextToSize(String(item[field] || '-'), resolvedWidths[cellIndex] - 10),
      );
      const detailLines =
        fields.includes('detail') || !item.detail ? [] : doc.splitTextToSize(item.detail, resolvedWidths[0] - 10);
      renderRow(rowLines, index, detailLines);
    });
  };

  const drawTotalsColumn = ({ x, startY, boxWidth, emphasisFill }: { x: number; startY: number; boxWidth: number; emphasisFill: PlatformPdfRgb }) => {
    let totalY = startY;
    model.totals.forEach(total => {
      if (total.emphasis) {
        doc.setFillColor(emphasisFill[0], emphasisFill[1], emphasisFill[2]);
        doc.setDrawColor(accentR, accentG, accentB);
        doc.roundedRect(x - 8, totalY - 12, boxWidth, 24, 9, 9, 'FD');
      }
      doc.setFont('helvetica', total.emphasis ? 'bold' : 'normal');
      doc.setFontSize(total.emphasis ? 10.8 : 9.5);
      doc.setTextColor(textPrimary[0], textPrimary[1], textPrimary[2]);
      doc.text(total.label, x, totalY);
      doc.text(total.value, x + boxWidth - 14, totalY, { align: 'right' });
      totalY += total.emphasis ? 20 : 15;
    });
    return totalY;
  };

  const drawReportMetricCard = ({
    x,
    boxY,
    boxWidth,
    title,
    value,
    accent,
    fill,
  }: {
    x: number;
    boxY: number;
    boxWidth: number;
    title: string;
    value: string;
    accent: PlatformPdfRgb;
    fill: PlatformPdfRgb;
  }) => {
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.setDrawColor(accent[0], accent[1], accent[2]);
    doc.roundedRect(x, boxY, boxWidth, 38, 10, 10, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(title.toUpperCase(), x + 10, boxY + 13);
    doc.setFontSize(10.8);
    doc.setTextColor(accent[0], accent[1], accent[2]);
    doc.text(value, x + 10, boxY + 28, { maxWidth: boxWidth - 18 });
  };

  if (model.documentKind === 'report') {
    const executiveLines = shipToLines.length
      ? shipToLines
      : ['Sin lectura ejecutiva disponible para este rango.'];
    const notesLines = model.notesLines?.length
      ? model.notesLines
      : ['Documento listo para auditoria, archivo o distribucion institucional.'];
    const visibleTotals = model.totals.slice(0, 4);
    const trailingTotals = model.totals.slice(4);
    const isExecutivePreset = preset.visualPreset === 'FACTURA_FINANCIERA';
    const isFiscalPreset = preset.visualPreset === 'FISCAL_ELECTRONICA';
    const isClassicPreset = preset.visualPreset === 'CORPORATIVA_CLASICA';
    const headerFill: PlatformPdfRgb = isExecutivePreset ? [15, 23, 42] : isFiscalPreset ? [240, 249, 255] : [255, 255, 255];
    const headerBorder: PlatformPdfRgb = isExecutivePreset ? [15, 23, 42] : isFiscalPreset ? [186, 230, 253] : [219, 234, 254];
    const headerText: PlatformPdfRgb = isExecutivePreset ? [255, 255, 255] : [17, 24, 39];
    const headerMuted: PlatformPdfRgb = isExecutivePreset ? [226, 232, 240] : [100, 116, 139];
    const logoBoxSize = 52;
    const logoX = left + 16;
    const logoY = y + 18;
    const companyX = logoX + logoBoxSize + 14;
    const companyWidth = width * 0.24;
    const metaWidth = isFiscalPreset ? width * 0.22 : width * 0.2;
    const metaX = right - metaWidth - 16;
    const titleX = companyX + companyWidth + 12;
    const titleWidth = Math.max(74, metaX - titleX - 14);
    const headerTitle = isFiscalPreset ? model.title.toUpperCase() : model.title;
    const titleLines = doc.splitTextToSize(headerTitle, titleWidth).slice(0, isFiscalPreset ? 2 : 2);
    const subtitleLines = model.subtitle ? doc.splitTextToSize(model.subtitle, titleWidth).slice(0, 2) : [];
    const headerMetaItems = [
      ['Documento', model.documentNumber],
      ['Fecha de emision', model.issueDate],
      [isFiscalPreset ? 'Plazo' : 'Periodo', model.dueDate],
    ].filter(([, value]) => Boolean(value)) as Array<[string, string]>;
    const headerHeight = isFiscalPreset ? 122 : isExecutivePreset ? 118 : isClassicPreset ? 114 : 116;

    drawPlatformPdfCard({
      doc,
      x: left,
      y,
      width,
      height: headerHeight,
      fill: headerFill,
      border: headerBorder,
      radius: 22,
    });
    drawPdfLogoOrMark({
      doc,
      x: logoX,
      y: logoY,
      width: logoBoxSize,
      height: logoBoxSize,
      logo: model.companyLogo,
      letters: 'PF',
      preset,
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isClassicPreset ? 17.6 : 18.2);
    doc.setTextColor(headerText[0], headerText[1], headerText[2]);
    doc.text(model.companyName, companyX, y + 30, { maxWidth: companyWidth });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.2);
    doc.setTextColor(headerMuted[0], headerMuted[1], headerMuted[2]);
    model.companyLines.slice(0, 2).forEach((line, index) => {
      doc.text(line, companyX, y + 47 + index * 12, { maxWidth: companyWidth });
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isFiscalPreset ? 18 : 17);
    doc.setTextColor(headerText[0], headerText[1], headerText[2]);
    doc.text(titleLines, titleX, y + 28, { maxWidth: titleWidth });
    let titleCursorY = y + 28 + titleLines.length * 13;
    if (subtitleLines.length) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.1);
      doc.setTextColor(headerMuted[0], headerMuted[1], headerMuted[2]);
      doc.text(subtitleLines, titleX, titleCursorY, { maxWidth: titleWidth });
      titleCursorY += subtitleLines.length * 10 + 2;
    }

    drawPlatformPdfCard({
      doc,
      x: metaX,
      y: y + 16,
      width: metaWidth,
      height: headerHeight - 32,
      fill: isExecutivePreset ? [23, 35, 64] : [255, 255, 255],
      border: isExecutivePreset ? [37, 99, 235] : [226, 232, 240],
      radius: 16,
    });
    let metaY = y + 34;
    headerMetaItems.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(headerMuted[0], headerMuted[1], headerMuted[2]);
      doc.text(label.toUpperCase(), metaX + metaWidth - 12, metaY, {
        align: 'right',
        maxWidth: metaWidth - 24,
      });
      metaY += 11;
      doc.setFont('helvetica', isFiscalPreset ? 'bold' : 'normal');
      doc.setFontSize(9.2);
      doc.setTextColor(headerText[0], headerText[1], headerText[2]);
      const valueLines = doc.splitTextToSize(value, metaWidth - 24).slice(0, 2);
      doc.text(valueLines, metaX + metaWidth - 12, metaY, {
        align: 'right',
        maxWidth: metaWidth - 24,
      });
      metaY += valueLines.length * 10 + 7;
    });

    y += headerHeight + 18;
    drawPlatformPdfDivider({ doc, x1: left, x2: right, y, color: [226, 232, 240] });
    y += 16;

    const infoGap = 14;
    const infoWidth = (width - infoGap) / 2;
    drawFieldBox({
      x: left,
      boxY: y,
      boxWidth: infoWidth,
      boxHeight: 64,
      title: model.buyer?.title || 'Alcance del reporte',
      lines: buyerLines,
    });
    drawFieldBox({
      x: left + infoWidth + infoGap,
      boxY: y,
      boxWidth: infoWidth,
      boxHeight: 64,
      title: model.seller?.title || 'Generado por',
      lines: sellerLines,
    });
    y += 78;

    const executiveBoxHeight = Math.max(72, executiveLines.length * 12 + 34);
    drawFieldBox({
      x: left,
      boxY: y,
      boxWidth: width,
      boxHeight: executiveBoxHeight,
      title: model.shipTo?.title || 'Lectura ejecutiva',
      lines: [],
    });
    let executiveY = y + 36;
    executiveLines.forEach(line => {
      const split = doc.splitTextToSize(line, width - 28);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.2);
      doc.setTextColor(textPrimary[0], textPrimary[1], textPrimary[2]);
      doc.text(split, left + 14, executiveY, { maxWidth: width - 28 });
      executiveY += split.length * 10 + 5;
    });
    y += executiveBoxHeight + 16;

    if (visibleTotals.length) {
      const gap = 10;
      const cardWidth = (width - gap * (visibleTotals.length - 1)) / visibleTotals.length;
      const palettes: Array<{ accent: PlatformPdfRgb; fill: PlatformPdfRgb }> = [
        { accent: [37, 99, 235], fill: [239, 246, 255] },
        { accent: [79, 70, 229], fill: [238, 242, 255] },
        { accent: [249, 115, 22], fill: [255, 247, 237] },
        { accent: [5, 150, 105], fill: [236, 253, 245] },
      ];
      visibleTotals.forEach((total, index) => {
        const palette = palettes[index % palettes.length];
        drawReportMetricCard({
          x: left + index * (cardWidth + gap),
          boxY: y,
          boxWidth: cardWidth,
          title: total.label,
          value: total.value,
          accent: palette.accent,
          fill: palette.fill,
        });
      });
      y += 52;
    }

    drawPlatformPdfDivider({ doc, x1: left, x2: right, y, color: [226, 232, 240] });
    y += 16;

    const headerLabels = customTableHeaders.length ? customTableHeaders : ['Seccion', 'Indicador', 'Valor'];
    const reportTableWidths =
      headerLabels.length === 1
        ? [width]
        : headerLabels.length === 2
          ? [width * 0.64, width * 0.36]
          : headerLabels.length === 3
            ? [width * 0.38, width * 0.34, width * 0.28]
            : headerLabels.length === 4
              ? [width * 0.3, width * 0.24, width * 0.24, width * 0.22]
              : headerLabels.length === 5
                ? [width * 0.28, width * 0.2, width * 0.14, width * 0.22, width * 0.16]
                : [width * 0.24, width * 0.14, width * 0.12, width * 0.16, width * 0.18, width * 0.16];
    drawInvoiceTable({
      labels: headerLabels,
      colWidths: reportTableWidths,
      headerFill: [241, 245, 249],
      headerText: textMuted,
      rowStripe: [250, 252, 255],
    });

    y += 16;
    const notesHeight = Math.max(76, notesLines.length * 12 + 28);
    const totalsHeight = Math.max(76, trailingTotals.length * 14 + 30);
    const closingHeight = Math.max(notesHeight, totalsHeight);
    ensurePageSpace(closingHeight + 18);

    const notesWidth = trailingTotals.length ? width * 0.58 : width;
    drawFieldBox({
      x: left,
      boxY: y,
      boxWidth: notesWidth,
      boxHeight: closingHeight,
      title: model.notesTitle || 'Notas del documento',
      lines: notesLines,
    });
    let finalY = y + closingHeight;

    if (trailingTotals.length) {
      const totalsX = left + notesWidth + 14;
      const totalsWidth = width - notesWidth - 14;
      drawFieldBox({
        x: totalsX,
        boxY: y,
        boxWidth: totalsWidth,
        boxHeight: closingHeight,
        title: 'Cierre del documento',
        lines: [],
      });
      let totalsY = y + 24;
      trailingTotals.forEach(total => {
        doc.setFont('helvetica', total.emphasis ? 'bold' : 'normal');
        doc.setFontSize(total.emphasis ? 10.2 : 9.1);
        doc.setTextColor(textPrimary[0], textPrimary[1], textPrimary[2]);
        doc.text(total.label, totalsX + 12, totalsY);
        doc.text(total.value, totalsX + totalsWidth - 12, totalsY, { align: 'right' });
        totalsY += total.emphasis ? 18 : 14;
      });
      finalY = Math.max(finalY, totalsY + 12);
    }

    emitFooter(finalY + 12);
    return;
  }

  if (false && model.documentKind === 'report') {
    const reportMetaItems: Array<[string, string | undefined]> = [
      ['Documento', model.documentNumber],
      ['Fecha de emision', model.issueDate],
      ['Periodo', model.dueDate],
    ];
    const executiveLines = shipToLines.length
      ? shipToLines
      : ['Sin lectura ejecutiva disponible para este rango.'];
    const visibleTotals = model.totals.slice(0, 4);
    const trailingTotals = model.totals.slice(4);
    const introCardHeight = preset.visualPreset === 'FACTURA_FINANCIERA' ? 98 : 92;

    const headerMetaLineOne = model.documentNumber ? `Documento: ${model.documentNumber}` : '';
    const headerMetaLineTwo = [model.issueDate ? `Fecha: ${model.issueDate}` : '', model.dueDate ? `Periodo: ${model.dueDate}` : '']
      .filter(Boolean)
      .join(' · ');
    const rightColumnMaxWidth = width * (preset.visualPreset === 'FACTURA_FINANCIERA' ? 0.4 : 0.38);
    const subtitleLines = model.subtitle ? doc.splitTextToSize(model.subtitle, rightColumnMaxWidth) : [];

    if (preset.visualPreset === 'FACTURA_FINANCIERA') {
      drawPlatformPdfCard({
        doc,
        x: left,
        y,
        width,
        height: 104,
        fill: [15, 23, 42],
        border: [15, 23, 42],
        radius: 24,
      });
      drawPdfLogoOrMark({
        doc,
        x: left + 18,
        y: y + 18,
        width: 52,
        height: 52,
        logo: model.companyLogo,
        letters: 'PF',
        preset,
      });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(24);
      doc.setTextColor(255, 255, 255);
      doc.text(model.companyName, left + 86, y + 30);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.8);
      doc.setTextColor(226, 232, 240);
      model.companyLines.slice(0, 2).forEach((line, index) => {
        doc.text(line, left + 86, y + 47 + index * 13);
      });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text(model.title, right - 20, y + 30, { align: 'right', maxWidth: width * 0.42 });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.2);
      doc.setTextColor(203, 213, 225);
      let metaStartY = y + 46;
      if (subtitleLines.length) {
        doc.text(subtitleLines, right - 20, y + 48, {
          align: 'right',
          maxWidth: width * 0.36,
        });
        metaStartY += subtitleLines.length * 10 + 4;
      }
      drawCompactMetaLines({
        x: right - 20,
        startY: metaStartY,
        lines: [headerMetaLineOne, headerMetaLineTwo],
        align: 'right',
        maxWidth: width * 0.32,
      });
      y += 120;
    } else {
      drawPlatformPdfCard({
        doc,
        x: left,
        y,
        width,
        height: preset.visualPreset === 'FISCAL_ELECTRONICA' ? 106 : 100,
        fill: [255, 255, 255],
        border: [219, 234, 254],
        radius: 22,
      });
      drawPdfLogoOrMark({
        doc,
        x: left + 16,
        y: y + 18,
        width: 52,
        height: 52,
        logo: model.companyLogo,
        letters: 'PF',
        preset,
      });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(preset.visualPreset === 'CORPORATIVA_CLASICA' ? 18 : 15);
      doc.setTextColor(textPrimary[0], textPrimary[1], textPrimary[2]);
      doc.text(model.companyName, left + 84, y + 28);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.6);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      model.companyLines.slice(0, 2).forEach((line, index) => {
        doc.text(line, left + 84, y + 45 + index * 14);
      });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(preset.visualPreset === 'FISCAL_ELECTRONICA' ? 19 : 21);
      doc.setTextColor(neutralR, neutralG, neutralB);
      doc.text(
        preset.visualPreset === 'FISCAL_ELECTRONICA' ? model.title.toUpperCase() : model.title,
        right - 18,
        y + 24,
        { align: 'right', maxWidth: width * 0.44 },
      );
      let metaStartY = y + 40;
      if (subtitleLines.length) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.8);
        doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
        doc.text(subtitleLines, right - 18, y + 42, {
          align: 'right',
          maxWidth: width * 0.34,
        });
        metaStartY += subtitleLines.length * 10 + 4;
      }
      drawCompactMetaLines({
        x: right - 18,
        startY: metaStartY,
        lines: [headerMetaLineOne, headerMetaLineTwo],
        align: 'right',
        maxWidth: width * 0.28,
      });
      y += preset.visualPreset === 'FISCAL_ELECTRONICA' ? 122 : 116;
    }
    drawPlatformPdfDivider({ doc, x1: left, x2: right, y, color: [226, 232, 240] });
    y += 18;

    const metaWidth = (width - 18) / 2;
    drawFieldBox({
      x: left,
      boxY: y,
      boxWidth: metaWidth,
      boxHeight: 74,
      title: model.buyer?.title || 'Alcance del reporte',
      lines: buyerLines,
    });
    drawFieldBox({
      x: left + metaWidth + 18,
      boxY: y,
      boxWidth: metaWidth,
      boxHeight: 74,
      title: model.seller?.title || 'Generado por',
      lines: sellerLines,
    });
    y += 90;

    const summaryCardHeight = Math.max(74, Math.ceil(executiveLines.length / 2) * 28 + 30);
    drawFieldBox({
      x: left,
      boxY: y,
      boxWidth: width,
      boxHeight: summaryCardHeight,
      title: model.shipTo?.title || 'Lectura ejecutiva',
      lines: [],
    });
    let summaryY = y + 34;
    executiveLines.forEach((line, index) => {
      const columnX = left + 14 + (index % 2) * (width / 2);
      const lineY = summaryY + Math.floor(index / 2) * 24;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.4);
      doc.setTextColor(textPrimary[0], textPrimary[1], textPrimary[2]);
      doc.text(doc.splitTextToSize(line, width / 2 - 28), columnX, lineY, { maxWidth: width / 2 - 28 });
    });
    y += summaryCardHeight + 16;

    if (visibleTotals.length) {
      const gap = 10;
      const cardWidth = (width - gap * (visibleTotals.length - 1)) / visibleTotals.length;
      const palettes: Array<{ accent: PlatformPdfRgb; fill: PlatformPdfRgb }> = [
        { accent: [37, 99, 235], fill: [239, 246, 255] },
        { accent: [79, 70, 229], fill: [238, 242, 255] },
        { accent: [249, 115, 22], fill: [255, 247, 237] },
        { accent: [5, 150, 105], fill: [236, 253, 245] },
      ];
      visibleTotals.forEach((total, index) => {
        const palette = palettes[index % palettes.length];
        drawReportMetricCard({
          x: left + index * (cardWidth + gap),
          boxY: y,
          boxWidth: cardWidth,
          title: total.label,
          value: total.value,
          accent: palette.accent,
          fill: palette.fill,
        });
      });
      y += 52;
    }

    y += 4;
    drawPlatformPdfDivider({ doc, x1: left, x2: right, y, color: [226, 232, 240] });
    y += 16;

    const headerLabels =
      customTableHeaders.length > 0
        ? customTableHeaders
        : ['Descripcion', 'Detalle', 'Cantidad', 'Valor', 'Cargo', 'Total'];
    drawInvoiceTable({
      labels: headerLabels,
      colWidths: Array.from({ length: Math.max(headerLabels.length, 1) }, () => width / Math.max(headerLabels.length, 1)),
      headerFill: [241, 245, 249],
      headerText: textMuted,
      rowStripe: [250, 252, 255],
    });

    y += 16;
    const notesBlockHeight = Math.max(
      92,
      (model.notesLines?.length || 1) * 13 + 28 + (trailingTotals.length ? trailingTotals.length * 16 + 32 : 0),
    );
    ensurePageSpace(notesBlockHeight);
    const notesWidth = trailingTotals.length ? width * 0.58 : width;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.2);
    doc.setTextColor(textPrimary[0], textPrimary[1], textPrimary[2]);
    doc.text(model.notesTitle || 'Notas del documento', left, y);
    y += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.2);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    (model.notesLines || ['Documento listo para entrega institucional.']).forEach(line => {
      doc.text(doc.splitTextToSize(line, notesWidth - 8), left, y, { maxWidth: notesWidth - 8 });
      y += 13;
    });

    let finalY = y;
    if (trailingTotals.length) {
      finalY = drawTotalsColumn({
        x: left + notesWidth + 18,
        startY: y - ((model.notesLines || ['']).length * 13 + 6),
        boxWidth: width - notesWidth - 18,
        emphasisFill: [248, 250, 252],
      });
    }

    emitFooter(Math.max(y, finalY) + 18);
    return;
  }

  if (preset.visualPreset === 'CORPORATIVA_CLASICA') {
    drawPdfLogoOrMark({ doc, x: left, y, width: 56, height: 56, logo: model.companyLogo, letters: 'PF', preset });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(textPrimary[0], textPrimary[1], textPrimary[2]);
    doc.text(model.companyName, left + 74, y + 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.4);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    let companyY = y + 34;
    model.companyLines.slice(0, 4).forEach(line => {
      doc.text(line, left + 74, companyY);
      companyY += 12;
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(neutralR, neutralG, neutralB);
    doc.text(model.title, right, y + 16, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.4);
    if (model.subtitle) doc.text(doc.splitTextToSize(model.subtitle, 220), right, y + 32, { align: 'right' });
    drawMetaStack(
      [
        ['Documento', model.documentNumber],
        ['Fecha de emision', model.issueDate],
        ['Fecha de vencimiento', model.dueDate],
      ],
      right,
      y + 50,
      'right',
    );

    y += 98;
    drawPlatformPdfDivider({ doc, x1: left, x2: right, y, color: [226, 232, 240] });
    y += 20;

    const partyWidth = (width - 20) / 2;
    drawFieldBox({
      x: left,
      boxY: y,
      boxWidth: partyWidth,
      boxHeight: 82,
      title: model.buyer?.title || 'Facturar a',
      lines: buyerLines,
    });
    drawFieldBox({
      x: left + partyWidth + 20,
      boxY: y,
      boxWidth: partyWidth,
      boxHeight: 82,
      title: model.seller?.title || 'Emitido por',
      lines: sellerLines,
    });
    y += 98;

    drawInvoiceTable({
      labels: ['Descripcion', 'Cant.', 'Unidad', 'Precio', 'Fiscal', 'Importe'],
      colWidths: [width * 0.36, width * 0.11, width * 0.13, width * 0.14, width * 0.11, width * 0.15],
      headerFill: [248, 250, 252],
      headerText: textMuted,
      rowStripe: [252, 253, 255],
    });

    y += 10;
    const notesWidth = width * 0.54;
    ensurePageSpace(Math.max((model.notesLines || []).length * 13 + 54, 90));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(textPrimary[0], textPrimary[1], textPrimary[2]);
    doc.text(model.notesTitle || 'Terminos y condiciones', left, y);
    y += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.2);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    (model.notesLines || []).forEach(line => {
      doc.text(doc.splitTextToSize(line, notesWidth), left, y);
      y += 13;
    });

    const totalBottom = drawTotalsColumn({
      x: left + width * 0.6,
      startY: y - ((model.notesLines || []).length * 13 + 10),
      boxWidth: width * 0.4,
      emphasisFill: [248, 250, 252],
    });
    emitFooter(Math.max(y, totalBottom) + 18);
    return;
  }

  if (preset.visualPreset === 'FISCAL_ELECTRONICA') {
    drawPdfLogoOrMark({ doc, x: left, y, width: 56, height: 56, logo: model.companyLogo, letters: 'PF', preset });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(textPrimary[0], textPrimary[1], textPrimary[2]);
    doc.text(model.companyName, left + 74, y + 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    let companyY = y + 30;
    model.companyLines.slice(0, 5).forEach(line => {
      doc.text(line, left + 74, companyY);
      companyY += 11;
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(neutralR, neutralG, neutralB);
    doc.text(model.title.toUpperCase(), right, y + 16, { align: 'right' });
    drawMetaStack(
      [
        ['Numero', model.documentNumber],
        ['Fecha', model.issueDate],
        ['Vencimiento', model.dueDate],
      ],
      right,
      y + 32,
      'right',
    );

    y += 84;
    drawPlatformPdfDivider({ doc, x1: left, x2: right, y, color: [226, 232, 240] });
    y += 18;

    const buyerWidth = width * 0.58;
    drawFieldBox({
      x: left,
      boxY: y,
      boxWidth: buyerWidth,
      boxHeight: 88,
      title: model.buyer?.title || 'Cliente',
      lines: buyerLines,
    });
    drawFieldBox({
      x: left + buyerWidth + 16,
      boxY: y,
      boxWidth: width - buyerWidth - 16,
      boxHeight: 88,
      title: model.shipTo?.title || 'Contexto',
      lines: shipToLines.length ? shipToLines : sellerLines,
    });
    y += 104;

    drawInvoiceTable({
      labels: ['Cod.', 'Articulo', 'Cant.', 'Precio', 'Fiscal', 'Total'],
      colWidths: [width * 0.1, width * 0.34, width * 0.12, width * 0.14, width * 0.12, width * 0.18],
      headerFill: [237, 242, 247],
      headerText: textMuted,
      rowStripe: [255, 255, 255],
    });

    y += 12;
    const notesWidth = width * 0.56;
    ensurePageSpace(Math.max((model.notesLines || []).length * 12 + 54, 82));
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.9);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    (model.notesLines || []).forEach(line => {
      doc.text(doc.splitTextToSize(line, notesWidth), left, y);
      y += 12;
    });
    const totalBottom = drawTotalsColumn({
      x: left + width * 0.64,
      startY: y - ((model.notesLines || []).length * 12),
      boxWidth: width * 0.36,
      emphasisFill: [224, 242, 254],
    });
    emitFooter(Math.max(y, totalBottom) + 18);
    return;
  }

  const drawTextBlock = ({
    title,
    lines,
    x,
    startY,
    blockWidth,
  }: {
    title: string;
    lines: string[];
    x: number;
    startY: number;
    blockWidth: number;
  }) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(textPrimary[0], textPrimary[1], textPrimary[2]);
    doc.text(title, x, startY);
    let cursorY = startY + 18;
    lines.filter(Boolean).slice(0, 5).forEach((line, index) => {
      doc.setFont('helvetica', index === 0 ? 'bold' : 'normal');
      doc.setFontSize(index === 0 ? 10.5 : 9.4);
      doc.setTextColor(textPrimary[0], textPrimary[1], textPrimary[2]);
      doc.text(doc.splitTextToSize(line, blockWidth), x, cursorY, { maxWidth: blockWidth });
      cursorY += index === 0 ? 16 : 13;
    });
    return cursorY;
  };

  const drawMetricTile = ({
    x,
    boxY,
    boxWidth,
    title,
    value,
    accent,
    fill,
  }: {
    x: number;
    boxY: number;
    boxWidth: number;
    title: string;
    value: string;
    accent: PlatformPdfRgb;
    fill: PlatformPdfRgb;
  }) => {
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.setDrawColor(accent[0], accent[1], accent[2]);
    doc.roundedRect(x, boxY, boxWidth, 44, 10, 10, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(title.toUpperCase(), x + 10, boxY + 14);
    doc.setFontSize(9.1);
    doc.setTextColor(accent[0], accent[1], accent[2]);
    doc.text(value, x + 10, boxY + 30, { maxWidth: boxWidth - 20 });
  };

  const heroHeight = 88;
  drawPlatformPdfCard({
    doc,
    x: left,
    y,
    width,
    height: heroHeight,
    fill: [250, 252, 255],
    border: [219, 234, 254],
    radius: 24,
  });
  drawPdfLogoOrMark({
    doc,
    x: left + 18,
    y: y + 16,
    width: 52,
    height: 52,
    logo: model.companyLogo,
    letters: 'PF',
    preset,
  });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(23);
  doc.setTextColor(textPrimary[0], textPrimary[1], textPrimary[2]);
  doc.text(model.companyName, left + 88, y + 32);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  model.companyLines.slice(0, 2).forEach((line, index) => {
    doc.text(line, left + 88, y + 50 + index * 14);
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text((model.summaryTitle || model.title).toUpperCase(), right - 16, y + 18, { align: 'right' });
  doc.setFontSize(20);
  doc.setTextColor(textPrimary[0], textPrimary[1], textPrimary[2]);
  doc.text(model.summaryValue || '-', right - 16, y + 44, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  const heroMeta = [model.documentNumber, model.issueDate, model.dueDate].filter(Boolean).join(' · ');
  if (heroMeta) {
    doc.text(heroMeta, right - 16, y + 64, { align: 'right' });
  }

  y += heroHeight + 18;
  drawPlatformPdfDivider({ doc, x1: left, x2: right, y, color: [226, 232, 240] });
  y += 22;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(textPrimary[0], textPrimary[1], textPrimary[2]);
  doc.text(model.title, left, y);
  if (model.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(doc.splitTextToSize(model.subtitle, width * 0.76), left, y + 16, { maxWidth: width * 0.76 });
  }
  y += model.subtitle ? 42 : 28;

  const partyWidth = (width - 22) / 2;
  const leftBottom = drawTextBlock({
    title: model.seller?.title || 'De',
    lines: sellerLines,
    x: left,
    startY: y,
    blockWidth: partyWidth,
  });
  const rightBottom = drawTextBlock({
    title: model.buyer?.title || 'Cobrar a',
    lines: buyerLines.length ? buyerLines : shipToLines,
    x: left + partyWidth + 22,
    startY: y,
    blockWidth: partyWidth,
  });
  y = Math.max(leftBottom, rightBottom) + 10;

  if (shipToLines.length) {
    drawPlatformPdfDivider({ doc, x1: left, x2: right, y, color: [241, 245, 249] });
    y += 16;
    const contextLines = shipToLines.map((line, index) => ({
      label: index === 0 ? (model.shipTo?.title || 'Contexto') : '',
      value: line,
    }));
    contextLines.forEach((entry, index) => {
      const blockX = left + (index % 2) * (partyWidth + 22);
      const blockY = y + Math.floor(index / 2) * 42;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text((entry.label || 'DETALLE').toUpperCase(), blockX, blockY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.4);
      doc.setTextColor(textPrimary[0], textPrimary[1], textPrimary[2]);
      doc.text(doc.splitTextToSize(entry.value, partyWidth), blockX, blockY + 14, { maxWidth: partyWidth });
    });
    y += Math.ceil(contextLines.length / 2) * 42 + 4;
  }

  const tiles = model.totals.slice(0, 4);
  const metricGap = 10;
  const metricWidth = (width - metricGap * (tiles.length - 1)) / Math.max(tiles.length, 1);
  const metricPalette: Array<{ accent: PlatformPdfRgb; fill: PlatformPdfRgb }> = [
    { accent: [37, 99, 235], fill: [239, 246, 255] },
    { accent: [79, 70, 229], fill: [238, 242, 255] },
    { accent: [249, 115, 22], fill: [255, 247, 237] },
    { accent: [5, 150, 105], fill: [236, 253, 245] },
  ];
  tiles.forEach((tile, index) => {
    const palette = metricPalette[index % metricPalette.length];
    drawMetricTile({
      x: left + index * (metricWidth + metricGap),
      boxY: y,
      boxWidth: metricWidth,
      title: tile.label,
      value: tile.value,
      accent: palette.accent,
      fill: palette.fill,
    });
  });
  y += tiles.length ? 56 : 0;

  drawPlatformPdfDivider({ doc, x1: left, x2: right, y, color: [226, 232, 240] });
  y += 18;

  drawInvoiceTable({
    labels: ['Descripcion', 'Detalle', 'Cant.', 'Valor', 'Cargo', 'Total'],
    colWidths: [width * 0.28, width * 0.24, width * 0.08, width * 0.12, width * 0.11, width * 0.17],
    columnFields: ['description', 'detail', 'quantity', 'price', 'tax', 'amount'],
    headerFill: [237, 242, 247],
    headerText: textMuted,
    rowStripe: [250, 252, 255],
  });

  y += 14;
  const notesWidth = width * 0.58;
  ensurePageSpace(Math.max((model.notesLines || ['']).length * 13 + 92, 120));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.2);
  doc.setTextColor(textPrimary[0], textPrimary[1], textPrimary[2]);
  doc.text(model.notesTitle || 'Instrucciones y notas', left, y);
  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.3);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  (model.notesLines || ['Documento listo para entrega, archivo o distribucion.']).forEach(line => {
    doc.text(doc.splitTextToSize(line, notesWidth - 8), left, y, { maxWidth: notesWidth - 8 });
    y += 13;
  });

  const emphasisFill: PlatformPdfRgb = [248, 250, 252];
  const totalBottom = drawTotalsColumn({
    x: left + notesWidth + 18,
    startY: y - ((model.notesLines || ['']).length * 13 + 8),
    boxWidth: width - notesWidth - 18,
    emphasisFill,
  });

  emitFooter(Math.max(y, totalBottom) + 16);
};
