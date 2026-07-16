import { IconLoader2, IconShieldLock } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { CookieBrowser } from "../../lib/videoErrors";

const browserChoices: Array<{ value: CookieBrowser; label: string }> = [
  { value: "chrome", label: "Chrome" },
  { value: "edge", label: "Edge" },
  { value: "firefox", label: "Firefox" },
  { value: "brave", label: "Brave" },
];

interface BrowserAuthPromptProps {
  activeBrowser: CookieBrowser | null;
  failedBrowser?: CookieBrowser | null;
  onRetry: (browser: CookieBrowser) => void | Promise<void>;
}

export function BrowserAuthPrompt({
  activeBrowser,
  failedBrowser,
  onRetry,
}: BrowserAuthPromptProps) {
  const { t } = useTranslation();

  return (
    <div
      role="alert"
      aria-live="polite"
      className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-left dark:border-amber-500/35 dark:bg-amber-500/10"
    >
      <div className="flex items-start gap-3">
        <IconShieldLock
          size={22}
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300"
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-amber-950 dark:text-amber-100">
            {t("errors.youtube_auth_title")}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-amber-900 dark:text-amber-200">
            {t("errors.youtube_auth_description")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {browserChoices.map((browser) => {
              const isActive = activeBrowser === browser.value;
              return (
                <button
                  key={browser.value}
                  type="button"
                  disabled={activeBrowser !== null}
                  onClick={() => onRetry(browser.value)}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-amber-400 bg-white px-3 py-2 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 dark:border-amber-400/50 dark:bg-surface-200 dark:text-amber-100 dark:hover:bg-surface-300 dark:focus-visible:ring-offset-surface-50"
                >
                  {isActive && (
                    <IconLoader2
                      size={16}
                      aria-hidden="true"
                      className="animate-spin"
                    />
                  )}
                  {t("errors.youtube_auth_use_browser", {
                    browser: browser.label,
                  })}
                </button>
              );
            })}
          </div>
          {failedBrowser && !activeBrowser && (
            <p className="mt-3 text-sm font-medium text-red-700 dark:text-red-300">
              {t("errors.youtube_auth_failed", {
                browser:
                  browserChoices.find(
                    (browser) => browser.value === failedBrowser,
                  )?.label ?? failedBrowser,
              })}
            </p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
            {t("errors.youtube_auth_privacy")}
          </p>
        </div>
      </div>
    </div>
  );
}
