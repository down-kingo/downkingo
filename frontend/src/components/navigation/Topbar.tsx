import {
  IconHome,
  IconDownload,
  IconPhoto,
  IconTransform,
  IconList,
  IconSettings,
} from "@tabler/icons-react";
import { TabType } from "./Sidebar";

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
  return (
    <header className="flex items-center justify-between px-6 py-3 bg-surface-50 dark:bg-surface-50 border-b border-surface-200 dark:border-surface-800">
      {/* Brand Logo (Simplified) */}
      <div className="flex items-center gap-3 select-none">
        <div className="w-8 h-8 rounded-lg bg-surface-900 dark:bg-white flex items-center justify-center text-white dark:text-black">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 3v18" />
            <path d="M20 4L8 12l12 8" />
          </svg>
        </div>
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
              ? "bg-white dark:bg-surface-100 text-surface-900 shadow-sm"
              : "text-surface-600 hover:text-surface-900"
          }`}
        >
          <IconHome size={16} />
          <span>Início</span>
        </button>
        <button
          onClick={() => setActiveTab("video")}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            activeTab === "video"
              ? "bg-white dark:bg-surface-100 text-surface-900 shadow-sm"
              : "text-surface-600 hover:text-surface-900"
          }`}
        >
          <IconDownload size={16} />
          <span>Vídeos</span>
        </button>
        <button
          onClick={() => setActiveTab("images")}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            activeTab === "images"
              ? "bg-white dark:bg-surface-100 text-surface-900 shadow-sm"
              : "text-surface-600 hover:text-surface-900"
          }`}
        >
          <IconPhoto size={16} />
          <span>Imagens</span>
        </button>
        <button
          onClick={() => setActiveTab("converter")}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            activeTab === "converter"
              ? "bg-white dark:bg-surface-100 text-surface-900 shadow-sm"
              : "text-surface-600 hover:text-surface-900"
          }`}
        >
          <IconTransform size={16} />
          <span>Converter</span>
        </button>
        <button
          onClick={() => setActiveTab("queue")}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            activeTab === "queue"
              ? "bg-white dark:bg-surface-100 text-surface-900 shadow-sm"
              : "text-surface-600 hover:text-surface-900"
          }`}
        >
          <IconList size={16} />
          <span>Fila</span>
          {queueCount > 0 && (
            <span className="text-xs font-bold bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full ml-1">
              {queueCount}
            </span>
          )}
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
