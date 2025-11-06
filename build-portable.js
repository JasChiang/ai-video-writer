#!/usr/bin/env node

/**
 * Build script for creating portable AI Video Writer application
 *
 * This script:
 * 1. Builds the frontend (Vite)
 * 2. Packages the backend using pkg
 * 3. Creates platform-specific portable packages
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PLATFORMS = ['win', 'macos', 'linux'];
const OUTPUT_DIR = path.join(__dirname, 'portable-builds');

console.log('\n========== 🚀 Building AI Video Writer Portable App ==========\n');

// Step 1: Clean previous builds
console.log('Step 1/4: Cleaning previous builds...');
if (fs.existsSync(OUTPUT_DIR)) {
  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  console.log('✅ Cleaned previous builds');
}
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Step 2: Build frontend
console.log('\nStep 2/4: Building frontend with Vite...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Frontend built successfully');
} catch (error) {
  console.error('❌ Frontend build failed');
  process.exit(1);
}

// Step 3: Package backend with pkg
console.log('\nStep 3/4: Packaging backend with pkg...');
try {
  execSync('npx pkg server-wrapper.js --targets node18-win-x64,node18-macos-x64,node18-linux-x64 --output portable-builds/ai-video-writer', {
    stdio: 'inherit'
  });
  console.log('✅ Backend packaged successfully');
} catch (error) {
  console.error('❌ Backend packaging failed');
  process.exit(1);
}

// Step 4: Create portable packages for each platform
console.log('\nStep 4/4: Creating portable packages...');

const platforms = [
  { name: 'win', exeSuffix: '.exe', binDir: 'win32' },
  { name: 'macos', exeSuffix: '', binDir: 'darwin' },
  { name: 'linux', exeSuffix: '', binDir: 'linux' }
];

for (const platform of platforms) {
  console.log(`\n  📦 Creating package for ${platform.name}...`);

  const platformDir = path.join(OUTPUT_DIR, `ai-video-writer-${platform.name}`);
  const exeName = `ai-video-writer-${platform.name}${platform.exeSuffix}`;
  const exePath = path.join(OUTPUT_DIR, exeName);

  // Check if executable was created
  if (!fs.existsSync(exePath)) {
    console.log(`  ⚠️  Skipping ${platform.name} - executable not found`);
    continue;
  }

  // Create platform directory
  fs.mkdirSync(platformDir, { recursive: true });

  // Copy executable
  fs.copyFileSync(exePath, path.join(platformDir, `ai-video-writer${platform.exeSuffix}`));

  // Copy dist folder
  const distSrc = path.join(__dirname, 'dist');
  const distDest = path.join(platformDir, 'dist');
  if (fs.existsSync(distSrc)) {
    copyRecursiveSync(distSrc, distDest);
  }

  // Copy public folder
  const publicSrc = path.join(__dirname, 'public');
  const publicDest = path.join(platformDir, 'public');
  if (fs.existsSync(publicSrc)) {
    copyRecursiveSync(publicSrc, publicDest);
  }

  // Create binaries directory structure
  const binariesDest = path.join(platformDir, 'binaries', platform.binDir);
  fs.mkdirSync(binariesDest, { recursive: true });

  // Copy binaries if they exist
  const binariesSrc = path.join(__dirname, 'binaries', platform.binDir);
  if (fs.existsSync(binariesSrc)) {
    const binFiles = fs.readdirSync(binariesSrc);
    if (binFiles.length > 0) {
      for (const file of binFiles) {
        const srcFile = path.join(binariesSrc, file);
        const destFile = path.join(binariesDest, file);
        fs.copyFileSync(srcFile, destFile);

        // Make executable on Unix-like systems
        if (platform.name !== 'win') {
          fs.chmodSync(destFile, '755');
        }
      }
      console.log(`  ✅ Copied ${binFiles.length} binary files`);
    } else {
      console.log(`  ⚠️  No binaries found in binaries/${platform.binDir}/`);
    }
  }

  // Copy .env.example
  const envExample = path.join(__dirname, '.env.example');
  if (fs.existsSync(envExample)) {
    fs.copyFileSync(envExample, path.join(platformDir, '.env.example'));
  }

  // Create README for the package
  createPackageReadme(platformDir, platform);

  // Create temp_videos directory
  fs.mkdirSync(path.join(platformDir, 'temp_videos'), { recursive: true });

  console.log(`  ✅ Package created: ${platformDir}`);

  // Clean up individual executable
  fs.unlinkSync(exePath);
}

console.log('\n========== ✅ Build Complete! ==========');
console.log(`\nPortable packages are in: ${OUTPUT_DIR}/`);
console.log('\nNext steps:');
console.log('1. Download yt-dlp and ffmpeg binaries for each platform');
console.log('2. Place them in the respective binaries/ folders');
console.log('3. Create .env.local with your GEMINI_API_KEY');
console.log('4. Run the executable to start the application\n');

// Helper function to copy directory recursively
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Helper function to create README for package
function createPackageReadme(platformDir, platform) {
  const readmeContent = `# AI Video Writer - Portable Edition

## Quick Start

1. **Download Binaries**
   - Download yt-dlp and ffmpeg for ${platform.name}
   - See binaries/README.md for download links
   - Place them in the binaries/${platform.binDir}/ folder

2. **Configure API Key**
   - Copy .env.example to .env.local
   - Add your Gemini API key:
     \`\`\`
     GEMINI_API_KEY=your_api_key_here
     \`\`\`

3. **Run the Application**
   ${platform.name === 'win'
     ? '- Double-click ai-video-writer.exe\n   - Or run from command prompt: .\\ai-video-writer.exe'
     : '- Open terminal in this folder\n   - Make executable: chmod +x ai-video-writer\n   - Run: ./ai-video-writer'
   }

4. **Access the App**
   - Open your browser to: http://localhost:3001
   - The app will automatically open

## Required Files

\`\`\`
ai-video-writer${platform.exeSuffix}    - Main executable
binaries/${platform.binDir}/
  ├── yt-dlp${platform.name === 'win' ? '.exe' : ''}
  ├── ffmpeg${platform.name === 'win' ? '.exe' : ''}
  └── ffprobe${platform.name === 'win' ? '.exe' : ''}
.env.local              - Your configuration (create from .env.example)
dist/                   - Frontend files (included)
public/                 - Static assets (included)
temp_videos/            - Temporary video storage (auto-created)
\`\`\`

## Troubleshooting

### Missing binaries error
- Ensure yt-dlp and ffmpeg are in the binaries/${platform.binDir}/ folder
- On macOS/Linux, ensure they are executable: \`chmod +x binaries/${platform.binDir}/*\`

### API Key error
- Ensure .env.local file exists with your GEMINI_API_KEY

### Port already in use
- Change the port in .env.local: \`PORT=3002\`

## Support

For more information, visit: https://github.com/jaschiang/ai-video-writer
`;

  fs.writeFileSync(path.join(platformDir, 'README.md'), readmeContent);
}
