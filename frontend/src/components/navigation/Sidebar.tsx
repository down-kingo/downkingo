import {
  IconHome,
  IconDownload,
  IconPhoto,
  IconTransform,
  IconList,
  IconHistory,
  IconSettings,
  IconMap2,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Logo } from "../Logo";

export type TabType =
  | "home"
  | "video"
  | "images"
  | "converter"
  | "history"
  | "queue"
  | "roadmap";

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  queueCount: number;
  version: string;
  onOpenSettings: () => void;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  queueCount,
  version,
  onOpenSettings,
}: SidebarProps) {
  const { t } = useTranslation("common");

  return (
    <aside className="sidebar">
      {/* Brand Logo */}
      <div className="p-6 pb-2">
        <div className="flex items-center gap-3 select-none">
          {/* Ícone K customizado - Marca Proprietária */}
          <Logo size={40} className="shadow-lg shadow-black/20" />

          {/* Logotipo Tipográfico */}
          <div className="flex flex-col -space-y-0.5">
            <span className="font-display font-bold text-xl tracking-tight text-surface-900">
              Kingo
            </span>
            <span className="text-[10px] font-bold text-primary-600 uppercase tracking-widest leading-none">
              Downloader
            </span>
          </div>
        </div>
      </div>

      {/* Sidebar Navigation */}
      <nav className="px-4 mt-8 flex-1 overflow-y-auto custom-scrollbar">
        <div className="space-y-6">
          {/* Home Section */}
          <div>
            <button
              onClick={() => setActiveTab("home")}
              className={`sidebar-link w-full ${
                activeTab === "home" ? "active" : ""
              }`}
            >
              <IconHome size={18} />
              <span>{t("nav.home")}</span>
            </button>
            <button
              onClick={() => setActiveTab("queue")}
              className={`sidebar-link w-full mt-1 ${
                activeTab === "queue" ? "active" : ""
              }`}
            >
              <IconList size={18} />
              <span>{t("nav.queue")}</span>
              {activeTab !== "queue" && queueCount > 0 && (
                <span className="ml-auto text-xs font-bold bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
                  {queueCount}
                </span>
              )}
            </button>
          </div>

          {/* Downloads Category */}
          <div>
            <h3 className="text-xs font-bold text-surface-400 dark:text-surface-600 uppercase tracking-widest px-4 mb-3">
              Downloads
            </h3>
            <div className="space-y-1">
              <button
                onClick={() => setActiveTab("video")}
                className={`sidebar-link w-full ${
                  activeTab === "video" ? "active" : ""
                }`}
              >
                <IconDownload size={18} />
                <span>{t("nav.videos")}</span>
              </button>
              <button
                onClick={() => setActiveTab("images")}
                className={`sidebar-link w-full ${
                  activeTab === "images" ? "active" : ""
                }`}
              >
                <IconPhoto size={18} />
                <span>{t("nav.images")}</span>
              </button>
            </div>
          </div>

          {/* Conversion Category */}
          <div>
            <h3 className="text-xs font-bold text-surface-400 dark:text-surface-600 uppercase tracking-widest px-4 mb-3">
              {t("nav.converter")}
            </h3>
            <div className="space-y-1">
              <button
                onClick={() => setActiveTab("converter")}
                className={`sidebar-link w-full ${
                  activeTab === "converter" ? "active" : ""
                }`}
              >
                <IconTransform size={18} />
                <span>{t("nav.converter")}</span>
              </button>
            </div>
          </div>

          {/* Library Category */}
          <div>
            <h3 className="text-xs font-bold text-surface-400 dark:text-surface-600 uppercase tracking-widest px-4 mb-3">
              {t("nav.history")}
            </h3>
            <div className="space-y-1">
              <button
                onClick={() => setActiveTab("history")}
                className={`sidebar-link w-full ${
                  activeTab === "history" ? "active" : ""
                }`}
              >
                <IconHistory size={18} />
                <span>{t("nav.history")}</span>
              </button>
            </div>
          </div>

          {/* Community Category */}
          <div>
            <h3 className="text-xs font-bold text-surface-400 dark:text-surface-600 uppercase tracking-widest px-4 mb-3">
              {t("nav.roadmap")}
            </h3>
            <div className="space-y-1">
              <button
                onClick={() => setActiveTab("roadmap")}
                className={`sidebar-link w-full ${
                  activeTab === "roadmap" ? "active" : ""
                }`}
              >
                <IconMap2 size={18} />
                <span>{t("nav.roadmap")}</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Footer - Settings & Version */}
      <div className="p-4 mt-auto border-t border-surface-100 dark:border-surface-200">
        <button
          onClick={onOpenSettings}
          className="sidebar-link w-full justify-between group"
        >
          <div className="flex items-center gap-3">
            <IconSettings
              size={18}
              className="text-surface-500 group-hover:text-surface-900 group-hover:dark:text-surface-100 transition-colors"
            />
            <span>{t("nav.settings")}</span>
          </div>
        </button>

        <div className="px-4 mt-3 flex justify-between items-center text-xs text-surface-400 dark:text-surface-600">
          <span>v{version}</span>
        </div>
      </div>
    </aside>
  );
}
