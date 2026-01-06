import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconSearch,
  IconDownload,
  IconLoader2,
  IconAlertCircle,
  IconCheck,
  IconLink,
  IconFileDescription,
  IconDatabase,
  IconExternalLink,
} from "@tabler/icons-react";
// @ts-ignore
import { GetImageInfo, DownloadImage } from "../../wailsjs/go/main/App";
import {
  resolveInstagram,
  isInstagramUrl,
  isInstagramCDN,
} from "../lib/instagramResolver";
import {
  resolveTwitter,
  isTwitterUrl,
  isTwitterCDN,
} from "../lib/twitterResolver";

interface ImageInfo {
  originalUrl: string;
  directUrl: string;
  contentType: string;
  size: number;
  filename: string;
}

// Interface para múltiplas imagens (carrossel)
interface MediaItem {
  url: string;
  type: "image" | "video";
  width?: number;
  height?: number;
}

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KiB", "MiB", "GiB", "TiB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export default function Images() {
  const { t } = useTranslation("images");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<ImageInfo | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]); // Para carrossel
  const [selectedIndex, setSelectedIndex] = useState(0); // Índice da imagem selecionada
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadPath, setDownloadPath] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setInfo(null);
    setMediaItems([]);
    setSelectedIndex(0);
    setDownloadPath(null);

    try {
      // Verificar se é URL de rede social (não CDN direto)
      const isIGPost = isInstagramUrl(url) && !isInstagramCDN(url);
      const isTWPost = isTwitterUrl(url) && !isTwitterCDN(url);

      if (isIGPost) {
        // Instagram vai direto para o backend Go (client-side falha por CORS)
        try {
          // @ts-ignore - A função será gerada pelo Wails
          const { GetInstagramCarousel } = await import(
            "../../wailsjs/go/main/App"
          );
          const carouselResult = await GetInstagramCarousel(url);
          if (
            carouselResult &&
            carouselResult.mediaItems &&
            carouselResult.mediaItems.length > 0
          ) {
            // Converter para o formato esperado pelo frontend
            const convertedMedia: MediaItem[] = carouselResult.mediaItems.map(
              (item: {
                url: string;
                type: string;
                width?: number;
                height?: number;
              }) => ({
                url: item.url,
                type: item.type as "image" | "video",
                width: item.width,
                height: item.height,
              })
            );

            setMediaItems(convertedMedia);
            const media = convertedMedia[0];
            setInfo({
              originalUrl: url,
              directUrl: media.url,
              contentType: media.type === "video" ? "video/mp4" : "image/jpeg",
              size: 0,
              filename:
                convertedMedia.length > 1
                  ? `instagram_carrossel_${convertedMedia.length}_imagens`
                  : `instagram_${media.type}.${
                      media.type === "video" ? "mp4" : "jpg"
                    }`,
            });
            setLoading(false);
            return;
          }
        } catch {
          // Fallback para próxima estratégia
        }
      }

      if (isTWPost) {
        const twResult = await resolveTwitter(url);

        if (twResult.success && twResult.media.length > 0) {
          // Armazenar TODAS as mídias encontradas
          setMediaItems(twResult.media);
          const media = twResult.media[0];
          setInfo({
            originalUrl: url,
            directUrl: media.url,
            contentType: media.type === "video" ? "video/mp4" : "image/jpeg",
            size: 0,
            filename:
              twResult.media.length > 1
                ? `twitter_${twResult.media.length}_imagens`
                : `twitter_${media.type}.${
                    media.type === "video" ? "mp4" : "jpg"
                  }`,
          });
          setLoading(false);
          return;
        }
      }

      // Fallback: Backend Go
      const result = await GetImageInfo(url);
      setInfo(result);
    } catch (err: unknown) {
      const errorMessage = String(err).toLowerCase();

      // Detectar tipo de site para mensagem personalizada
      const isCDN =
        url.includes("cdninstagram.com") ||
        url.includes("fbcdn.net") ||
        url.match(/\.(jpg|jpeg|png|webp)(\?|$)/i);
      const isInstagram = url.includes("instagram.com") && !isCDN;
      const isTwitter =
        (url.includes("twitter.com") || url.includes("x.com")) && !isCDN;

      if (isInstagram) {
        setError("INSTAGRAM_BLOCKED:" + url);
      } else if (isTwitter) {
        setError("TWITTER_BLOCKED:" + url);
      } else if (
        errorMessage.includes("access") ||
        errorMessage.includes("denied") ||
        errorMessage.includes("login") ||
        errorMessage.includes("blocked")
      ) {
        setError(
          "Este site requer autenticação ou bloqueou o acesso. " +
            "Abra a imagem no navegador e copie o link direto do arquivo."
        );
      } else {
        setError(
          "Não foi possível encontrar uma imagem nesta URL. " +
            "Tente o link direto do arquivo de imagem (ex: terminando em .jpg, .png, .webp)."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!info) return;

    setDownloading(true);
    setDownloadPath(null);
    try {
      // Usa o nome sugerido pelo backend ou cria um timestamp
      const filename = info.filename || `image_${Date.now()}.jpg`;
      const path = await DownloadImage(info.directUrl, filename);
      setDownloadPath(path);
    } catch (err: any) {
      setError(`Erro ao baixar: ${err}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8 h-full overflow-hidden">
      <div className="mb-8 border-b border-surface-200 dark:border-surface-800 pb-6">
        <h1 className="text-2xl font-semibold text-surface-900 mb-1 dark:text-surface-50 tracking-tight">
          {t("title")}
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400">
          {t("subtitle")}
        </p>
      </div>

      {/* Input Section */}
      <form onSubmit={handleSearch} className="mb-10">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <IconLink
              className="text-surface-400 group-focus-within:text-primary-600 transition-colors"
              size={20}
            />
          </div>
          <input
            type="text"
            className="w-full pl-10 pr-32 py-3 bg-white dark:bg-surface-100 border border-surface-200 dark:border-surface-700 rounded-md focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all placeholder:text-surface-400 text-sm text-surface-900 dark:text-surface-200"
            placeholder={t("placeholder")}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            type="submit"
            disabled={loading || !url}
            className="absolute right-1.5 top-1.5 bottom-1.5 bg-primary-600 hover:bg-primary-700 text-white px-4 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
          >
            {loading ? (
              <IconLoader2 className="animate-spin" size={16} />
            ) : (
              <IconSearch size={16} />
            )}
            <span>{t("search")}</span>
          </button>
        </div>
      </form>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-8"
          >
            {error.startsWith("INSTAGRAM_BLOCKED:") ||
            error.startsWith("TWITTER_BLOCKED:") ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg border border-amber-200 dark:border-amber-900/30">
                <div className="flex items-start gap-3">
                  <IconAlertCircle size={20} className="mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold mb-2">
                      {t("error.blocked_title", {
                        platform: error.startsWith("INSTAGRAM_BLOCKED:")
                          ? "Instagram"
                          : "Twitter/X",
                      })}
                    </p>
                    <p className="text-sm mb-3 text-amber-600 dark:text-amber-300">
                      {t("error.blocked_description")}
                    </p>
                    <ol className="text-sm list-decimal list-inside space-y-1 mb-4 text-amber-600 dark:text-amber-300">
                      <li>{t("error.step_1")}</li>
                      <li>{t("error.step_2")}</li>
                      <li>{t("error.step_3")}</li>
                      <li>{t("error.step_4")}</li>
                      <li>{t("error.step_5")}</li>
                    </ol>
                    <button
                      onClick={() => {
                        const blockedUrl = error.split(":").slice(1).join(":");
                        window.open(blockedUrl, "_blank");
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-sm font-medium transition-colors"
                    >
                      <IconExternalLink size={16} />
                      {t("error.open_browser")}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md flex items-center gap-2 border border-red-200 dark:border-red-900/30 text-sm">
                <IconAlertCircle size={18} />
                <span className="font-medium">{error}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result Section */}
      <AnimatePresence>
        {info && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-surface-100 rounded-lg border border-surface-200 dark:border-surface-800 overflow-hidden"
          >
            <div
              className="flex flex-col md:flex-row overflow-hidden"
              style={{ maxHeight: "calc(100vh - 220px)" }}
            >
              {/* Preview Area */}
              <div className="w-full md:w-3/5 bg-surface-50 dark:bg-surface-50 p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-surface-200 dark:border-surface-800 relative">
                {/* Checkerboard Pattern */}
                <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0ibm9uZSI+PHBhdGggZmlsbD0iIzAwMCIgZmlsbC1vcGFjaXR5PSIuMiIgZD0iTTAgMGgxMHYxMEgwem0xMCAxMGgxMHYxMEgxMHoiLz48L3N2Zz4=')] pointer-events-none" />

                {/* Main Image */}
                <div className="relative z-10 w-full flex items-center justify-center p-4 bg-transparent">
                  {info.contentType.includes("video") ? (
                    <video
                      src={info.directUrl}
                      controls
                      className="w-full max-h-[35vh] object-contain rounded shadow-lg"
                    />
                  ) : (
                    <img
                      src={info.directUrl}
                      alt="Preview"
                      className="max-w-full h-auto object-contain rounded shadow-lg"
                      style={{ maxHeight: "35vh" }}
                    />
                  )}

                  {/* Badge de Fonte para Debug */}
                  <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 text-white text-[10px] rounded backdrop-blur-sm z-20">
                    {mediaItems.length > 1
                      ? t("carousel_mode")
                      : t("basic_mode")}
                  </div>
                </div>

                {/* Carousel Thumbnails */}
                {mediaItems.length > 1 && (
                  <div className="w-full mt-6 pt-4 border-t border-surface-200 dark:border-surface-700">
                    <p className="text-xs font-semibold uppercase tracking-wider text-surface-500 mb-3 text-center">
                      {t("gallery", { count: mediaItems.length })}
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-2 justify-center px-4">
                      {mediaItems.map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setSelectedIndex(idx);
                            setDownloadPath(null); // Reset download state

                            // Atualizar info principal
                            setInfo({
                              originalUrl: url,
                              directUrl: item.url,
                              contentType:
                                item.type === "video"
                                  ? "video/mp4"
                                  : "image/jpeg",
                              size: 0,
                              filename:
                                mediaItems.length > 1
                                  ? `${
                                      item.type === "video" ? "video" : "imagem"
                                    }_${idx + 1}_de_${mediaItems.length}.${
                                      item.type === "video" ? "mp4" : "jpg"
                                    }`
                                  : `${item.type}_${idx}.${
                                      item.type === "video" ? "mp4" : "jpg"
                                    }`,
                            });
                          }}
                          className={`relative w-16 h-16 rounded overflow-hidden border-2 flex-shrink-0 transition-all ${
                            selectedIndex === idx
                              ? "border-primary-500 ring-2 ring-primary-500/30 scale-105"
                              : "border-transparent opacity-60 hover:opacity-100"
                          }`}
                        >
                          <img
                            src={item.url}
                            alt={`Thumb ${idx}`}
                            className="w-full h-full object-cover"
                          />
                          {item.type === "video" && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <div className="w-4 h-4 rounded-full bg-white/90 flex items-center justify-center">
                                <div className="ml-0.5 w-0 h-0 border-t-[3px] border-t-transparent border-l-[5px] border-l-black border-b-[3px] border-b-transparent"></div>
                              </div>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Info & Actions */}
              <div className="p-6 md:w-2/5 flex flex-col bg-white dark:bg-surface-100">
                <div className="mb-auto">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                      <IconCheck size={10} stroke={3} /> Disponível
                    </span>
                    <span className="bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                      {info.contentType.split("/")[1].toUpperCase()}
                    </span>
                    {mediaItems.length > 1 && (
                      <span className="bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                        {selectedIndex + 1} / {mediaItems.length}
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-50 break-all mb-6 leading-tight">
                    {info.filename || "imagem_sem_nome"}
                  </h3>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-surface-100 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-800/50">
                      <div className="text-surface-400">
                        <IconFileDescription size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-surface-500">
                          {t("type")}
                        </p>
                        <p className="font-mono text-xs text-surface-700 dark:text-surface-300">
                          {info.contentType}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-lg border border-surface-100 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-800/50">
                      <div className="text-surface-400">
                        <IconDatabase size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-surface-500">
                          {t("size")}
                        </p>
                        <p className="font-mono text-xs text-surface-700 dark:text-surface-300">
                          {formatBytes(info.size)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-lg border border-surface-100 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-800/50">
                      <div className="text-surface-400">
                        <IconDatabase size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-surface-500">
                          {t("resolution")}
                        </p>
                        <p className="font-mono text-xs text-surface-700 dark:text-surface-300">
                          {mediaItems[selectedIndex]?.width
                            ? `${mediaItems[selectedIndex].width}x${mediaItems[selectedIndex].height}`
                            : t("original")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 space-y-3">
                  <button
                    onClick={handleDownload}
                    disabled={downloading || !!downloadPath}
                    className={`w-full py-2.5 px-4 rounded-md font-medium text-sm flex items-center justify-center gap-2 transition-colors ${
                      downloadPath
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "bg-surface-900 dark:bg-white text-surface-50 dark:text-surface-900 hover:bg-surface-800 dark:hover:bg-surface-200"
                    } disabled:opacity-70 disabled:cursor-not-allowed`}
                  >
                    {downloading ? (
                      <>
                        <IconLoader2 className="animate-spin" size={18} />
                        <span>{t("downloading")}</span>
                      </>
                    ) : downloadPath ? (
                      <>
                        <IconCheck size={18} />
                        <span>{t("saved")}</span>
                      </>
                    ) : (
                      <>
                        <IconDownload size={18} />
                        <span>
                          {t("download_image")}{" "}
                          {mediaItems.length > 1
                            ? `(${selectedIndex + 1})`
                            : ""}
                        </span>
                      </>
                    )}
                  </button>

                  {downloadPath && (
                    <button
                      onClick={() => {
                        // Abrir pasta (implementar função no backend se necessário, ou apenas limpar)
                        setDownloadPath(null);
                        setInfo(null);
                        setMediaItems([]);
                        setUrl("");
                      }}
                      className="w-full py-2 px-4 rounded-md font-medium text-sm text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                    >
                      {t("download_another")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
