import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark";
export type AppLayout = "sidebar" | "topbar";
export type AppColor = "red" | "blue" | "green" | "orange" | "purple";

export type Language = "pt-BR" | "en-US" | "es-ES" | "fr-FR" | "de-DE";
export type YtDlpChannel = "stable" | "nightly" | "master";
export type ImageFormat = "original" | "jpg" | "png" | "webp" | "avif";
export type FeatureId = "videos" | "images" | "converter" | "transcriber";

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
  anonymousMode: boolean; // Desativa rastreamento de uso (telemetria)

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
  enabledFeatures: FeatureId[];
  hasCompletedOnboarding: boolean; // First-run setup completed

  // Actions
  toggleTheme: () => void;
  setLayout: (layout: AppLayout) => void;
  setPrimaryColor: (color: AppColor) => void;
  setLanguage: (lang: Language) => void;
  setAnonymousMode: (enabled: boolean) => void;
  setShortcuts: (shortcuts: ShortcutsConfig) => void;
  setSetting: (key: keyof SettingsState, value: any) => void;
  /**
   * Substitui a lista inteira de features habilitadas.
   * Ignora silenciosamente se o array resultante for vazio (mínimo 1).
   */
  setEnabledFeatures: (features: FeatureId[]) => void;
  /**
   * Alterna uma feature individual.
   * Regra de negócio: não permite desabilitar se for a última ativa.
   * Esta é a única implementação correta — use-a em vez de reimplementar localmente.
   */
  toggleFeature: (id: FeatureId) => void;
  completeOnboarding: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "light",
      layout: "sidebar",
      primaryColor: "red",
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
      enabledFeatures: [
        "videos",
        "images",
        "converter",
        "transcriber",
      ] as FeatureId[],
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

      setEnabledFeatures: (features) => {
        // Guardrail: nunca aceita array vazio — mínimo 1 feature obrigatória
        if (features.length === 0) return;
        set({ enabledFeatures: features });
      },

      toggleFeature: (id) =>
        set((state) => {
          const current = state.enabledFeatures;
          if (current.includes(id)) {
            // Regra de negócio: não permite desabilitar a última feature ativa
            if (current.length <= 1) return state;
            return { enabledFeatures: current.filter((f) => f !== id) };
          }
          return { enabledFeatures: [...current, id] };
        }),

      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
    }),
    {
      name: "kingo-settings-v3", // v3: Light theme default + unified onboarding
    },
  ),
);
