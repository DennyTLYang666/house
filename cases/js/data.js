/**
 * ╔══════════════════════════════════════════╗
 * ║         data.js — 資料邏輯模組            ║
 * ╚══════════════════════════════════════════╝
 *
 * 職責：
 *   - fetch + 解密 .enc 檔
 *   - 套用 dataFilter（排除 dev、onlyDev、停賣/成交）
 *   - 提供 Vue computed：filteredData、排序、統計
 *   - 提供 unitPrice() helper
 *
 * 依賴：auth.js（window.modeConfig、window.decryptData、window._buildCryptoKey、window._orgHashKey）
 * 輸出：window.YangData（{ loadData, vueDataMixin, vueComputedMixin, vueMethodsMixin }）
 */

(function () {
  'use strict';

  // ── 資料載入 ─────────────────────────────
  /**
   * 從 modeConfig.dataFile 取回並解密資料
   * @returns {Promise<Array>} rawData 陣列
   */
  async function loadData() {
    const resp = await fetch(window.modeConfig.dataFile, { cache: 'no-cache' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const buf = await resp.arrayBuffer();

    const allData = await window.decryptData(buf, window._buildCryptoKey(window._orgHashKey));

    // 套用模式過濾
    const df = window.modeConfig.dataFilter;
    return allData.filter(item => {
      if (item.狀態 === '停賣' || item.狀態 === '成交') return false;
      if (df.excludeDevNames.includes(String(item.開發 || '').trim())) return false;
      if (df.excludeTypes.length && df.excludeTypes.includes(item.類型)) return false;
      if (df.onlyDev.length && !df.onlyDev.includes(item.開發)) return false;
      return true;
    }).map(i => ({ ...i, 建物型態: i.建物型態?.trim() }));
  }

  // ── Vue data mixin ───────────────────────
  const vueDataMixin = {
    rawData:     [],
    expandedIds: [],
    sortKey:     'price_desc',
  };

  // ── Vue computed mixin ───────────────────
  const vueComputedMixin = {

    colSpan() {
      const c = this.modeConfig.columns;
      let n = 8;
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
      let data = this.rawData.filter(item => {
        const f = this.filters;
        if (f.keyword) {
          const kw   = f.keyword.toLowerCase();
          const text = `${item.案名} ${item.分區} ${item.地段}`.toLowerCase();
          if (!text.includes(kw)) return false;
        }
        if (f.rooms.length       && !f.rooms.includes(item.房間數量))          return false;
        if (f.directions.length  && !f.directions.includes(item.座向))          return false;
        if (f.usages.length      && !f.usages.includes(item.使用分區))          return false;
        if (f.quickKey           && item[f.quickKey] !== f.quickValue)           return false;
        if (f.citys.length       && !f.citys.includes(item.縣市))               return false;
        if (f.areas.length       && !f.areas.includes(item.分區))               return false;
        if (f.villages.length    && !f.villages.includes(item.村里))             return false;
        if (f.buildTypes.length  && !f.buildTypes.includes(item.建物型態?.trim())) return false;
        if (f.priceMin    !== null && item.委託價 < f.priceMin)     return false;
        if (f.priceMax    !== null && item.委託價 > f.priceMax)     return false;
        const up = item.總坪數
          ? item.委託價 / item.總坪數
          : (item.土地坪數 ? item.委託價 / item.土地坪數 : null);
        if (up !== null) {
          if (f.unitPriceMin !== null && up < f.unitPriceMin) return false;
          if (f.unitPriceMax !== null && up > f.unitPriceMax) return false;
        }
        if (f.pingMin !== null && item.總坪數    < f.pingMin) return false;
        if (f.pingMax !== null && item.總坪數    > f.pingMax) return false;
        if (f.landMin !== null && item.土地坪數  < f.landMin) return false;
        if (f.landMax !== null && item.土地坪數  > f.landMax) return false;
        return true;
      });

      data.sort((a, b) => {
        switch (this.sortKey) {
          case 'price_desc':       return b.委託價 - a.委託價;
          case 'price_asc':        return a.委託價 - b.委託價;
          case 'unit_price_desc':  return (b.委託價 / (b.總坪數 || b.土地坪數 || 1)) - (a.委託價 / (a.總坪數 || a.土地坪數 || 1));
          case 'unit_price_asc':   return (a.委託價 / (a.總坪數 || a.土地坪數 || 1)) - (b.委託價 / (b.總坪數 || b.土地坪數 || 1));
          case 'ping_desc':        return (b.總坪數 || 0) - (a.總坪數 || 0);
          case 'ping_asc':         return (a.總坪數 || 0) - (b.總坪數 || 0);
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
  };

  // ── Vue methods mixin ────────────────────
  const vueMethodsMixin = {
    unitPrice(item) {
      if (!item.總坪數) {
        if (!item.土地坪數) return '-';
        return (item.委託價 / item.土地坪數).toFixed(2);
      }
      return (item.委託價 / item.總坪數).toFixed(2);
    },

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
  };

  // ── 暴露 ─────────────────────────────────
  window.YangData = {
    loadData,
    vueDataMixin,
    vueComputedMixin,
    vueMethodsMixin,
  };

})();