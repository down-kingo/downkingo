import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  IconDownload,
  IconRocket,
  IconX,
  IconCheck,
  IconAlertCircle,
} from "@tabler/icons-react";
import ReactMarkdown from "react-markdown";
import { useState, useEffect } from "react";
import {
  CheckForUpdate,
  DownloadAndApplyUpdate,
  RestartApp,
} from "../../wailsjs/go/main/App";
import { EventsOn } from "../../wailsjs/runtime/runtime";
import type { updater } from "../../wailsjs/go/models";
import { Logo } from "./Logo";
import { useTranslation } from "react-i18next";

export default function UpdateModal() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const [updateInfo, setUpdateInfo] = useState<updater.UpdateInfo | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Check for updates on mount
  useEffect(() => {
    checkUpdate();
  }, []);

  const checkUpdate = async () => {
    try {
      const info = await CheckForUpdate();
      console.log("Update check:", info);
      if (info && info.available) {
        setUpdateInfo(info);
        setIsOpen(true);
      }
    } catch (err) {
      console.error("Failed to check for updates:", err);
    }
  };

  const handleUpdate = () => {
    console.log("[UpdateModal] Start update clicked", updateInfo);
    if (!updateInfo?.downloadUrl) {
      console.error("[UpdateModal] No download URL available");
      return;
    }
    setIsOpen(false);
    navigate("/setup", {
      state: {
        isUpdate: true,
        downloadUrl: updateInfo.downloadUrl,
      },
    });
  };

  const handleRestart = () => {
    console.log("[UpdateModal] Restart clicked");
    RestartApp();
  };

  const handleClose = () => {
    console.log("[UpdateModal] Close clicked");
    setIsOpen(false);
  };

  if (!isOpen || !updateInfo) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-lg bg-white dark:bg-[#121214] border border-transparent dark:border-white/5 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-surface-100 dark:border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

            <div className="flex items-start gap-4 relative z-10">
              <Logo size={48} className="shadow-lg shadow-black/20" />
              <div>
                <h2 className="text-xl font-bold text-surface-900 dark:text-white">
                  Nova Versão Disponível
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-medium text-surface-500 line-through opacity-70">
                    v{updateInfo.currentVersion}
                  </span>
                  <span className="text-surface-300">→</span>
                  <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold ring-1 ring-green-500/20">
                    v{updateInfo.latestVersion.replace(/^v+/, "")}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 text-surface-400 hover:text-surface-900 dark:hover:text-white transition-colors"
            >
              <IconX size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <h3 className="text-xs font-bold uppercase tracking-wider text-surface-500 dark:text-surface-400 mb-3">
                O que há de novo
              </h3>
              <div className="bg-surface-50 dark:bg-white/5 rounded-xl p-4 text-sm border border-surface-100 dark:border-white/5">
                <ReactMarkdown>
                  {(() => {
                    const raw =
                      updateInfo.changelog ||
                      "Correções de bugs e melhorias de desempenho.";

                    try {
                      let json = null;

                      // 1. Tentar extrair do comentário oculto (Novo Padrão)
                      const i18nMatch = raw.match(/<!-- JSON_I18N: (.*?) -->/s);
                      if (i18nMatch && i18nMatch[1]) {
                        json = JSON.parse(i18nMatch[1]);
                      }
                      // 2. Tentar JSON direto (Legado do commit anterior)
                      else if (raw.trim().startsWith("{")) {
                        json = JSON.parse(raw);
                      }

                      if (json) {
                        const lang = i18n.language;
                        // Match exato
                        if (json[lang]) return json[lang];
                        // Match parcial (pt-BR -> pt)
                        const key = Object.keys(json).find((k) =>
                          k.startsWith(lang.split("-")[0])
                        );
                        if (key && json[key]) return json[key];
                        // Fallback default
                        return json["en-US"] || Object.values(json)[0] || raw;
                      }
                    } catch (e) {
                      // Falha silenciosa, mostra raw
                    }

                    // 3. Limpar comentários HTML se existirem no raw para não poluir (opcional, mas bom pra garantir)
                    return raw.replace(/<!--.*?-->/gs, "");
                  })()}
                </ReactMarkdown>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 bg-surface-50/50 dark:bg-black/20 border-t border-surface-100 dark:border-white/5 flex justify-end gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-surface-600 hover:bg-surface-100 dark:text-surface-400 dark:hover:text-white dark:hover:bg-white/5 transition-colors"
            >
              Talvez mais tarde
            </button>
            <button
              onClick={handleUpdate}
              className="px-6 py-2 rounded-lg text-sm font-bold bg-primary-600 hover:bg-primary-700 text-white shadow-lg shadow-primary-600/20 transition-all active:scale-95 flex items-center gap-2"
            >
              <IconDownload size={18} />
              Atualizar Agora
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
