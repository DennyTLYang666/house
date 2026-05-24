/**
 * ╔══════════════════════════════════════════╗
 * ║         auth.js — 認證 & 解密模組         ║
 * ╚══════════════════════════════════════════╝
 *
 * 職責：
 *   1. 解析 URL hash → 查 SITE_CONFIG.KEYS → 取得 modeName
 *   2. 依 UNKNOWN_KEY_ACTION 決定是否顯示鎖定畫面
 *   3. 提供 decryptData() 給 data.js 使用
 *   4. 初始化 GA、設定 title、切換畫面
 *
 * 依賴：config.js（需先載入）
 * 輸出：window.modeConfig、window.decryptData
 */

(function () {
  'use strict';

  // ── Step 1: Hash → 模式名稱 ──────────────
  const orgHashKey = window.location.hash.replace('#', '').split('?')[0].trim();
  const hashKey    = btoa(orgHashKey);
  const modeName   = SITE_CONFIG.KEYS[hashKey] || null;

  // 實際加密金鑰 = 反轉 hash + 私密 salt
  function buildCryptoKey(key) {
    return key.split('').reverse().join('') + 'yangs591';
  }

  // ── Step 2: 未知金鑰處理 ─────────────────
  if (!modeName) {
    if (SITE_CONFIG.UNKNOWN_KEY_ACTION === 'block') {
      document.title = '存取受限';
      // lockscreen 預設已顯示，不做任何事，直接中止
      throw new Error('Access denied');
    }
  }

  // ── Step 3: 取得模式設定 ─────────────────
  const modeConfig = SITE_CONFIG.MODES[modeName || SITE_CONFIG.UNKNOWN_KEY_ACTION];
  modeConfig._name = modeName || 'unknown';

  // ── Step 4: 初始化頁面 ───────────────────
  document.title = modeConfig.title;
  document.getElementById('sidebarTitle').textContent = modeConfig.sidebarTitle;
  document.getElementById('lockscreen').style.display = 'none';
  document.getElementById('loadingOverlay').style.display = 'flex';
  document.getElementById('app').style.display = 'flex';
  window.GA?.init(modeName);

  // ── Step 5: 解密函式（AES-GCM + PBKDF2）──
  /**
   * @param {ArrayBuffer} encBuffer - 從伺服器取得的加密 buffer
   * @param {string}      keyStr    - 已組合好的加密金鑰字串
   * @returns {Promise<Array>}       - 解密後的物件陣列
   */
  async function decryptData(encBuffer, keyStr) {
    const enc  = new TextEncoder();
    const data = new Uint8Array(encBuffer);

    // 驗證 magic header
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

  // ── 暴露給其他模組 ───────────────────────
  window.modeConfig     = modeConfig;
  window.decryptData    = decryptData;
  window._buildCryptoKey = buildCryptoKey;
  window._orgHashKey    = orgHashKey;

})();