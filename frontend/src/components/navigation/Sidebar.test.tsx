import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Sidebar, { TabType } from "./Sidebar";

// Mock the settings store
vi.mock("../../stores/settingsStore", () => ({
  useSettingsStore: () => ({
    language: "pt-BR",
  }),
}));

describe("Sidebar", () => {
  const defaultProps = {
    activeTab: "home" as TabType,
    setActiveTab: vi.fn(),
    queueCount: 0,
    version: "2.0.0",
    onOpenSettings: vi.fn(),
  };

  it("renders the brand name", () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText("Kingo")).toBeInTheDocument();
  });

  it("renders the version number", () => {
    render(<Sidebar {...defaultProps} version="1.5.0" />);
    expect(screen.getByText("v1.5.0")).toBeInTheDocument();
  });

  it("shows queue count badge when queueCount > 0", () => {
    render(<Sidebar {...defaultProps} queueCount={5} />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("does not show queue badge when queueCount is 0", () => {
    render(<Sidebar {...defaultProps} queueCount={0} />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("highlights active tab", () => {
    render(<Sidebar {...defaultProps} activeTab="video" />);
    const videoButton = screen.getByText("Vídeos").closest("button");
    expect(videoButton).toHaveClass("active");
  });

  it("calls setActiveTab when clicking a tab", () => {
    const mockSetActiveTab = vi.fn();
    render(<Sidebar {...defaultProps} setActiveTab={mockSetActiveTab} />);

    fireEvent.click(screen.getByText("Vídeos"));
    expect(mockSetActiveTab).toHaveBeenCalledWith("video");

    fireEvent.click(screen.getByText("Imagens"));
    expect(mockSetActiveTab).toHaveBeenCalledWith("images");

    fireEvent.click(screen.getByText("Converter"));
    expect(mockSetActiveTab).toHaveBeenCalledWith("converter");

    fireEvent.click(screen.getByText("Histórico"));
    expect(mockSetActiveTab).toHaveBeenCalledWith("history");
  });

  it("calls onOpenSettings when clicking settings button", () => {
    const mockOnOpenSettings = vi.fn();
    render(<Sidebar {...defaultProps} onOpenSettings={mockOnOpenSettings} />);

    // Find and click the settings button
    const settingsButton = screen.getByText("Configurações").closest("button");
    if (settingsButton) {
      fireEvent.click(settingsButton);
      expect(mockOnOpenSettings).toHaveBeenCalled();
    }
  });

  it("renders all navigation sections", () => {
    render(<Sidebar {...defaultProps} />);

    expect(screen.getByText("Downloads")).toBeInTheDocument();
    expect(screen.getByText("Conversão")).toBeInTheDocument();
    expect(screen.getByText("Biblioteca")).toBeInTheDocument();
  });
});
