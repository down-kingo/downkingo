import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Sidebar, { TabType } from "./Sidebar";

// Mock the settings store
vi.mock("../../stores/settingsStore", () => ({
  useSettingsStore: () => ({
    language: "pt-BR",
  }),
}));

// Mock translations with consistent debug keys
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "nav.home": "TEXT_HOME",
        "nav.queue": "TEXT_QUEUE",
        "nav.videos": "TEXT_VIDEOS",
        "nav.images": "TEXT_IMAGES",
        "nav.converter": "TEXT_CONVERTER",
        "nav.history": "TEXT_HISTORY",
        "nav.roadmap": "TEXT_ROADMAP",
        "nav.settings": "TEXT_SETTINGS",
      };
      return map[key] || key;
    },
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
    const videoButton = screen.getByText("TEXT_VIDEOS").closest("button");
    expect(videoButton).toHaveClass("active");
  });

  it("calls setActiveTab when clicking a tab", () => {
    const mockSetActiveTab = vi.fn();
    render(<Sidebar {...defaultProps} setActiveTab={mockSetActiveTab} />);

    fireEvent.click(screen.getByText("TEXT_VIDEOS"));
    expect(mockSetActiveTab).toHaveBeenCalledWith("video");

    fireEvent.click(screen.getByText("TEXT_IMAGES"));
    expect(mockSetActiveTab).toHaveBeenCalledWith("images");

    const converters = screen.getAllByText("TEXT_CONVERTER");
    const converterButton = converters.find((el) => el.closest("button"));
    if (converterButton) fireEvent.click(converterButton);
    expect(mockSetActiveTab).toHaveBeenCalledWith("converter");

    const histories = screen.getAllByText("TEXT_HISTORY");
    const historyButton = histories.find((el) => el.closest("button"));
    if (historyButton) fireEvent.click(historyButton);
    expect(mockSetActiveTab).toHaveBeenCalledWith("history");
  });

  it("calls onOpenSettings when clicking settings button", () => {
    const mockOnOpenSettings = vi.fn();
    render(<Sidebar {...defaultProps} onOpenSettings={mockOnOpenSettings} />);

    const settingsButton = screen.getByText("TEXT_SETTINGS").closest("button");
    if (settingsButton) {
      fireEvent.click(settingsButton);
      expect(mockOnOpenSettings).toHaveBeenCalled();
    }
  });

  it("renders all navigation sections", () => {
    render(<Sidebar {...defaultProps} />);

    expect(screen.getByText("Downloads")).toBeInTheDocument();
    expect(screen.getAllByText("TEXT_CONVERTER").length).toBeGreaterThan(0);
    expect(screen.getAllByText("TEXT_HISTORY").length).toBeGreaterThan(0);
    expect(screen.getAllByText("TEXT_ROADMAP").length).toBeGreaterThan(0);
  });
});
