# 最新來源決定：東涌線新路段（2026-11-17）

使用者最新明確指示「東涌線現在是行新路線的，直接補完，只是新站未開啟，可以加入，只需要寫站未開通」。此決定取代下文先前的 TCL 暫停。十條重鐵線可進入玩具城市；玩具動畫仍是模擬，並非真實車次或 GPS。

## 指定順序例外與原始幾何

只對 relation **5317704** 套用 data/relation-order-overrides.json：將原 track member 索引 51、52、53 的 ways **1176509649 → 1558652644 → 1558652643** 移到 **1558652640** 與 **1558652637** 之間。其他 51 個 way 保持原序；完整原始 track 順序與四個接點 ID 都受驗證，任何變更立即停止，不採最近鄰接線或座標 snapping。

| 接點                    | 共用原始 node ID |
| ----------------------- | ---------------- |
| 1558652640 → 1176509649 | 10930801895      |
| 1176509649 → 1558652644 | 10930801903      |
| 1558652644 → 1558652643 | 13238819880      |
| 1558652643 → 1558652637 | 10931051406      |

修正後為單一無斷點 TCL:TUC → TCL:HOK 路徑。測試逐段驗證每條邊都存在於原 way，沒有新增軌道或估算座標。原 relation members 不改寫，原兩處排序斷口仍在 routes.json 與 tcl-extension-check.md 作審核證據；動畫路徑另記 orderOverrideApplied=true。

三條 way 的原 description 仍為「Tung Chung Line Extension (Construction)」，start_date 仍照錄；data/way-review-status.json 記錄來源差異、使用者確認與理由。這是使用者提供的營運狀態確認，不偽稱代理已取得官方公告。

## 新站：未開通

| 站名                   | 原始 OSM node | 原座標（lon,lat）        | 狀態   |
| ---------------------- | ------------- | ------------------------ | ------ |
| 東涌東 Tung Chung East | 11039819034   | [113.9586238,22.2972245] | 未開通 |
| 東涌西 Tung Chung West | 11039819033   | [113.9342024,22.2811256] | 未開通 |

這兩個原始節點有 railway=construction／construction=station，東涌東另保留 note=tentative name。它們進入 toyWorld.upcomingStations，與官方 CSV 的 120 個線路站鍵分開，不虛構 Station Code、不打 Next Train API。東涌西以原節點獨立展示，沒有手繪或估算接線。

已有宋皇臺的單站例外、unknown layer、平台 alternatives、未確認轉乘候選及 osm-unverified 色碼標示不變。原 owner-private Site 訪問設定保留。

---

以下為先前階段的核對紀錄，TCL 暫停條文已被上文最新決定取代；原始來源與量度事實仍保留。

# 最新交付授權補充

使用者最新要求「直接給成品、所有事情自己解決、不用批准」。因此不再等待 TCL 或色表的逐項批准才交付九線玩具產品；只交付已有來源路網的玩具／模擬體驗，TCL 仍休息、三條不確定 ways 不進入模型，未自行修復或確認營運。原 owner-private Site 訪問設定保留。以下為此前逐項核對紀錄，來源事實及單站例外不變。

# 來源核對與使用者決定（2026-11-17）

來源 Geofabrik `hong-kong-261114.osm.pbf`；MD5 `a585484ef8ac2181d6dcce07f0e7bdba`；SHA-256 `adb3fab0be54bf52155ff98fc1d1f09195f634889c7da397ede3893ec851f9ad`。PBF 檔頭截止時間：`2026-11-14T21:20:41Z`。

## 宋皇臺：已批准指定節點例外

| 來源     | 識別       | 保留的原始資料                    |
| -------- | ---------- | --------------------------------- |
| 官方 CSV | TML:SUW    | 宋皇臺 / Sung Wong Toi            |
| PBF node | 2308404918 | ref=SWT；[114.1914338,22.3258764] |
| PBF node | 2308405006 | ref=SWT；[114.1913624,22.3260317] |

使用者於 2026-11-17 明確批准：`TML:SUW ↔ OSM ref SWT`，只限上述兩個 node ID。依據為使用者核對的 [Next Train 資料字典 v1.6](https://opendata.mtr.com.hk/doc/Next_Train_DataDictionary_v1.6.pdf)（TML 列出 SUW Sung Wong Toi）及港鐵站圖檔名 `suw.pdf`。本程式沒有猜測該站圖的 URL。

實作於 `data/station-ref-overrides.json`，包含 source、reason、approvedAt。必須同時符合線路、官方站碼、OSM ref 及 node ID，仍需原有名字及 route／stop_area 證據；不作模糊容錯。官方碼存在 stationCode，原 OSM 碼存在 osmRef，並保留 refOverride 來源與理由，不改原始資料。

配對已恢復 **120／120 線路站鍵**。測試證明：換線路站鍵、換 ref、換 node ID 均不適用，其他站的結果不變；未批准的 ref 衝突仍阻塞預覽。

## 東涌線 relation 5317704：未批准排序覆蓋

| 原 track way 索引（0-based） | Way ID     | 起點 node   | 終點 node   |
| ---------------------------- | ---------- | ----------- | ----------- |
| 3                            | 1558652640 | 2291194410  | 10930801895 |
| 4                            | 1558652637 | 10931051406 | 2291194457  |
| 50                           | 249196544  | 2292548144  | 2557051037  |
| 51                           | 1176509649 | 10930801895 | 10930801903 |
| 52                           | 1558652644 | 10930801903 | 13238819880 |
| 53                           | 1558652643 | 13238819880 | 10931051406 |

之前提出的 `0,1,2,3,51,52,53,4,5,...,50` **未批准，也未套用**。不自動重排或以最近鄰補線。保留原始兩處斷口：3→4 約 764.8m、50→51 約 20,910.2m（原節點間直線距離計算；後者不是 20km 缺軌的結論）。

使用者暫時決定：ways `1176509649`、`1558652644`、`1558652643` 標為 **uncertain-construction**，全部排除於路網及動畫 member lists，不只從 TCL 隱藏。原始幾何／status 另存本地審核報告。動畫報告內的 TCL 全部標為 review-held／usableForAnimation=false。

已完成 [tcl-extension-check.md](tcl-extension-check.md)：五條指定及相鄰 way 的 bbox、長度、最近站原節點、完整 tags、全 PBF 直接 parent relation，以及附近其他軌道幾何比較。三條待核實 way 只被 subway relation 5317704 引用，另外亦屬 railway relation 11923016；未因 relation 或日期判定營運狀態。報告沒有把缺失 construction／proposed 欄位視為 false。

未來如批准順序覆蓋，只能對 relation 5317704 的該組有記錄成員套用明確例外，不泛化為最近鄰接線。

## 其他處理決定

- 原 312 個缺 layer 證據及 17 個只有相對 layer 的 way/line feature 均維持 unknown，保留 basis/inferred。三條 uncertain way 不進九線預覽；unknown 不補地面分類。圖層使用統一樣式，不以透明度暗示地下／地面。
- 原 116 組多平台配對照舊選原節點及保留 alternatives；SUW 恢復後總數為 117。原座標未平均、未估算；UI 稱「原始平台／車站節點，非官方站中心」，配對關係標示推斷。
- 全部 colour_source=`osm-unverified`；現只用 OSM relation colour 作開發預覽，不稱官方色碼。等待使用者提供官方線色表。
- 42 對 interchange candidates 未獲人工確認，全部不當作轉乘站；人工覆蓋仍空白。

## 預覽及發佈邊界

**不生成 public 路網，亦不部署網站。** `data:network` 成功代表完成本地審核／九線開發資料，狀態仍為 review-held；不是批准 TCL 或正式發佈。

九線開發資料只存 `data/reports/development-map.json`（Git 忽略），由 Vite development middleware `/__dev/map` 提供；排除整條 TCL，包括其 stations／features；排除三條 uncertain way 的所有線路引用。這個 middleware 不存在於 production build 或 vite preview，沒有靜態拷貝／fallback。

桌面／手機截圖只呈現非 TCL 九線；TCL 標示「待核實」，無補線、列車或轉乘宣稱。未知新站碼衝突或非已記錄的 route gap 仍使建置 exit 2，刪除舊預覽以防誤用。
