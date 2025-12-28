# Sidecar Binaries

Esta pasta contém os binários que serão empacotados diretamente no instalador.

## ⚠️ Importante

**NÃO faça commit dos binários no Git!** Eles são muito grandes.

Os binários devem ser baixados manualmente antes de fazer o build de produção.

---

## Download dos Binários

### Windows

```powershell
# yt-dlp
Invoke-WebRequest -Uri "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" -OutFile "windows/yt-dlp.exe"

# FFmpeg (extrair ffmpeg.exe do zip)
Invoke-WebRequest -Uri "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip" -OutFile "ffmpeg.zip"
Expand-Archive -Path "ffmpeg.zip" -DestinationPath "."
Move-Item -Path "ffmpeg-master-latest-win64-gpl/bin/ffmpeg.exe" -Destination "windows/ffmpeg.exe"
Remove-Item -Recurse "ffmpeg-master-latest-win64-gpl", "ffmpeg.zip"
```

### macOS

```bash
# yt-dlp
curl -L -o darwin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos
chmod +x darwin/yt-dlp

# FFmpeg
curl -L -o ffmpeg.zip https://evermeet.cx/ffmpeg/getrelease/zip
unzip ffmpeg.zip -d darwin/
rm ffmpeg.zip
chmod +x darwin/ffmpeg
```

### Linux

```bash
# yt-dlp
curl -L -o linux/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp
chmod +x linux/yt-dlp

# FFmpeg (static build)
curl -L -o ffmpeg.tar.xz https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
tar -xf ffmpeg.tar.xz
mv ffmpeg-*-static/ffmpeg linux/
rm -rf ffmpeg-*-static ffmpeg.tar.xz
chmod +x linux/ffmpeg
```

---

## Estrutura Esperada

```text
sidecar/
├── windows/
│   ├── yt-dlp.exe    (~10MB)
│   └── ffmpeg.exe    (~140MB)
├── darwin/
│   ├── yt-dlp        (~20MB)
│   └── ffmpeg        (~80MB)
└── linux/
    ├── yt-dlp        (~20MB)
    └── ffmpeg        (~80MB)
```

---

## CI/CD

No GitHub Actions, os binários são baixados automaticamente antes do build.
Veja `.github/workflows/release.yml` para detalhes.
