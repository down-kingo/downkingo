import {
  IconDownload,
  IconPhoto,
  IconTransform,
  IconMicrophone,
} from "@tabler/icons-react";
import type { FeatureId } from "../stores/settingsStore";

/**
 * Metadados de uma feature.
 * - `icon`: ícone Tabler representativo
 * - `i18nLabelKey`: chave de tradução para o nome (namespace "settings")
 * - `i18nDescKey`: chave de tradução para a descrição (namespace "settings")
 * - `requiresInstall`: se true, a feature depende de binário externo instalado
 * - `category`: agrupa a feature na navegação
 */
export interface FeatureMeta {
  icon: React.ComponentType<{
    size?: number;
    className?: string;
    stroke?: number;
  }>;
  i18nLabelKey: string;
  i18nDescKey: string;
  requiresInstall: boolean;
  category: "downloads" | "tools";
}

/**
 * Fonte única de verdade sobre todas as features disponíveis no app.
 * Qualquer componente que precise de ícone, label ou categoria de uma feature
 * deve consumir daqui — nunca redefinir localmente.
 */
export const FEATURE_REGISTRY: Record<FeatureId, FeatureMeta> = {
  videos: {
    icon: IconDownload,
    i18nLabelKey: "features.videos",
    i18nDescKey: "features.videos_desc",
    requiresInstall: false,
    category: "downloads",
  },
  images: {
    icon: IconPhoto,
    i18nLabelKey: "features.images",
    i18nDescKey: "features.images_desc",
    requiresInstall: false,
    category: "downloads",
  },
  converter: {
    icon: IconTransform,
    i18nLabelKey: "features.converter",
    i18nDescKey: "features.converter_desc",
    requiresInstall: false,
    category: "tools",
  },
  transcriber: {
    icon: IconMicrophone,
    i18nLabelKey: "features.transcriber",
    i18nDescKey: "features.transcriber_desc",
    requiresInstall: true,
    category: "tools",
  },
} as const;

/** Lista ordenada de todas as FeatureIds para iteração consistente. */
export const ALL_FEATURE_IDS: FeatureId[] = [
  "videos",
  "images",
  "converter",
  "transcriber",
];

/** Mapeamento estático de TabType para FeatureId (usado no guard de navegação). */
export const TAB_TO_FEATURE: Partial<Record<string, FeatureId>> = {
  video: "videos",
  images: "images",
  converter: "converter",
  transcriber: "transcriber",
} as const;
