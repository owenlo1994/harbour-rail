# 即時列車推算用本地路網審核

建置：`node --import tsx scripts/build-live.ts`。只讀已驗證本地 PBF 衍生報告；不連網、不補線、不簡化來源 path。

來源：Geofabrik hong-kong-261114.osm.pbf；SHA-256 `adb3fab0be54bf52155ff98fc1d1f09195f634889c7da397ede3893ec851f9ad`；PBF 檔頭時間 `2026-11-14T21:20:41Z`。© OpenStreetMap contributors，ODbL 1.0。

身份與方向：港鐵官方 mtr_lines_and_stations.csv（120 個線路站鍵）；[Next Train v1.7](https://opendata.mtr.com.hk/doc/Next_Train_DataDictionary_v1.7.pdf) p5 的 RAC 車站、pp8–9 的 UP/DOWN 目的地及 route=RAC 定義。沒有使用 CSV UT/DT 名稱推斷 API 方向。

輸出契約：`{version:1,sourceTimestamp,stations:[{line,code,nameZh,nameEn,coordinates,sourceNodeId,identitySource,coordinateInferred:false}],routes:[{id,line,direction,via,path,stops:[{code,nameZh,distance}],geometryBasis}]}`。distance 是由 path 起點累計的米數；path 完整保留原始頂點。API 與 web 的 live-network.json 為相同 bytes。

結果：**121 線路站鍵／98 個站碼；30 條方向／分支路徑；224 個有方向相鄰站時間模型**。

## RAC 與分支

RAC 沒有在該 CSV 出現，但資料字典 v1.7 明確列於可查詢站表、EAL 目的地和 route=RAC 欄位。新增第 121 個線路站鍵只採原始 OSM station node2325225341，[114.2028994,22.4004756]，名稱馬場／Racecourse，identitySource=next-train-v1.7+osm；沒有虛構座標或官方 CSV 紀錄。來源 stop nodes316731315／2185507407 亦存在於相關原 relation。

EAL 各包含羅湖、落馬洲，普通經火炭及經馬場的雙方向路徑；另保留實際 ADM↔RAC relation，供 RAC 終點班次使用。route=RAC 依字典取代 FOT，不把兩站串在一起。其他短途目的地（如 SHT/FOT/TAP/SHS、AEL AIR）是完整方向路徑上的原站碼，由 trip 引擎在終點封頂。TKL 康城的 CSV 支線從 TIK 開始；只有站序使用 CSV NOP→TIK 共幹加 TIK→LHP 支線，幾何仍直接採原完整 NOP↔LHP source relation。

TCL 只使用已批准 relation5317704 的相同來源頂點／邊：DOWN 為 TUC→HOK，UP 反轉該中心顯示路徑。這不是獨立驗證的 UP 月台軌道，geometryBasis 有明示；沒有改用另一條舊路軌或補線。未開通東涌東／西不在此即時路網、站鍵或時間模型中。

## 車站投影：推斷而非原座標改寫

各線車站保留原平台／station node座標，沿原 polyline 作最近線段投影，只用所得弧長作進度定位。採 WGS84 局部等距近似，R=6371008.8m；每段長度與前次路網 distance helper一致。最大投影差 **43.0m**，沒有超過350m；任何超標、站序倒退、缺站或非原始 source edge 均停止建置。推斷的 station-to-path correspondence 不等於官方站中心或 GPS 誤差。

## 模型時間

data/config/segment_times.json 的 source=model-parameter-not-official。預設巡航 15m/s、最短站間 45s、停站 25s，是可替換模型參數，**不是官方班次、實測行車時間或速度限制**。travelSeconds=ceil(max(minTravelSeconds,原軌道距離/cruiseSpeedMps))，同線同方向相鄰站多來源取距離中位數；source route IDs 保留。重跑保留已配置 defaults，再重建 derived segments；如手改個別 segment 值，重建前應另存，builder 會按 defaults 重新生成。引擎位置須標示推算。

## 來源差異

- live-4250434-UP-RAC: raw route stop members omit SHT, but its true source station node is on this original track. The official common station order is retained; projection 17.7m. This is an inferred stop-to-path correspondence, not a new coordinate or track.

## 逐路徑結果

| 路徑 | 線 | API方向 | RAC | 起點→終點 | 站數 | 原線長(m) | 最大投影差(m) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| live-5317239-UP | AEL | UP | 普通 | HOK→AWE | 5 | 34952.0 | 0.0 |
| live-5317238-DOWN | AEL | DOWN | 普通 | AWE→HOK | 5 | 34936.8 | 10.6 |
| live-5317704-UP | TCL | UP | 普通 | HOK→TUC | 8 | 30792.6 | 29.8 |
| live-5317704-DOWN | TCL | DOWN | 普通 | TUC→HOK | 8 | 30792.6 | 29.8 |
| live-6102299-UP | TML | UP | 普通 | WKS→TUM | 27 | 56260.1 | 25.6 |
| live-6102298-DOWN | TML | DOWN | 普通 | TUM→WKS | 27 | 56296.3 | 22.9 |
| live-269672-UP | TKL | UP | 普通 | NOP→POA | 7 | 10512.0 | 14.9 |
| live-13352937-UP | TKL | UP | 普通 | NOP→LHP | 6 | 11482.4 | 14.9 |
| live-9736611-DOWN | TKL | DOWN | 普通 | POA→NOP | 7 | 9778.1 | 29.0 |
| live-13352938-DOWN | TKL | DOWN | 普通 | LHP→NOP | 6 | 10520.7 | 29.0 |
| live-4248591-UP | EAL | UP | 普通 | ADM→LMC | 14 | 41876.0 | 22.1 |
| live-4248592-UP | EAL | UP | 普通 | ADM→LOW | 14 | 37994.1 | 22.1 |
| live-4248589-DOWN | EAL | DOWN | 普通 | LMC→ADM | 14 | 41887.1 | 43.0 |
| live-4248590-DOWN | EAL | DOWN | 普通 | LOW→ADM | 14 | 37829.9 | 43.0 |
| live-4250434-UP-RAC | EAL | UP | RAC | ADM→LMC | 14 | 41867.5 | 17.7 |
| live-4250435-UP-RAC | EAL | UP | RAC | ADM→LOW | 14 | 37985.6 | 17.7 |
| live-4250432-DOWN-RAC | EAL | DOWN | RAC | LMC→ADM | 14 | 41877.9 | 43.0 |
| live-4250433-DOWN-RAC | EAL | DOWN | RAC | LOW→ADM | 14 | 37820.7 | 43.0 |
| live-6587848-UP-RAC | EAL | UP | RAC | ADM→RAC | 8 | 17157.2 | 17.7 |
| live-6587852-DOWN-RAC | EAL | DOWN | RAC | RAC→ADM | 8 | 17165.3 | 43.0 |
| live-6827211-UP | SIL | UP | 普通 | ADM→SOH | 5 | 6949.2 | 0.0 |
| live-6827212-DOWN | SIL | DOWN | 普通 | SOH→ADM | 5 | 6929.4 | 19.8 |
| live-9736530-UP | TWL | UP | 普通 | CEN→TSW | 16 | 16556.3 | 22.4 |
| live-269669-DOWN | TWL | DOWN | 普通 | TSW→CEN | 16 | 16866.0 | 17.2 |
| live-4432666-UP | ISL | UP | 普通 | KET→CHW | 17 | 16021.7 | 40.5 |
| live-4432665-DOWN | ISL | DOWN | 普通 | CHW→KET | 17 | 15934.5 | 32.0 |
| live-6452935-UP | KTL | UP | 普通 | WHA→TIK | 17 | 17423.4 | 14.9 |
| live-272125-DOWN | KTL | DOWN | 普通 | TIK→WHA | 17 | 17354.8 | 21.4 |
| live-4709541-UP | DRL | UP | 普通 | DIS→SUN | 2 | 3519.4 | 0.0 |
| live-4709540-DOWN | DRL | DOWN | 普通 | SUN→DIS | 2 | 3517.2 | 0.0 |

所有 path 邊均與其來源 relation 的原 way node pair比對。站碼唯一、121站鍵、30路徑、投影門檻及嚴格遞增弧長均在 builder 驗證。
