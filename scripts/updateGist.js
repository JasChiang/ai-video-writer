import fs from 'fs/promises';
import https from 'https';

const GIST_ID = process.env.GIST_ID;
const GIST_TOKEN = process.env.GIST_TOKEN;
const GIST_FILENAME = process.env.GIST_FILENAME || 'channelVideos.json';
const SOURCE_JSON = process.env.CHANNEL_VIDEOS_OUTPUT || 'cache/channelVideos.json';

if (!GIST_ID || !GIST_TOKEN) {
  console.error('[updateGist] 缺少 GIST_ID 或 GIST_TOKEN');
  process.exit(1);
}

async function readSource() {
  try {
    return await fs.readFile(SOURCE_JSON, 'utf8');
  } catch (error) {
    console.error(`[updateGist] 無法讀取 ${SOURCE_JSON}:`, error);
    process.exit(1);
  }
}

function httpRequest(urlString, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const options = {
      method,
      headers,
    };
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          body: data,
        });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function updateGist(content) {
  const payload = JSON.stringify({
    files: {
      [GIST_FILENAME]: {
        content,
      },
    },
  });

  const { statusCode, body } = await httpRequest(`https://api.github.com/gists/${GIST_ID}`, {
    method: 'PATCH',
    headers: {
      'User-Agent': 'ai-video-writer/channel-analytics',
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${GIST_TOKEN}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
    body: payload,
  });

  if (statusCode >= 400) {
    console.error('[updateGist] 更新 Gist 失敗:', body);
    process.exit(1);
  }

  console.log(`[updateGist] 已更新 Gist ${GIST_ID} 檔案 ${GIST_FILENAME}`);
}

async function main() {
  const content = await readSource();
  await updateGist(content);
}

main().catch((error) => {
  console.error('[updateGist] 執行失敗:', error);
  process.exit(1);
});
