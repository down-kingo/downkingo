import { useEffect, useState } from "react";
import {
  IconLanguage,
  IconFolder,
  IconEyeOff,
  IconLock,
  IconDeviceDesktop,
  IconVideo,
  IconPhoto,
  IconClipboard,
} from "@tabler/icons-react";
import { useSettingsStore, Language } from "../../stores/settingsStore";
import { translations } from "../../translations";
import {
  GetVideoDownloadPath,
  GetImageDownloadPath,
  SelectVideoDirectory,
  SelectImageDirectory,
  SetClipboardMonitor,
} from "../../../wailsjs/go/main/App";

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
  const {
    language,
    anonymousMode,
    startWithWindows,
    clipboardMonitorEnabled,
    setLanguage,
    setSetting,
  } = useSettingsStore();

  const t = (translations[language] || translations["pt-BR"] || {}) as any;
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
      console.error("Erro ao selecionar pasta de vídeo", e);
    }
  };

  const handleChangeImageFolder = async () => {
    try {
      const newPath = await SelectImageDirectory();
      if (newPath) {
        setImagePath(newPath);
      }
    } catch (e) {
      console.error("Erro ao selecionar pasta de imagem", e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Geral */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3 flex items-center gap-2">
          <IconLanguage size={14} />
          Regional
        </h3>
        <div className="space-y-3">
          <SettingItem icon={IconLanguage} label="Idioma">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="bg-surface-50 dark:bg-surface-200 border border-surface-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 cursor-pointer"
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

      {/* Armazenamento */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3 flex items-center gap-2">
          <IconFolder size={14} />
          Armazenamento
        </h3>
        <div className="space-y-3">
          <SettingItem
            icon={IconVideo}
            label={t.settings.storage.path_video_label || "Pasta de Vídeos"}
            desc={videoPath || "..."}
          >
            <button
              onClick={handleChangeVideoFolder}
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium bg-surface-100 hover:bg-surface-200 dark:bg-surface-200 dark:hover:bg-surface-300 rounded-lg transition-colors border border-surface-200 dark:border-zinc-800 text-surface-700 dark:text-white"
            >
              <IconFolder size={16} />
              {t.settings.storage.change_btn}
            </button>
          </SettingItem>

          <SettingItem
            icon={IconPhoto}
            label={t.settings.storage.path_image_label || "Pasta de Imagens"}
            desc={imagePath || "..."}
          >
            <button
              onClick={handleChangeImageFolder}
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium bg-surface-100 hover:bg-surface-200 dark:bg-surface-200 dark:hover:bg-surface-300 rounded-lg transition-colors border border-surface-200 dark:border-zinc-800 text-surface-700 dark:text-white"
            >
              <IconFolder size={16} />
              {t.settings.storage.change_btn}
            </button>
          </SettingItem>
        </div>
      </section>

      {/* Privacidade */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3 flex items-center gap-2">
          <IconLock size={14} />
          Privacidade
        </h3>
        <div className="space-y-3">
          <SettingItem
            icon={anonymousMode ? IconEyeOff : IconLock}
            label="Modo Anônimo"
            desc="Não salvar histórico de downloads"
            active={anonymousMode}
          >
            <Switch
              checked={anonymousMode}
              onChange={(v) => setSetting("anonymousMode", v)}
            />
          </SettingItem>
        </div>
      </section>

      {/* Sistema */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3 flex items-center gap-2">
          <IconDeviceDesktop size={14} />
          Sistema
        </h3>
        <div className="space-y-3">
          <SettingItem
            icon={IconDeviceDesktop}
            label="Iniciar com Windows"
            desc="Abrir automaticamente ao ligar o PC"
            active={startWithWindows}
          >
            <Switch
              checked={startWithWindows}
              onChange={(v) => setSetting("startWithWindows", v)}
            />
          </SettingItem>

          <SettingItem
            icon={IconClipboard}
            label="Monitorar Área de Transferência"
            desc="Detectar links copiados e sugerir download"
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
        </div>
      </section>
    </div>
  );
}
