import { describe, expect, it } from "vitest";
import {
  EMAIL_TEMPLATES,
  getEmailTemplate,
  isEmailTemplateId,
  renderEmailTemplate,
  renderTemplate,
  subjectNamePart,
  subjectPart,
} from "../src/services/emailTemplateStore";

describe("emailTemplateStore", () => {
  describe("renderTemplate", () => {
    it("substitutes known tokens", () => {
      expect(
        renderTemplate("Hi {{studentName}}, welcome", { studentName: "Alex" }),
      ).toBe("Hi Alex, welcome");
    });

    it("leaves unknown tokens untouched", () => {
      expect(
        renderTemplate("Hi {{studentName}}, {{missing}}", {
          studentName: "Alex",
        }),
      ).toBe("Hi Alex, {{missing}}");
    });

    it("substitutes empty string values", () => {
      expect(
        renderTemplate("A{{subjectPart}}B", { subjectPart: "" }),
      ).toBe("AB");
    });
  });

  describe("isEmailTemplateId / getEmailTemplate", () => {
    it("recognises all registered ids", () => {
      for (const id of Object.keys(EMAIL_TEMPLATES)) {
        expect(isEmailTemplateId(id)).toBe(true);
      }
    });

    it("rejects unknown ids", () => {
      expect(isEmailTemplateId("nope")).toBe(false);
    });

    it("returns a template object with subject and body", () => {
      const t = getEmailTemplate("cancellation");
      expect(t.subject).toContain("{{subjectPart}}");
      expect(t.body).toContain("{{studentName}}");
    });
  });

  describe("renderEmailTemplate", () => {
    it("renders subject and body with token values", () => {
      const { subject, body } = renderEmailTemplate("lesson-reminder", {
        studentName: "Alex",
        subjectPart: ": Mathematics",
        tutorName: "Jordan",
        start: "Monday, July 13, 2026, 8:00 PM",
      });
      expect(subject).toBe(
        "Lesson reminder: Mathematics with Jordan on Monday, July 13, 2026, 8:00 PM",
      );
      expect(body).toBe(
        "Hi Alex,\n\nThis is a reminder about our upcoming lesson.",
      );
    });

    it("renders the reschedule variant", () => {
      const { subject, body } = renderEmailTemplate("reschedule", {
        studentName: "Alex",
        subjectPart: "",
        tutorName: "Jordan",
        start: "Tuesday, July 14, 2026, 4:00 PM",
      });
      expect(subject).toBe(
        "Lesson time updated with Jordan on Tuesday, July 14, 2026, 4:00 PM",
      );
      expect(body).toContain("The time for our upcoming lesson has changed.");
    });

    it("renders the invoice body including pay line", () => {
      const { subject, body } = renderEmailTemplate("invoice", {
        customerName: "Carter Family",
        invoiceNumber: "INV-0001",
        total: "$45.00",
        payLineText: "You can pay securely online with a card here: https://pay\n\n",
        fromName: "Jordan Lee",
      });
      expect(subject).toBe("Invoice INV-0001 from Jordan Lee");
      expect(body).toBe(
        "Hi Carter Family,\n\nPlease find your invoice INV-0001 attached. The amount due is $45.00.\n\nYou can pay securely online with a card here: https://pay\n\nThank you,\nJordan Lee",
      );
    });

    it("renders the invoice body without a pay line", () => {
      const { body } = renderEmailTemplate("invoice", {
        customerName: "Carter Family",
        invoiceNumber: "INV-0001",
        total: "$45.00",
        payLineText: "",
        fromName: "Jordan Lee",
      });
      expect(body).toBe(
        "Hi Carter Family,\n\nPlease find your invoice INV-0001 attached. The amount due is $45.00.\n\nThank you,\nJordan Lee",
      );
    });
  });

  describe("subjectPart / subjectNamePart", () => {
    it("formats subject fragments", () => {
      expect(subjectPart("Mathematics")).toBe(": Mathematics");
      expect(subjectPart("")).toBe("");
      expect(subjectPart(null)).toBe("");
      expect(subjectPart(undefined)).toBe("");
      expect(subjectNamePart("Mathematics")).toBe(" Mathematics");
      expect(subjectNamePart(null)).toBe("");
    });
  });
});
