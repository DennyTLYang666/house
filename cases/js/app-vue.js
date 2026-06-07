/**
 * ╔══════════════════════════════════════════╗
 * ║     小楊房屋系統 — Vue 應用模組            ║
 * ╚══════════════════════════════════════════╝
 *
 * 負責：
 *   - Vue 3 createApp：data、computed、watch、methods
 *   - mounted：fetch 加密檔 → decryptData → rawData
 *   - 混入 MapMethods（來自 app-map.js）
 *
 * 依賴（載入順序）：
 *   Vue 3 → Leaflet → config.js → app-init.js → app-map.js → 本檔
 *
 * 全域變數（由依賴模組提供）：
 *   - modeConfig, orgHashKey, buildCryptoKey, decryptData（app-init.js）
 *   - MapMethods（app-map.js）
 */

const { createApp, nextTick } = Vue;

createApp({
  // ══════════════════════════════
  //  data
  // ══════════════════════════════
  data() {
    return {
      rawData:      [],
      expandedIds:  [],
      sortKey:      'price_desc',
      view:         'table',
      selectedMapId: null,
      modeConfig,

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
        landMin:      null,
        landMax:      null,
      },

      // 地圖內部狀態（由 app-map.js methods 操作）
      _map:         null,
      _markerGroup: null,
      _markerMap:   {},
    };
  },

  // ══════════════════════════════
  //  computed
  // ══════════════════════════════
  computed: {

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

    cityOptions()      { return [...new Set(this.rawData.map(i => String(i.縣市   || '').trim()))].filter(Boolean).sort(); },
    areaOptions()      { return [...new Set(this.rawData.map(i => String(i.分區   || '').trim()))].filter(Boolean).sort(); },
    villageOptions()   { return [...new Set(this.rawData.map(i => String(i.村里   || '').trim()))].filter(Boolean).sort(); },
    roomOptions()      { return [...new Set(this.rawData.map(i => i.房間數量).filter(Boolean))].sort((a, b) => a - b); },
    directionOptions() { return [...new Set(this.rawData.map(i => i.座向).filter(Boolean))].sort(); },
    usageOptions()     { return [...new Set(this.rawData.map(i => i.使用分區).filter(Boolean))]; },
    buildTypeOptions() { return [...new Set(this.rawData.map(i => i.建物型態?.trim()).filter(Boolean))]; },

    filteredData() {
      let data = this.rawData.filter(item => {
        // 關鍵字
        if (this.filters.keyword) {
          const kw   = this.filters.keyword.toLowerCase();
          const text = `${item.案名} ${item.分區} ${item.地段}`.toLowerCase();
          if (!text.includes(kw)) return false;
        }
        // 快速 tag
        if (this.filters.quickKey && item[this.filters.quickKey] !== this.filters.quickValue) return false;
        // 勾選篩選
        if (this.filters.rooms.length      && !this.filters.rooms.includes(item.房間數量))            return false;
        if (this.filters.directions.length && !this.filters.directions.includes(item.座向))           return false;
        if (this.filters.usages.length     && !this.filters.usages.includes(item.使用分區))           return false;
        if (this.filters.citys.length      && !this.filters.citys.includes(item.縣市))                return false;
        if (this.filters.areas.length      && !this.filters.areas.includes(item.分區))                return false;
        if (this.filters.villages.length   && !this.filters.villages.includes(item.村里))             return false;
        if (this.filters.buildTypes.length && !this.filters.buildTypes.includes(item.建物型態?.trim())) return false;
        // 價格範圍
        if (this.filters.priceMin !== null && item.委託價 < this.filters.priceMin) return false;
        if (this.filters.priceMax !== null && item.委託價 > this.filters.priceMax) return false;
        // 單價
        const up = item.總坪數
          ? item.委託價 / item.總坪數
          : (item.土地坪數 ? item.委託價 / item.土地坪數 : null);
        if (up !== null) {
          if (this.filters.unitPriceMin !== null && up < this.filters.unitPriceMin) return false;
          if (this.filters.unitPriceMax !== null && up > this.filters.unitPriceMax) return false;
        }
        // 坪數
        if (this.filters.pingMin !== null && item.總坪數    < this.filters.pingMin) return false;
        if (this.filters.pingMax !== null && item.總坪數    > this.filters.pingMax) return false;
        if (this.filters.landMin !== null && item.土地坪數  < this.filters.landMin) return false;
        if (this.filters.landMax !== null && item.土地坪數  > this.filters.landMax) return false;
        return true;
      });

      data.sort((a, b) => {
        switch (this.sortKey) {
          case 'price_desc':      return b.委託價 - a.委託價;
          case 'price_asc':       return a.委託價 - b.委託價;
          case 'unit_price_desc': return (b.委託價 / (b.總坪數 || b.土地坪數 || 1)) - (a.委託價 / (a.總坪數 || a.土地坪數 || 1));
          case 'unit_price_asc':  return (a.委託價 / (a.總坪數 || a.土地坪數 || 1)) - (b.委託價 / (b.總坪數 || b.土地坪數 || 1));
          case 'ping_desc':  return (b.總坪數  || 0) - (a.總坪數  || 0);
          case 'ping_asc':   return (a.總坪數  || 0) - (b.總坪數  || 0);
          case 'land_desc':  return (b.土地坪數 || 0) - (a.土地坪數 || 0);
          case 'land_asc':   return (a.土地坪數 || 0) - (b.土地坪數 || 0);
          case 'id_desc':    return (b.id || 0) - (a.id || 0);
          case 'id_asc':     return (a.id || 0) - (b.id || 0);
        }
        return 0;
      });
      return data;
    },

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
  },

  // ══════════════════════════════
  //  watch
  // ══════════════════════════════
  watch: {
    filteredData() {
      if (this.view === 'map' && this._map) this.renderMarkers(true);
    },
    'filters.keyword': (function () {
      let timer;
      return function (val) {
        clearTimeout(timer);
        timer = setTimeout(() => window.GA?.search(val, this.modeConfig._name), 800);
      };
    })(),
  },

  // ══════════════════════════════
  //  methods（混入 MapMethods）
  // ══════════════════════════════
  methods: {
    ...MapMethods,

    // ── 單價計算 ──────────────────
    unitPrice(item) {
      if (!item.總坪數) {
        if (!item.土地坪數) return '-';
        return (item.委託價 / item.土地坪數).toFixed(2);
      }
      return (item.委託價 / item.總坪數).toFixed(2);
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

    // ── 快速篩選 tag ──────────────
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

    // ── 清除所有篩選 ──────────────
    resetFilters() {
      this.filters = {
        keyword: '', citys: [], areas: [], villages: [], rooms: [], directions: [],
        usages: [], quickKey: '', quickValue: '', buildTypes: [],
        priceMin: null, priceMax: null, unitPriceMin: null, unitPriceMax: null,
        pingMin: null, pingMax: null, landMin: null, landMax: null,
      };
    },
  },

  // ══════════════════════════════
  //  mounted：載入加密資料
  // ══════════════════════════════
  async mounted() {
    window.__vueApp__ = this;

    try {
      const resp = await fetch(modeConfig.dataFile, { cache: 'no-cache' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const buf = await resp.arrayBuffer();

      const allData = await decryptData(buf, buildCryptoKey(orgHashKey));

      const df = modeConfig.dataFilter;
      this.rawData = allData.filter(item => {
        if (item.狀態 === '停賣' || item.狀態 === '成交') return false;
        if (df.excludeDevNames.includes(String(item.開發 || '').trim())) return false;
        if (df.excludeTypes.length && df.excludeTypes.includes(item.類型)) return false;
        if (df.onlyDev.length && !df.onlyDev.includes(item.開發)) return false;

        if (modeConfig._name === 'client' && !item.圖片) return false;
        return true;
      }).map(i => ({ ...i, 建物型態: i.建物型態?.trim() }));

    } catch (err) {
      console.error('資料載入失敗：', err);
      document.getElementById('app').innerHTML = `
        <div style="margin:auto;text-align:center;padding:60px;font-family:sans-serif;color:#666">
          <div style="font-size:48px;margin-bottom:16px">⚠️</div>
          <div style="font-size:18px;font-weight:700;color:#333;margin-bottom:8px">資料載入失敗</div>
          <div style="font-size:13px">${err.message}</div>
        </div>`;
    } finally {
      document.getElementById('loadingOverlay').style.display = 'none';
      // 通知 tools.js：Vue 已掛載完畢、topbar DOM 已就緒
      window.dispatchEvent(new CustomEvent('yang:mounted'));
    }
  },
}).mount('#app');
