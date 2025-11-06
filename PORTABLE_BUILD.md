# AI Video Writer - 免安裝版本打包指南

本指南說明如何將 AI Video Writer 打包成跨平台的免安裝應用程式。

## 📦 打包概述

本專案使用 `pkg` 將 Node.js 應用打包成獨立的可執行文件，支援以下平台：
- **Windows** (win-x64)
- **macOS** (macos-x64)
- **Linux** (linux-x64)

打包後的應用程式會包含所有必要的 Node.js 運行時和依賴，用戶無需安裝 Node.js 即可使用。

## 🛠️ 準備工作

### 1. 開發環境要求
- Node.js 18.x 或更高版本
- npm 或 yarn
- 足夠的磁碟空間（每個平台約 100-200MB）

### 2. 下載必要的二進制文件

在打包前，需要為每個目標平台下載 yt-dlp 和 ffmpeg：

#### Windows (binaries/win32/)
```bash
# yt-dlp
# 從 https://github.com/yt-dlp/yt-dlp/releases 下載 yt-dlp.exe

# ffmpeg
# 從 https://www.gyan.dev/ffmpeg/builds/ 下載
# 解壓並複製 ffmpeg.exe 和 ffprobe.exe 到 binaries/win32/
```

#### macOS (binaries/darwin/)
```bash
# yt-dlp
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos -o binaries/darwin/yt-dlp
chmod +x binaries/darwin/yt-dlp

# ffmpeg (使用 Homebrew)
brew install ffmpeg
cp /opt/homebrew/bin/ffmpeg binaries/darwin/
cp /opt/homebrew/bin/ffprobe binaries/darwin/

# 或從 https://evermeet.cx/ffmpeg/ 下載
```

#### Linux (binaries/linux/)
```bash
# yt-dlp
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o binaries/linux/yt-dlp
chmod +x binaries/linux/yt-dlp

# ffmpeg (靜態編譯版本)
# 從 https://johnvansickle.com/ffmpeg/ 下載
# 解壓並複製 ffmpeg 和 ffprobe 到 binaries/linux/
chmod +x binaries/linux/ffmpeg binaries/linux/ffprobe
```

### 3. 驗證二進制文件

確保所有二進制文件都可執行：

```bash
# Windows
binaries\win32\yt-dlp.exe --version
binaries\win32\ffmpeg.exe -version

# macOS / Linux
./binaries/darwin/yt-dlp --version
./binaries/darwin/ffmpeg -version
./binaries/linux/yt-dlp --version
./binaries/linux/ffmpeg -version
```

## 🚀 打包步驟

### 方法 1: 使用一鍵打包命令（推薦）

```bash
npm run package
```

這個命令會：
1. 構建前端（Vite）
2. 使用 pkg 打包後端
3. 為每個平台創建完整的可攜式套件

### 方法 2: 分步打包

```bash
# 步驟 1: 安裝依賴
npm install

# 步驟 2: 構建前端
npm run build

# 步驟 3: 打包應用
npm run build:portable
```

## 📁 打包輸出結構

打包完成後，會在 `portable-builds/` 目錄下生成以下結構：

```
portable-builds/
├── ai-video-writer-win/
│   ├── ai-video-writer.exe        # Windows 可執行文件
│   ├── binaries/
│   │   └── win32/
│   │       ├── yt-dlp.exe
│   │       ├── ffmpeg.exe
│   │       └── ffprobe.exe
│   ├── dist/                       # 前端靜態文件
│   ├── public/                     # 公共資源
│   ├── temp_videos/                # 臨時視頻目錄
│   ├── .env.example
│   └── README.md
├── ai-video-writer-macos/
│   ├── ai-video-writer            # macOS 可執行文件
│   ├── binaries/
│   │   └── darwin/
│   │       ├── yt-dlp
│   │       ├── ffmpeg
│   │       └── ffprobe
│   └── ... (其他文件同上)
└── ai-video-writer-linux/
    ├── ai-video-writer            # Linux 可執行文件
    ├── binaries/
    │   └── linux/
    │       ├── yt-dlp
    │       ├── ffmpeg
    │       └── ffprobe
    └── ... (其他文件同上)
```

## 📤 分發給用戶

### 1. 壓縮打包

```bash
# Windows
cd portable-builds
tar -czf ai-video-writer-win.tar.gz ai-video-writer-win/

# macOS / Linux
cd portable-builds
tar -czf ai-video-writer-macos.tar.gz ai-video-writer-macos/
tar -czf ai-video-writer-linux.tar.gz ai-video-writer-linux/
```

### 2. 用戶使用說明

將以下內容提供給用戶：

**Windows 用戶：**
1. 解壓縮 `ai-video-writer-win.tar.gz`
2. 複製 `.env.example` 為 `.env.local`
3. 在 `.env.local` 中填入 Gemini API Key
4. 雙擊 `ai-video-writer.exe` 啟動
5. 瀏覽器自動打開 http://localhost:3001

**macOS / Linux 用戶：**
1. 解壓縮對應的壓縮包
2. 複製 `.env.example` 為 `.env.local`
3. 在 `.env.local` 中填入 Gemini API Key
4. 打開終端，進入解壓目錄
5. 執行：`chmod +x ai-video-writer` (首次需要)
6. 執行：`./ai-video-writer`
7. 瀏覽器訪問 http://localhost:3001

## 🔧 技術細節

### 打包原理

1. **server-wrapper.js**: 包裝腳本，負責：
   - 檢測運行環境（開發模式 vs 打包模式）
   - 設置二進制文件路徑
   - 驗證必要文件是否存在
   - 啟動主服務器

2. **server.js 修改**:
   - 支援從環境變數讀取二進制路徑
   - 使用 `APP_ROOT` 而非 `process.cwd()` 定位資源
   - 相容開發和打包兩種模式

3. **pkg 配置**:
   - 使用 Node.js 18 運行時
   - 包含所有必要的資源文件
   - 為三個平台生成對應的可執行文件

### 環境變數

打包後的應用支援以下環境變數（在 `.env.local` 中配置）：

```bash
# 必需
GEMINI_API_KEY=your_api_key_here

# 可選
PORT=3001                    # 服務器端口
FILE_RETENTION_DAYS=7        # 臨時文件保留天數
YOUTUBE_CLIENT_ID=...        # YouTube OAuth Client ID
```

## ⚠️ 注意事項

### 1. 二進制文件大小
- ffmpeg 通常為 50-100MB
- 完整的打包後應用每個平台約 150-250MB
- 建議使用壓縮格式分發

### 2. 跨平台限制
- Windows 版本只能在 Windows 上運行
- macOS 版本需要 macOS 10.13+ (High Sierra)
- Linux 版本需要 glibc 2.17+

### 3. 安全性
- 不要在程式碼中硬編碼 API Keys
- 提醒用戶妥善保管 `.env.local` 文件
- 建議使用 HTTPS（如果部署到公網）

### 4. 更新
- 用戶需要下載新版本來更新
- 考慮實作自動更新機制（未來功能）

## 🐛 故障排除

### 打包失敗

**問題**: `pkg` 無法找到模組
```bash
# 解決方案：確保在 package.json 的 pkg.assets 中包含該模組
```

**問題**: 二進制文件過大
```bash
# 解決方案：使用壓縮工具（如 UPX）壓縮可執行文件
npx upx portable-builds/ai-video-writer-win.exe
```

### 運行時錯誤

**問題**: 找不到二進制文件
```bash
# 檢查 binaries/ 目錄結構是否正確
# 確保文件權限（macOS/Linux）
chmod +x binaries/darwin/*
```

**問題**: API Key 錯誤
```bash
# 確認 .env.local 文件存在且格式正確
# 檢查 API Key 是否有效
```

## 📝 開發者備註

### 修改構建流程

如需自定義構建流程，可以編輯 `build-portable.js`：

```javascript
// 修改目標平台
const platforms = [
  { name: 'win', exeSuffix: '.exe', binDir: 'win32' },
  // 添加或移除平台
];

// 修改包含的文件
function createPackageReadme(platformDir, platform) {
  // 自定義 README 內容
}
```

### 添加新依賴

如果添加了新的 Node.js 依賴，需要：
1. 在 `package.json` 的 `pkg.assets` 中添加
2. 測試打包後的應用是否正常運行

## 📚 參考資源

- [pkg 官方文檔](https://github.com/vercel/pkg)
- [yt-dlp 下載](https://github.com/yt-dlp/yt-dlp/releases)
- [FFmpeg 下載](https://ffmpeg.org/download.html)

## 💡 未來改進

- [ ] 實作自動更新機制
- [ ] 添加安裝程序（Windows: NSIS, macOS: DMG）
- [ ] 支援 ARM 架構（Apple Silicon, ARM Linux）
- [ ] 減小打包體積
- [ ] 添加數位簽名（macOS, Windows）

---

**作者**: Jas Chiang
**專案**: AI Video Writer
**日期**: 2025-11-06
