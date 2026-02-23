import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { IconDownload, IconX, IconArrowRight } from "@tabler/icons-react";
import { useState, useEffect, useCallback } from "react";
import { CheckForUpdate } from "../../bindings/kingo/app";
import { UpdateInfo } from "../../bindings/kingo/internal/updater/models.js";
import { Logo } from "./Logo";
import { useTranslation } from "react-i18next";

export default function UpdateModal() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("common");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    checkUpdate();
  }, []);

  // [DEV ONLY] Ctrl+Shift+F10
  const openDevPreview = useCallback(() => {
    const mockInfo: UpdateInfo = {
      available: true,
      currentVersion: "3.0.0",
      latestVersion: "v3.1.0",
      downloadUrl:
        "https://github.com/org/kingo/releases/download/v3.1.0/kingo-setup.exe",
      changelog: `<!-- JSON_I18N: ${JSON.stringify({
        "pt-BR":
          "- **Novo conversor** de vídeo com suporte a AV1\n- Transcrição mais rápida com Whisper v3\n- Correção no download de playlists longas\n- Performance geral melhorada em 30%",
        "en-US":
          "- **New video converter** with AV1 support\n- Faster transcription with Whisper v3\n- Fixed long playlist download bug\n- 30% overall performance improvement",
        "es-ES":
          "- **Nuevo conversor** de video con soporte AV1\n- Transcripción más rápida con Whisper v3\n- Corrección en la descarga de listas largas\n- Rendimiento general mejorado en 30%",
        "fr-FR":
          "- **Nouveau convertisseur** vidéo avec support AV1\n- Transcription plus rapide avec Whisper v3\n- Correction du téléchargement de longues playlists\n- Performance générale améliorée de 30%",
        "de-DE":
          "- **Neuer Videokonverter** mit AV1-Unterstützung\n- Schnellere Transkription mit Whisper v3\n- Fehler beim Herunterladen langer Playlists behoben\n- Allgemeine Leistung um 30% verbessert",
      })} -->`,
      size: 89128960,
    };
    setUpdateInfo(mockInfo);
    setIsOpen(true);
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const handler = () => openDevPreview();
    window.addEventListener("dev:open-update-modal", handler);
    return () => window.removeEventListener("dev:open-update-modal", handler);
  }, [openDevPreview]);

  const checkUpdate = async () => {
    try {
      const info = await CheckForUpdate();
      if (info && info.available) {
        setUpdateInfo(info);
        setIsOpen(true);
      }
    } catch (err) {
      console.error("Failed to check for updates:", err);
    }
  };

  const handleUpdate = () => {
    if (!updateInfo?.downloadUrl) return;
    setIsOpen(false);
    navigate("/setup", {
      state: { isUpdate: true, downloadUrl: updateInfo.downloadUrl },
    });
  };

  const handleClose = () => setIsOpen(false);

  /** Resolve o changelog localizado para o idioma atual */
  const resolveChangelog = (raw: string): string => {
    try {
      let json: Record<string, string> | null = null;
      const match = raw.match(/<!-- JSON_I18N: (.*?) -->/s);
      if (match?.[1]) json = JSON.parse(match[1]);
      else if (raw.trim().startsWith("{")) json = JSON.parse(raw);

      if (json) {
        const lang = i18n.language;
        if (json[lang]) return json[lang];
        const key = Object.keys(json).find((k) =>
          k.startsWith(lang.split("-")[0]),
        );
        return (
          (key && json[key]) || json["en-US"] || Object.values(json)[0] || raw
        );
      }
    } catch {
      /* silencioso */
    }
    return raw.replace(/<!--.*?-->/gs, "").trim();
  };

  const formatSize = (bytes: number): string => {
    if (!bytes) return "";
    const mb = bytes / (1024 * 1024);
    return ` · ${mb >= 1 ? `${mb.toFixed(0)} MB` : `${(bytes / 1024).toFixed(0)} KB`}`;
  };

  if (!isOpen || !updateInfo) return null;

  const changelog = resolveChangelog(
    updateInfo.changelog || "Correções de bugs e melhorias de desempenho.",
  );

  const bullets = changelog
    .split("\n")
    .filter((l) => l.trim().startsWith("-"))
    .map((l) => l.replace(/^[-]\s*/, "").trim())
    .filter(Boolean);

  return (
    <AnimatePresence>
      {/* Backdrop — mesma classe do OnboardingModal */}
      <motion.div
        key="update-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md"
        onClick={handleClose}
      >
        {/* Card — mesma estrutura do OnboardingModal */}
        <motion.div
          key="update-modal"
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm bg-white dark:bg-[#111113] rounded-2xl
                     shadow-2xl shadow-black/25 overflow-hidden
                     border border-surface-200 dark:border-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── HEADER ── */}
          <div className="px-5 pt-5 pb-4 border-b border-surface-100 dark:border-white/10 flex items-start gap-3.5">
            <Logo size={40} className="flex-shrink-0" />

            <div className="flex-1 min-w-0">
              <h2 className="text-[14.5px] font-bold text-surface-900 dark:text-white leading-tight">
                {t("update_modal.title")}
              </h2>

              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className="text-xs font-mono text-surface-400 dark:text-white/30 line-through">
                  v{updateInfo.currentVersion}
                </span>
                <IconArrowRight
                  size={11}
                  className="text-surface-300 dark:text-white/20 flex-shrink-0"
                />
                <span className="text-xs font-mono font-bold text-primary-600 dark:text-primary-500">
                  v{updateInfo.latestVersion.replace(/^v+/, "")}
                </span>
                {updateInfo.size > 0 && (
                  <span className="text-[11px] text-surface-400 dark:text-white/25">
                    {formatSize(updateInfo.size)}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={handleClose}
              className="p-1 rounded-md flex-shrink-0
                         text-surface-400 dark:text-white/30
                         hover:text-surface-700 dark:hover:text-white/70
                         hover:bg-surface-100 dark:hover:bg-white/[0.07]
                         transition-colors"
            >
              <IconX size={15} />
            </button>
          </div>

          {/* ── CHANGELOG ── */}
          <div className="px-5 py-4">
            <p
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em]
                           text-surface-400 dark:text-white/45 mb-3"
            >
              {t("update_modal.whats_new")}
            </p>

            {bullets.length > 0 ? (
              <ul className="space-y-2">
                {bullets.map((line, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-[7px] w-1 h-1 rounded-full bg-primary-600 dark:bg-primary-500 flex-shrink-0" />
                    <span
                      className="text-[12.5px] leading-snug text-surface-600 dark:text-white/60"
                      dangerouslySetInnerHTML={{
                        __html: line.replace(
                          /\*\*(.+?)\*\*/g,
                          '<strong class="font-semibold text-surface-800 dark:text-white/90">$1</strong>',
                        ),
                      }}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] text-surface-500 dark:text-white/50 leading-snug">
                {changelog}
              </p>
            )}
          </div>

          {/* ── FOOTER ── */}
          <div
            className="px-5 py-4 border-t border-surface-100 dark:border-white/10
                          bg-surface-50/40 dark:bg-black/20
                          flex items-center justify-between gap-3"
          >
            <button
              onClick={handleClose}
              className="text-[12.5px] font-medium px-1
                         text-surface-500 dark:text-white/40
                         hover:text-surface-700 dark:hover:text-white/70
                         transition-colors"
            >
              {t("update_modal.later")}
            </button>

            <button
              onClick={handleUpdate}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-[13px] font-bold
                         bg-primary-600 hover:bg-primary-700 active:bg-primary-800
                         text-white shadow-md shadow-primary-600/20
                         transition-all active:scale-95"
            >
              <IconDownload size={14} />
              {t("update_modal.update_now")}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
