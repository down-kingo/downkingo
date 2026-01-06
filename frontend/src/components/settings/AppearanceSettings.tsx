import {
  IconPalette,
  IconSun,
  IconGhost,
  IconLayoutSidebar,
  IconLayoutNavbar,
  IconCheck,
} from "@tabler/icons-react";
import {
  useSettingsStore,
  AppColor,
  AppLayout,
} from "../../stores/settingsStore";
import { useTranslation } from "react-i18next";

// Components locais (reutilizados para consistência visual)
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

const ColorSwatch = ({
  color,
  selected,
  onClick,
}: {
  color: string;
  selected: boolean;
  onClick: () => void;
}) => {
  // Mapeamento de cores para classes Tailwind (exemplo visual)
  const colorMap: Record<string, string> = {
    rose: "bg-rose-500",
    blue: "bg-blue-500",
    green: "bg-emerald-500",
    orange: "bg-amber-500",
    purple: "bg-violet-500",
  };

  return (
    <button
      onClick={onClick}
      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
        colorMap[color] || "bg-gray-500"
      } ${
        selected
          ? "ring-2 ring-offset-2 ring-surface-400 dark:ring-surface-500 scale-110"
          : "hover:scale-105"
      }`}
    >
      {selected && <IconCheck size={14} className="text-white stroke-[3]" />}
    </button>
  );
};

export default function AppearanceSettings() {
  const {
    theme,
    layout,
    primaryColor,
    toggleTheme,
    setLayout,
    setPrimaryColor,
  } = useSettingsStore();
  const { t } = useTranslation("settings");

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3 flex items-center gap-2">
          <IconPalette size={14} />
          {t("appearance_settings.style_theme")}
        </h3>
        <div className="space-y-3">
          {/* Tema Light/Dark */}
          <SettingItem
            icon={theme === "dark" ? IconGhost : IconSun}
            label={t("appearance_settings.system_theme")}
            desc={t("appearance_settings.theme_desc")} // Using consistent key format
          >
            <div className="flex p-1 bg-surface-100 dark:bg-surface-50 rounded-lg border border-surface-200 dark:border-zinc-800">
              <button
                onClick={() => theme === "dark" && toggleTheme()}
                className={`p-2 rounded-md transition-all ${
                  theme === "light"
                    ? "bg-white shadow-sm text-yellow-600"
                    : "text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200"
                }`}
              >
                <IconSun size={18} />
              </button>
              <button
                onClick={() => theme === "light" && toggleTheme()}
                className={`p-2 rounded-md transition-all ${
                  theme === "dark"
                    ? "bg-surface-200 shadow-sm text-purple-400"
                    : "text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200"
                }`}
              >
                <IconGhost size={18} />
              </button>
            </div>
          </SettingItem>

          {/* Cor de Destaque */}
          <SettingItem
            icon={IconPalette}
            label={t("appearance_settings.accent_color")}
            desc={t("appearance_settings.accent_desc")}
          >
            <div className="flex gap-3">
              {(
                ["rose", "blue", "green", "orange", "purple"] as AppColor[]
              ).map((color) => (
                <ColorSwatch
                  key={color}
                  color={color}
                  selected={primaryColor === color}
                  onClick={() => setPrimaryColor(color)}
                />
              ))}
            </div>
          </SettingItem>
        </div>
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3 flex items-center gap-2">
          <IconLayoutSidebar size={14} />
          {t("appearance_settings.layout")}
        </h3>
        <div className="space-y-3">
          {/* Layout Selector */}
          <SettingItem
            icon={layout === "sidebar" ? IconLayoutSidebar : IconLayoutNavbar}
            label={t("appearance_settings.menu_layout")}
            desc={t("appearance_settings.menu_desc")}
          >
            <div className="flex p-1 bg-surface-100 dark:bg-surface-50 rounded-lg border border-surface-200 dark:border-zinc-800">
              <button
                onClick={() => setLayout("sidebar")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  layout === "sidebar"
                    ? "bg-white dark:bg-surface-200 shadow-sm text-surface-900 dark:text-white"
                    : "text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200"
                }`}
              >
                <IconLayoutSidebar size={16} />
                <span>{t("appearance_settings.sidebar")}</span>
              </button>
              <button
                onClick={() => setLayout("topbar")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  layout === "topbar"
                    ? "bg-white dark:bg-surface-200 shadow-sm text-surface-900 dark:text-white"
                    : "text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200"
                }`}
              >
                <IconLayoutNavbar size={16} />
                <span>{t("appearance_settings.topbar")}</span>
              </button>
            </div>
          </SettingItem>
        </div>
      </section>
    </div>
  );
}
