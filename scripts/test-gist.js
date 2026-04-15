/**
 * 測試 Gist 快取是否正常運作
 */

import dotenv from 'dotenv';
import { loadFromGist, searchVideosFromCache } from '../services/videoCacheService.js';

// 載入環境變數
dotenv.config({ path: '.env.local' });

const GITHUB_GIST_ID = process.env.GITHUB_GIST_ID;
const GITHUB_GIST_TOKEN = process.env.GITHUB_GIST_TOKEN;

async function testGist() {
  console.log('========================================');
  console.log('🧪 測試 Gist 快取功能');
  console.log('========================================\n');

  // 檢查環境變數
  console.log('📋 環境變數檢查：');
  console.log(`   - GITHUB_GIST_ID: ${GITHUB_GIST_ID ? '✅ 已設定' : '❌ 未設定'}`);
  console.log(`   - GITHUB_GIST_TOKEN: ${GITHUB_GIST_TOKEN ? '✅ 已設定' : '❌ 未設定'}`);

  if (!GITHUB_GIST_ID) {
    console.error('\n❌ 錯誤：缺少 GITHUB_GIST_ID');
    console.error('請在 .env.local 設定 GITHUB_GIST_ID');
    process.exit(1);
  }

  console.log('\n');

  try {
    // 測試 1: 載入 Gist
    console.log('🧪 測試 1: 載入 Gist 快取');
    console.log('─────────────────────────────────────\n');
    const cache = await loadFromGist(GITHUB_GIST_ID, GITHUB_GIST_TOKEN);

    console.log('\n✅ 測試 1 通過：成功載入快取');
    console.log(`   - 總影片數: ${cache.totalVideos}`);
    console.log(`   - 快取版本: ${cache.version}`);
    console.log(`   - 更新時間: ${cache.updatedAt}`);

    // 顯示前 5 支影片
    console.log('\n📺 前 5 支影片：');
    cache.videos.slice(0, 5).forEach((video, index) => {
      console.log(`   ${index + 1}. ${video.title}`);
      console.log(`      ID: ${video.videoId}`);
      console.log(`      狀態: ${video.privacyStatus || 'unknown'}`);
    });

    console.log('\n');

    // 測試 2: 搜尋功能（無關鍵字）
    console.log('🧪 測試 2: 搜尋功能（無關鍵字）');
    console.log('─────────────────────────────────────\n');
    const allResults = await searchVideosFromCache(GITHUB_GIST_ID, '', 5, GITHUB_GIST_TOKEN);
    console.log(`\n✅ 測試 2 通過：返回 ${allResults.length} 筆結果\n`);

    // 測試 3: 搜尋功能（有關鍵字）
    const testKeywords = ['react', 'javascript', 'tutorial', '教學'];

    for (const keyword of testKeywords) {
      console.log(`🧪 測試 3.${testKeywords.indexOf(keyword) + 1}: 搜尋關鍵字 "${keyword}"`);
      console.log('─────────────────────────────────────\n');

      const results = await searchVideosFromCache(GITHUB_GIST_ID, keyword, 10, GITHUB_GIST_TOKEN);

      console.log(`\n✅ 找到 ${results.length} 筆符合 "${keyword}" 的影片`);

      if (results.length > 0) {
        console.log('   匹配的影片：');
        results.slice(0, 3).forEach((video, index) => {
          console.log(`   ${index + 1}. ${video.title}`);
        });
      } else {
        console.log('   ⚠️ 沒有找到匹配的影片');
      }
      console.log('');
    }

    // 測試 4: 測試 API 端點
    console.log('🧪 測試 4: 測試 API 端點');
    console.log('─────────────────────────────────────\n');

    const testUrl = `http://localhost:3001/api/video-cache/search?gistId=${encodeURIComponent(GITHUB_GIST_ID)}&query=test&maxResults=5`;
    console.log(`   API URL: ${testUrl}`);

    try {
      const response = await fetch(testUrl);

      if (response.ok) {
        const data = await response.json();
        console.log(`\n✅ 測試 4 通過：API 返回 ${data.totalResults} 筆結果`);
      } else {
        console.log(`\n⚠️ 測試 4 警告：API 返回錯誤 ${response.status}`);
        console.log('   這可能是因為伺服器未啟動');
      }
    } catch (error) {
      console.log('\n⚠️ 測試 4 警告：無法連接到伺服器');
      console.log('   請確認伺服器正在運行 (npm run dev)');
    }

    console.log('\n========================================');
    console.log('✅ 所有測試完成！');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n========================================');
    console.error('❌ 測試失敗');
    console.error('========================================');
    console.error(`錯誤訊息: ${error.message}`);
    console.error('\n可能原因：');
    console.error('1. GITHUB_GIST_ID 不正確');
    console.error('2. GITHUB_GIST_TOKEN 無效或過期');
    console.error('3. Gist 不存在或無法訪問');
    console.error('4. 網路連線問題');
    console.error('========================================\n');
    process.exit(1);
  }
}

// 執行測試
testGist();
