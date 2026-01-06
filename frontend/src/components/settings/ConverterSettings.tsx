import { useState, useEffect } from "react";
import {
  IconWand,
  IconFolder,
  IconBell,
  IconCheck,
  IconRocket,
  IconDownload,
  IconTrash,
  IconCpu,
} from "@tabler/icons-react";

import {
  CheckRembgStatus,
  DownloadRembg,
  DeleteRembg,
} from "../../../wailsjs/go/main/App";
import { useTranslation } from "react-i18next";

// Componentes locais (reutilizados para consistência visual)
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

interface RembgStatus {
  installed: boolean;
  path: string;
  version: string;
  downloading: boolean;
}

export default function ConverterSettings() {
  const { t } = useTranslation("settings");
  const [rembgStatus, setRembgStatus] = useState<RembgStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Preferências locais (mockadas por enquanto, serão conectadas ao store futuramente)
  const [notifyFinish, setNotifyFinish] = useState(true);
  const [openFolder, setOpenFolder] = useState(true);
  const [rembgModel, setRembgModel] = useState("u2net");

  const checkRembg = async () => {
    setIsChecking(true);
    try {
      const status = await CheckRembgStatus();
      setRembgStatus(status);
    } catch (err) {
      setRembgStatus({
        installed: false,
        path: "",
        version: "",
        downloading: false,
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleDownloadRembg = async () => {
    setIsDownloading(true);
    try {
      await DownloadRembg();
      await checkRembg();
    } catch (err) {
      console.error(err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDeleteRembg = async () => {
    setIsDeleting(true);
    try {
      await DeleteRembg();
      await checkRembg();
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    checkRembg();
  }, []);

  return (
    <div className="space-y-6">
      {/* Comportamento Geral */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3 flex items-center gap-2">
          <IconFolder size={14} />
          {t("converter_settings.behavior_title")}
        </h3>
        <div className="space-y-3">
          <SettingItem
            icon={IconFolder}
            label={t("converter_settings.open_folder")}
            desc={t("converter_settings.open_folder_desc")}
            active={openFolder}
          >
            <Switch checked={openFolder} onChange={setOpenFolder} />
          </SettingItem>

          <SettingItem
            icon={IconBell}
            label={t("converter_settings.notify_finish")}
            desc={t("converter_settings.notify_finish_desc")}
            active={notifyFinish}
          >
            <Switch checked={notifyFinish} onChange={setNotifyFinish} />
          </SettingItem>
        </div>
      </section>

      {/* IA (Rembg) */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3 flex items-center gap-2">
          <IconWand size={14} />
          {t("rembg_settings.title")}
        </h3>

        <div className="p-4 bg-white dark:bg-surface-100 border border-surface-200 dark:border-zinc-800 rounded-xl space-y-4 shadow-sm dark:shadow-none">
          {/* Header Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-surface-50 dark:bg-surface-50 rounded-lg border border-surface-100 dark:border-zinc-800">
                <IconWand
                  size={20}
                  className={`stroke-[1.5] ${
                    rembgStatus?.installed
                      ? "text-primary-600"
                      : "text-surface-400"
                  }`}
                />
              </div>
              <div>
                <span className="text-sm font-semibold text-surface-900">
                  {t("rembg_settings.core")}
                </span>
                <p className="text-xs text-surface-500">
                  {isDownloading
                    ? t("rembg_settings.installing")
                    : isDeleting
                    ? t("rembg_settings.removing")
                    : rembgStatus?.installed
                    ? t("rembg_settings.installed")
                    : t("rembg_settings.not_installed_desc")}
                </p>
              </div>
            </div>

            {isDownloading || isDeleting ? (
              <div className="w-11 h-6 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !rembgStatus?.installed ? (
              <button
                onClick={handleDownloadRembg}
                disabled={isDownloading}
                className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <IconDownload size={14} />
                {t("rembg_settings.install_btn")}
              </button>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium border border-green-200 dark:border-green-800">
                <IconCheck size={14} />
                {t("rembg_settings.status_installed")}
              </div>
            )}
          </div>

          {/* Details & Configs */}
          <div className="p-3 bg-surface-100/50 dark:bg-surface-800/30 rounded-lg space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-surface-500 flex items-center gap-2">
                <IconCpu size={14} />
                {t("rembg_settings.model_default")}
              </span>
              <select
                value={rembgModel}
                onChange={(e) => setRembgModel(e.target.value)}
                className="bg-transparent text-surface-600 font-medium text-xs text-right cursor-pointer focus:outline-none"
                disabled={!rembgStatus?.installed}
              >
                <option value="u2net">{t("rembg_settings.model_u2net")}</option>
                <option value="u2netp">
                  {t("rembg_settings.model_u2netp")}
                </option>
                <option value="u2net_human_seg">
                  {t("rembg_settings.model_human_seg")}
                </option>
                <option value="silueta">
                  {t("rembg_settings.model_silueta")}
                </option>
                <option value="isnet-general-use">
                  {t("rembg_settings.model_isnet")}
                </option>
              </select>
            </div>

            {rembgStatus?.installed && (
              <div className="flex items-center justify-between text-xs border-t border-surface-200 dark:border-zinc-700/50 pt-2">
                <span className="text-surface-500">
                  {t("rembg_settings.manage")}
                </span>
                <button
                  onClick={handleDeleteRembg}
                  disabled={isDeleting}
                  className="text-red-500 hover:text-red-600 transition-colors flex items-center gap-1"
                >
                  <IconTrash size={14} />
                  {t("rembg_settings.uninstall")}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
