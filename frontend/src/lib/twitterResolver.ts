// Twitter/X Client-Side Resolver
// Usa o WebView do Wails que roda com IP real do usuário

interface TwitterMedia {
  url: string;
  type: "image" | "video";
  width?: number;
  height?: number;
}

interface TwitterResolverResult {
  success: boolean;
  media: TwitterMedia[];
  error?: string;
}

// Extrai tweet ID da URL
const extractTweetId = (url: string): string | null => {
  const match = url.match(/(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/);
  return match?.[1] || null;
};

export async function resolveTwitter(
  url: string
): Promise<TwitterResolverResult> {
  const tweetId = extractTweetId(url);

  if (!tweetId) {
    return { success: false, media: [], error: "URL inválida do Twitter/X" };
  }

  // Tentar API de Syndication (mais estável)
  try {
    const syndicationResult = await trySyndicationAPI(tweetId);
    if (syndicationResult.success && syndicationResult.media.length > 0) {
      return syndicationResult;
    }
  } catch (e) {
    console.warn("Syndication API falhou:", e);
  }

  // Fallback: scraping da página
  try {
    const pageResult = await tryPageScraping(url);
    if (pageResult.success && pageResult.media.length > 0) {
      return pageResult;
    }
  } catch (e) {
    console.warn("Page scraping falhou:", e);
  }

  return {
    success: false,
    media: [],
    error: "Twitter/X bloqueou o acesso. Tente abrir no navegador.",
  };
}

async function trySyndicationAPI(
  tweetId: string
): Promise<TwitterResolverResult> {
  // API pública de Syndication do Twitter
  const response = await fetch(
    `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=x`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": navigator.userAgent,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  const media: TwitterMedia[] = [];

  // Extrair fotos
  if (data.photos && Array.isArray(data.photos)) {
    for (const photo of data.photos) {
      if (photo.url) {
        // Adicionar :orig para qualidade máxima
        const highResUrl = photo.url.includes("?")
          ? photo.url.replace(/\?.*$/, "?format=jpg&name=orig")
          : `${photo.url}?format=jpg&name=orig`;

        media.push({
          url: highResUrl,
          type: "image",
          width: photo.width,
          height: photo.height,
        });
      }
    }
  }

  // Extrair vídeo
  if (data.video?.variants && Array.isArray(data.video.variants)) {
    // Ordenar por bitrate (maior primeiro)
    const mp4Variants = data.video.variants
      .filter((v: { content_type: string }) => v.content_type === "video/mp4")
      .sort(
        (a: { bitrate?: number }, b: { bitrate?: number }) =>
          (b.bitrate || 0) - (a.bitrate || 0)
      );

    if (mp4Variants.length > 0) {
      media.push({
        url: mp4Variants[0].url,
        type: "video",
      });
    }
  }

  // Extrair de mediaDetails (formato alternativo)
  if (data.mediaDetails && Array.isArray(data.mediaDetails)) {
    for (const detail of data.mediaDetails) {
      if (detail.type === "photo" && detail.media_url_https) {
        const highResUrl = `${detail.media_url_https}?format=jpg&name=orig`;
        if (!media.some((m) => m.url.includes(detail.media_url_https))) {
          media.push({
            url: highResUrl,
            type: "image",
          });
        }
      } else if (detail.type === "video" && detail.video_info?.variants) {
        const mp4Variants = detail.video_info.variants
          .filter(
            (v: { content_type: string }) => v.content_type === "video/mp4"
          )
          .sort(
            (a: { bitrate?: number }, b: { bitrate?: number }) =>
              (b.bitrate || 0) - (a.bitrate || 0)
          );

        if (mp4Variants.length > 0 && !media.some((m) => m.type === "video")) {
          media.push({
            url: mp4Variants[0].url,
            type: "video",
          });
        }
      }
    }
  }

  return { success: media.length > 0, media };
}

async function tryPageScraping(url: string): Promise<TwitterResolverResult> {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html",
      "User-Agent": navigator.userAgent,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();
  const media: TwitterMedia[] = [];

  // Extrair og:image
  const ogImageMatch = html.match(/property="og:image"\s+content="([^"]+)"/);
  if (ogImageMatch && ogImageMatch[1].includes("twimg.com")) {
    media.push({
      url: ogImageMatch[1].replace(/&amp;/g, "&"),
      type: "image",
    });
  }

  // Extrair media_url_https do JSON embutido
  const mediaUrlMatches = html.matchAll(/"media_url_https"\s*:\s*"([^"]+)"/g);
  const seen = new Set<string>();

  for (const match of mediaUrlMatches) {
    const url = match[1].replace(/\\u0026/g, "&").replace(/\\\//g, "/");

    if (!seen.has(url) && url.includes("twimg.com")) {
      seen.add(url);
      media.push({
        url: `${url}?format=jpg&name=orig`,
        type: "image",
      });
    }
  }

  return { success: media.length > 0, media };
}

// Função auxiliar para verificar se é URL do Twitter/X
export function isTwitterUrl(url: string): boolean {
  return /(?:twitter\.com|x\.com)\/[^/]+\/status\/\d+/.test(url);
}

// Função auxiliar para verificar se é URL direta de CDN do Twitter
export function isTwitterCDN(url: string): boolean {
  return (
    url.includes("pbs.twimg.com") ||
    url.includes("video.twimg.com") ||
    url.includes("abs.twimg.com")
  );
}
