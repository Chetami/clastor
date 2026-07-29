import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./badge";

describe("Badge", () => {
  it("renders its children as text content", () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("applies the default variant classes", () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText("Default").className).toMatch(/bg-primary/);
  });

  it.each([
    ["secondary", /bg-secondary/],
    ["destructive", /bg-destructive/],
    ["success", /bg-emerald-500\/15/],
    ["warning", /bg-amber-500\/15/],
    ["muted", /bg-muted/],
  ] as const)("applies the %s variant classes", (variant, expectedClass) => {
    render(<Badge variant={variant}>x</Badge>);
    expect(screen.getByText("x").className).toMatch(expectedClass);
  });

  it("merges a consumer className (tailwind-merge friendly)", () => {
    render(
      <Badge className="text-purple-700" variant="outline">
        Custom
      </Badge>,
    );
    const node = screen.getByText("Custom");
    expect(node.className).toMatch(/text-purple-700/);
    // outline variant border is preserved alongside the custom class.
    expect(node.className).toMatch(/border/);
  });
});
