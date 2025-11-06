#!/bin/bash

# Portable AI Video Writer Launcher for macOS/Linux
# This script starts the portable version of AI Video Writer

echo ""
echo "========================================"
echo "  AI Video Writer - Portable Edition"
echo "========================================"
echo ""

# Detect platform
PLATFORM=$(uname -s)
if [[ "$PLATFORM" == "Darwin" ]]; then
    BINARY_DIR="binaries/darwin"
    PLATFORM_NAME="macOS"
elif [[ "$PLATFORM" == "Linux" ]]; then
    BINARY_DIR="binaries/linux"
    PLATFORM_NAME="Linux"
else
    echo "[ERROR] Unsupported platform: $PLATFORM"
    exit 1
fi

echo "[INFO] Platform: $PLATFORM_NAME"
echo ""

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "[WARNING] .env.local not found!"
    echo "Please create .env.local from .env.example and add your GEMINI_API_KEY"
    echo ""
    exit 1
fi

# Check if binaries exist
if [ ! -f "$BINARY_DIR/yt-dlp" ]; then
    echo "[ERROR] yt-dlp not found in $BINARY_DIR/"
    echo "Please download it from: https://github.com/yt-dlp/yt-dlp/releases"
    echo ""
    exit 1
fi

if [ ! -f "$BINARY_DIR/ffmpeg" ]; then
    echo "[ERROR] ffmpeg not found in $BINARY_DIR/"
    echo "Please download it from: https://ffmpeg.org/download.html"
    echo ""
    exit 1
fi

# Make sure binaries are executable
chmod +x "$BINARY_DIR/yt-dlp" 2>/dev/null
chmod +x "$BINARY_DIR/ffmpeg" 2>/dev/null
chmod +x "$BINARY_DIR/ffprobe" 2>/dev/null
chmod +x "ai-video-writer" 2>/dev/null

echo "[OK] All binaries found"
echo "[OK] Starting AI Video Writer..."
echo ""
echo "The application will be available at: http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the application
./ai-video-writer
