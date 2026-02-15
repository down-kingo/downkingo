import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// Import de recursos direto (bundled) - melhor para app desktop Wails
import ptBRCommon from "./locales/pt-BR/common.json";
import ptBRSettings from "./locales/pt-BR/settings.json";
import ptBRRoadmap from "./locales/pt-BR/roadmap.json";
import ptBRImages from "./locales/pt-BR/images.json";
import ptBRConverter from "./locales/pt-BR/converter.json";
import ptBRTranscriber from "./locales/pt-BR/transcriber.json";

import enUSCommon from "./locales/en-US/common.json";
import enUSSettings from "./locales/en-US/settings.json";
import enUSRoadmap from "./locales/en-US/roadmap.json";
import enUSImages from "./locales/en-US/images.json";
import enUSConverter from "./locales/en-US/converter.json";
import enUSTranscriber from "./locales/en-US/transcriber.json";

import esESCommon from "./locales/es-ES/common.json";
import esESSettings from "./locales/es-ES/settings.json";
import esESRoadmap from "./locales/es-ES/roadmap.json";
import esESImages from "./locales/es-ES/images.json";
import esESConverter from "./locales/es-ES/converter.json";
import esESTranscriber from "./locales/es-ES/transcriber.json";

import frFRCommon from "./locales/fr-FR/common.json";
import frFRSettings from "./locales/fr-FR/settings.json";
import frFRRoadmap from "./locales/fr-FR/roadmap.json";
import frFRImages from "./locales/fr-FR/images.json";
import frFRConverter from "./locales/fr-FR/converter.json";
import frFRTranscriber from "./locales/fr-FR/transcriber.json";

import deDECommon from "./locales/de-DE/common.json";
import deDESettings from "./locales/de-DE/settings.json";
import deDERoadmap from "./locales/de-DE/roadmap.json";
import deDEImages from "./locales/de-DE/images.json";
import deDEConverter from "./locales/de-DE/converter.json";
import deDETranscriber from "./locales/de-DE/transcriber.json";

// Recursos bundled
const resources = {
  "pt-BR": {
    common: ptBRCommon,
    settings: ptBRSettings,
    roadmap: ptBRRoadmap,
    images: ptBRImages,
    converter: ptBRConverter,
    transcriber: ptBRTranscriber,
  },
  "en-US": {
    common: enUSCommon,
    settings: enUSSettings,
    roadmap: enUSRoadmap,
    images: enUSImages,
    converter: enUSConverter,
    transcriber: enUSTranscriber,
  },
  "es-ES": {
    common: esESCommon,
    settings: esESSettings,
    roadmap: esESRoadmap,
    images: esESImages,
    converter: esESConverter,
    transcriber: esESTranscriber,
  },
  "fr-FR": {
    common: frFRCommon,
    settings: frFRSettings,
    roadmap: frFRRoadmap,
    images: frFRImages,
    converter: frFRConverter,
    transcriber: frFRTranscriber,
  },
  "de-DE": {
    common: deDECommon,
    settings: deDESettings,
    roadmap: deDERoadmap,
    images: deDEImages,
    converter: deDEConverter,
    transcriber: deDETranscriber,
  },
};

// Idiomas suportados
export const supportedLanguages = [
  { code: "pt-BR", name: "Português (Brasil)", flag: "🇧🇷" },
  { code: "en-US", name: "English (US)", flag: "🇺🇸" },
  { code: "es-ES", name: "Español", flag: "🇪🇸" },
  { code: "fr-FR", name: "Français", flag: "🇫🇷" },
  { code: "de-DE", name: "Deutsch", flag: "🇩🇪" },
] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number]["code"];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en-US",
    defaultNS: "common",
    ns: ["common", "settings", "roadmap", "images", "converter", "transcriber"],

    interpolation: {
      escapeValue: false, // React já escapa por padrão
    },

    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "kingo-language",
      caches: ["localStorage"],
    },

    react: {
      useSuspense: false,
    },
    returnEmptyString: false,
  });

export default i18n;
