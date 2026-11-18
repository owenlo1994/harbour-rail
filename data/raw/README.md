# 原始資料來源與署名

`mtr_lines_and_stations.csv`：© 香港鐵路有限公司／MTR Corporation Limited。來源 https://opendata.mtr.com.hk/data/mtr_lines_and_stations.csv ，DATA.GOV.HK 登錄 https://data.gov.hk/tc-data/dataset/mtr-data-routes-fares-barrier-free-facilities 。來源條款 https://data.gov.hk/tc/terms-and-conditions ，並須核對第三方提供者額外條款。日期、hash 見 ../../docs/source-audit.json。

`overpass-4-subway.json`、`overpass-4-light_rail.json`：© OpenStreetMap contributors，ODbL 1.0：https://www.openstreetmap.org/copyright ，https://opendatacommons.org/licenses/odbl/1-0/ 。保存完整原始回應；未修改 geometry。資料取得時間與來源 endpoint 見 overpass-attempts.json，查詢見同名 .overpass；.tags.json 為 tag 統計，非另一個來源。

其他 overpass 檔案為失敗回應／headers／查詢記錄，不代表有效地理資料。所有快照隨 repo commit 保存。未有 CSDI 輸入；不將程式碼授權套用到任何第三方原始資料。

Geofabrik 本地來源：hong-kong-261114.osm.pbf（Git 忽略）；© OpenStreetMap contributors，ODbL 1.0。來源 URL https://download.geofabrik.de/asia/china/hong-kong-261114.osm.pbf ，抓取日期及 MD5/SHA-256/PBF header 證據見 geofabrik-source.json。原始 .md5 sidecar 隨 repo 保存。沒有再次請求 Overpass；舊回應只交叉核對。

官方 Next Train 樣本 next-train-suw-20261117.json：© 香港鐵路有限公司；2026-11-17 UTC 取得，來源 URL 及欄位解讀見 docs/PRODUCT.md；資料字典 PDF 未放入 repo。
