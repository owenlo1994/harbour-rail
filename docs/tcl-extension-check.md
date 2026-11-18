# 東涌線延綫 way 核對（原始來源證據與使用者確認分開）

來源 PBF SHA-256：`adb3fab0be54bf52155ff98fc1d1f09195f634889c7da397ede3893ec851f9ad`；檔頭時間：2026-11-14T21:20:41Z。

使用者最新確認東涌線已行新路線，新站未開通。三條原 way 已納入玩具路網；只有動畫 relation 5317704 套用指定順序例外：1558652640 → 1176509649 → 1558652644 → 1558652643 → 1558652637。四個接點全為相同原始 node ID，修正後為單一連續路徑；沒有新增幾何。這是使用者確認，不偽稱官方獨立核實；OSM 興建中描述與下列原排序報告照舊保留。

## 量度方法與限制

WGS84 local equirectangular distance (R=6371008.8m); lengths sum source segments; gaps are straight-line endpoint distance only. No gap geometry is created. Parallel check: segment midpoint probes vs other source polylines; median <=30m and mean acute angle <=15 degrees is a geometric flag, never operating-status evidence. Direct parent memberships across all PBF relations; not transitive ancestors.

長度、距離與平行旗標均為幾何計算／推斷，不是測量報告；最近車站位置為原始平台／station node，不是官方站中心。其他 railway=rail/subway ways 亦只代表 OSM 標籤，不能據此確認正在營運。

## 原始排序斷口

| 索引 | Way → Way | 端點 node → node | 端點直線距離（計算） |
| --- | --- | --- | --- |
| 3→4 | 1558652640 → 1558652637 | 10930801895 → 10931051406 | 764.8 m |
| 50→51 | 249196544 → 1176509649 | 2557051037 → 10930801895 | 20910.2 m |

上述距離沒有畫成補線。第二個斷口是原始末尾 way 的排序問題，距離大不代表實際存在同等長的缺軌。

## Way 1176509649

狀態：`user-confirmed-alignment`；原 polyline 長度：**265.7 m**；座標範圍 [west,south,east,north]：`[113.9555194,22.2953864,113.9574959,22.29689]`。

原始端點：10930801895 → 10930801903；座標 [113.9555194,22.2953864] → [113.9574959,22.29689]。

最近三個線路／站碼節點（不合併轉乘）：

- TCL:TUC 東涌，原 node 288376094，距離該 way 1608.9 m（計算）。
- AEL:AIR 機場，原 node 253333824，距離該 way 2992.5 m（計算）。
- AEL:AWE 博覽館，原 node 3304026514，距離該 way 3201.2 m（計算）。

### 完整原始 tags

未列出的欄位表示來源沒有，不能把缺欄當 construction=no／proposed=no。

```json
{
  "brand": "港鐵 MTR",
  "brand:en": "MTR",
  "brand:zh": "港鐵",
  "description": "Tung Chung Line Extension (Construction)",
  "description:en": "Tung Chung Line Extension (Construction)",
  "description:zh": "東涌綫延綫 (興建中)",
  "electrified": "contact_line",
  "frequency": "0",
  "gauge": "1432",
  "name": "港鐵東涌綫 MTR Tung Chung Line",
  "name:en": "MTR Tung Chung Line",
  "name:zh": "港鐵東涌綫",
  "name:zh-Hans": "港铁东涌线",
  "name:zh-Hant": "港鐵東涌綫",
  "network": "港鐵 MTR",
  "network:en": "MTR",
  "network:wikidata": "Q14751",
  "network:zh": "港鐵",
  "not:tunnel": "yes",
  "oneway": "reversible",
  "operator": "香港鐵路有限公司 MTR Corporation Limited",
  "operator:en": "MTR Corporation Limited",
  "operator:wikidata": "Q1479375",
  "operator:zh": "香港鐵路有限公司",
  "owner": "香港鐵路有限公司 MTR Corporation Limited",
  "owner:en": "MTR Corporation Limited",
  "owner:wikidata": "Q1479375",
  "owner:zh": "香港鐵路有限公司",
  "passenger": "suburban",
  "passenger_lines": "2",
  "railway": "subway",
  "railway:preferred_direction": "forward",
  "start_date": "2026-09-13",
  "usage": "main",
  "voltage": "1500"
}
```

### 其他 relation 隸屬（PBF 全體 relation 的直接成員）

```json
[
  {
    "id": 5317704,
    "ref": "TCL",
    "route": "subway",
    "name": "東涌綫 Tung Chung Line",
    "from": "東涌 Tung Chung",
    "to": "香港 Hong Kong",
    "operator": "香港鐵路有限公司 MTR Corporation"
  },
  {
    "id": 11923016,
    "ref": null,
    "route": "railway",
    "name": "大嶼山及機場鐵路 Lantau and Airport Railway",
    "from": null,
    "to": null,
    "operator": "香港鐵路有限公司 MTR Corporation Limited"
  }
]
```

### 附近其他軌道的幾何比較

只有幾何關係，不使用「營運軌道已確認」結論。shared-source-edges 是同一原始 node pair；near-parallel 是上述量化門檻，非自行判斷營運。

```json
[
  {
    "sourceWayId": 26321741,
    "railway": "subway",
    "name": "港鐵東涌綫 MTR Tung Chung Line",
    "construction": null,
    "description": null,
    "minProbeDistanceMetres": 7.6,
    "medianProbeDistanceMetres": 30.1,
    "meanAcuteAngleDegrees": 8.3,
    "sharedSourceEdges": 0,
    "geometricComparison": "nearby-no-parallel-conclusion",
    "inferred": true
  },
  {
    "sourceWayId": 715059876,
    "railway": "subway",
    "name": "港鐵機場快綫 MTR Airport Express",
    "construction": null,
    "description": null,
    "minProbeDistanceMetres": 18.1,
    "medianProbeDistanceMetres": 41.9,
    "meanAcuteAngleDegrees": 8.3,
    "sharedSourceEdges": 0,
    "geometricComparison": "nearby-no-parallel-conclusion",
    "inferred": true
  },
  {
    "sourceWayId": 4959070,
    "railway": "subway",
    "name": "港鐵機場快綫 MTR Airport Express",
    "construction": null,
    "description": null,
    "minProbeDistanceMetres": 22.8,
    "medianProbeDistanceMetres": 47,
    "meanAcuteAngleDegrees": 8.4,
    "sharedSourceEdges": 0,
    "geometricComparison": "nearby-no-parallel-conclusion",
    "inferred": true
  }
]
```

## Way 1558652644

狀態：`user-confirmed-alignment`；原 polyline 長度：**248.3 m**；座標範圍 [west,south,east,north]：`[113.9574959,22.29689,113.9597266,22.2977415]`。

原始端點：10930801903 → 13238819880；座標 [113.9574959,22.29689] → [113.9597266,22.2977415]。

最近三個線路／站碼節點（不合併轉乘）：

- TCL:TUC 東涌，原 node 288376094，距離該 way 1865.5 m（計算）。
- AEL:AIR 機場，原 node 253333824，距離該 way 3016.9 m（計算）。
- AEL:AWE 博覽館，原 node 3304026514，距離該 way 3203.7 m（計算）。

### 完整原始 tags

未列出的欄位表示來源沒有，不能把缺欄當 construction=no／proposed=no。

```json
{
  "brand": "港鐵 MTR",
  "brand:en": "MTR",
  "brand:zh": "港鐵",
  "covered": "yes",
  "description": "Tung Chung Line Extension (Construction)",
  "description:en": "Tung Chung Line Extension (Construction)",
  "description:zh": "東涌綫延綫 (興建中)",
  "electrified": "contact_line",
  "frequency": "0",
  "gauge": "1432",
  "name": "港鐵東涌綫 MTR Tung Chung Line",
  "name:en": "MTR Tung Chung Line",
  "name:zh": "港鐵東涌綫",
  "name:zh-Hans": "港铁东涌线",
  "name:zh-Hant": "港鐵東涌綫",
  "network": "港鐵 MTR",
  "network:en": "MTR",
  "network:wikidata": "Q14751",
  "network:zh": "港鐵",
  "not:tunnel": "yes",
  "oneway": "reversible",
  "operator": "香港鐵路有限公司 MTR Corporation Limited",
  "operator:en": "MTR Corporation Limited",
  "operator:wikidata": "Q1479375",
  "operator:zh": "香港鐵路有限公司",
  "owner": "香港鐵路有限公司 MTR Corporation Limited",
  "owner:en": "MTR Corporation Limited",
  "owner:wikidata": "Q1479375",
  "owner:zh": "香港鐵路有限公司",
  "passenger": "suburban",
  "passenger_lines": "2",
  "railway": "subway",
  "railway:preferred_direction": "forward",
  "start_date": "2026-09-13",
  "usage": "main",
  "voltage": "1500"
}
```

### 其他 relation 隸屬（PBF 全體 relation 的直接成員）

```json
[
  {
    "id": 5317704,
    "ref": "TCL",
    "route": "subway",
    "name": "東涌綫 Tung Chung Line",
    "from": "東涌 Tung Chung",
    "to": "香港 Hong Kong",
    "operator": "香港鐵路有限公司 MTR Corporation"
  },
  {
    "id": 11923016,
    "ref": null,
    "route": "railway",
    "name": "大嶼山及機場鐵路 Lantau and Airport Railway",
    "from": null,
    "to": null,
    "operator": "香港鐵路有限公司 MTR Corporation Limited"
  }
]
```

### 附近其他軌道的幾何比較

只有幾何關係，不使用「營運軌道已確認」結論。shared-source-edges 是同一原始 node pair；near-parallel 是上述量化門檻，非自行判斷營運。

```json
[
  {
    "sourceWayId": 26321741,
    "railway": "subway",
    "name": "港鐵東涌綫 MTR Tung Chung Line",
    "construction": null,
    "description": null,
    "minProbeDistanceMetres": 35.4,
    "medianProbeDistanceMetres": 38.2,
    "meanAcuteAngleDegrees": 1,
    "sharedSourceEdges": 0,
    "geometricComparison": "nearby-no-parallel-conclusion",
    "inferred": true
  }
]
```

## Way 1558652643

狀態：`user-confirmed-alignment`；原 polyline 長度：**275.9 m**；座標範圍 [west,south,east,north]：`[113.9597266,22.2977415,113.9623664,22.2980654]`。

原始端點：13238819880 → 10931051406；座標 [113.9597266,22.2977415] → [113.9623664,22.2980654]。

最近三個線路／站碼節點（不合併轉乘）：

- TCL:TUC 東涌，原 node 288376094，距離該 way 2112.9 m（計算）。
- AEL:AIR 機場，原 node 253333824，距離該 way 3122.8 m（計算）。
- AEL:AWE 博覽館，原 node 3304026514，距離該 way 3243.1 m（計算）。

### 完整原始 tags

未列出的欄位表示來源沒有，不能把缺欄當 construction=no／proposed=no。

```json
{
  "brand": "港鐵 MTR",
  "brand:en": "MTR",
  "brand:zh": "港鐵",
  "description": "Tung Chung Line Extension (Construction)",
  "description:en": "Tung Chung Line Extension (Construction)",
  "description:zh": "東涌綫延綫 (興建中)",
  "electrified": "contact_line",
  "frequency": "0",
  "gauge": "1432",
  "name": "港鐵東涌綫 MTR Tung Chung Line",
  "name:en": "MTR Tung Chung Line",
  "name:zh": "港鐵東涌綫",
  "name:zh-Hans": "港铁东涌线",
  "name:zh-Hant": "港鐵東涌綫",
  "network": "港鐵 MTR",
  "network:en": "MTR",
  "network:wikidata": "Q14751",
  "network:zh": "港鐵",
  "not:tunnel": "yes",
  "oneway": "reversible",
  "operator": "香港鐵路有限公司 MTR Corporation Limited",
  "operator:en": "MTR Corporation Limited",
  "operator:wikidata": "Q1479375",
  "operator:zh": "香港鐵路有限公司",
  "owner": "香港鐵路有限公司 MTR Corporation Limited",
  "owner:en": "MTR Corporation Limited",
  "owner:wikidata": "Q1479375",
  "owner:zh": "香港鐵路有限公司",
  "passenger": "suburban",
  "passenger_lines": "2",
  "railway": "subway",
  "railway:preferred_direction": "forward",
  "start_date": "2026-09-13",
  "usage": "main",
  "voltage": "1500"
}
```

### 其他 relation 隸屬（PBF 全體 relation 的直接成員）

```json
[
  {
    "id": 5317704,
    "ref": "TCL",
    "route": "subway",
    "name": "東涌綫 Tung Chung Line",
    "from": "東涌 Tung Chung",
    "to": "香港 Hong Kong",
    "operator": "香港鐵路有限公司 MTR Corporation"
  },
  {
    "id": 11923016,
    "ref": null,
    "route": "railway",
    "name": "大嶼山及機場鐵路 Lantau and Airport Railway",
    "from": null,
    "to": null,
    "operator": "香港鐵路有限公司 MTR Corporation Limited"
  }
]
```

### 附近其他軌道的幾何比較

只有幾何關係，不使用「營運軌道已確認」結論。shared-source-edges 是同一原始 node pair；near-parallel 是上述量化門檻，非自行判斷營運。

```json
[
  {
    "sourceWayId": 26321741,
    "railway": "subway",
    "name": "港鐵東涌綫 MTR Tung Chung Line",
    "construction": null,
    "description": null,
    "minProbeDistanceMetres": 19.3,
    "medianProbeDistanceMetres": 34,
    "meanAcuteAngleDegrees": 3.7,
    "sharedSourceEdges": 0,
    "geometricComparison": "nearby-no-parallel-conclusion",
    "inferred": true
  }
]
```

## Way 1558652640

狀態：`adjacent-source-way`；原 polyline 長度：**259.2 m**；座標範圍 [west,south,east,north]：`[113.9534697,22.2940319,113.9555194,22.2953864]`。

原始端點：2291194410 → 10930801895；座標 [113.9534697,22.2940319] → [113.9555194,22.2953864]。

最近三個線路／站碼節點（不合併轉乘）：

- TCL:TUC 東涌，原 node 288376094，距離該 way 1354.4 m（計算）。
- AEL:AIR 機場，原 node 253333824，距離該 way 2988.9 m（計算）。
- AEL:AWE 博覽館，原 node 3304026514，距離該 way 3260 m（計算）。

### 完整原始 tags

未列出的欄位表示來源沒有，不能把缺欄當 construction=no／proposed=no。

```json
{
  "brand": "港鐵 MTR",
  "brand:en": "MTR",
  "brand:zh": "港鐵",
  "electrified": "contact_line",
  "frequency": "0",
  "gauge": "1432",
  "name": "港鐵東涌綫 MTR Tung Chung Line",
  "name:en": "MTR Tung Chung Line",
  "name:zh": "港鐵東涌綫",
  "name:zh-Hans": "港铁东涌线",
  "name:zh-Hant": "港鐵東涌綫",
  "network": "港鐵 MTR",
  "network:en": "MTR",
  "network:wikidata": "Q14751",
  "network:zh": "港鐵",
  "not:tunnel": "yes",
  "oneway": "reversible",
  "operator": "香港鐵路有限公司 MTR Corporation Limited",
  "operator:en": "MTR Corporation Limited",
  "operator:loc_name": "港鐵公司 MTR Corporation",
  "operator:loc_name:en": "MTR Corporation",
  "operator:loc_name:zh": "港鐵公司",
  "operator:ref": "MTR",
  "operator:short": "港鐵 MTRCL",
  "operator:short:en": "MTRCL",
  "operator:short:zh": "港鐵",
  "operator:short_name": "港鐵 MTRCL",
  "operator:short_name:en": "MTRCL",
  "operator:short_name:zh": "港鐵",
  "operator:wikidata": "Q1479375",
  "operator:zh": "香港鐵路有限公司",
  "operator:zh-Hans": "香港铁路有限公司",
  "operator:zh-Hant": "香港鐵路有限公司",
  "owner": "香港鐵路有限公司 MTR Corporation Limited",
  "owner:en": "MTR Corporation Limited",
  "owner:wikidata": "Q1479375",
  "owner:zh": "香港鐵路有限公司",
  "passenger": "suburban",
  "passenger_lines": "2",
  "railway": "subway",
  "railway:preferred_direction": "forward",
  "start_date": "1998-06-21",
  "usage": "main",
  "voltage": "1500"
}
```

### 其他 relation 隸屬（PBF 全體 relation 的直接成員）

```json
[
  {
    "id": 5317704,
    "ref": "TCL",
    "route": "subway",
    "name": "東涌綫 Tung Chung Line",
    "from": "東涌 Tung Chung",
    "to": "香港 Hong Kong",
    "operator": "香港鐵路有限公司 MTR Corporation"
  },
  {
    "id": 11923016,
    "ref": null,
    "route": "railway",
    "name": "大嶼山及機場鐵路 Lantau and Airport Railway",
    "from": null,
    "to": null,
    "operator": "香港鐵路有限公司 MTR Corporation Limited"
  }
]
```

### 附近其他軌道的幾何比較

只有幾何關係，不使用「營運軌道已確認」結論。shared-source-edges 是同一原始 node pair；near-parallel 是上述量化門檻，非自行判斷營運。

```json
[
  {
    "sourceWayId": 1558652639,
    "railway": "subway",
    "name": "港鐵東涌綫 MTR Tung Chung Line",
    "construction": null,
    "description": null,
    "minProbeDistanceMetres": 4.9,
    "medianProbeDistanceMetres": 5.2,
    "meanAcuteAngleDegrees": 0.1,
    "sharedSourceEdges": 0,
    "geometricComparison": "near-parallel-by-stated-threshold",
    "inferred": true
  },
  {
    "sourceWayId": 715059876,
    "railway": "subway",
    "name": "港鐵機場快綫 MTR Airport Express",
    "construction": null,
    "description": null,
    "minProbeDistanceMetres": 17.4,
    "medianProbeDistanceMetres": 20,
    "meanAcuteAngleDegrees": 4.3,
    "sharedSourceEdges": 0,
    "geometricComparison": "near-parallel-by-stated-threshold",
    "inferred": true
  },
  {
    "sourceWayId": 4959070,
    "railway": "subway",
    "name": "港鐵機場快綫 MTR Airport Express",
    "construction": null,
    "description": null,
    "minProbeDistanceMetres": 22.1,
    "medianProbeDistanceMetres": 25.1,
    "meanAcuteAngleDegrees": 4.3,
    "sharedSourceEdges": 0,
    "geometricComparison": "near-parallel-by-stated-threshold",
    "inferred": true
  }
]
```

## Way 1558652637

狀態：`adjacent-source-way`；原 polyline 長度：**548.9 m**；座標範圍 [west,south,east,north]：`[113.9623664,22.2980654,113.9675612,22.2991797]`。

原始端點：10931051406 → 2291194457；座標 [113.9623664,22.2980654] → [113.9675612,22.2991797]。

最近三個線路／站碼節點（不合併轉乘）：

- TCL:TUC 東涌，原 node 288376094，距離該 way 2373.2 m（計算）。
- AEL:AIR 機場，原 node 253333824，距離該 way 3313 m（計算）。
- AEL:AWE 博覽館，原 node 3304026514，距離該 way 3372.9 m（計算）。

### 完整原始 tags

未列出的欄位表示來源沒有，不能把缺欄當 construction=no／proposed=no。

```json
{
  "brand": "港鐵 MTR",
  "brand:en": "MTR",
  "brand:zh": "港鐵",
  "electrified": "contact_line",
  "frequency": "0",
  "gauge": "1432",
  "name": "港鐵東涌綫 MTR Tung Chung Line",
  "name:en": "MTR Tung Chung Line",
  "name:zh": "港鐵東涌綫",
  "name:zh-Hans": "港铁东涌线",
  "name:zh-Hant": "港鐵東涌綫",
  "network": "港鐵 MTR",
  "network:en": "MTR",
  "network:wikidata": "Q14751",
  "network:zh": "港鐵",
  "not:tunnel": "yes",
  "oneway": "reversible",
  "operator": "香港鐵路有限公司 MTR Corporation Limited",
  "operator:en": "MTR Corporation Limited",
  "operator:loc_name": "港鐵公司 MTR Corporation",
  "operator:loc_name:en": "MTR Corporation",
  "operator:loc_name:zh": "港鐵公司",
  "operator:ref": "MTR",
  "operator:short": "港鐵 MTRCL",
  "operator:short:en": "MTRCL",
  "operator:short:zh": "港鐵",
  "operator:short_name": "港鐵 MTRCL",
  "operator:short_name:en": "MTRCL",
  "operator:short_name:zh": "港鐵",
  "operator:wikidata": "Q1479375",
  "operator:zh": "香港鐵路有限公司",
  "operator:zh-Hans": "香港铁路有限公司",
  "operator:zh-Hant": "香港鐵路有限公司",
  "owner": "香港鐵路有限公司 MTR Corporation Limited",
  "owner:en": "MTR Corporation Limited",
  "owner:wikidata": "Q1479375",
  "owner:zh": "香港鐵路有限公司",
  "passenger": "suburban",
  "passenger_lines": "2",
  "railway": "subway",
  "railway:preferred_direction": "forward",
  "start_date": "1998-06-21",
  "usage": "main",
  "voltage": "1500"
}
```

### 其他 relation 隸屬（PBF 全體 relation 的直接成員）

```json
[
  {
    "id": 5317704,
    "ref": "TCL",
    "route": "subway",
    "name": "東涌綫 Tung Chung Line",
    "from": "東涌 Tung Chung",
    "to": "香港 Hong Kong",
    "operator": "香港鐵路有限公司 MTR Corporation"
  },
  {
    "id": 11923016,
    "ref": null,
    "route": "railway",
    "name": "大嶼山及機場鐵路 Lantau and Airport Railway",
    "from": null,
    "to": null,
    "operator": "香港鐵路有限公司 MTR Corporation Limited"
  }
]
```

### 附近其他軌道的幾何比較

只有幾何關係，不使用「營運軌道已確認」結論。shared-source-edges 是同一原始 node pair；near-parallel 是上述量化門檻，非自行判斷營運。

```json
[
  {
    "sourceWayId": 219994020,
    "railway": "subway",
    "name": "港鐵機場快綫 MTR Airport Express",
    "construction": null,
    "description": null,
    "minProbeDistanceMetres": 5,
    "medianProbeDistanceMetres": 7.4,
    "meanAcuteAngleDegrees": 2.2,
    "sharedSourceEdges": 0,
    "geometricComparison": "near-parallel-by-stated-threshold",
    "inferred": true
  },
  {
    "sourceWayId": 219994038,
    "railway": "subway",
    "name": "港鐵機場快綫 MTR Airport Express",
    "construction": null,
    "description": null,
    "minProbeDistanceMetres": 10.3,
    "medianProbeDistanceMetres": 13.4,
    "meanAcuteAngleDegrees": 2.2,
    "sharedSourceEdges": 0,
    "geometricComparison": "near-parallel-by-stated-threshold",
    "inferred": true
  },
  {
    "sourceWayId": 1558652638,
    "railway": "subway",
    "name": "港鐵東涌綫 MTR Tung Chung Line",
    "construction": null,
    "description": null,
    "minProbeDistanceMetres": 15.4,
    "medianProbeDistanceMetres": 22,
    "meanAcuteAngleDegrees": 2.1,
    "sharedSourceEdges": 0,
    "geometricComparison": "near-parallel-by-stated-threshold",
    "inferred": true
  }
]
```

## 來源差異與限制

- 三條 way 的 description 仍寫 Construction，start_date 原值照錄；不把這些標籤改寫為官方公告。最新使用者指示是採用新路段。
- 即使其他 subway relation 同時引用，仍不代表官方已確認營運。
- 排序例外只限 relation 5317704 與記錄中的完整成員序列；其他 source order 或端點 ID 變化仍停止，不泛化成最近鄰規則。
- 東涌東／東涌西來自原始 construction=station 節點、標示未開通，沒有官方站碼或到站查詢；東涌西沒有畫虛構接線。
