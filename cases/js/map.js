/**
 * ╔══════════════════════════════════════════╗
 * ║          map.js — 地圖引擎模組             ║
 * ╚══════════════════════════════════════════╝
 *
 * 職責：
 *   - Leaflet 初始化（底圖、疊加圖層、Zoom 控制）
 *   - 定位按鈕
 *   - MarkerClusterGroup + 自訂 divIcon
 *   - Popup 渲染
 *   - focusMarker、jumpToMapItem、navigateToCase
 *
 * 依賴：
 *   - Leaflet + MarkerCluster（全域 L）
 *   - auth.js（window.modeConfig）
 *
 * 輸出：window.YangMap（{ vueDataMixin, vueMethodsMixin, vueWatchMixin }）
 */

(function () {
  'use strict';

  // ── Vue data mixin ───────────────────────
  const vueDataMixin = {
    view:          'table',
    selectedMapId: null,
    _map:          null,
    _markerGroup:  null,
    _markerMap:    {},
  };

  // ── Vue methods mixin ────────────────────
  const vueMethodsMixin = {

    // ── 視圖切換 ──────────────────────────
    switchView(v) {
      window.GA?.switchView(v, this.modeConfig._name);
      this.view = v;
      if (v === 'map') {
        Vue.nextTick(() => {
          if (this._map) { this._map.invalidateSize(); this.renderMarkers(true); }
          else { this.initMap(); this.renderMarkers(true); }
        });
      } else {
        if (this._map) {
          this._map.remove();
          this._map = null;
          this._markerGroup = null;
          this._markerMap   = {};
        }
      }
    },

    jumpToMap(item) {
      window.GA?.jumpToMap(item, this.modeConfig._name);
      this.view = 'map';
      Vue.nextTick(() => {
        if (this._map) { this._map.invalidateSize(); this.renderMarkers(false); }
        else { this.initMap(); this.renderMarkers(false); }
        setTimeout(() => this.focusMarker(item), 250);
      });
    },

    // ── 價格色段 ──────────────────────────
    priceColor(price) {
      if (price < 1000)  return 'green';
      if (price < 3000)  return 'blue';
      if (price < 8000)  return 'orange';
      return 'red';
    },

    // ── 地圖初始化 ────────────────────────
    initMap() {
      if (this._map) return;

      const map = L.map('map', {
        zoomControl: false, zoomAnimation: true,
        markerZoomAnimation: false, preferCanvas: true,
      }).setView([24.97, 121.28], 11);

      // 底圖
      const baseLayers = {
        '🗺️ 街道圖': L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
          subdomains: 'abcd', maxZoom: 20,
        }),
        '🛩️ 航照圖': L.tileLayer('https://wmts.nlsc.gov.tw/wmts/PHOTO2/default/GoogleMapsCompatible/{z}/{y}/{x}', {
          attribution: '© <a href="https://maps.nlsc.gov.tw/">內政部國土測繪中心</a>',
          maxZoom: 20,
        }),
        '🗾️ 國土地圖': L.tileLayer('https://wmts.nlsc.gov.tw/wmts/EMAP5/default/GoogleMapsCompatible/{z}/{y}/{x}', {
          attribution: '© <a href="https://maps.nlsc.gov.tw/">內政部國土測繪中心</a>',
          maxZoom: 20,
        }),
        '🌍 地形圖': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
          attribution: '© <a href="https://opentopomap.org/">OpenTopoMap</a>',
          subdomains: 'abc', maxZoom: 17,
        }),
      };

      // 疊加圖層
      const overlayLayers = {
        '📐 地籍圖': L.tileLayer.wms('https://wms.nlsc.gov.tw/wms', {
          layers: 'LANDSECT', format: 'image/png',
          transparent: true, version: '1.1.1',
          opacity: 0.9, attribution: '© 內政部國土測繪中心',
        }),
      };

      baseLayers['🗺️ 街道圖'].addTo(map);
      L.control.layers(baseLayers, overlayLayers, { position: 'topright', collapsed: true }).addTo(map);
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // 地址搜尋框（Nominatim / OpenStreetMap 地理編碼，免申請、免金鑰）
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

      // 定位按鈕
      const locBtn = document.createElement('button');
      locBtn.className = 'locate-btn';
      locBtn.title = '定位到我的位置';
      locBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
        <circle cx="12" cy="12" r="4"/>
        <line x1="12" y1="2" x2="12" y2="6"/>
        <line x1="12" y1="18" x2="12" y2="22"/>
        <line x1="2" y1="12" x2="6" y2="12"/>
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

      // MarkerCluster
      const markerGroup = L.markerClusterGroup({
        maxClusterRadius: (zoom) => {
          if (zoom >= 16) return 1;
          if (zoom >= 14) return 20;
          if (zoom >= 13) return 35;
          if (zoom >= 12) return 50;
          return 70;
        },
        disableClusteringAtZoom: 16, spiderfyOnMaxZoom: false,
        showCoverageOnHover: false, zoomToBoundsOnClick: true,
        animateAddingMarkers: false, removeOutsideVisibleBounds: false,
        iconCreateFunction: (cluster) => {
          const n   = cluster.getChildCount();
          let cls   = 'cb-sm';
          if (n >= 20) cls = 'cb-xl';
          else if (n >= 10) cls = 'cb-lg';
          else if (n >= 5)  cls = 'cb-md';
          const size = n >= 20 ? 52 : 44;
          return L.divIcon({
            html: `<div class="cluster-badge ${cls}"><div class="cb-num">${n}</div><div class="cb-lbl">筆</div></div>`,
            className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
          });
        },
      });
      map.addLayer(markerGroup);

      let lastRenderZoom = map.getZoom();
      map.on('zoomend', () => {
        const z = map.getZoom();
        if (Math.abs(z - lastRenderZoom) >= 2) { lastRenderZoom = z; this.renderMarkers(false); }
      });

      this._map         = map;
      this._markerGroup = markerGroup;
      this._markerMap   = {};
    },

    // ── Marker 圖示 ───────────────────────
    makeIcon(item, selected = false) {
      const col   = this.priceColor(item.委託價);
      const label = item.委託價 >= 10000 ? (item.委託價 / 10000).toFixed(1) + '億' : item.委託價 + '萬';
      const selCls = selected ? ' selected' : '';
      const w     = label.length > 5 ? label.length * 9 + 20 : 70;
      return L.divIcon({
        html: `<div class="pm pm-${col}${selCls}"><span class="pm-dot"></span>${label}</div>`,
        className: '', iconSize: [w, 26], iconAnchor: [w / 2, 31],
      });
    },

    // ── 渲染 Markers ──────────────────────
    renderMarkers(fitBounds = false) {
      if (!this._map) return;
      this._markerGroup.clearLayers();
      this._markerMap = {};
      const withGeo = this.filteredData.filter(i => i.lat && i.lng);

      withGeo.forEach(item => {
        const marker = L.marker([item.lat, item.lng], {
          icon: this.makeIcon(item, this.selectedMapId === item.id),
        });

        marker.bindPopup(() => {
          const d = document.createElement('div');
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
            </div>
          `;
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

    // ── Marker 聚焦 ───────────────────────
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

    // ── 從 Popup 切到列表 ─────────────────
    jumpToMapItem(id) {
      const item = this.filteredData.find(i => i.id === id);
      if (!item) return;
      window.GA?.popupToList(item, this.modeConfig._name);
      this.view = 'table';
      if (!this.expandedIds.includes(id)) this.expandedIds.push(id);
      Vue.nextTick(() => {
        setTimeout(() => {
          const el = document.querySelector(`tr[data-id="${id}"]`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      });
    },

    // ── 地址搜尋（Nominatim 地理編碼，限定台灣） ──
    async searchAddress(query) {
      const q = (query || '').trim();
      if (!q) return;
      if (!this._map) return;
      window.GA?.search(q, this.modeConfig._name);

      if (this._addrSearchBtn) this._addrSearchBtn.classList.add('searching');
      try {
        const url = `https://nominatim.openstreetmap.org/search`
          + `?format=json&countrycodes=tw&limit=1&q=${encodeURIComponent(q)}`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('搜尋服務暫時無法使用');
        const results = await resp.json();
        if (!results.length) {
          alert('查無此地址，請換個關鍵字再試（例如加上縣市/區）');
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

        this._map.flyTo(target, 17, { animate: true, duration: 0.8 });
        this._map.once('moveend', () => this._addrSearchMarker.openPopup());
      } catch (e) {
        alert('地址搜尋失敗：' + e.message);
      } finally {
        if (this._addrSearchBtn) this._addrSearchBtn.classList.remove('searching');
      }
    },

    // ── Google 導航 ───────────────────────
    navigateToCase(idOrItem) {
      const item = typeof idOrItem === 'object'
        ? idOrItem
        : (this.filteredData.find(i => i.id === idOrItem) || this.rawData.find(i => i.id === idOrItem));
      if (!item || !item.lat || !item.lng) return;
      window.GA?.navigate(item, this.modeConfig._name);
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}&travelmode=driving`, '_blank');
    },
  };

  // ── Vue watch mixin ──────────────────────
  const vueWatchMixin = {
    filteredData() {
      if (this.view === 'map' && this._map) this.renderMarkers(true);
    },
  };

  // ── 暴露 ─────────────────────────────────
  window.YangMap = {
    vueDataMixin,
    vueMethodsMixin,
    vueWatchMixin,
  };

})();