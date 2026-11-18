# 港鐵玩具城 · 小小車長出發！

十線列車採用上傳參考圖嘅車身配色、車面表情同雙語線名。地圖同官方預報／模擬跟車使用同一套 three.js 模型。[十款車合照](docs/screenshots/picture-fleet.png) · [桌面模擬跟車](docs/screenshots/picture-simulation.png) · [手機官方預報跟車](docs/screenshots/picture-live.png)

Netlify 由 repo 根目錄讀取 `netlify.toml`，Node 24 建置已提交嘅路網同前端資產。Netlify Function 處理 `/api/*`，Netlify Blobs 以各線為單位保存預報同推算班次。部署時使用已登入 Netlify CLI，從根目錄執行 `netlify deploy --prod --filter @hk-mtr/web`。完整 PBF 只喺重新產生地理資料時需要。

新增 **官方預報／位置推算模式、定位推薦與逐架選車跟隨**，以及逐線參考真實車款的原創玩具模型。詳細資料流、API 上限、預報時間錨點及限制見 [LIVE.md](docs/LIVE.md)，車款來源見 [rolling-stock.md](docs/rolling-stock.md)。港鐵 API 不提供 GPS／車號／車款，官方模式仍以「位置推算」標示，不宣稱辨認使用者所在真車。

先前交付為兒童取向的可玩玩具城市，詳見 [PRODUCT.md](docs/PRODUCT.md)。暖色 Figma 模板改編、立體原創玩具列車、跟車、收藏、探索任務，以及經 Hono proxy 的官方到站看板。玩具列車行程明確標示「模擬」，不是 GPS 或已配對的真實列車。

使用者已授權直接完成及部署，不再等待逐項批准；東涌線新走線已按同源 node 拓撲接回；東涌東／西標示「未開通」。下面保留先前來源與 Milestone 記錄；過往 dev-only 限制已由最新產品交付指令取代。

```bash
npm ci
npm run data:live      # 建置官方方向／分支路徑與可替換模型參數
npm run data:toy       # 使用已建的本地來源審核資料生成十線玩具 snapshot
npm run data:city      # 從相同已驗證本地 PBF 建置玩具樓群／山丘／地標
npm run dev           # Vite + Hono
npm run build         # 全量本地審核 + Vite/API build
npm run build:site    # 將 app 與資料嵌入 Hono Worker，供 Sites 部署
npm test
npm run lint
```

新版本用完整 3D 玩具樓群、卡通道路、山丘、樹木、波浪海面及枕木／雙鋼軌；相關來源、計算錨點及裝飾高度說明見 PRODUCT.md。城市與軌道建置只讀本地 PBF。PWA app shell 可安裝；海岸及道路圖磚仍需連線。官方 API 按需分批查詢，15 秒快取、每請求最多 3 並發、每 isolate 4 次／秒及每分鐘最多 240 個未快取請求；全港實際 coverage 與時間顯示於官方模式。虛擬玩具行程與官方預報彼此獨立。

---

# 港鐵漫遊 · hk-mtr-live

**九線 MapLibre 本地開發預覽已可用；120／120 站鍵已配對。東涌線待核實，沒有 public 路網或正式發佈。**

TypeScript / Vite / React / MapLibre GL JS；Node / Hono；Zod / Vitest / ESLint / Prettier。three.js 已預留，沒有列車或 3D 插畫。

## 使用本地預覽

需求：Node 22.18+、npm 10+、Python 3.11+；本環境沒有 osmium CLI，使用鎖定 pyosmium 4.2.0。

```bash
npm ci
python -m venv .venv
.venv/bin/pip install -r requirements-osm.txt
npm run data:network
npm run dev
```

前端：http://localhost:5173；Hono：http://localhost:8787。前端只從同一開發伺服器 `/__dev/map` 讀本地資料；沒有直接打港鐵 API。Hono health/status 只提供健康與 review-held 狀態，沒有到站輪詢。

原檔在 `data/raw/hong-kong-261114.osm.pbf`，`hong-kong-latest.osm.pbf` 是指向它的本地 symlink；另一部機器可把同一原檔放到 latest 路徑，並放入與實際檔名對應的 `.md5`。缺檔、MD5 缺漏／不符會停，建置不下載、不 fallback 到 Overpass。

```bash
npm run build        # typecheck + CSV audit + local PBF audit/preview + web/API build
npm test             # 離線單元測試；真 PBF junction subset
npm run lint         # ESLint + Prettier
npm run data:network # 重建審核報告與非 TCL 九線開發資料
```

`build` 通過不代表允許正式發佈。`apps/web/dist` 只有應用程式碼，沒有任何路網資料；`/__dev/map` middleware 不存在於 production 或 vite preview。production 畫面會明確表示只供本機預覽，不會改用 public／舊資料。

## 資料證據

| 項目                           | 已核對值                                                              |
| ------------------------------ | --------------------------------------------------------------------- |
| 原檔                           | `hong-kong-261114.osm.pbf`                                            |
| 來源                           | https://download.geofabrik.de/asia/china/hong-kong-261114.osm.pbf     |
| MD5 sidecar                    | https://download.geofabrik.de/asia/china/hong-kong-261114.osm.pbf.md5 |
| 下載日期（UTC）                | 2026-11-16；PBF 及 MD5 各下載一次，沒有 retry                         |
| 大小                           | 37,898,384 bytes                                                      |
| 官方 MD5／實際 MD5             | `a585484ef8ac2181d6dcce07f0e7bdba`，一致                              |
| SHA-256                        | `adb3fab0be54bf52155ff98fc1d1f09195f634889c7da397ede3893ec851f9ad`    |
| **檔頭 replication timestamp** | **2026-11-14T21:20:41Z**                                              |
| 檔頭 replication sequence      | 845                                                                   |

截止時間從 Reader.header 直接讀取，不使用網頁時間、檔名或下載日期推算。證據：`data/raw/geofabrik-source.json`；原始 `.md5` 隨 repo 保留。PBF 與 Python venv 被 Git 忽略。

## 本輪決定及建置結果

- **宋皇臺例外已批准**：只限 `TML:SUW`、OSM ref `SWT`、nodes `2308404918`／`2308405006`；`data/station-ref-overrides.json` 有 source/reason。原官方碼與原 OSM ref 都保留，不放寬任何其他匹配。
- **TCL 未批准**：三條指定 way 標為 `uncertain-construction`，不進網絡或動畫路徑；relation 5317704 不重排、不畫補線。詳見 [東涌線核對報告](docs/tcl-extension-check.md)。不判定營運狀態。
- **全部 120／120 站鍵恢復**；九線預覽有 **773 features、112 線路站鍵、96 個站碼**。整條 TCL 不在預覽 payload；UI 標示「待核實」。
- **layer 證據不足**維持 unknown，17 個相對 layer 不再推成地下／高架；所有圖層同樣式。座標原值不平均；UI 不稱官方站中心。
- **線色未核實**：colour_source=osm-unverified，等待使用者提供官方線色表。
- **轉乘未確認**：42 對候選另存 `data/reports/interchange-candidates.json`；未確認不顯示為轉乘站。

完整授權與決定：[source-review.md](docs/source-review.md)；架構：[DESIGN.md](docs/DESIGN.md)。未知 ref 衝突或未記錄 route gap 仍阻塞。已記錄 TCL gap 作警告保留，不視為擅自修復。

## 發佈隔離

不產生 `public/data/network.geojson`、`stations.json` 或 `lines.json`，也不作 Sites 部署。開發 payload 只在 `data/reports/development-map.json`（Git 忽略），由 Vite dev-only middleware 讀取，不 import 入 client bundle，不靜態拷貝，不與 Hono production 端點共用。

`data/reports/uncertain-ways.geojson` 是原始三條待核實 way 的**審核資料**，不提供給地圖；`animation-routes.json` 明確排除三條 way，TCL 額外標記 usableForAnimation=false。這些報告不是可發佈路網。

## 瀏覽器視覺及互動 QA

Linux 系統 Chromium + Playwright（已安裝時）：

```bash
python -m pip install -r requirements-qa.txt
# 保持 npm run dev 運行；使用系統 /usr/bin/chromium
python scripts/qa-map.py
```

腳本檢查九線 payload、無 public 輸出、站碼保留、路線篩選、旋轉、傾斜、繁中／英文、手機搜尋、地圖點站及 attribution。畫面取樣為 1440×1000 桌面及 390×844 手機；軟件 WebGL，不代表真實手機 GPU／電量效能驗收。

截圖在 [docs/screenshots](docs/screenshots)，完整結果見 [驗證紀錄](docs/verification.md)。未包含 TCL、即時列車、PWA 安裝或 3D 車款模型。

## 主要報告與契約

- `docs/osm-tag-report.md`、`docs/build-warnings.md`：每次本地解析生成實際 tags 與完整警告。
- `docs/tcl-extension-check.md` 及同名 JSON：五條 way 的 bbox、長度、最近原節點、完整 tags、全 PBF 直接 relation 隸屬、附近軌道比較、斷口距離；推導值明確標記。
- `packages/shared/src/network.ts`：network/stations/development payload 的 Zod schema。
- `scripts/fixtures/pbf-junctions.json`：真實 PBF 擷取的小範圍子集，原 ID/tags/coordinates 保持。
- `data/interchange-overrides.json`：空白，待人工；`segment-overrides.json`：空白，待來源證據。
- `data/reports/overpass-cross-check.json`：歷史快照只交叉驗證，不補線。
- `data/reports/csv-warnings.json`：獨立 M0 CSV 警告，不覆蓋 PBF warnings。

## 資料來源與授權

| 資料                    | 來源／權利擁有人                                                                                                              | 授權／狀態                                                                                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PBF、原始子集及推導資料 | Geofabrik；© OpenStreetMap contributors                                                                                       | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)、[OSM copyright](https://www.openstreetmap.org/copyright)；保留來源及署名                                                   |
| 站名／站碼 CSV          | [港鐵官方 CSV](https://opendata.mtr.com.hk/data/mtr_lines_and_stations.csv)；© 香港鐵路有限公司                               | [DATA.GOV.HK 資料集](https://data.gov.hk/tc-data/dataset/mtr-data-routes-fares-barrier-free-facilities)、[使用條款](https://data.gov.hk/tc/terms-and-conditions)；第三方額外條款另核對 |
| 宋皇臺例外依據          | 使用者核對的 [Next Train v1.6 資料字典](https://opendata.mtr.com.hk/doc/Next_Train_DataDictionary_v1.6.pdf)、站圖檔名 suw.pdf | 只作指定節點身份核對，並非已接入 Next Train API                                                                                                                                        |
| 開發底圖                | [OpenFreeMap](https://openfreemap.org/)，OpenMapTiles，© OpenStreetMap contributors                                           | 免費向量底圖；保留底圖自帶 attribution 及本機資料署名；外部圖磚需連網，沒有 bulk download／離線快取                                                                                    |
| 線色                    | PBF relation colour                                                                                                           | **OSM 未核實**；不是已核對的官方線色表                                                                                                                                                 |
| UI 語彙                 | [VoltAgent Linear 設計分析](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/linear.app/DESIGN.md)          | MIT；深色雙語地圖工作區改編，未使用專有字型或商標                                                                                                                                      |

## 免責聲明

獨立非官方作品，並非港鐵製作、認可或營運。來源資料不保證準確、完整、及時；原始平台／車站節點不是官方站中心。沒有即時 GPS、到站預報或列車動畫。出行請以港鐵公告及現場資訊為準。
