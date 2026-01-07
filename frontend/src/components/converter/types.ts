/**
 * Resultado de uma conversão de mídia
 */
export interface ConversionResult {
  outputPath: string;
  inputSize: number;
  outputSize: number;
  compression: number;
  success: boolean;
  errorMessage?: string;
}

/**
 * Tipos de abas de conversão disponíveis
 */
export type ConversionTab =
  | "video-to-video"
  | "video-to-audio"
  | "image-to-image"
  | "compress-video"
  | "compress-image";
