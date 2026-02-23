import {
  IconHome,
  IconDownload,
  IconPhoto,
  IconTransform,
  IconMicrophone,
  IconList,
  IconSettings,
  IconMap2,
  IconHistory,
} from "@tabler/icons-react";
import { TabType } from "./Sidebar";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../../stores/settingsStore";
import { Logo } from "../Logo";

interface TopbarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  queueCount: number;
  onOpenSettings: () => void;
}

export default function Topbar({
  activeTab,
  setActiveTab,
  queueCount,
  onOpenSettings,
}: TopbarProps) {
  const { t } = useTranslation("common");
  const enabledFeatures = useSettingsStore((s) => s.enabledFeatures);
  return (
    <header className="flex items-center justify-between px-6 py-3 bg-surface-50 dark:bg-surface-50 border-b border-surface-200 dark:border-white/10">
      {/* Brand Logo (Simplified) */}
      <div className="flex items-center gap-3 select-none">
        <Logo size={32} />
        <span className="font-display font-bold text-lg tracking-tight text-surface-900">
          DownKingo
        </span>
      </div>

      {/* Navigation Links */}
      <nav className="flex items-center gap-1 bg-surface-100 dark:bg-surface-200/50 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab("home")}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            activeTab === "home"
              ? "bg-white dark:bg-surface-100 text-surface-900"
              : "text-surface-600 hover:text-surface-900"
          }`}
        >
          <IconHome size={16} />
          <span>{t("nav.home")}</span>
        </button>

        {/* Downloads group */}
        {(enabledFeatures.includes("videos") ||
          enabledFeatures.includes("images")) && (
          <div className="w-px h-4 bg-surface-300 dark:bg-surface-400/30 mx-0.5" />
        )}
        {enabledFeatures.includes("videos") && (
          <button
            onClick={() => setActiveTab("video")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === "video"
                ? "bg-white dark:bg-surface-100 text-surface-900"
                : "text-surface-600 hover:text-surface-900"
            }`}
          >
            <IconDownload size={16} />
            <span>{t("nav.videos")}</span>
          </button>
        )}
        {enabledFeatures.includes("images") && (
          <button
            onClick={() => setActiveTab("images")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === "images"
                ? "bg-white dark:bg-surface-100 text-surface-900"
                : "text-surface-600 hover:text-surface-900"
            }`}
          >
            <IconPhoto size={16} />
            <span>{t("nav.images")}</span>
          </button>
        )}
        <button
          onClick={() => setActiveTab("queue")}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            activeTab === "queue"
              ? "bg-white dark:bg-surface-100 text-surface-900"
              : "text-surface-600 hover:text-surface-900"
          }`}
        >
          <IconList size={16} />
          <span>{t("nav.queue")}</span>
          {queueCount > 0 && (
            <span className="text-xs font-bold bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full ml-1">
              {queueCount}
            </span>
          )}
        </button>

        {/* Tools group */}
        {(enabledFeatures.includes("converter") ||
          enabledFeatures.includes("transcriber")) && (
          <div className="w-px h-4 bg-surface-300 dark:bg-surface-400/30 mx-0.5" />
        )}
        {enabledFeatures.includes("converter") && (
          <button
            onClick={() => setActiveTab("converter")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === "converter"
                ? "bg-white dark:bg-surface-100 text-surface-900"
                : "text-surface-600 hover:text-surface-900"
            }`}
          >
            <IconTransform size={16} />
            <span>{t("nav.converter")}</span>
          </button>
        )}
        {enabledFeatures.includes("transcriber") && (
          <button
            onClick={() => setActiveTab("transcriber")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === "transcriber"
                ? "bg-white dark:bg-surface-100 text-surface-900"
                : "text-surface-600 hover:text-surface-900"
            }`}
          >
            <IconMicrophone size={16} />
            <span>{t("nav.transcriber")}</span>
          </button>
        )}

        {/* History & Roadmap */}
        <div className="w-px h-4 bg-surface-300 dark:bg-surface-400/30 mx-0.5" />
        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            activeTab === "history"
              ? "bg-white dark:bg-surface-100 text-surface-900"
              : "text-surface-600 hover:text-surface-900"
          }`}
        >
          <IconHistory size={16} />
          <span>{t("nav.history")}</span>
        </button>
        <button
          onClick={() => setActiveTab("roadmap")}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            activeTab === "roadmap"
              ? "bg-white dark:bg-surface-100 text-surface-900"
              : "text-surface-600 hover:text-surface-900"
          }`}
        >
          <IconMap2 size={16} />
          <span>{t("nav.roadmap")}</span>
        </button>
      </nav>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSettings}
          className="p-2 text-surface-500 hover:text-surface-900 hover:bg-surface-100 dark:hover:bg-surface-200 rounded-lg transition-colors"
        >
          <IconSettings size={20} />
        </button>
      </div>
    </header>
  );
}
