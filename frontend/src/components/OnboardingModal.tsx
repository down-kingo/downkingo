import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconGlobe,
  IconSun,
  IconMoon,
  IconCheck,
  IconDownload,
  IconAlertTriangle,
  IconPalette,
} from "@tabler/icons-react";
import {
  useSettingsStore,
  Language,
  Theme,
  AppColor,
} from "../stores/settingsStore";
import { useTranslation, Trans } from "react-i18next";
import { Logo } from "./Logo";

// Language options with country codes for flags
const LANGUAGES: { code: Language; name: string; country: string }[] = [
  { code: "en-US", name: "English", country: "US" },
  { code: "pt-BR", name: "Português", country: "BR" },
  { code: "es-ES", name: "Español", country: "ES" },
  { code: "fr-FR", name: "Français", country: "FR" },
  { code: "de-DE", name: "Deutsch", country: "DE" },
];

// Theme options with icons
const THEMES: { value: Theme; label: string; Icon: typeof IconSun }[] = [
  { value: "light", label: "Light", Icon: IconSun },
  { value: "dark", label: "Dark", Icon: IconMoon },
];

const COLORS: AppColor[] = ["red", "blue", "green", "orange", "purple"];
const COLOR_MAP: Record<AppColor, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  orange: "bg-orange-500",
  purple: "bg-purple-500",
};

export default function OnboardingModal() {
  const { t, i18n } = useTranslation("common");
  const {
    language,
    theme,
    primaryColor,
    setLanguage,
    setSetting,
    setPrimaryColor,
    completeOnboarding,
    hasCompletedOnboarding,
  } = useSettingsStore();

  const [selectedLanguage, setSelectedLanguage] = useState<Language>(language);
  const [selectedTheme, setSelectedTheme] = useState<Theme>(theme);
  const [selectedColor, setSelectedColor] = useState<AppColor>(primaryColor);
  const [dontShowDisclaimer, setDontShowDisclaimer] = useState(false);

  // Don't show if onboarding is completed
  if (hasCompletedOnboarding) return null;

  const handleComplete = () => {
    // Save disclaimer preference
    if (dontShowDisclaimer) {
      localStorage.setItem("kingo_disclaimer_accepted", "true");
    }

    // Mark onboarding as complete
    completeOnboarding();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] grid place-items-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-2xl bg-white dark:bg-[#121214] border border-transparent dark:border-white/5 rounded-2xl shadow-2xl overflow-hidden my-4"
        >
          <div className="p-8">
            {/* Header */}
            <div className="flex flex-col items-center text-center mb-8">
              <Logo size={56} className="mb-3 shadow-xl shadow-black/20" />
              <h2 className="text-2xl font-bold text-surface-900 dark:text-white font-display">
                {t("onboarding.title", "Welcome to DownKingo")}
              </h2>
              <p className="text-base text-surface-500 dark:text-surface-400 mt-1">
                {t("onboarding.subtitle", "Let's set up your experience")}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {/* Coluna 1: Idioma */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-surface-700 dark:text-gray-200 mb-3 px-1">
                  <IconGlobe size={16} />
                  {t("onboarding.language", "Language")}
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {LANGUAGES.slice(0, 4).map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setSelectedLanguage(lang.code);
                        setLanguage(lang.code);
                      }}
                      className={`
                        flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-all
                        ${
                          selectedLanguage === lang.code
                            ? "bg-primary-50 dark:bg-[#27272a] text-primary-700 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                            : "text-surface-600 dark:text-white/60 hover:bg-surface-100 dark:hover:bg-[#27272a]/50 hover:text-surface-900 dark:hover:text-white"
                        }
                      `}
                    >
                      <span className="text-xl leading-none shadow-sm rounded overflow-hidden">
                        {lang.country === "US"
                          ? "🇺🇸"
                          : lang.country === "BR"
                          ? "🇧🇷"
                          : lang.country === "ES"
                          ? "🇪🇸"
                          : "🇫🇷"}
                      </span>
                      <span className="flex-1 text-left">{lang.name}</span>
                      {selectedLanguage === lang.code && (
                        <div className="w-1.5 h-1.5 rounded-full bg-primary-600 dark:bg-primary-500" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Coluna 2: Visual (Tema + Cor) */}
              <div className="space-y-6">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-surface-700 dark:text-gray-200 mb-3 px-1">
                    {selectedTheme === "light" ? (
                      <IconSun size={16} />
                    ) : (
                      <IconMoon size={16} />
                    )}
                    {t("onboarding.theme", "Theme")}
                  </label>
                  <div className="flex gap-2 p-1 bg-surface-100 dark:bg-[#18181b] rounded-xl border border-surface-200 dark:border-white/5">
                    {THEMES.map((themeOption) => {
                      const Icon = themeOption.Icon;
                      const isActive = selectedTheme === themeOption.value;
                      return (
                        <button
                          key={themeOption.value}
                          onClick={() => {
                            setSelectedTheme(themeOption.value);
                            setSetting("theme", themeOption.value);
                          }}
                          className={`
                            flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all
                            ${
                              isActive
                                ? "bg-white dark:bg-[#27272a] text-surface-900 dark:text-white shadow-sm"
                                : "text-surface-500 dark:text-white/60 hover:text-surface-700 dark:hover:text-white"
                            }
                          `}
                        >
                          <Icon size={18} />
                          <span>{themeOption.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-surface-700 dark:text-gray-200 mb-3 px-1">
                    <IconPalette size={16} />
                    <span>Cor de Destaque</span>
                  </label>
                  <div className="flex items-center justify-between px-2 py-2 bg-surface-50 dark:bg-[#18181b] rounded-xl border border-surface-200 dark:border-white/5">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => {
                          setSelectedColor(color);
                          setPrimaryColor(color);
                          document.documentElement.setAttribute(
                            "data-color",
                            color
                          );
                        }}
                        className={`
                          w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300
                          ${COLOR_MAP[color]}
                          ${
                            selectedColor === color
                              ? "ring-2 ring-offset-2 ring-surface-400 dark:ring-surface-500 scale-110"
                              : "hover:scale-110 opacity-70 hover:opacity-100 scale-90"
                          }
                        `}
                      >
                        {selectedColor === color && (
                          <div className="w-2.5 h-2.5 bg-white rounded-full shadow-sm" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Disclaimer Section */}
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 mb-6">
              <div className="flex items-start gap-3">
                <IconAlertTriangle
                  size={20}
                  className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0"
                />
                <div className="text-xs text-amber-900 dark:text-amber-100 leading-relaxed opacity-100 font-medium">
                  <p className="mb-2">{t("disclaimer.text1")}</p>
                  <p>
                    <Trans
                      i18nKey="disclaimer.text2"
                      t={t}
                      components={{
                        0: (
                          <strong className="font-bold text-amber-950 dark:text-white" />
                        ),
                      }}
                    />
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Don't show disclaimer checkbox */}
              <label className="flex items-center gap-3 p-2 -ml-2 rounded-lg cursor-pointer group hover:opacity-80 transition-opacity">
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={dontShowDisclaimer}
                    onChange={(e) => setDontShowDisclaimer(e.target.checked)}
                    className="peer appearance-none w-5 h-5 rounded border border-surface-300 dark:border-white/20 bg-white dark:bg-white/5 checked:bg-primary-600 checked:border-primary-600 focus:ring-2 focus:ring-primary-500/30 transition-all cursor-pointer"
                  />
                  <IconCheck
                    size={12}
                    className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity font-bold"
                    stroke={3}
                  />
                </div>
                <span className="text-sm text-surface-600 dark:text-gray-300 font-medium select-none">
                  {t("disclaimer.dont_show_again")}
                </span>
              </label>

              {/* Get Started Button */}
              <button
                onClick={handleComplete}
                className="w-full sm:w-auto px-8 py-3 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold rounded-xl transition-all transform active:scale-[0.98] shadow-lg shadow-primary-600/20"
              >
                {t("onboarding.get_started", "Get Started")}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
