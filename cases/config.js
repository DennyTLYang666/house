/**
 * ╔══════════════════════════════════════════╗
 * ║         小楊房屋系統 — 模式設定檔          ║
 * ╚══════════════════════════════════════════╝
 *
 * URL hash 對應模式：
 *   內部用：  index.html#staff2025
 *   客戶用：  index.html#client2025
 *   特定開發：index.html#yang2025   （只看小楊的案件）
 *
 * 修改密鑰：直接改下方 KEYS 的值即可
 * 修改功能：調整各 mode 的設定
 */

const SITE_CONFIG = {

  // ══════════════════════════════
  //  密鑰 → 模式 對應
  // ══════════════════════════════
  KEYS: {
    'staff2025':  'staff',   // 內部全功能版
    'yang2025':   'yang',    // 只看小楊案件
    'client2025': 'client',  // 客戶版
  },

  // ══════════════════════════════
  //  各模式設定
  // ══════════════════════════════
  MODES: {

    // ── 內部全功能版 ──────────────
    staff: {
      title: '🏠 小楊屋玖壹｜內部系統',
      sidebarTitle: '🏠 小楊房屋委託',
      dataFile: './staff.enc',

      // 列表顯示控制
      showLinks:   true,   // 廣告(FB) / YouTube icon
      showMapIcon: true,   // 列表裡的地圖跳轉 icon

      // 資料過濾（額外的，ontop of 已售/停賣過濾）
      dataFilter: {
        excludeDevNames: ['小楊類專'],  // 排除這些開發名
        excludeTypes: [],               // 不排除任何類型
        onlyDev: null,                  // null = 不限制開發
      },

      // 快速篩選 tag（顯示哪些）
      quickTags: [
        { label: '主攻',   value: '主攻',   key: '開發' },
        { label: '小楊',   value: '小楊',   key: '開發' },
        { label: '配案',   value: '配案',   key: '開發' },
        { label: '土地',   value: '土地',   key: '類型' },
        { label: '房屋',   value: '房屋',   key: '類型' },
        { label: '低總價', value: '低總價', key: '價格區間' },
        { label: '中價位', value: '中價位', key: '價格區間' },
        { label: '高價位', value: '高價位', key: '價格區間' },
        { label: '豪宅',   value: '豪宅',   key: '價格區間' },
      ],

      // 側邊欄過濾器（顯示哪些）
      filters: {
        keyword:    true,
        area:       true,
        village:    true,   // 村里
        buildType:  true,
        rooms:      true,
        direction:  true,
        usage:      true,
        price:      true,
        unitPrice:  true,
        ping:       true,
        land:       true,
      },

      // 表格欄位
      columns: {
        caseName:   true,
        dev:        true,   // 開發欄（含Facebook/YouTube連結）
        area:       true,
        price:      true,
        unitPrice:  true,
        layout:     true,
        totalPing:  true,
        mainPing:   true,
        landPing:   true,
        usage:      true,
        buildType:  true,
        direction:  true,
      },

      // 展開詳細卡片
      detailCards: {
        basicInfo:  true,   // 基本資訊（含地段/地號/座標）
        feature:    true,
        school:     true,
        amenity:    true,
      },

      // 地圖 popup 顯示
      popupShowDev: true,
    },

    // ── 只看小楊案件 ──────────────
    yang: {
      title: '🏠 小楊屋玖壹｜小楊案件',
      sidebarTitle: '🏠 小楊案件',
      dataFile: './yang.enc',

      showLinks:   false,  // 不顯示廣告/YouTube
      showMapIcon: true,   // 地圖跳轉保留

      dataFilter: {
        excludeDevNames: ['小楊類專'],
        excludeTypes: [],
        onlyDev: '小楊',    // 只顯示開發=小楊
      },

      quickTags: [
        { label: '土地',   value: '土地',   key: '類型' },
        { label: '房屋',   value: '房屋',   key: '類型' },
        { label: '低總價', value: '低總價', key: '價格區間' },
        { label: '中價位', value: '中價位', key: '價格區間' },
        { label: '高價位', value: '高價位', key: '價格區間' },
      ],

      filters: {
        keyword:    true,
        area:       true,
        village:    false,
        buildType:  true,
        rooms:      true,
        direction:  false,
        usage:      false,
        price:      true,
        unitPrice:  true,
        ping:       true,
        land:       false,
      },

      columns: {
        caseName:   true,
        dev:        false,  // 都是小楊，不需要顯示開發欄
        area:       true,
        price:      true,
        unitPrice:  true,
        layout:     true,
        totalPing:  true,
        mainPing:   true,
        landPing:   true,
        usage:      true,
        buildType:  true,
        direction:  true,
      },

      detailCards: {
        basicInfo:  true,
        feature:    true,
        school:     true,
        amenity:    true,
      },

      popupShowDev: false,
    },

    // ── 客戶版 ────────────────────
    client: {
      title: '🏠 小楊房屋｜物件資訊',
      sidebarTitle: '🏠 精選物件',
      dataFile: './client.enc',

      showLinks:   false,  // 不顯示廣告/YouTube
      showMapIcon: true,   // 地圖跳轉保留

      dataFilter: {
        excludeDevNames: ['小楊類專', '配案'],
        excludeTypes: [],   // 客戶不看土地
        onlyDev: null,
      },

      quickTags: [
        { label: '房屋',   value: '房屋',   key: '類型' },
        { label: '低總價', value: '低總價', key: '價格區間' },
        { label: '中價位', value: '中價位', key: '價格區間' },
        { label: '高價位', value: '高價位', key: '價格區間' },
      ],

      filters: {
        keyword:    true,
        area:       true,
        village:    false,  // 客戶不需村里篩選
        buildType:  true,
        rooms:      true,
        direction:  false,
        usage:      false,  // 客戶不需使用分區
        price:      true,
        unitPrice:  false,
        ping:       true,
        land:       false,  // 客戶不需土地坪數篩選
      },

      columns: {
        caseName:   true,
        dev:        true,  // 客戶不看開發資訊
        area:       true,
        price:      true,
        unitPrice:  true,
        layout:     true,
        totalPing:  true,
        mainPing:   true,
        landPing:   false,  // 客戶不看地坪
        usage:      false,  // 客戶不看使用分區
        buildType:  true,
        direction:  false,
      },

      detailCards: {
        basicInfo:  false,  // 客戶不看地段/地號/座標
        feature:    true,
        school:     true,
        amenity:    true,
      },

      popupShowDev: false,
    },
  },

  // ══════════════════════════════
  //  未知密鑰時的行為
  //  'block'  = 顯示錯誤頁，無法進入
  //  'client' = 預設降為客戶模式
  // ══════════════════════════════
  UNKNOWN_KEY_ACTION: 'block',

};
