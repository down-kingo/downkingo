export type CaptionSource = "auto" | "youtube" | "whisper";
export type CaptionPosition = "top" | "center" | "bottom";

export interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

export interface SubtitleStyle {
  fontFamily: string;
  fontSize: number;
  textColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
  outlineColor: string;
  outlineWidth: number;
  position: CaptionPosition;
  bold: boolean;
  italic: boolean;
}

export interface CaptionOptions {
  enabled: boolean;
  source: CaptionSource;
  language: string;
  model: string;
  cues: SubtitleCue[];
  style: SubtitleStyle;
}

export interface SubtitleLanguage {
  code: string;
  name: string;
  source: "manual" | "automatic" | string;
}

export interface WhisperModel {
  name: string;
  size: number;
  path: string;
}

export const CAPTION_FONTS = [
  "Arial",
  "Montserrat",
  "Roboto",
  "Poppins",
  "Impact",
  "Georgia",
  "Courier New",
  "Trebuchet MS",
] as const;

export function createDefaultCaptionOptions(): CaptionOptions {
  return {
    enabled: false,
    source: "auto",
    language: "auto",
    model: "",
    cues: [],
    style: {
      fontFamily: "Arial",
      fontSize: 56,
      textColor: "#FFFFFF",
      backgroundColor: "#000000",
      backgroundOpacity: 0.55,
      outlineColor: "#000000",
      outlineWidth: 3,
      position: "bottom",
      bold: true,
      italic: false,
    },
  };
}
