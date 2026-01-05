// Instagram Client-Side Resolver
// Usa o WebView do Wails que roda com IP real do usuário

interface InstagramMedia {
  url: string;
  type: "image" | "video";
  width?: number;
  height?: number;
}

interface InstagramResolverResult {
  success: boolean;
  media: InstagramMedia[];
  error?: string;
}

// Extrai shortcode da URL do Instagram
const extractShortcode = (url: string): string | null => {
  const match = url.match(/instagram\.com\/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/);
  return match?.[1] || null;
};

// doc_id do Instagram GraphQL para posts - obtido via devtools
// IMPORTANTE: Este valor pode mudar periodicamente
const DOC_IDS = [
  "8845758582119845", // PolarisPostActionLoadPostQueryQuery
  "9496194823773498", // PostPageContainer
  "17888483320059182", // FeedPostInformTreatmentQuery
];

// X-IG-App-ID usado pelo Instagram Web
const IG_APP_ID = "936619743392459";

export async function resolveInstagram(
  url: string
): Promise<InstagramResolverResult> {
  const shortcode = extractShortcode(url);

  if (!shortcode) {
    return { success: false, media: [], error: "URL inválida do Instagram" };
  }

  // Tentar com diferentes doc_ids
  for (const docId of DOC_IDS) {
    try {
      const result = await tryGraphQLQuery(shortcode, docId);
      if (result.success && result.media.length > 0) {
        return result;
      }
    } catch (e) {
      console.warn(`doc_id ${docId} falhou:`, e);
    }
  }

  // Fallback: tentar endpoint JSON legado
  try {
    const jsonResult = await tryJsonEndpoint(shortcode);
    if (jsonResult.success && jsonResult.media.length > 0) {
      return jsonResult;
    }
  } catch (e) {
    console.warn("JSON endpoint falhou:", e);
  }

  // Fallback: tentar scraping direto do HTML da página (Client-Side)
  // O navegador pode receber HTML mais completo que o backend
  try {
    const htmlResult = await tryHtmlScraping(url);
    if (htmlResult.success && htmlResult.media.length > 0) {
      return htmlResult;
    }
  } catch (e) {
    console.warn("HTML scraping falhou:", e);
  }

  // Fallback: tentar endpoint de embed (último recurso)
  try {
    const embedResult = await tryEmbedEndpoint(shortcode);
    if (embedResult.success && embedResult.media.length > 0) {
      return embedResult;
    }
  } catch (e) {
    console.warn("Embed endpoint falhou:", e);
  }

  // Fallback: tentar OEmbed API
  try {
    const oembedResult = await tryOEmbedAPI(url);
    if (oembedResult.success && oembedResult.media.length > 0) {
      return oembedResult;
    }
  } catch (e) {
    console.warn("OEmbed falhou:", e);
  }

  return {
    success: false,
    media: [],
    error: "Instagram bloqueou o acesso. Tente abrir no navegador.",
  };
}

async function tryGraphQLQuery(
  shortcode: string,
  docId: string
): Promise<InstagramResolverResult> {
  const variables = JSON.stringify({
    shortcode,
    fetch_tagged_user_count: null,
    hoisted_comment_id: null,
    hoisted_reply_id: null,
  });

  const response = await fetch("https://www.instagram.com/graphql/query/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-IG-App-ID": IG_APP_ID,
      "X-Requested-With": "XMLHttpRequest",
      Accept: "*/*",
      Origin: "https://www.instagram.com",
      Referer: `https://www.instagram.com/p/${shortcode}/`,
    },
    body: new URLSearchParams({
      doc_id: docId,
      variables,
    }),
    credentials: "include", // Incluir cookies se o usuário estiver logado
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();

  // Verificar se precisa de login
  if (data.require_login || data.status === "fail") {
    throw new Error("Login required");
  }

  const media: InstagramMedia[] = [];

  // Navegar pela estrutura de resposta
  const shortcodeMedia =
    data?.data?.shortcode_media ||
    data?.data?.xdt_shortcode_media ||
    data?.graphql?.shortcode_media;

  if (!shortcodeMedia) {
    throw new Error("Estrutura de resposta não reconhecida");
  }

  // Verificar se é carrossel
  if (shortcodeMedia.edge_sidecar_to_children) {
    const edges = shortcodeMedia.edge_sidecar_to_children.edges || [];
    for (const edge of edges) {
      const node = edge.node;
      if (node.is_video && node.video_url) {
        media.push({
          url: node.video_url,
          type: "video",
          width: node.dimensions?.width,
          height: node.dimensions?.height,
        });
      } else if (node.display_url) {
        media.push({
          url: node.display_url,
          type: "image",
          width: node.dimensions?.width,
          height: node.dimensions?.height,
        });
      }
    }
  } else {
    // Post único
    if (shortcodeMedia.is_video && shortcodeMedia.video_url) {
      media.push({
        url: shortcodeMedia.video_url,
        type: "video",
        width: shortcodeMedia.dimensions?.width,
        height: shortcodeMedia.dimensions?.height,
      });
    } else if (shortcodeMedia.display_url) {
      media.push({
        url: shortcodeMedia.display_url,
        type: "image",
        width: shortcodeMedia.dimensions?.width,
        height: shortcodeMedia.dimensions?.height,
      });
    }
  }

  return { success: media.length > 0, media };
}

async function tryEmbedEndpoint(
  shortcode: string
): Promise<InstagramResolverResult> {
  // Endpoint de embed que às vezes funciona sem login
  const response = await fetch(
    `https://www.instagram.com/p/${shortcode}/embed/`,
    {
      headers: {
        Accept: "text/html",
        "User-Agent": navigator.userAgent,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();
  const media: InstagramMedia[] = [];

  // Extrair display_url do HTML
  const displayUrlMatches = html.matchAll(/"display_url"\s*:\s*"([^"]+)"/g);
  const seen = new Set<string>();

  for (const match of displayUrlMatches) {
    let url = match[1].replace(/\\u0026/g, "&").replace(/\\\//g, "/");

    if (
      !seen.has(url) &&
      (url.includes("cdninstagram") || url.includes("fbcdn"))
    ) {
      seen.add(url);
      media.push({ url, type: "image" });
    }
  }

  // Extrair video_url se houver
  const videoUrlMatch = html.match(/"video_url"\s*:\s*"([^"]+)"/);
  if (videoUrlMatch) {
    const url = videoUrlMatch[1].replace(/\\u0026/g, "&").replace(/\\\//g, "/");
    media.unshift({ url, type: "video" }); // Vídeo primeiro
  }

  return { success: media.length > 0, media };
}

async function tryOEmbedAPI(url: string): Promise<InstagramResolverResult> {
  // API OEmbed oficial do Facebook
  const oembedUrl = `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(
    url
  )}&access_token=INSTAGRAM_OEMBED_TOKEN`;

  // Alternativa: endpoint público (pode não funcionar sempre)
  const publicOembed = `https://api.instagram.com/oembed/?url=${encodeURIComponent(
    url
  )}`;

  const response = await fetch(publicOembed, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  const media: InstagramMedia[] = [];

  if (data.thumbnail_url) {
    media.push({
      url: data.thumbnail_url,
      type: "image",
      width: data.thumbnail_width,
      height: data.thumbnail_height,
    });
  }

  return { success: media.length > 0, media };
}

// Função auxiliar para verificar se é URL do Instagram
export function isInstagramUrl(url: string): boolean {
  return /instagram\.com\/(p|reel|reels)\//.test(url);
}

// Função auxiliar para verificar se é URL direta de CDN
export function isInstagramCDN(url: string): boolean {
  return (
    url.includes("cdninstagram.com") ||
    url.includes("fbcdn.net") ||
    url.includes("scontent")
  );
}

async function tryJsonEndpoint(
  shortcode: string
): Promise<InstagramResolverResult> {
  const response = await fetch(
    `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`,
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
  const items = data.graphql?.shortcode_media || data.items?.[0];

  if (!items) {
    throw new Error("Estrutura JSON desconhecida");
  }

  const media: InstagramMedia[] = [];

  // Verificar se é carrossel
  if (items.edge_sidecar_to_children) {
    const edges = items.edge_sidecar_to_children.edges || [];
    for (const edge of edges) {
      const node = edge.node;
      addNodeToMedia(node, media);
    }
  } else if (items.carousel_media) {
    // Outra estrutura possível de carrossel
    for (const node of items.carousel_media) {
      addNodeToMedia(node, media);
    }
  } else {
    // Post único
    addNodeToMedia(items, media);
  }

  return { success: media.length > 0, media };
}

async function tryHtmlScraping(url: string): Promise<InstagramResolverResult> {
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
  const media: InstagramMedia[] = [];

  // Tentar encontrar JSONs embutidos conhecidos (SharedData, AdditionalData, etc)
  // Padrão 1: xdt_shortcode_media (versão mais recente)
  const xdtMatch = html.match(/"xdt_shortcode_media"\s*:\s*({.+?})(?:,"|\s*})/);
  if (xdtMatch) {
    try {
      const data = JSON.parse(
        xdtMatch[1] + (xdtMatch[1].endsWith("}") ? "" : "}")
      );
      addNodeToMedia(data, media);
      if (media.length > 0) return { success: true, media };
    } catch (e) {
      console.warn("Erro parse xdt_shortcode_media", e);
    }
  }

  // Padrão 2: _sharedData (antigo, mas ainda usado)
  const sharedDataMatch = html.match(/window\._sharedData\s*=\s*({.+?});/);
  if (sharedDataMatch) {
    try {
      const data = JSON.parse(sharedDataMatch[1]);
      const postPage = data.entry_data?.PostPage?.[0];
      const items = postPage?.graphql?.shortcode_media;
      if (items) {
        addNodeToMedia(items, media);
        if (media.length > 0) return { success: true, media };
      }
    } catch (e) {
      console.warn("Erro parse _sharedData", e);
    }
  }

  // Padrão 3: items (JSON genérico)
  const itemsMatch = html.match(/"items"\s*:\s*\[({.+?})\]/);
  if (itemsMatch) {
    try {
      const data = JSON.parse(itemsMatch[1]);
      addNodeToMedia(data, media);
      if (media.length > 0) return { success: true, media };
    } catch (e) {
      console.warn("Erro parse items", e);
    }
  }

  return { success: false, media: [], error: "Nenhum dado encontrado no HTML" };
}

function addNodeToMedia(node: any, media: InstagramMedia[]) {
  if (node.is_video || node.video_versions) {
    // Tentar pegar a melhor versão de vídeo
    const videos = node.video_versions || [];
    const bestVideo = videos.sort(
      (a: any, b: any) => b.width * b.height - a.width * a.height
    )[0];
    const videoUrl = bestVideo?.url || node.video_url;

    if (videoUrl) {
      media.push({
        url: videoUrl,
        type: "video",
        width:
          bestVideo?.width || node.dimensions?.width || node.original_width,
        height:
          bestVideo?.height || node.dimensions?.height || node.original_height,
      });
    }
  } else {
    // Imagem
    const candidates = node.image_versions2?.candidates || [];
    const bestImage = candidates.sort(
      (a: any, b: any) => b.width * b.height - a.width * a.height
    )[0];
    const imageUrl = bestImage?.url || node.display_url || node.url;

    if (imageUrl) {
      media.push({
        url: imageUrl,
        type: "image",
        width:
          bestImage?.width || node.dimensions?.width || node.original_width,
        height:
          bestImage?.height || node.dimensions?.height || node.original_height,
      });
    }
  }
}
