# 安全性與權限

## 環境變數與金鑰

- 不要提交 `.env.local`。
- 使用 GitHub Secrets / 平台環境變數管理金鑰。
- 建議限制 Google API 的 IP/HTTP referrer。

## OAuth 與 Token

- Refresh Token 應妥善保存。
- 若懷疑洩漏，立即撤銷並重新產生。

## Notion 權限

- Integration Token 建議限制資料庫範圍。
- OAuth 模式建議使用 HTTPS 與固定 redirect URI。

## GitHub Gist

- PAT 只需 `gist` 權限。
- 建議使用專用 Token 並定期輪替。

