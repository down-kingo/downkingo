import {
  IconInfoCircle,
  IconHeart,
  IconBook,
  IconBrandGithub,
  IconExternalLink,
} from "@tabler/icons-react";
import { safeBrowserOpenURL } from "../../lib/wailsRuntime";
import { useSettingsStore } from "../../stores/settingsStore";
import { translations } from "../../translations";

const SettingItem = ({
  icon: Icon,
  label,
  desc,
  children,
  onClick,
}: {
  icon: any;
  label: string;
  desc?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}) => (
  <div
    onClick={onClick}
    className={`group flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white dark:bg-surface-100 border border-surface-200 dark:border-zinc-800 rounded-xl transition-all duration-200 shadow-sm dark:shadow-none ${
      onClick
        ? "cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-200/50"
        : ""
    }`}
  >
    <div className="flex items-start gap-4 mb-3 sm:mb-0">
      <div className="p-2.5 bg-surface-50 dark:bg-surface-50 rounded-lg group-hover:scale-110 transition-all duration-300 border border-surface-100 dark:border-zinc-800">
        <Icon
          size={20}
          className="text-surface-400 dark:text-surface-600 group-hover:text-primary-600 dark:group-hover:text-primary-500 transition-colors"
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

export default function AboutSettings() {
  const { language } = useSettingsStore();
  const t = (translations[language] || translations["pt-BR"] || {}) as any;

  const appVersion = "2.0.0"; // Idealmente viria do backend/config

  const handleOpenLink = (url: string) => {
    safeBrowserOpenURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Informações do App */}
      <section>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-20 h-20 bg-surface-100 dark:bg-surface-200 rounded-2xl flex items-center justify-center mb-4">
            <img
              src="/src/assets/images/appicon.png"
              alt="DownKingo Logo"
              className="w-16 h-16 object-contain"
            />
          </div>
          <h2 className="text-xl font-bold text-surface-900 dark:text-white mb-1">
            DownKingo
          </h2>
          <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">
            v{appVersion}
          </p>
          <p className="text-sm text-surface-600 dark:text-surface-300 max-w-md mx-auto leading-relaxed">
            {t.settings.about.description}
          </p>
        </div>
      </section>

      {/* Links e Doação */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3 flex items-center gap-2">
          <IconInfoCircle size={14} />
          {t.settings.about.resources}
        </h3>
        <div className="space-y-3">
          {/* Documentação */}

          <SettingItem
            icon={IconBook}
            label={t.settings.about.documentation}
            desc={t.settings.about.documentation_desc}
            onClick={() => handleOpenLink("https://downkingo.app/docs")} // Substituir URL real
          >
            <IconExternalLink size={18} className="text-surface-400" />
          </SettingItem>

          {/* GitHub */}
          <SettingItem
            icon={IconBrandGithub}
            label={t.settings.about.github}
            desc={t.settings.about.github_desc}
            onClick={() =>
              handleOpenLink("https://github.com/Capman002/downkingo")
            } // Substituir URL real
          >
            <IconExternalLink size={18} className="text-surface-400" />
          </SettingItem>

          {/* Doação - Destaque */}
          <div className="relative overflow-hidden rounded-xl border border-pink-200 dark:border-pink-900/30 bg-gradient-to-br from-pink-50 to-white dark:from-pink-900/10 dark:to-surface-100 p-1">
            <SettingItem
              icon={IconHeart}
              label={t.settings.about.support}
              desc={t.settings.about.support_desc}
              onClick={() => handleOpenLink("https://ko-fi.com/seulink")} // Substituir URL real
            >
              <div className="flex items-center gap-2 px-3 py-1.5 bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-lg text-xs font-bold uppercase tracking-wide">
                {t.settings.about.donate}
              </div>
            </SettingItem>
          </div>
        </div>
      </section>

      {/* Copyright */}
      <div className="text-center pt-4 pb-2">
        <p className="text-xs text-surface-400 dark:text-surface-600">
          © 2026 DownKingo. {t.settings.about.copyright}
        </p>
      </div>
    </div>
  );
}
