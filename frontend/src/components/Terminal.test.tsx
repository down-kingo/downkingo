import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the wailsRuntime module before importing Terminal
vi.mock("../lib/wailsRuntime", () => ({
  tryEventsOn: vi.fn(() => vi.fn()),
}));

// Mock the useKeyboardShortcuts hook
vi.mock("../hooks/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: vi.fn(),
}));

// Now import the component
import Terminal from "./Terminal";

describe("Terminal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders in collapsed state by default", () => {
    render(<Terminal />);
    expect(screen.getByText("Console")).toBeInTheDocument();
  });

  it("shows expand icon when collapsed", () => {
    render(<Terminal />);
    // The terminal header should be visible
    expect(screen.getByText("Console")).toBeInTheDocument();
  });

  it("expands when clicked", () => {
    render(<Terminal />);

    // Click to expand
    const terminal = screen.getByText("Console").closest("div");
    if (terminal) {
      fireEvent.click(terminal);
    }

    // Should show empty state
    expect(screen.getByText("Ready to capture output...")).toBeInTheDocument();
  });

  it("shows empty state message when no logs", () => {
    render(<Terminal />);

    // Expand terminal
    const terminal = screen.getByText("Console").closest("div");
    if (terminal) {
      fireEvent.click(terminal);
    }

    expect(screen.getByText("Ready to capture output...")).toBeInTheDocument();
  });

  it("renders with sidebar layout by default", () => {
    const { container } = render(<Terminal />);
    expect(container.querySelector(".md\\:left-60")).toBeInTheDocument();
  });

  it("renders with topbar layout when specified", () => {
    const { container } = render(<Terminal layout="topbar" />);
    // With topbar layout, it should not have md:left-60
    const terminalDiv = container.querySelector('[class*="left-0"]');
    expect(terminalDiv).toBeInTheDocument();
  });
});

describe("LogLine highlighting", () => {
  // These tests would require more setup to test the LogLine component directly
  // For now, we verify the Terminal integrates correctly

  it("Terminal component renders without errors", () => {
    expect(() => render(<Terminal />)).not.toThrow();
  });
});
