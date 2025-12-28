import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Setup from "./pages/Setup";
import Home from "./pages/Home";
import { NeedsDependencies } from "../wailsjs/go/main/App";

function App() {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    NeedsDependencies()
      .then(setNeedsSetup)
      .catch(() => setNeedsSetup(true)); // Default to setup on error
  }, []);

  // Loading state
  if (needsSetup === null) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-surface-600">Carregando...</p>
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
