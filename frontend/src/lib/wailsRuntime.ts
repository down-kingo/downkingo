/**
 * Wrapper seguro para o runtime do Wails.
 * Aguarda o runtime estar disponível antes de executar funções.
 */

// Tipo para o callback de eventos
type EventCallback<T = unknown> = (data: T) => void;

// Tipo para a função de unsubscribe
type Unsubscribe = () => void;

/**
 * Verifica se o runtime do Wails está disponível
 */
export function isRuntimeReady(): boolean {
  return typeof window !== "undefined" && !!(window as any).runtime;
}

/**
 * Aguarda o runtime do Wails estar disponível
 * @param timeout - Tempo máximo de espera em ms (padrão: 5000)
 * @returns Promise que resolve quando o runtime está pronto
 */
export function waitForRuntime(timeout = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isRuntimeReady()) {
      resolve();
      return;
    }

    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (isRuntimeReady()) {
        clearInterval(checkInterval);
        resolve();
        return;
      }

      if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        reject(new Error("[WailsRuntime] Timeout waiting for runtime"));
      }
    }, 50);
  });
}

/**
 * Versão segura de EventsOn que aguarda o runtime
 * @param eventName - Nome do evento
 * @param callback - Callback a ser executado
 * @returns Promise com função de unsubscribe
 */
export async function safeEventsOn<T = unknown>(
  eventName: string,
  callback: EventCallback<T>
): Promise<Unsubscribe> {
  await waitForRuntime();

  const runtime = (window as any).runtime;
  // Wails v2 usa EventsOn para registrar listener
  runtime.EventsOn(eventName, callback);

  // Retorna função que remove os listeners desse evento (remove todos no Wails v2)
  return () => {
    runtime.EventsOff(eventName);
  };
}

/**
 * Versão segura de EventsOff que aguarda o runtime
 * @param eventName - Nome(s) do evento(s) para remover
 */
export async function safeEventsOff(
  eventName: string,
  ...additionalEventNames: string[]
): Promise<void> {
  if (!isRuntimeReady()) {
    console.warn(
      "[WailsRuntime] Runtime not ready, skipping EventsOff for:",
      eventName
    );
    return;
  }

  const runtime = (window as any).runtime;
  return runtime.EventsOff(eventName, ...additionalEventNames);
}

/**
 * Versão síncrona de EventsOn que usa um fallback se o runtime não estiver pronto.
 * Retorna uma função de unsubscribe ou undefined se não conseguiu registrar.
 *
 * @param eventName - Nome do evento
 * @param callback - Callback a ser executado
 * @returns Função de unsubscribe ou undefined
 */
export function tryEventsOn<T = unknown>(
  eventName: string,
  callback: EventCallback<T>
): Unsubscribe | undefined {
  if (!isRuntimeReady()) {
    console.warn(
      "[WailsRuntime] Runtime not ready, cannot register event:",
      eventName
    );
    return undefined;
  }

  try {
    const runtime = (window as any).runtime;
    runtime.EventsOn(eventName, callback);
    return () => {
      runtime.EventsOff(eventName);
    };
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
  if (!isRuntimeReady()) {
    return;
  }

  try {
    const runtime = (window as any).runtime;
    runtime.EventsOff(eventName);
  } catch {
    // Ignorar erros
  }
}

// ============================================
// Window Theme Functions (Safe Wrappers)
// ============================================

/**
 * Versão segura de WindowSetDarkTheme
 */
export function safeWindowSetDarkTheme(): void {
  if (!isRuntimeReady()) {
    console.warn(
      "[WailsRuntime] Runtime not ready, skipping WindowSetDarkTheme"
    );
    return;
  }
  try {
    (window as any).runtime.WindowSetDarkTheme();
  } catch {
    // Ignorar erros
  }
}

/**
 * Versão segura de WindowSetLightTheme
 */
export function safeWindowSetLightTheme(): void {
  if (!isRuntimeReady()) {
    console.warn(
      "[WailsRuntime] Runtime not ready, skipping WindowSetLightTheme"
    );
    return;
  }
  try {
    (window as any).runtime.WindowSetLightTheme();
  } catch {
    // Ignorar erros
  }
}

/**
 * Versão segura de WindowSetSystemDefaultTheme
 */
export function safeWindowSetSystemDefaultTheme(): void {
  if (!isRuntimeReady()) {
    console.warn(
      "[WailsRuntime] Runtime not ready, skipping WindowSetSystemDefaultTheme"
    );
    return;
  }
  try {
    (window as any).runtime.WindowSetSystemDefaultTheme();
  } catch {
    // Ignorar erros
  }
}

/**
 * Versão segura de BrowserOpenURL
 * @param url - URL para abrir no navegador
 */
export function safeBrowserOpenURL(url: string): void {
  if (!isRuntimeReady()) {
    // Fallback: abrir via window.open
    window.open(url, "_blank");
    return;
  }
  try {
    (window as any).runtime.BrowserOpenURL(url);
  } catch {
    // Fallback em caso de erro
    window.open(url, "_blank");
  }
}
