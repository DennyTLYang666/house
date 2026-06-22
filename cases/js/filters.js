/**
 * ╔══════════════════════════════════════════╗
 * ║        filters.js — 篩選器模組            ║
 * ╚══════════════════════════════════════════╝
 *
 * 職責：
 *   - filters 初始狀態
 *   - quickType()、resetFilters()
 *   - GA 搜尋防抖 watch
 *
 * 依賴：auth.js（window.modeConfig）
 * 輸出：window.YangFilters（{ vueDataMixin, vueMethodsMixin, vueWatchMixin }）
 */

(function () {
  'use strict';

  // ── Vue data mixin ───────────────────────
  const vueDataMixin = {
    filters: {
      keyword:      '',
      citys:        [],
      areas:        [],
      villages:     [],
      rooms:        [],
      directions:   [],
      usages:       [],
      quickKey:     '',
      quickValue:   '',
      buildTypes:   [],
      priceMin:     null,
      priceMax:     null,
      unitPriceMin: null,
      unitPriceMax: null,
      pingMin:      null,
      pingMax:      null,
      interiorPingMin:      null,
      interiorPingMax:      null,
      landMin:      null,
      landMax:      null,
      parkingMin:   null,
      parkingMax:   null,
    },
  };

  // ── Vue methods mixin ────────────────────
  const vueMethodsMixin = {
    quickType(value, key) {
      if (this.filters.quickKey === key && this.filters.quickValue === value) {
        this.filters.quickKey   = '';
        this.filters.quickValue = '';
      } else {
        this.filters.quickKey   = key;
        this.filters.quickValue = value;
        window.GA?.quickTag(value, this.modeConfig._name);
      }
    },

    resetFilters() {
      this.filters = {
        keyword: '', citys: [], areas: [], villages: [],
        rooms: [], directions: [], usages: [],
        quickKey: '', quickValue: '', buildTypes: [],
        priceMin: null, priceMax: null,
        unitPriceMin: null, unitPriceMax: null,
        pingMin: null, pingMax: null,
        interiorPingMin: null, interiorPingMax: null,
        landMin: null, landMax: null,
        parkingMin: null, parkingMax: null,
      };
    },
  };

  // ── Vue watch mixin ──────────────────────
  // 搜尋關鍵字：防抖 800ms 後送 GA
  const vueWatchMixin = {
    'filters.keyword': (function () {
      let timer;
      return function (val) {
        clearTimeout(timer);
        timer = setTimeout(() => window.GA?.search(val, this.modeConfig._name), 800);
      };
    })(),
  };

  // ── 暴露 ─────────────────────────────────
  window.YangFilters = {
    vueDataMixin,
    vueMethodsMixin,
    vueWatchMixin,
  };

})();