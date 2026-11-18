# 2026-11-17：九線開發預覽驗證

本次不是 public 發佈／TCL 營運核准。原始 PBF、MD5、SHA-256 及檔頭時間均延續已驗證的 2026-11-14 extract；沒有重新下載或 fallback。

## 資料與隔離

- 全量配對 **120／120**。SUW 官方碼與 SWT OSM ref 均保留；例外僅兩個批准 node ID、有 source/reason。測試涵蓋其他 key、ref、node 不受豁免。
- 三條 uncertain-construction way 不在任何候選網絡或 animation member list；原始幾何只存在本地審核報告。TCL 動畫資料額外 review-held／usableForAnimation=false。
- 開發 payload **773 features、112 線路站鍵、96 站碼／9 線**，沒有 TCL line/station feature；三條 uncertain way 均不存在。
- 312 缺欄與 17 相對層級 feature 均保留 unknown。所有 colour_source=osm-unverified；不把 source node 說成官方站中心。
- 42 對轉乘候選尚無批准，沒有顯示為轉乘站。
- public/data 沒有 network.geojson、stations.json 或 lines.json。只有 configureServer 的 dev-only JSON endpoint；production bundle／vite preview 無資料 middleware。

## 自動檢查

| 檢查                   | 結果                                                               |
| ---------------------- | ------------------------------------------------------------------ |
| `npm run build`        | 通過：TypeScript、CSV/PBF 審核、web/API build；狀態 review-held    |
| `npm test`             | 通過：7 個測試檔、51 個測試                                        |
| `npm run lint`         | 通過：ESLint、Prettier                                             |
| `npm run data:network` | 完成審核和九線 dev payload；無 public 輸出，未知來源衝突仍 exit 2  |
| PBF header             | `2026-11-14T21:20:41Z`；直接 Reader.header                         |
| TCL gaps               | 原始排序 3→4：764.8m；50→51：20,910.2m；只計算距離，未畫補線／重排 |

Vite build 有既有 Zod 註解位置 warning，另有 MapLibre bundle 超過 500kB 的 chunk warning（整體 JS 約 1.39MB，gzip 約 390kB）；成功編譯，沒有隱藏警告。這不是手機效能／載入速度已達標的結論。

額外檢查本機 `vite preview`（127.0.0.1:5174）的 /__dev/map：只回應 SPA HTML fallback，沒有 JSON/data middleware；未將路網拷貝入 dist。九線 dev payload 與動畫資料的三條排除 way／TCL hold 亦再次核對。

## 瀏覽器視覺與互動

使用系統 **Chromium 156.0.8078.79**、Playwright 1.62.0、headless 軟件 WebGL。不是模擬的地圖截圖，也不是人工畫圖；畫面載入真實 OpenFreeMap 向量底圖與已過濾的本地 OSM 原始幾何。

- 桌面 viewport：1440×1000；手機 viewport：390×844，device scale factor 1。
- 底圖／字型／dev 資料全部成功；page errors、失敗 request、HTTP 4xx/5xx 均為 0。React StrictMode 首個取消 fetch 是預期行為，沒有當成服務失敗。
- 頁面沒有橫向溢出。手機控制掣與車站資訊卡關閉掣不重疊。
- 操作驗證：線路篩選；TCL 停用且顯示待核實；pitch 55°、bearing 30°；重設；中英切換；手機搜尋宋皇臺；實際 canvas 點站；原碼雙方顯示；資料來源／署名視窗。
- MapLibre 的 OpenFreeMap／OpenMapTiles／OpenStreetMap attribution 保持可見，本地 OSM 資料另有來源說明。

完整腳本 `scripts/qa-map.py`；機讀結果 `data/reports/browser-qa.json`。

| 截圖                                             | 證明範圍                                            |
| ------------------------------------------------ | --------------------------------------------------- |
| [桌面九線](screenshots/desktop-network.png)      | 非 TCL 全圖、宋皇臺原碼資訊卡、待核實提示           |
| [桌面旋轉／傾斜](screenshots/desktop-tilted.png) | bearing 30°、pitch 55°，仍使用九線資料              |
| [手機九線](screenshots/mobile-network.png)       | 390px 版面、控制、TCL 待核實、底圖 attribution      |
| [手機宋皇臺](screenshots/mobile-station.png)     | 搜站後放大、官方 SUW／OSM SWT、原節點及替代節點說明 |

這些結果不證明 TCL 營運狀態、官方線色正確性、真實手機 GPU／耗電、PWA 離線安裝、3D 車款或即時列車推算。上述事項不在本輪已通過範圍。

## 最終玩具城市版本

最新產品指令取代原 dev-only 交付暫停。已完成 3D 原創雙卡玩具列車、車站主題模型、跟車／播放速度、收藏／探索任務、手機路線抽屜與 PWA shell。線路位置仍來自原始九線 OSM 資料；TCL 不自行補接或確認營運。Figma pastel 模板改編，參見 PRODUCT.md。

- TypeScript / Vite / API build、56 個單元測試及 lint 通過；包括 official proxy request coalescing/cache、status 0、無效參數和玩具終點連續性。
- 本機 Chromium 桌面 1440×1000、手機 390×844，three.js 圖層沒有 JS error，沒有橫向溢出。
- 已驗證跟車、加速、暫停、搜尋、收藏、手機選線、車站資訊卡關閉與家長資訊。
- 官方 API fixture 及 Hono proxy 已驗證；受管理環境需要 Node 24 的 `NODE_USE_ENV_PROXY=1`，啟用後 /api/board 回傳 official，含 UP/DOWN。沒有把連線失敗偽裝成官方資料。
- Worker artifact 可直接回應首頁、manifest、toy-world、service worker 及 health；PWA precache 包含 app JS/CSS；API 永不由 SW 快取。
- 玩具速度不是實際時刻表；未聲稱完成原先規劃的真實 virtual-trip 合併或 GPS。模型不對應實際港鐵車款，車站主題模型不是精確建築比例。

最新截圖：toy-desktop.png、toy-follow.png、toy-mobile.png、toy-mobile-station.png、toy-official-board.png，均在 screenshots/。

## 立體玩具城市更新（2026-11-17）

TCL 已按使用者最新走線確認套用指定 relation 原始 node 順序例外；十線全部有玩具路徑。建築、道路高架、山丘、公園和具名地標從同一本地 PBF 建置；美術高度／尺寸不是測量值。

Managed preview 的 dev port 支援已修正，但 relay 回報 `could not open browser port 4173: timed out waiting for relay readiness`，status=stopped；沒有修改網路權限或替換 relay。後續視覺驗收使用專案既有 headless Chromium／Playwright runner，直接檢查部署的正式 Site（登入旁路 token 只由隱藏 stdin 傳入，不寫入截圖或檔案）。

目前交付檢查：`npm run build` 全量本地 PBF／CSV／城市建置成功；後續鏡頭、分塊裁切及山丘排布修改亦通過 typecheck、Vite build 與 Worker build；`npm test` 62／62、`npm run lint` 成功。Vite 仍提示 three.js／MapLibre 主 bundle 超過 500 kB，屬已知體積提示，非建置失敗。

正式 Site 最終版本全套互動驗收已通過：10 線、12 條玩具路徑、12,535 個來源建築錨點、13 款具名來源地標模型；東涌線跟車、東涌東／西搜尋及未開通卡、未開站無 API 看板、官方 SUW 看板 state=official、390×844 無橫向溢出；pageErrors=[]。最終美術更新由相同 runner 全套重驗成功；桌面截圖 19:09:26 UTC、手機截圖 19:11:15 UTC、手機未開站卡 19:11:47 UTC。

最終截圖：`city-desktop.png`、`city-tcl.png`、`city-unopened.png`、`city-mobile.png`、`city-mobile-unopened.png`；機器可讀報告在 `data/reports/city-qa.json`。裝置為 Linux Chromium 的 1440×1000／390×844 viewport、software WebGL；不把此檢查當成實體手機 GPU／FPS 驗收。玩具動畫仍非真實列車定位，模型高度和尺寸仍為示意。

## 官方預報與逐架跟車（2026-11-18）

本節是現行交付狀態；上面的九線暫停、只有模擬／未有 trip 推算說明屬歷史記錄。

- `npm run build` 全量離線建置已通過。新增共享快取與請求範圍修正再通過 TypeScript、Node/API build、Worker build、ESLint／Prettier；目前 **14 個測試檔、80 個測試通過**。Vite／esbuild 仍有 bundle 體積提示，不當成建置錯誤或實體手機效能保證。
- 官方字典 v1.7、真實 API fixtures、明確標示的合成延誤／離站／中斷案例，覆蓋方向／分支、短途目的地、虛擬 ID 延續、凍結 60 秒預報的到站錨點、時間修訂平滑追趕、背景恢復、終點、限速／timeout／退避，以及 D1 跨請求累積與看板 TTL。
- 正式 Site 的 121 個線路／車站鍵已逐批輪詢。02:28:44 UTC 快照：108 鍵已載入，93 鍵新鮮，148 架**推算班次**；unmapped=0、cacheState=d1，整輪無 HTTP 500。這些不是物理真車數或全港同步 GPS 快照。詳見 data/reports/live-api-audit.json；各線有真實更新時間及 partial/unavailable 狀態。
- 港島線本輪官方 status1 但缺有效時間與班次，清楚顯示暫未有預報。迪士尼線雖有新鮮看板，本輪沒有足以推出目前行駛中班次的證據，因此沒有捏造車輛。新短途終點只按帶來源的三個明確例外處理。
- 已對正式網站進行完整 Playwright／Chromium 驗收：1440×1000 桌面、390×844 手機，software WebGL。驗證官方多架列車、1×真實時鐘、手動選擇及跟隨同一虛擬 ID、原創代表車款、定位成功與附近推薦、實際瀏覽器拒絕定位、受控 API 斷線提示、模擬選車與暫停、手機將軍澳線，以及家長說明。pageErrors=[]、沒有橫向溢出。
- 定位採測試用座標模擬成功場景，拒絕權限由 Chrome 實際 permission 設定觸發；沒有聲稱已在實體地鐵／地下 GPS 實測。測試只向本站來源加入私有登入旁路標頭，不傳給地圖或官方 API，也不寫入截圖。
- 前端截圖版本及資產 SHA-256 記錄在 data/reports/live-qa.json；其後只有車站看板的 D1 TTL 修正與文件，前端 bundle 不變。看板 TTL 另有跨新請求實例的測試。

| 截圖                                          | 證明範圍                                       |
| --------------------------------------------- | ---------------------------------------------- |
| [官方多車桌面](screenshots/live-desktop.png)  | 官方預報／推算模式、資料覆蓋與玩具城市         |
| [指定列車跟隨](screenshots/live-follow.png)   | 方向、終點、倒數、來源時間與推算班次識別       |
| [定位推薦](screenshots/live-location.png)     | 瀏覽器位置與附近預報車跟隨，不表示辨認所乘真車 |
| [受控斷線](screenshots/live-interruption.png) | 中斷明示，不切入模擬車冒充                     |
| [模擬暫停](screenshots/live-simulation.png)   | 兩種模式分離、模擬播放控制                     |
| [手機官方跟車](screenshots/live-mobile.png)   | 將軍澳線、390px 版面、資料卡及控制             |

無列車 GPS／實際車號可作 ground truth，尚不能量化真車位置誤差或保證每個虛擬班次身份永遠不變；密集班次／預報大幅修訂仍可能漏畫、合併或失去跟隨身份。UI 明示推算、校正與中斷，失去身份不自動換另一架。沒有將模型外觀說成該班實際車款，也沒有聲稱實體手機 FPS／耗電已驗收。
