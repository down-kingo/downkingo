export namespace auth {
	
	export class DeviceCodeResponse {
	    device_code: string;
	    user_code: string;
	    verification_uri: string;
	    expires_in: number;
	    interval: number;
	
	    static createFrom(source: any = {}) {
	        return new DeviceCodeResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.device_code = source["device_code"];
	        this.user_code = source["user_code"];
	        this.verification_uri = source["verification_uri"];
	        this.expires_in = source["expires_in"];
	        this.interval = source["interval"];
	    }
	}

}

export namespace config {
	
	export class RoadmapConfig {
	    cdnEnabled: boolean;
	    cdnBaseUrl: string;
	
	    static createFrom(source: any = {}) {
	        return new RoadmapConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.cdnEnabled = source["cdnEnabled"];
	        this.cdnBaseUrl = source["cdnBaseUrl"];
	    }
	}
	export class ShortcutsConfig {
	    focusInput: string;
	    openSettings: string;
	    openQueue: string;
	    openHistory: string;
	    openDownloads: string;
	
	    static createFrom(source: any = {}) {
	        return new ShortcutsConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.focusInput = source["focusInput"];
	        this.openSettings = source["openSettings"];
	        this.openQueue = source["openQueue"];
	        this.openHistory = source["openHistory"];
	        this.openDownloads = source["openDownloads"];
	    }
	}
	export class ImageConfig {
	    format: string;
	    quality: number;
	
	    static createFrom(source: any = {}) {
	        return new ImageConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.format = source["format"];
	        this.quality = source["quality"];
	    }
	}
	export class Config {
	    downloadsPath: string;
	    videoDownloadPath: string;
	    imageDownloadPath: string;
	    image: ImageConfig;
	    shortcuts: ShortcutsConfig;
	    clipboardMonitorEnabled: boolean;
	    roadmap: RoadmapConfig;
	
	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.downloadsPath = source["downloadsPath"];
	        this.videoDownloadPath = source["videoDownloadPath"];
	        this.imageDownloadPath = source["imageDownloadPath"];
	        this.image = this.convertValues(source["image"], ImageConfig);
	        this.shortcuts = this.convertValues(source["shortcuts"], ShortcutsConfig);
	        this.clipboardMonitorEnabled = source["clipboardMonitorEnabled"];
	        this.roadmap = this.convertValues(source["roadmap"], RoadmapConfig);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	

}

export namespace handlers {
	
	export class Aria2cStatus {
	    installed: boolean;
	    path: string;
	    version: string;
	
	    static createFrom(source: any = {}) {
	        return new Aria2cStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.installed = source["installed"];
	        this.path = source["path"];
	        this.version = source["version"];
	    }
	}
	export class AudioExtractRequest {
	    inputPath: string;
	    outputDir: string;
	    format: string;
	    quality: string;
	    customBitrate: number;
	
	    static createFrom(source: any = {}) {
	        return new AudioExtractRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.inputPath = source["inputPath"];
	        this.outputDir = source["outputDir"];
	        this.format = source["format"];
	        this.quality = source["quality"];
	        this.customBitrate = source["customBitrate"];
	    }
	}
	export class BackgroundRemovalModel {
	    id: string;
	    name: string;
	    description: string;
	
	    static createFrom(source: any = {}) {
	        return new BackgroundRemovalModel(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	    }
	}
	export class BackgroundRemovalRequest {
	    inputPath: string;
	    outputDir: string;
	    model: string;
	
	    static createFrom(source: any = {}) {
	        return new BackgroundRemovalRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.inputPath = source["inputPath"];
	        this.outputDir = source["outputDir"];
	        this.model = source["model"];
	    }
	}
	export class ConversionResult {
	    outputPath: string;
	    inputSize: number;
	    outputSize: number;
	    compression: number;
	    success: boolean;
	    errorMessage?: string;
	
	    static createFrom(source: any = {}) {
	        return new ConversionResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.outputPath = source["outputPath"];
	        this.inputSize = source["inputSize"];
	        this.outputSize = source["outputSize"];
	        this.compression = source["compression"];
	        this.success = source["success"];
	        this.errorMessage = source["errorMessage"];
	    }
	}
	export class ImageConvertRequest {
	    inputPath: string;
	    outputDir: string;
	    format: string;
	    quality: number;
	    width: number;
	    height: number;
	
	    static createFrom(source: any = {}) {
	        return new ImageConvertRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.inputPath = source["inputPath"];
	        this.outputDir = source["outputDir"];
	        this.format = source["format"];
	        this.quality = source["quality"];
	        this.width = source["width"];
	        this.height = source["height"];
	    }
	}
	export class MediaItemDTO {
	    url: string;
	    type: string;
	    width: number;
	    height: number;
	
	    static createFrom(source: any = {}) {
	        return new MediaItemDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.url = source["url"];
	        this.type = source["type"];
	        this.width = source["width"];
	        this.height = source["height"];
	    }
	}
	export class MediaInfo {
	    originalUrl: string;
	    mediaItems: MediaItemDTO[];
	    source: string;
	
	    static createFrom(source: any = {}) {
	        return new MediaInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.originalUrl = source["originalUrl"];
	        this.mediaItems = this.convertValues(source["mediaItems"], MediaItemDTO);
	        this.source = source["source"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class VideoConvertRequest {
	    inputPath: string;
	    outputDir: string;
	    format: string;
	    quality: string;
	    customCrf: number;
	    preset: string;
	    resolution: string;
	    keepAudio: boolean;
	
	    static createFrom(source: any = {}) {
	        return new VideoConvertRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.inputPath = source["inputPath"];
	        this.outputDir = source["outputDir"];
	        this.format = source["format"];
	        this.quality = source["quality"];
	        this.customCrf = source["customCrf"];
	        this.preset = source["preset"];
	        this.resolution = source["resolution"];
	        this.keepAudio = source["keepAudio"];
	    }
	}

}

export namespace images {
	
	export class ImageInfo {
	    originalUrl: string;
	    directUrl: string;
	    contentType: string;
	    size: number;
	    filename: string;
	
	    static createFrom(source: any = {}) {
	        return new ImageInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.originalUrl = source["originalUrl"];
	        this.directUrl = source["directUrl"];
	        this.contentType = source["contentType"];
	        this.size = source["size"];
	        this.filename = source["filename"];
	    }
	}

}

export namespace launcher {
	
	export class DependencyStatus {
	    name: string;
	    installed: boolean;
	    size: number;
	
	    static createFrom(source: any = {}) {
	        return new DependencyStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.installed = source["installed"];
	        this.size = source["size"];
	    }
	}
	export class RembgStatus {
	    installed: boolean;
	    path: string;
	    version: string;
	    downloading: boolean;
	
	    static createFrom(source: any = {}) {
	        return new RembgStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.installed = source["installed"];
	        this.path = source["path"];
	        this.version = source["version"];
	        this.downloading = source["downloading"];
	    }
	}

}

export namespace roadmap {
	
	export class RoadmapItem {
	    id: number;
	    title: string;
	    friendly_title?: string;
	    title_i18n?: Record<string, string>;
	    description: string;
	    status: string;
	    votes: number;
	    votes_up?: number;
	    votes_down?: number;
	    comments: number;
	    url: string;
	    labels: string[];
	    author: string;
	    author_avatar: string;
	    created_at: string;
	    shipped_at?: string;
	
	    static createFrom(source: any = {}) {
	        return new RoadmapItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.friendly_title = source["friendly_title"];
	        this.title_i18n = source["title_i18n"];
	        this.description = source["description"];
	        this.status = source["status"];
	        this.votes = source["votes"];
	        this.votes_up = source["votes_up"];
	        this.votes_down = source["votes_down"];
	        this.comments = source["comments"];
	        this.url = source["url"];
	        this.labels = source["labels"];
	        this.author = source["author"];
	        this.author_avatar = source["author_avatar"];
	        this.created_at = source["created_at"];
	        this.shipped_at = source["shipped_at"];
	    }
	}

}

export namespace storage {
	
	export class Download {
	    id: string;
	    url: string;
	    title: string;
	    thumbnail: string;
	    duration: number;
	    uploader: string;
	    format: string;
	    audioOnly: boolean;
	    status: string;
	    progress: number;
	    speed: string;
	    eta: string;
	    filePath: string;
	    fileSize: number;
	    errorMessage: string;
	    // Go type: time
	    createdAt: any;
	    // Go type: time
	    startedAt?: any;
	    // Go type: time
	    completedAt?: any;
	
	    static createFrom(source: any = {}) {
	        return new Download(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.url = source["url"];
	        this.title = source["title"];
	        this.thumbnail = source["thumbnail"];
	        this.duration = source["duration"];
	        this.uploader = source["uploader"];
	        this.format = source["format"];
	        this.audioOnly = source["audioOnly"];
	        this.status = source["status"];
	        this.progress = source["progress"];
	        this.speed = source["speed"];
	        this.eta = source["eta"];
	        this.filePath = source["filePath"];
	        this.fileSize = source["fileSize"];
	        this.errorMessage = source["errorMessage"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.startedAt = this.convertValues(source["startedAt"], null);
	        this.completedAt = this.convertValues(source["completedAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace updater {
	
	export class Asset {
	    name: string;
	    browser_download_url: string;
	    size: number;
	
	    static createFrom(source: any = {}) {
	        return new Asset(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.browser_download_url = source["browser_download_url"];
	        this.size = source["size"];
	    }
	}
	export class Release {
	    tag_name: string;
	    name: string;
	    body: string;
	    published_at: string;
	    prerelease: boolean;
	    assets: Asset[];
	
	    static createFrom(source: any = {}) {
	        return new Release(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.tag_name = source["tag_name"];
	        this.name = source["name"];
	        this.body = source["body"];
	        this.published_at = source["published_at"];
	        this.prerelease = source["prerelease"];
	        this.assets = this.convertValues(source["assets"], Asset);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class UpdateInfo {
	    available: boolean;
	    currentVersion: string;
	    latestVersion: string;
	    changelog: string;
	    downloadUrl: string;
	    size: number;
	
	    static createFrom(source: any = {}) {
	        return new UpdateInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.available = source["available"];
	        this.currentVersion = source["currentVersion"];
	        this.latestVersion = source["latestVersion"];
	        this.changelog = source["changelog"];
	        this.downloadUrl = source["downloadUrl"];
	        this.size = source["size"];
	    }
	}

}

export namespace youtube {
	
	export class DownloadOptions {
	    url: string;
	    format: string;
	    audioOnly: boolean;
	    audioFormat: string;
	    audioBitrate: string;
	    downloadSubtitles: boolean;
	    subtitleLanguage: string;
	    embedSubtitles: boolean;
	    remuxVideo: boolean;
	    remuxFormat: string;
	    embedThumbnail: boolean;
	    skipExisting: boolean;
	    incognito: boolean;
	    useAria2c: boolean;
	    aria2cConnections: number;
	    title: string;
	    thumbnail: string;
	
	    static createFrom(source: any = {}) {
	        return new DownloadOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.url = source["url"];
	        this.format = source["format"];
	        this.audioOnly = source["audioOnly"];
	        this.audioFormat = source["audioFormat"];
	        this.audioBitrate = source["audioBitrate"];
	        this.downloadSubtitles = source["downloadSubtitles"];
	        this.subtitleLanguage = source["subtitleLanguage"];
	        this.embedSubtitles = source["embedSubtitles"];
	        this.remuxVideo = source["remuxVideo"];
	        this.remuxFormat = source["remuxFormat"];
	        this.embedThumbnail = source["embedThumbnail"];
	        this.skipExisting = source["skipExisting"];
	        this.incognito = source["incognito"];
	        this.useAria2c = source["useAria2c"];
	        this.aria2cConnections = source["aria2cConnections"];
	        this.title = source["title"];
	        this.thumbnail = source["thumbnail"];
	    }
	}
	export class Format {
	    format_id: string;
	    url: string;
	    ext: string;
	    resolution: string;
	    filesize: number;
	    vcodec: string;
	    acodec: string;
	    quality: string;
	    height: number;
	    width: number;
	
	    static createFrom(source: any = {}) {
	        return new Format(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.format_id = source["format_id"];
	        this.url = source["url"];
	        this.ext = source["ext"];
	        this.resolution = source["resolution"];
	        this.filesize = source["filesize"];
	        this.vcodec = source["vcodec"];
	        this.acodec = source["acodec"];
	        this.quality = source["quality"];
	        this.height = source["height"];
	        this.width = source["width"];
	    }
	}
	export class VideoInfo {
	    id: string;
	    title: string;
	    url: string;
	    duration: number;
	    thumbnail: string;
	    uploader: string;
	    view_count: number;
	    description: string;
	    width: number;
	    height: number;
	    formats: Format[];
	
	    static createFrom(source: any = {}) {
	        return new VideoInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.url = source["url"];
	        this.duration = source["duration"];
	        this.thumbnail = source["thumbnail"];
	        this.uploader = source["uploader"];
	        this.view_count = source["view_count"];
	        this.description = source["description"];
	        this.width = source["width"];
	        this.height = source["height"];
	        this.formats = this.convertValues(source["formats"], Format);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

