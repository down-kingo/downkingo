# Third-Party Licenses

This document lists all third-party dependencies used by DownKingo and their licenses.

---

## Bundled Binaries

DownKingo distributes the following third-party binaries as part of its installer. This list is updated manually and may not be exhaustive.

### yt-dlp

|             |                                                                   |
| ----------- | ----------------------------------------------------------------- |
| **Project** | [yt-dlp/yt-dlp](https://github.com/yt-dlp/yt-dlp)                 |
| **License** | [Unlicense](https://github.com/yt-dlp/yt-dlp/blob/master/LICENSE) |
| **Usage**   | Video/audio downloading and metadata extraction                   |

### FFmpeg

|             |                                                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------- |
| **Project** | [FFmpeg](https://ffmpeg.org/)                                                                   |
| **License** | [LGPL v2.1+](https://www.ffmpeg.org/legal.html) or [GPL v2+](https://www.ffmpeg.org/legal.html) |
| **Usage**   | Audio/video processing and conversion                                                           |
| **Source**  | Windows: [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds)                            |
|             | macOS: [evermeet.cx](https://evermeet.cx/ffmpeg/)                                               |
|             | Linux: [johnvansickle.com](https://johnvansickle.com/ffmpeg/)                                   |

**FFmpeg License Notice:**

FFmpeg is licensed under the GNU Lesser General Public License (LGPL) version 2.1 or later. As required by the LGPL, if you wish to modify FFmpeg and use it with DownKingo, you may obtain the source code from the links above.

---

## Build Tools

| Tool      | License      | Link                                                |
| --------- | ------------ | --------------------------------------------------- |
| Bun       | MIT          | [oven-sh/bun](https://github.com/oven-sh/bun)       |
| Go        | BSD-3-Clause | [golang.org](https://golang.org/)                   |
| Wails CLI | MIT          | [wailsapp/wails](https://github.com/wailsapp/wails) |
| NSIS      | zlib/libpng  | [nsis.sourceforge.io](https://nsis.sourceforge.io/) |

---

## Go Dependencies

| Library             | License      |
| ------------------- | ------------ |
| wailsapp/wails/v2   | MIT          |
| rs/zerolog          | MIT          |
| bep/debounce        | MIT          |
| go-ole/go-ole       | MIT          |
| godbus/dbus/v5      | BSD-2-Clause |
| google/uuid         | BSD-3-Clause |
| gorilla/websocket   | BSD-2-Clause |
| labstack/echo/v4    | MIT          |
| pkg/errors          | BSD-2-Clause |
| samber/lo           | MIT          |
| golang.org/x/crypto | BSD-3-Clause |
| golang.org/x/net    | BSD-3-Clause |
| golang.org/x/sys    | BSD-3-Clause |
| golang.org/x/text   | BSD-3-Clause |
| modernc.org/sqlite  | BSD-3-Clause |

---

## Frontend Dependencies

| Package          | License    |
| ---------------- | ---------- |
| react            | MIT        |
| react-dom        | MIT        |
| react-router-dom | MIT        |
| zustand          | MIT        |
| framer-motion    | MIT        |
| tailwindcss      | MIT        |
| typescript       | Apache-2.0 |
| vite             | MIT        |
| postcss          | MIT        |
| autoprefixer     | MIT        |

---

## Credits

- Video downloading: [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- Media processing: [FFmpeg](https://ffmpeg.org/)
- Desktop framework: [Wails](https://wails.io/)
- UI styling: [Tailwind CSS](https://tailwindcss.com/)
- State management: [Zustand](https://github.com/pmndrs/zustand)
- Animations: [Framer Motion](https://www.framer.com/motion/)
