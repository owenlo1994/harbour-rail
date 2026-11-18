import { stat } from 'node:fs/promises';
import path from 'node:path';

export const PBF_RELATIVE_PATH = 'data/raw/hong-kong-latest.osm.pbf';

/** Checks presence only, not PBF validity. Never downloads or reads Overpass. */
export async function inspectLocalPbf(root: string) {
  const filename = path.join(root, PBF_RELATIVE_PATH);
  try {
    const info = await stat(filename);
    if (!info.isFile() || info.size === 0) {
      return {
        available: false as const,
        code: 'PBF_INPUT_INVALID',
        file: PBF_RELATIVE_PATH,
        message: `本地 PBF 必須為非空普通檔案：${PBF_RELATIVE_PATH}。不會自動下載或 fallback 到 Overpass。`,
      };
    }
    return {
      available: true as const,
      code: 'PBF_INPUT_PRESENT',
      file: PBF_RELATIVE_PATH,
      sizeBytes: info.size,
      message: '檔案存在；尚未驗證 PBF 內容、來源日期或資料截止時間。',
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return {
      available: false as const,
      code: 'PBF_INPUT_MISSING',
      file: PBF_RELATIVE_PATH,
      message: `缺少本地 Geofabrik PBF：${PBF_RELATIVE_PATH}。請放入檔案並提供下載日期及 Geofabrik 顯示的資料截止時間，再執行 npm run data:network。不會自動下載或 fallback 到 Overpass。`,
    };
  }
}
