/**
 * ╔══════════════════════════════════════════╗
 * ║     小楊房屋系統 — 地圖模組               ║
 * ╚══════════════════════════════════════════╝
 *
 * 提供給 Vue app（app-vue.js）使用的地圖相關 methods。
 * 透過 Object.assign(vueMethodsObj, MapMethods) 方式混入。
 *
 * 依賴：
 *   - Leaflet（L）
 *   - Leaflet.MarkerCluster
 *   - app-init.js 中的 modeConfig（window.GA）
 *
 * 載入順序（在 index.html）：
 *   config.js → app-init.js → app-map.js → app-vue.js
 */

const MapMethods = {

  // ── 顏色分級 ──────────────────
  priceColor(price) {
    if (price < 1000) return 'green';
    if (price < 3000) return 'blue';
    if (price < 8000) return 'orange';
    return 'red';
  },

  // ── 產生 Marker icon ──────────
  makeIcon(item, selected = false) {
    const col   = this.priceColor(item.委託價);
    const label = item.委託價 >= 10000
      ? (item.委託價 / 10000).toFixed(1) + '億'
      : item.委託價 + '萬';
    const selCls = selected ? ' selected' : '';
    const w = label.length > 5 ? label.length * 9 + 20 : 70;
    return L.divIcon({
      html: `<div class="pm pm-${col}${selCls}"><span class="pm-dot"></span>${label}</div>`,
      className: '',
      iconSize: [w, 26],
      iconAnchor: [w / 2, 31],
    });
  },

  // ── 初始化地圖 ────────────────
  initMap() {
    if (this._map) return;

    const map = L.map('map', {
      zoomControl: false,
      zoomAnimation: true,
      // markerZoomAnimation 維持 false（這是還原回去的設定，不要再改成 true）。
      // 之前曾試著改成 true 想讓 marker 跟著地圖縮放動畫一起平滑移動，
      // 但我們的 marker 是用「依價格文字長度動態決定寬度/錨點」的自訂 divIcon
      // （見 makeIcon() 的 w = label.length > 5 ? ... 、iconAnchor: [w/2, 31]）。
      // Leaflet 內建的 marker 縮放動畫（_animateZoom）對這種非標準、每顆 icon
      // 尺寸/錨點都不一樣的 divIcon 處理不穩，疊加 Leaflet.markercluster 自己
      // 在縮放時也會搬動/重建 marker DOM，兩邊的座標換算互相干擾，
      // 才會出現「縮小後本來分開的全部定位跑掉」的狀況。
      // 設為 false 後 marker 在縮放動畫期間直接隱藏、動畫結束才依新 zoom
      // 重新計算座標顯示，沒有中途換算的問題，定位穩定（也是效能較好的官方建議值）。
      markerZoomAnimation: false,
      preferCanvas: true,
    }).setView([24.97, 121.28], 11);

    // 底圖定義
    const baseLayers = {
      '🗺️ 街道圖': L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 20,
        }
      ),
      '🛩️ 航照圖': L.tileLayer(
        'https://wmts.nlsc.gov.tw/wmts/PHOTO2/default/GoogleMapsCompatible/{z}/{y}/{x}',
        {
          attribution: '© <a href="https://maps.nlsc.gov.tw/">內政部國土測繪中心</a>',
          maxZoom: 20,
        }
      ),
      '🗾️ 國土地圖': L.tileLayer(
        'https://wmts.nlsc.gov.tw/wmts/EMAP5/default/GoogleMapsCompatible/{z}/{y}/{x}',
        {
          attribution: '© <a href="https://maps.nlsc.gov.tw/">內政部國土測繪中心</a>',
          maxZoom: 20,
        }
      ),
      '🌍 地形圖': L.tileLayer(
        'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        {
          attribution: '© <a href="https://opentopomap.org/">OpenTopoMap</a>',
          subdomains: 'abc',
          maxZoom: 17,
        }
      ),
    };

    // 疊加圖層
    const overlayLayers = {
      '📐 地籍圖': L.tileLayer.wms('https://wms.nlsc.gov.tw/wms', {
        layers: 'LANDSECT',
        format: 'image/png',
        transparent: true,
        version: '1.1.1',
        opacity: 0.9,
        attribution: '© 內政部國土測繪中心',
      }),
    };

    baseLayers['🗺️ 街道圖'].addTo(map);
    L.control.layers(baseLayers, overlayLayers, { position: 'topright', collapsed: true }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // ── 地址搜尋框（Nominatim / OpenStreetMap 地理編碼，免申請、免金鑰） ──
    const searchBox = L.control({ position: 'topleft' });
    searchBox.onAdd = () => {
      const div = document.createElement('div');
      div.className = 'addr-search-box';
      div.innerHTML = `
        <input type="text" class="addr-search-input" placeholder="搜尋地址…" />
        <button class="addr-search-btn" title="搜尋地址">🔍</button>
      `;
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);
      const input = div.querySelector('input');
      const btn   = div.querySelector('button');
      this._addrSearchBtn = btn;
      const doSearch = () => this.searchAddress(input.value);
      btn.addEventListener('click', doSearch);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
      return div;
    };
    searchBox.addTo(map);

    // ── 定位按鈕 ──
    const locBtn = document.createElement('button');
    locBtn.className = 'locate-btn';
    locBtn.title = '定位到我的位置';
    locBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
      <circle cx="12" cy="12" r="4"/>
      <line x1="12" y1="2"  x2="12" y2="6"/>
      <line x1="12" y1="18" x2="12" y2="22"/>
      <line x1="2"  y1="12" x2="6"  y2="12"/>
      <line x1="18" y1="12" x2="22" y2="12"/>
    </svg>`;
    document.getElementById('map').appendChild(locBtn);
    L.DomEvent.on(locBtn, 'click', L.DomEvent.stopPropagation);
    L.DomEvent.on(locBtn, 'dblclick', L.DomEvent.stopPropagation);

    locBtn.addEventListener('click', () => {
      if (locBtn.classList.contains('locating')) return;
      locBtn.classList.add('locating');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          if (this._locateMarker) this._locateMarker.remove();
          this._locateMarker = L.circleMarker([lat, lng], {
            radius: 9, color: '#fff', weight: 3,
            fillColor: '#3b82f6', fillOpacity: 1,
          }).addTo(map).bindPopup('📍 你在這裡').openPopup();
          map.flyTo([lat, lng], 16, { animate: true, duration: 0.8 });
          locBtn.classList.remove('locating');
          locBtn.classList.add('located');
        },
        (err) => {
          locBtn.classList.remove('locating');
          alert('無法取得位置：' + (err.code === 1 ? '請允許定位權限' : err.message));
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

    /**
     * 額外發現的問題（用螢幕錄影逐格分析確認）：
     * 初始載入（zoom 11）時，桃園市區附近會穩定出現「兩個一模一樣寫著 35
     * 的紅色圓圈幾乎疊在一起」，而且不是動畫殘影 —— 連續看了 1.5 秒以上的
     * 多個畫面都還在，是真的同時存在兩個 cluster，不是看錯。
     *
     * 檢查過 renderMarkers() / initMap() 的程式碼，clearLayers() 跟 _map
     * 的 null 防呆都正確，邏輯上不應該重複疊加 marker。最可能的解釋是
     * Leaflet.markercluster 本身的已知限制：它是用「網格（grid）」分桶來做
         * 分群，不是真正計算「兩兩距離」，地理位置上明明很近的物件，如果剛好落在
     * 網格邊界的兩側，就會被分到兩個相鄰但獨立的 cluster，而不會合併成一個
     * ——這正好同時解釋你最早回報的「群組認定不對」跟「相近物件顯示不好」。
     *
     * 暫時的緩解作法：把 zoom<12 時的聚合半徑從 70 提高到 90，降低物件剛好
     * 落在網格邊界兩側的機率。這是治標、不是根治（網格演算法本身的限制無法
     * 完全避免），但應該能大幅減少這種「兩個圓疊在一起」的情況。
     *
     * 麻煩幫我驗證一下：兩個「35」圓圈，分別點下去，看 Leaflet 自動 zoom 進去
     * 之後，兩邊各自圈出來的 35 筆物件是「完全一樣」還是「不一樣但彼此緊鄰」？
     * - 如果兩邊資料一樣 → 是真的重複渲染 bug，我再往這個方向繼續查
     * - 如果兩邊資料不一樣（只是剛好都是 35 筆）→ 上面的網格邊界解釋成立，
     *   調高半徑這個方向就是對的，可以再依實際效果微調數字
     */
    const markerGroup = L.markerClusterGroup({
      maxClusterRadius: (zoom) => {
        if (zoom >= 16) return 1;
        if (zoom >= 14) return 20;
        if (zoom >= 13) return 35;
        if (zoom >= 12) return 55;
        return 90;
      },
      disableClusteringAtZoom: 16,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      animateAddingMarkers: false,
      removeOutsideVisibleBounds: false,
      iconCreateFunction: (cluster) => {
        const n = cluster.getChildCount();
        let cls = 'cb-sm';
        if (n >= 20) cls = 'cb-xl';
        else if (n >= 10) cls = 'cb-lg';
        else if (n >= 5) cls = 'cb-md';
        const size = n >= 20 ? 52 : 44;
        return L.divIcon({
          html: `<div class="cluster-badge ${cls}"><div class="cb-num">${n}</div><div class="cb-lbl">筆</div></div>`,
          className: '',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
      },
    });
    map.addLayer(markerGroup);

    /**
     * 回應「縮放時物件定位跑掉」的問題：用 Leaflet.markercluster 官方提供的
     * refreshClusters() —— 這是專門設計給「需要強制重新計算群組/位置」這個
     * 情境用的輕量 API，跟我們之前移除的「clearLayers() 整批重建」完全不同：
     * 它只是請套件「重新核對一次目前的群組計算結果」，不會把 marker 整批
     * 銷毀重新 new 一次，所以不會關掉使用者打開的 popup、也不會有重建的效能開銷。
     * 縮放或拖曳結束後呼叫一次，確保畫面跟實際計算結果同步。
     */
    map.on('zoomend moveend', () => {
      markerGroup.refreshClusters();
      Object.values(this.poiLayerCache || {}).forEach(g => g.refreshClusters());
    });

    this._map         = map;
    this._markerGroup = markerGroup;
    this._markerMap   = {};

    this.syncPoiLayers(); // 把已勾選、已快取的圖層重新貼回這個新建立的地圖實例
  },

  // ── 渲染所有 Marker ──────────
  renderMarkers(fitBounds = false) {
    if (!this._map) return;
    this._markerGroup.clearLayers();
    this._markerMap = {};

    // 案件物件顯示模式：all=全部（預設）／none=不顯示物件／single=只顯示指定一筆
    let source;
    if (this.mapObjectMode === 'none') {
      source = [];
    } else if (this.mapObjectMode === 'single') {
      const single = this.filteredData.find(i => i.id === this.mapSingleItemId)
                  || this.rawData.find(i => i.id === this.mapSingleItemId);
      source = single ? [single] : [];
    } else {
      source = this.filteredData;
    }
    const withGeo = source.filter(i => i.lat && i.lng);

    /**
     * 暫時的除錯檢查（成本很低，留著沒關係）：
     * 檢查來源資料本身是否有「重複 id」或「座標幾乎一樣但不同物件」的情況。
     * 如果地圖上看到不該重疊的群組，先看一下 console 有沒有印出這個警告，
     * 可以最快排除「是不是資料本身就重複/座標重疊」這個最簡單的可能性。
     */
    const idSeen = new Set();
    const coordKeySeen = new Map(); // coordKey -> [案名,...]
    withGeo.forEach(item => {
      if (idSeen.has(item.id)) {
        console.warn('[renderMarkers] 重複 id，同一筆資料被加入兩次：', item.id, item.案名);
      }
      idSeen.add(item.id);

      const coordKey = `${item.lat.toFixed(5)},${item.lng.toFixed(5)}`;
      if (!coordKeySeen.has(coordKey)) coordKeySeen.set(coordKey, []);
      coordKeySeen.get(coordKey).push(item.案名);
    });
    coordKeySeen.forEach((names, key) => {
      if (names.length > 1) {
        console.info(`[renderMarkers] 座標完全相同（${key}）的物件共 ${names.length} 筆：`, names);
      }
    });

    withGeo.forEach(item => {
      const marker = L.marker([item.lat, item.lng], {
        icon: this.makeIcon(item, this.selectedMapId === item.id),
      });

      marker.bindPopup(() => {
        const d   = document.createElement('div');
        d.className = 'popup-inner';
        const up  = this.unitPrice(item);
        const col = this.priceColor(item.委託價);
        const colMap = { green: '#15803d', blue: '#1d4ed8', orange: '#c2410c', red: '#991b1b' };
        const pingVal  = item.總坪數 || item.土地坪數 || '-';
        const devBadge = this.modeConfig.popupShowDev && item.開發
          ? `<span class="popup-badge">${item.開發}</span>` : '';

        d.innerHTML = `
          <div class="popup-header">
            <div class="popup-name">${item.案名}</div>
            <div class="popup-badges">
              <span class="popup-badge type">${item.建物型態 || '物件'}</span>
              <span class="popup-badge">${item.縣市}${item.分區}</span>
              ${devBadge}
            </div>
          </div>
          <div class="popup-price-row">
            <div class="popup-price" style="color:${colMap[col]}">${item.委託價}<small>萬</small></div>
            <div class="popup-unit-price">單價 <strong>${up} 萬/坪</strong></div>
          </div>
          <div class="popup-stats">
            <div class="popup-stat"><div class="popup-stat-val">${pingVal}</div><div class="popup-stat-lbl">坪數</div></div>
            <div class="popup-stat"><div class="popup-stat-val" style="font-size:11px">${item.格局 || '-'}</div><div class="popup-stat-lbl">格局</div></div>
            <div class="popup-stat"><div class="popup-stat-val">${item.土地坪數 || '-'}</div><div class="popup-stat-lbl">地坪</div></div>
          </div>
          <div class="popup-footer">
            <button class="popup-btn" onclick="window.__vueApp__.jumpToMapItem(${item.id})">切換至列表查看詳情 →</button>
            ${item.lat && item.lng
              ? `<button class="popup-btn" style="margin-top:6px;background:#16a34a"
                   onclick="window.__vueApp__.navigateToCase(${item.id})">🧭 Google 導航</button>`
              : ''}
          </div>`;
        return d;
      }, { maxWidth: 300 });

      marker.on('click', () => this.focusMarker(item));
      this._markerGroup.addLayer(marker);
      this._markerMap[item.id] = marker;
    });

    if (fitBounds && withGeo.length > 0) {
      const bounds = L.latLngBounds(withGeo.map(i => [i.lat, i.lng]));
      this._map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
    }
  },

  // ── 聚焦指定 Marker ──────────
  focusMarker(item) {
    window.GA?.clickMarker(item, this.modeConfig._name);
    this.selectedMapId = item.id;
    Object.entries(this._markerMap).forEach(([id, m]) => {
      const found = this.filteredData.find(i => i.id === Number(id));
      if (found) m.setIcon(this.makeIcon(found, Number(id) === item.id));
    });
    const marker = this._markerMap[item.id];
    if (!marker || !this._map) return;
    const targetZoom = Math.max(this._map.getZoom(), 17);
    this._map.flyTo([item.lat, item.lng], targetZoom, { animate: true, duration: 0.6 });
    this._map.once('moveend', () => marker.openPopup());
  },

  // ── 從 popup 跳回列表 ────────
  jumpToMapItem(id) {
    const item = this.filteredData.find(i => i.id === id);
    if (!item) return;
    window.GA?.popupToList(item, this.modeConfig._name);
    this.view = 'table';
    if (this.modeConfig.canViewDetail) this.expandedIds = [id]; // 單選展開，權限不足則不展開
    Vue.nextTick(() => {
      setTimeout(() => {
        const el = document.querySelector(`tr[data-id="${id}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    });
  },

  // ── 地址搜尋（Nominatim 地理編碼，限定台灣） ──
  // OSM 在台灣的門牌（精確到號）資料常常不完整，直接查完整地址容易撲空，
  // 所以查不到就自動放寬條件重試：完整地址 → 去掉門牌號 → 去掉巷弄 → 只留路名/區。
  // ── 小提示（右下角自動淡出，取代 alert 阻斷式彈窗） ──
  showMapToast(message, type = 'info') {
    if (!this._map) return;
    const container = this._map.getContainer();
    if (this._toastEl) { this._toastEl.remove(); clearTimeout(this._toastTimer); }
    const toast = document.createElement('div');
    toast.className = `map-toast map-toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    this._toastEl = toast;
    requestAnimationFrame(() => toast.classList.add('show'));
    this._toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  },

  _addressFallbacks(q) {
    const variants = [q];
    const noNumber = q.replace(/\d+(?:之\d+)?號.*$/, '');           // 去掉「OO號」及後面
    if (noNumber && noNumber !== q) variants.push(noNumber);
    const noLaneAlley = noNumber.replace(/\d+(巷|弄)$/, '');          // 再去掉巷/弄
    if (noLaneAlley && noLaneAlley !== noNumber) variants.push(noLaneAlley);
    return [...new Set(variants)].filter(Boolean);
  },

  async _geocode(q) {
    const url = `https://nominatim.openstreetmap.org/search`
      + `?format=json&countrycodes=tw&limit=1&q=${encodeURIComponent(q)}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('搜尋服務暫時無法使用');
    return resp.json();
  },

  async searchAddress(query) {
    const q = (query || '').trim();
    if (!q || !this._map) return;
    window.GA?.search(q, this.modeConfig._name);

    if (this._addrSearchBtn) this._addrSearchBtn.classList.add('searching');
    try {
      const variants = this._addressFallbacks(q);
      let results = [];
      let matchedQuery = q;
      for (const v of variants) {
        results = await this._geocode(v);
        if (results.length) { matchedQuery = v; break; }
      }
      if (!results.length) {
        this.showMapToast('查無此地址，請換個關鍵字再試（例如加上縣市/區，或先不要輸入門牌號）', 'warn');
        return;
      }
      const { lat, lon, display_name } = results[0];
      const target = [parseFloat(lat), parseFloat(lon)];

      if (this._addrSearchMarker) this._addrSearchMarker.remove();
      this._addrSearchMarker = L.marker(target, {
        icon: L.divIcon({
          html: '<div class="addr-search-pin">📍</div>',
          className: '', iconSize: [30, 30], iconAnchor: [15, 30],
        }),
      }).addTo(this._map).bindPopup(display_name);

      this._map.flyTo(target, matchedQuery !== q ? 15 : 17, { animate: true, duration: 0.8 });
      this._map.once('moveend', () => this._addrSearchMarker.openPopup());

      if (matchedQuery !== q) {
        this.showMapToast(`找不到完整門牌，已定位到「${matchedQuery}」附近，請自行核對`, 'warn');
      }
    } catch (e) {
      this.showMapToast('地址搜尋失敗：' + e.message, 'error');
    } finally {
      if (this._addrSearchBtn) this._addrSearchBtn.classList.remove('searching');
    }
  },

  // ── Google 導航 ───────────────
  navigateToCase(idOrItem) {
    const item = typeof idOrItem === 'object'
      ? idOrItem
      : (this.filteredData.find(i => i.id === idOrItem) || this.rawData.find(i => i.id === idOrItem));
    if (!item || !item.lat || !item.lng) return;
    window.GA?.navigate(item, this.modeConfig._name);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}&travelmode=driving`;
    window.open(url, '_blank');
  },

  // ── 切換到地圖 / 列表 ────────
  switchView(v) {
    window.GA?.switchView(v, this.modeConfig._name);
    this.view = v;
    if (v === 'map') {
      // v-show 讓 #map 永遠在 DOM，不需要等 DOM 渲染，nextTick 就夠
      Vue.nextTick(() => {
        if (this._map) {
          this._map.invalidateSize();
          this.renderMarkers(true);
          this.syncPoiLayers();
        } else {
          this.initMap();
          this.renderMarkers(true);
        }
      });
    } else {
      // v-show 模式：容器留在 DOM，map instance 也保留（不 remove），
      // 切回列表時只要停下來就好，回來時 invalidateSize() 即可。
      // 不再呼叫 this._map.remove()，避免下次切回地圖時容器已被 Leaflet 標記為已使用。
    }
  },

  // ── 從列表點地圖 icon ────────
  jumpToMap(item) {
    window.GA?.jumpToMap(item, this.modeConfig._name);
    this.view = 'map';
    this.mapSingleItemId = item.id;
    Vue.nextTick(() => {
      if (this._map) { this._map.invalidateSize(); this.renderMarkers(false); }
      else { this.initMap(); this.renderMarkers(false); }
      setTimeout(() => this.focusMarker(item), 250);
    });
  },

  // ── 案件物件顯示模式切換：all=全部／none=不顯示物件／single=只顯示指定一筆 ──
  setMapObjectMode(mode) {
    this.mapObjectMode = mode;
    if (this._map) this.renderMarkers(mode !== 'none');
  },

  // ── 目前「指定物件」模式所指的案名（給 UI 顯示用，沒有則回傳空字串） ──
  mapSingleItemName() {
    if (!this.mapSingleItemId) return '';
    const item = this.rawData.find(i => i.id === this.mapSingleItemId);
    return item ? item.案名 : '';
  },
};

// app-vue.js 用 ...MapMethods 混入，必須掛到 window 才能跨 <script> 標籤存取
window.MapMethods = MapMethods;
