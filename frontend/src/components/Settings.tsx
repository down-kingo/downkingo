// @ts-ignore - Binding will be generated
import {
  GetDownloadsPath,
  SelectDirectory,
  GetAvailableAppVersions,
  InstallAppVersion,
  GetVersion,
  CheckAria2cStatus,
  DownloadAria2c,
  DeleteAria2c,
  GetSettings,
  SaveSettings,
} from "../../wailsjs/go/main/App";
import {
  useSettingsStore,
  Language,
  YtDlpChannel as YtDlpChannelType,
} from "../stores/settingsStore";
import { translations } from "../translations";
import { useState, useEffect } from "react";
import {
  IconSun,
  IconLanguage,
  IconFolder,
  IconLock,
  IconEyeOff,
  IconFileExport,
  IconPhoto,
  IconDownload,
  IconDeviceTv,
  IconWorld,
  IconRefresh,
  IconCloudCode,
  IconGhost,
  IconPalette,
  IconPlayerSkipForward,
  IconDeviceDesktop,
  IconRocket,
  IconCheck,
  IconTrash,
  IconSparkles,
} from "@tabler/icons-react";

// Helper components
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
  active?: boolean; // Para toggles: vermelho quando ativo, cinza quando inativo
}) => {
  const SafeIcon = Icon || IconRefresh;

  return (
    <div className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-surface-50/50 dark:bg-surface-800/20 hover:bg-surface-100 dark:hover:bg-surface-800/40 border border-surface-200/60 dark:border-surface-700/60 rounded-xl transition-all duration-200">
      <div className="flex items-start gap-4 mb-3 sm:mb-0">
        <div className="p-2.5 bg-surface-100 dark:bg-surface-800 rounded-lg group-hover:scale-110 transition-all duration-300">
          <SafeIcon
            size={20}
            className={`stroke-[1.5] transition-colors ${
              active === undefined
                ? "text-primary-600" // Sem toggle: sempre vermelho
                : active
                ? "text-primary-600" // Toggle ON: vermelho
                : "text-surface-400" // Toggle OFF: cinza
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
};

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

interface AppVersion {
  tag_name: string;
  name: string;
  prerelease: boolean;
  published_at: string;
}

// Aria2c Status da API
interface Aria2cStatus {
  installed: boolean;
  path: string;
  version: string;
}

// Componente Aria2cSetting com painel informativo
const Aria2cSetting = ({
  useAria2c,
  onToggle,
  connections,
  onConnectionsChange,
}: {
  useAria2c: boolean;
  onToggle: (v: boolean) => void;
  connections: number;
  onConnectionsChange: (v: number) => void;
}) => {
  const [status, setStatus] = useState<Aria2cStatus | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Verificar status ao montar
  useEffect(() => {
    CheckAria2cStatus()
      .then(setStatus)
      .catch(() => setStatus({ installed: false, path: "", version: "" }));
  }, []);

  const handleToggle = async () => {
    if (useAria2c) {
      onToggle(false);
      return;
    }

    // Se não instalado, baixar primeiro
    if (!status?.installed) {
      setIsDownloading(true);
      try {
        await DownloadAria2c();
        const result = await CheckAria2cStatus();
        setStatus(result);
        if (result.installed) {
          onToggle(true);
        }
      } catch (e) {
        console.error("Download failed:", e);
      } finally {
        setIsDownloading(false);
      }
    } else {
      onToggle(true);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await DeleteAria2c();
      onToggle(false);
      const result = await CheckAria2cStatus();
      setStatus(result);
    } catch (e) {
      console.error("Delete failed:", e);
    } finally {
      setIsDeleting(false);
    }
  };

  // Descrição curta no header
  const desc = useAria2c
    ? "Ativo — downloads acelerados"
    : "Acelera downloads com conexões paralelas";

  return (
    <div className="flex flex-col bg-surface-50/50 dark:bg-surface-800/20 border border-surface-200/60 dark:border-surface-700/60 rounded-xl transition-all duration-200 overflow-hidden">
      {/* Header com Toggle */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-start gap-4">
          <div className="p-2.5 bg-surface-100 dark:bg-surface-800 rounded-lg transition-colors">
            <IconRocket
              size={20}
              className={`stroke-[1.5] transition-colors ${
                useAria2c ? "text-primary-600" : "text-surface-400"
              }`}
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-surface-900 tracking-tight">
              Downloads Rápidos
            </span>
            <span className="text-xs text-surface-500">
              {isDownloading
                ? "Instalando..."
                : isDeleting
                ? "Excluindo..."
                : desc}
            </span>
          </div>
        </div>
        {isDownloading || isDeleting ? (
          <div className="w-11 h-6 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <Switch checked={useAria2c} onChange={handleToggle} />
        )}
      </div>

      {/* Painel de Detalhes - sempre visível */}
      <div className="px-4 pb-4 pt-0">
        <div className="p-3 bg-surface-100/50 dark:bg-surface-800/30 rounded-lg space-y-2">
          {/* Status */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-surface-500 flex items-center gap-2">
              <IconCheck size={14} className="stroke-[1.5]" />
              Status
            </span>
            <span
              className={`font-medium ${
                status?.installed ? "text-green-600" : "text-amber-600"
              }`}
            >
              {status?.installed ? "Instalado" : "Requer instalação"}
            </span>
          </div>

          {/* Localização */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-surface-500 flex items-center gap-2">
              <IconFolder size={14} className="stroke-[1.5]" />
              {status?.installed ? "Local" : "Componente"}
            </span>
            <span
              className={`text-[10px] ${
                status?.installed
                  ? "text-surface-600 font-mono"
                  : "text-surface-500"
              }`}
              title={status?.path}
            >
              {status?.installed ? status.path : "aria2c (~3MB)"}
            </span>
          </div>

          {/* Conexões - com seletor */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-surface-500 flex items-center gap-2">
              <IconRocket size={14} className="stroke-[1.5]" />
              Conexões
            </span>
            <select
              value={connections}
              onChange={(e) => onConnectionsChange(Number(e.target.value))}
              className="bg-transparent text-surface-600 font-medium text-xs text-right cursor-pointer focus:outline-none"
            >
              <option value={4}>4</option>
              <option value={8}>8</option>
              <option value={16}>16</option>
              <option value={32}>32</option>
            </select>
          </div>

          {/* Botão de download se não instalado */}
          {!status?.installed && !isDownloading && (
            <button
              onClick={handleToggle}
              className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <IconDownload size={14} />
              Instalar (~3MB)
            </button>
          )}

          {/* Botão de excluir se instalado */}
          {status?.installed && !isDeleting && (
            <button
              onClick={handleDelete}
              className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs font-medium rounded-lg transition-colors border border-red-200 dark:border-red-800"
            >
              <IconTrash size={14} />
              Excluir do sistema
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default function Settings() {
  const {
    theme,
    language,
    anonymousMode,
    remuxVideo,
    remuxFormat,
    embedThumbnail,
    skipExisting,
    autoUpdateYtDlp,
    ytDlpChannel,
    autoUpdateApp,
    startWithWindows,
    videoCompatibility,
    useAria2c,
    aria2cConnections,
    toggleTheme,
    setLanguage,
    setSetting,
    imageFormat,
    imageQuality,
  } = useSettingsStore();

  // Cast t to any to avoid TS errors for missing keys during dev
  const t = (translations[language] || translations["pt-BR"] || {}) as any;

  const [currentPath, setCurrentPath] = useState("");
  const [appVersions, setAppVersions] = useState<AppVersion[]>([]);
  const [currentAppVersion, setCurrentAppVersion] = useState("Loading...");
  const [selectedVersion, setSelectedVersion] = useState("");
  const [isUpdatingApp, setIsUpdatingApp] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const path = await GetDownloadsPath();
        setCurrentPath(path);

        const ver = await GetVersion();
        setCurrentAppVersion(ver);

        // Sync with Backend Settings
        try {
          // @ts-ignore
          const cfg = await GetSettings();
          if (cfg) {
            if (cfg.image) {
              setSetting("imageFormat", cfg.image.format);
              setSetting("imageQuality", cfg.image.quality);
            }
          }
        } catch (e) {
          console.error("Failed to load backend settings", e);
        }

        // @ts-ignore
        const versions = await GetAvailableAppVersions();
        if (versions && versions.length > 0) {
          setAppVersions(versions);
          // Default to latest if not set
          setSelectedVersion(versions[0].tag_name);
        }
      } catch (e) {
        console.error("Load settings error", e);
      }
    };
    load();
  }, []);

  // Sync Settings to Backend when changed
  useEffect(() => {
    // Debounce or just save
    const save = async () => {
      try {
        // @ts-ignore
        await SaveSettings({
          downloadsPath: currentPath, // Preserva
          image: {
            format: imageFormat,
            quality: imageQuality,
          },
        });
      } catch (e) {
        console.error("Save settings failed", e);
      }
    };
    // Don't save on mount, only update
    if (imageFormat) save();
  }, [imageFormat, imageQuality, currentPath]);

  const handleChangeFolder = async () => {
    try {
      // @ts-ignore
      const newPath = await SelectDirectory();
      if (newPath) {
        setCurrentPath(newPath);
      }
    } catch (e) {
      console.error("Erro ao selecionar pasta", e);
    }
  };

  const handleInstallAppVersion = async () => {
    if (!selectedVersion || isUpdatingApp) return;
    // Simple confirm
    if (!confirm(`Install version ${selectedVersion}? The app will restart.`))
      return;

    setIsUpdatingApp(true);
    try {
      // @ts-ignore
      await InstallAppVersion(selectedVersion);
      alert(
        "Update installed. Please restart the app manually if it doesn't restart."
      );
    } catch (e) {
      alert("Update failed: " + e);
      setIsUpdatingApp(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-surface-50/50">
      {/* Header */}
      <div className="flex-none px-8 py-8 border-b border-surface-200/60 dark:border-surface-800/60 bg-surface-50/80 backdrop-blur-xl z-10">
        <h2 className="text-3xl font-bold text-surface-900 tracking-tight">
          {t.settings?.title || "Settings"}
        </h2>
        <p className="mt-2 text-surface-500 text-sm font-medium">
          {t.settings?.subtitle || "Manage your preferences"}
        </p>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-8 py-8 space-y-10 custom-scrollbar">
        {/* Appearance */}
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400">
              {t.settings?.appearance?.title || "Appearance"}
            </h3>
            <div className="h-px flex-1 bg-surface-200 dark:bg-surface-800" />
          </div>

          <div className="grid gap-3">
            {/* Tema */}
            <SettingItem
              icon={IconPalette}
              label={
                "Theme / " + (t.settings?.appearance?.title || "Appearance")
              }
              desc={t.settings?.appearance?.desc || "Toggle dark/light mode"}
            >
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300 transition-colors"
              >
                {theme === "dark" ? (
                  <IconSun size={20} />
                ) : (
                  <IconGhost size={20} />
                )}
              </button>
            </SettingItem>

            {/* Idioma */}
            <SettingItem
              icon={IconLanguage}
              label={t.settings?.language?.title || "Language"}
            >
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="bg-surface-50 dark:bg-surface-200 border border-surface-200 dark:border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 cursor-pointer"
              >
                <option value="pt-BR">🇧🇷 Português (Brasil)</option>
                <option value="en-US">🇺🇸 English (US)</option>
                <option value="es-ES">🇪🇸 Español</option>
                <option value="fr-FR">🇫🇷 Français</option>
                <option value="de-DE">🇩🇪 Deutsch</option>
              </select>
            </SettingItem>
          </div>
        </section>

        {/* Folder */}
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400">
              {t.settings?.storage?.title || "Storage"}
            </h3>
            <div className="h-px flex-1 bg-surface-200 dark:bg-surface-800" />
          </div>

          <div className="grid gap-3">
            <SettingItem
              icon={IconFolder}
              label={t.settings?.storage?.path_label || "Downloads Folder"}
              desc={currentPath || "..."}
            >
              <button
                onClick={handleChangeFolder}
                className="btn-secondary flex items-center gap-2 px-3 py-2 text-xs font-medium bg-surface-100 hover:bg-surface-200 dark:bg-surface-700 dark:hover:bg-surface-600 rounded-lg transition-colors border border-surface-200 dark:border-surface-600"
              >
                <IconFolder size={16} />
                {t.settings?.storage?.change_btn || "Change Folder"}
              </button>
            </SettingItem>
          </div>
        </section>

        {/* Download Options */}
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-250">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400">
              {t.settings?.downloads?.title || "Download Options"}
            </h3>
            <div className="h-px flex-1 bg-surface-200 dark:bg-surface-800" />
          </div>

          <div className="grid gap-3">
            {/* Remux */}
            <SettingItem
              icon={IconFileExport}
              label={t.settings?.downloads?.remux || "Remux Video"}
              desc={
                t.settings?.downloads?.remux_desc ||
                "Convert to specific format"
              }
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

            {/* Thumbnail */}
            <SettingItem
              icon={IconPhoto}
              label={t.settings?.downloads?.thumbnail || "Embed Thumbnail"}
              desc={
                t.settings?.downloads?.thumbnail_desc || "Embed art in file"
              }
              active={embedThumbnail}
            >
              <Switch
                checked={embedThumbnail}
                onChange={(v) => setSetting("embedThumbnail", v)}
              />
            </SettingItem>

            {/* Skip Existing */}
            <SettingItem
              icon={IconPlayerSkipForward}
              label={t.settings?.downloads?.skip_existing || "Skip Existing"}
              desc={
                t.settings?.downloads?.skip_desc ||
                "Don't download if file exists"
              }
              active={skipExisting}
            >
              <Switch
                checked={skipExisting}
                onChange={(v) => setSetting("skipExisting", v)}
              />
            </SettingItem>

            {/* Video Compatibility - CRITICAL for audio issues */}
            <SettingItem
              icon={IconDeviceTv}
              label={
                t.settings?.downloads?.compatibility || "Video Compatibility"
              }
              desc={
                videoCompatibility === "universal"
                  ? "H.264 + AAC — Works on ALL players (Windows, TV, Mobile)"
                  : "VP9 + Opus — Better quality, requires VLC or modern player"
              }
            >
              <select
                value={videoCompatibility}
                onChange={(e) =>
                  setSetting("videoCompatibility", e.target.value)
                }
                className="bg-surface-50 dark:bg-surface-200 border border-surface-200 dark:border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 cursor-pointer"
              >
                <option value="universal">🎬 Universal (H.264/AAC)</option>
                <option value="modern">🚀 Modern (VP9/Opus)</option>
              </select>
            </SettingItem>

            {/* Aria2c Multi-Thread Download */}
            <Aria2cSetting
              useAria2c={useAria2c}
              onToggle={(v) => setSetting("useAria2c", v)}
              connections={aria2cConnections}
              onConnectionsChange={(v) => setSetting("aria2cConnections", v)}
            />
          </div>
        </section>

        {/* Image Options */}
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400">
              {t.settings?.images?.title || "Image Options"}
            </h3>
            <div className="h-px flex-1 bg-surface-200 dark:bg-surface-800" />
          </div>

          <div className="grid gap-3">
            {/* Format Selector */}
            <SettingItem
              icon={IconPhoto}
              label={t.settings?.images?.format || "Output Format"}
              desc={
                t.settings?.images?.format_desc ||
                "Convert downloads automatically"
              }
            >
              <select
                value={imageFormat}
                onChange={(e) =>
                  setSetting("imageFormat", e.target.value as any)
                }
                className="bg-surface-50 dark:bg-surface-200 border border-surface-200 dark:border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 cursor-pointer"
              >
                <option value="original">Original (No conversion)</option>
                <option value="jpg">JPEG (Compatible)</option>
                <option value="png">PNG (Lossless)</option>
                <option value="webp">WebP (Modern)</option>
                <option value="avif">AVIF (Best Compression)</option>
              </select>
            </SettingItem>

            {/* Quality Slider - Only for lossy formats */}
            {imageFormat !== "original" && imageFormat !== "png" && (
              <SettingItem
                icon={IconSparkles}
                label={t.settings?.images?.quality || "Quality"}
                desc={`${imageQuality}% — ${
                  imageQuality > 80
                    ? "High"
                    : imageQuality > 50
                    ? "Medium"
                    : "Low"
                }`}
              >
                <div className="flex items-center gap-4 w-32 sm:w-48">
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={imageQuality}
                    onChange={(e) =>
                      setSetting("imageQuality", Number(e.target.value))
                    }
                    className="w-full accent-primary-600 h-1.5 bg-surface-200 dark:bg-surface-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </SettingItem>
            )}
          </div>
        </section>

        {/* Privacy */}
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400">
              {t.settings?.privacy?.title || "Privacy"}
            </h3>
            <div className="h-px flex-1 bg-surface-200 dark:bg-surface-800" />
          </div>

          <div className="grid gap-3">
            <SettingItem
              icon={anonymousMode ? IconEyeOff : IconLock}
              label={t.settings?.privacy?.anonymous || "Anonymous Mode"}
              desc={t.settings?.privacy?.anonymous_desc || "Don't save history"}
              active={anonymousMode}
            >
              <Switch
                checked={anonymousMode}
                onChange={(v) => setSetting("anonymousMode", v)}
              />
            </SettingItem>
          </div>
        </section>

        {/* System & Updates */}
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-400">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400">
              {t.settings?.system?.title || "System"}
            </h3>
            <div className="h-px flex-1 bg-surface-200 dark:bg-surface-800" />
          </div>

          <div className="grid gap-3">
            {/* App Update */}
            <SettingItem
              icon={IconCloudCode || IconRefresh}
              label="Application Update"
              desc={`Current: ${currentAppVersion}`}
              active={autoUpdateApp}
            >
              <div className="flex flex-col items-end gap-3 w-full sm:w-auto">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-surface-500 dark:text-surface-400">
                    Auto-update app
                  </span>
                  <Switch
                    checked={autoUpdateApp}
                    onChange={(v) => setSetting("autoUpdateApp", v)}
                  />
                </div>

                {appVersions.length > 0 && (
                  <div className="flex items-center gap-2 bg-surface-100 dark:bg-surface-800 p-1.5 rounded-lg border border-surface-200 dark:border-surface-700">
                    <select
                      value={selectedVersion}
                      onChange={(e) => setSelectedVersion(e.target.value)}
                      className="bg-transparent text-xs text-surface-900 dark:text-surface-100 focus:outline-none cursor-pointer w-24 sm:w-32"
                    >
                      {appVersions.map((v) => (
                        <option key={v.tag_name} value={v.tag_name}>
                          {v.tag_name} {v.prerelease ? "(Beta)" : ""}
                        </option>
                      ))}
                    </select>
                    <div className="w-px h-4 bg-surface-300 dark:bg-surface-600" />
                    <button
                      onClick={handleInstallAppVersion}
                      disabled={isUpdatingApp}
                      className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 disabled:opacity-50 px-2 flex items-center gap-1"
                    >
                      {isUpdatingApp ? (
                        <IconRefresh className="animate-spin" size={14} />
                      ) : (
                        <IconDownload size={14} />
                      )}
                      <span className="text-xs font-medium">Install</span>
                    </button>
                  </div>
                )}
              </div>
            </SettingItem>

            {/* YT-DLP Update */}
            <SettingItem
              icon={IconDeviceTv}
              label="YT-DLP Updates"
              desc="Manage core downloader engine"
            >
              <div className="flex flex-col items-end gap-3 w-full sm:w-auto">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-surface-500 dark:text-surface-400">
                    Auto-update core
                  </span>
                  <Switch
                    checked={autoUpdateYtDlp}
                    onChange={(v) => setSetting("autoUpdateYtDlp", v)}
                  />
                </div>
                <div className="flex items-center gap-2 bg-surface-100 dark:bg-surface-800 p-1.5 rounded-lg border border-surface-200 dark:border-surface-700">
                  <span className="text-xs text-surface-500 pl-2">
                    Channel:
                  </span>
                  <select
                    value={ytDlpChannel}
                    onChange={(e) =>
                      setSetting(
                        "ytDlpChannel",
                        e.target.value as YtDlpChannelType
                      )
                    }
                    className="bg-transparent text-xs text-surface-900 dark:text-surface-100 focus:outline-none cursor-pointer"
                  >
                    <option value="stable">Stable</option>
                    <option value="nightly">Nightly</option>
                    <option value="master">Master</option>
                  </select>
                </div>
              </div>
            </SettingItem>

            {/* Start with Windows */}
            <SettingItem
              icon={IconDeviceDesktop}
              label="Startup"
              desc="Launch automatically"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-surface-500 dark:text-surface-400">
                  Start with Windows
                </span>
                <Switch
                  checked={startWithWindows}
                  onChange={(v) => setSetting("startWithWindows", v)}
                />
              </div>
            </SettingItem>
          </div>
        </section>

        {/* Footer info */}
        <div className="mt-8 text-center pb-8">
          <span className="text-xs text-surface-400 font-mono opacity-50">
            Kinematic v{currentAppVersion} • built with Wails
          </span>
        </div>
      </div>
    </div>
  );
}
