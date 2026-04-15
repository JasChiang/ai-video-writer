import jwt from 'jsonwebtoken';

/**
 * 不需要 JWT 的路徑（相對於 /api/ 的路徑）
 * - Notion OAuth callback 是 Notion 伺服器重導向瀏覽器，沒有 JWT
 */
const EXEMPT_PATHS = [
  '/notion/oauth/callback',
  '/notion/callback',
];

/**
 * 驗證請求中的 JWT session token
 * Authorization: Bearer <token>
 */
export function requireAuth(req, res, next) {
  // Notion OAuth callback 由外部服務觸發，豁免 JWT 驗證
  if (EXEMPT_PATHS.some(p => req.path === p || req.path.startsWith(p + '?'))) {
    return next();
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('[Auth] JWT_SECRET not configured');
    return res.status(500).json({ error: 'SERVER_MISCONFIGURED' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, secret);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'INVALID_TOKEN' });
  }
}

/**
 * 簽發 session JWT（給 /api/auth/login 使用）
 */
export function signSessionToken(email) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign({ email }, secret, { expiresIn: '8h' });
}
