# 官方預報與跟車更新（2026-11-18）

沿用現有 Figma 色彩語彙、立體玩具城市和兒童操作，新增兩種模式、實時預報多車、逐架選車、GPS 附近推薦及參考真實車款的原創玩具模型。功能及資料限制以 LIVE.md、rolling-stock.md 為準；原先「只有模擬、官方僅看板」說明是此前版本記錄。

官方資料的時間、方向、終點、月台與延誤由 Next Train 提供；位置、虛擬身份、模型速度／停站仍為推算。定位不能辨認使用者乘搭的實車，API 也不能識別班次車款。所有這些界線在 UI 保留。

# 港鐵玩具城：立體城市更新

2026-11-17 最新使用者決定：東涌線沿新走線展示，新站未開通；整張地圖改成密集的 3D 卡通玩具城市。這節取代下方九線／TCL 暫停的歷史說明。

- 十線、97 個不同官方站碼、120 個線路站鍵、12 條玩具往返路徑。TCL 只套用指定 relation 的原始節點順序例外，沒有畫補線。東涌西目前只顯示來源站點，沒有虛構延伸接線。
- 東涌東／西使用 PBF 原始 construction station 節點，獨立 upcomingStations，不造官方站碼或接入到站 API；標示「未開通」。
- 自製 MapLibre toyStyle 取代普通 bright 底圖：奶油色粗道路、圓角描邊、淡色土地、波浪海面；沒有普通底圖 POI／路名／地形陰影。
- 本地 PBF 建築 footprint 面積重心用作玩具樓宇錨點（明示計算／推斷），每 145m 格選最大來源建築；原始 peak nodes、park polygons、bridge road ways 供山丘、公園及玩具高架道路。樓高／山高／尺寸／樹木偏移是美術示意，不當實測地形、地址或導航資料。
- 12,535 棟原創積木樓房、屋頂凸粒、窗戶／露台、密集樹木和源自地理峰點的低多邊形山丘；具名來源地標放原創誇張模型，來源 ID／tags 保存於 toy-city.json。
- three.js instanced meshes 共用幾何與材質；每條路徑有彩色道床、棕色枕木、雙鋼軌。地下路段同樣展示為玩具軌道；所有高度只是展示，不表示真實高架分類。
- 初始視角集中維港城市；「全港」按鈕看全路網，路線按鈕取景該線，跟車進入小城市。

沿用已讀 VoltAgent Figma DESIGN.md 的 cream/mint/lilac 色塊、圓角和 pill 操作。3D 城市、列車、地標為原創幾何美術，不使用其商標或專有字體。© OpenStreetMap contributors／ODbL、OpenFreeMap／OpenMapTiles 署名保留。

## 先前交付記錄

使用者最新指示為直接交付成品、由代理自行解決及決定 UI、不再逐項批准。這取代之前只供 dev preview 的發佈暫停；保留原有來源完整性，不將未核實 TCL 當成已營運。部署到原 harbour-rail-hk Site，保留其 owner-only 訪問設定。

## 視覺

採用已讀取的 VoltAgent **Figma** DESIGN.md（https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/figma/DESIGN.md，MIT 設計分析），用 cream #f4ecd6、mint #c8e6cd、lilac #c5b0f4 的色塊、圓角及 pill 操作適配小朋友。字體使用系統字體，不使用 Figma 專有字體／商標。

與上版 Linear 深色工作區不同，現在是暖色玩具城市：奶油色面板、大路線按鈕、原創列車 SVG、three.js 原創雙卡玩具列車和車站主題模型。地標模型只屬站點主題裝飾，不聲稱實際建築座標、外觀或比例。

## 可玩功能

- 九條已可使用的原始 OSM 路網，95 個不同站碼／112 個線路站鍵。
- 11 條無斷點的來源路徑，含東鐵及將軍澳分支；不包含 TCL 或三條 uncertain-construction ways。
- three.js MapLibre custom layer 玩具列車；連續往返、終點停留；暫停／1×3×10×速度、點車／隨機跟車、拖動停止跟車。
- 搜尋站名、點站、收藏、探索任務、附近車站（使用者按下後才要求定位）、可開關的原創 WebAudio 提示音。
- 收藏／探索只在瀏覽器儲存，不上傳位置或兒童資料。
- PWA manifest 與 app-shell service worker；跨來源底圖仍需連線，不宣稱完整離線地圖。

## 真資料與模擬分開

地圖列車是**玩具行程模擬**，不是由到站預報推算的真實列車、不是 GPS、不是官方車號或車款。模型及 UI 均清楚說明，不宣稱完成原先規劃的真實 virtual-trip 合併引擎。

「下一班真車」由 Hono 後端按需查詢官方 Next Train API。已讀資料字典 v1.7：status 1=normal，0=error/alert；ttnt、valid、source 為 dummy，不用它們判斷列車或倒數。倒數由官方 time（香港時間）計算，與玩具列車沒有對應。

每個 key 15 秒 cache、in-flight 合併、最多 2 個並發、每 isolate 每分鐘最多 30 個未快取請求、8 秒 timeout、上游連線失敗後 30 秒退避。瀏覽器展開看板時每 30 秒刷新，關閉即停；service worker 不 cache API。資料過時或錯誤會明示，不用模擬資料代替。

官方樣本 data/raw/next-train-suw-20261117.json 於 2026-11-17 UTC 取得，來源 https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=TML&sta=SUW&lang=TC ，© 香港鐵路有限公司。沒有將受版權 PDF 複製入 repo。

## 發佈架構

Vite app 及 toy-world snapshot 編入 Sites Worker 靜態資產；Hono 同一 Worker 提供 /api/board，前端不直接查官方 API。使用 esbuild 打包 dist/server/index.js；保留原 Site project_id，移除 static manifest 以使用 Worker。憑證只透過隱藏 stdin 傳 Git process，不保存於檔案。

PBF 本身不發佈，只使用已有署名的衍生九線資料。OpenFreeMap／OpenMapTiles／OpenStreetMap attribution 保留。TCL 仍顯示休息／待核實，沒有自動重排、補線或變更其營運狀態。

### 效能與鏡頭補充

大型 instanced 批次按 4km 地理方格分割，計算 bounding spheres，使用 MapLibre 相機矩陣作 frustum culling，避免每格都繪製全港 12,535 棟來源樓宇。城市視圖放大玩具建築的尺寸與高度、在具名地標附近留出展示空間；這些都是已標示的美術處理。預設聚焦維港，仍可按全港回到路網概覽。

玩具樹林與積木樓宇放在同一個示意山丘曲面上，避免被山體遮蔽；這是美術排布，不是地形測量或真實建築海拔。場景在 style.load 時建立，不等待全部地理圖磚。
