import { useState, useEffect } from "react";
import {
  IconFileExport,
  IconPhoto,
  IconPlayerSkipForward,
  IconDeviceTv,
  IconRocket,
  IconDownload,
  IconCheck,
  IconFolder,
  IconTrash,
} from "@tabler/icons-react";
import { useSettingsStore } from "../../stores/settingsStore";
import {
  CheckAria2cStatus,
  DownloadAria2c,
  DeleteAria2c,
} from "../../../wailsjs/go/main/App";
import { useTranslation } from "react-i18next";

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
              ? "text-primary-600"
              : active
              ? "text-primary-600"
              : "text-surface-400"
          }`}
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-surface-900 tracking-tight">
          {label}
        </span>
        {desc && (
          <span className="text-xs text-surface-500 leading-relaxed max-w-xs">
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
          : "bg-surface-200 dark:bg-surface-700 hover:bg-surface-300 dark:hover:bg-surface-600"
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

interface Aria2cStatus {
  installed: boolean;
  path: string;
  version: string;
}

export default function VideoSettings() {
  const { t } = useTranslation("settings");
  const {
    remuxVideo,
    remuxFormat,
    embedThumbnail,
    skipExisting,
    videoCompatibility,
    useAria2c,
    aria2cConnections,
    setSetting,
  } = useSettingsStore();

  const [aria2cStatus, setAria2cStatus] = useState<Aria2cStatus | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    CheckAria2cStatus()
      .then(setAria2cStatus)
      .catch(() =>
        setAria2cStatus({ installed: false, path: "", version: "" })
      );
  }, []);

  const handleAria2cToggle = async () => {
    if (useAria2c) {
      setSetting("useAria2c", false);
      return;
    }

    if (!aria2cStatus?.installed) {
      setIsDownloading(true);
      try {
        await DownloadAria2c();
        const result = await CheckAria2cStatus();
        setAria2cStatus(result);
        if (result.installed) {
          setSetting("useAria2c", true);
        }
      } catch (e) {
        console.error("Download failed:", e);
      } finally {
        setIsDownloading(false);
      }
    } else {
      setSetting("useAria2c", true);
    }
  };

  const handleAria2cDelete = async () => {
    setIsDeleting(true);
    try {
      await DeleteAria2c();
      setSetting("useAria2c", false);
      const result = await CheckAria2cStatus();
      setAria2cStatus(result);
    } catch (e) {
      console.error("Delete failed:", e);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Formato e Qualidade */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3 flex items-center gap-2">
          <IconDeviceTv size={14} />
          {t("video_settings.format_quality")}
        </h3>
        <div className="space-y-3">
          <SettingItem
            icon={IconDeviceTv}
            label={t("video_settings.compatibility")}
            desc={
              videoCompatibility === "universal"
                ? t("video_settings.compatibility_universal_desc")
                : t("video_settings.compatibility_modern_desc")
            }
          >
            <select
              value={videoCompatibility}
              onChange={(e) => setSetting("videoCompatibility", e.target.value)}
              className="bg-surface-50 dark:bg-surface-200 border border-surface-200 dark:border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 cursor-pointer"
            >
              <option value="universal">
                {t("video_settings.compatibility_universal")}
              </option>
              <option value="modern">
                {t("video_settings.compatibility_modern")}
              </option>
            </select>
          </SettingItem>

          <SettingItem
            icon={IconFileExport}
            label={t("video_settings.remux")}
            desc={t("video_settings.remux_desc")}
            active={remuxVideo}
          >
            <div className="flex items-center gap-3">
              {remuxVideo && (
                <select
                  value={remuxFormat || "mp4"}
                  onChange={(e) => setSetting("remuxFormat", e.target.value)}
                  className="bg-surface-50 dark:bg-surface-200 border border-surface-200 dark:border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 cursor-pointer"
                >
                  <option value="mp4">MP4</option>
                  <option value="mkv">MKV</option>
                  <option value="webm">WebM</option>
                  <option value="mov">MOV</option>
                  <option value="avi">AVI</option>
                </select>
              )}
              <Switch
                checked={remuxVideo}
                onChange={(v) => setSetting("remuxVideo", v)}
              />
            </div>
          </SettingItem>
        </div>
      </section>

      {/* Opções de Download */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3 flex items-center gap-2">
          <IconDownload size={14} />
          {t("downloads.title")}
        </h3>
        <div className="space-y-3">
          <SettingItem
            icon={IconPhoto}
            label={t("downloads.thumbnail")}
            desc={t("downloads.thumbnail")} // Reutilizando a chave se apropriado, ou criar uma nova se a desc for diferente
            active={embedThumbnail}
          >
            <Switch
              checked={embedThumbnail}
              onChange={(v) => setSetting("embedThumbnail", v)}
            />
          </SettingItem>

          <SettingItem
            icon={IconPlayerSkipForward}
            label={t("downloads.skip_existing")}
            desc={t("downloads.skip_existing")}
            active={skipExisting}
          >
            <Switch
              checked={skipExisting}
              onChange={(v) => setSetting("skipExisting", v)}
            />
          </SettingItem>
        </div>
      </section>

      {/* Aria2c - Downloads Acelerados */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3 flex items-center gap-2">
          <IconRocket size={14} />
          {t("aria2c_settings.title")}
        </h3>
        <div className="p-4 bg-white dark:bg-surface-100 border border-surface-200 dark:border-zinc-800 rounded-xl space-y-4 shadow-sm dark:shadow-none">
          {/* Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-surface-50 dark:bg-surface-50 rounded-lg border border-surface-100 dark:border-zinc-800">
                <IconRocket
                  size={20}
                  className={`stroke-[1.5] ${
                    useAria2c ? "text-primary-600" : "text-surface-400"
                  }`}
                />
              </div>
              <div>
                <span className="text-sm font-semibold text-surface-900">
                  {t("aria2c_settings.name")}
                </span>
                <p className="text-xs text-surface-500">
                  {isDownloading
                    ? t("aria2c_settings.installing")
                    : isDeleting
                    ? t("aria2c_settings.deleting")
                    : useAria2c
                    ? t("aria2c_settings.status_active")
                    : t("aria2c_settings.status_inactive")}
                </p>
              </div>
            </div>
            {isDownloading || isDeleting ? (
              <div className="w-11 h-6 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <Switch checked={useAria2c} onChange={handleAria2cToggle} />
            )}
          </div>

          {/* Detalhes */}
          <div className="p-3 bg-surface-100/50 dark:bg-surface-800/30 rounded-lg space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-surface-500 flex items-center gap-2">
                <IconCheck size={14} />
                {t("aria2c_settings.status_label")}
              </span>
              <span
                className={`font-medium ${
                  aria2cStatus?.installed ? "text-green-600" : "text-amber-600"
                }`}
              >
                {aria2cStatus?.installed
                  ? t("aria2c_settings.installed")
                  : t("aria2c_settings.not_installed")}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-surface-500 flex items-center gap-2">
                <IconFolder size={14} />
                {aria2cStatus?.installed
                  ? t("aria2c_settings.path_label")
                  : t("aria2c_settings.component")}
              </span>
              <span
                className={`text-[10px] ${
                  aria2cStatus?.installed
                    ? "text-surface-600 font-mono"
                    : "text-surface-500"
                }`}
              >
                {aria2cStatus?.installed ? aria2cStatus.path : "aria2c (~3MB)"}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-surface-500 flex items-center gap-2">
                <IconRocket size={14} />
                {t("aria2c_settings.connections")}
              </span>
              <select
                value={aria2cConnections}
                onChange={(e) =>
                  setSetting("aria2cConnections", Number(e.target.value))
                }
                className="bg-transparent text-surface-600 font-medium text-xs text-right cursor-pointer focus:outline-none"
              >
                <option value={4}>4</option>
                <option value={8}>8</option>
                <option value={16}>16</option>
                <option value={32}>32</option>
              </select>
            </div>

            {!aria2cStatus?.installed && !isDownloading && (
              <button
                onClick={handleAria2cToggle}
                className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <IconDownload size={14} />
                {t("aria2c_settings.install_btn")}
              </button>
            )}

            {aria2cStatus?.installed && !isDeleting && (
              <button
                onClick={handleAria2cDelete}
                className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs font-medium rounded-lg transition-colors border border-red-200 dark:border-red-800"
              >
                <IconTrash size={14} />
                {t("aria2c_settings.delete_btn")}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
