/**
 * ╔══════════════════════════════════════════╗
 * ║     小楊房屋系統 — Vue 應用模組            ║
 * ╚══════════════════════════════════════════╝
 *
 * 負責：
 *   - Vue 3 createApp：組合各模組的 data／computed／watch／methods mixin
 *   - mounted：呼叫 YangData.loadData() 取得 rawData / soldData
 *   - 混入 MapMethods（app-map.js）、YangData（data.js）、YangFilters（filters.js）
 *
 * 本檔本身不再放任何篩選/資料邏輯 —— 那些都搬到 data.js / filters.js。
 * app-vue.js 只負責「組裝」與 UI 專屬的少量狀態（view、sidebarOpen、地圖內部狀態）。
 *
 * 依賴（載入順序）：
 *   Vue 3 → Leaflet → config.js → app-init.js → app-map.js → data.js → filters.js → 本檔
 *
 * 全域變數（由依賴模組提供）：
 *   - modeConfig, orgHashKey, buildCryptoKey, decryptData（app-init.js）
 *   - MapMethods（app-map.js）
 *   - YangData（data.js）、YangFilters（filters.js）
 */

const { createApp, nextTick } = Vue;

createApp({
  // ══════════════════════════════
  //  data
  // ══════════════════════════════
  data() {
    return {
      // UI 專屬狀態
      view:          'table',
      selectedMapId: null,
      modeConfig,
      sidebarOpen:   false,   // 手機版篩選面板（off-canvas drawer）開關

      // 地圖內部狀態（由 app-map.js methods 操作）
      _map:         null,
      _markerGroup: null,
      _markerMap:   {},

      // 資料 / 篩選狀態（來自模組）
      ...YangData.vueDataMixin,
      ...YangFilters.vueDataMixin,
    };
  },

  // ══════════════════════════════
  //  computed（來自 data.js）
  // ══════════════════════════════
  computed: {
    ...YangData.vueComputedMixin,
  },

  // ══════════════════════════════
  //  watch
  // ══════════════════════════════
  watch: {
    filteredData() {
      if (this.view === 'map' && this._map) this.renderMarkers(true);
    },
    ...YangFilters.vueWatchMixin,
  },

  // ══════════════════════════════
  //  methods（混入 MapMethods + YangData + YangFilters）
  // ══════════════════════════════
  methods: {
    ...MapMethods,
    ...YangData.vueMethodsMixin,
    ...YangFilters.vueMethodsMixin,
  },

  // ══════════════════════════════
  //  mounted：載入加密資料
  // ══════════════════════════════
  async mounted() {
    window.__vueApp__ = this;

    try {
      const { rawData, soldData } = await YangData.loadData(modeConfig);
      this.rawData  = rawData;
      this.soldData = soldData;
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
