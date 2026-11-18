import type { LineCode } from '@hk-mtr/shared';
import { picturePaint } from './pictureTrain';
import { trainProfiles } from './trainProfiles';
export function ToyIcon({
  color = '#7397bd',
  big = false,
  line,
}: {
  color?: string;
  big?: boolean;
  line?: LineCode;
}) {
  const p = line ? trainProfiles[line] : null;
  const body = line ? picturePaint[line] : color,
    stripe = p?.stripe ?? '#fff0c5',
    nose = body,
    glass = '#b8dded';
  const rounded = p?.family === 'airport-caf' || p?.family === 'tung-chung-caf';
  const resort = p?.family === 'resort-converted';
  return (
    <svg
      viewBox="0 0 120 86"
      fill="none"
      aria-hidden="true"
      className={big ? 'toy-icon big' : 'toy-icon'}
    >
      <ellipse cx="60" cy="77" rx="45" ry="5" fill="#526d5c" opacity=".12" />
      <path
        d={
          rounded
            ? 'M19 24Q19 14 30 14H77Q91 14 98 32L107 54Q111 66 97 67H29Q16 67 16 56Z'
            : 'M19 22Q19 12 30 12H79Q92 12 96 27L105 55Q108 66 96 67H29Q16 67 16 56Z'
        }
        fill={body}
        stroke="#30303a"
        strokeWidth="2"
      />
      <rect
        x="25"
        y="8"
        width="57"
        height="10"
        rx="5"
        fill={line ? picturePaint[line] : '#fff5da'}
      />
      {resort ? (
        <>
          <circle cx="36" cy="34" r="10" fill={glass} />
          <circle cx="63" cy="34" r="10" fill={glass} />
        </>
      ) : (
        <>
          <rect x="27" y="25" width="19" height="19" rx="4" fill={glass} />
          <rect x="52" y="25" width="19" height="19" rx="4" fill={glass} />
        </>
      )}
      <path d="M77 20H87Q93 25 97 39L105 55H78Z" fill={nose} />
      <path
        d="M77 24H88L97 45H76Z"
        fill={glass}
        stroke="#30303a"
        strokeWidth="2"
      />
      {line &&
        line !== 'AEL' &&
        [81, 90].map((x) => (
          <g key={x}>
            <ellipse cx={x} cy="36" rx="4.3" ry="6.2" fill="white" />
            <ellipse cx={x + 1} cy="37" rx="2.8" ry="4.2" fill="#26252a" />
            <circle cx={x + 2} cy="35" r="1" fill="white" />
          </g>
        ))}
      <rect x="20" y="52" width="86" height="8" rx="3" fill={stripe} />
      <path
        d="M49 23V50M23 49H75"
        stroke={line ? picturePaint[line] : '#fff5da'}
        strokeWidth="2"
      />
      {line && (
        <rect
          x="33"
          y="8"
          width="18"
          height="6"
          rx="2"
          fill={p?.badge ?? color}
        />
      )}
      <circle cx="34" cy="69" r="8" fill="#445d66" />
      <circle cx="88" cy="69" r="8" fill="#445d66" />
      <circle cx="34" cy="69" r="3" fill="#afc6c5" />
      <circle cx="88" cy="69" r="3" fill="#afc6c5" />
      <circle cx="85" cy="48" r="2.1" fill="#fff3bd" />
      <circle cx="98" cy="48" r="2.1" fill="#fff3bd" />
      <path
        d="M88 61Q92 65 96 61"
        stroke="#35594e"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
