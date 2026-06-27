/**
 * ╔══════════════════════════════════════════╗
 * ║         data.js — 資料邏輯模組            ║
 * ╚══════════════════════════════════════════╝
 *
 * 職責：
 *   - loadData()：fetch + 解密 .enc 檔，套用模式過濾（onlyDev / excludeDevNames /
 *     excludeTypes / 停賣成交 / client 限定有圖），staff 模式另外拆出 soldData
 *   - 提供 Vue data／computed／methods mixin：
 *       filteredData（關鍵字、特殊篩選、各式 min~max、勾選篩選 + 排序）
 *       colSpan、各種 *Options（篩選器動態選項）
 *       totalPrice / maxPerformance / averagePrice / medianPrice / expiringSoonCount
 *       unitPrice()、parkingTypeShort()/parkingLabel()、toggleExpand()
 *       contractDaysLeft()/contractStatus()、setSpecialFilter()
 *
 * 依賴：app-init.js（全域 modeConfig、decryptData、buildCryptoKey、orgHashKey）
 * 輸出：window.YangData（{ loadData, vueDataMixin, vueComputedMixin, vueMethodsMixin }）
 */

(function () {
  'use strict';

  // ── 資料載入 ─────────────────────────────
  /**
   * 從 cfg.dataFile 取回並解密資料，套用模式過濾
   * @param {object} cfg modeConfig（預設用全域 modeConfig）
   * @returns {Promise<{rawData: Array, soldData: Array}>}
   */
  async function loadData(cfg) {
    cfg = cfg || modeConfig;

    const resp = await fetch(cfg.dataFile, { cache: 'no-cache' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const buf = await resp.arrayBuffer();

    const allData = await decryptData(buf, buildCryptoKey(orgHashKey));
    const df = cfg.dataFilter;

    // staff 模式：把成交資料另存 soldData，不進 rawData
    let soldData = [];
    if (cfg._name === 'staff') {
      soldData = allData
        .filter(item => item.狀態 === '成交')
        .map(i => ({ ...i, 建物型態: i.建物型態?.trim() }));
    }

    const rawData = allData.filter(item => {
      if (item.狀態 === '停賣' || item.狀態 === '成交') return false;
      if (df.excludeDevNames.includes(String(item.開發 || '').trim())) return false;
      if (df.excludeTypes.length && df.excludeTypes.includes(item.類型)) return false;
      if (df.onlyDev.length && !df.onlyDev.includes(item.開發)) return false;
      //if (cfg._name === 'client' && !item.圖片) return false;
      return true;
    }).map(i => ({ ...i, 建物型態: i.建物型態?.trim() }));

    return { rawData, soldData };
  }

  // ── Vue data mixin ───────────────────────
  const vueDataMixin = {
    rawData:     [],
    soldData:    [],
    expandedIds: [],
    sortKey:     'price_desc',

    // ── 委託到期警告天數（可調整）
    expireWarningDays: 30,

    // ── 特殊篩選：'' | 'expiring' | 'sold'
    specialFilter: '',
  };

  // ── Vue computed mixin ───────────────────
  const vueComputedMixin = {

    /** 展開列的 colspan（依模式動態計算） */
    colSpan() {
      const c = this.modeConfig.columns;
      let n = 8; // 固定欄數
      if (c.dev)       n++;
      if (c.landPing)  n++;
      if (c.usage)     n++;
      if (c.direction) n++;
      return n;
    },

    // ── 篩選選項（動態從資料推導）
    cityOptions()      { return [...new Set(this.rawData.map(i => String(i.縣市 || '').trim()))].filter(Boolean).sort(); },
    areaOptions()      { return [...new Set(this.rawData.map(i => String(i.分區 || '').trim()))].filter(Boolean).sort(); },
    villageOptions()   { return [...new Set(this.rawData.map(i => String(i.村里 || '').trim()))].filter(Boolean).sort(); },
    roomOptions()      { return [...new Set(this.rawData.map(i => i.房間數量).filter(Boolean))].sort((a, b) => a - b); },
    directionOptions() { return [...new Set(this.rawData.map(i => i.座向).filter(Boolean))].sort(); },
    usageOptions()     { return [...new Set(this.rawData.map(i => i.使用分區).filter(Boolean))]; },
    buildTypeOptions() { return [...new Set(this.rawData.map(i => i.建物型態?.trim()).filter(Boolean))]; },

    // ── 主過濾 + 排序
    filteredData() {
      // specialFilter='sold' 時走已售資料
      const pool = this.specialFilter === 'sold' ? this.soldData : this.rawData;

      let data = pool.filter(item => {
        const f = this.filters;

        // 關鍵字
        if (f.keyword) {
          const kw   = f.keyword.toLowerCase();
          const text = `${item.案名} ${item.分區} ${item.地段}`.toLowerCase();
          if (!text.includes(kw)) return false;
        }
        // specialFilter='expiring' 時只保留即將到期（不再疊加其他 filter）
        if (this.specialFilter === 'expiring') {
          const d = this.contractDaysLeft(item);
          return d !== null && d <= this.expireWarningDays;
        }
        // 快速 tag
        if (f.quickKey && item[f.quickKey] !== f.quickValue) return false;

        // 勾選篩選
        if (f.rooms.length       && !f.rooms.includes(item.房間數量))            return false;
        if (f.directions.length  && !f.directions.includes(item.座向))           return false;
        if (f.usages.length      && !f.usages.includes(item.使用分區))           return false;
        if (f.citys.length       && !f.citys.includes(item.縣市))                return false;
        if (f.areas.length       && !f.areas.includes(item.分區))                return false;
        if (f.villages.length    && !f.villages.includes(item.村里))             return false;
        if (f.buildTypes.length  && !f.buildTypes.includes(item.建物型態?.trim())) return false;

        // 總價
        if (f.priceMin !== null && item.委託價 < f.priceMin) return false;
        if (f.priceMax !== null && item.委託價 > f.priceMax) return false;

        // 單價
        const up = item.總坪數
          ? item.委託價 / item.總坪數
          : (item.土地坪數 ? item.委託價 / item.土地坪數 : null);
        if (up !== null) {
          if (f.unitPriceMin !== null && up < f.unitPriceMin) return false;
          if (f.unitPriceMax !== null && up > f.unitPriceMax) return false;
        }

        // 坪數
        if (f.pingMin !== null && item.總坪數 < f.pingMin) return false;
        if (f.pingMax !== null && item.總坪數 > f.pingMax) return false;
        if (f.interiorPingMin !== null && item.室內坪數 < f.interiorPingMin) return false;
        if (f.interiorPingMax !== null && item.室內坪數 > f.interiorPingMax) return false;
        if (f.landMin !== null && item.土地坪數 < f.landMin) return false;
        if (f.landMax !== null && item.土地坪數 > f.landMax) return false;

        // 車位數量
        const carCount = (item.有無車位 === '有') ? (item.車位數量 || 0) : 0;
        if (f.parkingMin !== null && carCount < f.parkingMin) return false;
        if (f.parkingMax !== null && carCount > f.parkingMax) return false;
        if (f.agesMin !== null && item.屋齡 < f.agesMin) return false;
        if (f.agesMax !== null && item.屋齡 > f.agesMax) return false;

        return true;
      });

      data.sort((a, b) => {
        switch (this.sortKey) {
          case 'price_desc':       return b.委託價 - a.委託價;
          case 'price_asc':        return a.委託價 - b.委託價;
          case 'unit_price_desc':  return (b.委託價 / (b.總坪數 || b.土地坪數 || 1)) - (a.委託價 / (a.總坪數 || a.土地坪數 || 1));
          case 'unit_price_asc':   return (a.委託價 / (a.總坪數 || a.土地坪數 || 1)) - (b.委託價 / (b.總坪數 || b.土地坪數 || 1));
          case 'ping_desc':        return (b.總坪數  || 0) - (a.總坪數  || 0);
          case 'ping_asc':         return (a.總坪數  || 0) - (b.總坪數  || 0);
          case 'land_desc':        return (b.土地坪數 || 0) - (a.土地坪數 || 0);
          case 'land_asc':         return (a.土地坪數 || 0) - (b.土地坪數 || 0);
          case 'id_desc':          return (b.id || 0) - (a.id || 0);
          case 'id_asc':           return (a.id || 0) - (b.id || 0);
        }
        return 0;
      });
      return data;
    },

    // ── 統計
    totalPrice() {
      if (!this.filteredData.length) return 0;
      return Math.round(this.filteredData.reduce((s, i) => s + i.委託價, 0));
    },
    maxPerformance() {
      if (!this.filteredData.length) return 0;
      return Math.round(this.filteredData.reduce((s, i) => s + i.委託價, 0) * 0.06);
    },
    averagePrice() {
      if (!this.filteredData.length) return 0;
      return Math.round(this.filteredData.reduce((s, i) => s + i.委託價, 0) / this.filteredData.length);
    },
    medianPrice() {
      if (!this.filteredData.length) return 0;
      const prices = [...this.filteredData].map(i => i.委託價).sort((a, b) => a - b);
      const mid = Math.floor(prices.length / 2);
      return prices.length % 2 !== 0
        ? prices[mid]
        : Math.round((prices[mid - 1] + prices[mid]) / 2);
    },

    // ── 快到期筆數（從 rawData 算，不受 specialFilter 影響）
    expiringSoonCount() {
      return this.rawData.filter(i => {
        const d = this.contractDaysLeft(i);
        return d !== null && d <= this.expireWarningDays;
      }).length;
    },
  };

  // ── Vue methods mixin ────────────────────
  const vueMethodsMixin = {
    // ── 單價計算（新格式若已提供「委託單價」直接採用，否則自行換算）──
    unitPrice(item) {
      if (item.委託單價) return Number(item.委託單價).toFixed(2);
      if (!item.總坪數) {
        if (!item.土地坪數) return '-';
        return (item.委託價 / item.土地坪數).toFixed(2);
      }
      return (item.委託價 / item.總坪數).toFixed(2);
    },

    /**
     * ╔══════════════════════════════════════════╗
     * ║  新／舊資料格式相容輔助函式                ║
     * ╚══════════════════════════════════════════╝
     * 舊格式（demo_output.json）：行銷文案欄位直接放在物件最外層
     *   受眾分析 / 賣點 / 地段優勢 / 社區介紹 / 生活機能 / 未來發展 /
     *   收藏理由 / 產品定位 / 核心賣點 ... 皆為頂層 key
     *
     * 新格式（貼上版本）：行銷情報改放在巢狀的 摘要 / 新聞 物件內
     *   item.摘要.產品定位 / item.摘要.客群分析 / item.摘要.核心賣點 /
     *   item.摘要.風險提醒 / item.摘要.行銷洞察 / item.摘要.短影音策略 ...
     *   item.新聞.生活機能 / item.新聞.未來建設 / item.新聞.買方搜尋關鍵字 ...
     *   item.機能 也可能是分類物件 { 學區, 公園, 市場, 醫療, 商圈 } 而非陣列
     *
     * 以下方法統一「先看頂層舊欄位，沒有再看新版巢狀欄位」，
     * 畫面（index.html）只呼叫這些方法，不需理會資料來源版本差異。
     */

    // 物件轉成 [key, value] 陣列，過濾掉空值
    objEntries(obj) {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
      return Object.entries(obj).filter(([, v]) => {
        if (v === null || v === undefined || v === '') return false;
        if (Array.isArray(v) && v.length === 0) return false;
        return true;
      });
    },
    // 值轉成顯示文字（陣列以「、」串接）
    valText(v) { return Array.isArray(v) ? v.join('、') : v; },
    // 確保回傳陣列（單一字串也包成陣列；無資料回傳空陣列）
    asList(v) {
      if (Array.isArray(v)) return v;
      if (v) return [v];
      return [];
    },

    // 🎯 產品定位（物件）：頂層 item.產品定位 → item.摘要.產品定位
    positioningEntries(item) {
      return this.objEntries(item.產品定位 || item.摘要?.產品定位);
    },
    // 💡 核心賣點（物件，新舊結構共同欄位：第一/二/三賣點、一句話定位）
    coreSellingPoint(item) {
      return item.核心賣點 || item.摘要?.核心賣點 || null;
    },
    // 👥 客群輪廓：頂層 item.受眾分析（label→一句話） → item.摘要.客群分析（label→陣列）
    audienceEntries(item) {
      return this.objEntries(item.受眾分析 || item.摘要?.客群分析);
    },
    // 📍 地段優勢 / 🏘 社區介紹 / 🔮 未來發展（純陣列，新格式對應放在 新聞.未來建設）
    locationAdvantage(item) { return this.asList(item.地段優勢); },
    communityIntro(item)    { return this.asList(item.社區介紹); },
    futureDev(item)         { return this.asList(item.未來發展 || item.新聞?.未來建設); },
    // ✨ 生活機能（長文版）：頂層 item.生活機能 → item.新聞.生活機能
    lifeFunctionProse(item) { return this.asList(item.生活機能 || item.新聞?.生活機能); },
    // 💎 收藏理由 / 賣點（短標籤陣列，僅舊格式有）
    collectReasons(item) { return this.asList(item.收藏理由); },
    sellPoints(item)      { return this.asList(item.賣點); },

    // 🏙 機能分類延伸標籤（新格式 item.機能 可能是 { 學區,公園,市場,醫療,商圈 } 物件）
    functionTags(item, category) {
      const f = item.機能;
      if (f && typeof f === 'object' && !Array.isArray(f)) return this.asList(f[category]);
      return [];
    },

    // ── 行情比較（委託開價 vs 實登成交 vs 社區近一年行情，新格式才有）
    hasPriceCompare(item) {
      return !!(item.實登總價 || item.社區一年單價均值 || item.委託單價 || item.社區一年總價均值);
    },
    // 開價與實登 / 社區均價的價差百分比（正值＝高於基準）
    pctDiff(base, ref) {
      if (!base || !ref) return null;
      return Math.round(((base - ref) / ref) * 100);
    },

    // ⚠️ 風險提醒（僅新格式 item.摘要.風險提醒）
    riskNotes(item) { return this.asList(item.摘要?.風險提醒); },
    // 📊 行銷洞察（市場判讀 / 成交邏輯 / 溝通重點）
    marketingInsight(item) { return item.摘要?.行銷洞察 || null; },
    // 🎬 封面策略／短影音策略／拍攝重點（僅新格式）
    coverStrategy(item)      { return item.摘要?.封面策略 || null; },
    shortVideoStrategy(item) { return item.摘要?.短影音策略 || null; },
    photoPoints(item)        { return this.asList(item.摘要?.照片重點); },
    mustShots(item)          { return this.asList(item.摘要?.['關鍵鏡頭（必留）']); },
    // 🔑 買方搜尋關鍵字（僅新格式 item.新聞.買方搜尋關鍵字）
    searchKeywords(item) { return this.asList(item.新聞?.買方搜尋關鍵字); },

    // ── 車位類別縮寫（顯示用），例如 坡道平面 → 坡平
    parkingTypeShort(t) {
      const map = {
        '坡道平面': '坡平', '坡道機械': '坡機',
        '升降平面': '升平', '升降機械': '升機',
        '機械式':   '機械', '平面式':   '平面',
      };
      return map[t] || t || '車位';
    },

    // ── 格局欄第二行：車位資訊（無車位則回傳空字串，不顯示）
    parkingLabel(item) {
      if (item.有無車位 !== '有' || !item.車位數量) return '';
      return `${this.parkingTypeShort(item.車位類別)}*${item.車位數量}`;
    },

    // ── 展開 / 收合詳細列 ─────────
    toggleExpand(id) {
      const idx = this.expandedIds.indexOf(id);
      if (idx >= 0) {
        this.expandedIds.splice(idx, 1);
      } else {
        this.expandedIds.push(id);
        const item = this.rawData.find(i => i.id === id);
        if (item) window.GA?.expandCase(item, this.modeConfig._name);
      }
    },

    // ── 委託剩餘天數（null = 無資料）
    contractDaysLeft(item) {
      if (!item.委託末) return null;
      const raw = String(item.委託末).trim().replace(/\//g, '-');
      const end = new Date(raw);
      if (isNaN(end)) return null;
      end.setHours(23, 59, 59, 0);
      const now = new Date();
      return Math.ceil((end - now) / 86400000);
    },

    // ── 委託狀態標籤（文字 + CSS class）
    contractStatus(item) {
      const d = this.contractDaysLeft(item);
      if (d === null) return null;
      if (d < 0)   return { label: '已到期',  cls: 'contract-expired', days: d };
      if (d === 0) return { label: '今日到期', cls: 'contract-today',   days: d };
      if (d <= this.expireWarningDays) return { label: `剩 ${d} 天`, cls: 'contract-warning', days: d };
      return { label: `剩 ${d} 天`, cls: 'contract-ok', days: d };
    },

    // ── 特殊篩選切換（再按同一個就取消）
    setSpecialFilter(val) {
      this.specialFilter = this.specialFilter === val ? '' : val;
      this.expandedIds = [];
    },
  };

  // ── 暴露 ─────────────────────────────────
  window.YangData = {
    loadData,
    vueDataMixin,
    vueComputedMixin,
    vueMethodsMixin,
  };

})();
