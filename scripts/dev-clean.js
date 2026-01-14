import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const cleanupTargets = ['temp_files', 'temp_uploads', 'temp_videos'];

const removeContents = async (dirPath) => {
  try {
    const entries = await fs.readdir(dirPath);
    await Promise.all(
      entries.map((entry) => fs.rm(path.join(dirPath, entry), { recursive: true, force: true }))
    );
    console.log(`[dev:clean] Cleared ${dirPath}`);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return;
    }
    throw error;
  }
};

const run = async () => {
  await Promise.all(
    cleanupTargets.map(async (target) => {
      const targetPath = path.resolve(projectRoot, target);
      if (!targetPath.startsWith(projectRoot)) {
        return;
      }
      await removeContents(targetPath);
    })
  );
};

run().catch((error) => {
  console.error('[dev:clean] Failed:', error);
  process.exitCode = 1;
});
