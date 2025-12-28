import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { EventsOn, EventsOff } from "../wailsjs/runtime/runtime";
import Setup from "./pages/Setup";
import Home from "./pages/Home";

// Payload enviado pelo backend no evento app:ready
interface AppReadyPayload {
  needsSetup: boolean;
}

function App() {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    // Escutar evento app:ready emitido pelo OnStartup do Go
    // Isso garante que o frontend só renderiza quando o backend está 100% pronto
    const unsubscribe = EventsOn("app:ready", (payload: AppReadyPayload) => {
      setNeedsSetup(payload.needsSetup);
    });

    // Cleanup ao desmontar
    return () => {
      EventsOff("app:ready");
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
    <BrowserRouter>
      <Routes>
        <Route path="/setup" element={<Setup />} />
        <Route path="/home" element={<Home />} />
        <Route
          path="/"
          element={<Navigate to={needsSetup ? "/setup" : "/home"} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
