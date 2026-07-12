/**
 * ╔══════════════════════════════════════════╗
 * ║     小楊房屋系統 — Vue 應用模組            ║
 * ╚══════════════════════════════════════════╝
 *
 * 負責：
 *   - Vue 3 createApp：組合各模組的 data／computed／watch／methods mixin
 *   - mounted：呼叫 YangData.loadData() 取得 rawData / soldData，
 *     以及 PoiMethods.loadPoiConfig() 取得圖層清單設定（poi/poi-config.json）
 *   - 混入 MapMethods（app-map.js）、PoiMethods（poi.js）、
 *     YangData（data.js）、YangFilters（filters.js）
 *
 * 本檔本身不再放任何篩選/資料邏輯 —— 那些都搬到 data.js / filters.js / poi.js。
 * app-vue.js 只負責「組裝」與 UI 專屬的少量狀態（view、sidebarOpen、地圖內部狀態）。
 *
 * 依賴（載入順序）：
 *   Vue 3 → Leaflet → config.js → app-init.js → app-map.js → poi.js
 *   → data.js → filters.js → 本檔
 *
 * 全域變數（由依賴模組提供）：
 *   - modeConfig, orgHashKey, buildCryptoKey, decryptData（app-init.js）
 *   - MapMethods（app-map.js）、PoiMethods（poi.js）
 *   - YangData（data.js）、YangFilters（filters.js）
 */

const { createApp, nextTick } = Vue;

createApp({
  // ══════════════════════════════
  //  data
  // ══════════════════════════════
  data() {
    return {
      // UI 專屬狀態（注意：MapMethods／PoiMethods 都只是「純方法物件」，
      // 不含任何 data，以下欄位一定要在這裡宣告，少了任何一個畫面就會整個空白）
      view:          'table',
      selectedMapId: null,
      modeConfig,
      sidebarOpen:   false,

      // 地圖內部狀態（由 app-map.js methods 操作）
      _map:         null,
      _markerGroup: null,
      _markerMap:   {},

      // 案件物件顯示模式（配合 app-map.js renderMarkers 用）
      mapObjectMode:   'all',
      mapSingleItemId: null,

      // 圖層（POI）狀態（由 poi.js methods 操作）
      poiConfig:     [],
      poiChecked:    {},
      poiLayerCache: {},
      poiLoading:    {},

      // 國土測繪查詢快取（key = item.id，value = fetchNlscInfo 回傳結果）
      nlscCache:   {},
      nlscLoading: {}, // { [item.id]: true/false }

      // 資料 / 篩選狀態
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
  //  methods（混入 MapMethods + PoiMethods + YangData + YangFilters）
  // ══════════════════════════════
  methods: {
    ...MapMethods,
    ...PoiMethods,
    ...NlscMethods,
    ...YangData.vueMethodsMixin,
    ...YangFilters.vueMethodsMixin,

    // ── 國土測繪查詢（staff 詳細面板按鈕觸發）─────────────────────────
    async queryNlsc(item) {
      if (this.nlscLoading[item.id]) return;          // 防重複點擊
      if (this.nlscCache[item.id]) return;            // 已有快取直接顯示
      this.nlscLoading = { ...this.nlscLoading, [item.id]: true };
      const result = await this.fetchNlscInfo(item);
      this.nlscCache   = { ...this.nlscCache,   [item.id]: result };
      this.nlscLoading = { ...this.nlscLoading, [item.id]: false };
    },
  },

  // ══════════════════════════════
  //  mounted：載入加密資料 + 圖層設定
  // ══════════════════════════════
  async mounted() {
    window.__vueApp__ = this;

    // 圖層設定檔很小（只是清單 metadata，不含實際座標資料），跟主資料平行載入，
    // 失敗也不影響案件資料顯示（loadPoiConfig 內部已經 try/catch 過）。
    this.loadPoiConfig();

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
