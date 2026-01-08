import { useEffect, useState, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { NeedsDependencies } from "../wailsjs/go/main/App";
import { safeEventsOn, tryEventsOff } from "./lib/wailsRuntime";
import Setup from "./pages/Setup";
import Home from "./pages/Home";
import { useSettingsStore } from "./stores/settingsStore";
import { useTranslation } from "react-i18next";
import OnboardingModal from "./components/OnboardingModal";
import UpdateModal from "./components/UpdateModal";

// Payload enviado pelo backend no evento app:ready
interface AppReadyPayload {
  needsSetup: boolean;
}

function App() {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);
  const eventReceivedRef = useRef(false); // Track if event was already received

  const { language } = useSettingsStore();
  const { i18n } = useTranslation();

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
        const unsubscribe = await safeEventsOn<AppReadyPayload>(
          "app:ready",
          (payload) => {
            if (mountedRef.current && !eventReceivedRef.current) {
              eventReceivedRef.current = true;
              console.log("[App] Received app:ready event:", payload);
              setNeedsSetup(payload.needsSetup);
            }
          }
        );
        if (mountedRef.current) {
          unsubscribeRef.current = unsubscribe;
        } else {
          // Componente desmontou antes do registro completar
          unsubscribe();
        }
      } catch (e) {
        console.warn(
          "[App] Failed to register app:ready listener, relying on fallback.",
          e
        );
      }
    };

    registerListener();

    // Fallback: se o evento não chegar em 2 segundos, chamar diretamente
    const timeout = setTimeout(async () => {
      if (mountedRef.current && !eventReceivedRef.current) {
        console.log("[App] Timeout - calling NeedsDependencies directly");
        eventReceivedRef.current = true;
        try {
          const needs = await NeedsDependencies();
          if (mountedRef.current) {
            setNeedsSetup(needs);
          }
        } catch (err) {
          console.error("[App] Error calling NeedsDependencies:", err);
          if (mountedRef.current) {
            setNeedsSetup(false); // Assume ready on error
          }
        }
      }
    }, 2000);

    // Cleanup ao desmontar
    return () => {
      mountedRef.current = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      } else {
        tryEventsOff("app:ready");
      }
      clearTimeout(timeout);
    };
  }, []);

  // Listen for deep-link events from the backend (protocol handler)
  useEffect(() => {
    let deepLinkUnsubscribe: (() => void) | null = null;

    const registerDeepLinkListener = async () => {
      try {
        deepLinkUnsubscribe = await safeEventsOn<string>(
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
                const decodedUrl = decodeURIComponent(targetUrl);
                console.log(
                  "[App] Dispatching kinematic:fill-url with:",
                  decodedUrl
                );

                // Dispatch custom event to fill the URL input
                window.dispatchEvent(
                  new CustomEvent("kinematic:fill-url", { detail: decodedUrl })
                );
              }
            } catch (e) {
              console.error("[App] Failed to parse deep-link URL:", e);
            }
          }
        );
      } catch (e) {
        console.warn("[App] Failed to register deep-link listener:", e);
      }
    };

    registerDeepLinkListener();

    return () => {
      if (deepLinkUnsubscribe) {
        deepLinkUnsubscribe();
      } else {
        tryEventsOff("deep-link");
      }
    };
  }, []);

  // Loading state - Splash screen enquanto o backend inicializa
  if (needsSetup === null) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-surface-600">Iniciando...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <OnboardingModal />
      <UpdateModal />
      <BrowserRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/setup" element={<Setup />} />
          <Route path="/home" element={<Home />} />

          <Route
            path="/"
            element={<Navigate to={needsSetup ? "/setup" : "/home"} replace />}
          />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
