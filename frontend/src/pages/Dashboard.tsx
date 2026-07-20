import { AnimatePresence, motion } from "framer-motion";
import {
  IconVideo,
  IconHistory,
  IconArrowRight,
  IconSparkles,
  IconTransform,
  IconMicrophone,
} from "@tabler/icons-react";
import { useDownloadStore } from "../stores/downloadStore";
import { useFeatures } from "../hooks/useFeatures";
import { useTranslation } from "react-i18next";
import { TabType } from "../components/navigation/Sidebar";
import DonationBanner from "../components/DonationBanner";

function ToolCard({
  onClick,
  icon: Icon,
  glowColor,
  hoverColor,
  title,
  desc,
}: {
  onClick: () => void;
  icon: typeof IconVideo;
  glowColor: string;
  hoverColor: string;
  title: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative h-full w-full overflow-hidden rounded-2xl border border-surface-200 bg-white p-6 text-left transition-all duration-300 hover:bg-surface-50 dark:border-white/5 dark:bg-surface-100 dark:hover:bg-surface-200/50"
    >
      <div
        className={`absolute top-0 right-0 w-32 h-32 ${glowColor} blur-2xl rounded-full -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
      />
      <div className="flex items-start justify-between mb-4 relative z-10">
        <div
          className={`p-3 bg-surface-50 dark:bg-white/5 border border-surface-100 dark:border-white/10 rounded-xl text-surface-600 dark:text-surface-700 ${hoverColor} transition-colors shadow-sm`}
        >
          <Icon size={26} className="stroke-[1.5]" />
        </div>
        <IconArrowRight
          size={18}
          className="text-surface-400 dark:text-surface-400 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
        />
      </div>
      <h3 className="font-semibold text-surface-900 dark:text-surface-900 text-base mb-1">
        {title}
      </h3>
      <p className="text-xs text-surface-500 dark:text-surface-500 leading-relaxed">
        {desc}
      </p>
    </button>
  );
}

interface DashboardProps {
  onNavigate: (tab: TabType) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { history } = useDownloadStore();
  const { t } = useTranslation("common");
  const { showVideos, showImages, showConverter, showTranscriber } =
    useFeatures();

  // Recent items limited to 5 for density
  const recentDownloads = history.slice(0, 5);

  const cardMotionRes = {
    initial: { opacity: 0, y: 15, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  };

  return (
    <div className="h-full overflow-y-auto bg-surface-50 dark:bg-surface-50 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header Compacto */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col gap-6 border-b border-surface-200 pb-6 lg:flex-row lg:items-center lg:justify-between dark:border-surface-300"
        >
          <div className="shrink-0">
            <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-900 tracking-tight font-display">
              {t("dashboard.overview")}
            </h1>
            <p className="text-sm text-surface-500 dark:text-surface-500 mt-2 font-medium">
              {t("dashboard.manage_tools")}
            </p>
          </div>

          <div className="w-full lg:max-w-xl">
            <DonationBanner
              variant="header"
              eyebrow={t("donation.dashboard.eyebrow")}
              title={t("donation.dashboard.title")}
              description={t("donation.dashboard.description")}
              action={t("donation.dashboard.action")}
            />
          </div>
        </motion.div>

        {/* Tools Grid - Authentic Glassmorphism */}
        <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {(showVideos || showImages) && (
              <motion.div key="card-downloads" layout {...cardMotionRes}>
                <ToolCard
                  onClick={() => onNavigate("video")}
                  icon={IconVideo}
                  glowColor="bg-primary-600/20 dark:bg-primary-600/40"
                  hoverColor="group-hover:text-primary-600 dark:group-hover:text-primary-400"
                  title={t("dashboard.tools.downloads.title")}
                  desc={t("dashboard.tools.downloads.desc")}
                />
              </motion.div>
            )}

            {showConverter && (
              <motion.div key="card-converter" layout {...cardMotionRes}>
                <ToolCard
                  onClick={() => onNavigate("converter")}
                  icon={IconTransform}
                  glowColor="bg-blue-600/20 dark:bg-blue-600/40"
                  hoverColor="group-hover:text-blue-600 dark:group-hover:text-blue-400"
                  title={t("dashboard.tools.converter.title")}
                  desc={t("dashboard.tools.converter.desc")}
                />
              </motion.div>
            )}

            {showTranscriber && (
              <motion.div key="card-transcriber" layout {...cardMotionRes}>
                <ToolCard
                  onClick={() => onNavigate("transcriber")}
                  icon={IconMicrophone}
                  glowColor="bg-emerald-600/20 dark:bg-emerald-600/40"
                  hoverColor="group-hover:text-emerald-600 dark:group-hover:text-emerald-400"
                  title={t("dashboard.tools.transcriber.title")}
                  desc={t("dashboard.tools.transcriber.desc")}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Recent Activity Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-surface-500 dark:text-surface-500">
              {t("dashboard.recent_activity")}
            </h3>
            <button
              onClick={() => onNavigate("history")}
              className="text-xs font-medium text-surface-600 transition-colors hover:text-surface-900 hover:underline dark:text-surface-400 dark:hover:text-surface-700"
            >
              {t("dashboard.view_full_history")}
            </button>
          </div>

          <div className="border border-surface-200 dark:border-white/5 rounded-2xl bg-white dark:bg-surface-100 overflow-hidden shadow-sm dark:shadow-none">
            {recentDownloads.length > 0 ? (
              <div className="divide-y divide-surface-100 dark:divide-white/5">
                {recentDownloads.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 p-4 hover:bg-surface-50 dark:hover:bg-surface-200/50 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-surface-100 dark:bg-white/5 border border-transparent dark:border-white/5 flex items-center justify-center text-surface-500 dark:text-surface-400 flex-shrink-0 group-hover:scale-105 transition-transform">
                      {item.format?.includes("audio") ? (
                        <IconSparkles size={18} />
                      ) : (
                        <IconVideo size={18} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-surface-900 dark:text-surface-900 truncate">
                        {item.title}
                      </h4>
                      <p className="text-xs text-surface-500 dark:text-surface-500 truncate mt-0.5 font-medium">
                        {item.uploader || t("dashboard.unknown")}
                      </p>
                    </div>
                    <div
                      className={`text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wide shadow-sm ${
                        item.status === "completed"
                          ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 border border-green-200 dark:border-green-500/20"
                          : "bg-surface-100 text-surface-600 dark:bg-surface-200 dark:text-surface-500"
                      }`}
                    >
                      {item.status === "completed"
                        ? t("status.completed")
                        : item.status}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-surface-400 dark:text-surface-500">
                <IconHistory size={32} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium">
                  {t("home.no_recent_downloads")}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
