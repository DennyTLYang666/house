/**
 * ╔══════════════════════════════════════════╗
 * ║     小楊房屋系統 — Staff 工具連結模組      ║
 * ╚══════════════════════════════════════════╝
 *
 * 使用方式：在 index.html 的 </body> 前加入：
 *   <script src="./tools.js"></script>
 *
 * 資料儲存：localStorage key = 'yang_tools_data'
 * 只在 staff 模式下顯示（由 modeConfig._name 判斷）
 */

(function () {
  'use strict';

  // ══════════════════════════════
  //  預設資料（第一次使用時寫入）
  // ══════════════════════════════
  const DEFAULT_DATA = {
    地籍: [
      { name: '國土測繪地圖', url: 'https://maps.nlsc.gov.tw/T09/mobilemap.action' },
      { name: '地籍圖資查詢', url: 'https://easymap.land.moi.gov.tw/' },
      { name: '地號查詢系統', url: 'https://www.land.moi.gov.tw/chhtml/landquery.asp' },
    ],
    估價稅務: [
      { name: '實價登錄查詢', url: 'https://lvr.land.moi.gov.tw/login.action' },
      { name: '地價查詢', url: 'https://pip.moi.gov.tw/V3/E/SCRE0201.aspx' },
      { name: '財政部電子申報', url: 'https://www.etax.nat.gov.tw/' },
    ],
    法規查詢: [
      { name: '全國法規資料庫', url: 'https://law.moj.gov.tw/' },
      { name: '桃園市都市計畫', url: 'https://gis.tycg.gov.tw/tycgmaps/' },
      { name: '使用分區查詢', url: 'https://urban.tycg.gov.tw/' },
    ],
    地圖工具: [
      { name: 'Google 地圖', url: 'https://maps.google.com/' },
      { name: '航照圖（國土）', url: 'https://maps.nlsc.gov.tw/' },
      { name: 'Google 街景', url: 'https://www.google.com/maps/@?api=1&map_action=pano' },
    ],
  };

  const STORAGE_KEY = 'yang_tools_data';

  // ══════════════════════════════
  //  資料讀寫
  // ══════════════════════════════
  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT_DATA)); // deep copy
  }

  function saveData(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  // ══════════════════════════════
  //  樣式注入
  // ══════════════════════════════
  function injectStyles() {
    if (document.getElementById('yang-tools-style')) return;
    const style = document.createElement('style');
    style.id = 'yang-tools-style';
    style.textContent = `
/* ── 工具列按鈕（topbar 右側） ── */
#yang-tools-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: var(--accent-light, #eef3ff);
  color: var(--accent, #3366cc);
  border: 1.5px solid var(--accent, #3366cc);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all .15s;
  white-space: nowrap;
}
#yang-tools-trigger:hover {
  background: var(--accent, #3366cc);
  color: #fff;
}
#yang-tools-trigger svg {
  flex-shrink: 0;
  transition: transform .2s;
}
#yang-tools-trigger.open svg {
  transform: rotate(45deg);
}

/* ── 浮動面板 ── */
#yang-tools-panel {
  position: fixed;
  top: 54px;
  right: 16px;
  width: 420px;
  max-height: calc(100vh - 80px);
  background: var(--white, #fff);
  border: 1px solid var(--border, #e2e6ed);
  border-radius: 14px;
  box-shadow: 0 8px 32px rgba(0,0,0,.14);
  display: flex;
  flex-direction: column;
  z-index: 3000;
  overflow: hidden;
  transition: opacity .15s, transform .15s;
}
#yang-tools-panel.hidden {
  opacity: 0;
  pointer-events: none;
  transform: translateY(-8px);
}

/* ── 面板 header ── */
.yt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--border, #e2e6ed);
  flex-shrink: 0;
}
.yt-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.yt-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text, #222);
}
.yt-badge {
  font-size: 11px;
  padding: 2px 8px;
  background: var(--accent-light, #eef3ff);
  color: var(--accent, #3366cc);
  border-radius: 999px;
  font-weight: 600;
}
.yt-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ── Tab 切換 ── */
.yt-tabs {
  display: flex;
  padding: 10px 16px 0;
  gap: 0;
  border-bottom: 1px solid var(--border, #e2e6ed);
  flex-shrink: 0;
}
.yt-tab {
  padding: 7px 14px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  border: none;
  background: none;
  color: var(--text2, #555);
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: all .15s;
}
.yt-tab.active {
  color: var(--accent, #3366cc);
  border-bottom-color: var(--accent, #3366cc);
}
.yt-tab:hover:not(.active) { color: var(--text, #222); }

/* ── 捲動區 ── */
.yt-body {
  overflow-y: auto;
  flex: 1;
  padding: 12px 14px 16px;
}
.yt-body::-webkit-scrollbar { width: 4px; }
.yt-body::-webkit-scrollbar-thumb { background: var(--border, #e2e6ed); border-radius: 4px; }

/* ── 分類區塊 ── */
.yt-cat {
  margin-bottom: 14px;
}
.yt-cat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.yt-cat-name {
  font-size: 11px;
  font-weight: 700;
  color: var(--text2, #555);
  text-transform: uppercase;
  letter-spacing: 0.6px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.yt-cat-count {
  font-size: 10px;
  background: #f3f5f8;
  color: var(--text3, #999);
  border-radius: 999px;
  padding: 1px 7px;
}

/* ── 連結格線 ── */
.yt-links-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

/* ── 連結卡片（瀏覽模式） ── */
.yt-link-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: #f8f9fb;
  border: 1px solid var(--border, #e2e6ed);
  border-radius: 8px;
  text-decoration: none;
  color: var(--text, #222);
  font-size: 13px;
  font-weight: 500;
  transition: all .15s;
  overflow: hidden;
  cursor: pointer;
}
.yt-link-card:hover {
  background: var(--accent-light, #eef3ff);
  border-color: var(--accent, #3366cc);
  color: var(--accent, #3366cc);
}
.yt-link-icon {
  width: 28px;
  height: 28px;
  background: var(--white, #fff);
  border: 1px solid var(--border, #e2e6ed);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 13px;
}
.yt-link-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.yt-link-ext {
  opacity: 0;
  font-size: 11px;
  flex-shrink: 0;
  transition: opacity .15s;
}
.yt-link-card:hover .yt-link-ext { opacity: 1; }

/* ── 連結列（編輯模式）── */
.yt-link-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  background: #f8f9fb;
  border: 1px solid var(--border, #e2e6ed);
  border-radius: 8px;
  margin-bottom: 5px;
}
.yt-link-row-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--text, #222);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.yt-link-row-url {
  font-size: 11px;
  color: var(--text3, #999);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
}

/* ── 小按鈕 ── */
.yt-icon-btn {
  width: 26px;
  height: 26px;
  border: 1px solid var(--border, #e2e6ed);
  border-radius: 6px;
  background: var(--white, #fff);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: var(--text2, #555);
  transition: all .15s;
  flex-shrink: 0;
}
.yt-icon-btn:hover {
  background: var(--accent-light, #eef3ff);
  border-color: var(--accent, #3366cc);
  color: var(--accent, #3366cc);
}
.yt-icon-btn.danger:hover {
  background: #fdecea;
  border-color: #f5c6c5;
  color: #e53935;
}

/* ── 新增按鈕 ── */
.yt-add-btn {
  width: 100%;
  padding: 6px;
  border: 1.5px dashed var(--border, #e2e6ed);
  border-radius: 8px;
  background: none;
  cursor: pointer;
  font-size: 12px;
  color: var(--text3, #999);
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: all .15s;
  margin-top: 4px;
}
.yt-add-btn:hover {
  border-color: var(--accent, #3366cc);
  color: var(--accent, #3366cc);
  background: var(--accent-light, #eef3ff);
}

.yt-add-cat-btn {
  width: 100%;
  padding: 10px;
  border: 1.5px dashed var(--border, #e2e6ed);
  border-radius: 10px;
  background: none;
  cursor: pointer;
  font-size: 13px;
  color: var(--text3, #999);
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all .15s;
  margin-top: 8px;
}
.yt-add-cat-btn:hover {
  border-color: var(--accent, #3366cc);
  color: var(--accent, #3366cc);
}

/* ── JSON 區 ── */
.yt-json-box {
  background: #f3f5f8;
  border: 1px solid var(--border, #e2e6ed);
  border-radius: 8px;
  padding: 12px;
  font-size: 11px;
  font-family: 'Courier New', monospace;
  line-height: 1.7;
  color: var(--text2, #555);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 260px;
  overflow-y: auto;
  margin-bottom: 10px;
}
.yt-json-actions {
  display: flex;
  gap: 8px;
}
.yt-btn {
  padding: 7px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all .15s;
  display: flex;
  align-items: center;
  gap: 5px;
}
.yt-btn-primary {
  background: var(--accent, #3366cc);
  color: #fff;
  border: none;
}
.yt-btn-primary:hover { background: #2255b5; }
.yt-btn-secondary {
  background: none;
  border: 1px solid var(--border, #e2e6ed);
  color: var(--text2, #555);
}
.yt-btn-secondary:hover { background: #f3f5f8; }

/* ── 對話框（模態）── */
.yt-modal-bg {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.35);
  z-index: 9000;
  align-items: center;
  justify-content: center;
}
.yt-modal-bg.open { display: flex; }
.yt-modal {
  background: var(--white, #fff);
  border-radius: 14px;
  border: 1px solid var(--border, #e2e6ed);
  padding: 20px 24px;
  width: 360px;
  max-width: 95vw;
  box-shadow: 0 8px 32px rgba(0,0,0,.18);
}
.yt-modal h3 {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 16px;
  color: var(--text, #222);
}
.yt-modal label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text2, #555);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: block;
  margin-top: 12px;
  margin-bottom: 4px;
}
.yt-modal input,
.yt-modal select,
.yt-modal textarea {
  width: 100%;
  padding: 8px 11px;
  border: 1px solid var(--border, #e2e6ed);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text, #222);
  background: #f8f9fb;
  outline: none;
  font-family: inherit;
  transition: border-color .15s;
}
.yt-modal input:focus,
.yt-modal select:focus,
.yt-modal textarea:focus {
  border-color: var(--accent, #3366cc);
  background: #fff;
}
.yt-modal-btns {
  display: flex;
  gap: 8px;
  margin-top: 20px;
  justify-content: flex-end;
}

/* ── 空白提示 ── */
.yt-empty {
  font-size: 12px;
  color: var(--text3, #999);
  text-align: center;
  padding: 16px 0;
}

/* ── 分隔線 ── */
.yt-divider {
  height: 1px;
  background: var(--border, #e2e6ed);
  margin: 12px 0;
}
    `;
    document.head.appendChild(style);
  }

  // ══════════════════════════════
  //  分類對應 emoji
  // ══════════════════════════════
  const CAT_ICONS = {
    地籍: '📐', 地圖: '🗺️', 估價: '💰', 稅務: '🧾', 法規: '⚖️',
    法院: '🏛️', 謄本: '📄', 查詢: '🔍', 財政: '💵', 工具: '🔧',
    地政: '🏠', 其他: '📎',
  };
  function catEmoji(name) {
    for (const k in CAT_ICONS) {
      if (name.includes(k)) return CAT_ICONS[k];
    }
    return '📂';
  }

  // ══════════════════════════════
  //  主類別
  // ══════════════════════════════
  class ToolsPanel {
    constructor() {
      this.data = loadData();
      this.visible = false;
      this.tab = 'browse'; // 'browse' | 'edit' | 'json'
      this.editModal = { open: false, type: null, cat: null, idx: null };
      this.catModal = { open: false };
      this.importModal = { open: false };

      injectStyles();
      this._buildDOM();
      this._bindEvents();
      this.render();
    }

    // ── DOM 骨架 ──────────────────
    _buildDOM() {
      // 觸發按鈕（插入 topbar-right 左側）
      this.trigger = document.createElement('button');
      this.trigger.id = 'yang-tools-trigger';
      this.trigger.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        </svg>
        工具連結
      `;
      // 找 topbar-right 插入
      const topbarRight = document.querySelector('.topbar-right');
      if (topbarRight) {
        topbarRight.insertBefore(this.trigger, topbarRight.firstChild);
      }

      // 面板
      this.panel = document.createElement('div');
      this.panel.id = 'yang-tools-panel';
      this.panel.classList.add('hidden');
      this.panel.innerHTML = `
        <div class="yt-header">
          <div class="yt-header-left">
            <span class="yt-title">🔧 工具連結</span>
            <span class="yt-badge" id="yt-count">0</span>
          </div>
          <div class="yt-header-actions">
            <button class="yt-icon-btn" id="yt-close" title="關閉">✕</button>
          </div>
        </div>
        <div class="yt-tabs">
          <button class="yt-tab active" data-tab="browse">瀏覽</button>
          <button class="yt-tab" data-tab="edit">編輯</button>
          <button class="yt-tab" data-tab="json">JSON</button>
        </div>
        <div class="yt-body" id="yt-body"></div>
      `;
      document.body.appendChild(this.panel);

      // ── 連結 Modal ──
      this.linkModal = document.createElement('div');
      this.linkModal.className = 'yt-modal-bg';
      this.linkModal.id = 'yt-link-modal';
      this.linkModal.innerHTML = `
        <div class="yt-modal">
          <h3 id="yt-link-modal-title">新增工具連結</h3>
          <label>名稱</label>
          <input id="yt-input-name" placeholder="例：國土測繪" autocomplete="off" />
          <label>網址</label>
          <input id="yt-input-url" placeholder="https://..." autocomplete="off" />
          <label>分類</label>
          <select id="yt-input-cat"></select>
          <div class="yt-modal-btns">
            <button class="yt-btn yt-btn-secondary" id="yt-link-cancel">取消</button>
            <button class="yt-btn yt-btn-primary" id="yt-link-save">儲存</button>
          </div>
        </div>
      `;
      document.body.appendChild(this.linkModal);

      // ── 分類 Modal ──
      this.catModal_el = document.createElement('div');
      this.catModal_el.className = 'yt-modal-bg';
      this.catModal_el.id = 'yt-cat-modal';
      this.catModal_el.innerHTML = `
        <div class="yt-modal">
          <h3>新增分類</h3>
          <label>分類名稱</label>
          <input id="yt-input-catname" placeholder="例：地籍、稅務、法規…" autocomplete="off" />
          <div class="yt-modal-btns">
            <button class="yt-btn yt-btn-secondary" id="yt-cat-cancel">取消</button>
            <button class="yt-btn yt-btn-primary" id="yt-cat-save">新增</button>
          </div>
        </div>
      `;
      document.body.appendChild(this.catModal_el);

      // ── Import Modal ──
      this.importModal_el = document.createElement('div');
      this.importModal_el.className = 'yt-modal-bg';
      this.importModal_el.id = 'yt-import-modal';
      this.importModal_el.innerHTML = `
        <div class="yt-modal">
          <h3>匯入 JSON</h3>
          <label>貼入 JSON 資料</label>
          <textarea id="yt-import-text" style="height:140px;resize:vertical;font-family:monospace;font-size:12px" placeholder='{"分類名稱":[{"name":"名稱","url":"https://..."}]}'></textarea>
          <div class="yt-modal-btns">
            <button class="yt-btn yt-btn-secondary" id="yt-import-cancel">取消</button>
            <button class="yt-btn yt-btn-primary" id="yt-import-ok">匯入</button>
          </div>
        </div>
      `;
      document.body.appendChild(this.importModal_el);
    }

    // ── 事件綁定 ──────────────────
    _bindEvents() {
      // 開關面板
      this.trigger.addEventListener('click', () => this.togglePanel());
      document.getElementById('yt-close').addEventListener('click', () => this.hidePanel());

      // 點面板外關閉
      document.addEventListener('click', (e) => {
        if (this.visible &&
            !this.panel.contains(e.target) &&
            !this.trigger.contains(e.target) &&
            !this.linkModal.contains(e.target) &&
            !this.catModal_el.contains(e.target) &&
            !this.importModal_el.contains(e.target)) {
          this.hidePanel();
        }
      });

      // Tab 切換
      this.panel.querySelectorAll('.yt-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          this.tab = btn.dataset.tab;
          this.panel.querySelectorAll('.yt-tab').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.renderBody();
        });
      });

      // Link Modal 事件
      document.getElementById('yt-link-cancel').addEventListener('click', () => this._closeModal('link'));
      document.getElementById('yt-link-save').addEventListener('click', () => this._saveLink());
      this.linkModal.addEventListener('click', (e) => { if (e.target === this.linkModal) this._closeModal('link'); });

      // Cat Modal 事件
      document.getElementById('yt-cat-cancel').addEventListener('click', () => this._closeModal('cat'));
      document.getElementById('yt-cat-save').addEventListener('click', () => this._saveCat());
      this.catModal_el.addEventListener('click', (e) => { if (e.target === this.catModal_el) this._closeModal('cat'); });
      document.getElementById('yt-input-catname').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this._saveCat();
      });

      // Import Modal 事件
      document.getElementById('yt-import-cancel').addEventListener('click', () => this._closeModal('import'));
      document.getElementById('yt-import-ok').addEventListener('click', () => this._doImport());
      this.importModal_el.addEventListener('click', (e) => { if (e.target === this.importModal_el) this._closeModal('import'); });
    }

    // ── 面板開關 ──────────────────
    togglePanel() {
      this.visible ? this.hidePanel() : this.showPanel();
    }
    showPanel() {
      this.visible = true;
      this.panel.classList.remove('hidden');
      this.trigger.classList.add('open');
    }
    hidePanel() {
      this.visible = false;
      this.panel.classList.add('hidden');
      this.trigger.classList.remove('open');
    }

    // ── 全部渲染 ──────────────────
    render() {
      // 更新 badge 計數
      const total = Object.values(this.data).reduce((s, a) => s + a.length, 0);
      const badge = document.getElementById('yt-count');
      if (badge) badge.textContent = total + ' 個';
      this.renderBody();
    }

    renderBody() {
      const body = document.getElementById('yt-body');
      if (!body) return;
      if (this.tab === 'browse') body.innerHTML = this._renderBrowse();
      else if (this.tab === 'edit') body.innerHTML = this._renderEdit();
      else body.innerHTML = this._renderJson();

      // 事件委派（動態 DOM）
      this._bindBodyEvents();
    }

    _renderBrowse() {
      const cats = Object.keys(this.data);
      if (!cats.length) return '<div class="yt-empty">尚無工具連結，請至「編輯」新增</div>';

      return cats.map(cat => {
        const links = this.data[cat];
        const cards = links.length
          ? links.map(l => `
            <a class="yt-link-card" href="${l.url}" target="_blank" rel="noopener" title="${l.url}">
              <div class="yt-link-icon">${catEmoji(cat)}</div>
              <span class="yt-link-text">${l.name}</span>
              <span class="yt-link-ext">↗</span>
            </a>`).join('')
          : '<div class="yt-empty" style="grid-column:1/-1">此分類尚無連結</div>';

        return `
          <div class="yt-cat">
            <div class="yt-cat-header">
              <span class="yt-cat-name">${catEmoji(cat)} ${cat}</span>
              <span class="yt-cat-count">${links.length}</span>
            </div>
            <div class="yt-links-grid">${cards}</div>
          </div>`;
      }).join('<div class="yt-divider"></div>');
    }

    _renderEdit() {
      const cats = Object.keys(this.data);
      let html = cats.map(cat => {
        const links = this.data[cat];
        const rows = links.length
          ? links.map((l, idx) => `
            <div class="yt-link-row">
              <span class="yt-link-icon" style="flex-shrink:0;font-size:13px">${catEmoji(cat)}</span>
              <div style="flex:1;min-width:0">
                <div class="yt-link-row-name">${l.name}</div>
                <div class="yt-link-row-url">${l.url}</div>
              </div>
              <button class="yt-icon-btn" data-action="edit-link" data-cat="${cat}" data-idx="${idx}" title="編輯">✏️</button>
              <button class="yt-icon-btn danger" data-action="del-link" data-cat="${cat}" data-idx="${idx}" title="刪除">🗑</button>
            </div>`).join('')
          : '<div class="yt-empty">此分類尚無連結</div>';

        return `
          <div class="yt-cat">
            <div class="yt-cat-header">
              <span class="yt-cat-name">${catEmoji(cat)} ${cat}</span>
              <div style="display:flex;gap:4px;align-items:center">
                <button class="yt-icon-btn" data-action="add-link" data-cat="${cat}" title="新增連結">＋</button>
                <button class="yt-icon-btn danger" data-action="del-cat" data-cat="${cat}" title="刪除分類">🗑</button>
              </div>
            </div>
            ${rows}
            <button class="yt-add-btn" data-action="add-link" data-cat="${cat}">＋ 新增連結</button>
          </div>`;
      }).join('<div class="yt-divider"></div>');

      html += `<button class="yt-add-cat-btn" data-action="add-cat">＋ 新增分類</button>`;
      return html;
    }

    _renderJson() {
      return `
        <div style="margin-bottom:8px;font-size:12px;color:var(--text2)">
          可複製後貼回「匯入」來還原資料，或直接編輯後匯入。
        </div>
        <div class="yt-json-box" id="yt-json-text">${JSON.stringify(this.data, null, 2)}</div>
        <div class="yt-json-actions">
          <button class="yt-btn yt-btn-primary" data-action="copy-json">📋 複製 JSON</button>
          <button class="yt-btn yt-btn-secondary" data-action="import-json">📥 匯入 JSON</button>
          <button class="yt-btn yt-btn-secondary" data-action="reset-json" style="margin-left:auto">↩ 還原預設</button>
        </div>`;
    }

    // ── 動態事件委派 ──────────────
    _bindBodyEvents() {
      const body = document.getElementById('yt-body');
      if (!body) return;
      body.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        const cat = btn.dataset.cat;
        const idx = btn.dataset.idx !== undefined ? Number(btn.dataset.idx) : null;

        switch (action) {
          case 'add-link':   this._openAddLink(cat); break;
          case 'edit-link':  this._openEditLink(cat, idx); break;
          case 'del-link':   this._deleteLink(cat, idx); break;
          case 'add-cat':    this._openAddCat(); break;
          case 'del-cat':    this._deleteCat(cat); break;
          case 'copy-json':  this._copyJson(); break;
          case 'import-json':this._openImport(); break;
          case 'reset-json': this._resetData(); break;
        }
      });
    }

    // ── Link CRUD ─────────────────
    _openAddLink(cat) {
      this.editModal = { type: 'add', cat, idx: null };
      document.getElementById('yt-link-modal-title').textContent = '新增工具連結';
      document.getElementById('yt-input-name').value = '';
      document.getElementById('yt-input-url').value = '';
      this._fillCatSelect(cat);
      this.linkModal.classList.add('open');
      setTimeout(() => document.getElementById('yt-input-name').focus(), 60);
    }

    _openEditLink(cat, idx) {
      this.editModal = { type: 'edit', cat, idx };
      const l = this.data[cat][idx];
      document.getElementById('yt-link-modal-title').textContent = '編輯連結';
      document.getElementById('yt-input-name').value = l.name;
      document.getElementById('yt-input-url').value = l.url;
      this._fillCatSelect(cat);
      this.linkModal.classList.add('open');
      setTimeout(() => document.getElementById('yt-input-name').focus(), 60);
    }

    _fillCatSelect(selected) {
      const sel = document.getElementById('yt-input-cat');
      sel.innerHTML = Object.keys(this.data)
        .map(c => `<option value="${c}"${c === selected ? ' selected' : ''}>${c}</option>`)
        .join('');
    }

    _saveLink() {
      const name = document.getElementById('yt-input-name').value.trim();
      const url  = document.getElementById('yt-input-url').value.trim();
      const cat  = document.getElementById('yt-input-cat').value;
      if (!name) { alert('請填寫連結名稱'); return; }
      if (!url || !/^https?:\/\//.test(url)) { alert('請填寫有效的 https:// 網址'); return; }

      const { type, cat: oldCat, idx } = this.editModal;
      if (type === 'add') {
        this.data[cat].push({ name, url });
      } else {
        if (oldCat !== cat) {
          this.data[oldCat].splice(idx, 1);
          this.data[cat].push({ name, url });
        } else {
          this.data[cat][idx] = { name, url };
        }
      }
      saveData(this.data);
      this._closeModal('link');
      this.render();
    }

    _deleteLink(cat, idx) {
      const l = this.data[cat][idx];
      if (!confirm(`刪除「${l.name}」？`)) return;
      this.data[cat].splice(idx, 1);
      saveData(this.data);
      this.render();
    }

    // ── Cat CRUD ──────────────────
    _openAddCat() {
      document.getElementById('yt-input-catname').value = '';
      this.catModal_el.classList.add('open');
      setTimeout(() => document.getElementById('yt-input-catname').focus(), 60);
    }

    _saveCat() {
      const name = document.getElementById('yt-input-catname').value.trim();
      if (!name) { alert('請填寫分類名稱'); return; }
      if (this.data[name]) { alert('分類已存在'); return; }
      this.data[name] = [];
      saveData(this.data);
      this._closeModal('cat');
      this.render();
    }

    _deleteCat(cat) {
      if (!confirm(`刪除分類「${cat}」及其下所有連結？`)) return;
      delete this.data[cat];
      saveData(this.data);
      this.render();
    }

    // ── JSON 操作 ─────────────────
    _copyJson() {
      const text = JSON.stringify(this.data, null, 2);
      navigator.clipboard.writeText(text)
        .then(() => alert('✓ 已複製到剪貼板'))
        .catch(() => {
          // fallback
          const el = document.getElementById('yt-json-text');
          const range = document.createRange();
          range.selectNodeContents(el);
          window.getSelection().removeAllRanges();
          window.getSelection().addRange(range);
          document.execCommand('copy');
          alert('✓ 已複製');
        });
    }

    _openImport() {
      document.getElementById('yt-import-text').value = '';
      this.importModal_el.classList.add('open');
      setTimeout(() => document.getElementById('yt-import-text').focus(), 60);
    }

    _doImport() {
      const raw = document.getElementById('yt-import-text').value.trim();
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('格式錯誤');
        // 驗證每個值是陣列
        for (const k in parsed) {
          if (!Array.isArray(parsed[k])) throw new Error(`"${k}" 的值必須是陣列`);
        }
        this.data = parsed;
        saveData(this.data);
        this._closeModal('import');
        this.render();
        alert('✓ 匯入成功');
      } catch (e) {
        alert('JSON 格式有誤：' + e.message);
      }
    }

    _resetData() {
      if (!confirm('還原為預設資料？目前的修改將遺失。')) return;
      this.data = JSON.parse(JSON.stringify(DEFAULT_DATA));
      saveData(this.data);
      this.render();
    }

    // ── Modal 關閉 ────────────────
    _closeModal(type) {
      if (type === 'link') this.linkModal.classList.remove('open');
      if (type === 'cat')  this.catModal_el.classList.remove('open');
      if (type === 'import') this.importModal_el.classList.remove('open');
    }
  }

  // ══════════════════════════════
  //  初始化（等 Vue 掛載完後）
  // ══════════════════════════════

  /**
   * 實際掛載邏輯。
   * 由 yang:mounted 事件觸發，此時 Vue 已完成渲染，
   * .topbar-right 一定存在於 DOM。
   */
  function mount() {
    // 只在 staff 模式下啟動
    if (window.modeConfig?._name !== 'staff') return;
    // 避免重複初始化
    if (window.__yangTools) return;
    window.__yangTools = new ToolsPanel();
  }

  /**
   * 監聽 app-vue.js 在 mounted() 結束後發出的 yang:mounted 事件。
   * 這是最可靠的時機：Vue 渲染完畢、topbar DOM 已存在。
   *
   * Fallback：若因某種原因事件已在本腳本載入前觸發（理論上不會，
   * 因為 tools.js 在 app-vue.js 之後載入），則用 setTimeout 補一次。
   */
  window.addEventListener('yang:mounted', mount, { once: true });

  // 安全 fallback：2 秒後若還沒觸發，強制嘗試一次
  setTimeout(() => {
    if (!window.__yangTools) mount();
  }, 2000);

})();
