import {
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  useCallback,
  lazy,
  Suspense,
} from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { CheckDependencies } from "../bindings/kingo/app";
import {
  safeEventsOn,
  safeWindowSetDarkTheme,
  safeWindowSetLightTheme,
} from "./lib/wailsRuntime";
const Setup = lazy(() => import("./pages/Setup"));
const Video = lazy(() => import("./pages/Video"));
import { useSettingsStore } from "./stores/settingsStore";
import { useTranslation } from "react-i18next";
import OnboardingModal from "./components/OnboardingModal";
import UpdateModal from "./components/UpdateModal";
import { hasMissingRequiredDependencies } from "./lib/features";

/** Atalhos de desenvolvimento (Ctrl+Shift+F8 → toggle Setup preview, Ctrl+Shift+F9 → toggle Onboarding) */
function DevShortcuts() {
  const navigate = useNavigate();
  const { hasCompletedOnboarding, completeOnboarding } = useSettingsStore();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ctrl+Shift+F8 → toggle entre Setup preview e Home
      if (e.ctrlKey && e.shiftKey && e.key === "F8") {
        e.preventDefault();
        const isOnSetup = window.location.pathname === "/setup";
        if (isOnSetup) {
          navigate("/home");
        } else {
          navigate("/setup", { state: { preview: true } });
        }
      }

      // Ctrl+Shift+F9 → toggle Onboarding modal
      if (e.ctrlKey && e.shiftKey && e.key === "F9") {
        e.preventDefault();
        if (hasCompletedOnboarding) {
          useSettingsStore.setState({ hasCompletedOnboarding: false });
        } else {
          completeOnboarding();
        }
      }
    },
    [navigate, hasCompletedOnboarding, completeOnboarding],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return null;
}

function App() {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);
  const eventReceivedRef = useRef(false); // Track if event was already received

  const language = useSettingsStore((state) => state.language);
  const theme = useSettingsStore((state) => state.theme);
  const primaryColor = useSettingsStore((state) => state.primaryColor);
  const enabledFeatures = useSettingsStore((state) => state.enabledFeatures);
  const { i18n } = useTranslation();

  const checkRequiredDependencies = useCallback(async () => {
    if (!mountedRef.current || eventReceivedRef.current) return;
    eventReceivedRef.current = true;

    try {
      const statuses = await CheckDependencies();
      const missing = hasMissingRequiredDependencies(
        enabledFeatures,
        statuses,
      );

      if (mountedRef.current) {
        console.log("[App] Required dependencies missing:", missing);
        setNeedsSetup(missing);
      }
    } catch (error) {
      console.warn("[App] Failed to check dependency status:", error);
      if (mountedRef.current) {
        // Não bloquear o app indefinidamente quando a verificação falhar.
        setNeedsSetup(false);
      }
    }
  }, [enabledFeatures]);

  // Aparência é uma responsabilidade global: dashboard, navegação, setup e
  // páginas carregadas sob demanda devem receber a mesma paleta desde a raiz.
  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.setAttribute("data-color", primaryColor);

    if (theme === "dark") {
      safeWindowSetDarkTheme();
    } else {
      safeWindowSetLightTheme();
    }
  }, [theme, primaryColor]);

  // Sincroniza i18n com settings store ao iniciar
  useEffect(() => {
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  useEffect(() => {
    mountedRef.current = true;
    eventReceivedRef.current = false;
    console.log("[App] Registering app:ready listener");

    // Registrar listener de forma assíncrona e segura
    const registerListener = async () => {
      try {
        const unsubscribe = await safeEventsOn<void>("app:ready", () => {
          console.log("[App] Received app:ready event");
          void checkRequiredDependencies();
        });
        if (mountedRef.current) {
          unsubscribeRef.current = unsubscribe;
        } else {
          // Componente desmontou antes do registro completar
          unsubscribe();
        }
      } catch (e) {
        console.warn(
          "[App] Failed to register app:ready listener, relying on fallback.",
          e,
        );
      }
    };

    registerListener();

    // Verificação imediata: não esperar pelo evento se o backend já estiver pronto
    // Isso evita o delay de 2s caso o evento já tenha sido emitido antes do frontend carregar
    void checkRequiredDependencies();

    // Cleanup ao desmontar
    return () => {
      mountedRef.current = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [checkRequiredDependencies]);

  // Listen for deep-link events from the backend (protocol handler)
  useEffect(() => {
    let deepLinkUnsubscribe: (() => void) | null = null;
    let disposed = false;

    const registerDeepLinkListener = async () => {
      try {
        const unsubscribe = await safeEventsOn<string>(
          "deep-link",
          (protocolUrl) => {
            console.log("[App] Received deep-link:", protocolUrl);

            // Parse the protocol URL: kingo://open?url=<encoded_url>
            try {
              // Remove the protocol prefix
              const withoutProtocol = protocolUrl.replace(/^kingo:\/\//, "");

              // Parse as URL to extract query params
              const fakeBase = "http://localhost/";
              const parsed = new URL(withoutProtocol, fakeBase);
              const targetUrl = parsed.searchParams.get("url");

              if (targetUrl) {
                // URLSearchParams already percent-decodes values. Decoding a
                // second time corrupts URLs containing literal percent signs.
                const decodedUrl = targetUrl;
                console.log(
                  "[App] Dispatching kinematic:fill-url with:",
                  decodedUrl,
                );

                // Dispatch custom event to fill the URL input
                window.dispatchEvent(
                  new CustomEvent("kinematic:fill-url", { detail: decodedUrl }),
                );
              }
            } catch (e) {
              console.error("[App] Failed to parse deep-link URL:", e);
            }
          },
        );
        if (disposed) unsubscribe();
        else deepLinkUnsubscribe = unsubscribe;
      } catch (e) {
        console.warn("[App] Failed to register deep-link listener:", e);
      }
    };

    registerDeepLinkListener();

    return () => {
      disposed = true;
      if (deepLinkUnsubscribe) {
        deepLinkUnsubscribe();
      }
    };
  }, []);

  // Loading state - Splash screen enquanto o backend inicializa
  if (needsSetup === null) {
    return (
      <div className="min-h-screen bg-surface-50 text-surface-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-surface-600">Iniciando...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <BrowserRouter>
        {import.meta.env.DEV && <DevShortcuts />}
        <OnboardingModal />
        <UpdateModal />
        <Suspense
          fallback={
            <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <Routes>
            <Route path="/setup" element={<Setup />} />
            <Route path="/home" element={<Video />} />

            <Route
              path="/"
              element={
                <Navigate to={needsSetup ? "/setup" : "/home"} replace />
              }
            />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </>
  );
}

export default App;
