import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconVideo,
  IconMusic,
  IconPhoto,
  IconFileZip,
  IconWand,
  IconUpload,
  IconPlayerPlay,
  IconCheck,
  IconLoader2,
  IconFolder,
  IconAlertCircle,
  IconInfoCircle,
  IconChevronDown,
  IconSparkles,
  IconFileDescription,
} from "@tabler/icons-react";

import {
  SelectVideoFile,
  SelectImageFile,
  SelectOutputDirectory,
  ConvertVideo,
  CompressVideo,
  ExtractAudio,
  ConvertImage,
  CompressImage,
  RemoveBackground,
  CheckRembgStatus,
  DownloadRembg,
  GetBackgroundRemovalModels,
  OpenUrl,
} from "../../wailsjs/go/main/App";

// Types
interface ConversionResult {
  outputPath: string;
  inputSize: number;
  outputSize: number;
  compression: number;
  success: boolean;
  errorMessage?: string;
}

interface BackgroundRemovalModel {
  id: string;
  name: string;
  description: string;
}

type ConversionTab =
  | "video-to-video"
  | "video-to-audio"
  | "image-to-image"
  | "compress-video"
  | "compress-image"
  | "remove-bg";

// Format size in human readable
function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Get file name from path
function getFileName(path: string): string {
  return path.split("\\").pop() || path.split("/").pop() || path;
}

export default function Converter() {
  // Tab state
  const [activeTab, setActiveTab] = useState<ConversionTab>("video-to-video");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // File selection
  const [inputPath, setInputPath] = useState("");
  const [outputDir, setOutputDir] = useState("");

  // Conversion options
  const [videoFormat, setVideoFormat] = useState("mp4");
  const [videoQuality, setVideoQuality] = useState("medium");
  const [videoPreset, setVideoPreset] = useState("medium");
  const [keepAudio, setKeepAudio] = useState(true);

  const [audioFormat, setAudioFormat] = useState("mp3");
  const [audioQuality, setAudioQuality] = useState("high");

  const [imageFormat, setImageFormat] = useState("webp");
  const [imageQuality, setImageQuality] = useState(85);

  const [bgModel, setBgModel] = useState("u2net");
  const [bgModels, setBgModels] = useState<BackgroundRemovalModel[]>([]);
  const [rembgAvailable, setRembgAvailable] = useState(false);
  const [isDownloadingRembg, setIsDownloadingRembg] = useState(false);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [error, setError] = useState("");

  // Check rembg availability on mount
  const checkRembg = async () => {
    try {
      const status = await CheckRembgStatus();
      setRembgAvailable(status.installed);
    } catch {
      setRembgAvailable(false);
    }
  };

  const handleDownloadRembg = async () => {
    setIsDownloadingRembg(true);
    try {
      await DownloadRembg();
      await checkRembg();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsDownloadingRembg(false);
    }
  };

  useEffect(() => {
    checkRembg();
    GetBackgroundRemovalModels().then(setBgModels);
  }, []);

  // Clear state when tab changes
  useEffect(() => {
    setInputPath("");
    setOutputDir("");
    setResult(null);
    setError("");
    setShowAdvanced(false);
  }, [activeTab]);

  // Tab configuration
  const tabs = [
    {
      id: "video-to-video" as ConversionTab,
      label: "Converter Vídeo",
      shortLabel: "Vídeo",
      icon: IconVideo,
    },
    {
      id: "video-to-audio" as ConversionTab,
      label: "Extrair Áudio",
      shortLabel: "Áudio",
      icon: IconMusic,
    },
    {
      id: "image-to-image" as ConversionTab,
      label: "Converter Imagem",
      shortLabel: "Imagem",
      icon: IconPhoto,
    },
    {
      id: "compress-video" as ConversionTab,
      label: "Comprimir Vídeo",
      shortLabel: "Comp. Vídeo",
      icon: IconFileZip,
    },
    {
      id: "compress-image" as ConversionTab,
      label: "Comprimir Imagem",
      shortLabel: "Comp. Img",
      icon: IconFileZip,
    },
    {
      id: "remove-bg" as ConversionTab,
      label: "Remover Fundo",
      shortLabel: "Fundo",
      icon: IconWand,
    },
  ];

  const currentTab = tabs.find((t) => t.id === activeTab)!;
  const isVideoTab = activeTab.includes("video");

  // Handle file selection
  const handleSelectInput = async () => {
    try {
      const file = isVideoTab
        ? await SelectVideoFile()
        : await SelectImageFile();
      if (file) {
        setInputPath(file);
        setResult(null);
        setError("");
      }
    } catch (err) {
      setError(String(err));
    }
  };

  const handleSelectOutput = async () => {
    try {
      const dir = await SelectOutputDirectory();
      if (dir) {
        setOutputDir(dir);
      }
    } catch (err) {
      setError(String(err));
    }
  };

  // Handle conversion
  const handleConvert = async () => {
    if (!inputPath) {
      setError("Selecione um arquivo de entrada");
      return;
    }

    setIsProcessing(true);
    setError("");
    setResult(null);

    try {
      let conversionResult: ConversionResult;

      switch (activeTab) {
        case "video-to-video":
          conversionResult = await ConvertVideo({
            inputPath,
            outputDir,
            format: videoFormat,
            quality: videoQuality,
            preset: videoPreset,
            keepAudio,
            customCrf: 0,
            resolution: "",
          });
          break;

        case "video-to-audio":
          conversionResult = await ExtractAudio({
            inputPath,
            outputDir,
            format: audioFormat,
            quality: audioQuality,
            customBitrate: 0,
          });
          break;

        case "image-to-image":
          conversionResult = await ConvertImage({
            inputPath,
            outputDir,
            format: imageFormat,
            quality: imageQuality,
            width: 0,
            height: 0,
          });
          break;

        case "compress-video":
          conversionResult = await CompressVideo(
            inputPath,
            videoQuality,
            videoPreset
          );
          break;

        case "compress-image":
          conversionResult = await CompressImage(inputPath, imageQuality);
          break;

        case "remove-bg":
          conversionResult = await RemoveBackground({
            inputPath,
            outputDir,
            model: bgModel,
          });
          break;

        default:
          throw new Error("Tipo de conversão não suportado");
      }

      setResult(conversionResult);
      if (!conversionResult.success) {
        setError(conversionResult.errorMessage || "Erro desconhecido");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  // Pill button component for format/quality selection
  const PillButton = ({
    selected,
    onClick,
    children,
    subtitle,
  }: {
    selected: boolean;
    onClick: () => void;
    children: React.ReactNode;
    subtitle?: string;
  }) => (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`px-3 py-2 rounded-lg font-medium text-xs transition-all duration-200 ${
        selected
          ? "bg-surface-900 dark:bg-white text-white dark:text-surface-900 shadow-lg"
          : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700"
      }`}
    >
      <span className="block">{children}</span>
      {subtitle && (
        <span
          className={`block text-[10px] mt-0.5 ${
            selected ? "opacity-70" : "opacity-50"
          }`}
        >
          {subtitle}
        </span>
      )}
    </motion.button>
  );

  // Section Header component
  const SectionHeader = ({ children }: { children: React.ReactNode }) => (
    <h4 className="text-[10px] font-bold text-surface-400 dark:text-surface-500 uppercase tracking-wider mb-2">
      {children}
    </h4>
  );

  return (
    <div className="flex flex-col h-full bg-surface-50 dark:bg-surface-950 overflow-hidden">
      {/* Header with Tab Navigation */}
      <div className="shrink-0 border-b border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-display font-bold text-surface-900 dark:text-white">
                Conversão
              </h1>
              <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
                Converta e processe arquivos de mídia localmente
              </p>
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-surface-900 dark:bg-white text-white dark:text-surface-900 shadow-md"
                      : "text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800"
                  }`}
                >
                  <Icon size={16} />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                </motion.button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content Area - Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Configuration (Scrollable) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-4 md:p-6 flex flex-col items-center">
            {/* Centralized Configuration Container */}
            <div className="w-full max-w-2xl space-y-4">
              {/* File Input */}
              <motion.div
                layout
                className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 overflow-hidden shadow-sm"
              >
                <div className="p-3">
                  <AnimatePresence mode="wait">
                    {inputPath ? (
                      <motion.div
                        key="selected"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center gap-3"
                      >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20 shrink-0">
                          {isVideoTab ? (
                            <IconVideo size={24} className="text-white" />
                          ) : (
                            <IconPhoto size={24} className="text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-surface-900 dark:text-white truncate">
                            {getFileName(inputPath)}
                          </p>
                          <p className="text-xs text-surface-500 truncate mt-0.5">
                            {inputPath}
                          </p>
                        </div>
                        <button
                          onClick={handleSelectInput}
                          disabled={isProcessing}
                          className="px-3 py-1.5 text-xs font-medium text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors border border-transparent hover:border-surface-200 dark:hover:border-surface-700"
                        >
                          Alterar
                        </button>
                      </motion.div>
                    ) : (
                      <motion.button
                        key="empty"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        onClick={handleSelectInput}
                        disabled={isProcessing}
                        className="w-full flex items-center gap-4 p-3 border-2 border-dashed border-surface-200 dark:border-surface-700 rounded-xl hover:border-primary-400 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-all group cursor-pointer text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-surface-100 dark:bg-surface-800 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 flex items-center justify-center shrink-0 transition-colors">
                          <IconUpload
                            size={20}
                            className="text-surface-400 group-hover:text-primary-600 transition-colors"
                          />
                        </div>
                        <div>
                          <p className="font-medium text-sm text-surface-700 dark:text-surface-300 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                            Selecionar Arquivo de{" "}
                            {isVideoTab ? "Vídeo" : "Imagem"}
                          </p>
                          <p className="text-xs text-surface-400">
                            {isVideoTab
                              ? "MP4, MKV, AVI, MOV"
                              : "JPG, PNG, WebP, AVIF"}
                          </p>
                        </div>
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>

              {/* Conversion Options */}
              <motion.div
                layout
                className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 overflow-hidden shadow-sm"
              >
                <div className="p-4">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                    >
                      {/* Video to Video Options */}
                      {activeTab === "video-to-video" && (
                        <div className="space-y-4">
                          <div>
                            <SectionHeader>Formato de Saída</SectionHeader>
                            <div className="flex flex-wrap gap-1.5">
                              {["mp4", "mkv", "webm", "avi", "mov"].map(
                                (fmt) => (
                                  <PillButton
                                    key={fmt}
                                    selected={videoFormat === fmt}
                                    onClick={() => setVideoFormat(fmt)}
                                  >
                                    {fmt.toUpperCase()}
                                  </PillButton>
                                )
                              )}
                            </div>
                          </div>

                          <div>
                            <SectionHeader>Qualidade (CRF)</SectionHeader>
                            <div className="flex flex-wrap gap-1.5">
                              {[
                                { id: "lossless", label: "Lossless", crf: "0" },
                                { id: "high", label: "Alta", crf: "18" },
                                { id: "medium", label: "Média", crf: "23" },
                                { id: "low", label: "Baixa", crf: "28" },
                                { id: "tiny", label: "Mínima", crf: "35" },
                              ].map((q) => (
                                <PillButton
                                  key={q.id}
                                  selected={videoQuality === q.id}
                                  onClick={() => setVideoQuality(q.id)}
                                  subtitle={`CRF ${q.crf}`}
                                >
                                  {q.label}
                                </PillButton>
                              ))}
                            </div>
                          </div>

                          {/* Advanced Options Toggle */}
                          <div className="pt-2 border-t border-surface-100 dark:border-surface-800/50">
                            <button
                              onClick={() => setShowAdvanced(!showAdvanced)}
                              className="flex items-center gap-2 text-xs font-medium text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors py-2"
                            >
                              <IconChevronDown
                                size={16}
                                className={`transition-transform ${
                                  showAdvanced ? "rotate-180" : ""
                                }`}
                              />
                              Mais opções
                            </button>

                            <AnimatePresence>
                              {showAdvanced && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="pt-3 space-y-3">
                                    <div>
                                      <SectionHeader>
                                        Preset de Encoding
                                      </SectionHeader>
                                      <div className="flex flex-wrap gap-1.5">
                                        {[
                                          {
                                            id: "ultrafast",
                                            label: "Ultra Rápido",
                                          },
                                          { id: "fast", label: "Rápido" },
                                          { id: "medium", label: "Médio" },
                                          { id: "slow", label: "Lento" },
                                          {
                                            id: "veryslow",
                                            label: "Muito Lento",
                                          },
                                        ].map((p) => (
                                          <PillButton
                                            key={p.id}
                                            selected={videoPreset === p.id}
                                            onClick={() => setVideoPreset(p.id)}
                                          >
                                            {p.label}
                                          </PillButton>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-3 p-3 bg-surface-50 dark:bg-surface-800/50 rounded-xl">
                                      <input
                                        type="checkbox"
                                        id="keepAudio"
                                        checked={keepAudio}
                                        onChange={(e) =>
                                          setKeepAudio(e.target.checked)
                                        }
                                        className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                                      />
                                      <label
                                        htmlFor="keepAudio"
                                        className="text-xs font-medium text-surface-700 dark:text-surface-300"
                                      >
                                        Manter trilha de áudio
                                      </label>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      )}

                      {/* Video to Audio Options */}
                      {activeTab === "video-to-audio" && (
                        <div className="space-y-4">
                          <div>
                            <SectionHeader>Formato de Áudio</SectionHeader>
                            <div className="flex flex-wrap gap-1.5">
                              {[
                                { id: "mp3", label: "MP3", desc: "Universal" },
                                {
                                  id: "aac",
                                  label: "AAC",
                                  desc: "Alta qualidade",
                                },
                                { id: "flac", label: "FLAC", desc: "Lossless" },
                                {
                                  id: "wav",
                                  label: "WAV",
                                  desc: "Sem compressão",
                                },
                                {
                                  id: "ogg",
                                  label: "OGG",
                                  desc: "Open source",
                                },
                                { id: "opus", label: "OPUS", desc: "Moderno" },
                              ].map((fmt) => (
                                <PillButton
                                  key={fmt.id}
                                  selected={audioFormat === fmt.id}
                                  onClick={() => setAudioFormat(fmt.id)}
                                  subtitle={fmt.desc}
                                >
                                  {fmt.label}
                                </PillButton>
                              ))}
                            </div>
                          </div>

                          <div>
                            <SectionHeader>Qualidade (Bitrate)</SectionHeader>
                            <div className="flex flex-wrap gap-1.5">
                              {[
                                {
                                  id: "low",
                                  label: "Baixa",
                                  bitrate: "128 kbps",
                                },
                                {
                                  id: "medium",
                                  label: "Média",
                                  bitrate: "192 kbps",
                                },
                                {
                                  id: "high",
                                  label: "Alta",
                                  bitrate: "256 kbps",
                                },
                                {
                                  id: "best",
                                  label: "Máxima",
                                  bitrate: "320 kbps",
                                },
                              ].map((q) => (
                                <PillButton
                                  key={q.id}
                                  selected={audioQuality === q.id}
                                  onClick={() => setAudioQuality(q.id)}
                                  subtitle={q.bitrate}
                                >
                                  {q.label}
                                </PillButton>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Image Options and other tabs similar structure... */}
                      {/* Image to Image Options */}
                      {activeTab === "image-to-image" && (
                        <div className="space-y-4">
                          <div>
                            <SectionHeader>Formato de Saída</SectionHeader>
                            <div className="flex flex-wrap gap-1.5">
                              {[
                                {
                                  id: "webp",
                                  label: "WebP",
                                  desc: "Moderno, menor",
                                },
                                {
                                  id: "avif",
                                  label: "AVIF",
                                  desc: "Muito menor",
                                },
                                { id: "jpg", label: "JPEG", desc: "Universal" },
                                { id: "png", label: "PNG", desc: "Lossless" },
                                {
                                  id: "bmp",
                                  label: "BMP",
                                  desc: "Sem compressão",
                                },
                              ].map((fmt) => (
                                <PillButton
                                  key={fmt.id}
                                  selected={imageFormat === fmt.id}
                                  onClick={() => setImageFormat(fmt.id)}
                                  subtitle={fmt.desc}
                                >
                                  {fmt.label}
                                </PillButton>
                              ))}
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <SectionHeader>Qualidade</SectionHeader>
                              <span className="text-xs font-semibold text-surface-900 dark:text-white">
                                {imageQuality}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min="10"
                              max="100"
                              value={imageQuality}
                              onChange={(e) =>
                                setImageQuality(Number(e.target.value))
                              }
                              className="w-full h-1.5 bg-surface-200 dark:bg-surface-700 rounded-full appearance-none cursor-pointer accent-primary-600"
                            />
                            <div className="flex justify-between text-[10px] text-surface-400 mt-1">
                              <span>Menor arquivo</span>
                              <span>Melhor qualidade</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Compress Video Options */}
                      {activeTab === "compress-video" && (
                        <div className="space-y-4">
                          <div>
                            <SectionHeader>Nível de Compressão</SectionHeader>
                            <div className="flex flex-wrap gap-1.5">
                              {[
                                {
                                  id: "high",
                                  label: "Leve",
                                  crf: "18",
                                  desc: "Alta qualidade",
                                },
                                {
                                  id: "medium",
                                  label: "Médio",
                                  crf: "23",
                                  desc: "Equilibrado",
                                },
                                {
                                  id: "low",
                                  label: "Forte",
                                  crf: "28",
                                  desc: "Arquivo menor",
                                },
                                {
                                  id: "tiny",
                                  label: "Máximo",
                                  crf: "35",
                                  desc: "Muito menor",
                                },
                              ].map((q) => (
                                <PillButton
                                  key={q.id}
                                  selected={videoQuality === q.id}
                                  onClick={() => setVideoQuality(q.id)}
                                  subtitle={`CRF ${q.crf}`}
                                >
                                  {q.label}
                                </PillButton>
                              ))}
                            </div>
                          </div>

                          <div>
                            <SectionHeader>
                              Velocidade de Encoding
                            </SectionHeader>
                            <div className="flex flex-wrap gap-1.5">
                              {[
                                { id: "ultrafast", label: "Ultra Rápido" },
                                { id: "fast", label: "Rápido" },
                                { id: "medium", label: "Médio" },
                                { id: "slow", label: "Lento" },
                              ].map((p) => (
                                <PillButton
                                  key={p.id}
                                  selected={videoPreset === p.id}
                                  onClick={() => setVideoPreset(p.id)}
                                >
                                  {p.label}
                                </PillButton>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Compress Image Options */}
                      {activeTab === "compress-image" && (
                        <div className="space-y-4">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <SectionHeader>Qualidade</SectionHeader>
                              <span className="text-xs font-semibold text-surface-900 dark:text-white">
                                {imageQuality}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min="10"
                              max="100"
                              value={imageQuality}
                              onChange={(e) =>
                                setImageQuality(Number(e.target.value))
                              }
                              className="w-full h-1.5 bg-surface-200 dark:bg-surface-700 rounded-full appearance-none cursor-pointer accent-primary-600"
                            />
                            <div className="flex justify-between text-[10px] text-surface-400 mt-1">
                              <span>Compressão máxima</span>
                              <span>Qualidade máxima</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Remove Background Options */}
                      {activeTab === "remove-bg" && (
                        <div className="space-y-4">
                          {!rembgAvailable ? (
                            <div className="p-4 bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 border border-pink-200 dark:border-pink-800/50 rounded-xl">
                              <div className="flex items-start gap-3">
                                <IconSparkles
                                  size={20}
                                  className="text-pink-500 shrink-0 mt-0.5"
                                />
                                <div className="flex-1">
                                  <h4 className="font-semibold text-sm text-surface-900 dark:text-white mb-1">
                                    Rembg não instalado
                                  </h4>
                                  <p className="text-xs text-surface-600 dark:text-surface-400 mb-3">
                                    Instale o Rembg para usar remoção de fundo
                                    com IA. Instalação automática.
                                  </p>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <motion.button
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.98 }}
                                      onClick={handleDownloadRembg}
                                      disabled={isDownloadingRembg}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 text-white font-medium rounded-lg shadow-lg shadow-purple-500/25 transition-all text-xs"
                                    >
                                      {isDownloadingRembg ? (
                                        <>
                                          <IconLoader2
                                            size={14}
                                            className="animate-spin"
                                          />
                                          <span>Instalando...</span>
                                        </>
                                      ) : (
                                        <>
                                          <IconSparkles size={14} />
                                          <span>Instalar (~8 MB)</span>
                                        </>
                                      )}
                                    </motion.button>
                                    <button
                                      onClick={() =>
                                        OpenUrl(
                                          "https://github.com/danielgatis/rembg"
                                        )
                                      }
                                      className="px-3 py-1.5 text-pink-600 dark:text-pink-400 font-medium rounded-lg hover:bg-pink-100 dark:hover:bg-pink-900/30 transition-colors text-xs"
                                    >
                                      Saber mais
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <SectionHeader>Modelo de IA</SectionHeader>
                              <div className="grid gap-2">
                                {bgModels.map((model) => (
                                  <motion.button
                                    key={model.id}
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.99 }}
                                    onClick={() => setBgModel(model.id)}
                                    className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                                      bgModel === model.id
                                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                                        : "border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600"
                                    }`}
                                  >
                                    <div className="text-left">
                                      <p className="font-medium text-sm text-surface-900 dark:text-white">
                                        {model.name}
                                      </p>
                                      <p className="text-[10px] text-surface-500">
                                        {model.description}
                                      </p>
                                    </div>
                                    {bgModel === model.id && (
                                      <div className="w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center">
                                        <IconCheck
                                          size={12}
                                          className="text-white"
                                        />
                                      </div>
                                    )}
                                  </motion.button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.div>
            </div>

            {/* Added spacer to prevent bottom content from being covered by terminal or fixed UI */}
            <div className="h-24"></div>
          </div>
        </div>

        {/* Right: Actions Side Panel (Fixed Width) */}
        <div className="w-72 lg:w-80 shrink-0 bg-white dark:bg-surface-900 border-l border-surface-200 dark:border-surface-800 flex flex-col z-20 shadow-xl shadow-black/5">
          <div className="p-4 flex flex-col h-full">
            <h3 className="font-semibold text-sm text-surface-900 dark:text-white mb-4">
              Resumo e Ação
            </h3>

            {/* Action Section */}
            <div className="space-y-4 flex-1">
              {/* Output Directory Moved Here */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">
                  Destino
                </label>
                <button
                  onClick={handleSelectOutput}
                  disabled={isProcessing}
                  className="w-full p-2.5 bg-surface-50 dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 hover:border-primary-500 dark:hover:border-primary-500 transition-colors text-left flex items-center gap-2 group"
                >
                  <div className="w-7 h-7 rounded-lg bg-surface-200 dark:bg-surface-700 flex items-center justify-center group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 transition-colors">
                    <IconFolder
                      size={14}
                      className="text-surface-500 group-hover:text-primary-600 transition-colors"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-surface-700 dark:text-surface-300 truncate">
                      {outputDir ? getFileName(outputDir) : "Pasta original"}
                    </p>
                  </div>
                  <IconChevronDown size={14} className="text-surface-400" />
                </button>
                <p className="text-[10px] text-surface-400 px-1">
                  Onde o arquivo convertido será salvo.
                </p>
              </div>

              <div className="h-px bg-surface-100 dark:bg-surface-800 my-2" />

              {/* Main Action Button with Progress */}
              <div className="space-y-3">
                {isProcessing && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium text-primary-600 dark:text-primary-400">
                      <span>Processando...</span>
                      <IconLoader2 size={12} className="animate-spin" />
                    </div>
                    <div className="h-1 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-primary-600 rounded-full"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                    </div>
                  </div>
                )}

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleConvert}
                  disabled={
                    !inputPath ||
                    isProcessing ||
                    (activeTab === "remove-bg" && !rembgAvailable)
                  }
                  className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-surface-200 dark:disabled:bg-surface-800 disabled:text-surface-400 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-primary-500/25 disabled:shadow-none flex items-center justify-center gap-2 transition-all text-sm"
                >
                  {isProcessing ? (
                    <span>Aguarde...</span>
                  ) : (
                    <>
                      <IconPlayerPlay size={16} className="fill-current" />
                      <span>Iniciar</span>
                    </>
                  )}
                </motion.button>
              </div>

              {/* Feedback Messages */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl"
                  >
                    <div className="flex gap-2">
                      <IconAlertCircle
                        size={16}
                        className="text-red-600 dark:text-red-400 shrink-0 mt-0.5"
                      />
                      <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                        {error}
                      </p>
                    </div>
                  </motion.div>
                )}

                {result && result.success && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-xl space-y-2"
                  >
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-bold text-xs">
                      <IconCheck size={14} />
                      <span>Concluído com Sucesso</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="bg-white/60 dark:bg-black/20 p-1.5 rounded">
                        <span className="block text-surface-500">Antes</span>
                        <span className="font-mono font-medium">
                          {formatSize(result.inputSize)}
                        </span>
                      </div>
                      <div className="bg-white/60 dark:bg-black/20 p-1.5 rounded">
                        <span className="block text-green-600">Depois</span>
                        <span className="font-mono font-bold text-green-700 dark:text-green-400">
                          {formatSize(result.outputSize)}
                        </span>
                      </div>
                    </div>

                    {result.compression !== 0 && (
                      <div className="text-center text-[10px] font-medium text-green-800 dark:text-green-300 pt-0.5">
                        {result.compression > 0 ? "Economia de" : "Aumento de"}{" "}
                        {Math.abs(result.compression).toFixed(1)}%
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
