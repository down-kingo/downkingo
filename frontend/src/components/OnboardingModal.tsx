import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconGlobe,
  IconSun,
  IconMoon,
  IconCheck,
  IconAlertTriangle,
  IconPalette,
  IconArrowRight,
} from "@tabler/icons-react";
import {
  useSettingsStore,
  Language,
  Theme,
  AppColor,
} from "../stores/settingsStore";
import { useTranslation, Trans } from "react-i18next";
import { Logo } from "./Logo";

const LANGUAGES: { code: Language; name: string; country: string }[] = [
  { code: "en-US", name: "English", country: "US" },
  { code: "pt-BR", name: "Português", country: "BR" },
  { code: "es-ES", name: "Español", country: "ES" },
  { code: "fr-FR", name: "Français", country: "FR" },
  { code: "de-DE", name: "Deutsch", country: "DE" },
];

const FLAG_EMOJI: Record<string, string> = {
  US: "\u{1F1FA}\u{1F1F8}",
  BR: "\u{1F1E7}\u{1F1F7}",
  ES: "\u{1F1EA}\u{1F1F8}",
  FR: "\u{1F1EB}\u{1F1F7}",
  DE: "\u{1F1E9}\u{1F1EA}",
};

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
  const { t } = useTranslation("common");
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

  if (hasCompletedOnboarding) return null;

  const handleComplete = () => {
    if (dontShowDisclaimer) {
      localStorage.setItem("kingo_disclaimer_accepted", "true");
    }
    completeOnboarding();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-3xl bg-white dark:bg-[#121214] border border-transparent dark:border-white/5 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-surface-100 dark:border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

            <div className="flex items-start gap-4 relative z-10">
              <Logo size={48} className="shadow-lg shadow-black/20" />
              <div>
                <h2 className="text-xl font-bold text-surface-900 dark:text-white">
                  {t("onboarding.title", "Welcome to DownKingo")}
                </h2>
                <p className="text-sm text-surface-500 dark:text-surface-400 mt-1 font-medium">
                  {t("onboarding.subtitle", "Let's set up your experience")}
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Column 1: Language */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-surface-500 dark:text-surface-400 mb-3 flex items-center gap-2">
                  <IconGlobe size={14} />
                  {t("onboarding.language", "Language")}
                </h3>
                <div className="bg-white dark:bg-surface-100 border border-surface-200 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm dark:shadow-none">
                  <div className="divide-y divide-surface-100 dark:divide-white/5">
                    {LANGUAGES.map((lang) => {
                      const isActive = selectedLanguage === lang.code;
                      return (
                        <button
                          key={lang.code}
                          onClick={() => {
                            setSelectedLanguage(lang.code);
                            setLanguage(lang.code);
                          }}
                          className={`
                            w-full flex items-center gap-3 p-3.5 text-sm font-medium transition-colors group
                            ${
                              isActive
                                ? "bg-primary-50 dark:bg-primary-500/10 text-surface-900 dark:text-white"
                                : "text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-200/50"
                            }
                          `}
                        >
                          <div
                            className={`
                              w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0 transition-transform group-hover:scale-105
                              ${
                                isActive
                                  ? "bg-white dark:bg-white/10 border border-primary-200 dark:border-primary-500/20 shadow-sm"
                                  : "bg-surface-100 dark:bg-white/5 border border-transparent dark:border-white/5"
                              }
                            `}
                          >
                            {FLAG_EMOJI[lang.country]}
                          </div>
                          <span className="flex-1 text-left font-semibold">
                            {lang.name}
                          </span>
                          {isActive && (
                            <div className="w-5 h-5 rounded-full bg-primary-600 dark:bg-primary-500 flex items-center justify-center">
                              <IconCheck
                                size={12}
                                className="text-white"
                                stroke={3}
                              />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Column 2: Appearance */}
              <div className="space-y-6">
                {/* Theme */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-surface-500 dark:text-surface-400 mb-3 flex items-center gap-2">
                    {selectedTheme === "light" ? (
                      <IconSun size={14} />
                    ) : (
                      <IconMoon size={14} />
                    )}
                    {t("onboarding.theme", "Theme")}
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
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
                            group relative flex flex-col items-center gap-2 p-5 rounded-2xl border transition-all duration-300 overflow-hidden
                            ${
                              isActive
                                ? "bg-white dark:bg-surface-100 border-surface-200 dark:border-white/10 shadow-sm"
                                : "bg-surface-50 dark:bg-surface-100/50 border-surface-100 dark:border-white/5 hover:border-surface-200 dark:hover:border-white/10"
                            }
                          `}
                        >
                          {isActive && (
                            <div className="absolute top-2.5 right-2.5">
                              <div className="w-4 h-4 rounded-full bg-primary-600 dark:bg-primary-500 flex items-center justify-center">
                                <IconCheck
                                  size={10}
                                  className="text-white"
                                  stroke={3}
                                />
                              </div>
                            </div>
                          )}
                          <div
                            className={`
                              p-3 rounded-xl border transition-colors
                              ${
                                isActive
                                  ? "bg-surface-50 dark:bg-white/5 border-surface-100 dark:border-white/5 text-surface-900 dark:text-white"
                                  : "bg-surface-100 dark:bg-white/5 border-transparent text-surface-400 dark:text-surface-500"
                              }
                            `}
                          >
                            <Icon size={22} stroke={1.5} />
                          </div>
                          <span
                            className={`text-sm font-semibold ${
                              isActive
                                ? "text-surface-900 dark:text-white"
                                : "text-surface-500 dark:text-surface-500"
                            }`}
                          >
                            {themeOption.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Accent Color */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-surface-500 dark:text-surface-400 mb-3 flex items-center gap-2">
                    <IconPalette size={14} />
                    {t("onboarding.color", "Accent Color")}
                  </h3>
                  <div className="bg-white dark:bg-surface-100 border border-surface-200 dark:border-white/5 rounded-2xl p-4 shadow-sm dark:shadow-none">
                    <div className="flex items-center justify-between">
                      {COLORS.map((color) => {
                        const isActive = selectedColor === color;
                        return (
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
                              w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
                              ${COLOR_MAP[color]}
                              ${
                                isActive
                                  ? "ring-2 ring-offset-2 ring-surface-400 dark:ring-surface-500 scale-110"
                                  : "hover:scale-110 opacity-70 hover:opacity-100 scale-90"
                              }
                            `}
                          >
                            {isActive && (
                              <IconCheck
                                size={16}
                                className="text-white drop-shadow-sm"
                                stroke={3}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Disclaimer */}
                <div className="bg-white dark:bg-surface-100 border border-surface-200 dark:border-white/5 rounded-2xl p-4 shadow-sm dark:shadow-none">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/10 rounded-lg flex-shrink-0">
                      <IconAlertTriangle
                        size={16}
                        className="text-amber-600 dark:text-amber-400"
                        stroke={1.5}
                      />
                    </div>
                    <div className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed">
                      <p className="mb-1.5">{t("disclaimer.text1")}</p>
                      <p>
                        <Trans
                          i18nKey="disclaimer.text2"
                          t={t}
                          components={{
                            0: (
                              <strong className="font-bold text-surface-900 dark:text-white" />
                            ),
                          }}
                        />
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 bg-surface-50/50 dark:bg-black/20 border-t border-surface-100 dark:border-white/5 flex items-center justify-between">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={dontShowDisclaimer}
                  onChange={(e) => setDontShowDisclaimer(e.target.checked)}
                  className="peer appearance-none w-5 h-5 rounded border border-surface-300 dark:border-white/20 bg-white dark:bg-white/5 checked:bg-primary-600 checked:border-primary-600 focus:ring-2 focus:ring-primary-500/30 transition-all cursor-pointer"
                />
                <IconCheck
                  size={12}
                  className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity"
                  stroke={3}
                />
              </div>
              <span className="text-sm text-surface-600 dark:text-surface-400 font-medium select-none">
                {t("disclaimer.dont_show_again")}
              </span>
            </label>

            <button
              onClick={handleComplete}
              className="px-6 py-2 rounded-lg text-sm font-bold bg-primary-600 hover:bg-primary-700 text-white shadow-lg shadow-primary-600/20 transition-all active:scale-95 flex items-center gap-2"
            >
              {t("onboarding.get_started", "Get Started")}
              <IconArrowRight size={18} />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
