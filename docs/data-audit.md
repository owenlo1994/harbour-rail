# 官方 CSV 資料審核

來源：[mtr_lines_and_stations.csv](https://opendata.mtr.com.hk/data/mtr_lines_and_stations.csv)

提供及知識產權擁有人：香港鐵路有限公司（MTR Corporation Limited）。資料集登錄於 [DATA.GOV.HK](https://data.gov.hk/tc-data/dataset/mtr-data-routes-fares-barrier-free-facilities)。來源署名及適用條款見 README。

抓取日期：2026-11-16T05:52:50.178276+00:00。這是已保存快照，不是每次 build 重新下載。
SHA-256：`e0e781152e2e6c5f6d7763262acbae76577b71ca4c66b4b7b72a97252175e0c3`。
原始 metadata：`docs/source-audit.json`；可重建審核：`npm run data:audit` → `data/reports/csv-audit.json`、`data/reports/csv-warnings.json`。

## 已確認

| 項目                             | 實際值                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| 欄位                             | Line Code、Direction、Station Code、Station ID、Chinese Name、English Name、Sequence |
| 有效紀錄                         | 270                                                                                  |
| 全空紀錄                         | 3（排除；不把欄位缺漏列當空列）                                                      |
| 唯一 Station Code                | 97                                                                                   |
| 唯一 `(Line Code, Station Code)` | 120                                                                                  |
| 線路                             | AEL、TCL、TML、TKL、EAL、SIL、TWL、ISL、KTL、DRL                                     |
| 自動轉乘候選                     | 21 組（同 Station Code + 中文名；不是官方通道資料）                                  |
| 當前轉乘警告                     | `CROSS_CODE_INTERCHANGES_UNVERIFIED`                                                 |

主鍵一律為線路加站碼。方向序列另外保存；Station ID 不作跨線身份。例如香港站為 `AEL:HOK → 44`，`TCL:HOK → 39`，雖 ID 不同仍產生同碼同中文名轉乘候選。
中文只做 NFC 與空白正規化；不改字、不做相似字詞配對。CSV 出現「茘景」時保留來源原字，不擅自校正為「荔景」。

## 分支與站序

- 東鐵：`UT/DT` 羅湖路徑；`LMC-UT/LMC-DT` 落馬洲路徑。兩者與上水連接，但不將羅湖和落馬洲互連。
- 將軍澳：`UT/DT` 寶琳路徑；`TKS-UT` 實際是 `TIK → TKO → LHP`，`TKS-DT` 為相反方向。保留 token TKS，不把它當 Station Code，也不推斷為全程北角服務。
- 屯馬：每方向 27 站，兩方向序列互為反轉。
- 東涌及機場快綫：分別保留各自站序及站鍵。共用 Station Code 不代表所有軌道幾何相同。
- Next Train 的 UP/DOWN 與 CSV UT/DT 對應尚未核實，這次不設定映射。

## 轉乘人工覆蓋

`data/interchange-overrides.json` 初始為 `{"version":1,"groups":[]}`。每個 group 需 id、members（line、stationCode）、reason、source；以 schema 驗證。人工群組取代所列成員的自動歸組，請列出欲保留的完整線路成員。測試內的合成群組不是實際轉乘結論。

未明關係在 build 警告清單標明；沒有預填香港／中環，也沒有把九龍／九龍塘視為同一轉乘站。跨碼通道需要官方或開放來源再核對。

## 驗證範圍

Vitest 使用本地真實 CSV，核對上述數量、主鍵與分支；另用明確合成資料測 BOM、缺欄、壞碼、重複序號、metadata 衝突與 overrides。這些測試不代表已驗證路網空間拓撲或完整轉乘通道。

## Geofabrik PBF 新增核對（2026-11-16）

CSV 宋皇臺碼為 SUW，但本次 PBF 同名停站節點 ref=SWT。配對器保留兩邊原始碼，不自行修正，因此 TML:SUW 暫未匹配。詳見 source-review.md。新規則下所有轉乘候選都需人工確認；上文 21 組為 M0 自動候選，不代表已確認的轉乘。

## 2026-11-17 使用者批准的單站例外

TML:SUW 與 OSM SWT 的指定 nodes 2308404918／2308405006 例外已批准，依據 Next Train v1.6 字典及官方站圖檔名 suw.pdf。source/reason 保存在 station-ref-overrides.json，原碼不更改，全量恢復 120／120。其他任何 ref 衝突不適用，仍需停止核對。原平台節點直接使用，沒有補估座標；轉乘仍全部待確認。
