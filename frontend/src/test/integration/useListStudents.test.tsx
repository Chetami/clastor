import { describe, it, expect, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";
import { useListStudents } from "@examify-tms/shared";
import { renderHookWithProviders } from "../test-utils";
import { server, studentsErrorHandlers } from "../server";

describe("useListStudents (integration, MSW-backed)", () => {
  beforeEach(() => {
    // Default handlers are reset after each test; this is just defensive.
    server.resetHandlers();
  });

  it("exposes a loading state, then resolves the student list", async () => {
    const { result } = renderHookWithProviders(() => useListStudents());

    expect(result.current.value.isLoading).toBe(true);
    expect(result.current.value.data).toBeUndefined();

    await waitFor(() => expect(result.current.value.isSuccess).toBe(true));

    expect(result.current.value.data).toHaveLength(2);
    expect(result.current.value.data?.map((s) => s.name)).toEqual([
      "Ada Lovelace",
      "Alan Turing",
    ]);
  });

  it("surfaces an error state when the API fails", async () => {
    server.use(...studentsErrorHandlers(500));

    const { result } = renderHookWithProviders(() => useListStudents());

    await waitFor(() => expect(result.current.value.isError).toBe(true));
    expect(result.current.value.data).toBeUndefined();
  });
});
