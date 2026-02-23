import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconVideo,
  IconMusic,
  IconPhoto,
  IconFileZip,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

// Wails bindings
import {
  SelectVideoFile,
  SelectImageFile,
  SelectVideoFiles,
  SelectImageFiles,
  SelectOutputDirectory,
  ConvertVideo,
  CompressVideo,
  ExtractAudio,
  ConvertImage,
  CompressImage,
  ReadImageThumbnail,
  GetFileSize,
  OpenUrl,
} from "../../bindings/kingo/app";

// Componentes extraídos
import {
  FileInput,
  VideoToVideoOptions,
  VideoToAudioOptions,
  ImageToImageOptions,
  CompressVideoOptions,
  CompressImageOptions,
  ActionPanel,
  BatchFileList,
  type ConversionResult,
  type ConversionTab,
  type BatchFileItem,
} from "../components/converter";
import { estimateOutputSize } from "../components/converter/estimateSize";

/**
 * Grupo semântico de cada aba — abas do mesmo grupo compartilham o arquivo selecionado.
 * Isso evita o UX frustrante de perder o arquivo ao trocar entre abas relacionadas.
 */
const TAB_GROUP: Record<ConversionTab, "video" | "image"> = {
  "video-to-video": "video",
  "video-to-audio": "video",
  "compress-video": "video",
  "image-to-image": "image",
  "compress-image": "image",
};

/**
 * Página de conversão de mídia com suporte a:
 * - Vídeo para Vídeo
 * - Vídeo para Áudio
 * - Imagem para Imagem
 * - Compressão de Vídeo
 * - Compressão de Imagem
 */
export default function Converter() {
  const { t } = useTranslation("converter");

  // Tab state
  const [activeTab, setActiveTab] = useState<ConversionTab>("video-to-video");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // File selection — separado por grupo semântico
  const [videoInputPath, setVideoInputPath] = useState("");
  const [imageInputPath, setImageInputPath] = useState("");
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

  // Image thumbnail preview
  const [imageThumbnail, setImageThumbnail] = useState("");

  // File size + estimate
  const [inputFileSize, setInputFileSize] = useState<number | null>(null);

  // Batch mode
  const [videoFiles, setVideoFiles] = useState<BatchFileItem[]>([]);
  const [imageFiles, setImageFiles] = useState<BatchFileItem[]>([]);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [error, setError] = useState("");
  const [batchProcessedCount, setBatchProcessedCount] = useState(0);

  // O inputPath ativo é derivado do grupo da aba atual
  const currentGroup = TAB_GROUP[activeTab];
  const inputPath = currentGroup === "video" ? videoInputPath : imageInputPath;
  const setInputPath = useCallback(
    (v: string) => {
      if (currentGroup === "video") setVideoInputPath(v);
      else setImageInputPath(v);
    },
    [currentGroup],
  );

  // Tab configuration
  const tabs = useMemo(
    () => [
      {
        id: "video-to-video" as ConversionTab,
        label: t("tabs.video_converter"),
        shortLabel: t("tabs.video_short"),
        icon: IconVideo,
        group: "video",
      },
      {
        id: "video-to-audio" as ConversionTab,
        label: t("tabs.audio_extractor"),
        shortLabel: t("tabs.audio_short"),
        icon: IconMusic,
        group: "video",
      },
      {
        id: "image-to-image" as ConversionTab,
        label: t("tabs.image_converter"),
        shortLabel: t("tabs.image_short"),
        icon: IconPhoto,
        group: "image",
      },
      {
        id: "compress-video" as ConversionTab,
        label: t("tabs.video_compressor"),
        shortLabel: t("tabs.video_comp_short"),
        icon: IconFileZip,
        group: "video",
      },
      {
        id: "compress-image" as ConversionTab,
        label: t("tabs.image_compressor"),
        shortLabel: t("tabs.image_comp_short"),
        icon: IconFileZip,
        group: "image",
      },
    ],
    [t],
  );

  const isVideoTab = currentGroup === "video";

  // Ao trocar de aba: limpa apenas result/error (o arquivo do mesmo grupo persiste).
  // Ao trocar de GRUPO: limpa o arquivo do grupo anterior.
  useEffect(() => {
    setResult(null);
    setError("");
    setShowAdvanced(false);
  }, [activeTab]);

  // Derive batch files for current group
  const currentFiles = currentGroup === "video" ? videoFiles : imageFiles;
  const setCurrentFiles = currentGroup === "video" ? setVideoFiles : setImageFiles;


  // Load image thumbnail when image input changes
  useEffect(() => {
    if (!imageInputPath || currentGroup !== "image") {
      setImageThumbnail("");
      return;
    }
    let cancelled = false;
    ReadImageThumbnail(imageInputPath, 96).then((thumb) => {
      if (!cancelled && thumb) setImageThumbnail(thumb);
    }).catch(() => {
      if (!cancelled) setImageThumbnail("");
    });
    return () => { cancelled = true; };
  }, [imageInputPath, currentGroup]);

  // Get file size when input changes
  useEffect(() => {
    if (!inputPath) {
      setInputFileSize(null);
      return;
    }
    let cancelled = false;
    GetFileSize(inputPath).then((size) => {
      if (!cancelled) setInputFileSize(Number(size));
    }).catch(() => {
      if (!cancelled) setInputFileSize(null);
    });
    return () => { cancelled = true; };
  }, [inputPath]);

  // Compute estimated output size
  const estimatedSize = useMemo(() => {
    if (!inputFileSize) return null;
    const quality = currentGroup === "image" ? imageQuality : videoQuality;
    const format = currentGroup === "image" ? imageFormat : videoFormat;
    return estimateOutputSize(inputFileSize, activeTab, format, quality);
  }, [inputFileSize, activeTab, imageFormat, videoFormat, imageQuality, videoQuality, currentGroup]);

  // Helper to create BatchFileItem from path
  const createBatchItem = (path: string): BatchFileItem => {
    const fileName = path.split("\\").pop() || path.split("/").pop() || path;
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      inputPath: path,
      fileName,
      customName: "", // vazio = usa nome padrão
      status: "pending",
      result: null,
      error: "",
    };
  };

  // Handlers
  const handleSelectInput = async () => {
    try {
      const files = isVideoTab
        ? await SelectVideoFiles()
        : await SelectImageFiles();
      if (files && files.length > 0) {
        const items = files.map(createBatchItem);
        setCurrentFiles(items);
        // First file becomes the primary input
        setInputPath(files[0]);
        setResult(null);
        setError("");
      }
    } catch {
      // User cancelled multi-select — fallback to single
      try {
        const file = isVideoTab
          ? await SelectVideoFile()
          : await SelectImageFile();
        if (file) {
          setCurrentFiles([createBatchItem(file)]);
          setInputPath(file);
          setResult(null);
          setError("");
        }
      } catch (err) {
        setError(String(err));
      }
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

  // Convert a single file for the given path
  const convertSingleFile = async (filePath: string, customName?: string): Promise<ConversionResult | null> => {
    switch (activeTab) {
      case "video-to-video":
        return ConvertVideo({
          inputPath: filePath,
          outputDir,
          format: videoFormat,
          quality: videoQuality,
          preset: videoPreset,
          keepAudio,
          customCrf: 0,
          resolution: "",
          customName: customName || "",
        });

      case "video-to-audio":
        return ExtractAudio({
          inputPath: filePath,
          outputDir,
          format: audioFormat,
          quality: audioQuality,
          customBitrate: 0,
          customName: customName || "",
        });

      case "image-to-image":
        return ConvertImage({
          inputPath: filePath,
          outputDir,
          format: imageFormat,
          quality: imageQuality,
          width: 0,
          height: 0,
          customName: customName || "",
        });

      case "compress-video":
        return CompressVideo(filePath, videoQuality, videoPreset);

      case "compress-image":
        return CompressImage(filePath, imageQuality);

      default:
        throw new Error(t("error_unsupported_type"));
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
    setBatchProcessedCount(0);

    try {
      const filesToProcess = currentFiles.length > 0 ? currentFiles : [createBatchItem(inputPath)];

      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        setBatchProcessedCount(i);

        // Mark current file as processing
        setCurrentFiles(prev => prev.map(f =>
          f.id === file.id ? { ...f, status: "processing" as const } : f
        ));

        try {
          const result = await convertSingleFile(file.inputPath, file.customName || undefined);
          setCurrentFiles(prev => prev.map(f =>
            f.id === file.id
              ? { ...f, status: (result?.success ? "done" : "error") as "done" | "error", result, error: result?.errorMessage || "" }
              : f
          ));

          // Para single file, manter o resultado no state principal também
          if (filesToProcess.length === 1) {
            setResult(result);
            if (result && !result.success) {
              setError(result.errorMessage || t("error_unknown"));
            }
          }
        } catch (err) {
          setCurrentFiles(prev => prev.map(f =>
            f.id === file.id
              ? { ...f, status: "error" as const, error: String(err) }
              : f
          ));
          if (filesToProcess.length === 1) {
            setError(String(err));
          }
        }
      }
      setBatchProcessedCount(filesToProcess.length);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  // Abre a pasta de destino do arquivo convertido
  const handleOpenResultFolder = useCallback(async (outputPath: string) => {
    try {
      // Extrai o diretório do caminho de saída e abre no Explorer/Finder
      const dir = outputPath.includes("\\")
        ? outputPath.substring(0, outputPath.lastIndexOf("\\"))
        : outputPath.substring(0, outputPath.lastIndexOf("/"));
      await OpenUrl(dir);
    } catch (err) {
      console.error("Falha ao abrir pasta:", err);
    }
  }, []);

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
              const isSameGroup = TAB_GROUP[tab.id] === currentGroup;
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-surface-900 dark:bg-primary-600 text-white dark:text-white shadow-md shadow-primary-500/20"
                      : isSameGroup && inputPath
                        ? "text-surface-700 dark:text-surface-200 bg-surface-100 dark:bg-surface-800 ring-1 ring-primary-500/30"
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
                onSetInputPath={(path) => {
                  setInputPath(path);
                  setCurrentFiles([createBatchItem(path)]);
                  setResult(null);
                  setError("");
                }}
                onClearInput={() => {
                  setInputPath("");
                  setCurrentFiles([]);
                }}
                thumbnailUrl={imageThumbnail}
                t={t}
              />

              {/* Batch File List */}
              {currentFiles.length > 0 && (
                <BatchFileList
                  files={currentFiles}
                  onRemove={(id) => {
                    const updated = currentFiles.filter(f => f.id !== id);
                    setCurrentFiles(updated);
                    if (updated.length > 0) {
                      setInputPath(updated[0].inputPath);
                    } else {
                      setInputPath("");
                    }
                  }}
                  onUpdateCustomName={(id, name) => {
                    setCurrentFiles(prev => prev.map(f =>
                      f.id === id ? { ...f, customName: name } : f
                    ));
                  }}
                  isProcessing={isProcessing}
                  showCustomName={["video-to-video", "video-to-audio", "image-to-image"].includes(activeTab)}
                  t={t}
                />
              )}

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
          result={result}
          error={error}
          onSelectOutput={handleSelectOutput}
          onConvert={handleConvert}
          onOpenResultFolder={handleOpenResultFolder}
          t={t}
          customOutputName=""
          onCustomOutputNameChange={() => {}}
          showCustomName={false}
          estimatedSize={estimatedSize}
          fileCount={currentFiles.length || 1}
          processedCount={batchProcessedCount}
        />
      </div>
    </div>
  );
}
