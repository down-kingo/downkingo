import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSettingsStore } from "../stores/settingsStore";

interface ShortcutActions {
  onOpenSettings: () => void;
  onFocusInput?: () => void;
  onToggleTerminal?: () => void;
}

export function useKeyboardShortcuts({
  onOpenSettings,
  onFocusInput,
  onToggleTerminal,
}: ShortcutActions) {
  const navigate = useNavigate();
  const { shortcuts } = useSettingsStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Evita disparar se o usuário estiver digitando em um input (exceto para atalhos globais específicos se necessário)
      // Mas para "FocusInput", queremos que funcione sempre (exceto se já estiver focado)
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      const pressedKeys = [];
      if (e.ctrlKey) pressedKeys.push("Ctrl");
      if (e.metaKey) pressedKeys.push("Meta");
      if (e.altKey) pressedKeys.push("Alt");
      if (e.shiftKey) pressedKeys.push("Shift");

      // Se não for modificador, adiciona a tecla
      if (!["Control", "Meta", "Alt", "Shift"].includes(e.key)) {
        pressedKeys.push(e.key.toUpperCase());
      }

      const currentCombo = pressedKeys.join("+");

      // Mapa de ações
      if (currentCombo === shortcuts.focusInput) {
        e.preventDefault();
        onFocusInput?.();
      } else if (currentCombo === shortcuts.openSettings) {
        e.preventDefault();
        onOpenSettings();
      } else if (currentCombo === shortcuts.openQueue) {
        e.preventDefault();
        if (!isInput) navigate("/queue"); // Supondo rota
      } else if (currentCombo === shortcuts.openHistory) {
        e.preventDefault();
        if (!isInput) navigate("/history"); // Supondo rota
      } else if (currentCombo === shortcuts.openDownloads) {
        e.preventDefault();
        if (!isInput) navigate("/");
      } else if (currentCombo === shortcuts.openTerminal) {
        e.preventDefault();
        onToggleTerminal?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts, navigate, onOpenSettings, onFocusInput, onToggleTerminal]);
}
