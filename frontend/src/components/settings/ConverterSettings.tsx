import { useState, useEffect } from "react";
import { IconFolder, IconBell } from "@tabler/icons-react";

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

export default function ConverterSettings() {
  const { t } = useTranslation("settings");

  // Preferências locais (mockadas por enquanto, serão conectadas ao store futuramente)
  const [notifyFinish, setNotifyFinish] = useState(true);
  const [openFolder, setOpenFolder] = useState(true);

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
    </div>
  );
}
