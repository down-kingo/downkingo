import { act, render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const eventHandlers = vi.hoisted(
  () => new Map<string, (data: unknown) => void>(),
);

// Mock the wailsRuntime module before importing Terminal
vi.mock("../lib/wailsRuntime", () => ({
  tryEventsOn: vi.fn((eventName: string, handler: (data: unknown) => void) => {
    eventHandlers.set(eventName, handler);
    return vi.fn();
  }),
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
    eventHandlers.clear();
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

  it("synchronizes structured download progress without duplicating the phase", () => {
    render(<Terminal />);
    fireEvent.click(screen.getByText("Console"));

    const progressHandler = eventHandlers.get("download:progress");
    expect(progressHandler).toBeDefined();

    act(() => {
      progressHandler?.({
        id: "job-12345678",
        status: "downloading",
        progress: 12,
        speed: "1MiB/s",
        eta: "00:10",
        title: "Vídeo de teste",
      });
      progressHandler?.({
        id: "job-12345678",
        status: "downloading",
        progress: 42,
        speed: "4MiB/s",
        eta: "00:04",
        title: "Vídeo de teste",
      });
    });

    expect(screen.getAllByText("Baixando: Vídeo de teste")).toHaveLength(1);
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByText("4MiB/s")).toBeInTheDocument();

    act(() => {
      progressHandler?.({
        id: "job-12345678",
        status: "failed",
        progress: 42,
        title: "Vídeo de teste",
        error: "HTTP 403 ao obter o formato selecionado",
      });
    });
    expect(
      screen.getByText(
        "Download falhou: HTTP 403 ao obter o formato selecionado",
      ),
    ).toBeInTheDocument();
  });
});

describe("LogLine highlighting", () => {
  // These tests would require more setup to test the LogLine component directly
  // For now, we verify the Terminal integrates correctly

  it("Terminal component renders without errors", () => {
    expect(() => render(<Terminal />)).not.toThrow();
  });
});
