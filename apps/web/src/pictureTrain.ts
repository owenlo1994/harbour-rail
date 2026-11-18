// The illustration's palette is independent of the operator's route colours.
import type { LineCode } from '@hk-mtr/shared';
export const picturePaint: Record<LineCode, string> = {
  TWL: '#e63540',
  KTL: '#66b84b',
  ISL: '#2864a1',
  EAL: '#87c8e9',
  TKL: '#9964b2',
  TCL: '#f48b23',
  DRL: '#f092bd',
  TML: '#b76b39',
  SIL: '#c3db49',
  AEL: '#16847d',
};
const names: Record<LineCode, [string, string]> = {
  TWL: ['荃灣綫', 'TSUEN WAN LINE'],
  KTL: ['觀塘綫', 'KWUN TONG LINE'],
  ISL: ['港島綫', 'ISLAND LINE'],
  EAL: ['東鐵綫', 'EAST RAIL LINE'],
  TKL: ['將軍澳綫', 'TSEUNG KWAN O LINE'],
  TCL: ['東涌綫', 'TUNG CHUNG LINE'],
  DRL: ['迪士尼綫', 'DISNEYLAND RESORT LINE'],
  TML: ['屯馬綫', 'TUEN MA LINE'],
  SIL: ['南港島綫', 'SOUTH ISLAND LINE'],
  AEL: ['機場快綫', 'AIRPORT EXPRESS'],
};
const ink = '#292c36';
export function carriagePanel(line: LineCode, face: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = face ? 256 : 768;
  canvas.height = 256;
  const c = canvas.getContext('2d')!;
  const w = canvas.width;
  c.fillStyle = picturePaint[line];
  c.fillRect(0, 0, w, 256);
  let seed = 49;
  const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < w * 8; i++) {
    c.fillStyle = i % 2 ? '#ffffff22' : '#25152817';
    c.fillRect(rand() * w, rand() * 256, rand() * 6 + 1, 1.5);
  }
  c.strokeStyle = ink;
  c.lineWidth = 5;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  const box = (
    x: number,
    y: number,
    b: number,
    h: number,
    r: number,
    fill: string,
  ) => {
    c.beginPath();
    c.roundRect(x, y, b, h, r);
    c.fillStyle = fill;
    c.fill();
    c.stroke();
  };
  const oval = (x: number, y: number, a: number, b: number, fill: string) => {
    c.beginPath();
    c.ellipse(x, y, a, b, 0, 0, Math.PI * 2);
    c.fillStyle = fill;
    c.fill();
  };
  if (face) {
    box(19, 47, 218, 116, 22, '#a7d4ea');
    box(91, 12, 74, 18, 6, '#ffb552');
    if (line === 'AEL') {
      c.beginPath();
      c.moveTo(143, 50);
      c.lineTo(116, 161);
      c.stroke();
    } else {
      for (const x of [69, 185]) {
        oval(x, 108, 30, 39, ink);
        oval(x, 107, 26, 35, '#fffdf4');
        oval(x + 6, 115, 16, 23, '#222733');
        oval(x + 12, 104, 6, 7, '#fff');
      }
    }
    c.beginPath();
    c.moveTo(88, 186);
    c.bezierCurveTo(107, 216, 147, 215, 168, 184);
    c.stroke();
    for (const x of [37, 219]) {
      oval(x, 189, 14, 12, ink);
      oval(x, 189, 10, 9, '#ffc951');
    }
  } else {
    box(7, 6, w - 14, 244, 18, picturePaint[line]);
    for (const x of [34, 617]) {
      box(x, 30, 110, 187, 8, picturePaint[line]);
      for (const dx of [9, 60]) box(x + dx, 45, 36, 76, 5, '#acdaec');
      c.beginPath();
      c.moveTo(x + 55, 32);
      c.lineTo(x + 55, 213);
      c.stroke();
    }
    for (const x of [175, 356, 491]) {
      box(x, 39, x === 175 ? 155 : 105, 77, 9, '#a9d8ee');
      c.fillStyle = '#e5f5ff';
      c.beginPath();
      c.moveTo(x + 19, 105);
      c.lineTo(x + 51, 46);
      c.lineTo(x + 67, 46);
      c.lineTo(x + 34, 105);
      c.fill();
    }
    if (line === 'DRL') {
      for (const x of [246, 411]) {
        oval(x, 77, 27, 24, '#634964');
        oval(x - 23, 57, 14, 14, '#634964');
        oval(x + 23, 57, 14, 14, '#634964');
      }
    }
    if (line === 'AEL' || line === 'SIL') {
      c.fillStyle = '#f7eaca';
      c.font = 'bold 49px sans-serif';
      c.fillText(line === 'AEL' ? '✈' : '🐬', 201, 96);
    }
    c.textAlign = 'center';
    c.fillStyle = '#fff8df';
    c.font = 'bold 43px sans-serif';
    c.fillText(names[line][0], 384, 171);
    c.font = 'bold 20px sans-serif';
    c.fillText(names[line][1], 384, 202);
  }
  return canvas;
}
