import { useState, useEffect } from "react";
import { IconKeyboard, IconCommand } from "@tabler/icons-react";
import { useSettingsStore, ShortcutsConfig } from "../../stores/settingsStore";
import { translations } from "../../translations";

export default function ShortcutSettings() {
  const { shortcuts, setShortcuts, language } = useSettingsStore();
  const t = translations[language].settings.shortcuts;

  const [recordingKey, setRecordingKey] = useState<
    keyof ShortcutsConfig | null
  >(null);

  useEffect(() => {
    if (!recordingKey) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const keys = [];
      if (e.ctrlKey) keys.push("Ctrl");
      if (e.metaKey) keys.push("Meta");
      if (e.altKey) keys.push("Alt");
      if (e.shiftKey) keys.push("Shift");

      // Ignora teclas modificadoras sozinhas
      if (["Control", "Meta", "Alt", "Shift"].includes(e.key)) return;

      keys.push(e.key.toUpperCase());

      const newShortcut = keys.join("+");

      setShortcuts({
        ...shortcuts,
        [recordingKey]: newShortcut,
      });
      setRecordingKey(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [recordingKey, shortcuts, setShortcuts]);

  const shortcutItems: { key: keyof ShortcutsConfig; label: string }[] = [
    { key: "focusInput", label: t.focus_input },
    { key: "openSettings", label: t.open_settings },
    { key: "openQueue", label: t.open_queue },
    { key: "openHistory", label: t.open_history },
    { key: "openDownloads", label: t.open_downloads },
    { key: "openTerminal", label: t.open_terminal },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-medium text-surface-900 dark:text-white">
          {t.title}
        </h3>
        <p className="text-sm text-surface-500 dark:text-surface-400">
          {t.desc}
        </p>
      </div>

      <div className="space-y-3">
        {shortcutItems.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between p-4 bg-white dark:bg-surface-100 rounded-xl border border-surface-200 dark:border-zinc-800 hover:border-primary-500 dark:hover:border-primary-500 transition-colors shadow-sm dark:shadow-none"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-surface-50 dark:bg-surface-50 rounded-lg border border-surface-100 dark:border-zinc-800 text-surface-500">
                <IconKeyboard size={20} />
              </div>
              <span className="font-medium text-surface-700 dark:text-white">
                {item.label}
              </span>
            </div>

            <button
              onClick={() => setRecordingKey(item.key)}
              className={`min-w-[120px] px-4 py-2 rounded-lg text-sm font-mono font-medium transition-all ${
                recordingKey === item.key
                  ? "bg-primary-600 text-white ring-2 ring-primary-300 ring-offset-2"
                  : "bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-surface-100 hover:bg-surface-200 dark:hover:bg-surface-700"
              }`}
            >
              {recordingKey === item.key ? (
                <span className="animate-pulse">{t.press_key}</span>
              ) : (
                <div className="flex items-center justify-center gap-1.5">
                  <IconCommand size={14} className="opacity-50" />
                  {shortcuts[item.key]}
                </div>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
