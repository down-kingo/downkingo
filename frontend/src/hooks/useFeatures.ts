import { useSettingsStore } from "../stores/settingsStore";

/**
 * Hook que expõe o estado de visibilidade de cada feature e grupos de navegação.
 * Use este hook em vez de consultar `enabledFeatures.includes(...)` diretamente
 * em cada componente — garante consistência e evita duplicação.
 *
 * Usa selector granular para evitar re-renders desnecessários quando outras
 * partes do settingsStore mudam.
 */
export function useFeatures() {
  const enabledFeatures = useSettingsStore((s) => s.enabledFeatures);

  const showVideos = enabledFeatures.includes("videos");
  const showImages = enabledFeatures.includes("images");
  const showConverter = enabledFeatures.includes("converter");
  const showTranscriber = enabledFeatures.includes("transcriber");

  return {
    /** Acesso granular por feature */
    showVideos,
    showImages,
    showConverter,
    showTranscriber,

    /** Grupos de navegação: categorias só aparecem se ao menos 1 filho estiver ativo */
    showDownloadsCategory: showVideos || showImages,
    showToolsCategory: showConverter || showTranscriber,

    /** Array original para uso em guards e iteração */
    enabledFeatures,

    /** Helper para verificar qualquer feature de forma tipo-segura */
    isEnabled: (id: "videos" | "images" | "converter" | "transcriber") =>
      enabledFeatures.includes(id),
  };
}
