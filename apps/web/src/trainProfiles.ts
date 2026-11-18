import type { LineCode } from '@hk-mtr/shared';
export type TrainFamily =
  | 'urban-q'
  | 'urban-k'
  | 'airport-caf'
  | 'tung-chung-caf'
  | 'east-rail-r'
  | 'tuen-ma-c'
  | 'south-island-s'
  | 'resort-converted';
export interface TrainProfile {
  nameZh: string;
  nameEn: string;
  family: TrainFamily;
  body: string;
  roof: string;
  stripe: string;
  nose: string;
  glass: string;
  badge: string;
  sources: readonly string[];
  referenceOnly: true;
  note: string;
}
const urbanSource =
  'https://www.mtr.com.hk/en/corporate/projects/projects_ops_improve_train.html';
const cafKSource = 'https://www.mtr.com.hk/en/corporate/tenders/C6966-21E.html';
const common = {
  body: '#d8dfdc',
  roof: '#f2eee0',
  glass: '#34546a',
  referenceOnly: true as const,
  note: '參考車款的原創玩具造型；官方到站 API 不提供該班實際車款。',
};
export const trainProfiles: Record<LineCode, TrainProfile> = {
  TWL: {
    ...common,
    nameZh: 'Q-Train 玩具車',
    nameEn: 'Q-train inspired toy',
    family: 'urban-q',
    stripe: '#cf4b52',
    nose: '#c9454f',
    badge: '#ed1d24',
    sources: [urbanSource],
  },
  ISL: {
    ...common,
    nameZh: 'Q-Train 玩具車',
    nameEn: 'Q-train inspired toy',
    family: 'urban-q',
    stripe: '#cf4b52',
    nose: '#c9454f',
    badge: '#007dc5',
    sources: [urbanSource],
  },
  KTL: {
    ...common,
    nameZh: 'Q-Train 玩具車',
    nameEn: 'Q-train inspired toy',
    family: 'urban-q',
    stripe: '#cf4b52',
    nose: '#c9454f',
    badge: '#00ab4e',
    sources: [urbanSource],
  },
  TKL: {
    ...common,
    nameZh: 'K-Train 玩具車',
    nameEn: 'K-train inspired toy',
    family: 'urban-k',
    stripe: '#be444d',
    nose: '#d0d9d8',
    badge: '#7d499d',
    sources: [cafKSource],
  },
  TCL: {
    ...common,
    nameZh: '東涌綫 CAF 玩具車',
    nameEn: 'Tung Chung CAF inspired toy',
    family: 'tung-chung-caf',
    stripe: '#d7a35e',
    nose: '#d2dcd9',
    badge: '#f7943e',
    sources: [
      cafKSource,
      'https://estore.mtr.com.hk/en/products/mtr-mini-diecast-train-tung-chung-line',
    ],
  },
  AEL: {
    ...common,
    nameZh: '機場快綫 CAF 玩具車',
    nameEn: 'Airport Express CAF inspired toy',
    family: 'airport-caf',
    stripe: '#248b8f',
    nose: '#35999d',
    badge: '#00888a',
    sources: [
      cafKSource,
      'https://estore.mtr.com.hk/en/products/mtr-mini-diecast-train-airport-express',
    ],
  },
  EAL: {
    ...common,
    nameZh: '東鐵 R-Train 玩具車',
    nameEn: 'East Rail R-train inspired toy',
    family: 'east-rail-r',
    stripe: '#5b94b0',
    nose: '#e4c166',
    badge: '#53b7e8',
    sources: [
      'https://estore.mtr.com.hk/en/products/mtr-passenger-train-model-2021-present',
      'https://www.info.gov.hk/gia/general/202102/01/P2021020100485p.htm',
    ],
  },
  TML: {
    ...common,
    nameZh: '屯馬 C-Train 玩具車',
    nameEn: 'Tuen Ma C-train inspired toy',
    family: 'tuen-ma-c',
    stripe: '#a33f54',
    nose: '#e2cd85',
    badge: '#923011',
    sources: ['https://estore.mtr.com.hk/en/pages/tuen-ma-line-special'],
  },
  SIL: {
    ...common,
    nameZh: '南港島 S-Train 玩具車',
    nameEn: 'South Island S-train inspired toy',
    family: 'south-island-s',
    stripe: '#5caeb5',
    nose: '#e9d368',
    badge: '#b6bd00',
    sources: [
      'https://www.crrcgc.cc/en/2016-12/29/article_6485AC80FAB94156814D64CD18A41F2E.html',
      'https://estore.mtr.com.hk/en/products/mtr-mini-diecast-train-south-island-line',
    ],
  },
  DRL: {
    ...common,
    nameZh: '迪士尼綫改裝列車玩具車',
    nameEn: 'Resort converted-train inspired toy',
    family: 'resort-converted',
    body: '#d8dfd7',
    stripe: '#bc7b49',
    nose: '#5578a6',
    badge: '#f173ac',
    sources: [
      'https://www.mtr.com.hk/archive/corporate/en/investor/sec/2005_form20f/d20f.htm',
      'https://www.news.gov.hk/isd/ebulletin/en/hkforkids/default/050802/html/050802en50003.htm',
      'https://www.mtr.com.hk/archive/corporate/en/press_release/PR-24-020-E.pdf',
    ],
  },
};
