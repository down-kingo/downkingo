import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  IconLanguage,
  IconFolder,
  IconEyeOff,
  IconLock,
  IconDeviceDesktop,
  IconVideo,
  IconPhoto,
  IconClipboard,
  IconTerminal2,
  IconChartDots,
} from "@tabler/icons-react";
import { useSettingsStore, Language } from "../../stores/settingsStore";
import { supportedLanguages } from "../../i18n";
import {
  GetVideoDownloadPath,
  GetImageDownloadPath,
  SelectVideoDirectory,
  SelectImageDirectory,
  SetClipboardMonitor,
} from "../../../bindings/kingo/app";

// Components locais
const SettingItem = ({
  icon: Icon,
  label,
  desc,
  children,
  active,
}: {
  icon: any;
  label: string;
  desc?: string;
  children: React.ReactNode;
  active?: boolean;
}) => (
  <div className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white dark:bg-surface-100 border border-surface-200 dark:border-zinc-800 rounded-xl transition-all duration-200 shadow-sm dark:shadow-none">
    <div className="flex items-start gap-4 mb-3 sm:mb-0">
      <div className="p-2.5 bg-surface-50 dark:bg-surface-50 rounded-lg group-hover:scale-110 transition-all duration-300 border border-surface-100 dark:border-zinc-800">
        <Icon
          size={20}
          className={`stroke-[1.5] transition-colors ${
            active === undefined
              ? "text-primary-600 dark:text-primary-500"
              : active
              ? "text-primary-600 dark:text-primary-500"
              : "text-surface-400 dark:text-surface-600"
          }`}
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-surface-900 dark:text-white tracking-tight">
          {label}
        </span>
        {desc && (
          <span className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed max-w-xs">
            {desc}
          </span>
        )}
      </div>
    </div>
    <div className="flex items-center pl-12 sm:pl-0">{children}</div>
  </div>
);

const Switch = ({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <button
    onClick={() => onChange(!checked)}
    className={`
      relative w-11 h-6 rounded-full transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-primary-500/30
      ${
        checked
          ? "bg-primary-600 dark:bg-primary-500 shadow-lg shadow-primary-600/20"
          : "bg-surface-200 dark:bg-surface-200 hover:bg-surface-300 dark:hover:bg-surface-300"
      }
    `}
  >
    <div
      className={`
        absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300 cubic-bezier(0.4, 0.0, 0.2, 1)
        ${checked ? "translate-x-5 scale-110" : "translate-x-0 scale-100"}
      `}
    />
  </button>
);

export default function GeneralSettings() {
  const { t } = useTranslation("settings");
  const {
    language,
    anonymousMode,
    telemetryEnabled,
    startWithWindows,
    clipboardMonitorEnabled,
    consoleEnabled,
    setLanguage,
    setSetting,
  } = useSettingsStore();

  const [videoPath, setVideoPath] = useState("");
  const [imagePath, setImagePath] = useState("");

  useEffect(() => {
    GetVideoDownloadPath().then(setVideoPath);
    GetImageDownloadPath().then(setImagePath);
  }, []);

  const handleChangeVideoFolder = async () => {
    try {
      const newPath = await SelectVideoDirectory();
      if (newPath) {
        setVideoPath(newPath);
      }
    } catch (e) {
      console.error("Error selecting video folder", e);
    }
  };

  const handleChangeImageFolder = async () => {
    try {
      const newPath = await SelectImageDirectory();
      if (newPath) {
        setImagePath(newPath);
      }
    } catch (e) {
      console.error("Error selecting image folder", e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Regional */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3 flex items-center gap-2">
          <IconLanguage size={14} />
          {t("sections.regional")}
        </h3>
        <div className="space-y-3">
          <SettingItem icon={IconLanguage} label={t("language.title")}>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="bg-surface-50 dark:bg-surface-200 border border-surface-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 cursor-pointer"
            >
              {supportedLanguages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name}
                </option>
              ))}
            </select>
          </SettingItem>
        </div>
      </section>

      {/* Storage */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3 flex items-center gap-2">
          <IconFolder size={14} />
          {t("sections.storage")}
        </h3>
        <div className="space-y-3">
          <SettingItem
            icon={IconVideo}
            label={t("storage.path_video_label")}
            desc={videoPath || "..."}
          >
            <button
              onClick={handleChangeVideoFolder}
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium bg-surface-100 hover:bg-surface-200 dark:bg-surface-200 dark:hover:bg-surface-300 rounded-lg transition-colors border border-surface-200 dark:border-zinc-800 text-surface-700 dark:text-white"
            >
              <IconFolder size={16} />
              {t("storage.change_btn")}
            </button>
          </SettingItem>

          <SettingItem
            icon={IconPhoto}
            label={t("storage.path_image_label")}
            desc={imagePath || "..."}
          >
            <button
              onClick={handleChangeImageFolder}
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium bg-surface-100 hover:bg-surface-200 dark:bg-surface-200 dark:hover:bg-surface-300 rounded-lg transition-colors border border-surface-200 dark:border-zinc-800 text-surface-700 dark:text-white"
            >
              <IconFolder size={16} />
              {t("storage.change_btn")}
            </button>
          </SettingItem>
        </div>
      </section>

      {/* Privacy */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3 flex items-center gap-2">
          <IconLock size={14} />
          {t("sections.privacy")}
        </h3>
        <div className="space-y-3">
          <SettingItem
            icon={anonymousMode ? IconEyeOff : IconLock}
            label={t("privacy.anonymous")}
            desc={t("privacy.anonymous_desc")}
            active={anonymousMode}
          >
            <Switch
              checked={anonymousMode}
              onChange={(v) => setSetting("anonymousMode", v)}
            />
          </SettingItem>

          <SettingItem
            icon={IconChartDots}
            label={t("privacy.telemetry")}
            desc={t("privacy.telemetry_desc")}
            active={telemetryEnabled}
          >
            <Switch
              checked={telemetryEnabled}
              onChange={(v) => setSetting("telemetryEnabled", v)}
            />
          </SettingItem>
        </div>
      </section>

      {/* System */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3 flex items-center gap-2">
          <IconDeviceDesktop size={14} />
          {t("sections.system")}
        </h3>
        <div className="space-y-3">
          <SettingItem
            icon={IconDeviceDesktop}
            label={t("system.start_windows")}
            desc={t("system.start_windows_desc")}
            active={startWithWindows}
          >
            <Switch
              checked={startWithWindows}
              onChange={(v) => setSetting("startWithWindows", v)}
            />
          </SettingItem>

          <SettingItem
            icon={IconClipboard}
            label={t("system.clipboard_monitor")}
            desc={t("system.clipboard_monitor_desc")}
            active={clipboardMonitorEnabled}
          >
            <Switch
              checked={clipboardMonitorEnabled}
              onChange={(v) => {
                setSetting("clipboardMonitorEnabled", v);
                SetClipboardMonitor(v);
              }}
            />
          </SettingItem>

          <SettingItem
            icon={IconTerminal2}
            label={t("system.console")}
            desc={t("system.console_desc")}
            active={consoleEnabled}
          >
            <Switch
              checked={consoleEnabled}
              onChange={(v) => setSetting("consoleEnabled", v)}
            />
          </SettingItem>
        </div>
      </section>
    </div>
  );
}
