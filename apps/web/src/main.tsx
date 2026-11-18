import {
  StrictMode,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react';
import { createRoot } from 'react-dom/client';
import {
  toyWorldSchema,
  type ToyWorld,
  type ToyTrain,
} from '@hk-mtr/shared/toy';
import { lineInfo, type Station } from '@hk-mtr/shared/network';
import type { LineCode } from '@hk-mtr/shared';
import { MapView, type UpcomingStation } from './MapView';
import { ToyIcon } from './ToyIcon';
import { toyCitySchema, type ToyCity } from './city';
import './style.css';
import {
  liveNetworkSchema,
  haversine,
  type LiveNetwork,
} from '@hk-mtr/shared/live';
import { useLiveFeed } from './useLiveFeed';
import { trainProfiles } from './trainProfiles';
const hkClock = (t: number) =>
  new Date(t).toLocaleTimeString('zh-HK', {
    timeZone: 'Asia/Hong_Kong',
    hour12: false,
  });
const tripBadge = (id: string) => {
  let h = 2166136261;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36).slice(-4).toUpperCase();
};
const order: LineCode[] = [
  'TWL',
  'ISL',
  'KTL',
  'EAL',
  'TML',
  'TKL',
  'SIL',
  'AEL',
  'DRL',
  'TCL',
];
const readSaved = (key: string): string[] => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(value)
      ? value.filter((s): s is string => typeof s === 'string')
      : [];
  } catch {
    return [];
  }
};
const minutesUntil = (time: string, now: number) => {
  const seconds = (Date.parse(time.replace(' ', 'T') + '+08:00') - now) / 60000;
  return Number.isFinite(seconds)
    ? String(Math.max(0, Math.ceil(seconds)))
    : '—';
};
function App() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const [data, setData] = useState<ToyWorld | null>(null),
    [city, setCity] = useState<ToyCity | null>(null),
    [mode, setMode] = useState<'simulation' | 'live'>('simulation'),
    [liveNetwork, setLiveNetwork] = useState<LiveNetwork | null>(null),
    [priority, setPriority] = useState<string>(),
    [locationOn, setLocationOn] = useState(false),
    [locationFix, setLocationFix] = useState<{
      coordinates: [number, number];
      accuracy: number;
    } | null>(null),
    [error, setError] = useState(''),
    [ready, setReady] = useState(false),
    [active, setActive] = useState<LineCode | null>(null),
    [selected, setSelected] = useState<Station | null>(null),
    [upcoming, setUpcoming] = useState<UpcomingStation | null>(null),
    [trains, setTrains] = useState<ToyTrain[]>([]),
    [pickerTrains, setPickerTrains] = useState<ToyTrain[]>([]),
    [followId, setFollow] = useState<string | null>(null),
    [paused, setPaused] = useState(
      () => matchMedia('(prefers-reduced-motion: reduce)').matches,
    ),
    [speed, setSpeed] = useState(1),
    [query, setQuery] = useState(''),
    [routeOpen, setRouteOpen] = useState(false),
    [modal, setModal] = useState<
      'about' | 'favorites' | 'missions' | 'trains' | null
    >(null),
    [favs, setFavs] = useState(() => readSaved('toy-favorites')),
    [visited, setVisited] = useState(() => readSaved('toy-visits')),
    [linesTried, setLinesTried] = useState(() => readSaved('toy-lines')),
    [hasFollowed, setHasFollowed] = useState(false),
    [sound, setSound] = useState(false),
    [toast, setToast] = useState(''),
    [board, setBoard] = useState<Record<string, unknown> | null>(null),
    [boardOpen, setBoardOpen] = useState(false),
    [action, setAction] = useState<{
      kind:
        | 'home'
        | 'tilt'
        | 'zoom-in'
        | 'zoom-out'
        | 'station'
        | 'follow'
        | 'upcoming'
        | 'island';
      serial: number;
    }>({ kind: 'home', serial: 0 });
  const geoWatch = useRef<number | null>(null);
  const geoPending = useRef<{
    point: [number, number];
    started: number;
  } | null>(null);
  const {
    feed: liveFeed,
    clockOffset,
    error: liveError,
  } = useLiveFeed(mode === 'live' && !!liveNetwork, active, priority);
  useEffect(() => {
    if (mode !== 'live' || liveNetwork) return;
    const controller = new AbortController();
    fetch('/data/live-network.json?v=official-v1', {
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw Error('NETWORK_UNAVAILABLE');
        return liveNetworkSchema.parse(await r.json());
      })
      .then(setLiveNetwork)
      .catch(() => {
        if (!controller.signal.aborted) setToast('即時路網未能載入，請再試。');
      });
    return () => controller.abort();
  }, [mode, liveNetwork]);
  useEffect(
    () => () => {
      if (geoWatch.current !== null)
        navigator.geolocation?.clearWatch(geoWatch.current);
    },
    [],
  );
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch('/data/toy-world.json?v=city-v2', {
        signal: controller.signal,
      }).then(async (r) => {
        if (!r.ok) throw Error('車站資料未準備好，請重試。');
        return toyWorldSchema.parse(await r.json());
      }),
      fetch('/data/toy-city.json?v=city-v2', {
        signal: controller.signal,
      }).then(async (r) => {
        if (!r.ok) throw Error('玩具城市未準備好，請重試。');
        return toyCitySchema.parse(await r.json());
      }),
    ])
      .then(([d, c]) => {
        if (!controller.signal.aborted) {
          setData(d);
          setCity(c);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(String(e.message));
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('toy-favorites', JSON.stringify(favs));
      localStorage.setItem('toy-visits', JSON.stringify(visited));
      localStorage.setItem('toy-lines', JSON.stringify(linesTried));
    } catch {
      /* Browser storage may be unavailable; exploration still works. */
    }
  }, [favs, visited, linesTried]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModal(null);
        setRouteOpen(false);
        setQuery('');
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  const command = (kind: typeof action.kind) =>
    setAction((a) => ({ kind, serial: a.serial + 1 }));
  const pick = useCallback((s: Station) => {
    setSelected(s);
    setUpcoming(null);
    setFollow(null);
    setQuery('');
    setRouteOpen(false);
    setBoardOpen(false);
    setBoard(null);
    setVisited((old) =>
      old.includes(s.stationCode) ? old : [...old, s.stationCode],
    );
  }, []);
  const pickUpcoming = useCallback((s: UpcomingStation) => {
    setUpcoming(s);
    setSelected(null);
    setFollow(null);
    setQuery('');
    setRouteOpen(false);
    setBoardOpen(false);
    setAction((a) => ({ kind: 'upcoming', serial: a.serial + 1 }));
  }, []);
  const pickTrain = useCallback((t: ToyTrain) => {
    if (t.mode) setMode(t.mode);
    setSelected(null);
    setFollow(t.id);
    setUpcoming(null);
    setActive(t.line);
    setHasFollowed(true);
    setAction((a) => ({ kind: 'follow', serial: a.serial + 1 }));
  }, []);
  const tick = useCallback(
    (next: ToyTrain[]) => {
      setTrains(next);
      const pending = geoPending.current;
      if (!pending) return;
      const candidates = next
        .filter((t) => t.mode === 'live' && t.dataState === 'predicted')
        .sort(
          (a, b) =>
            haversine(a.coordinates, pending.point) -
            haversine(b.coordinates, pending.point),
        );
      const train = candidates[0];
      if (train && haversine(train.coordinates, pending.point) < 5000) {
        geoPending.current = null;
        pickTrain(train);
        setToast('已跟隨附近預報列車；未能確認你乘搭嘅車。');
      } else if (Date.now() - pending.started > 25000) {
        geoPending.current = null;
        setToast('暫未搵到附近預報列車，可以用列車清單揀車。');
      }
    },
    [pickTrain],
  );
  const changeMode = (next: 'simulation' | 'live') => {
    setMode(next);
    setTrains([]);
    setFollow(null);
    setSelected(null);
    setUpcoming(null);
    geoPending.current = null;
    setBoardOpen(false);
  };
  const stopFollow = useCallback(() => setFollow(null), []);
  const follow = trains.find((t) => t.id === followId);
  const stations = useMemo(
    () =>
      data
        ? [
            ...new Map(
              data.stations.stations.map((s) => [s.stationCode, s]),
            ).values(),
          ]
        : [],
    [data],
  );
  const searchMatches = stations
    .filter((s) =>
      (s.chineseName + ' ' + s.englishName + ' ' + s.stationCode)
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    )
    .slice(0, 7);
  const futureMatches = (data?.upcomingStations ?? []).filter((s) =>
    (s.chineseName + ' ' + s.englishName)
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const nearest = useMemo(() => {
    if (!follow || !data) return null;
    return data.stations.stations
      .filter((s) => s.line === follow.line)
      .sort(
        (a, b) =>
          Math.hypot(
            a.coordinates[0] - follow.coordinates[0],
            a.coordinates[1] - follow.coordinates[1],
          ) -
          Math.hypot(
            b.coordinates[0] - follow.coordinates[0],
            b.coordinates[1] - follow.coordinates[1],
          ),
      )[0];
  }, [follow, data]);
  const ding = () => {
    if (!sound) return;
    const ctx = new AudioContext();
    for (const [i, f] of [784, 1046].entries()) {
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.13);
      g.gain.exponentialRampToValueAtTime(
        0.08,
        ctx.currentTime + i * 0.13 + 0.015,
      );
      g.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + i * 0.13 + 0.2,
      );
      o.connect(g);
      g.connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.13);
      o.stop(ctx.currentTime + i * 0.13 + 0.23);
    }
    setTimeout(() => void ctx.close(), 600);
  };
  const openTrainPicker = () => {
    setPickerTrains(
      trains.filter((t) => t.mode === mode && (!active || t.line === active)),
    );
    setModal('trains');
  };
  const start = () => {
    const choices = trains.filter(
      (t) => t.mode === mode && (!active || t.line === active),
    );
    if (choices.length) {
      ding();
      pickTrain(choices[Math.floor(Math.random() * choices.length)]);
      setPaused(false);
    } else
      setToast(
        mode === 'live'
          ? '暫未有可顯示的官方預報，等更新或揀其他路線。'
          : '小火車正在出庫，等一陣就可以出發！',
      );
    setRouteOpen(false);
  };
  const chooseLine = (line: LineCode) => {
    setRouteOpen(false);
    setActive(active === line ? null : line);
    setFollow(null);
    setLinesTried((old) => (old.includes(line) ? old : [...old, line]));
    ding();
  };
  const locate = () => {
    if (locationOn) {
      if (geoWatch.current !== null)
        navigator.geolocation.clearWatch(geoWatch.current);
      geoWatch.current = null;
      geoPending.current = null;
      setLocationOn(false);
      setLocationFix(null);
      setToast('已關閉定位');
      return;
    }
    if (!navigator.geolocation) {
      setToast('瀏覽器未能定位，仍可用列車清單跟車。');
      return;
    }
    setLocationOn(true);
    setToast('正在搵附近線路及預報列車…');
    let first = true;
    geoWatch.current = navigator.geolocation.watchPosition(
      (p) => {
        const point: [number, number] = [p.coords.longitude, p.coords.latitude];
        setLocationFix({ coordinates: point, accuracy: p.coords.accuracy });
        if (!first) return;
        first = false;
        const nearest = [...stations].sort(
          (a, b) =>
            haversine(a.coordinates, point) - haversine(b.coordinates, point),
        )[0];
        if (!nearest || haversine(nearest.coordinates, point) > 10000) {
          setToast('你似乎唔喺港鐵附近，可以手動揀車遊城市。');
          return;
        }
        setMode('live');
        setActive(nearest.line);
        setPriority(nearest.stationCode);
        setFollow(null);
        setSelected(null);
        setUpcoming(null);
        setBoardOpen(false);
        geoPending.current = { point, started: Date.now() };
        setToast(
          p.coords.accuracy > 1000
            ? '定位較粗略，正在搵附近線路。'
            : '位置已取得，正在配對附近預報。',
        );
      },
      () => {
        setLocationOn(false);
        setLocationFix(null);
        geoPending.current = null;
        if (geoWatch.current !== null)
          navigator.geolocation.clearWatch(geoWatch.current);
        geoWatch.current = null;
        setToast('定位未獲准或未能連線；用列車清單一樣可以跟車。');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 },
    );
  };
  useEffect(() => {
    if (!boardOpen || !selected) return;
    let disposed = false;
    const controller = new AbortController();
    const load = () => {
      fetch(
        `/api/board?line=${selected.line}&station=${selected.stationCode}`,
        { signal: controller.signal },
      )
        .then((r) => r.json())
        .then((body) => {
          if (!disposed) setBoard(body);
        })
        .catch(() => {
          if (!disposed)
            setBoard({
              state: 'unavailable',
              message: '到站資訊暫時未連上，請以車站顯示為準。',
            });
        });
    };
    load();
    const timer = setInterval(load, 30000);
    return () => {
      disposed = true;
      controller.abort();
      clearInterval(timer);
    };
  }, [boardOpen, selected]);
  const searchBox = (
    <div className="search-wrap">
      <span>⌕</span>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="想去邊一站？搜尋一下"
        aria-label="搜尋車站"
      />
      {query && (
        <button aria-label="清除搜尋" onClick={() => setQuery('')}>
          ×
        </button>
      )}
      {query && (
        <div className="search-results">
          {searchMatches.length + futureMatches.length ? (
            <>
              {searchMatches.map((s) => (
                <button
                  key={s.key}
                  onClick={() => {
                    pick(s);
                    setActive(null);
                    command('station');
                  }}
                >
                  <span>{s.chineseName}</span>
                  <small>{s.englishName}</small>
                </button>
              ))}
              {futureMatches.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setActive('TCL');
                    pickUpcoming(s);
                  }}
                >
                  <span>{s.chineseName}</span>
                  <small>未開通 · {s.englishName}</small>
                </button>
              ))}
            </>
          ) : (
            <p>未搵到呢個站喔，試試其他名字。</p>
          )}
        </div>
      )}
    </div>
  );
  const boardRows = board?.directions
    ? Object.values(
        board.directions as Record<
          string,
          { dest: string; plat: string; time: string }[]
        >,
      )
        .flat()
        .sort((a, b) => a.time.localeCompare(b.time))
        .slice(0, 3)
    : [];
  return (
    <div className="app">
      <header>
        <a className="brand" href="/">
          <ToyIcon />
          <div>
            港鐵玩具城<small>HONG KONG · LITTLE RAILWAY</small>
          </div>
        </a>
        <div className="mode-switch" aria-label="列車資料模式">
          <button
            aria-label="模擬遊玩模式"
            aria-pressed={mode === 'simulation'}
            className={mode === 'simulation' ? 'active' : ''}
            onClick={() => changeMode('simulation')}
          >
            ✦ 模擬遊玩
          </button>
          <button
            aria-label="官方預報模式"
            aria-pressed={mode === 'live'}
            className={mode === 'live' ? 'active live' : ''}
            onClick={() => changeMode('live')}
          >
            ◉ 官方預報 <small>位置推算</small>
          </button>
        </div>
        <div className="header-actions">
          <button
            className="notebook-button"
            onClick={() => setModal('favorites')}
          >
            ☆ <span>我的收藏</span>
            <b>{favs.length}</b>
          </button>
          <button
            className="about-button"
            aria-label="家長資訊"
            onClick={() => setModal('about')}
          >
            ?
          </button>
        </div>
      </header>
      <main>
        <aside className={routeOpen ? 'open' : ''}>
          <button
            className="drawer-close"
            onClick={() => setRouteOpen(false)}
            aria-label="關閉路線選單"
          >
            ×
          </button>
          <div className="intro">
            <span className="tiny-label">HELLO, LITTLE EXPLORER!</span>
            <h1>
              小小車長，
              <br />
              今日去邊度<span>？</span>
            </h1>
            <p>揀架小火車，帶你穿山又過海。</p>
          </div>
          {searchBox}
          <div className="route-label">
            <span>揀一條你鍾意嘅路線</span>
            <button
              onClick={() => {
                setActive(null);
                setFollow(null);
              }}
            >
              睇晒全部
            </button>
          </div>
          <div className="line-grid">
            {order.map((line) => (
              <button
                key={line}
                className={'line-tile ' + (active === line ? 'selected ' : '')}
                aria-pressed={active === line}
                style={
                  {
                    '--line': data?.colours[line] ?? '#849a8d',
                  } as React.CSSProperties
                }
                onClick={() => chooseLine(line)}
              >
                <span className="tile-train">
                  <ToyIcon line={line} color={data?.colours[line]} />
                </span>
                <span className="tile-name">
                  {lineInfo[line].zh}
                  <small>{line === 'TCL' ? 'TCL · 新站未開通' : line}</small>
                </span>
                {active === line && <i>✓</i>}
              </button>
            ))}
          </div>
          <button className="start-button" onClick={start}>
            跟住小火車出發 <span>↗</span>
          </button>
          <button className="choose-train-button" onClick={openTrainPicker}>
            揀一架列車遊城市 <span>≋</span>
          </button>
          <div className="adventure-note">
            <span>✦</span>
            <div>
              探索小任務<p>點亮 3 個車站，做個小小探險家！</p>
            </div>
            <button
              aria-label="查看探索任務"
              onClick={() => setModal('missions')}
            >
              →
            </button>
          </div>
          <div className="side-bottom">
            <i />
            {mode === 'live' ? '官方預報・列車位置推算' : '玩具列車行程為模擬'}
            <br />
            <small>車站位置來自 OpenStreetMap</small>
          </div>
        </aside>
        <section
          className="world"
          data-map-ready={ready}
          data-train-mode={mode}
        >
          <div className="mobile-search">{searchBox}</div>
          <div className="map-heading">
            <span className="map-heading-icon">⌁</span>
            <div>
              <b>{active ? lineInfo[active].zh : '一座會動的玩具城市'}</b>
              <span>10 條路線 · {stations.length || 97} 個車站等你探索</span>
            </div>
          </div>
          <div className="map-top-right">
            <span className="simulation-pill">
              <i />
              {mode === 'live' ? '官方預報・位置推算' : '玩具行程・模擬中'}
            </span>
            <button
              aria-label="切換音效"
              className={sound ? 'sound active' : 'sound'}
              onClick={() => {
                setSound(!sound);
                setToast(
                  sound ? '已關閉音效' : '音效已開啟，下次出發會有叮叮聲！',
                );
              }}
            >
              {sound ? '♪' : '♫'}
            </button>
          </div>
          {mode === 'live' && (
            <div
              className={'live-status ' + (liveError ? 'interrupted' : '')}
              role="status"
            >
              <b>
                {liveError ||
                  (!liveFeed
                    ? '正在更新官方預報…'
                    : liveFeed.coverage.stationsFresh === 0
                      ? '暫未有新鮮預報'
                      : liveFeed.diagnostics.cacheState === 'persistence-error'
                        ? '共享快取更新中・部分預報'
                        : liveFeed.lines.some((l) => l.message)
                          ? '部分預報暫缺・位置推算中'
                          : '官方預報・列車位置推算')}
              </b>
              <span>
                {liveFeed
                  ? `${liveFeed.coverage.stationsFresh}/${liveFeed.coverage.stationsTotal} 站已更新 · ${trains.filter((t) => t.mode === 'live').length} 架推算列車 · ${liveFeed.lines.some((l) => l.updatedAt) ? hkClock(Math.max(...liveFeed.lines.map((l) => l.updatedAt ?? 0))) : '暫無資料時間'}`
                  : '分批取得各站預報，唔會用模擬數據代替。'}
              </span>
              {liveFeed && liveFeed.diagnostics.unmappedObservations > 0 && (
                <span>
                  另有 {liveFeed.diagnostics.unmappedObservations}{' '}
                  項預報路徑未能確認，暫未畫出
                </span>
              )}
            </div>
          )}
          {data && city ? (
            <MapView
              data={data}
              city={city}
              controls={{
                mode,
                liveFeed,
                liveNetwork,
                clockOffset,
                paused,
                speed,
                active,
                followId,
              }}
              selected={selected}
              upcoming={upcoming}
              onUpcoming={pickUpcoming}
              onSelect={pick}
              onTrain={pickTrain}
              onTick={tick}
              onReady={setReady}
              onStopFollow={stopFollow}
              action={action}
              locationFix={locationFix}
            />
          ) : (
            <div className="loading-world">
              <ToyIcon big />
              <h2>{error || '小火車準備出庫…'}</h2>
              {error && (
                <button onClick={() => location.reload()}>再試一次</button>
              )}
            </div>
          )}
          {!selected && !followId && !upcoming && (
            <article className="welcome-card">
              <span className="welcome-sticker">出發喇！</span>
              <ToyIcon big color="#87a98a" />
              <h2>下一站，開心！</h2>
              <p>
                點小火車可以跟住佢走，
                <br />
                點車站就會發現新地方。
              </p>
              <button onClick={start}>
                {mode === 'live' ? '跟隨預報列車 ↗' : '隨機去探險 ↗'}
              </button>
              <button className="welcome-list" onClick={openTrainPicker}>
                自己揀車 ≋
              </button>
            </article>
          )}
          {upcoming && (
            <article className="station-card future-card">
              <button
                className="card-close"
                aria-label="關閉未開通車站資訊"
                onClick={() => setUpcoming(null)}
              >
                ×
              </button>
              <span className="card-eyebrow">COMING TO OUR LITTLE CITY</span>
              <h2>{upcoming.chineseName}</h2>
              <span className="station-en">{upcoming.englishName}</span>
              <span className="not-open-badge">新車站 · 未開通</span>
              <p>
                東涌綫嘅新朋友！呢個車站仲未開放畀乘客使用，暫時冇到站預報。
              </p>
              <small>位置來自 OpenStreetMap 原始站點</small>
            </article>
          )}
          {follow && (
            <article className="train-card">
              <button
                className="card-close"
                aria-label="結束跟車"
                onClick={() => setFollow(null)}
              >
                ×
              </button>
              <span className="card-eyebrow">
                {follow.mode === 'live'
                  ? '官方預報 · 位置推算'
                  : 'CHOO CHOO! · 模擬跟車'}
              </span>
              <ToyIcon
                big
                line={follow.line}
                color={data?.colours[follow.line]}
              />
              <h2>{lineInfo[follow.line].zh}小火車</h2>
              <p className="model-reference">
                {trainProfiles[follow.line].nameZh} · 參考造型
              </p>
              {follow.live ? (
                (() => {
                  const trip = follow.live,
                    current = now + clockOffset;
                  const next =
                    trip.points.find(
                      (p) => p.official && p.at >= current - 1000,
                    ) ??
                    trip.points.find((p) => p.at >= current) ??
                    trip.points.at(-1)!;
                  const name = (code: string) =>
                    liveNetwork?.stations.find(
                      (s) => s.line === trip.line && s.code === code,
                    )?.nameZh ?? code;
                  return (
                    <div className="live-train-details">
                      <b>
                        往 {name(trip.dest)}
                        {trip.via === 'RAC' ? ' · 經馬場' : ''}
                      </b>
                      <span>
                        {trip.direction === 'UP' ? '上行' : '下行'} ·{' '}
                        {trip.platform} 號月台預報
                      </span>
                      <div className="train-countdown">
                        <div>
                          <small>
                            {next.official
                              ? next.kind === 'departure'
                                ? '預計離站'
                                : '下一個官方預報站'
                              : '推算下站'}
                          </small>
                          <b>{name(next.station)}</b>
                        </div>
                        <strong>
                          {Math.max(0, Math.ceil((next.at - current) / 1000))}
                          <small>秒</small>
                        </strong>
                      </div>
                      <span
                        className={
                          'data-chip ' +
                          (follow.dataState === 'interrupted' || liveError
                            ? 'warning'
                            : '')
                        }
                      >
                        {follow.dataState === 'interrupted' || liveError
                          ? '資料中斷・續推中'
                          : follow.correcting
                            ? '新預報校正中・位置推算'
                            : '官方時間・位置推算'}
                        {trip.delay ? ' · 延誤' : ''}
                      </span>
                      <small>
                        資料時間 {hkClock(trip.sourceTime)} ·{' '}
                        {next.kind === 'departure' ? '離站' : '到／離站'}
                        預報可更新
                      </small>
                      <small className="virtual-id">
                        推算班次 {tripBadge(trip.id)} · 並非港鐵車號
                      </small>
                    </div>
                  );
                })()
              ) : (
                <p>慢慢睇風景，一齊探索香港。</p>
              )}
              {nearest && (
                <button
                  className="nearby-station"
                  onClick={() => {
                    pick(nearest);
                    command('station');
                  }}
                >
                  <small>地圖上附近嘅車站</small>
                  <b>
                    {nearest.chineseName} <span>→</span>
                  </b>
                </button>
              )}
              <span className="toy-label">
                {follow.mode === 'live'
                  ? '按官方預報推算，唔係 GPS 或實際車款識別'
                  : '玩具列車，唔係真實 GPS 位置'}
              </span>
            </article>
          )}
          {mode === 'live' && followId && !follow && (
            <article className="train-card waiting-follow">
              <button
                className="card-close"
                aria-label="結束跟車"
                onClick={() => setFollow(null)}
              >
                ×
              </button>
              <h2>正在等待新預報</h2>
              <p>原班次暫時未能配對。為免跟錯車，唔會自動換成另一架。</p>
              <button onClick={openTrainPicker}>打開列車清單</button>
            </article>
          )}
          {selected && (
            <article className="station-card">
              <button
                className="card-close"
                aria-label="關閉車站資訊"
                onClick={() => {
                  setSelected(null);
                  setUpcoming(null);
                  setBoardOpen(false);
                }}
              >
                ×
              </button>
              <span className="card-eyebrow">
                HELLO, {selected.stationCode}!
              </span>
              <div className="station-title">
                <div>
                  <h2>{selected.chineseName}</h2>
                  <p>{selected.englishName}</p>
                </div>
                <button
                  className={
                    'favorite-star ' +
                    (favs.includes(selected.key) ? 'saved' : '')
                  }
                  aria-label="收藏車站"
                  onClick={() => {
                    setFavs((old) =>
                      old.includes(selected.key)
                        ? old.filter((k) => k !== selected.key)
                        : [...old, selected.key],
                    );
                    ding();
                  }}
                >
                  {favs.includes(selected.key) ? '★' : '☆'}
                </button>
              </div>
              <span
                className="line-tag"
                style={
                  {
                    '--line': data?.colours[selected.line],
                  } as React.CSSProperties
                }
              >
                {lineInfo[selected.line].zh}
              </span>
              <div className="station-fun">
                <span>✦</span>
                <p>
                  你發現咗一個新地方！
                  <br />
                  沿住彩色軌道，搵下一個車站吧。
                </p>
              </div>
              <button
                className="board-toggle"
                onClick={() => {
                  setBoardOpen(!boardOpen);
                  setBoard(null);
                }}
              >
                ⌚ {boardOpen ? '收起到站資訊' : '睇吓下一班真車'}{' '}
                <span>{boardOpen ? '−' : '+'}</span>
              </button>
              {boardOpen && (
                <div className="arrival-board" role="status">
                  {!board ? (
                    <p>正在問車站…</p>
                  ) : board.state === 'official' ? (
                    <>
                      <span className="official-label">
                        港鐵官方到站預報 {board.delay === 'Y' ? '· 延誤' : ''}
                      </span>
                      {boardRows.length ? (
                        boardRows.map((r, i) => (
                          <div className="arrival" key={i}>
                            <span>
                              往{' '}
                              {data?.stations.stations.find(
                                (s) => s.stationCode === r.dest,
                              )?.chineseName ?? r.dest}
                              <small>{r.plat} 號月台</small>
                            </span>
                            <b>
                              {minutesUntil(r.time, now)}
                              <small>分鐘</small>
                            </b>
                          </div>
                        ))
                      ) : (
                        <p>暫時冇到站預報。</p>
                      )}
                      {board.updatedAt &&
                      now -
                        Date.parse(
                          String(board.updatedAt).replace(' ', 'T') + '+08:00',
                        ) >
                        120000 ? (
                        <p>資料可能已過時，請核對車站顯示。</p>
                      ) : null}
                      <small className="board-time">
                        資料時間：{String(board.updatedAt ?? '未提供')}
                        <br />
                        以車站顯示為準 · 與玩具列車行程無關
                      </small>
                    </>
                  ) : (
                    <p>{String(board.message ?? '未能連接到站資訊。')}</p>
                  )}
                </div>
              )}
              <div className="station-actions">
                <button onClick={() => command('station')}>⌖ 放大呢一站</button>
                <span>✓ 已加入探索紀錄</span>
              </div>
            </article>
          )}
          <div className="camera-controls">
            <button aria-label="放大地圖" onClick={() => command('zoom-in')}>
              +
            </button>
            <button aria-label="縮小地圖" onClick={() => command('zoom-out')}>
              −
            </button>
            <span />
            <button
              aria-label="重設地圖"
              onClick={() => {
                setFollow(null);
                command('home');
              }}
            >
              ⌖
            </button>
            <button
              aria-label="查看全港路網"
              onClick={() => {
                setFollow(null);
                command('island');
              }}
            >
              全港
            </button>
            <button aria-label="切換立體視角" onClick={() => command('tilt')}>
              3D
            </button>
            <button
              aria-label="定位跟車"
              aria-pressed={locationOn}
              className={locationOn ? 'location-on' : ''}
              onClick={locate}
            >
              ◎
            </button>
          </div>
          <div
            className={
              'journey-controls ' + (mode === 'live' ? 'official-controls' : '')
            }
          >
            <button
              disabled={mode === 'live'}
              className="play-button"
              aria-label={
                mode === 'live'
                  ? '官方模式固定真實時間'
                  : paused
                    ? '播放玩具列車'
                    : '暫停玩具列車'
              }
              onClick={() => setPaused(!paused)}
            >
              {paused ? '▶' : 'Ⅱ'}
            </button>
            <div className="journey-label">
              <b>
                {mode === 'live'
                  ? '跟住真實時間出發'
                  : paused
                    ? '小火車休息一下'
                    : '小火車出發中！'}
              </b>
              <span>
                {mode === 'live'
                  ? '官方預報・位置推算・1× 時間'
                  : '模擬行程 · 拖動地圖，自由探索'}
              </span>
            </div>
            <div className="speed-control" hidden={mode === 'live'}>
              <span>車速</span>
              {[1, 3, 10].map((s) => (
                <button
                  className={speed === s ? 'active' : ''}
                  aria-label={`${s}倍速度`}
                  key={s}
                  onClick={() => setSpeed(s)}
                >
                  {s}×
                </button>
              ))}
            </div>
            <button
              className="train-list-shortcut"
              aria-label="列車清單"
              onClick={openTrainPicker}
            >
              ≋
            </button>
          </div>
          <div className="map-caption">
            ♪ 玩具小模型只作裝飾，不代表真實車款或建築比例。
          </div>
        </section>
      </main>
      <nav className="mobile-nav">
        <button
          aria-label="玩具城市"
          onClick={() => {
            setRouteOpen(false);
            setFollow(null);
            setActive(null);
            setSelected(null);
            setUpcoming(null);
            setBoardOpen(false);
            command('home');
          }}
        >
          ⌂<span>玩具城市</span>
        </button>
        <button
          aria-label="揀路線"
          className={routeOpen ? 'active' : ''}
          onClick={() => setRouteOpen(!routeOpen)}
        >
          ≋<span>揀路線</span>
        </button>
        <button onClick={() => setModal('favorites')}>
          ☆<span>我的收藏</span>
        </button>
      </nav>
      {toast && (
        <div className="toast" role="status">
          ✦ {toast}
        </div>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === 'about'
                ? '家長資訊'
                : modal === 'trains'
                  ? '列車清單'
                  : modal === 'favorites'
                    ? '我的收藏'
                    : '探索任務'
            }
            onClick={(e) => e.stopPropagation()}
          >
            <button
              aria-label="關閉視窗"
              className="card-close"
              onClick={() => setModal(null)}
            >
              ×
            </button>
            {modal === 'about' ? (
              <>
                <span className="card-eyebrow">A NOTE FOR GROWN-UPS</span>
                <h2>玩得開心，也睇得明白。</h2>
                <p>呢度係獨立製作嘅香港鐵路探索玩具，並非港鐵官方產品。</p>
                <div className="info-block">
                  <b>模擬遊玩與官方預報</b>
                  <p>
                    模擬模式係玩具行程；官方模式按港鐵預計到／離站時間合併虛擬班次，位置係推算，唔係
                    GPS 或官方車號。預報會更新，無法保證真車一定同動畫同秒到站。
                  </p>
                </div>
                <div className="info-block">
                  <b>真車預報另外睇</b>
                  <p>
                    車站卡嘅官方到站資訊由伺服器讀取港鐵 API，每 30
                    秒更新；沒有資料就顯示未能取得，唔用模擬數據代替。
                  </p>
                </div>
                <p>
                  東涌線按已確認新走線展示；東涌東、東涌西標示「未開通」，未開通車站沒有到站看板。線色暫取
                  OSM，未當成已核實官方色碼。
                </p>
                <p>
                  軌道快照：2026-11-14 21:20:41 UTC
                  <br />
                  Geofabrik Hong Kong ·{' '}
                  <a
                    href="https://www.openstreetmap.org/copyright"
                    target="_blank"
                    rel="noreferrer"
                  >
                    © OpenStreetMap contributors · ODbL
                  </a>
                  <br />
                  海岸線：OpenFreeMap / OpenMapTiles；城市樓宇及道路：本地 OSM
                  PBF
                  <br />
                  到站資訊：© 香港鐵路有限公司
                </p>
                <p>
                  車款造型參考官方資料，由點、線、色塊原創繪製；API
                  沒有實際車款或車號，圖中造型不代表該班實車。收藏同探索紀錄只儲存喺呢個瀏覽器；定位只喺按「定位跟車」時要求，GPS
                  座標不會上傳，只查附近線路及車站預報。建築、樹木、山丘、海港小船同軌道高度係玩具美術示意，唔係測量高度或實景比例。地標以原始
                  OSM 位置放置原創玩具模型。
                </p>
              </>
            ) : modal === 'trains' ? (
              <>
                <span className="card-eyebrow">CHOOSE YOUR LITTLE TRAIN</span>
                <h2>揀一架，一齊遊城市</h2>
                <p>
                  {mode === 'live'
                    ? '官方到站預報班次；位置及身份均為推算。'
                    : '模擬玩具車，自由揀一架出發！'}
                </p>
                <button className="refresh-picker" onClick={openTrainPicker}>
                  ↻ 更新清單
                </button>
                <div className="train-picker">
                  {pickerTrains.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        pickTrain(t);
                        setModal(null);
                        setPaused(false);
                      }}
                    >
                      <ToyIcon line={t.line} />
                      <div>
                        <b>
                          {lineInfo[t.line].zh}{' '}
                          <em className="trip-badge">
                            {t.mode === 'live' ? '預報 ' : '玩具 '}
                            {tripBadge(t.id)}
                          </em>
                        </b>
                        <span>
                          {t.live
                            ? `往 ${liveNetwork?.stations.find((s) => s.line === t.line && s.code === t.live?.dest)?.nameZh ?? t.live.dest} · ${t.live.direction === 'UP' ? '上行' : '下行'}`
                            : trainProfiles[t.line].nameZh}
                        </span>
                        <small>
                          {t.mode === 'live' ? '官方預報 · 位置推算' : '模擬車'}{' '}
                          {t.live
                            ? `${liveNetwork?.stations.find((s) => s.line === t.line && s.code === t.live?.nextStation)?.nameZh ?? t.live.nextStation} · ${hkClock(t.live.targetAt)} ${t.live.targetOfficial ? '預報' : '推算'}`
                            : ''}
                        </small>
                      </div>
                      <i>↗</i>
                    </button>
                  ))}
                </div>
                {!pickerTrains.length && (
                  <div className="empty-book">
                    <ToyIcon big />
                    <b>
                      {mode === 'live'
                        ? '暫未有可顯示的預報班次'
                        : '小火車準備出庫…'}
                    </b>
                    <p>可以揀其他路線或稍後再試。</p>
                  </div>
                )}
                {locationOn && (
                  <p className="location-note">
                    ◎ 定位只用來推薦附近預報；未能辨認你乘搭嘅列車。
                  </p>
                )}
              </>
            ) : modal === 'favorites' ? (
              <>
                <span className="card-eyebrow">MY LITTLE STATION BOOK</span>
                <h2>
                  我的車站收藏簿 <span>☆</span>
                </h2>
                <p>發現新地方，就按星星收埋佢。</p>
                {favs.length ? (
                  favs.map((key) => {
                    const s = data?.stations.stations.find(
                      (s) => s.key === key,
                    );
                    return (
                      s && (
                        <button
                          className="saved-station"
                          key={key}
                          onClick={() => {
                            pick(s);
                            setModal(null);
                            command('station');
                          }}
                        >
                          <span>★</span>
                          <div>
                            <b>{s.chineseName}</b>
                            <small>{lineInfo[s.line].zh}</small>
                          </div>
                          <i>↗</i>
                        </button>
                      )
                    );
                  })
                ) : (
                  <div className="empty-book">
                    <ToyIcon big />
                    <b>第一個珍藏，會係邊一站呢？</b>
                    <p>點一下地圖車站，再按 ☆。</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <span className="card-eyebrow">LITTLE EXPLORER MISSIONS</span>
                <h2>小小探險家，出發！</h2>
                <p>唔使趕時間，慢慢發現香港。</p>
                {[
                  {
                    name: '發現 3 個不同車站',
                    count: visited.length,
                    total: 3,
                    icon: '⌖',
                  },
                  {
                    name: '試玩 3 條不同路線',
                    count: linesTried.length,
                    total: 3,
                    icon: '≋',
                  },
                  {
                    name: '跟住一架小火車',
                    count: hasFollowed ? 1 : 0,
                    total: 1,
                    icon: '↗',
                  },
                ].map((m) => (
                  <div className="mission" key={m.name}>
                    <span>{m.count >= m.total ? '★' : m.icon}</span>
                    <div>
                      <b>{m.name}</b>
                      <progress max={m.total} value={m.count} />
                    </div>
                    <small>
                      {Math.min(m.count, m.total)}/{m.total}
                    </small>
                  </div>
                ))}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
