# Binaries Folder

This folder contains the platform-specific binaries required by AI Video Writer.

## Required Binaries

### Windows (win32/)
- `yt-dlp.exe` - YouTube video downloader
- `ffmpeg.exe` - Video processing tool
- `ffprobe.exe` - Video analysis tool (part of ffmpeg)

### macOS (darwin/)
- `yt-dlp` - YouTube video downloader
- `ffmpeg` - Video processing tool
- `ffprobe` - Video analysis tool (part of ffmpeg)

### Linux (linux/)
- `yt-dlp` - YouTube video downloader
- `ffmpeg` - Video processing tool
- `ffprobe` - Video analysis tool (part of ffmpeg)

## Download Links

### yt-dlp
Download from: https://github.com/yt-dlp/yt-dlp/releases

- **Windows**: Download `yt-dlp.exe`
- **macOS**: Download `yt-dlp_macos` and rename to `yt-dlp`
- **Linux**: Download `yt-dlp` (or use `yt-dlp_linux`)

After downloading for macOS/Linux, make it executable:
```bash
chmod +x yt-dlp
```

### FFmpeg
Download from: https://ffmpeg.org/download.html

#### Windows
- Download from: https://www.gyan.dev/ffmpeg/builds/
- Extract `ffmpeg.exe` and `ffprobe.exe` from the bin folder

#### macOS
- Download from: https://evermeet.cx/ffmpeg/
- Or use Homebrew: `brew install ffmpeg` then copy from `/opt/homebrew/bin/`

#### Linux
- Download static builds from: https://johnvansickle.com/ffmpeg/
- Or use package manager: `apt install ffmpeg` then copy from `/usr/bin/`

## File Structure

```
binaries/
├── README.md (this file)
├── win32/
│   ├── yt-dlp.exe
│   ├── ffmpeg.exe
│   └── ffprobe.exe
├── darwin/
│   ├── yt-dlp
│   ├── ffmpeg
│   └── ffprobe
└── linux/
    ├── yt-dlp
    ├── ffmpeg
    └── ffprobe
```

## Important Notes

1. **Executable Permissions**: On macOS and Linux, ensure binaries are executable:
   ```bash
   chmod +x binaries/darwin/*
   chmod +x binaries/linux/*
   ```

2. **Binary Versions**: Use the latest stable versions of both tools for best compatibility.

3. **File Size**: These binaries can be large (ffmpeg is typically 50-100MB per platform).

4. **.gitignore**: The actual binary files are ignored by git. Users need to download them separately.

## Verification

After placing the binaries, you can verify they work:

```bash
# Windows
binaries\win32\yt-dlp.exe --version
binaries\win32\ffmpeg.exe -version

# macOS / Linux
./binaries/darwin/yt-dlp --version
./binaries/darwin/ffmpeg -version
```
