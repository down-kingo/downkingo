import { useState } from "react";
import { IconMicrophone, IconCpu, IconLanguage } from "@tabler/icons-react";

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
      <div className="flex flex-col gap-0.5 max-w-[280px]">
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
    <div className="flex items-center sm:pl-0 sm:justify-end w-full sm:w-auto">
      {children}
    </div>
  </div>
);

export default function TranscriberSettings() {
  const { t } = useTranslation("settings");

  // Preferências locais mockadas (futuramente conectadas a um store/backend)
  const [modelQuality, setModelQuality] = useState("base");
  const [targetLang, setTargetLang] = useState("auto");

  return (
    <div className="space-y-6">
      {/* Comportamento Geral */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3 flex items-center gap-2">
          <IconMicrophone size={14} />
          {t("transcriber_settings.title", "Configurações do Transcritor")}
        </h3>
        <div className="space-y-3">
          <SettingItem
            icon={IconCpu}
            label={t(
              "transcriber_settings.model_quality",
              "Qualidade do Modelo Whisper",
            )}
            desc={t(
              "transcriber_settings.model_quality_desc",
              "Modelos maiores tem mais precisão mas consomem mais CPU e RAM.",
            )}
          >
            <div className="relative w-full sm:w-[160px]">
              <select
                value={modelQuality}
                onChange={(e) => setModelQuality(e.target.value)}
                className="w-full appearance-none bg-surface-50 border border-surface-200 dark:bg-[#121214] dark:border-white/10 rounded-lg py-2 pl-3 pr-10 text-sm font-medium text-surface-900 dark:text-surface-100 hover:border-surface-300 focus:outline-none focus:ring-2 focus:ring-primary-500/50 shadow-sm transition-all text-left"
              >
                <option value="tiny">Tiny (Mais rápido)</option>
                <option value="base">Base (Padrão)</option>
                <option value="small">Small (Equilibrado)</option>
                <option value="medium">Medium (Lento/Preciso)</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-surface-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
            </div>
          </SettingItem>

          <SettingItem
            icon={IconLanguage}
            label={t("transcriber_settings.language", "Idioma Padrão")}
            desc={t(
              "transcriber_settings.language_desc",
              "Forçar um idioma pode melhorar a precisão, 'Automático' tentará detectar.",
            )}
          >
            <div className="relative w-full sm:w-[160px]">
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="w-full appearance-none bg-surface-50 border border-surface-200 dark:bg-[#121214] dark:border-white/10 rounded-lg py-2 pl-3 pr-10 text-sm font-medium text-surface-900 dark:text-surface-100 hover:border-surface-300 focus:outline-none focus:ring-2 focus:ring-primary-500/50 shadow-sm transition-all text-left"
              >
                <option value="auto">Automático</option>
                <option value="pt">Português (BR)</option>
                <option value="en">Inglês</option>
                <option value="es">Espanhol</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-surface-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
            </div>
          </SettingItem>
        </div>
      </section>
    </div>
  );
}
