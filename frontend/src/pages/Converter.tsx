import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconVideo,
  IconMusic,
  IconPhoto,
  IconFileZip,
  IconWand,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

// Wails bindings
import {
  SelectVideoFile,
  SelectImageFile,
  SelectOutputDirectory,
  ConvertVideo,
  CompressVideo,
  ExtractAudio,
  ConvertImage,
  CompressImage,
  OpenUrl,
} from "../../wailsjs/go/main/App";

// Componentes extraídos
import {
  FileInput,
  VideoToVideoOptions,
  VideoToAudioOptions,
  ImageToImageOptions,
  CompressVideoOptions,
  CompressImageOptions,
  ActionPanel,
  type ConversionResult,
  type ConversionTab,
} from "../components/converter";

/**
 * Página de conversão de mídia com suporte a:
 * - Vídeo para Vídeo
 * - Vídeo para Áudio
 * - Imagem para Imagem
 * - Compressão de Vídeo
 * - Compressão de Imagem
 * - Remoção de Fundo (IA)
 */
export default function Converter() {
  const { t } = useTranslation("converter");

  // Tab state
  const [activeTab, setActiveTab] = useState<ConversionTab>("video-to-video");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // File selection
  const [inputPath, setInputPath] = useState("");
  const [outputDir, setOutputDir] = useState("");

  // Video options
  const [videoFormat, setVideoFormat] = useState("mp4");
  const [videoQuality, setVideoQuality] = useState("medium");
  const [videoPreset, setVideoPreset] = useState("medium");
  const [keepAudio, setKeepAudio] = useState(true);

  // Audio options
  const [audioFormat, setAudioFormat] = useState("mp3");
  const [audioQuality, setAudioQuality] = useState("high");

  // Image options
  const [imageFormat, setImageFormat] = useState("webp");
  const [imageQuality, setImageQuality] = useState(85);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [error, setError] = useState("");

  // Tab configuration
  const tabs = useMemo(
    () => [
      {
        id: "video-to-video" as ConversionTab,
        label: t("tabs.video_converter"),
        shortLabel: t("tabs.video_short"),
        icon: IconVideo,
      },
      {
        id: "video-to-audio" as ConversionTab,
        label: t("tabs.audio_extractor"),
        shortLabel: t("tabs.audio_short"),
        icon: IconMusic,
      },
      {
        id: "image-to-image" as ConversionTab,
        label: t("tabs.image_converter"),
        shortLabel: t("tabs.image_short"),
        icon: IconPhoto,
      },
      {
        id: "compress-video" as ConversionTab,
        label: t("tabs.video_compressor"),
        shortLabel: t("tabs.video_comp_short"),
        icon: IconFileZip,
      },
      {
        id: "compress-image" as ConversionTab,
        label: t("tabs.image_compressor"),
        shortLabel: t("tabs.image_comp_short"),
        icon: IconFileZip,
      },
    ],
    [t]
  );

  const isVideoTab = activeTab.includes("video");

  // Check rembg availability on mount - REMOVIDO
  useEffect(() => {
    // Código removido
  }, []);

  // Clear state when tab changes
  useEffect(() => {
    setInputPath("");
    setOutputDir("");
    setResult(null);
    setError("");
    setShowAdvanced(false);
  }, [activeTab]);

  // Handlers

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

  const handleConvert = async () => {
    if (!inputPath) {
      setError(t("error_select_input"));
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

        default:
          throw new Error(t("error_unsupported_type"));
      }

      setResult(conversionResult);
      if (!conversionResult.success) {
        setError(conversionResult.errorMessage || t("error_unknown"));
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  // Render options based on active tab
  const renderOptions = () => {
    switch (activeTab) {
      case "video-to-video":
        return (
          <VideoToVideoOptions
            videoFormat={videoFormat}
            setVideoFormat={setVideoFormat}
            videoQuality={videoQuality}
            setVideoQuality={setVideoQuality}
            videoPreset={videoPreset}
            setVideoPreset={setVideoPreset}
            keepAudio={keepAudio}
            setKeepAudio={setKeepAudio}
            showAdvanced={showAdvanced}
            setShowAdvanced={setShowAdvanced}
            t={t}
          />
        );

      case "video-to-audio":
        return (
          <VideoToAudioOptions
            audioFormat={audioFormat}
            setAudioFormat={setAudioFormat}
            audioQuality={audioQuality}
            setAudioQuality={setAudioQuality}
            t={t}
          />
        );

      case "image-to-image":
        return (
          <ImageToImageOptions
            imageFormat={imageFormat}
            setImageFormat={setImageFormat}
            imageQuality={imageQuality}
            setImageQuality={setImageQuality}
            t={t}
          />
        );

      case "compress-video":
        return (
          <CompressVideoOptions
            videoQuality={videoQuality}
            setVideoQuality={setVideoQuality}
            videoPreset={videoPreset}
            setVideoPreset={setVideoPreset}
            t={t}
          />
        );

      case "compress-image":
        return (
          <CompressImageOptions
            imageQuality={imageQuality}
            setImageQuality={setImageQuality}
            t={t}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-50 dark:bg-surface-50 overflow-hidden">
      {/* Header with Tab Navigation */}
      <div className="shrink-0 border-b border-surface-200 dark:border-white/10 bg-white dark:bg-surface-50 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-display font-bold text-surface-900 dark:text-white">
                {t("title")}
              </h1>
              <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
                {t("subtitle")}
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
                      ? "bg-surface-900 dark:bg-primary-600 text-white dark:text-white shadow-md shadow-primary-500/20"
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
              <FileInput
                inputPath={inputPath}
                isVideoTab={isVideoTab}
                isProcessing={isProcessing}
                onSelectInput={handleSelectInput}
                t={t}
              />

              {/* Conversion Options */}
              <motion.div
                layout
                className="bg-white dark:bg-surface-100 rounded-2xl border border-surface-200 dark:border-white/10 overflow-hidden shadow-sm"
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
                      {renderOptions()}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.div>
            </div>

            {/* Spacer for terminal/fixed UI */}
            <div className="h-24" />
          </div>
        </div>

        {/* Right: Actions Side Panel */}
        <ActionPanel
          inputPath={inputPath}
          outputDir={outputDir}
          activeTab={activeTab}
          isProcessing={isProcessing}
          // rembgAvailable removed
          result={result}
          error={error}
          onSelectOutput={handleSelectOutput}
          onConvert={handleConvert}
          t={t}
        />
      </div>
    </div>
  );
}
