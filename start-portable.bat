@echo off
REM Portable AI Video Writer Launcher for Windows
REM This script starts the portable version of AI Video Writer

echo.
echo ========================================
echo   AI Video Writer - Portable Edition
echo ========================================
echo.

REM Check if .env.local exists
if not exist ".env.local" (
    echo [WARNING] .env.local not found!
    echo Please create .env.local from .env.example and add your GEMINI_API_KEY
    echo.
    pause
    exit /b 1
)

REM Check if binaries exist
if not exist "binaries\win32\yt-dlp.exe" (
    echo [ERROR] yt-dlp.exe not found in binaries\win32\
    echo Please download it from: https://github.com/yt-dlp/yt-dlp/releases
    echo.
    pause
    exit /b 1
)

if not exist "binaries\win32\ffmpeg.exe" (
    echo [ERROR] ffmpeg.exe not found in binaries\win32\
    echo Please download it from: https://www.gyan.dev/ffmpeg/builds/
    echo.
    pause
    exit /b 1
)

echo [OK] All binaries found
echo [OK] Starting AI Video Writer...
echo.
echo The application will be available at: http://localhost:3001
echo.
echo Press Ctrl+C to stop the server
echo.

REM Start the application
ai-video-writer.exe

pause
