import { useState, useEffect } from "react";
import { useTranslation, Trans } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { IconAlertCircle } from "@tabler/icons-react";

interface DisclaimerModalProps {
  onAccept: (dontShowAgain: boolean) => void;
}

export default function DisclaimerModal({ onAccept }: DisclaimerModalProps) {
  const { t } = useTranslation("common");
  const [isOpen, setIsOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    // Check if user has already accepted
    const hasAccepted = localStorage.getItem("kingo_disclaimer_accepted");
    if (!hasAccepted) {
      setIsOpen(true);
    }
  }, []);

  const handleAccept = () => {
    if (dontShowAgain) {
      localStorage.setItem("kingo_disclaimer_accepted", "true");
    }
    setIsOpen(false);
    onAccept(dontShowAgain);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] grid place-items-center p-4"
          >
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex flex-col items-center text-center mb-6">
                  <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                    <IconAlertCircle className="w-8 h-8 text-red-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-surface-900 font-display">
                    {t("disclaimer.title")}
                  </h2>
                </div>

                <div className="text-surface-600 leading-relaxed mb-8 text-center space-y-4">
                  <p>{t("disclaimer.text1")}</p>
                  <p>
                    <Trans
                      i18nKey="disclaimer.text2"
                      t={t}
                      components={{
                        0: (
                          <strong className="text-surface-900">
                            DownKingo
                          </strong>
                        ),
                      }}
                    />
                  </p>
                </div>

                <div className="space-y-6">
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-surface-200 hover:bg-surface-50 hover:border-surface-300 transition-all cursor-pointer group select-none">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        checked={dontShowAgain}
                        onChange={(e) => setDontShowAgain(e.target.checked)}
                        className="peer w-5 h-5 rounded border-surface-300 text-primary-600 focus:ring-primary-500/30 transition-shadow"
                      />
                    </div>
                    <span className="text-sm font-medium text-surface-700 group-hover:text-surface-900 transition-colors">
                      {t("disclaimer.dont_show_again")}
                    </span>
                  </label>

                  <button
                    onClick={handleAccept}
                    className="w-full py-4 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-bold rounded-xl transition-all transform active:scale-[0.98] shadow-lg shadow-primary-600/20 text-lg"
                  >
                    {t("disclaimer.accept")}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
