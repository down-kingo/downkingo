/**
 * Wrapper seguro para o runtime do Wails v3.
 * Usa imports do pacote @wailsio/runtime.
 */

import { Events } from "@wailsio/runtime";

// Tipo para o callback de eventos
type EventCallback<T = unknown> = (data: T) => void;

// Tipo para a função de unsubscribe
type Unsubscribe = () => void;

/**
 * Verifica se o runtime do Wails está disponível
 */
export function isRuntimeReady(): boolean {
  return typeof window !== "undefined";
}

/**
 * Aguarda o runtime do Wails estar disponível (v3: sempre disponível via import)
 */
export function waitForRuntime(_timeout = 5000): Promise<void> {
  return Promise.resolve();
}

/**
 * Versão segura de EventsOn que registra um listener
 * @param eventName - Nome do evento
 * @param callback - Callback a ser executado
 * @returns Promise com função de unsubscribe
 */
export async function safeEventsOn<T = unknown>(
  eventName: string,
  callback: EventCallback<T>
): Promise<Unsubscribe> {
  // Wails v3: Events.On callback receives a WailsEvent wrapper with { data }
  const cancel = Events.On(eventName, (event: { data: T }) => {
    callback(event.data);
  });
  return cancel;
}

/**
 * Versão segura de EventsOff que remove listeners
 * @param eventName - Nome(s) do evento(s) para remover
 */
export async function safeEventsOff(
  eventName: string,
  ..._additionalEventNames: string[]
): Promise<void> {
  Events.Off(eventName);
}

/**
 * Versão síncrona de EventsOn
 * @param eventName - Nome do evento
 * @param callback - Callback a ser executado
 * @returns Função de unsubscribe ou undefined
 */
export function tryEventsOn<T = unknown>(
  eventName: string,
  callback: EventCallback<T>
): Unsubscribe | undefined {
  try {
    // Wails v3: Events.On callback receives a WailsEvent wrapper with { data }
    const cancel = Events.On(eventName, (event: { data: T }) => {
      callback(event.data);
    });
    return cancel;
  } catch (error) {
    console.error("[WailsRuntime] Error registering event:", eventName, error);
    return undefined;
  }
}

/**
 * Versão síncrona de EventsOff que ignora erros
 * @param eventName - Nome do evento
 */
export function tryEventsOff(eventName: string): void {
  try {
    Events.Off(eventName);
  } catch {
    // Ignorar erros
  }
}

// ============================================
// Window Theme Functions (Safe Wrappers)
// ============================================

/**
 * Versão segura de WindowSetDarkTheme
 * V3: Theme is handled via CSS prefers-color-scheme or app-level config
 */
export function safeWindowSetDarkTheme(): void {
  // Wails v3 handles themes differently - use CSS-based approach
  document.documentElement.classList.add("dark");
  document.documentElement.classList.remove("light");
}

/**
 * Versão segura de WindowSetLightTheme
 */
export function safeWindowSetLightTheme(): void {
  document.documentElement.classList.add("light");
  document.documentElement.classList.remove("dark");
}

/**
 * Versão segura de WindowSetSystemDefaultTheme
 */
export function safeWindowSetSystemDefaultTheme(): void {
  document.documentElement.classList.remove("dark", "light");
}

/**
 * Versão segura de BrowserOpenURL
 * @param url - URL para abrir no navegador
 */
export function safeBrowserOpenURL(url: string): void {
  // V3: Use the Go binding App.OpenUrl() which calls application.Get().Browser.OpenURL()
  // Fallback to window.open if needed
  window.open(url, "_blank");
}
