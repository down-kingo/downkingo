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
  IconPlayerPlay,
  IconClipboard,
  IconRefresh,
  IconEyeOff,
} from "@tabler/icons-react";
import {
  useSettingsStore,
  Language,
  Theme,
  AppColor,
} from "../stores/settingsStore";
import { useTranslation, Trans } from "react-i18next";
import { Logo } from "./Logo";

const LANGUAGES: { code: Language; name: string; flag: string }[] = [
  { code: "en-US", name: "English", flag: "🇺🇸" },
  { code: "pt-BR", name: "Português", flag: "🇧🇷" },
  { code: "es-ES", name: "Español", flag: "🇪🇸" },
  { code: "fr-FR", name: "Français", flag: "🇫🇷" },
  { code: "de-DE", name: "Deutsch", flag: "🇩🇪" },
];

const THEMES: { value: Theme; label: string; Icon: typeof IconSun }[] = [
  { value: "light", label: "Light", Icon: IconSun },
  { value: "dark", label: "Dark", Icon: IconMoon },
];

const COLORS: { id: AppColor; bg: string; ring: string }[] = [
  { id: "red", bg: "bg-red-500", ring: "ring-red-400" },
  { id: "blue", bg: "bg-blue-500", ring: "ring-blue-400" },
  { id: "green", bg: "bg-emerald-500", ring: "ring-emerald-400" },
  { id: "orange", bg: "bg-orange-500", ring: "ring-orange-400" },
  { id: "purple", bg: "bg-purple-500", ring: "ring-purple-400" },
];

// ── atoms ──────────────────────────────────────────────────────────

function SectionLabel({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <p
      className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em]
                  text-surface-400 dark:text-white/45 mb-2.5"
    >
      {icon}
      {children}
    </p>
  );
}

function CheckDot() {
  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.5, opacity: 0 }}
      transition={{ duration: 0.13 }}
      className="w-[18px] h-[18px] rounded-full bg-primary-600 dark:bg-primary-500 flex items-center justify-center flex-shrink-0"
    >
      <IconCheck size={10} className="text-white" stroke={3.5} />
    </motion.div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={[
        "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
        checked
          ? "bg-primary-600 dark:bg-primary-500"
          : "bg-surface-200 dark:bg-white/20",
      ].join(" ")}
    >
      <span
        className={[
          "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200",
          checked ? "translate-x-4" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}

function ToggleRow({
  icon,
  label,
  desc,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer
                 hover:bg-surface-50 dark:hover:bg-white/[0.04] transition-colors"
      onClick={() => onChange(!checked)}
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 text-surface-400 dark:text-white/50 flex-shrink-0">
          {icon}
        </div>
        <div>
          <p
            className="text-[12.5px] font-semibold leading-tight
                        text-surface-800 dark:text-white"
          >
            {label}
          </p>
          <p
            className="text-[11px] mt-0.5 leading-snug
                        text-surface-400 dark:text-white/50"
          >
            {desc}
          </p>
        </div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

// ── main ───────────────────────────────────────────────────────────

export default function OnboardingModal() {
  const { t } = useTranslation("common");
  const {
    language,
    theme,
    primaryColor,
    autoUpdateApp,
    startWithWindows,
    clipboardMonitorEnabled,
    anonymousMode,
    setLanguage,
    setSetting,
    setPrimaryColor,
    completeOnboarding,
    hasCompletedOnboarding,
  } = useSettingsStore();

  const [selLang, setSelLang] = useState<Language>(language);
  const [selTheme, setSelTheme] = useState<Theme>(theme);
  const [selColor, setSelColor] = useState<AppColor>(primaryColor);
  const [autoUpdate, setAutoUpdate] = useState(autoUpdateApp);
  const [startWin, setStartWin] = useState(startWithWindows);
  const [clipMonitor, setClipMonitor] = useState(clipboardMonitorEnabled);
  const [anonMode, setAnonMode] = useState(anonymousMode);
  const [dontShow, setDontShow] = useState(false);

  if (hasCompletedOnboarding) return null;

  const handleComplete = () => {
    setSetting("autoUpdateApp", autoUpdate);
    setSetting("startWithWindows", startWin);
    setSetting("clipboardMonitorEnabled", clipMonitor);
    setSetting("anonymousMode", anonMode);
    if (dontShow) localStorage.setItem("kingo_disclaimer_accepted", "true");
    completeOnboarding();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[620px] bg-white dark:bg-[#111113] rounded-2xl
                     shadow-2xl shadow-black/25 overflow-hidden
                     border border-surface-200 dark:border-white/10"
        >
          {/* ── HEADER ──────────────────────────────────────── */}
          <div className="px-6 pt-5 pb-4 border-b border-surface-100 dark:border-white/10 flex items-center gap-3.5">
            <Logo size={40} className="flex-shrink-0" />
            <div>
              <h2 className="text-[14.5px] font-bold text-surface-900 dark:text-white">
                {t("onboarding.title")}
              </h2>
              <p className="text-[12.5px] mt-0.5 text-surface-400 dark:text-white/60">
                {t("onboarding.subtitle")}
              </p>
            </div>
          </div>

          {/* ── BODY ────────────────────────────────────────── */}
          <div className="px-6 pt-5 pb-0 flex flex-col gap-4">
            {/* ── LINHA 1: Language | Theme + Color ─────────── */}
            <div
              className="grid grid-cols-2 gap-5"
              style={{ alignItems: "stretch" }}
            >
              {/* COL 1 — Language */}
              <div className="flex flex-col">
                <SectionLabel icon={<IconGlobe size={11} />}>
                  {t("onboarding.language")}
                </SectionLabel>

                <div className="flex-1 flex flex-col rounded-xl border border-surface-200 dark:border-white/10 overflow-hidden">
                  {LANGUAGES.map((lang, i) => {
                    const active = selLang === lang.code;
                    return (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setSelLang(lang.code);
                          setLanguage(lang.code);
                        }}
                        className={[
                          "flex-1 flex items-center gap-3 px-4 text-[13px] font-medium transition-colors",
                          i > 0 &&
                            "border-t border-surface-100 dark:border-white/[0.08]",
                          active
                            ? "bg-primary-50 dark:bg-primary-500/15 text-surface-900 dark:text-white"
                            : "text-surface-600 dark:text-white/70 hover:bg-surface-50 dark:hover:bg-white/[0.05]",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <span className="text-[17px] leading-none flex-shrink-0">
                          {lang.flag}
                        </span>
                        <span className="flex-1 text-left">{lang.name}</span>
                        <AnimatePresence>
                          {active && <CheckDot />}
                        </AnimatePresence>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* COL 2 — Theme + Accent Color */}
              <div className="flex flex-col gap-4">
                {/* Theme */}
                <div>
                  <SectionLabel
                    icon={
                      selTheme === "light" ? (
                        <IconSun size={11} />
                      ) : (
                        <IconMoon size={11} />
                      )
                    }
                  >
                    {t("onboarding.theme")}
                  </SectionLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {THEMES.map(({ value, label, Icon }) => {
                      const active = selTheme === value;
                      return (
                        <button
                          key={value}
                          onClick={() => {
                            setSelTheme(value);
                            setSetting("theme", value);
                          }}
                          className={[
                            "relative flex flex-col items-center gap-2 py-4 rounded-xl border transition-all duration-200",
                            active
                              ? "bg-white dark:bg-white/10 border-surface-200 dark:border-white/20 shadow-sm"
                              : "bg-surface-50 dark:bg-white/[0.05] border-surface-150 dark:border-white/10 hover:bg-surface-100 dark:hover:bg-white/10",
                          ].join(" ")}
                        >
                          <AnimatePresence>
                            {active && (
                              <motion.div
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.5, opacity: 0 }}
                                className="absolute top-2 right-2 w-[18px] h-[18px] rounded-full bg-primary-600 dark:bg-primary-500 flex items-center justify-center"
                              >
                                <IconCheck
                                  size={10}
                                  className="text-white"
                                  stroke={3.5}
                                />
                              </motion.div>
                            )}
                          </AnimatePresence>
                          <Icon
                            size={20}
                            stroke={1.5}
                            className={
                              active
                                ? "text-surface-800 dark:text-white"
                                : "text-surface-400 dark:text-white/55"
                            }
                          />
                          <span
                            className={`text-xs font-semibold ${
                              active
                                ? "text-surface-900 dark:text-white"
                                : "text-surface-500 dark:text-white/60"
                            }`}
                          >
                            {label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Accent Color */}
                <div>
                  <SectionLabel icon={<IconPalette size={11} />}>
                    {t("onboarding.color")}
                  </SectionLabel>
                  <div
                    className="rounded-xl border border-surface-200 dark:border-white/10
                                  bg-surface-50/50 dark:bg-white/[0.04]
                                  px-4 py-3.5 flex items-center justify-between"
                  >
                    {COLORS.map(({ id, bg, ring }) => {
                      const active = selColor === id;
                      return (
                        <button
                          key={id}
                          onClick={() => {
                            setSelColor(id);
                            setPrimaryColor(id);
                            document.documentElement.setAttribute(
                              "data-color",
                              id,
                            );
                          }}
                          className={[
                            "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200",
                            bg,
                            active
                              ? `ring-2 ring-offset-2 ring-offset-white dark:ring-offset-[#111113] ${ring} scale-110`
                              : "opacity-60 hover:opacity-100 hover:scale-105",
                          ].join(" ")}
                        >
                          <AnimatePresence>
                            {active && (
                              <motion.div
                                initial={{ scale: 0.4, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.4, opacity: 0 }}
                              >
                                <IconCheck
                                  size={14}
                                  className="text-white"
                                  stroke={3}
                                />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            {/* /linha 1 */}

            {/* ── LINHA 2: Preferences ──────────────────────── */}
            <div>
              <SectionLabel icon={<IconPlayerPlay size={11} />}>
                {t("onboarding.preferences")}
              </SectionLabel>
              <div
                className="rounded-xl border border-surface-200 dark:border-white/10 overflow-hidden
                              bg-white dark:bg-white/[0.03]"
              >
                {/* Row A */}
                <div className="grid grid-cols-2 divide-x divide-surface-100 dark:divide-white/[0.08]">
                  <ToggleRow
                    icon={<IconPlayerPlay size={13} />}
                    label={t("onboarding.start_with_windows")}
                    desc={t("onboarding.start_with_windows_desc")}
                    checked={startWin}
                    onChange={setStartWin}
                  />
                  <ToggleRow
                    icon={<IconClipboard size={13} />}
                    label={t("onboarding.clipboard_monitor")}
                    desc={t("onboarding.clipboard_monitor_desc")}
                    checked={clipMonitor}
                    onChange={setClipMonitor}
                  />
                </div>
                {/* Row B */}
                <div
                  className="grid grid-cols-2 divide-x divide-surface-100 dark:divide-white/[0.08]
                                border-t border-surface-100 dark:border-white/[0.08]"
                >
                  <ToggleRow
                    icon={<IconRefresh size={13} />}
                    label={t("onboarding.auto_update")}
                    desc={t("onboarding.auto_update_desc")}
                    checked={autoUpdate}
                    onChange={setAutoUpdate}
                  />
                  <ToggleRow
                    icon={<IconEyeOff size={13} />}
                    label={t("onboarding.anonymous_mode")}
                    desc={t("onboarding.anonymous_mode_desc")}
                    checked={anonMode}
                    onChange={setAnonMode}
                  />
                </div>
              </div>
            </div>

            {/* ── LINHA 3: Disclaimer ───────────────────────── */}
            <div
              className="rounded-xl border border-amber-200 dark:border-amber-400/20
                            bg-amber-50/70 dark:bg-amber-400/[0.08]
                            px-4 py-3 flex items-start gap-2.5"
            >
              <IconAlertTriangle
                size={13}
                className="text-amber-500 dark:text-amber-400 flex-shrink-0 mt-[2px]"
                stroke={2}
              />
              <p className="text-[11.5px] leading-relaxed text-surface-500 dark:text-white/65">
                {t("disclaimer.text1")}{" "}
                <Trans
                  i18nKey="disclaimer.text2"
                  t={t}
                  components={{
                    0: (
                      <strong className="font-semibold text-surface-700 dark:text-white" />
                    ),
                  }}
                />
              </p>
            </div>
          </div>
          {/* /body */}

          {/* ── FOOTER ──────────────────────────────────────── */}
          <div
            className="px-6 py-4 mt-4 border-t border-surface-100 dark:border-white/10
                          flex items-center justify-between
                          bg-surface-50/40 dark:bg-black/20"
          >
            <label className="flex items-center gap-2.5 cursor-pointer">
              <div className="relative flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={dontShow}
                  onChange={(e) => setDontShow(e.target.checked)}
                  className="peer appearance-none w-[17px] h-[17px] rounded-[5px]
                             border border-surface-300 dark:border-white/25
                             bg-white dark:bg-white/10
                             checked:bg-primary-600 checked:border-primary-600
                             transition-all cursor-pointer"
                />
                <IconCheck
                  size={10}
                  className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity"
                  stroke={3.5}
                />
              </div>
              <span className="text-[12.5px] font-medium select-none text-surface-500 dark:text-white/65">
                {t("disclaimer.dont_show_again")}
              </span>
            </label>

            <button
              onClick={handleComplete}
              className="px-5 py-2 rounded-lg text-[13px] font-bold
                         bg-primary-600 hover:bg-primary-700 active:bg-primary-800
                         text-white shadow-md shadow-primary-600/20
                         transition-all active:scale-95 flex items-center gap-1.5"
            >
              {t("onboarding.get_started")}
              <IconArrowRight size={15} />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
