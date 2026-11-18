# Overpass 單輪取得紀錄與實際 tag 統計

開始：2026-11-16T07:52:40.120329+00:00；結束：2026-11-16T07:55:31.153863+00:00。

固定 User-Agent：`hk-mtr-live/0.1 (+CONTACT_EMAIL_NOT_PROVIDED)`；聯絡電郵未提供。

POST application/x-www-form-urlencoded `data=<Overpass QL>`；HK bbox (22.15,113.80,22.57,114.45)。請求依序執行，沒有平行請求；沒有遇到 429。

## 每次請求

| Endpoint                                        | route type | HTTP         | curl exit | 結果 |
| ----------------------------------------------- | ---------- | ------------ | --------- | ---- |
| https://overpass-api.de/api/interpreter         | subway     | 503          | 0         | 失敗 |
| https://overpass.private.coffee/api/interpreter | subway     | 無 HTTP 回應 | 28        | 失敗 |
| https://overpass.kumi.systems/api/interpreter   | subway     | 無 HTTP 回應 | 28        | 失敗 |
| https://z.overpass-api.de/api/interpreter       | subway     | 200          | 0         | 成功 |
| https://z.overpass-api.de/api/interpreter       | light_rail | 200          | 0         | 成功 |
| https://z.overpass-api.de/api/interpreter       | train      | 502          | 0         | 失敗 |

主站 503 回應為上游連線逾時；private.coffee／kumi 各 50 秒無資料；z 的 train 502 回應明示容量與佇列已滿。完整錯誤、日期及查詢路徑見 `data/raw/overpass-attempts.json`。stations 查詢未執行，未再重試。

## 成功回應：實際見到的 tags

以下僅計 relation-level tags；out body geom 不提供獨立 member-way tags，故不能把這份統計當作軌道 tunnel／bridge／layer 完整度。

### subway

抓取：2026-11-16T07:54:55.527322+00:00；原始檔：`data/raw/overpass-4-subway.json`。

SHA-256：`cc5b1df8bb817804d2d5af3ba27de991ebd7594f7484369057c5585da67cde3c`。

relation 數：54。Member type 計數（可能跨 relation 重複）：{'node': 569, 'way': 3425, 'relation': 6}。

實際 ref：`TWL` × 2、`TKL` × 6、`KTL` × 7、`EAL` × 23、`ISL` × 2、`DRL` × 2、`AEL` × 2、`TCL` × 4、`TML` × 4、`SIL` × 2。

| Tag                         | 出現 relation 數 |
| --------------------------- | ---------------- |
| `air_conditioning`          | 4                |
| `brand`                     | 30               |
| `brand:en`                  | 30               |
| `brand:wikidata`            | 16               |
| `brand:zh`                  | 30               |
| `class`                     | 6                |
| `colour`                    | 54               |
| `description`               | 35               |
| `description:en`            | 35               |
| `description:zh`            | 35               |
| `direction:official_ref`    | 8                |
| `direction:official_ref:en` | 8                |
| `direction:official_ref:zh` | 8                |
| `direction:ref`             | 32               |
| `direction:ref:en`          | 32               |
| `direction:ref:zh`          | 32               |
| `electrified`               | 4                |
| `frequency`                 | 10               |
| `from`                      | 54               |
| `from:en`                   | 46               |
| `from:ref`                  | 16               |
| `from:zh`                   | 46               |
| `gauge`                     | 10               |
| `maxspeed`                  | 6                |
| `name`                      | 54               |
| `name:en`                   | 54               |
| `name:zh`                   | 54               |
| `name:zh-Hans`              | 1                |
| `name:zh-Hant`              | 1                |
| `network`                   | 54               |
| `network:en`                | 54               |
| `network:ref`               | 14               |
| `network:short`             | 8                |
| `network:wikidata`          | 51               |
| `network:wikipedia`         | 19               |
| `network:zh`                | 54               |
| `network:zh-Hans`           | 54               |
| `network:zh-Hant`           | 54               |
| `not:network:wikidata`      | 3                |
| `note:route`                | 7                |
| `old_name`                  | 2                |
| `old_name:en`               | 2                |
| `old_name:zh`               | 2                |
| `opening_hours`             | 10               |
| `operator`                  | 54               |
| `operator:en`               | 54               |
| `operator:wikidata`         | 51               |
| `operator:wikipedia`        | 4                |
| `operator:zh`               | 51               |
| `operator:zh-Hans`          | 51               |
| `operator:zh-Hant`          | 51               |
| `owner`                     | 28               |
| `owner:en`                  | 28               |
| `owner:wikidata`            | 28               |
| `owner:zh`                  | 28               |
| `ownership`                 | 7                |
| `passenger`                 | 29               |
| `passenger_lines`           | 1                |
| `public_transport:version`  | 54               |
| `railway:traffic_mode`      | 12               |
| `ref`                       | 54               |
| `route`                     | 54               |
| `service`                   | 26               |
| `short_name`                | 4                |
| `short_name:en`             | 4                |
| `short_name:zh`             | 4                |
| `start_date`                | 6                |
| `to`                        | 54               |
| `to:en`                     | 45               |
| `to:ref`                    | 17               |
| `to:zh`                     | 45               |
| `train`                     | 2                |
| `type`                      | 54               |
| `usage`                     | 19               |
| `via`                       | 23               |
| `via:en`                    | 21               |
| `via:zh`                    | 21               |
| `voltage`                   | 10               |
| `was:colour`                | 2                |
| `was:name`                  | 2                |
| `was:name:en`               | 2                |
| `was:name:zh`               | 2                |
| `was:ref`                   | 2                |
| `wheelchair`                | 4                |
| `wikidata`                  | 29               |
| `wikipedia`                 | 10               |

關鍵 tag 的實際值：

- `operator`：`香港鐵路有限公司 MTR Corporation` × 54。
- `network`：`港鐵 MTR` × 54。
- `route`：`subway` × 54。
- `colour`：`#ed1d24` × 2；`#7d499d` × 6；`#00ab4e` × 7；`#53b7e8` × 23；`#007dc5` × 2；`#f173ac` × 2；`#00888a` × 2；`#f7943e` × 4；`#923011` × 4；`#B6BD00` × 2。
- `direction:official_ref`：`下行 Down` × 5；`上行 Up` × 3。
- `direction:ref`：`西行 Westbound` × 5；`下行 Down` × 12；`上行 Up` × 12；`東行 Eastbound` × 3。
- `from:ref`：`ADM` × 11；`CHW` × 1；`KET` × 1；`TUM` × 2；`WKS` × 1。
- `to:ref`：`ADM` × 11；`KET` × 1；`CHW` × 1；`WKS` × 1；`TUM` × 2；`HUH` × 1。
- `tunnel`：未見於 relation-level tags。
- `bridge`：未見於 relation-level tags。
- `layer`：未見於 relation-level tags。

完整每個 tag 的值與次數見同名 `.tags.json`；不只列出預期存在的欄位。

### light_rail

抓取：2026-11-16T07:55:29.604496+00:00；原始檔：`data/raw/overpass-4-light_rail.json`。

SHA-256：`51ac710750ab84b042fb0eec7ccbb9743eee829abf79a88bf1b5193e400d0d5d`。

relation 數：31。Member type 計數（可能跨 relation 重複）：{'node': 425, 'way': 1219}。

實際 ref：`751` × 2、`751P` × 3、`705` × 1、`706` × 1、`761P` × 2、`505` × 2、`507` × 2、`610` × 2、`614` × 2、`615` × 2、`614P` × 2、`615P` × 2、`（缺少）` × 8。

| Tag                                 | 出現 relation 數 |
| ----------------------------------- | ---------------- |
| `access`                            | 6                |
| `access:conditional`                | 6                |
| `automated`                         | 6                |
| `brand`                             | 23               |
| `brand:en`                          | 23               |
| `brand:wikidata`                    | 23               |
| `brand:zh`                          | 23               |
| `colour`                            | 23               |
| `disused:via`                       | 2                |
| `disused:via:en`                    | 2                |
| `disused:via:zh`                    | 2                |
| `fee`                               | 6                |
| `from`                              | 29               |
| `from:en`                           | 6                |
| `from:zh`                           | 6                |
| `level`                             | 1                |
| `light_rail`                        | 8                |
| `name`                              | 31               |
| `name:en`                           | 26               |
| `name:ja`                           | 2                |
| `name:zh`                           | 25               |
| `network`                           | 23               |
| `network:en`                        | 23               |
| `network:wikidata`                  | 23               |
| `network:zh`                        | 23               |
| `network:zh-Hans`                   | 1                |
| `network:zh-Hant`                   | 1                |
| `no:brand`                          | 7                |
| `no:network`                        | 7                |
| `not:brand`                         | 7                |
| `not:brand:en`                      | 7                |
| `not:brand:wikidata`                | 7                |
| `not:brand:zh`                      | 7                |
| `not:network`                       | 7                |
| `not:network:en`                    | 7                |
| `not:network:wikidata`              | 7                |
| `not:network:zh`                    | 7                |
| `opening_hours`                     | 6                |
| `operator`                          | 31               |
| `operator:en`                       | 31               |
| `operator:type`                     | 23               |
| `operator:wikidata`                 | 31               |
| `operator:zh`                       | 31               |
| `operator:zh-Hans`                  | 9                |
| `operator:zh-Hant`                  | 9                |
| `owner`                             | 29               |
| `owner:en`                          | 29               |
| `owner:wikidata`                    | 29               |
| `owner:zh`                          | 29               |
| `ownership`                         | 31               |
| `passenger`                         | 6                |
| `public_transport:network`          | 23               |
| `public_transport:network:en`       | 23               |
| `public_transport:network:wikidata` | 23               |
| `public_transport:network:zh`       | 23               |
| `public_transport:version`          | 25               |
| `railway:network`                   | 23               |
| `railway:network:en`                | 23               |
| `railway:network:wikidata`          | 23               |
| `railway:network:zh`                | 23               |
| `ref`                               | 23               |
| `roundtrip`                         | 2                |
| `route`                             | 31               |
| `security_area`                     | 6                |
| `supervised`                        | 6                |
| `surveillance`                      | 6                |
| `to`                                | 29               |
| `to:en`                             | 6                |
| `to:zh`                             | 6                |
| `type`                              | 31               |
| `via`                               | 2                |
| `via:en`                            | 2                |
| `via:zh`                            | 2                |
| `wikidata`                          | 25               |
| `wikipedia`                         | 25               |

關鍵 tag 的實際值：

- `operator`：`香港鐵路有限公司 MTR Corporation Limited` × 31。
- `network`：`輕鐵 Light Rail` × 23。
- `route`：`light_rail` × 31。
- `colour`：`#F58C14` × 2；`#000000` × 3；`#8CC022` × 1；`#BA85BB` × 1；`#70147B` × 2；`#E6180A` × 2；`#1A8539` × 2；`#8D3219` × 2；`#44ADC3` × 2；`#F4E619` × 2；`#F4858D` × 2；`#006684` × 2。
- `direction:official_ref`：未見於 relation-level tags。
- `direction:ref`：未見於 relation-level tags。
- `from:ref`：未見於 relation-level tags。
- `to:ref`：未見於 relation-level tags。
- `tunnel`：未見於 relation-level tags。
- `bridge`：未見於 relation-level tags。
- `layer`：未見於 relation-level tags。

完整每個 tag 的值與次數見同名 `.tags.json`；不只列出預期存在的欄位。

## 未解決項目

- 已取得 54 個 subway 及 31 個 light_rail relations，並非完整、已驗證的路網輸出。
- subway 十線 ref 全出現，但 EAL、TKL、TCL、TML 等有多個服務 relation；沒有自行選第一條或把全部接在一起。
- light_rail 有 8 個 relation 缺少 ref；不能用名字猜補。此批包含非重鐵服務，是否納入未來地圖要另核對。
- station/stop 節點資料未取得，member-way 的 tunnel/bridge/layer tags 未取得，站碼及拓撲仍無法核實。
- 全部 endpoint 均未完成一整套查詢，但最後一個 endpoint 有部分成功。未啟動 CSDI 網絡後備，未猜測 endpoint。
- 已停止本輪；下一輪或額外 Overpass 請求需新的授權。本地 build 不連網。

來源：© OpenStreetMap contributors，ODbL 1.0。詳見 README 與 data/raw/README.md。
