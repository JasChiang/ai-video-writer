/**
 * 更新影片快取到 Gist
 * 此腳本由 GitHub Actions 或 cron job 執行
 * 支援 refresh token 自動刷新
 */

import dotenv from 'dotenv';
import fs from 'fs';
import { refreshAccessToken, parseTokenInput } from '../services/youtubeTokenService.js';

// 載入環境變數
dotenv.config({ path: '.env.local' });

const API_URL = process.env.API_URL || 'http://localhost:3001';
const YOUTUBE_TOKEN = process.env.YOUTUBE_TOKEN || process.env.YOUTUBE_ACCESS_TOKEN; // 支援舊環境變數
const YOUTUBE_REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN;
const YOUTUBE_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;
const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const YOUTUBE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const GITHUB_GIST_TOKEN = process.env.GITHUB_GIST_TOKEN;
const GITHUB_GIST_ID = process.env.GITHUB_GIST_ID;
const FORCE_UPDATE = process.env.FORCE_UPDATE === 'true';

async function updateCache() {
  console.log('========================================');
  console.log('🚀 開始更新影片快取到 Gist');
  console.log('========================================\n');

  // 檢查必要的環境變數
  const missingVars = [];
  if (!YOUTUBE_TOKEN && !YOUTUBE_REFRESH_TOKEN) {
    missingVars.push('YOUTUBE_TOKEN 或 YOUTUBE_REFRESH_TOKEN');
  }
  if (!YOUTUBE_CHANNEL_ID) missingVars.push('YOUTUBE_CHANNEL_ID');
  if (!GITHUB_GIST_TOKEN) missingVars.push('GITHUB_GIST_TOKEN');

  // 如果使用 refresh token，需要 client credentials
  if (YOUTUBE_REFRESH_TOKEN && (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET)) {
    missingVars.push('YOUTUBE_CLIENT_ID 和 YOUTUBE_CLIENT_SECRET（使用 refresh token 時需要）');
  }

  if (missingVars.length > 0) {
    console.error('❌ 缺少必要的環境變數：');
    missingVars.forEach(v => console.error(`   - ${v}`));
    console.error('\n請在 GitHub Secrets 或 .env.local 中設定這些變數');
    console.error('\n💡 提示：');
    console.error('   - 使用 access token: 設定 YOUTUBE_TOKEN');
    console.error('   - 使用 refresh token (推薦): 設定 YOUTUBE_REFRESH_TOKEN, YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET');
    process.exit(1);
  }

  console.log('✅ 環境變數檢查通過');
  console.log(`   - Channel ID: ${YOUTUBE_CHANNEL_ID}`);
  console.log(`   - Gist ID: ${GITHUB_GIST_ID || '(首次建立)'}`);
  console.log(`   - Token 類型: ${YOUTUBE_REFRESH_TOKEN ? 'Refresh Token (自動刷新)' : 'Access Token'}`);
  console.log(`   - Force Update: ${FORCE_UPDATE}\n`);

  // 取得或刷新 access token
  let accessToken;

  try {
    if (YOUTUBE_REFRESH_TOKEN) {
      // 使用 refresh token 取得新的 access token
      console.log('🔄 使用 refresh token 取得 access token...');
      const tokenData = await refreshAccessToken(
        YOUTUBE_REFRESH_TOKEN,
        YOUTUBE_CLIENT_ID,
        YOUTUBE_CLIENT_SECRET
      );
      accessToken = tokenData.access_token;
      console.log(`✅ Access token 取得成功（有效期限: ${tokenData.expires_in} 秒）\n`);
    } else {
      // 使用提供的 access token（可能是 JSON 或純字串）
      const parsed = parseTokenInput(YOUTUBE_TOKEN);
      accessToken = parsed.accessToken;

      if (parsed.refreshToken) {
        console.log('💡 偵測到 token 中包含 refresh token');
        console.log('   建議將 refresh token 設定為獨立的環境變數以自動刷新\n');
      }
    }
  } catch (error) {
    console.error('❌ Token 處理失敗:', error.message);
    console.error('\n💡 可能原因：');
    console.error('   - Refresh token 已失效');
    console.error('   - Client ID 或 Client Secret 不正確');
    console.error('   - 網路連線問題');
    process.exit(1);
  }

  try {
    // 呼叫 API 更新快取
    console.log('📡 正在連接到 API...');
    const response = await fetch(`${API_URL}/api/video-cache/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accessToken: accessToken,
        channelId: YOUTUBE_CHANNEL_ID,
        gistToken: GITHUB_GIST_TOKEN,
        gistId: GITHUB_GIST_ID || null,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 請求失敗: ${response.status} ${errorText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || '更新快取失敗');
    }

    console.log('\n✅ 快取更新成功！');
    console.log('========================================');
    console.log(`📊 總影片數：${result.totalVideos}`);
    console.log(`🆔 Gist ID：${result.gistId}`);
    console.log(`🔗 Gist URL：${result.gistUrl}`);
    console.log(`📅 更新時間：${result.updatedAt}`);
    console.log('========================================\n');

    // 儲存快取資訊到檔案（供 GitHub Actions 使用）
    const cacheInfo = {
      success: true,
      totalVideos: result.totalVideos,
      gistId: result.gistId,
      gistUrl: result.gistUrl,
      rawUrl: result.rawUrl,
      updatedAt: result.updatedAt,
    };

    fs.writeFileSync(
      'cache-update-info.json',
      JSON.stringify(cacheInfo, null, 2)
    );

    console.log('💾 快取資訊已儲存到 cache-update-info.json');

    // 如果是首次建立，提示用戶儲存 Gist ID
    if (!GITHUB_GIST_ID) {
      console.log('\n⚠️  重要提示：');
      console.log('這是首次建立 Gist，請將以下 Gist ID 加入環境變數：');
      console.log(`\nGITHUB_GIST_ID=${result.gistId}\n`);
      console.log('在 GitHub Secrets 或 .env.local 中設定此變數');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 更新快取失敗：');
    console.error(`   ${error.message}\n`);

    // 常見錯誤提示
    if (error.message.includes('401')) {
      console.error('💡 可能原因：');
      console.error('   - YouTube Access Token 已過期或無效');
      console.error('   - 請重新取得 YouTube OAuth Token\n');
    } else if (error.message.includes('404')) {
      console.error('💡 可能原因：');
      console.error('   - Gist ID 不存在或無法訪問');
      console.error('   - 請檢查 GITHUB_GIST_ID 是否正確\n');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.error('💡 可能原因：');
      console.error('   - 伺服器未啟動');
      console.error('   - 請確認伺服器正在運行\n');
    }

    // 儲存錯誤資訊
    const errorInfo = {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    };

    fs.writeFileSync(
      'cache-update-info.json',
      JSON.stringify(errorInfo, null, 2)
    );

    process.exit(1);
  }
}

// 執行更新
updateCache();
