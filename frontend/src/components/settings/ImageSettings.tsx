import { useEffect } from "react";
import { IconPhoto, IconSparkles } from "@tabler/icons-react";
import { useSettingsStore } from "../../stores/settingsStore";
import { GetSettings, SaveSettings } from "../../../wailsjs/go/main/App";

// Components locais
const SettingItem = ({
  icon: Icon,
  label,
  desc,
  children,
}: {
  icon: any;
  label: string;
  desc?: string;
  children: React.ReactNode;
}) => (
  <div className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white dark:bg-surface-100 border border-surface-200 dark:border-zinc-800 rounded-xl transition-all duration-200 shadow-sm dark:shadow-none">
    <div className="flex items-start gap-4 mb-3 sm:mb-0">
      <div className="p-2.5 bg-surface-50 dark:bg-surface-50 rounded-lg group-hover:scale-110 transition-all duration-300 border border-surface-100 dark:border-zinc-800">
        <Icon size={20} className="stroke-[1.5] text-primary-600" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-surface-900 tracking-tight">
          {label}
        </span>
        {desc && (
          <span className="text-xs text-surface-500 leading-relaxed max-w-xs">
            {desc}
          </span>
        )}
      </div>
    </div>
    <div className="flex items-center pl-12 sm:pl-0">{children}</div>
  </div>
);

export default function ImageSettings() {
  const { imageFormat, imageQuality, setSetting } = useSettingsStore();

  // Sync com backend
  useEffect(() => {
    const load = async () => {
      try {
        const cfg = await GetSettings();
        if (cfg?.image) {
          setSetting("imageFormat", cfg.image.format);
          setSetting("imageQuality", cfg.image.quality);
        }
      } catch (e) {
        console.error("Failed to load image settings", e);
      }
    };
    load();
  }, []);

  // Salvar quando muda
  useEffect(() => {
    const save = async () => {
      try {
        // @ts-ignore - Backend aceita objeto parcial
        await SaveSettings({
          downloadsPath: "",
          image: {
            format: imageFormat,
            quality: imageQuality,
          },
        });
      } catch (e) {
        console.error("Save settings failed", e);
      }
    };
    if (imageFormat) save();
  }, [imageFormat, imageQuality]);

  return (
    <div className="space-y-6">
      {/* Formato de Saída */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3 flex items-center gap-2">
          <IconPhoto size={14} />
          Formato de Saída
        </h3>
        <div className="space-y-3">
          <SettingItem
            icon={IconPhoto}
            label="Formato de Conversão"
            desc="Converter imagens automaticamente ao baixar"
          >
            <select
              value={imageFormat}
              onChange={(e) => setSetting("imageFormat", e.target.value as any)}
              className="bg-surface-50 dark:bg-surface-200 border border-surface-200 dark:border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 cursor-pointer"
            >
              <option value="original">Original (Sem conversão)</option>
              <option value="jpg">JPEG (Compatível)</option>
              <option value="png">PNG (Sem perdas)</option>
              <option value="webp">WebP (Moderno)</option>
              <option value="avif">AVIF (Melhor compressão)</option>
            </select>
          </SettingItem>
        </div>
      </section>

      {/* Qualidade */}
      {imageFormat !== "original" && imageFormat !== "png" && (
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3 flex items-center gap-2">
            <IconSparkles size={14} />
            Qualidade
          </h3>
          <div className="space-y-3">
            <SettingItem
              icon={IconSparkles}
              label="Nível de Qualidade"
              desc={`${imageQuality}% — ${
                imageQuality > 80
                  ? "Alta qualidade"
                  : imageQuality > 50
                  ? "Qualidade média"
                  : "Baixa qualidade (menor tamanho)"
              }`}
            >
              <div className="flex items-center gap-4 w-32 sm:w-48">
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={imageQuality}
                  onChange={(e) =>
                    setSetting("imageQuality", Number(e.target.value))
                  }
                  className="w-full accent-primary-600 h-1.5 bg-surface-200 dark:bg-surface-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </SettingItem>
          </div>
        </section>
      )}

      {/* Info Box */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-xl">
        <div className="flex gap-3">
          <IconPhoto size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Dica de Formatos
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              <strong>JPEG:</strong> Menor tamanho, compatível com tudo.
              <br />
              <strong>PNG:</strong> Sem perdas, ideal para prints e arte.
              <br />
              <strong>WebP:</strong> Moderno, ótimo balanço tamanho/qualidade.
              <br />
              <strong>AVIF:</strong> Melhor compressão, suporte limitado.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
