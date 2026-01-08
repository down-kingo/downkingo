import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark";
export type AppLayout = "sidebar" | "topbar";
export type AppColor = "red" | "blue" | "green" | "orange" | "purple";

export type Language = "pt-BR" | "en-US" | "es-ES" | "fr-FR" | "de-DE";
export type YtDlpChannel = "stable" | "nightly" | "master";
export type ImageFormat = "original" | "jpg" | "png" | "webp" | "avif";

// Compatibilidade de Codec
// "universal" = H.264 + AAC (funciona em QUALQUER player, TVs antigas, Windows Media Player)
// "modern" = VP9 + Opus (melhor qualidade/compressão, requer VLC ou player moderno)
export type VideoCompatibility = "universal" | "modern";

export interface ShortcutsConfig {
  focusInput: string;
  openSettings: string;
  openQueue: string;
  openHistory: string;
  openDownloads: string;
  openTerminal: string;
}

interface SettingsState {
  // Appearance
  theme: Theme;
  layout: AppLayout;
  primaryColor: AppColor;

  language: Language;

  // Shortcuts
  shortcuts: ShortcutsConfig;

  // Privacy
  anonymousMode: boolean; // Não salvar histórico

  // Download Options
  remuxVideo: boolean;
  remuxFormat: string;
  embedThumbnail: boolean;
  skipExisting: boolean;
  videoCompatibility: VideoCompatibility;
  useAria2c: boolean;
  aria2cConnections: number; // Número de conexões simultâneas (padrão 16)

  // Image Options
  imageFormat: ImageFormat;
  imageQuality: number; // 0-100

  // System
  autoUpdateYtDlp: boolean;
  ytDlpChannel: YtDlpChannel;
  autoUpdateApp: boolean;
  startWithWindows: boolean;
  clipboardMonitorEnabled: boolean;
  consoleEnabled: boolean; // Mostrar/ocultar console de logs
  hasCompletedOnboarding: boolean; // First-run setup completed

  // Actions
  toggleTheme: () => void;
  setLayout: (layout: AppLayout) => void;
  setPrimaryColor: (color: AppColor) => void;
  setLanguage: (lang: Language) => void;
  setAnonymousMode: (enabled: boolean) => void;
  setShortcuts: (shortcuts: ShortcutsConfig) => void;
  setSetting: (key: keyof SettingsState, value: any) => void;
  completeOnboarding: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "light",
      layout: "sidebar",
      primaryColor: "blue",
      language: "en-US", // English as default

      shortcuts: {
        focusInput: "Ctrl+L",
        openSettings: "Ctrl+,",
        openQueue: "Ctrl+Q",
        openHistory: "Ctrl+H",
        openDownloads: "Ctrl+D",
        openTerminal: "F12",
      },

      anonymousMode: false,

      remuxVideo: true,
      remuxFormat: "mp4",
      embedThumbnail: true,
      skipExisting: true,
      videoCompatibility: "universal",
      useAria2c: false,
      aria2cConnections: 16, // Padrão: 16 conexões simultâneas

      imageFormat: "original",
      imageQuality: 100,

      autoUpdateYtDlp: true,
      ytDlpChannel: "stable",
      autoUpdateApp: true,
      startWithWindows: false,
      clipboardMonitorEnabled: true,
      consoleEnabled: false, // Desativado por padrão
      hasCompletedOnboarding: false, // Show onboarding on first launch

      toggleTheme: () =>
        set((state) => ({ theme: state.theme === "light" ? "dark" : "light" })),

      setLayout: (layout) => set({ layout }),
      setPrimaryColor: (color) => set({ primaryColor: color }),

      setLanguage: (lang) => {
        // Sincroniza com i18next
        import("../i18n").then((module) => {
          module.default.changeLanguage(lang);
        });
        set({ language: lang });
      },

      setAnonymousMode: (enabled) => set({ anonymousMode: enabled }),

      setShortcuts: (shortcuts) => set({ shortcuts }),

      setSetting: (key, value) => set((state) => ({ ...state, [key]: value })),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
    }),
    {
      name: "kingo-settings-v3", // v3: Light theme default + unified onboarding
    }
  )
);
