/**
 * ╔══════════════════════════════════════════╗
 * ║   nlsc.js — 國土測繪中心 API 查詢模組      ║
 * ╚══════════════════════════════════════════╝
 *
 * 用途：對每筆案件呼叫 NLSC（內政部國土測繪中心）API，
 *       補充取得「土地使用分區」、「公告地價」、「都市計畫案」等資訊。
 *
 * 呼叫方式（staff 模式，詳細面板按鈕觸發）：
 *   await NlscMethods.fetchNlscInfo(item)
 *   結果存入 this.nlscCache[item.id]
 *
 * 使用到的 API（依案件既有資料決定查哪支）：
 *
 *  ① LandUsePointYears（主查，用 lat/lng，幾乎所有案件都適用）
 *     GET https://api.nlsc.gov.tw/other/LandUsePointYears/0/{lng}/{lat}/4326
 *     → 回傳 XML：都市計畫分區、使用地類別（含歷年）
 *
 *  ② getLandInfoSect（輔查，用地段代碼+地號，案件有地號資料才呼叫）
 *     POST https://api.nlsc.gov.tw/S09_Ralid/getLandInfoSect
 *     body: city={cityCode}&sect={sectCode}&landno={landno}
 *     → 回傳 JSON：公告地價、公告現值、面積、私有/公有…
 *
 *  ③ LocationQuery（用 lat/lng 查附近地號，回傳可用於②的 sect 代碼）
 *     POST https://api.nlsc.gov.tw/MapSearch/LocationQuery
 *     body: center={lng},{lat}
 *     → 回傳含 section code 的資料，是②的前置查詢
 *
 * 縣市代碼對照（NLSC city code）：
 *   桃園市=H  臺北市=A  新北市=F  新竹市=O  新竹縣=J
 *   基隆市=C  宜蘭縣=G  苗栗縣=K  臺中市=B  彰化縣=N
 *   南投縣=M  雲林縣=P  嘉義市=I  嘉義縣=Q  臺南市=D
 *   高雄市=E  屏東縣=T  花蓮縣=U  臺東縣=V  澎湖縣=X
 *   金門縣=W  連江縣=Z
 */

const NlscMethods = {

  // ── 縣市名稱 → NLSC city code ──────────────────────────────────────────
  _cityCodeMap: {
    '臺北市': 'A', '台北市': 'A',
    '臺中市': 'B', '台中市': 'B',
    '基隆市': 'C',
    '臺南市': 'D', '台南市': 'D',
    '高雄市': 'E',
    '新北市': 'F',
    '宜蘭縣': 'G',
    '桃園市': 'H',
    '嘉義市': 'I',
    '新竹縣': 'J',
    '苗栗縣': 'K',
    '南投縣': 'M',
    '彰化縣': 'N',
    '新竹市': 'O',
    '雲林縣': 'P',
    '嘉義縣': 'Q',
    '屏東縣': 'T',
    '花蓮縣': 'U',
    '臺東縣': 'V', '台東縣': 'V',
    '金門縣': 'W',
    '澎湖縣': 'X',
    '連江縣': 'Z',
  },

  getCityCode(cityName) {
    return this._cityCodeMap[cityName] || null;
  },

  // ── 共用 fetch headers（模擬來自 maps.nlsc.gov.tw 的請求）─────────────
  _headers(extra = {}) {
    return {
      'Referer': 'https://maps.nlsc.gov.tw/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
      'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8',
      ...extra,
    };
  },

  // ── XML → 物件（LandUsePointYears 回傳 XML）─────────────────────────
  _parseXml(xmlStr) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlStr, 'text/xml');
    const get = (tag) => doc.querySelector(tag)?.textContent?.trim() || '';
    return {
      使用分區:   get('DISTRICT') || get('District') || get('landUse'),
      使用地類別: get('LANDUSE')  || get('LandUse'),
      都市計畫案: get('URBANPLAN') || get('UrbanPlan') || get('planName'),
      容積率:     get('FLORAREA') || get('FlorArea') || get('FAR'),
      建蔽率:     get('BLDGCOVR') || get('BldgCovr') || get('BCR'),
      地籍段名:   get('SECTNAME') || get('SectName'),
      地籍段代碼: get('SECTCODE') || get('SectCode') || get('sect'),
    };
  },

  // ══════════════════════════════════════════════════════════════════════
  //  主要查詢入口：給詳細面板按鈕呼叫
  // ══════════════════════════════════════════════════════════════════════
  async fetchNlscInfo(item) {
    if (!item.lat || !item.lng) {
      return { error: '此案件缺少座標資料，無法查詢。' };
    }

    const result = { landUse: null, landInfo: null, error: null };

    // ① 查土地使用分區（用座標，直接可用）
    try {
      const url = `https://api.nlsc.gov.tw/other/LandUsePointYears/0/${item.lng}/${item.lat}/4326`;
      const resp = await fetch(url, {
        headers: this._headers({ 'Accept': 'application/xml, text/xml, */*; q=0.01' }),
      });
      if (resp.ok) {
        const xml = await resp.text();
        result.landUse = this._parseXml(xml);
        // 如果 API 回傳了段代碼，記下來供②使用
        if (result.landUse.地籍段代碼) {
          result._sectCode = result.landUse.地籍段代碼;
        }
      }
    } catch (e) {
      result.error = `使用分區查詢失敗：${e.message}`;
    }

    // ② 查地籍詳細資料（需要 sect 代碼 + 地號）
    //    sect 代碼來源優先順序：① API 回傳 → ② 先呼叫 LocationQuery 取得
    const cityCode = this.getCityCode(item.縣市);
    const landno   = item.地號?.replace(/-/g, '').padStart(8, '0');

    if (cityCode && landno) {
      let sectCode = result._sectCode || null;

      // 如果①沒有回傳 sect 代碼，用 LocationQuery 補查
      if (!sectCode) {
        try {
          const lqResp = await fetch('https://api.nlsc.gov.tw/MapSearch/LocationQuery', {
            method: 'POST',
            headers: this._headers({
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'Accept': '*/*',
              'Origin': 'https://maps.nlsc.gov.tw',
            }),
            body: `center=${item.lng},${item.lat}`,
          });
          if (lqResp.ok) {
            const lqText = await lqResp.text();
            // 解析 XML 或 JSON 找到 sect 代碼
            const m = lqText.match(/<SECT(?:CODE)?[^>]*>(\d+)<\/SECT|"sect"\s*:\s*"?(\d+)"?/i);
            if (m) sectCode = m[1] || m[2];
          }
        } catch (e) {
          // LocationQuery 失敗不影響主要結果
        }
      }

      if (sectCode) {
        try {
          const liResp = await fetch('https://api.nlsc.gov.tw/S09_Ralid/getLandInfoSect', {
            method: 'POST',
            headers: this._headers({
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'Accept': 'application/json, text/javascript, */*; q=0.01',
              'Origin': 'https://maps.nlsc.gov.tw',
            }),
            body: `city=${cityCode}&sect=${sectCode}&landno=${landno}`,
          });
          if (liResp.ok) {
            const data = await liResp.json();
            // 欄位名稱依實際回傳調整（先保留原始，方便 debug）
            result.landInfo = {
              公告地價:   data.OFFPRICE  || data.offPrice  || data.announcedLandPrice || '-',
              公告現值:   data.OFFVALUE  || data.offValue  || data.announcedLandValue || '-',
              土地面積:   data.AREA      || data.area      || '-',
              公有私有:   data.OWNERSHIP || data.ownership || '-',
              _raw: data,
            };
          }
        } catch (e) {
          // 地籍詳細查詢失敗不影響分區結果
        }
      }
    }

    return result;
  },
};

window.NlscMethods = NlscMethods;
