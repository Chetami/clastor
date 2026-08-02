import { describe, it, expect, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import {
  useInvoiceLesson,
  buildLessonDescription,
} from "@examify-tms/shared";
import type {
  InvoiceResponse,
  LessonResponse,
} from "@examify-tms/interfaces";
import { renderHookWithProviders } from "../test-utils";
import { server } from "../server";

/** A finished, unpaid, uninvoiced lesson ready to bill. */
const baseLesson = {
  id: "lesson_1",
  studentId: "stu_1",
  subject: "Mathematics",
  startDateTime: "2026-06-20T12:00:00.000Z",
  durationMinutes: 90,
} as unknown as LessonResponse;

describe("useInvoiceLesson (integration, MSW-backed)", () => {
  let createBody: Record<string, unknown> | undefined;
  let sentInvoiceId: string | undefined;

  beforeEach(() => {
    createBody = undefined;
    sentInvoiceId = undefined;

    // Order matters: register the more specific `/send` route first so the
    // bare `/api/payments` create route can't accidentally swallow it.
    server.use(
      http.post("*/api/payments/:id/send", ({ params }) => {
        sentInvoiceId = params.id as string;
        return HttpResponse.json({ id: params.id, status: "open" });
      }),
      http.post("*/api/payments", async ({ request }) => {
        createBody = (await request.json()) as Record<string, unknown>;
        const created = {
          id: "inv_1",
          studentId: "stu_1",
          status: "open",
        } as unknown as InvoiceResponse;
        return HttpResponse.json(created);
      }),
    );
  });

  it("creates a finalised invoice with the canonical line item then emails it", async () => {
    const { result } = renderHookWithProviders(() => useInvoiceLesson());

    const created = await result.current.value.mutateAsync({
      lesson: baseLesson,
      rateType: "hourly",
      expectedAmount: 60,
    });

    // Returned the created invoice.
    expect(created.id).toBe("inv_1");
    await waitFor(() =>
      expect(result.current.value.isSuccess).toBe(true),
    );

    // Create request used the single source of truth for every field.
    expect(createBody).toBeDefined();
    expect(createBody!.studentId).toBe("stu_1");
    expect(createBody!.paymentMethod).toBe("bank_transfer");
    expect(createBody!.status).toBe("open");

    const lineItems = createBody!.lineItems as Array<Record<string, unknown>>;
    expect(lineItems).toHaveLength(1);
    expect(lineItems[0]).toMatchObject({
      lessonId: "lesson_1",
      durationMinutes: 90,
      rateType: "hourly",
      unitAmount: 60,
      quantity: 1.5,
      description: buildLessonDescription(baseLesson),
    });

    // Due date honours the shared default (14 days out).
    const diffDays =
      (new Date(createBody!.dueDate as string).getTime() - Date.now()) /
      (24 * 60 * 60 * 1000);
    expect(diffDays).toBeGreaterThan(13.9);
    expect(diffDays).toBeLessThan(14.1);

    // And the invoice was emailed.
    expect(sentInvoiceId).toBe("inv_1");
  });
});
