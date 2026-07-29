import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./button";

describe("Button", () => {
  it("renders its children", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("applies the default variant + size classes", () => {
    render(<Button>Default</Button>);
    const button = screen.getByRole("button");
    expect(button.className).toMatch(/bg-primary/);
    expect(button.className).toMatch(/h-9/); // default size
  });

  it("applies the destructive variant when requested", () => {
    render(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole("button").className).toMatch(/bg-destructive/);
  });

  it("applies size classes", () => {
    render(<Button size="sm">Small</Button>);
    expect(screen.getByRole("button").className).toMatch(/h-8/);
    expect(screen.getByRole("button").className).toMatch(/px-3/);
  });

  it("fires onClick handlers", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is disabled and non-interactive when the disabled prop is set", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Disabled
      </Button>,
    );
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("forwards arbitrary props like data-testid", () => {
    render(<Button data-testid="cta">Go</Button>);
    expect(screen.getByTestId("cta")).toBeInTheDocument();
  });

  it("merges the variant classes onto a child element when asChild is set", () => {
    render(
      <Button asChild>
        <a href="/somewhere">Link</a>
      </Button>,
    );
    // No <button> is rendered — Slot renders the supplied child.
    expect(screen.queryByRole("button")).toBeNull();
    const link = screen.getByRole("link", { name: "Link" });
    expect(link).toHaveAttribute("href", "/somewhere");
    expect(link.className).toMatch(/bg-primary/);
  });
});
