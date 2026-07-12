/**
 * ╔══════════════════════════════════════════╗
 * ║     小楊房屋系統 — 圖層（POI）模組         ║
 * ╚══════════════════════════════════════════╝
 *
 * 職責：
 *   - 讀取 poi/poi-config.json（圖層清單設定檔），動態長出「大分類 → 小分類（類型）」
 *     的勾選樹狀結構，新增圖層只需要：① 在 poi-config.json 加一筆設定
 *     ② 把對應的 .json 資料檔放進 poi/ 目錄 —— 完全不需要改程式碼。
 *   - 每個「類型」（小分類）對應一個獨立的 Leaflet MarkerClusterGroup，
 *     第一次勾選時才會 fetch 對應的 .json（懶載入），載入後快取起來，
 *     之後勾掉/勾上只是 addLayer/removeLayer，不會重新 fetch、不會重新建立。
 *   - 大分類勾選框是「全選 / 全不選」的捷徑：勾大分類 = 把底下小分類全部勾上，
 *     再勾一次 = 全部取消（不是真的有一個「大分類」圖層，純粹是 UI 操作捷徑）。
 *
 * 資料格式（每個 poi/*.json 都是陣列）：
 *   [{ 大分類, 類型, 名稱, 地址, 經度, 緯度, 其它 }, ...]
 *
 * 效能考量：
 *   - 懶載入：沒勾選的圖層完全不會被下載，避免一開始就載入大量資料。
 *   - 每個圖層各自 clustering（MarkerClusterGroup + chunkedLoading:true），
 *     即使單一圖層資料量大（例如全國超商），加入畫面時也會分批處理、不卡住主執行緒。
 *   - 圖示固定大小（不像案件 marker 是依文字長度動態決定寬度），結構單純、
 *     縮放時的座標換算不會有先前案件 marker 那種「非固定尺寸 icon」的問題。
 */

const PoiMethods = {

  // ── 設定檔載入（一開始就載入，檔案很小，只是清單metadata，不含實際座標資料） ──
  async loadPoiConfig() {
    try {
      const resp = await fetch('poi/poi-config.json', { cache: 'no-cache' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const list = await resp.json();
      this.poiConfig = Array.isArray(list) ? list : [];
      this.poiConfig.forEach(cfg => {
        if (!(cfg.類型 in this.poiChecked)) this.poiChecked[cfg.類型] = false;
      });
    } catch (err) {
      console.warn('[POI] 圖層設定檔載入失敗（不影響案件資料）：', err.message);
      this.poiConfig = [];
    }
  },

  // ── 依「大分類」分組（給勾選樹 UI 用） ──
  poiGrouped() {
    const out = {};
    this.poiConfig.forEach(cfg => {
      if (!out[cfg.分類]) out[cfg.分類] = [];
      out[cfg.分類].push(cfg);
    });
    return out;
  },

  // ── 大分類目前的勾選狀態：'all' | 'none' | 'partial' ──
  poiCategoryState(cat) {
    const items = this.poiGrouped()[cat] || [];
    if (!items.length) return 'none';
    const n = items.filter(i => this.poiChecked[i.類型]).length;
    if (n === 0) return 'none';
    if (n === items.length) return 'all';
    return 'partial';
  },

  // ── 點大分類：目前全選 → 全部取消；否則（全不選或部分選）→ 全部勾上 ──
  async togglePoiCategory(cat) {
    const items = this.poiGrouped()[cat] || [];
    const turnOn = this.poiCategoryState(cat) !== 'all';
    await Promise.all(
      items
        .filter(item => !!this.poiChecked[item.類型] !== turnOn)
        .map(item => this.togglePoiType(item.類型))
    );
  },

  // ── 點小分類（類型）：切換單一圖層開關 ──
  async togglePoiType(type) {
    const cfg = this.poiConfig.find(c => c.類型 === type);
    if (!cfg) return;
    const next = !this.poiChecked[type];
    this.poiChecked[type] = next; // 先讓 checkbox UI 立刻反應

    if (next) {
      await this.ensurePoiLayer(cfg);
      if (this._map && this.poiLayerCache[type]) this._map.addLayer(this.poiLayerCache[type]);
    } else if (this._map && this.poiLayerCache[type]) {
      this._map.removeLayer(this.poiLayerCache[type]);
    }
  },

  // ── 懶載入＋建立指定圖層的 MarkerClusterGroup（建立過就直接重用，不重新 fetch） ──
  async ensurePoiLayer(cfg) {
    if (this.poiLayerCache[cfg.類型]) return; // 已經建立過
    this.poiLoading[cfg.類型] = true;
    try {
      const resp = await fetch(`poi/${cfg.資料}`, { cache: 'no-cache' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const list = await resp.json();

      const group = L.markerClusterGroup({
        maxClusterRadius: 60,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        chunkedLoading: true,       // 資料量大時分批加入，避免一次性卡住主執行緒
        disableClusteringAtZoom: 18,
        iconCreateFunction: (cluster) => L.divIcon({
          html: `<div class="poi-cluster-badge">${cfg.emoji}<span class="poi-cluster-num">${cluster.getChildCount()}</span></div>`,
          className: '',
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        }),
      });

      (Array.isArray(list) ? list : []).forEach(poi => {
        const lat = Number(poi.緯度), lng = Number(poi.經度);
        if (!lat || !lng) return; // 缺座標的資料直接跳過，不讓壞資料中斷整個圖層
        const marker = L.marker([lat, lng], {
          icon: L.divIcon({
            html: `<div class="poi-pin">${cfg.emoji}</div>`,
            className: '',
            iconSize: [28, 28],
            iconAnchor: [14, 26],
          }),
        });
        marker.bindPopup(`
          <div class="popup-inner poi-popup">
            <div class="popup-name">${cfg.emoji} ${poi.名稱 || cfg.類型}</div>
            ${poi.地址 ? `<div class="poi-popup-addr">📍 ${poi.地址}</div>` : ''}
            ${poi.其它 ? `<div class="poi-popup-note">${poi.其它}</div>` : ''}
          </div>`, { maxWidth: 260 });
        group.addLayer(marker);
      });

      this.poiLayerCache[cfg.類型] = group;
    } catch (err) {
      console.error(`[POI] 圖層「${cfg.類型}」載入失敗：`, err);
      alert(`圖層「${cfg.類型}」載入失敗：${err.message}`);
      this.poiChecked[cfg.類型] = false; // 載入失敗，checkbox 退回未勾選狀態
    } finally {
      this.poiLoading[cfg.類型] = false;
    }
  },

  // ── 切換到地圖 view 時呼叫：把目前已勾選、且已快取的圖層重新貼回新的地圖實例 ──
  // （因為 switchView 離開地圖時會整個銷毀 Leaflet map instance，圖層 group 物件
  //   本身還在記憶體裡，只是沒有附著在任何地圖上，回到地圖時要重新 addLayer 一次）
  syncPoiLayers() {
    if (!this._map) return;
    Object.entries(this.poiLayerCache).forEach(([type, group]) => {
      if (this.poiChecked[type]) this._map.addLayer(group);
    });
  },
};

// app-vue.js 用 ...PoiMethods 混入，必須掛到 window 才能跨 <script> 標籤存取
window.PoiMethods = PoiMethods;
