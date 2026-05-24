// Data-driven front screen — Direction 2 styling (Photo Mosaic Poster)
// with red accent, lightning-bolt status, real logo, and slideshow background.

const W = 1080;
const H = 1080;

// Dark-first palette: bright accents stay on glows, indicators, and borders.
const RED = "#E63946";
const RED_GLOW = "#FF2D3F";
const AMBER = "#D88918";
const WHITE = "#FFFFFF";
const MONTH_LABEL = "rgba(255,255,255,0.78)";
const PANEL_BG = "rgba(8,8,12,0.46)";
const PANEL_FOOTER_BG = "rgba(8,8,12,0.68)";
const PANEL_DIVIDER = "rgba(255,255,255,0.12)";
const dataScaleMs = window.scaleMs || ((ms) => ms);
const dataScaleCssTime = window.scaleCssTime || ((value) => value);

function clampCh(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}
function rgb2hsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min,
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r
      ? (g - b) / d + (g < b ? 6 : 0)
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4;
  return { h: h * 60, s, l };
}
function hue2rgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}
function hsl2rgb(h, s, l) {
  h /= 360;
  if (s === 0) {
    const gv = clampCh(l * 255);
    return { r: gv, g: gv, b: gv };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s,
    p = 2 * l - q;
  return {
    r: clampCh(hue2rgb(p, q, h + 1 / 3) * 255),
    g: clampCh(hue2rgb(p, q, h) * 255),
    b: clampCh(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}
function deriveThemeColor(accentRgb, hueDelta, lTarget, sScale) {
  if (!accentRgb) return null;
  const { h, s } = rgb2hsl(accentRgb.r, accentRgb.g, accentRgb.b);
  const { r, g, b } = hsl2rgb(
    (h + hueDelta + 360) % 360,
    Math.min(0.95, s * (sScale || 1)),
    lTarget,
  );
  return {
    css: `rgb(${r},${g},${b})`,
    glow1: `rgba(${r},${g},${b},0.9)`,
    glow2: `rgba(${r},${g},${b},0.52)`,
  };
}
const SOLD_FALLBACK = {
  css: RED,
  glow1: "rgba(230,57,70,0.9)",
  glow2: "rgba(230,57,70,0.55)",
};
const LOW_FALLBACK = {
  css: AMBER,
  glow1: "rgba(255,182,39,0.95)",
  glow2: "rgba(255,182,39,0.55)",
};

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function usePulse(periodMs) {
  const [now, setNow] = React.useState(() => performance.now());
  React.useEffect(() => {
    let f;
    const tick = () => {
      setNow(performance.now());
      f = requestAnimationFrame(tick);
    };
    f = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(f);
  }, []);
  const t = (now % periodMs) / periodMs;
  return 0.7 + 0.3 * Math.cos(t * 2 * Math.PI);
}

// Status thresholds (based on a 1300-cap baseline; scaled by actual capacity).
// >= capacity — SOLD OUT (red text, black bolt with red glow)
// >= 1000     — LOW TIX  (amber text, black bolt with amber glow)
function statusForCount(sold, capacity) {
  if (!capacity) return null;
  const ratio = capacity / 1300;
  const soldEff = Math.round(sold);
  const soldOutAt = capacity; // when capacity is reached
  const lowAt = Math.round(1000 * ratio);

  if (soldEff >= soldOutAt - 5) return "sold"; // tiny float for "effectively sold out"
  if (soldEff >= lowAt) return "low";
  return null;
}
// 7-month window from today (2026-05-01).
function getDisplayEvents(allEvents) {
  const cutoff = new Date("2026-12-01");
  return allEvents
    .filter((e) => {
      const d = new Date(e.date);
      if (d < new Date("2026-04-15")) return false;
      if (d > cutoff) return false;
      if (e.capacity > 2000) return false; // skip festival outliers
      return true;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

// Shorten long event names so they fit in narrow columns
const SHORT_NAME_OVERRIDES = {
  "Despised Icon, Carnifex, Suffocation": "Despised Icon",
  "Chuckie & Tazer Present RNB & Slow Jams": "RNB & Slow Jams",
  "PRIMAL SCREAM - XTRMNTR": "Primal Scream",
  "Primal Scream — XTRMNTR": "Primal Scream",
  "Primal Scream - XTRMNTR": "Primal Scream",
  "The Undertones: 50th Anniversary Show": "The Undertones",
  "RNB MANIA | Bristol's R&B Festival": "Rnb Mania",
};
function shorten(name) {
  if (!name) return "";
  // exact-match overrides still apply (purely cosmetic substitutions)
  if (SHORT_NAME_OVERRIDES[name]) return SHORT_NAME_OVERRIDES[name];
  let out = (window.cleanName ? window.cleanName(name) : name).trim();
  // strip parens and trailing presents/with phrases (these are noise)
  out = out.replace(/\s*\(.*?\)\s*/g, " ").trim();
  out = out.replace(/\s+(presents?|w\/|with|featuring|feat\.?).*$/i, "").trim();
  // For multi-act bills, condense to first act + count
  if (/,/.test(out)) {
    const parts = out.split(/\s*,\s*/).filter(Boolean);
    if (parts.length > 1) out = parts[0] + " +";
  }
  // No hard char cap — long names are allowed; the row will wrap to 2 lines.
  return out;
}

// Paginate groups so no page exceeds MAX_PER_PAGE events,
// and never split a month across pages. If a single month is bigger
// than the cap, it gets its own page (rare — caps are not hard).
const MAX_PER_PAGE = 25;
function paginate(groups) {
  const pages = [];
  let current = [];
  let currentCount = 0;
  for (const g of groups) {
    const n = g.events.length;
    if (current.length > 0 && currentCount + n > MAX_PER_PAGE) {
      pages.push(current);
      current = [];
      currentCount = 0;
    }
    current.push(g);
    currentCount += n;
  }
  if (current.length) pages.push(current);
  return pages;
}

// ---------- ONE PAGE OF LISTINGS ----------
// Fixed type sizes — same across all pages, calibrated to the densest page (page 2).
/* const MONTH_SIZE = 36;
const EVENT_SIZE = 22;
const BOLT_SIZE = 22; */
const MONTH_SIZE = 42;
const EVENT_SIZE = 28;
const BOLT_SIZE = 28;

const DOT_WARM_FALLBACK = { r: 210, g: 140, b: 50 };
const DOT_COOL_FALLBACK = { r: 100, g: 175, b: 230 };

function renderEventRow(e, soldTheme, lowTheme, accentCss, warmRgb, coolRgb, pulseOpacity = 1) {
  const status = statusForCount(e.sold, e.capacity);
  const isLow = status === "low";
  const isSold = status === "sold";
  const isClub = e.type === "club";
  const lT = lowTheme || LOW_FALLBACK;
  const sT = soldTheme || SOLD_FALLBACK;
  const dateColor = isLow ? lT.css : isSold ? sT.css : undefined;
  const dateGlow = isLow
    ? `0 0 10px ${lT.glow1}, 0 0 24px ${lT.glow2}`
    : isSold
      ? `0 0 10px ${sT.glow1}, 0 0 24px ${sT.glow2}`
      : "none";
  const nameColor = isLow ? lT.css : isSold ? sT.css : undefined;
  const nameGlow = isLow
    ? `0 0 10px ${lT.glow1}, 0 0 20px ${lT.glow2}, 0 1px 4px rgba(0,0,0,0.6)`
    : isSold
      ? `0 0 12px ${sT.glow1}, 0 0 28px ${sT.glow2}, 0 1px 4px rgba(0,0,0,0.62)`
      : "none";
  return (
    <div
      key={e.date}
      style={{
        position: "relative",
        display: "flex",
        gap: 10,
        alignItems: "center",
        overflow: "hidden",
        marginBottom: 2,
      }}
    >
      {isSold && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            borderRadius: 2,
            background: `radial-gradient(ellipse 80% 100% at 50% 50%, ${sT.glow2} 0%, transparent 70%)`,
            animation: `sold-haze ${dataScaleCssTime("3s")} linear infinite`,
            opacity: 0,
          }}
        />
      )}
      {/* Type indicator dot: warm for live, cool for club, red when sold out — all breathing */}
      {(() => {
        const wRgb = warmRgb || DOT_WARM_FALLBACK;
        const cRgb = coolRgb || DOT_COOL_FALLBACK;
        const dotRgb = isSold ? { r: 255, g: 45, b: 63 } : isClub ? cRgb : wRgb;
        const dotCss = `rgb(${dotRgb.r},${dotRgb.g},${dotRgb.b})`;
        const dotGlow1 = `rgba(${dotRgb.r},${dotRgb.g},${dotRgb.b},0.85)`;
        const dotGlow2 = `rgba(${dotRgb.r},${dotRgb.g},${dotRgb.b},0.42)`;
        return (
          <span style={{
            width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
            background: dotCss,
            boxShadow: `0 0 8px ${dotGlow1}, 0 0 20px ${dotGlow2}`,
            opacity: isSold ? 1 : pulseOpacity,
            alignSelf: "center",
          }} />
        );
      })()}
      <span
        style={{
          opacity: isLow || isSold ? 0.95 : 0.5,
          color: dateColor,
          textShadow: dateGlow,
          width: EVENT_SIZE * 2.15,
          fontWeight: 700,
          flexShrink: 0,
          fontVariantNumeric: "tabular-nums",
          display: "inline-flex",
          alignItems: "flex-start",
          gap: 2,
        }}
      >
        <span>
          <ScrambleText seed={1}>
            {e.day.toString().padStart(2, "0")}
          </ScrambleText>
        </span>
        <sup
          style={{
            fontSize: "0.5em",
            lineHeight: 1,
            letterSpacing: "0.05em",
            opacity: 0.85,
            paddingTop: "0.15em",
          }}
        >
          {window.daySuffix ? window.daySuffix(e.day) : ""}
        </sup>
      </span>
      <span
        style={{
          width: BOLT_SIZE * 0.85,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {status ? (
          <span
            style={
              isSold
                ? {
                    animation: `sold-bolt-flicker ${dataScaleCssTime("3s")} linear infinite`,
                    display: "inline-flex",
                  }
                : undefined
            }
          >
            <StatusMark
              kind={status}
              size={BOLT_SIZE}
              color={isLow ? lT.css : sT.css}
            />
          </span>
        ) : (
          <span
            style={{
              color: WHITE,
              fontWeight: 700,
              lineHeight: 1,
              opacity: 0.45,
            }}
          >
            -
          </span>
        )}
      </span>
      <span
        style={{
          textTransform: "uppercase",
          flex: 1,
          minWidth: 0,
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 3,
          overflow: "hidden",
          lineHeight: 1.12,
          wordBreak: "break-word",
          fontSize: 32,
          fontWeight: 700,
          opacity: isLow || isSold ? 1 : 0.82,
          color: nameColor,
          textShadow: nameGlow,
        }}
      >
        <ScrambleText seed={2}>{shorten(e.name)}</ScrambleText>
      </span>
    </div>
  );
}

function renderMonthHeader(monthName, accentCss, monthRgb) {
  const monthCss = monthRgb
    ? `rgb(${monthRgb.r},${monthRgb.g},${monthRgb.b})`
    : null;
  const monthGlow = monthRgb
    ? `rgba(${monthRgb.r},${monthRgb.g},${monthRgb.b},0.55)`
    : null;
  return (
    <div
      style={{
        fontFamily: "'Anton',sans-serif",
        fontSize: MONTH_SIZE,
        color: monthCss || MONTH_LABEL,
        letterSpacing: "0.06em",
        lineHeight: 1,
        marginBottom: 10,
        textShadow: monthCss
          ? `0 0 6px ${monthGlow}, 0 0 18px ${monthGlow}, 4px 4px 0 rgba(0,0,0,0.82)`
          : `0 0 12px rgba(255,255,255,0.08), 4px 4px 0 rgba(0,0,0,0.82)`,
      }}
    >
      <ScrambleText seed={42}>{monthName}</ScrambleText>
    </div>
  );
}

const SOLD_EFFECT_STYLES = `
  @keyframes sold-haze {
    0%, 100% { opacity: 0; }
    12% { opacity: 0.22; }
    13% { opacity: 0.1; }
    14% { opacity: 0.18; }
    22% { opacity: 0; }
    40% { opacity: 0; }
    41% { opacity: 0.14; }
    50% { opacity: 0; }
    65% { opacity: 0; }
    66% { opacity: 0.26; }
    67% { opacity: 0.12; }
    68% { opacity: 0.2; }
    78% { opacity: 0; }
  }
  @keyframes sold-bolt-flicker {
    0%, 100% { filter: brightness(1); }
    12% { filter: brightness(2.8); }
    13% { filter: brightness(1.2); }
    14% { filter: brightness(2.4); }
    15% { filter: brightness(1); }
    40% { filter: brightness(1); }
    41% { filter: brightness(2.2); }
    42% { filter: brightness(1); }
    65% { filter: brightness(1); }
    66% { filter: brightness(3.0); }
    67% { filter: brightness(1.3); }
    68% { filter: brightness(2.6); }
    69% { filter: brightness(1); }
  }
`;

const ListingsPage = React.forwardRef(function ListingsPage(
  { groups, absolute = false, soldTheme, lowTheme, accentCss, monthRgb, warmRgb = null, coolRgb = null, pulseOpacity = 1 },
  ref,
) {
  const wrapStyle = {
    position: absolute ? "absolute" : "relative",
    inset: absolute ? 0 : undefined,
    padding: "16px 30px 10px",
    fontFamily: "'Space Grotesk',sans-serif",
    fontSize: EVENT_SIZE,
    lineHeight: 1.3,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };

  // Single month: split events evenly across 2 columns, each with its own header.
  if (groups.length === 1) {
    const g = groups[0];
    const half = Math.ceil(g.events.length / 2);
    return (
      <div ref={ref} style={wrapStyle}>
        <style>{SOLD_EFFECT_STYLES}</style>
        <div style={{ flex: 1, overflow: "hidden", display: "flex", gap: 28 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {renderMonthHeader(g.monthName, accentCss, monthRgb)}
            {g.events
              .slice(0, half)
              .map((e) => renderEventRow(e, soldTheme, lowTheme, accentCss, warmRgb, coolRgb, pulseOpacity))}
          </div>
          {g.events.length > half && (
            <div style={{ flex: 1, minWidth: 0 }}>
              {g.events
                .slice(half)
                .map((e) => renderEventRow(e, soldTheme, lowTheme, accentCss, warmRgb, coolRgb, pulseOpacity))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Multiple months: distribute whole months across 2 columns, balanced by event count.
  const numCols = 2;
  const totalEvents = groups.reduce((s, g) => s + g.events.length, 0);
  const target = Math.ceil(totalEvents / numCols);
  const cols = [];
  let cur = [],
    count = 0;
  for (const g of groups) {
    const n = g.events.length;
    if (cols.length < numCols - 1 && count > 0) {
      const wouldBe = count + n;
      // Split now if we've hit the target, or if adding this group overshoots it
      // by more than staying put would (pick the closer side of target).
      const splitNow =
        count >= target ||
        (wouldBe > target &&
          Math.abs(count - target) <= Math.abs(wouldBe - target));
      if (splitNow) {
        cols.push(cur);
        cur = [];
        count = 0;
      }
    }
    cur.push(g);
    count += n;
  }
  cols.push(cur);

  return (
    <div ref={ref} style={wrapStyle}>
      <style>{SOLD_EFFECT_STYLES}</style>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", gap: 28 }}>
        {cols.map((colGroups, ci) => (
          <div key={ci} style={{ flex: 1, minWidth: 0 }}>
            {colGroups.map((g) => (
              <div key={g.key} style={{ marginBottom: 14 }}>
                {renderMonthHeader(g.monthName, accentCss, monthRgb)}
                {g.events.map((e) =>
                  renderEventRow(e, soldTheme, lowTheme, accentCss, warmRgb, coolRgb, pulseOpacity),
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
});

// ---------- LIGHTNING BOLT ----------
const Bolt = ({ color, size = 16, glow = true }) => (
  <svg
    width={size * 0.7}
    height={size}
    viewBox="0 0 14 20"
    style={{
      display: "inline-block",
      verticalAlign: "middle",
      filter: glow
        ? `drop-shadow(0 0 6px ${color}) drop-shadow(0 0 16px ${color})`
        : "none",
      flexShrink: 0,
    }}
  >
    <path d="M8 0 L0 11 L5 11 L4 20 L14 7 L8.5 7 L10 0 Z" fill={color} />
  </svg>
);

// Outlined bolt — black fill, glowing colored stroke. Used for sold-out / selling-fast.
const HollowBolt = ({ color, size = 16, glow = true, shadow = false }) => (
  <svg
    width={size * 0.78}
    height={size}
    viewBox="0 0 14 20"
    style={{
      display: "inline-block",
      verticalAlign: "middle",
      filter:
        [
          glow
            ? `drop-shadow(0 0 6px ${color}) drop-shadow(0 0 16px ${color})`
            : "",
          shadow ? "drop-shadow(3px 4px 0 rgba(0,0,0,0.88))" : "",
        ]
          .filter(Boolean)
          .join(" ") || "none",
      flexShrink: 0,
    }}
  >
    <path
      d="M8 0 L0 11 L5 11 L4 20 L14 7 L8.5 7 L10 0 Z"
      fill="#000"
      stroke={color}
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

const StatusMark = ({ kind, size = 22, color = null }) => {
  if (!kind) {
    // reserve space so rows align across statuses
    return (
      <span
        style={{
          display: "inline-block",
          width: size * 0.78,
          height: size,
          flexShrink: 0,
        }}
      />
    );
  }
  if (kind === "low") return <HollowBolt color={color || AMBER} size={size} />;
  if (kind === "extreme") return <Bolt color={color || RED} size={size} />;
  if (kind === "sold") return <HollowBolt color={color || RED} size={size} />;
  if (kind === "fast") return <HollowBolt color={color || WHITE} size={size} />;
  return null;
};

const StatusBolt = StatusMark; // backwards-compat alias

// ---------- LOGO ----------
// Render two stacked SVGs so we can apply a real CSS pixel-space drop-shadow
// to the "BRISTOL" half (matching the text glow on TO/UPCOMING). Inline the
// split SVG (cached) so the filter operates on the bristol shapes alone.
let _logoSvgCache = null;
function useLogoSvg() {
  const [svg, setSvg] = React.useState(_logoSvgCache);
  React.useEffect(() => {
    if (_logoSvgCache) return;
    fetch("img/electric-logo-split.svg")
      .then((r) => r.text())
      .then((text) => {
        _logoSvgCache = text;
        setSvg(text);
      })
      .catch(() => {});
  }, []);
  return svg;
}

const LOGO_RED = "#C41E2A";
const LOGO_RED_GLOW = "#FF2D3F";

const Logo = ({ width = 320, accentColor = null }) => {
  const svg = useLogoSvg();
  if (!svg) {
    return (
      <img
        src="img/electric-logo.png"
        alt="Electric Bristol"
        style={{
          width,
          height: "auto",
          display: "block",
          filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.6))",
        }}
      />
    );
  }

  const bristolFill = accentColor || LOGO_RED_GLOW;
  const bristolGlow = accentColor || LOGO_RED_GLOW;

  // Build two HTML snippets:
  //  - electricOnly: hide bristol group, paint electric white
  //  - bristolOnly:  hide electric group, paint bristol red (glow via wrapper)
  // Scope styles per-layer so the two inline SVGs don't override each other.
  const electricOnly = svg.replace(
    /<svg([^>]*)>/,
    `<svg$1 class="eb-logo-electric-only" style="width:100%;height:auto;display:block">
      <style>.eb-logo-electric-only .logo-electric { fill: #FFFFFF; } .eb-logo-electric-only .logo-bristol { display: none; }</style>`,
  );
  const bristolOnly = svg.replace(
    /<svg([^>]*)>/,
    `<svg$1 class="eb-logo-bristol-only" style="width:100%;height:auto;display:block">
      <style>.eb-logo-bristol-only .logo-bristol { fill: ${bristolFill}; } .eb-logo-bristol-only .logo-electric { display: none; }</style>`,
  );

  return (
    <div
      aria-label="Electric Bristol"
      style={{
        position: "relative",
        width,
        height: "auto",
        filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.6))",
      }}
    >
      <div dangerouslySetInnerHTML={{ __html: electricOnly }} />
      {/* Bristol layer pinned over the same area, with a real CSS pixel glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          filter: `drop-shadow(0 0 6px ${bristolGlow}) drop-shadow(0 2px 8px rgba(0,0,0,0.9))`,
        }}
        dangerouslySetInnerHTML={{ __html: bristolOnly }}
      />
    </div>
  );
};

// ---------- BACKGROUND SLIDESHOW ----------
const ALL_PHOTOS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
  23, 24, 25,
];
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const BackgroundSlideshow = React.memo(function BackgroundSlideshow({
  interval = 6500,
  coolRgb = null,
  darkRgb = null,
  warmRgb = null,
}) {
  const bgTint = React.useMemo(() => {
    // Use the actual dark ambient color from the image if available, else fall back to coolRgb darkened
    const src = darkRgb || coolRgb;
    console.log(src);
    if (!src) return "rgba(0,0,0,0.1)";
    const { h, s } = rgb2hsl(src.r, src.g, src.b);
    const { r, g, b } = hsl2rgb(h, Math.min(s * 0.2, 0.3), 0.1);
    return `rgba(${r},${g},${b},0.06)`;
  }, [
    darkRgb
      ? `${darkRgb.r},${darkRgb.g},${darkRgb.b}`
      : coolRgb
        ? `${coolRgb.r},${coolRgb.g},${coolRgb.b}`
        : null,
  ]);
  const fadeMs = dataScaleMs(1500);
  const slideInterval = dataScaleMs(interval);
  const zoomMs = dataScaleMs(7000);
  const renderDurationMs = React.useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const d = parseFloat(params.get("duration"));
    return d ? d * 1000 : null;
  }, []);
  const [photos, firstPhoto] = React.useMemo(() => {
    const list = shuffle(ALL_PHOTOS);
    return [list, list[0]];
  }, []);
  const [idx, setIdx] = React.useState(0);
  const nextSlideId = React.useRef(1);
  const [now, setNow] = React.useState(() => performance.now());
  const mountedAt = React.useRef(performance.now());
  const [slides, setSlides] = React.useState(() =>
    photos.length
      ? [
          {
            id: 0,
            photo: photos[0],
            state: "active",
            startedAt: performance.now(),
            activeAt: performance.now(),
            exitedAt: null,
          },
        ]
      : [],
  );

  React.useEffect(() => {
    let frame = 0;
    const tick = () => {
      setNow(performance.now());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Compute the last time we should advance before forcing back to photo 0.
  const elapsed = now - mountedAt.current;
  const loopFadeStartMs =
    renderDurationMs != null ? renderDurationMs - fadeMs * 2.5 : Infinity;
  const inLoopFade = elapsed >= loopFadeStartMs;

  React.useEffect(() => {
    if (!photos.length || inLoopFade) return;
    const t = setInterval(
      () => setIdx((i) => (i + 1) % photos.length),
      slideInterval,
    );
    return () => clearInterval(t);
  }, [photos.length, slideInterval, inLoopFade]);

  // Force transition to the first photo so the render ends on it.
  React.useEffect(() => {
    if (!renderDurationMs || !photos.length) return;
    const t = setTimeout(() => setIdx(0), loopFadeStartMs);
    return () => clearTimeout(t);
  }, [renderDurationMs, photos.length, loopFadeStartMs]);

  React.useEffect(() => {
    if (!photos.length) return;
    setSlides((current) => {
      const nextPhoto = photos[idx];
      if (current.some((s) => s.state === "active" && s.photo === nextPhoto))
        return current;
      const t = performance.now();
      return [
        ...current.map((s) =>
          s.state === "active" ? { ...s, state: "exiting", exitedAt: t } : s,
        ),
        {
          id: nextSlideId.current++,
          photo: nextPhoto,
          state: "active",
          startedAt: t,
          activeAt: t,
          exitedAt: null,
        },
      ];
    });
  }, [idx, photos]);

  React.useEffect(() => {
    if (!slides.some((s) => s.state === "exiting")) return;
    const t = setTimeout(
      () => setSlides((c) => c.filter((s) => s.state !== "exiting")),
      fadeMs,
    );
    return () => clearTimeout(t);
  }, [slides, fadeMs]);

  return (
    <div style={{ position: "absolute", inset: 0, background: "#000" }}>
      <style>{`
        .eb-slide {
          position:absolute; inset:0;
          background-size:cover; background-position:center;
          filter: grayscale(1) contrast(1.1) brightness(0.42);
          will-change: transform, opacity;
        }
      `}</style>
      {slides.map((slide) => {
        const progress = Math.min(
          1,
          Math.max(0, (now - slide.startedAt) / zoomMs),
        );
        const scale = 1 + 0.18 * progress;
        const t =
          slide.state === "active"
            ? Math.min(1, (now - slide.activeAt) / fadeMs)
            : slide.exitedAt
              ? Math.min(1, (now - slide.exitedAt) / fadeMs)
              : 1;
        const opacity = slide.state === "active" ? smooth(t) : 1 - smooth(t);
        return (
          <div
            key={slide.id}
            className="eb-slide"
            style={{
              backgroundImage: `url(img/crowd-${slide.photo}.jpg)`,
              transform: `scale(${scale})`,
              opacity,
            }}
          />
        );
      })}
      {/* Dark tinted colour wash derived from the artist image */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: bgTint,
          pointerEvents: "none",
        }}
      />
      {/* Warm accent tint (secondary/sold-out colour) — color blend keeps darks dark */}
      {warmRgb && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `rgb(${warmRgb.r},${warmRgb.g},${warmRgb.b})`,
            opacity: 0.55,
            mixBlendMode: "color",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
});

// ---------- PER-CHARACTER SCRAMBLE ----------
const ScrambleCtx = React.createContext({ level: 0, now: 0 });
const SCHAR = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&?!/\\+=-";

function ScrambleText({ children, seed = 0 }) {
  const { level, now } = React.useContext(ScrambleCtx);
  const text = String(children);
  if (level < 0.01) return text;

  const tick = Math.floor(now / 110); // ~9 flickers per second
  return text.split("").map((ch, i) => {
    if (ch === " ") return " ";
    // Per-char threshold — different chars scramble at different points in the transition
    const charNoise =
      0.28 + Math.abs(Math.sin(i * 127.1 + seed * 311.7)) * 0.44;
    if (level <= charNoise) return ch; // already resolved
    const ci = Math.abs((tick * 53 + i * 17 + seed * 7) | 0) % SCHAR.length;
    return SCHAR[ci];
  });
}

// ---------- AUTO-HEIGHT PAGED LISTINGS PANEL ----------
function ListingsPanel({
  pages,
  pageIdx,
  textVisible = true,
  pulseOpacity = 1,
  accentColor = RED,
  accentGlow = RED_GLOW,
  accentShadow = "rgba(255,45,63,0.18)",
  soldTheme = null,
  lowTheme = null,
  monthRgb = null,
  warmRgb = null,
  coolRgb = null,
  panelHeightRef = null,
  borderProgress = 1,
}) {
  const sTheme = soldTheme || SOLD_FALLBACK;
  const lTheme = lowTheme || LOW_FALLBACK;
  const accentCss = accentColor;
  const measureRefs = React.useRef([]);
  const [heights, setHeights] = React.useState([]);
  const [now, setNow] = React.useState(() => performance.now());

  React.useEffect(() => {
    let f;
    const tick = () => {
      setNow(performance.now());
      f = requestAnimationFrame(tick);
    };
    f = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(f);
  }, []);

  // Measure HIDDEN duplicate pages (laid out naturally) to get true heights.
  React.useLayoutEffect(() => {
    const measure = () => {
      const hs = measureRefs.current.map((el) => (el ? el.scrollHeight : 0));
      setHeights(hs);
    };
    measure();
    const t = setTimeout(measure, 250); // remeasure after fonts settle
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, [pages.length]);

  const KEY_ROW_HEIGHT = 50;
  const measured = heights[pageIdx] || 0;
  const targetH = measured ? measured + KEY_ROW_HEIGHT : 480;

  // Text opacity — ref updated synchronously so the timestamp is captured on the
  // same virtual frame that textVisible changes (not one frame late via useEffect).
  const textRef = React.useRef({ visible: textVisible, at: -Infinity });
  if (textRef.current.visible !== textVisible) {
    textRef.current = { visible: textVisible, at: performance.now() };
  }
  const FADE_MS = dataScaleMs(750);
  const textT = smooth(Math.min(1, (now - textRef.current.at) / FADE_MS));
  const textOpacity = textVisible ? textT : 1 - textT;
  // scrambleLevel: 0 = real text, 1 = fully scrambled — mirrors the opacity fade
  const scrambleLevel = 1 - textOpacity;

  // Panel height animation — same synchronous-ref pattern.
  // `from` is the interpolated height at the moment the page changed.
  const heightRef = React.useRef({
    prevIdx: pageIdx,
    from: targetH,
    to: targetH,
    at: -Infinity,
  });
  if (heightRef.current.prevIdx !== pageIdx) {
    // Page just changed: start animating from wherever we currently are.
    const elapsed = now - heightRef.current.at;
    const progress = smooth(Math.min(1, elapsed / dataScaleMs(700)));
    const fromH =
      heightRef.current.from +
      (heightRef.current.to - heightRef.current.from) * progress;
    heightRef.current = {
      prevIdx: pageIdx,
      from: fromH,
      to: targetH,
      at: performance.now(),
    };
  } else {
    // Same page — just track the target in case measurement updated.
    heightRef.current.to = targetH;
  }
  const HEIGHT_MS = dataScaleMs(700);
  const hProgress = smooth(
    Math.min(1, (now - heightRef.current.at) / HEIGHT_MS),
  );
  const currentH =
    heightRef.current.from +
    (heightRef.current.to - heightRef.current.from) * hProgress;

  // Expose live panel border Y positions so ScreenCorners can track height changes
  if (panelHeightRef) {
    const clamped = Math.min(currentH, 660);
    panelHeightRef.current = {
      top: 258 + (682 - clamped) / 2,
      bottom: 940 - (682 - clamped) / 2,
    };
  }

  return (
    <>
      {/* Hidden measurement layer — renders each page in natural flow, off-screen. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 32,
          right: 32,
          top: 308,
          visibility: "hidden",
          pointerEvents: "none",
          zIndex: -1,
        }}
      >
        {pages.map((pg, i) => (
          <ListingsPage
            key={`m-${i}`}
            groups={pg}
            ref={(el) => (measureRefs.current[i] = el)}
            soldTheme={sTheme}
            lowTheme={lTheme}
            accentCss={accentCss}
            warmRgb={warmRgb}
            coolRgb={coolRgb}
          />
        ))}
      </div>

      {/* Centering frame: fills the zone between the heading and the logo footer.
         The panel sits in the middle and expands evenly up & down as content grows. */}
      <div
        style={{
          position: "absolute",
          top: 258,
          bottom: 140,
          left: 32,
          right: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: "100%",
            height: currentH,
            maxHeight: 660,
            position: "relative",
            pointerEvents: "auto",
          }}
        >
          {/* Animated corner brackets — arms grow from 0 to 50% of each dimension */}
          {["tl", "tr", "bl", "br"].map((key) => {
            const isTop = key[0] === "t";
            const isLeft = key[1] === "l";
            const bp = Math.max(0, Math.min(1, borderProgress));
            return (
              <div
                key={key}
                style={{
                  position: "absolute",
                  top: isTop ? 0 : undefined,
                  bottom: !isTop ? 0 : undefined,
                  left: isLeft ? 0 : undefined,
                  right: !isLeft ? 0 : undefined,
                  width: `${bp * 50}%`,
                  height: `${bp * 50}%`,
                  borderTop: isTop ? `1.5px solid ${accentColor}` : "none",
                  borderBottom: !isTop ? `1.5px solid ${accentColor}` : "none",
                  borderLeft: isLeft ? `1.5px solid ${accentColor}` : "none",
                  borderRight: !isLeft ? `1.5px solid ${accentColor}` : "none",
                  filter: `drop-shadow(0 0 5px ${accentGlow}) drop-shadow(0 0 14px ${accentShadow})`,
                  pointerEvents: "none",
                  zIndex: 10,
                }}
              />
            );
          })}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: "100%",
              marginBottom: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontFamily: "'Space Grotesk',sans-serif",
              fontSize: 21,
              letterSpacing: "0.2em",
              fontWeight: 700,
              color: "rgba(255,255,255,0.86)",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  background: accentColor,
                  borderRadius: "50%",
                  boxShadow: `0 0 12px ${accentGlow}`,
                  opacity: pulseOpacity,
                }}
              />
              ON SALE / 2026
            </span>
            <span style={{ opacity: 0.85 }}>ELECTRICBRISTOL.COM</span>
          </div>

          <div
            style={{
              height: "100%",
              overflow: "hidden",
              background: PANEL_BG,
              backdropFilter: "blur(2px)",
              boxShadow: `0 18px 54px rgba(0,0,0,0.34)`,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <style>{`
            .eb-page {
              position: absolute; inset: 0;
              opacity: 1;
              pointer-events: none;
            }
          `}</style>
            <ScrambleCtx.Provider value={{ level: scrambleLevel, now }}>
              <div
                style={{
                  position: "relative",
                  flex: 1,
                  overflow: "hidden",
                  opacity: textOpacity,
                }}
              >
                {pages.map((pg, i) => (
                  <div
                    key={i}
                    className="eb-page"
                    style={{ display: i === pageIdx ? "block" : "none" }}
                  >
                    <ListingsPage
                      groups={pg}
                      absolute={true}
                      soldTheme={sTheme}
                      lowTheme={lTheme}
                      accentCss={accentCss}
                      monthRgb={monthRgb}
                      warmRgb={warmRgb}
                      coolRgb={coolRgb}
                      pulseOpacity={pulseOpacity}
                    />
                  </div>
                ))}
              </div>
            </ScrambleCtx.Provider>

            <div
              style={{
                padding: "8px 24px 12px",
                borderTop: `1px solid ${PANEL_DIVIDER}`,
                background: PANEL_FOOTER_BG,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 28,
                fontFamily: "'Space Grotesk',sans-serif",
                fontSize: 23,
                letterSpacing: "0.22em",
                fontWeight: 700,
                opacity: 0.95,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  color: lTheme.css,
                  textShadow: `0 0 10px ${lTheme.glow1}, 0 0 24px ${lTheme.glow2}`,
                }}
              >
                <StatusMark kind="low" size={26} color={lTheme.css} /> LOW TIX
              </span>
              {pages.length > 1 ? (
                <span
                  style={{
                    display: "inline-flex",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  {pages.map((_, i) => (
                    <span
                      key={i}
                      style={{
                        width: i === pageIdx ? 18 : 8,
                        height: 6,
                        borderRadius: 3,
                        background:
                          i === pageIdx
                            ? accentColor
                            : "rgba(255,255,255,0.22)",
                        boxShadow:
                          i === pageIdx ? `0 0 8px ${accentGlow}` : "none",
                      }}
                    />
                  ))}
                </span>
              ) : (
                <span
                  style={{
                    display: "inline-flex",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 6,
                      borderRadius: 3,
                      background: accentColor,
                      boxShadow: `0 0 8px ${accentGlow}`,
                    }}
                  />
                </span>
              )}
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  color: sTheme.css,
                  textShadow: `0 0 10px ${sTheme.glow1}, 0 0 24px ${sTheme.glow2}`,
                }}
              >
                <StatusMark kind="sold" size={26} color={sTheme.css} /> SOLD OUT
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------- MAIN LAYOUT (Direction 2 composition, red + bolts + logo) ----------
function DataMosaic({ events }) {
  const pulseOpacity = usePulse(dataScaleMs(1600));
  const display = getDisplayEvents(events);
  const groups = groupByMonth(display);
  const pages = paginate(groups);
  const monthNames = groups.map((g) => g.monthName.slice(0, 3)).join(" · ");

  // Auto-advance pages every 12s with a fade-out → resize → fade-in choreography.
  const [pageIdx, setPageIdx] = React.useState(0);
  const [phase, setPhase] = React.useState("idle"); // 'idle' | 'out' | 'in'
  React.useEffect(() => {
    if (pages.length <= 1) return;
    const tick = setInterval(() => {
      // 1) fade out current text
      setPhase("out");
      // 2) after fade-out completes, swap page → panel resizes → fade in new text
      setTimeout(() => {
        setPageIdx((i) => (i + 1) % pages.length);
        // give the panel-height transition a moment, then fade text back in
        setTimeout(() => setPhase("in"), dataScaleMs(900));
        setTimeout(() => setPhase("idle"), dataScaleMs(1700));
      }, dataScaleMs(800));
    }, dataScaleMs(12000));
    return () => clearInterval(tick);
  }, [pages.length]);
  const textVisible = phase === "idle" || phase === "in";

  // Title for the current page = first → last month names
  const currentPage = pages[pageIdx] || pages[0] || [];
  const pageMonths = currentPage.length
    ? currentPage.length === 1
      ? currentPage[0].monthName
      : `${currentPage[0].monthName} — ${currentPage[currentPage.length - 1].monthName}`
    : monthNames;

  return (
    <div
      style={{
        width: W,
        height: H,
        background: "#000",
        color: "#fff",
        fontFamily: "'Space Grotesk',sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <BackgroundSlideshow color="" />
      {/* Atmospheric overlays — same shape as Direction 2 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 60%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.85) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.7) 100%)",
        }}
      />

      {/* Headline — compact so listings panel can grow */}
      <div
        style={{
          position: "relative",
          marginTop: 68,
          textAlign: "center",
          fontFamily: "'Anton',sans-serif",
          textTransform: "uppercase",
          lineHeight: 0.85,
        }}
      >
        <div
          style={{
            fontFamily: "'Space Grotesk',sans-serif",
            fontSize: 38,
            fontWeight: 400,
            fontStyle: "italic",
            color: RED_GLOW,
            marginBottom: 8,
            display: "inline-block",
            textShadow: `0 0 6px rgba(255,45,63,0.8), 0 0 14px rgba(255,45,63,0.42), 0 2px 8px rgba(0,0,0,0.9)`,
          }}
        >
          UPCOMING
        </div>
        <div
          style={{
            fontSize: 120,
            letterSpacing: "-0.025em",
            textShadow: `0 0 14px rgba(255,255,255,0.12), 0 0 42px rgba(255,45,63,0.22)`,
          }}
        >
          EVENTS
        </div>
      </div>

      {/* Listings panel — PAGED with auto-height that animates between pages. */}
      <ListingsPanel
        pages={pages}
        pageIdx={pageIdx}
        textVisible={textVisible}
        pulseOpacity={pulseOpacity}
      />

      {/* Logo footer (key now lives inside the panel) */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "0 44px 26px",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Logo width={360} />
      </div>
    </div>
  );
}

Object.assign(window, {
  DataMosaic,
  BackgroundSlideshow,
  getDisplayEvents,
  Bolt,
  HollowBolt,
  StatusBolt,
  StatusMark,
  ListingsPage,
  ListingsPanel,
  Logo,
  paginate,
  usePulse,
});
