import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconGlobe,
  IconSun,
  IconMoon,
  IconCheck,
  IconDownload,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { useSettingsStore, Language, Theme } from "../stores/settingsStore";
import { useTranslation, Trans } from "react-i18next";

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

export default function OnboardingModal() {
  const { t } = useTranslation("common");
  const {
    language,
    theme,
    setLanguage,
    setSetting,
    completeOnboarding,
    hasCompletedOnboarding,
  } = useSettingsStore();

  const [selectedLanguage, setSelectedLanguage] = useState<Language>(language);
  const [selectedTheme, setSelectedTheme] = useState<Theme>(theme);
  const [dontShowDisclaimer, setDontShowDisclaimer] = useState(false);

  // Don't show if onboarding is completed
  if (hasCompletedOnboarding) return null;

  const handleComplete = () => {
    // Apply settings
    setLanguage(selectedLanguage);
    setSetting("theme", selectedTheme);

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
        className="fixed inset-0 z-[100] grid place-items-center bg-black/60 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="p-6">
            {/* Header */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 bg-primary-50 rounded-full flex items-center justify-center mb-3">
                <IconDownload className="w-7 h-7 text-primary-600" />
              </div>
              <h2 className="text-xl font-bold text-surface-900 font-display">
                {t("onboarding.title", "Welcome to DownKingo")}
              </h2>
              <p className="text-sm text-surface-500 mt-1">
                {t("onboarding.subtitle", "Let's set up your experience")}
              </p>
            </div>

            {/* Language Selection */}
            <div className="mb-5">
              <label className="flex items-center gap-2 text-sm font-medium text-surface-700 mb-2">
                <IconGlobe size={16} />
                {t("onboarding.language", "Language")}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {LANGUAGES.slice(0, 4).map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setSelectedLanguage(lang.code)}
                    className={`
                      flex items-center gap-2 p-2.5 rounded-lg border text-sm font-medium transition-all
                      ${
                        selectedLanguage === lang.code
                          ? "bg-primary-50 border-primary-500 text-primary-700"
                          : "bg-surface-50 border-surface-200 text-surface-700 hover:bg-surface-100 hover:border-surface-300"
                      }
                    `}
                  >
                    <span className="text-base">
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
                      <IconCheck size={16} className="text-primary-600" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme Selection */}
            <div className="mb-5">
              <label className="flex items-center gap-2 text-sm font-medium text-surface-700 mb-2">
                {selectedTheme === "light" ? (
                  <IconSun size={16} />
                ) : (
                  <IconMoon size={16} />
                )}
                {t("onboarding.theme", "Theme")}
              </label>
              <div className="flex gap-2">
                {THEMES.map((themeOption) => {
                  const Icon = themeOption.Icon;
                  return (
                    <button
                      key={themeOption.value}
                      onClick={() => setSelectedTheme(themeOption.value)}
                      className={`
                        flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all
                        ${
                          selectedTheme === themeOption.value
                            ? "bg-primary-50 border-primary-500 text-primary-700"
                            : "bg-surface-50 border-surface-200 text-surface-700 hover:bg-surface-100 hover:border-surface-300"
                        }
                      `}
                    >
                      <Icon size={18} />
                      <span>{themeOption.label}</span>
                      {selectedTheme === themeOption.value && (
                        <IconCheck size={16} className="text-primary-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Disclaimer Section */}
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 mb-5">
              <div className="flex items-start gap-2">
                <IconAlertTriangle
                  size={18}
                  className="text-amber-600 mt-0.5 shrink-0"
                />
                <div className="text-xs text-amber-800 leading-relaxed">
                  <p className="mb-1">{t("disclaimer.text1")}</p>
                  <p>
                    <Trans
                      i18nKey="disclaimer.text2"
                      t={t}
                      components={{
                        0: <strong className="font-semibold" />,
                      }}
                    />
                  </p>
                </div>
              </div>
            </div>

            {/* Don't show disclaimer checkbox */}
            <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-surface-200 hover:bg-surface-50 transition-colors cursor-pointer mb-5">
              <input
                type="checkbox"
                checked={dontShowDisclaimer}
                onChange={(e) => setDontShowDisclaimer(e.target.checked)}
                className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500/30"
              />
              <span className="text-sm text-surface-600">
                {t("disclaimer.dont_show_again")}
              </span>
            </label>

            {/* Get Started Button */}
            <button
              onClick={handleComplete}
              className="w-full py-3 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold rounded-xl transition-all transform active:scale-[0.98] shadow-lg shadow-primary-600/20"
            >
              {t("onboarding.get_started", "Get Started")}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
