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

}

export namespace updater {
	
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
	
	    static createFrom(source: any = {}) {
	        return new DownloadOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.url = source["url"];
	        this.format = source["format"];
	        this.audioOnly = source["audioOnly"];
	    }
	}
	export class Format {
	    format_id: string;
	    ext: string;
	    resolution: any;
	    filesize: number;
	    vcodec: string;
	    acodec: string;
	    quality: any;
	
	    static createFrom(source: any = {}) {
	        return new Format(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.format_id = source["format_id"];
	        this.ext = source["ext"];
	        this.resolution = source["resolution"];
	        this.filesize = source["filesize"];
	        this.vcodec = source["vcodec"];
	        this.acodec = source["acodec"];
	        this.quality = source["quality"];
	    }
	}
	export class VideoInfo {
	    id: string;
	    title: string;
	    duration: number;
	    thumbnail: string;
	    uploader: string;
	    view_count: number;
	    description: string;
	    formats: Format[];
	
	    static createFrom(source: any = {}) {
	        return new VideoInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.duration = source["duration"];
	        this.thumbnail = source["thumbnail"];
	        this.uploader = source["uploader"];
	        this.view_count = source["view_count"];
	        this.description = source["description"];
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

