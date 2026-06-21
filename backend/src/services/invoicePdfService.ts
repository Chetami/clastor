import PDFDocument from "pdfkit";
import { Invoice, PaymentMethod } from "@examify-tms/interfaces";

/**
 * Invoice PDF generation.
 *
 * A single, app-defined (not user-customisable) template rendered with pdfkit
 * so it works in lightweight hosting environments (no Chromium required). The
 * same render path is used for the emailed attachment and the in-app print /
 * download view, guaranteeing they always match.
 */

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  card: "Card",
  stripe: "Stripe",
};

const PAGE_WIDTH = 595.28; // A4 in points (72dpi)

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export interface InvoicePdfContext {
  /** Display name of the tutor/business issuing the invoice. */
  tutorName?: string | null;
  /** Reply-to email shown to the customer. */
  tutorEmail?: string | null;
}

/**
 * Render an invoice to a PDF and return it as a Buffer. Throws if pdfkit fails
 * mid-render so the caller can surface the error.
 */
export function generateInvoicePdf(
  invoice: Invoice,
  context: InvoicePdfContext = {}
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const fromName = context.tutorName || "Invoice";

      // ---- Header -------------------------------------------------------
      doc
        .fontSize(24)
        .font("Helvetica-Bold")
        .text("INVOICE", 50, 50, { align: "left" });

      doc
        .fontSize(11)
        .font("Helvetica")
        .fillColor("#6b7280")
        .text(`From: ${fromName}`, 50, 82);
      if (context.tutorEmail) {
        doc.text(context.tutorEmail, 50, 97);
      }

      doc.fillColor("#111827");

      // ---- Invoice meta (top-right) ------------------------------------
      const metaX = 360;
      let metaY = 50;
      doc.fontSize(11).font("Helvetica-Bold").text("Invoice #", metaX, metaY);
      doc
        .font("Helvetica")
        .text(invoice.invoiceNumber, metaX + 90, metaY, { width: 90, align: "right" });
      metaY += 18;

      doc.font("Helvetica-Bold").text("Issued", metaX, metaY);
      doc
        .font("Helvetica")
        .text(formatDate(new Date(invoice.issueDate as any)), metaX + 90, metaY, {
          width: 90,
          align: "right",
        });
      metaY += 18;

      doc.font("Helvetica-Bold").text("Due", metaX, metaY);
      doc
        .font("Helvetica")
        .text(formatDate(new Date(invoice.dueDate as any)), metaX + 90, metaY, {
          width: 90,
          align: "right",
        });

      // ---- Bill to ------------------------------------------------------
      let y = 150;
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#6b7280").text("BILL TO", 50, y);
      doc
        .fontSize(13)
        .font("Helvetica-Bold")
        .fillColor("#111827")
        .text(invoice.customerName, 50, y + 16);
      if (invoice.billingEmail) {
        doc
          .fontSize(11)
          .font("Helvetica")
          .fillColor("#6b7280")
          .text(invoice.billingEmail, 50, y + 36);
      }

      // ---- Line items table --------------------------------------------
      y = 230;
      const colX = { desc: 50, qty: 340, unit: 410, amount: 500 };
      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .fillColor("#6b7280")
        .text("DESCRIPTION", colX.desc, y);
      doc.text("QTY", colX.qty, y, { width: 60, align: "right" });
      doc.text("UNIT", colX.unit, y, { width: 80, align: "right" });
      doc.text("AMOUNT", colX.amount, y, { width: 45, align: "right" });

      // Underline the header row.
      doc
        .moveTo(50, y + 14)
        .lineTo(PAGE_WIDTH - 50, y + 14)
        .strokeColor("#e5e7eb")
        .lineWidth(1)
        .stroke();

      y += 24;
      doc.fillColor("#111827").font("Helvetica").fontSize(10);

      for (const li of invoice.lineItems) {
        if (y > 720) {
          doc.addPage();
          y = 50;
        }
        doc.text(li.description, colX.desc, y, { width: 280 });
        doc.text(String(li.quantity), colX.qty, y, { width: 60, align: "right" });
        doc.text(formatCurrency(li.unitAmount), colX.unit, y, {
          width: 80,
          align: "right",
        });
        doc.text(formatCurrency(li.amount), colX.amount, y, {
          width: 45,
          align: "right",
        });
        y += 22;
      }

      // ---- Totals -------------------------------------------------------
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      y += 6;
      doc
        .moveTo(50, y)
        .lineTo(PAGE_WIDTH - 50, y)
        .strokeColor("#e5e7eb")
        .lineWidth(1)
        .stroke();
      y += 16;

      const totalsX = 360;
      doc.font("Helvetica").fontSize(11).fillColor("#6b7280");
      doc.text("Subtotal", totalsX, y);
      doc
        .fillColor("#111827")
        .text(formatCurrency(invoice.subtotal), colX.amount - 5, y, {
          width: 50,
          align: "right",
        });
      y += 24;

      doc.font("Helvetica-Bold").fontSize(14).fillColor("#111827");
      doc.text("Total", totalsX, y);
      doc.text(formatCurrency(invoice.total), colX.amount - 5, y, {
        width: 50,
        align: "right",
      });

      if (invoice.paymentMethod && invoice.paymentMethod !== "cash") {
        y += 26;
        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor("#6b7280")
          .text(`Payment method: ${PAYMENT_METHOD_LABELS[invoice.paymentMethod]}`, 50, y);
      }

      // ---- Notes --------------------------------------------------------
      if (invoice.notes && invoice.notes.trim().length > 0) {
        y += 40;
        if (y > 740) {
          doc.addPage();
          y = 50;
        }
        doc.font("Helvetica-Bold").fontSize(10).fillColor("#6b7280").text("NOTES", 50, y);
        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor("#111827")
          .text(invoice.notes.trim(), 50, y + 16, { width: PAGE_WIDTH - 100 });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
