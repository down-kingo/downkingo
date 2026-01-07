import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconGlobe,
  IconPalette,
  IconDownload,
  IconCheck,
  IconChevronRight,
  IconChevronLeft,
  IconSparkles,
} from "@tabler/icons-react";
import { useSettingsStore, Language, Theme } from "../stores/settingsStore";
import { useTranslation } from "react-i18next";

// Language options with native names
const LANGUAGES: { code: Language; name: string; flag: string }[] = [
  { code: "en-US", name: "English", flag: "🇺🇸" },
  { code: "pt-BR", name: "Português", flag: "🇧🇷" },
  { code: "es-ES", name: "Español", flag: "🇪🇸" },
  { code: "fr-FR", name: "Français", flag: "🇫🇷" },
  { code: "de-DE", name: "Deutsch", flag: "🇩🇪" },
];

// Theme options
const THEMES: { value: Theme; label: string; icon: string }[] = [
  { value: "dark", label: "Dark", icon: "🌙" },
  { value: "light", label: "Light", icon: "☀️" },
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

  const [step, setStep] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(language);
  const [selectedTheme, setSelectedTheme] = useState<Theme>(theme);

  // Don't show if onboarding is completed
  if (hasCompletedOnboarding) return null;

  const steps = [
    {
      id: "welcome",
      title: "Welcome to DownKingo",
      subtitle: "Let's set up your experience",
      icon: IconSparkles,
    },
    {
      id: "language",
      title: "Choose your language",
      subtitle: "Select your preferred language",
      icon: IconGlobe,
    },
    {
      id: "theme",
      title: "Choose your theme",
      subtitle: "Pick your visual style",
      icon: IconPalette,
    },
    {
      id: "ready",
      title: "You're all set!",
      subtitle: "Start downloading your favorite videos",
      icon: IconDownload,
    },
  ];

  const handleNext = () => {
    if (step === 1) {
      setLanguage(selectedLanguage);
    }
    if (step === 2) {
      setSetting("theme", selectedTheme);
    }
    if (step < steps.length - 1) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleComplete = () => {
    completeOnboarding();
  };

  const currentStep = steps[step];
  const StepIcon = currentStep.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg mx-4 overflow-hidden rounded-2xl bg-surface-900 border border-surface-700 shadow-2xl"
        >
          {/* Progress bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-surface-800">
            <motion.div
              className="h-full bg-gradient-to-r from-primary-500 to-primary-400"
              initial={{ width: 0 }}
              animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Content */}
          <div className="p-8 pt-10">
            {/* Header */}
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-center mb-8"
            >
              <div className="inline-flex p-4 mb-4 rounded-2xl bg-primary-500/10 border border-primary-500/20">
                <StepIcon size={32} className="text-primary-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {currentStep.title}
              </h2>
              <p className="text-surface-400">{currentStep.subtitle}</p>
            </motion.div>

            {/* Step content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="min-h-[200px] flex items-center justify-center"
              >
                {step === 0 && (
                  <div className="text-center space-y-4">
                    <div className="text-6xl mb-4">🎬</div>
                    <p className="text-surface-300 max-w-sm mx-auto">
                      Download videos from YouTube, Instagram, TikTok, and more
                      with just a few clicks.
                    </p>
                  </div>
                )}

                {step === 1 && (
                  <div className="w-full grid grid-cols-1 gap-2">
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => setSelectedLanguage(lang.code)}
                        className={`
                          flex items-center gap-3 p-4 rounded-xl border transition-all
                          ${
                            selectedLanguage === lang.code
                              ? "bg-primary-500/20 border-primary-500 text-white"
                              : "bg-surface-800/50 border-surface-700 text-surface-300 hover:bg-surface-800 hover:border-surface-600"
                          }
                        `}
                      >
                        <span className="text-2xl">{lang.flag}</span>
                        <span className="font-medium flex-1 text-left">
                          {lang.name}
                        </span>
                        {selectedLanguage === lang.code && (
                          <IconCheck size={20} className="text-primary-400" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {step === 2 && (
                  <div className="w-full flex gap-4 justify-center">
                    {THEMES.map((themeOption) => (
                      <button
                        key={themeOption.value}
                        onClick={() => setSelectedTheme(themeOption.value)}
                        className={`
                          flex flex-col items-center gap-3 p-6 rounded-xl border transition-all w-32
                          ${
                            selectedTheme === themeOption.value
                              ? "bg-primary-500/20 border-primary-500"
                              : "bg-surface-800/50 border-surface-700 hover:bg-surface-800 hover:border-surface-600"
                          }
                        `}
                      >
                        <span className="text-4xl">{themeOption.icon}</span>
                        <span
                          className={`font-medium ${
                            selectedTheme === themeOption.value
                              ? "text-white"
                              : "text-surface-300"
                          }`}
                        >
                          {themeOption.label}
                        </span>
                        {selectedTheme === themeOption.value && (
                          <IconCheck size={20} className="text-primary-400" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {step === 3 && (
                  <div className="text-center space-y-4">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        type: "spring",
                        damping: 15,
                        stiffness: 200,
                      }}
                      className="text-6xl mb-4"
                    >
                      🚀
                    </motion.div>
                    <p className="text-surface-300 max-w-sm mx-auto">
                      You're ready to go! Paste any video URL to get started.
                    </p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-surface-800">
              <button
                onClick={handleBack}
                disabled={step === 0}
                className={`
                  flex items-center gap-1 px-4 py-2 rounded-lg font-medium transition-all
                  ${
                    step === 0
                      ? "opacity-0 cursor-default"
                      : "text-surface-400 hover:text-white hover:bg-surface-800"
                  }
                `}
              >
                <IconChevronLeft size={18} />
                Back
              </button>

              {/* Step indicators */}
              <div className="flex gap-2">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className={`
                      w-2 h-2 rounded-full transition-all
                      ${
                        i === step
                          ? "bg-primary-500 w-6"
                          : i < step
                          ? "bg-primary-500/50"
                          : "bg-surface-700"
                      }
                    `}
                  />
                ))}
              </div>

              {step < steps.length - 1 ? (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-1 px-5 py-2.5 rounded-lg font-medium bg-primary-500 text-white hover:bg-primary-600 transition-all"
                >
                  Continue
                  <IconChevronRight size={18} />
                </button>
              ) : (
                <button
                  onClick={handleComplete}
                  className="flex items-center gap-1 px-5 py-2.5 rounded-lg font-medium bg-gradient-to-r from-primary-500 to-primary-400 text-white hover:opacity-90 transition-all"
                >
                  Get Started
                  <IconSparkles size={18} />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
