// Test setup file for Vitest + Testing Library
// This file runs before each test file

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock i18next for components using useTranslation
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      // Return common translation values for testing
      const translations: Record<string, string> = {
        "nav.console": "Console",
        "terminal.ready": "Ready to capture output...",
        "terminal.clear": "Clear",
        "terminal.maximize": "Maximize",
        "terminal.minimize": "Minimize",
      };
      return translations[key] || key;
    },
    i18n: {
      language: "en",
      changeLanguage: vi.fn(),
    },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

// Mock settings store for components using useSettingsStore
vi.mock("../stores/settingsStore", () => ({
  useSettingsStore: () => ({
    consoleEnabled: true,
    theme: "dark",
    hasCompletedOnboarding: true,
  }),
}));

// Mock Wails runtime for tests
// This prevents errors when components try to call Wails functions
const mockWailsRuntime = {
  EventsOn: vi.fn(() => () => {}),
  EventsOff: vi.fn(),
  EventsEmit: vi.fn(),
  ClipboardGetText: vi.fn(() => Promise.resolve("")),
  WindowMinimise: vi.fn(),
  WindowMaximise: vi.fn(),
  WindowUnmaximise: vi.fn(),
  WindowToggleMaximise: vi.fn(),
  Quit: vi.fn(),
};

// Inject mock runtime globally
Object.defineProperty(window, "runtime", {
  value: mockWailsRuntime,
  writable: true,
});

// Also handle the case where go functions are called directly
Object.defineProperty(window, "go", {
  value: {
    main: {
      App: new Proxy(
        {},
        {
          get: () => vi.fn(() => Promise.resolve({})),
        }
      ),
    },
  },
  writable: true,
});

// Mock ResizeObserver (not available in jsdom)
globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock matchMedia (not available in jsdom)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
