/** Soft, object-style illustrations for the product cards (original artwork). */

const Shadow = ({ cx = 120, cy = 150, rx = 70 }: { cx?: number; cy?: number; rx?: number }) => (
  <ellipse cx={cx} cy={cy} rx={rx} ry={9} fill="url(#ill-shadow)" />
)

function Defs() {
  return (
    <defs>
      <radialGradient id="ill-shadow">
        <stop offset="0%" stopColor="#0A0A0B" stopOpacity="0.18" />
        <stop offset="100%" stopColor="#0A0A0B" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="ill-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="100%" stopColor="#E6E6EA" />
      </linearGradient>
      <linearGradient id="ill-side" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#D9D9DE" />
        <stop offset="100%" stopColor="#C9C9CF" />
      </linearGradient>
      <linearGradient id="ill-dark" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#3A3A40" />
        <stop offset="100%" stopColor="#0A0A0B" />
      </linearGradient>
      <linearGradient id="ill-orange" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFB45C" />
        <stop offset="100%" stopColor="#E07C06" />
      </linearGradient>
    </defs>
  )
}

export function VaultIllustration() {
  return (
    <svg viewBox="0 0 240 170" className="h-full w-full">
      <Defs />
      <Shadow />
      <rect x="62" y="38" width="116" height="104" rx="18" fill="url(#ill-side)" />
      <rect x="58" y="32" width="116" height="104" rx="18" fill="url(#ill-dark)" />
      <rect x="66" y="40" width="100" height="88" rx="12" fill="none" stroke="#FFFFFF" strokeOpacity="0.08" />
      <circle cx="116" cy="84" r="30" fill="#1C1C20" stroke="#FFFFFF" strokeOpacity="0.12" />
      {Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2
        return <line key={i} x1={116 + Math.cos(a) * 24} y1={84 + Math.sin(a) * 24} x2={116 + Math.cos(a) * 28} y2={84 + Math.sin(a) * 28} stroke="#FFFFFF" strokeOpacity={i % 6 === 0 ? 0.5 : 0.15} />
      })}
      <circle cx="116" cy="84" r="14" fill="url(#ill-orange)" />
      <text x="116" y="89.5" textAnchor="middle" fontSize="15" fontWeight="700" fill="#fff" fontFamily="system-ui">
        ₿
      </text>
      <rect x="160" y="70" width="6" height="28" rx="3" fill="#FFFFFF" fillOpacity="0.15" />
    </svg>
  )
}

export function CertificateIllustration() {
  return (
    <svg viewBox="0 0 240 170" className="h-full w-full">
      <Defs />
      <Shadow />
      <g transform="rotate(-6 120 85)">
        <rect x="70" y="30" width="110" height="110" rx="8" fill="#ECECEF" />
      </g>
      <rect x="66" y="26" width="110" height="114" rx="8" fill="url(#ill-body)" stroke="#E2E2E6" />
      <rect x="78" y="40" width="44" height="5" rx="2.5" fill="#0A0A0B" />
      <rect x="78" y="52" width="70" height="4" rx="2" fill="#D6D6DB" />
      <rect x="78" y="61" width="58" height="4" rx="2" fill="#D6D6DB" />
      <rect x="78" y="80" width="28" height="12" rx="3" fill="#ECFDF3" />
      <text x="92" y="89" textAnchor="middle" fontSize="7" fill="#15803D" fontFamily="system-ui" fontWeight="600">
        ACTIVE
      </text>
      <rect x="78" y="104" width="40" height="4" rx="2" fill="#D6D6DB" />
      <rect x="78" y="113" width="30" height="4" rx="2" fill="#D6D6DB" />
      <path d="M150 116 l-8 26 l10 -6 l6 10 l4 -24z" fill="#C2650A" />
      <path d="M162 116 l8 26 l-10 -6 l-6 10 l-4 -24z" fill="#E07C06" />
      <circle cx="156" cy="112" r="17" fill="url(#ill-orange)" />
      <path d="M148 112 l5 5 l10 -10" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ClaimIllustration() {
  return (
    <svg viewBox="0 0 240 170" className="h-full w-full">
      <Defs />
      <Shadow />
      <rect x="114" y="40" width="12" height="96" rx="3" fill="url(#ill-side)" />
      <rect x="92" y="132" width="56" height="12" rx="4" fill="url(#ill-dark)" />
      <g transform="rotate(-8 120 52)">
        <rect x="54" y="48" width="132" height="7" rx="3.5" fill="url(#ill-dark)" />
        <line x1="66" y1="55" x2="58" y2="92" stroke="#9B9EA6" />
        <line x1="66" y1="55" x2="82" y2="92" stroke="#9B9EA6" />
        <path d="M50 92 h40 a20 10 0 0 1 -40 0z" fill="url(#ill-body)" stroke="#D6D6DB" />
        <line x1="174" y1="55" x2="162" y2="86" stroke="#9B9EA6" />
        <line x1="174" y1="55" x2="186" y2="86" stroke="#9B9EA6" />
        <path d="M154 86 h40 a20 10 0 0 1 -40 0z" fill="url(#ill-body)" stroke="#D6D6DB" />
        <circle cx="174" cy="80" r="8" fill="url(#ill-orange)" />
      </g>
      <circle cx="120" cy="40" r="7" fill="url(#ill-orange)" />
    </svg>
  )
}

export function CircuitIllustration() {
  const nodes = [
    [62, 52],
    [178, 52],
    [120, 128],
  ]
  return (
    <svg viewBox="0 0 240 170" className="h-full w-full">
      <Defs />
      <Shadow cy={152} rx={80} />
      <g stroke="#C4C6CC" strokeWidth="2" strokeDasharray="3 5" fill="none">
        <path d="M80 50 Q120 30 160 50" />
        <path d="M170 68 Q160 110 134 120" />
        <path d="M106 120 Q78 110 70 68" />
      </g>
      <g stroke="#F7931A" strokeWidth="3" fill="none" strokeLinecap="round">
        <path d="M120 128 L120 98" />
        <path d="M112 102 L120 94 L128 102" />
      </g>
      <circle cx="120" cy="84" r="13" fill="url(#ill-orange)" />
      <text x="120" y="88" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff" fontFamily="system-ui">
        =
      </text>
      {nodes.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y + 4} r="19" fill="url(#ill-side)" />
          <circle cx={x} cy={y} r="19" fill={i === 2 ? "url(#ill-dark)" : "url(#ill-body)"} stroke="#E2E2E6" />
          <rect x={x - 7} y={y - 3} width="14" height="6" rx="3" fill={i === 2 ? "#FFFFFF" : "#0A0A0B"} fillOpacity={i === 2 ? 0.8 : 0.85} />
        </g>
      ))}
    </svg>
  )
}

/** Small icons for the "risk" cards. */
export function GaugeIllustration() {
  return (
    <svg viewBox="0 0 240 150" className="h-full w-full">
      <Defs />
      <Shadow cy={132} rx={60} />
      <circle cx="120" cy="76" r="50" fill="url(#ill-body)" stroke="#E2E2E6" />
      <path d="M84 98 A42 42 0 1 1 156 98" fill="none" stroke="#ECECEF" strokeWidth="8" strokeLinecap="round" />
      <path d="M84 98 A42 42 0 0 1 142 41" fill="none" stroke="#F7931A" strokeWidth="8" strokeLinecap="round" />
      <text x="120" y="80" textAnchor="middle" fontSize="20" fontWeight="600" fill="#0A0A0B" fontFamily="ui-monospace,monospace">
        160%
      </text>
      <text x="120" y="96" textAnchor="middle" fontSize="8" fill="#9B9EA6" fontFamily="system-ui">
        AT BTC −40%
      </text>
    </svg>
  )
}

export function LockIllustration() {
  return (
    <svg viewBox="0 0 240 150" className="h-full w-full">
      <Defs />
      <Shadow cy={132} rx={56} />
      <path d="M96 64 v-14 a24 24 0 0 1 48 0 v14" fill="none" stroke="url(#ill-side)" strokeWidth="12" />
      <rect x="82" y="60" width="76" height="64" rx="14" fill="url(#ill-dark)" />
      <circle cx="120" cy="88" r="8" fill="url(#ill-orange)" />
      <rect x="117" y="92" width="6" height="16" rx="3" fill="#E07C06" />
    </svg>
  )
}

export function ShieldIllustration() {
  return (
    <svg viewBox="0 0 240 150" className="h-full w-full">
      <Defs />
      <Shadow cy={132} rx={56} />
      <path d="M120 26 l44 16 v28 c0 26 -19 46 -44 54 c-25 -8 -44 -28 -44 -54 v-28z" fill="url(#ill-body)" stroke="#E2E2E6" />
      <path d="M120 38 l32 12 v20 c0 19 -14 34 -32 40 z" fill="url(#ill-orange)" opacity="0.95" />
      <path d="M104 74 l11 11 l21 -22" stroke="#0A0A0B" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
