import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  IconAlertCircle,
  IconBold,
  IconItalic,
  IconLoader2,
  IconRefresh,
  IconSparkles,
  IconSubtitles,
} from "@tabler/icons-react";
import {
  CAPTION_FONTS,
  type CaptionOptions,
  type CaptionPosition,
  type CaptionSource,
  type SubtitleLanguage,
  type SubtitleStyle,
  type WhisperModel,
} from "./captions";

interface CaptionInspectorProps {
  captions: CaptionOptions;
  languages: SubtitleLanguage[];
  models: WhisperModel[];
  loading: boolean;
  error: string;
  currentTime: number;
  onChange: (options: CaptionOptions) => void;
  onSourceChange: (source: CaptionSource) => void;
  onLanguageChange: (language: string) => void;
  onReload: () => void;
  onSeek: (time: number) => void;
}

const CUES_PER_PAGE = 100;

function formatCueTime(seconds: number): string {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  const remainder = Math.floor(Math.max(0, seconds) % 60);
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function CaptionInspector({
  captions,
  languages,
  models,
  loading,
  error,
  currentTime,
  onChange,
  onSourceChange,
  onLanguageChange,
  onReload,
  onSeek,
}: CaptionInspectorProps) {
  const { t } = useTranslation("common");
  const [cuePage, setCuePage] = useState(0);

  const updateStyle = (patch: Partial<SubtitleStyle>) => {
    onChange({
      ...captions,
      style: { ...captions.style, ...patch },
    });
  };

  const updateCue = (index: number, text: string) => {
    onChange({
      ...captions,
      cues: captions.cues.map((cue, cueIndex) =>
        cueIndex === index ? { ...cue, text } : cue,
      ),
    });
  };

  const languageOptions =
    languages.length > 0
      ? languages
      : [
          { code: "pt-BR", name: "Português", source: "automatic" },
          { code: "en", name: "English", source: "automatic" },
          { code: "es", name: "Español", source: "automatic" },
        ];

  const activeCueIndex = captions.cues.findIndex(
    (cue) => currentTime >= cue.start && currentTime < cue.end,
  );
  const cuePageCount = Math.max(1, Math.ceil(captions.cues.length / CUES_PER_PAGE));
  useEffect(() => {
    setCuePage((page) => Math.min(page, cuePageCount - 1));
  }, [cuePageCount]);
  useEffect(() => {
    if (activeCueIndex >= 0) {
      setCuePage(Math.floor(activeCueIndex / CUES_PER_PAGE));
    }
  }, [activeCueIndex]);
  const visibleCues = useMemo(
    () =>
      captions.cues
        .slice(cuePage * CUES_PER_PAGE, (cuePage + 1) * CUES_PER_PAGE)
        .map((cue, pageIndex) => ({
          cue,
          index: cuePage * CUES_PER_PAGE + pageIndex,
        })),
    [captions.cues, cuePage],
  );

  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col border-l border-surface-200 bg-surface-50 text-surface-900 dark:border-surface-200">
      <div className="flex items-center justify-between border-b border-surface-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-primary-500/10 p-1.5 text-primary-600">
            <IconSubtitles size={17} />
          </span>
          <div>
            <h3 className="text-xs font-bold">{t("trimmer.captions")}</h3>
            <p className="text-[10px] text-surface-500">
              {t("trimmer.captions_burned_hint")}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={captions.enabled}
          aria-label={t("trimmer.enable_captions")}
          onClick={() => onChange({ ...captions, enabled: !captions.enabled })}
          className={`relative h-6 w-11 rounded-full transition-colors ${
            captions.enabled ? "bg-primary-600" : "bg-surface-300"
          }`}
        >
          <span
            className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
              captions.enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 custom-scrollbar">
        <section className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-surface-400">
            {t("trimmer.caption_source")}
          </p>
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold text-surface-500">
              {t("trimmer.caption_generation")}
            </span>
            <select
              value={captions.source}
              disabled={loading}
              onChange={(event) => onSourceChange(event.target.value as CaptionSource)}
              className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-primary-500 disabled:opacity-50 dark:bg-surface-100"
            >
              <option value="auto">{t("trimmer.caption_source_auto")}</option>
              <option value="youtube">{t("trimmer.caption_source_youtube")}</option>
              <option value="whisper">{t("trimmer.caption_source_whisper")}</option>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-[10px] font-semibold text-surface-500">
              {t("trimmer.caption_language")}
            </span>
            <div className="flex gap-2">
              <select
                value={captions.language}
                disabled={loading}
                onChange={(event) => onLanguageChange(event.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-surface-200 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-primary-500 disabled:opacity-50 dark:bg-surface-100"
              >
                <option value="auto">{t("trimmer.caption_language_auto")}</option>
                {languageOptions.map((language) => (
                  <option key={`${language.code}-${language.source}`} value={language.code}>
                    {language.name || language.code} · {t(`trimmer.caption_${language.source}`)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={onReload}
                disabled={loading || captions.source === "whisper"}
                title={t("trimmer.caption_reload")}
                className="rounded-lg border border-surface-200 p-2 text-surface-500 transition-colors hover:bg-surface-100 disabled:opacity-30"
              >
                {loading ? <IconLoader2 size={16} className="animate-spin" /> : <IconRefresh size={16} />}
              </button>
            </div>
          </label>

          {captions.source !== "youtube" && (
            <label className="block space-y-1">
              <span className="flex items-center gap-1 text-[10px] font-semibold text-surface-500">
                <IconSparkles size={11} /> {t("trimmer.caption_whisper_model")}
              </span>
              <select
                value={captions.model}
                onChange={(event) => onChange({ ...captions, model: event.target.value })}
                className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-primary-500 dark:bg-surface-100"
              >
                <option value="">{t("trimmer.caption_model_automatic")}</option>
                {models.map((model) => (
                  <option key={model.name} value={model.name}>
                    {model.name}
                  </option>
                ))}
              </select>
              {!loading &&
                models.length === 0 &&
                (captions.source === "whisper" || captions.cues.length === 0) && (
                  <p className="text-[10px] leading-relaxed text-amber-600 dark:text-amber-300">
                    {t("trimmer.caption_model_missing")}
                  </p>
                )}
            </label>
          )}

          {loading && (
            <div className="flex items-center gap-2 rounded-lg bg-primary-500/10 px-3 py-2 text-[10px] font-medium text-primary-700 dark:text-primary-300">
              <IconLoader2 size={13} className="animate-spin" />
              {t("trimmer.caption_loading")}
            </div>
          )}
          {error && !loading && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-[10px] leading-relaxed text-amber-700 dark:text-amber-300">
              <IconAlertCircle size={13} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </section>

        <section className="space-y-3 border-t border-surface-200 pt-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-surface-400">
            {t("trimmer.caption_style")}
          </p>
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold text-surface-500">
              {t("trimmer.caption_font")}
            </span>
            <select
              value={captions.style.fontFamily}
              onChange={(event) => updateStyle({ fontFamily: event.target.value })}
              className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-primary-500 dark:bg-surface-100"
            >
              {CAPTION_FONTS.map((font) => (
                <option key={font} value={font} style={{ fontFamily: font }}>
                  {font}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <label className="block space-y-1">
              <span className="text-[10px] font-semibold text-surface-500">
                {t("trimmer.caption_size")} · {captions.style.fontSize}
              </span>
              <input
                type="range"
                min="24"
                max="120"
                step="2"
                value={captions.style.fontSize}
                onChange={(event) => updateStyle({ fontSize: Number(event.target.value) })}
                className="w-full accent-primary-600"
              />
            </label>
            <div className="flex rounded-lg border border-surface-200 bg-white p-1 dark:bg-surface-100">
              <button
                type="button"
                aria-pressed={captions.style.bold}
                aria-label={t("trimmer.caption_bold")}
                onClick={() => updateStyle({ bold: !captions.style.bold })}
                className={`rounded p-1.5 transition-colors hover:bg-surface-100 dark:hover:bg-surface-200 ${captions.style.bold ? "bg-primary-500/15 text-primary-700 dark:text-primary-300" : "text-surface-500"}`}
              >
                <IconBold size={14} />
              </button>
              <button
                type="button"
                aria-pressed={captions.style.italic}
                aria-label={t("trimmer.caption_italic")}
                onClick={() => updateStyle({ italic: !captions.style.italic })}
                className={`rounded p-1.5 transition-colors hover:bg-surface-100 dark:hover:bg-surface-200 ${captions.style.italic ? "bg-primary-500/15 text-primary-700 dark:text-primary-300" : "text-surface-500"}`}
              >
                <IconItalic size={14} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["textColor", "caption_text_color"],
                ["backgroundColor", "caption_background_color"],
                ["outlineColor", "caption_outline_color"],
              ] as const
            ).map(([field, label]) => (
              <label key={field} className="space-y-1 text-center">
                <span className="block truncate text-[9px] font-semibold text-surface-500">
                  {t(`trimmer.${label}`)}
                </span>
                <input
                  type="color"
                  value={captions.style[field]}
                  onChange={(event) => updateStyle({ [field]: event.target.value })}
                  className="h-8 w-full cursor-pointer rounded border border-surface-200 dark:border-surface-300 bg-white dark:bg-surface-200 p-1"
                />
              </label>
            ))}
          </div>

          <label className="block space-y-1">
            <span className="text-[10px] font-semibold text-surface-500">
              {t("trimmer.caption_background_opacity")} · {Math.round(captions.style.backgroundOpacity * 100)}%
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={captions.style.backgroundOpacity}
              onChange={(event) => updateStyle({ backgroundOpacity: Number(event.target.value) })}
              className="w-full accent-primary-600"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[10px] font-semibold text-surface-500">
              {t("trimmer.caption_outline_width")} · {captions.style.outlineWidth}
            </span>
            <input
              type="range"
              min="0"
              max="12"
              step="1"
              value={captions.style.outlineWidth}
              onChange={(event) => updateStyle({ outlineWidth: Number(event.target.value) })}
              className="w-full accent-primary-600"
            />
          </label>

          <div className="space-y-1">
            <span className="text-[10px] font-semibold text-surface-500">
              {t("trimmer.caption_position")}
            </span>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-surface-100 p-1">
              {(["top", "center", "bottom"] as CaptionPosition[]).map((position) => (
                <button
                  key={position}
                  type="button"
                  onClick={() => updateStyle({ position })}
                  className={`rounded px-2 py-1.5 text-[10px] font-semibold transition-colors ${
                    captions.style.position === position
                      ? "bg-white text-primary-700 shadow-sm dark:bg-surface-200 dark:text-primary-300"
                      : "text-surface-500"
                  }`}
                >
                  {t(`trimmer.caption_position_${position}`)}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-2 border-t border-surface-200 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-surface-400">
              {t("trimmer.caption_transcript")}
            </p>
            <span className="rounded bg-surface-100 px-1.5 py-0.5 font-mono text-[9px] text-surface-500">
              {captions.cues.length}
            </span>
          </div>
          {captions.cues.length === 0 ? (
            <p className="rounded-lg border border-dashed border-surface-200 p-3 text-[10px] leading-relaxed text-surface-500">
              {captions.source === "whisper" || error
                ? t("trimmer.caption_transcript_after_download")
                : t("trimmer.caption_transcript_empty")}
            </p>
          ) : (
            <div className="space-y-2">
              {visibleCues.map(({ cue, index }) => {
                const active = currentTime >= cue.start && currentTime < cue.end;
                return (
                  <div
                    key={`${cue.start}-${cue.end}-${index}`}
                    className={`rounded-lg border p-2 transition-colors ${
                      active
                        ? "border-primary-500 bg-primary-500/5"
                        : "border-surface-200 bg-white dark:bg-surface-100"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSeek(cue.start)}
                      className="mb-1 rounded font-mono text-[9px] font-semibold text-primary-600 transition-colors hover:bg-primary-500/10 dark:text-primary-400"
                    >
                      {formatCueTime(cue.start)}–{formatCueTime(cue.end)}
                    </button>
                    <textarea
                      value={cue.text}
                      rows={2}
                      aria-label={`${t("trimmer.caption_cue")} ${index + 1}`}
                      onChange={(event) => updateCue(index, event.target.value)}
                      className="w-full resize-y bg-transparent text-[11px] leading-relaxed text-surface-800 outline-none"
                    />
                  </div>
                );
              })}
              {cuePageCount > 1 && (
                <div className="flex items-center justify-between rounded-lg bg-surface-100 p-1.5">
                  <button
                    type="button"
                    disabled={cuePage === 0}
                    onClick={() => setCuePage((page) => Math.max(0, page - 1))}
                    className="rounded px-2 py-1 text-[10px] font-semibold text-surface-600 hover:bg-white dark:hover:bg-surface-200 dark:hover:text-surface-800 disabled:opacity-30"
                  >
                    {t("actions.back")}
                  </button>
                  <span className="font-mono text-[9px] text-surface-500">
                    {cuePage + 1}/{cuePageCount}
                  </span>
                  <button
                    type="button"
                    disabled={cuePage >= cuePageCount - 1}
                    onClick={() =>
                      setCuePage((page) => Math.min(cuePageCount - 1, page + 1))
                    }
                    className="rounded px-2 py-1 text-[10px] font-semibold text-surface-600 hover:bg-white dark:hover:bg-surface-200 dark:hover:text-surface-800 disabled:opacity-30"
                  >
                    {t("actions.next")}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}

export default CaptionInspector;
