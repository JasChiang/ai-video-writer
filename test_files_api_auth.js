/**
 * Files API 認證診斷腳本
 *
 * 用途：診斷為什麼 Files API 上傳時使用錯誤的專案 ID
 *
 * 執行方式：node test_files_api_auth.js
 */

import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

console.log('========================================');
console.log('Files API 認證診斷工具');
console.log('========================================\n');

console.log('=== 步驟 1: 檢查 API Key ===');
console.log('GEMINI_API_KEY 存在:', !!process.env.GEMINI_API_KEY);
if (process.env.GEMINI_API_KEY) {
  console.log('GEMINI_API_KEY 長度:', process.env.GEMINI_API_KEY.length);
  console.log('GEMINI_API_KEY 前綴:', process.env.GEMINI_API_KEY.substring(0, 10) + '...');
  console.log('是否以 AIza 開頭:', process.env.GEMINI_API_KEY.startsWith('AIza'));
} else {
  console.log('❌ GEMINI_API_KEY 未設定！');
}
console.log('');

console.log('=== 步驟 2: 檢查可能衝突的環境變數 ===');
const potentiallyConflictingEnvVars = [
  'GOOGLE_API_KEY',
  'API_KEY',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'GCLOUD_PROJECT',
  'GCP_PROJECT',
  'GOOGLE_CLOUD_PROJECT'
];

let hasConflict = false;
potentiallyConflictingEnvVars.forEach(key => {
  if (process.env[key]) {
    console.log(`⚠️  發現: ${key} = ${process.env[key].substring(0, 30)}...`);
    hasConflict = true;
  }
});

if (!hasConflict) {
  console.log('✅ 沒有發現衝突的環境變數');
}
console.log('');

console.log('=== 步驟 3: 測試 Files API 列表功能 ===');
console.log('初始化 GoogleGenAI...');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

try {
  console.log('正在呼叫 ai.files.list()...');
  const listResponse = await ai.files.list({ config: { pageSize: 2 } });

  console.log('✅ Files API 列表功能正常！使用的是正確的專案。');
  console.log('');

  let count = 0;
  for await (const file of listResponse) {
    count++;
    console.log(`檔案 ${count}:`);
    console.log('  name:', file.name);
    console.log('  displayName:', file.displayName);
    console.log('  state:', file.state);
    if (count >= 2) break;
  }

  if (count === 0) {
    console.log('(目前沒有上傳的檔案)');
  }

} catch (error) {
  console.error('❌ Files API 列表功能失敗！');
  console.error('');
  console.error('錯誤訊息:', error.message);
  console.error('');

  // 解析錯誤訊息中的專案 ID
  const projectMatch = error.message.match(/project (\d+)/);
  if (projectMatch) {
    const wrongProjectId = projectMatch[1];
    console.error('⚠️  錯誤訊息中提到的專案 ID:', wrongProjectId);
    console.error('');
    console.error('🔍 診斷結果：');
    console.error('   SDK 正在使用專案 ID:', wrongProjectId);
    console.error('   但這個專案 ID 不是來自你的 GEMINI_API_KEY！');
    console.error('');
    console.error('📋 可能的原因：');
    console.error('   1. @google/genai SDK 或 google-auth-library 使用了 Application Default Credentials (ADC)');
    console.error('   2. 系統中存在 gcloud 設定，指向錯誤的專案');
    console.error('   3. SDK 版本 bug：可能在某些情況下不使用傳入的 apiKey');
    console.error('');
    console.error('🔧 建議的解決方案：');
    console.error('   1. 檢查是否有 ~/.config/gcloud/application_default_credentials.json');
    console.error('   2. 執行: gcloud config list（如果有安裝 gcloud）');
    console.error('   3. 嘗試清除 ADC: rm ~/.config/gcloud/application_default_credentials.json');
    console.error('   4. 嘗試明確設定環境變數: export GOOGLE_APPLICATION_CREDENTIALS=""');
    console.error('   5. 更新 @google/genai 到最新版本');
  }

  // 顯示更多錯誤細節
  if (error.response) {
    console.error('');
    console.error('HTTP Response Status:', error.response.status);
    console.error('HTTP Response Data:', error.response.data);
  }
}

console.log('');
console.log('========================================');
console.log('診斷完成');
console.log('========================================');
