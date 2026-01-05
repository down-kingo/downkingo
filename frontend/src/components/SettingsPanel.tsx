import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconX,
  IconVideo,
  IconPhoto,
  IconPalette,
  IconDownload,
  IconSettings,
  IconKeyboard,
  IconInfoCircle,
  IconTransform,
  IconPuzzle,
} from "@tabler/icons-react";
import VideoSettings from "./settings/VideoSettings";
import ImageSettings from "./settings/ImageSettings";
import GeneralSettings from "./settings/GeneralSettings";
import ShortcutSettings from "./settings/ShortcutSettings";
import AppearanceSettings from "./settings/AppearanceSettings";
import AboutSettings from "./settings/AboutSettings";
import ConverterSettings from "./settings/ConverterSettings";

type SettingsTab =
  | "general"
  | "appearance"
  | "video"
  | "images"
  | "converter"
  | "shortcuts"
  | "about";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// Tab groups for better organization
interface TabGroup {
  label?: string;
  tabs: {
    id: SettingsTab;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    indent?: boolean;
  }[];
}

const tabGroups: TabGroup[] = [
  {
    tabs: [
      { id: "general", label: "Geral", icon: IconSettings },
      { id: "appearance", label: "Aparência", icon: IconPalette },
    ],
  },
  {
    label: "Downloads",
    tabs: [
      { id: "video", label: "Vídeos", icon: IconVideo, indent: true },
      { id: "images", label: "Imagens", icon: IconPhoto, indent: true },
    ],
  },
  {
    label: "Conversão",
    tabs: [
      {
        id: "converter",
        label: "Converter",
        icon: IconTransform,
        indent: true,
      },
    ],
  },
  {
    tabs: [
      { id: "shortcuts", label: "Atalhos", icon: IconKeyboard },
      { id: "about", label: "Sobre", icon: IconInfoCircle },
    ],
  },
];

// Flat list for header title lookup
const allTabs = tabGroups.flatMap((g) => g.tabs);

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-3xl bg-white dark:bg-[#09090b] shadow-2xl z-50 flex"
          >
            {/* Sidebar interno */}
            <div className="w-52 bg-surface-100 dark:bg-[#121214] border-r border-surface-200 dark:border-surface-200 flex flex-col">
              {/* Header */}
              <div className="h-[73px] flex items-center px-4 border-b border-surface-200 dark:border-surface-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-100 dark:bg-primary-500/10 rounded-lg">
                    <IconSettings
                      size={20}
                      className="text-primary-600 dark:text-primary-500"
                    />
                  </div>
                  <span className="font-semibold text-surface-900 dark:text-white">
                    Configurações
                  </span>
                </div>
              </div>

              {/* Tabs with Groups */}
              <nav className="flex-1 p-2 space-y-3 overflow-y-auto">
                {tabGroups.map((group, groupIndex) => (
                  <div key={groupIndex}>
                    {/* Group Label */}
                    {group.label && (
                      <div className="flex items-center gap-2 px-3 py-2">
                        {group.label === "Downloads" && (
                          <IconDownload
                            size={14}
                            className="text-surface-400"
                          />
                        )}
                        {group.label === "Conversão" && (
                          <IconTransform
                            size={14}
                            className="text-surface-400"
                          />
                        )}
                        {group.label === "Integração" && (
                          <IconPuzzle size={14} className="text-surface-400" />
                        )}
                        <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                          {group.label}
                        </span>
                      </div>
                    )}

                    {/* Tabs in group */}
                    <div className="space-y-1">
                      {group.tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                          <motion.button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                              tab.indent ? "pl-5" : ""
                            } ${
                              isActive
                                ? "bg-white dark:bg-[#27272a] text-primary-600 dark:text-white shadow-sm"
                                : "text-surface-600 dark:text-surface-400 hover:bg-white/50 dark:hover:bg-[#27272a]/50 hover:text-surface-900 dark:hover:text-white"
                            }`}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                          >
                            <Icon
                              size={18}
                              className={
                                isActive
                                  ? "text-primary-600"
                                  : "text-surface-400"
                              }
                            />
                            <span>{tab.label}</span>
                            {isActive && (
                              <motion.div
                                layoutId="activeTab"
                                className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-600"
                              />
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>

              {/* Close button */}
              <div className="p-3 border-t border-surface-200 dark:border-surface-200">
                <button
                  onClick={onClose}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white hover:bg-white dark:hover:bg-[#27272a] rounded-lg transition-colors"
                >
                  <IconX size={16} />
                  <span>Fechar</span>
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col bg-surface-50 dark:bg-[#09090b]">
              {/* Tab Content Header */}
              <div className="h-[73px] flex items-center px-8 border-b border-surface-200 dark:border-surface-200 bg-surface-50/50 dark:bg-[#09090b]">
                <motion.h2
                  key={activeTab}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xl font-bold text-surface-900 dark:text-white"
                >
                  {allTabs.find((t) => t.id === activeTab)?.label}
                </motion.h2>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-8">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {activeTab === "general" && <GeneralSettings />}
                    {activeTab === "appearance" && <AppearanceSettings />}
                    {activeTab === "video" && <VideoSettings />}
                    {activeTab === "images" && <ImageSettings />}
                    {activeTab === "converter" && <ConverterSettings />}
                    {activeTab === "shortcuts" && <ShortcutSettings />}
                    {activeTab === "about" && <AboutSettings />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
