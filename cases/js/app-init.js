/**
 * ╔══════════════════════════════════════════╗
 * ║     小楊房屋系統 — 初始化模組              ║
 * ╚══════════════════════════════════════════╝
 *
 * 負責：
 *   1. 讀取 URL hash → 比對 SITE_CONFIG.KEYS → 決定模式
 *   2. 設定頁面 title / sidebarTitle
 *   3. 隱藏鎖定畫面、顯示主介面與載入 overlay
 *   4. GA：帶入模式名稱補送 page_view
 *   5. 匯出 modeConfig、orgHashKey、buildCryptoKey、decryptData 供後續模組使用
 *
 * 依賴：
 *   - config.js（SITE_CONFIG）
 *   - index.html 中的 window.GA 物件（由 gtag 區塊定義）
 *
 * 載入順序（在 index.html）：
 *   config.js → app-init.js → app-map.js → app-vue.js
 */

// ══════════════════════════════════════════
//  Step 1: 讀 URL hash → 決定模式
// ══════════════════════════════════════════
const orgHashKey = window.location.hash.replace('#', '').split('?')[0].trim();
const hashKey    = btoa(orgHashKey);
const modeName   = SITE_CONFIG.KEYS[hashKey] || null;

/**
 * 建構加密金鑰字串。
 * 規則：把 hash 反轉後接私密 salt，兩者缺一不可。
 * @param {string} key - 原始 hash 字串（未 btoa 前）
 * @returns {string}
 */
function buildCryptoKey(key) {
  return key.split('').reverse().join('') + 'yangs591';
}

// 未知密鑰處理
if (!modeName) {
  if (SITE_CONFIG.UNKNOWN_KEY_ACTION === 'block') {
    document.title = '存取受限';
    throw new Error('Access denied');
  }
}

/** @type {object} 當前模式設定（含 _name 屬性） */
const modeConfig = SITE_CONFIG.MODES[modeName || SITE_CONFIG.UNKNOWN_KEY_ACTION];
modeConfig._name = modeName || 'unknown';

// tools.js 用 window.modeConfig 判斷是否為 staff 模式，需掛到全域
window.modeConfig = modeConfig;

// ── DOM 初始化 ──
document.title = modeConfig.title;
document.getElementById('sidebarTitle').textContent = modeConfig.sidebarTitle;
document.getElementById('lockscreen').style.display    = 'none';
document.getElementById('loadingOverlay').style.display = 'flex';
document.getElementById('app').style.display           = 'flex';

// ── GA：帶模式補送 page_view ──
window.GA.init(modeName);

// ══════════════════════════════════════════
//  Step 2: 解密函式（AES-GCM + PBKDF2）
// ══════════════════════════════════════════

/**
 * 解密加密資料檔。
 * 格式：magic(4) | salt(16) | iv(12) | ciphertext
 * @param {ArrayBuffer} encBuffer
 * @param {string} keyStr
 * @returns {Promise<any>} 解析後的 JSON 資料
 */
async function decryptData(encBuffer, keyStr) {
  const enc  = new TextEncoder();
  const data = new Uint8Array(encBuffer);

  const magic = String.fromCharCode(...data.slice(0, 4));
  if (magic !== 'YHEN') throw new Error('無效的加密檔案格式');

  const salt   = data.slice(4, 20);
  const iv     = data.slice(20, 32);
  const cipher = data.slice(32);

  const baseKey = await crypto.subtle.importKey(
    'raw', enc.encode(keyStr), 'PBKDF2', false, ['deriveKey']
  );
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, cipher);
  return JSON.parse(new TextDecoder().decode(plainBuf));
}
