#!/usr/bin/env node

/**
 * Server Wrapper for Portable Application
 *
 * This wrapper handles the difference between development and packaged environments,
 * specifically for locating yt-dlp and ffmpeg binaries.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import process from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Detect if running as packaged executable
const isPkg = typeof process.pkg !== 'undefined';

// Determine the root directory
let rootDir;
if (isPkg) {
  // In packaged environment, binaries are in the same directory as the executable
  rootDir = dirname(process.execPath);
} else {
  // In development, use the project root
  rootDir = __dirname;
}

// Set environment variables for binary paths
const platform = process.platform;
const binaryDir = join(rootDir, 'binaries', platform);

// Set paths for yt-dlp and ffmpeg
if (platform === 'win32') {
  process.env.YT_DLP_PATH = join(binaryDir, 'yt-dlp.exe');
  process.env.FFMPEG_PATH = join(binaryDir, 'ffmpeg.exe');
  process.env.FFPROBE_PATH = join(binaryDir, 'ffprobe.exe');
} else {
  process.env.YT_DLP_PATH = join(binaryDir, 'yt-dlp');
  process.env.FFMPEG_PATH = join(binaryDir, 'ffmpeg');
  process.env.FFPROBE_PATH = join(binaryDir, 'ffprobe');
}

// Verify binaries exist
const requiredBinaries = [
  { name: 'yt-dlp', path: process.env.YT_DLP_PATH },
  { name: 'ffmpeg', path: process.env.FFMPEG_PATH }
];

console.log('\n========== 🚀 AI Video Writer - Portable Edition ==========');
console.log(`Platform: ${platform}`);
console.log(`Root Directory: ${rootDir}`);
console.log(`Binary Directory: ${binaryDir}`);
console.log('\nChecking required binaries:');

let missingBinaries = [];
for (const binary of requiredBinaries) {
  if (existsSync(binary.path)) {
    console.log(`✅ ${binary.name}: ${binary.path}`);
  } else {
    console.log(`❌ ${binary.name}: NOT FOUND at ${binary.path}`);
    missingBinaries.push(binary.name);
  }
}

if (missingBinaries.length > 0) {
  console.error('\n⚠️  Missing required binaries:', missingBinaries.join(', '));
  console.error('\nPlease ensure the following are in the binaries folder:');
  console.error(`  ${binaryDir}/`);
  console.error('  - yt-dlp (or yt-dlp.exe on Windows)');
  console.error('  - ffmpeg (or ffmpeg.exe on Windows)');
  console.error('  - ffprobe (or ffprobe.exe on Windows)');
  console.error('\nDownload links:');
  console.error('  yt-dlp: https://github.com/yt-dlp/yt-dlp/releases');
  console.error('  ffmpeg: https://ffmpeg.org/download.html');
  console.error('\n');
  process.exit(1);
}

console.log('========== All binaries found! Starting server... ==========\n');

// Set the app root for the server to find dist and other resources
process.env.APP_ROOT = rootDir;

// Import and start the actual server
if (isPkg) {
  // In packaged mode, we need to use dynamic import from snapshot
  import('./server.js').then(() => {
    console.log('Server started successfully');
  }).catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
} else {
  // In development mode, just import normally
  import('./server.js').then(() => {
    console.log('Server started successfully (development mode)');
  }).catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
