// Sequenced display loop: Welcome → Upcoming Shows → What's On Tonight → loop.
// Background slideshow runs continuously underneath.

const LOOP_W = 1080;
const LOOP_H = 1080;
const LOOP_RED_GLOW = "#FF2D3F";
const FALLBACK_WARM = { r: 210, g: 165, b: 60 };  // gold fallback
const FALLBACK_COOL = { r: 100, g: 175, b: 230 }; // icy blue fallback
const INTRO_HOLD_MS = window.LOOP_INTRO_EXTRA_MS || 0;
const loopScaleMs = window.scaleMs || ((ms) => ms);
const loopScaleCssTime = window.scaleCssTime || ((value) => value);

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function easeInOut(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function easeOutCubic(value) {
  const t = clamp01(value);
  return 1 - Math.pow(1 - t, 3);
}

function tween(elapsed, start, duration) {
  return easeInOut((elapsed - start) / duration);
}

// ---------- TIMELINE ----------
// Stage durations (ms). Easy to tune.
const TIMELINE = [
  { name: "welcomeIn", ms: 1500 }, // bg + "WELCOME TO" + logo fade in
  { name: "welcomeHold", ms: 3500 }, // hold welcome+logo
  { name: "welcomeOut", ms: 1000 }, // welcome+logo fade out (background stays)
  { name: "upcomingIn", ms: 1000 }, // upcoming shows fade in
  { name: "upcomingHold", ms: 36000 }, // upcoming shows runs for 36s
  { name: "upcomingOut", ms: 1000 }, // upcoming shows fade out
  { name: "tonightIn", ms: 1500 }, // "WHAT'S ON TONIGHT" + panel + name fade in (staggered)
  { name: "tonightHold", ms: 25000 }, // hold for 25s
  { name: "tonightOut", ms: 1000 }, // tonight fades, then loop wraps straight back to welcomeIn
];

const FIRST_TIMELINE = TIMELINE.map((stage) =>
  stage.name === "welcomeHold"
    ? { ...stage, ms: stage.ms + INTRO_HOLD_MS }
    : stage,
);
const FIRST_LOOP_TOTAL_MS = FIRST_TIMELINE.reduce(
  (sum, stage) => sum + stage.ms,
  0,
);
const LOOP_TOTAL_MS = TIMELINE.reduce((sum, stage) => sum + stage.ms, 0);

function useLoopStage() {
  const startRef = React.useRef(performance.now());
  const [now, setNow] = React.useState(() => performance.now());

  React.useEffect(() => {
    let frame = 0;
    const tick = () => {
      setNow(performance.now());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const virtualElapsed = (now - startRef.current) * (window.LOOP_SPEED || 1);
  const firstCycle = virtualElapsed < FIRST_LOOP_TOTAL_MS;
  const tick = firstCycle
    ? 0
    : 1 + Math.floor((virtualElapsed - FIRST_LOOP_TOTAL_MS) / LOOP_TOTAL_MS);
  const loopElapsed = firstCycle
    ? virtualElapsed
    : (virtualElapsed - FIRST_LOOP_TOTAL_MS) % LOOP_TOTAL_MS;
  const activeTimeline = firstCycle ? FIRST_TIMELINE : TIMELINE;

  let elapsed = loopElapsed;
  let stageIdx = activeTimeline.length - 1;
  let stageElapsed = activeTimeline[stageIdx].ms;
  for (let i = 0; i < activeTimeline.length; i++) {
    if (elapsed < activeTimeline[i].ms) {
      stageIdx = i;
      stageElapsed = elapsed;
      break;
    }
    elapsed -= activeTimeline[i].ms;
  }

  return { stage: TIMELINE[stageIdx].name, stageIdx, tick, stageElapsed };
}

// ---------- "TONIGHT" picker ----------
// Returns the event for tonight, with a 5-hour offset (anything before 5am local
// counts as still "yesterday" for venue purposes). If no event tonight, picks the
// next future event.
function pickTonightEvent(events) {
  if (!events || !events.length) return null;
  const now = new Date();
  // shift now back by 5 hours so 0–5am still reads as "yesterday"
  const shifted = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const y = shifted.getFullYear();
  const m = shifted.getMonth() + 1;
  const d = shifted.getDate();
  const todayKey = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  // Try exact match first
  const today = events.find((e) => e.date === todayKey);
  if (today) return today;

  // Otherwise next future event
  const future = events
    .filter((e) => e.date >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date));
  return future[0] || events[events.length - 1];
}

function clampChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function rgbCss(rgb, alpha = 1) {
  const { r, g, b } = rgb;
  return alpha >= 1
    ? `rgb(${r}, ${g}, ${b})`
    : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function rgbToHsl(rgb) {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;

  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
      break;
  }

  return { h: h * 60, s, l };
}

function hueToRgb(p, q, t) {
  let value = t;
  if (value < 0) value += 1;
  if (value > 1) value -= 1;
  if (value < 1 / 6) return p + (q - p) * 6 * value;
  if (value < 1 / 2) return q;
  if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
  return p;
}

function hslToRgb(hsl) {
  const h = hsl.h / 360;
  const { s, l } = hsl;
  if (s === 0) {
    const gray = clampChannel(l * 255);
    return { r: gray, g: gray, b: gray };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: clampChannel(hueToRgb(p, q, h + 1 / 3) * 255),
    g: clampChannel(hueToRgb(p, q, h) * 255),
    b: clampChannel(hueToRgb(p, q, h - 1 / 3) * 255),
  };
}

function normalizeAccentColor(rgb, minL, maxL) {
  const { h, s, l } = rgbToHsl(rgb);
  return hslToRgb({ h, s: Math.max(0.45, Math.min(0.9, s * 1.25)), l: Math.max(minL, Math.min(maxL, l * 1.08)) });
}

function extractAccentsFromImage(img) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || !img.naturalWidth || !img.naturalHeight) return { warm: null, cool: null, dark: null };

  const size = 64;
  canvas.width = size;
  canvas.height = size;
  ctx.drawImage(img, 0, 0, size, size);

  let data;
  try {
    data = ctx.getImageData(0, 0, size, size).data;
  } catch {
    return { warm: null, cool: null, dark: null };
  }

  // Two separate bucket sets: one for bright/accent colors, one for dark ambient
  const accentBuckets = new Map();
  const darkBuckets = new Map();

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    const lit = (max + min) / 2 / 255;
    if (sat < 0.18) continue; // ignore greys and near-neutral colours

    const key = `${Math.round(r / 16)},${Math.round(g / 16)},${Math.round(b / 16)}`;

    if (lit >= 0.12 && lit <= 0.94) {
      const w = sat * sat * (0.3 + lit); // square sat so low-sat colours don't accumulate
      const bk = accentBuckets.get(key) || { score: 0, r: 0, g: 0, b: 0 };
      bk.score += w; bk.r += r * w; bk.g += g * w; bk.b += b * w;
      accentBuckets.set(key, bk);
    }
    if (lit < 0.42 && sat >= 0.08) {
      const w = (0.1 + sat) * (0.6 - lit); // weight by darkness
      const bk = darkBuckets.get(key) || { score: 0, r: 0, g: 0, b: 0 };
      bk.score += w; bk.r += r * w; bk.g += g * w; bk.b += b * w;
      darkBuckets.set(key, bk);
    }
  }

  const toCandidates = (map) => [...map.values()].map((bk) => {
    const avg = { r: bk.r / bk.score, g: bk.g / bk.score, b: bk.b / bk.score };
    return { avg, score: bk.score, ...rgbToHsl(avg) };
  }).sort((a, b) => b.score - a.score);

  const accentCandidates = toCandidates(accentBuckets);
  const darkCandidates   = toCandidates(darkBuckets);

  // Pick two most dominant accent colors with hue separation >= 40°
  // Require meaningful saturation so washed-out colours don't become accents
  const viableAccents = accentCandidates.filter(c => c.s >= 0.30);
  let primary = null, secondary = null;
  for (const c of viableAccents) {
    if (!primary) { primary = c; continue; }
    const hueDiff = Math.abs(c.h - primary.h);
    const sep = Math.min(hueDiff, 360 - hueDiff);
    if (sep >= 40) { secondary = c; break; }
  }
  if (!primary && accentCandidates.length) primary = accentCandidates[0]; // fallback if nothing passes sat gate
  if (!primary) return { warm: null, cool: null, dark: null };
  if (!secondary) secondary = primary; // single dominant hue

  // Assign warm/cool by hue: warm = red/orange/yellow (avoid green), cool = blue/cyan/purple
  const isWarm = (h) => (h <= 75 || h >= 310);
  const pWarm = isWarm(primary.h);
  const warmSrc = pWarm ? primary.avg : secondary.avg;
  const coolSrc = pWarm ? secondary.avg : primary.avg;

  // Dark ambient color for background
  const darkSrc = darkCandidates[0] ? darkCandidates[0].avg : null;

  return {
    warm: normalizeAccentColor(warmSrc, 0.58, 0.76),
    cool: normalizeAccentColor(coolSrc, 0.62, 0.82),
    dark: darkSrc,
  };
}

function getEventImageUrl(event) {
  if (!event) return null;
  if (event.image) return event.image;
  if (!event.name) return null;
  const slug = event.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `event images/${slug}.jpg`;
}

function useEventAccents(imageUrl) {
  const [accents, setAccents] = React.useState({ warm: FALLBACK_WARM, cool: FALLBACK_COOL, dark: null });

  React.useEffect(() => {
    let cancelled = false;
    setAccents({ warm: FALLBACK_WARM, cool: FALLBACK_COOL, dark: null });
    if (!imageUrl) return () => { cancelled = true; };

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      const next = extractAccentsFromImage(img);
      setAccents({ warm: next.warm || FALLBACK_WARM, cool: next.cool || FALLBACK_COOL, dark: next.dark });
    };
    img.onerror = () => { if (!cancelled) setAccents({ warm: FALLBACK_WARM, cool: FALLBACK_COOL, dark: null }); };
    img.src = imageUrl;
    return () => { cancelled = true; };
  }, [imageUrl]);

  return accents;
}

// ---------- WELCOME PANEL ----------
function WelcomePanel({ opacity, warmRgb, coolRgb }) {
  const accentColor = rgbCss(warmRgb, 0.9);
  const accentGlowStrong = rgbCss(warmRgb, 0.78);
  const accentGlowSoft = rgbCss(warmRgb, 0.34);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity,
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "0 44px 28px",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div style={{ position: "relative", width: 540, height: 150 }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
            }}
          >
            <Logo width={460} accentColor={rgbCss(warmRgb)} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- TONIGHT PANEL ----------
// Artist image at 90% of screen, panel eases in with a soft settle.
// Top: BIG GLOWING "TONIGHT" heading with large black drop shadow.
// Bottom: Event name, promoter x bolt presents, date | doors.
// Driven by `current-event.json` ({ name, date, door_time, image }).
// Falls back to auto-pick from ticket data if no override is provided.
function TonightPanel({ event, visuals, warmRgb, coolRgb }) {
  if (!event) return null;

  // Date label — supports both ISO ("2026-05-16") and pre-formatted day/month.
  let dayLabel, monthShort;
  if (event.date && /^\d{4}-\d{2}-\d{2}$/.test(event.date)) {
    const [y, m, d] = event.date.split("-").map(Number);
    const day = d;
    dayLabel = window.formatDay
      ? window.formatDay(day)
      : String(day).padStart(2, "0");
    const monthNames = [
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN",
      "JUL",
      "AUG",
      "SEP",
      "OCT",
      "NOV",
      "DEC",
    ];
    monthShort = monthNames[m - 1] || "";
  } else {
    dayLabel = window.formatDay ? window.formatDay(event.day) : event.day;
    monthShort = (event.monthName || "").slice(0, 3);
  }

  const imgUrl = getEventImageUrl(event);

  const cleanName = window.cleanName
    ? window.cleanName(event.name)
    : event.name;
  const doorTime = event.door_time || event.doorTime || "DOORS · 7PM";
  const PANEL_SIZE = 972; // 90% of 1080

  const accentColor = rgbCss(warmRgb);
  const accentGlowStrong = rgbCss(warmRgb, 0.9);
  const accentGlowSoft = rgbCss(warmRgb, 0.5);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 5,
      }}
    >
      {/* Main panel: soft scale + lift instead of a hard bounce */}
      <div
        style={{
          width: PANEL_SIZE,
          height: PANEL_SIZE,
          position: "relative",
          opacity: visuals.panelOpacity,
          transform: `translateY(${visuals.panelTranslateY}px) scale(${visuals.panelScale})`,
          transformOrigin: "50% 50%",
          overflow: "hidden",
        }}
      >
        {/* Full-bleed artist image */}
        {imgUrl && (
          <img
            src={imgUrl}
            alt={event.name}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `translateY(${visuals.imageTranslateY}px) scale(${visuals.imageScale})`,
              transformOrigin: "50% 50%",
            }}
          />
        )}
        {/* Top gradient for legibility */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.95) 100%)",
            pointerEvents: "none",
          }}
        />

        {/* Bottom: Event info */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "28px 40px 36px",
            textAlign: "center",
            opacity: visuals.nameOpacity,
            transform: `translateY(${visuals.nameTranslateY}px)`,
          }}
        >
          {/* Promoter x BOLT Presents — accent pulled from artwork */}
          {event.promoter && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <span
                style={{
                  fontFamily: "'Space Grotesk',sans-serif",
                  textTransform: "uppercase",
                  fontSize: 28,
                  letterSpacing: "0.2em",
                  color: accentColor,
                  textShadow: `0 0 30px ${accentGlowStrong}, 0 0 58px ${accentGlowSoft}, 4px 4px 0 rgba(0,0,0,0.85)`,
                  fontWeight: 700,
                }}
              >
                {event.promoter}
              </span>
              <span
                style={{
                  fontSize: 26,
                  color: "#fff",
                  opacity: 0.8,
                  textShadow: `3px 3px 0 rgba(0,0,0,0.85)`,
                }}
              >
                x
              </span>
              {window.HollowBolt ? (
                <window.HollowBolt color={accentColor} size={38} shadow={true} />
              ) : (
                <StatusMark kind="fast" size={38} />
              )}
              <span
                style={{
                  fontFamily: "'Space Grotesk',sans-serif",
                  textTransform: "uppercase",
                  fontSize: 26,
                  letterSpacing: "0.25em",
                  color: accentColor,
                  textShadow: `0 0 28px ${rgbCss(warmRgb, 0.86)}, 0 0 52px ${rgbCss(warmRgb, 0.46)}, 4px 4px 0 rgba(0,0,0,0.85)`,
                  fontWeight: 700,
                }}
              >
                Presents
              </span>
            </div>
          )}

          {/* Event Name — BIG WHITE */}
          <div
            style={{
              fontFamily: "'Anton',sans-serif",
              textTransform: "uppercase",
              fontSize: 120,
              lineHeight: 0.9,
              letterSpacing: "-0.01em",
               color: "#fff",
               textShadow: `0 0 18px rgba(255,255,255,0.18), 0 2px 18px rgba(0,0,0,0.82)`,
               marginBottom: 14,
             }}
           >
            {cleanName}
          </div>

          {/* Date | Doors — Small WHITE */}
          <div
            style={{
              fontFamily: "'JetBrains Mono',monospace",
               fontSize: 21,
               letterSpacing: "0.16em",
               color: "#fff",
               textShadow: `0 0 12px rgba(255,255,255,0.12), 0 2px 10px rgba(0,0,0,0.74)`,
               fontWeight: 700,
               opacity: 0.9,
             }}
          >
            <span>{dayLabel} {monthShort}</span>
            <span style={{ color: accentColor }}> | </span>
            <span>{doorTime}</span>
          </div>
        </div>

        {/* Corner ticks */}
        {["tl", "tr", "bl", "br"].map((p) => {
          const s = 22;
          const pos = {
            tl: { top: 12, left: 12 },
            tr: { top: 12, right: 12 },
            bl: { bottom: 12, left: 12 },
            br: { bottom: 12, right: 12 },
          }[p];
          return (
            <div
              key={p}
              style={{
                position: "absolute",
                ...pos,
                width: s,
                height: s,
                borderTop: p[0] === "t" ? `2px solid ${accentColor}` : "none",
                borderBottom: p[0] === "b" ? `2px solid ${accentColor}` : "none",
                borderLeft: p[1] === "l" ? `2px solid ${accentColor}` : "none",
                borderRight: p[1] === "r" ? `2px solid ${accentColor}` : "none",
                filter: `drop-shadow(0 0 6px ${accentGlowStrong}) drop-shadow(0 0 14px ${accentGlowSoft})`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ---------- MAIN LOOP COMPONENT ----------
function LoopDisplay({ events, currentEvent }) {
  const { stage, tick, stageElapsed } = useLoopStage();
  const panelHeightRef = React.useRef({ top: 269, bottom: 929 });

  const display = window.getDisplayEvents
    ? window.getDisplayEvents(events)
    : events;
  // Prefer manually-curated currentEvent JSON; fall back to auto-pick.
  const tonight = React.useMemo(
    () => currentEvent || pickTonightEvent(events),
    [events, currentEvent],
  );
  const tonightImageUrl = React.useMemo(() => getEventImageUrl(tonight), [tonight]);
  const { warm: warmRgb, cool: coolRgb, dark: darkRgb } = useEventAccents(tonightImageUrl);

  const welcomeOpacity =
    stage === "welcomeIn"
      ? tween(stageElapsed, 0, 1000)
      : stage === "welcomeHold"
        ? 1
        : stage === "welcomeOut"
          ? 1 - tween(stageElapsed, 0, 1000)
          : 0;

  const upcomingOpacity =
    stage === "upcomingIn"
      ? tween(stageElapsed, 0, 1000)
      : stage === "upcomingHold"
        ? 1
        : stage === "upcomingOut"
          ? 1 - tween(stageElapsed, 0, 1000)
          : 0;

  const upcomingBorderProgress = (() => {
    if (stage === "upcomingIn")
      return easeOutCubic(Math.min(1, stageElapsed / 900));
    if (stage === "upcomingHold") return 1;
    if (stage === "upcomingOut")
      return 1 - easeOutCubic(Math.min(1, stageElapsed / 900));
    return 0;
  })();

  const tonightOpacity =
    stage === "tonightIn"
      ? tween(stageElapsed, 0, 1200)
      : stage === "tonightHold"
        ? 1
        : stage === "tonightOut"
          ? 1 - tween(stageElapsed, 0, 1000)
          : 0;

  const tonightHeadingOpacity =
    stage === "tonightIn"
      ? tween(stageElapsed, 0, 700)
      : stage === "tonightHold" || stage === "tonightOut"
        ? 1
        : 0;

  const tonightPanelOpacity =
    stage === "tonightIn"
      ? tween(stageElapsed, 450, 900)
      : stage === "tonightHold" || stage === "tonightOut"
        ? 1
        : 0;

  const tonightPanelMotion =
    stage === "tonightIn"
      ? easeOutCubic(tonightPanelOpacity)
      : stage === "tonightHold" || stage === "tonightOut"
        ? 1
        : 0;

  const tonightNameOpacity =
    stage === "tonightIn"
      ? tween(stageElapsed, 900, 700)
      : stage === "tonightHold" || stage === "tonightOut"
        ? 1
        : 0;

  const tonightVisuals = {
    headingOpacity: tonightHeadingOpacity,
    headingTranslateY: -12 * (1 - tonightHeadingOpacity),
    panelOpacity: tonightPanelOpacity,
    panelScale: 0.84 + 0.16 * tonightPanelMotion,
    panelTranslateY: 28 * (1 - tonightPanelMotion),
    imageScale: 1.1 - 0.1 * tonightPanelMotion,
    imageTranslateY: -18 * (1 - tonightPanelMotion),
    nameOpacity: tonightNameOpacity,
    nameTranslateY: -8 * (1 - tonightNameOpacity),
  };

  return (
    <div
      style={{
        width: LOOP_W,
        height: LOOP_H,
        background: "#000",
        color: "#fff",
        fontFamily: "'Space Grotesk',sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background slideshow layer — runs continuously, fades as a whole */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 1,
        }}
      >
        <BackgroundSlideshow coolRgb={coolRgb} darkRgb={darkRgb} warmRgb={warmRgb} />
        {/* Same atmospheric overlays as DataMosaic */}
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
      </div>

      {/* Welcome layer */}
      <WelcomePanel opacity={welcomeOpacity} warmRgb={warmRgb} coolRgb={coolRgb} />

      {/* Upcoming-shows layer — wraps the existing DataMosaic content (minus its
          own background) inside a fade. We render the FULL DataMosaic and let
          its own background be hidden by the parent fade timing. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: upcomingOpacity,
          pointerEvents: "none",
        }}
      >
        {/* Render only the chrome of DataMosaic — header, headline, panel, logo —
            without re-rendering the slideshow underneath. We do this by overlaying
            on top of the shared bg layer. */}
        <UpcomingChrome
          events={events}
          active={upcomingOpacity > 0.001}
          tick={tick}
          warmRgb={warmRgb}
          coolRgb={coolRgb}
          panelHeightRef={panelHeightRef}
          borderProgress={upcomingBorderProgress}
        />
      </div>

      {/* Tonight layer */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: tonightOpacity,
          pointerEvents: "none",
        }}
      >
        <TonightPanel event={tonight} visuals={tonightVisuals} warmRgb={warmRgb} coolRgb={coolRgb} />
      </div>

      {/* Animated screen-to-panel corner brackets */}
      <ScreenCorners stage={stage} stageElapsed={stageElapsed} warmRgb={warmRgb} panelHeightRef={panelHeightRef} />
    </div>
  );
}

// ---------- UPCOMING CHROME ----------
// Same as DataMosaic but WITHOUT the background slideshow + atmospheric overlays
// (those live on the shared bg layer above). This keeps the slideshow continuous
// across stage transitions instead of restarting on each loop.
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

function UpcomingChrome({ events, active, tick, warmRgb, coolRgb, panelHeightRef, borderProgress = 1 }) {
  const pulseOpacity = usePulse(loopScaleMs(1600));
  const display = window.getDisplayEvents
    ? window.getDisplayEvents(events)
    : events;
  const groups = window.groupByMonth(display);
  const pages = window.paginate(groups);
  const monthNames = groups
    .map((g) => g.monthName.slice(0, 3))
    .join(" \u00b7 ");

  const [pageIdx, setPageIdx] = React.useState(0);
  const [phase, setPhase] = React.useState("idle");

  // Mirror DataMosaic's auto-advance EXACTLY — no gating on `active`. Tracks all
  // timeouts so we can cancel them cleanly when remounting (e.g. on loop wrap).
  React.useEffect(() => {
    if (pages.length <= 1) return;
    const timeouts = [];
    const tk = (fn, ms) => {
      const id = setTimeout(fn, loopScaleMs(ms));
      timeouts.push(id);
      return id;
    };

    const interval = setInterval(() => {
      setPhase("out");
      tk(() => {
        setPageIdx((i) => (i + 1) % pages.length);
        tk(() => setPhase("in"), 750);
        tk(() => setPhase("idle"), 1300);
      }, 550);
    }, loopScaleMs(12000));

    return () => {
      clearInterval(interval);
      timeouts.forEach(clearTimeout);
    };
  }, [pages.length, tick]);

  // On loop wrap, jump back to first page so the run starts fresh.
  React.useEffect(() => {
    setPageIdx(0);
    setPhase("idle");
  }, [tick]);

  const textVisible = phase === "idle" || phase === "in";
  const currentPage = pages[pageIdx] || pages[0] || [];
  const pageMonths = currentPage.length
    ? currentPage.length === 1
      ? currentPage[0].monthName
      : `${currentPage[0].monthName} \u2014 ${currentPage[currentPage.length - 1].monthName}`
    : monthNames;
  const warmColor = rgbCss(warmRgb);
  const warmGlowStrong = rgbCss(warmRgb, 0.84);
  const warmGlowSoft = rgbCss(warmRgb, 0.22);
  const accentColor = warmColor;
  const accentGlowStrong = warmGlowStrong;
  const accentGlowSoft = warmGlowSoft;
  const soldTheme = { css: rgbCss(warmRgb), glow1: rgbCss(warmRgb, 0.9), glow2: rgbCss(warmRgb, 0.52) };
  const lowTheme  = { css: rgbCss(coolRgb), glow1: rgbCss(coolRgb, 0.9), glow2: rgbCss(coolRgb, 0.52) };

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* Headline */}
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
            color: warmColor,
            marginBottom: 8,
            display: "inline-block",
            textShadow: `0 0 6px ${warmGlowStrong}, 0 0 14px ${warmGlowSoft}, 0 2px 8px rgba(0,0,0,0.9)`,
          }}
        >
          UPCOMING
        </div>
        <div
          style={{
            fontSize: 120,
            letterSpacing: "-0.025em",
            textShadow: `0 0 14px rgba(255,255,255,0.12), 0 0 42px ${accentGlowSoft}`,
          }}
        >
          EVENTS
        </div>
      </div>

      {/* Listings panel */}
      <ListingsPanel
        pages={pages}
        pageIdx={pageIdx}
        textVisible={textVisible}
        pulseOpacity={pulseOpacity}
        accentColor={accentColor}
        accentGlow={accentGlowStrong}
        accentShadow={accentGlowSoft}
        soldTheme={soldTheme}
        lowTheme={lowTheme}
        monthRgb={warmRgb}
        panelHeightRef={panelHeightRef}
        borderProgress={borderProgress}
      />

      {/* Logo footer */}
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
        <Logo width={360} accentColor={warmColor} />
      </div>
    </div>
  );
}

// ---------- SCREEN CORNERS ----------
// Glowing L-brackets present throughout the whole loop.
// Welcome/tonight: sitting at screen corners, breathing glow.
// welcomeOut: travel inward to dock on the events listing panel.
// Events: locked to live panel height, tracking page-resize transitions.
// upcomingOut: travel back to screen corners, fading as they arrive.
function ScreenCorners({ stage, stageElapsed, warmRgb, panelHeightRef }) {
  const accentColor = rgbCss(warmRgb);
  const accentGlowStrong = rgbCss(warmRgb, 0.5);
  const accentGlowSoft = rgbCss(warmRgb, 0.2);

  // Panel bounds — ListingsPanel writes these every render so we track live height changes
  const pb = panelHeightRef ? panelHeightRef.current : null;
  const panelTop    = pb ? pb.top    : 269;
  const panelBottom = pb ? pb.bottom : 929;

  const SCREEN_M = 50;
  const SC = {
    tl: [SCREEN_M,        SCREEN_M],
    tr: [SCREEN_M,        1080 - SCREEN_M],
    bl: [1080 - SCREEN_M, SCREEN_M],
    br: [1080 - SCREEN_M, 1080 - SCREEN_M],
  };
  const PC = {
    tl: [panelTop,    32],
    tr: [panelTop,    1048],
    bl: [panelBottom, 32],
    br: [panelBottom, 1048],
  };

  // t = 0 means screen corners, t = 1 means panel corners
  let opacity = 0;
  let t = 0;

  // Slow breathing sine for glow while corners hold at screen position
  const breathe = 0.72 + 0.28 * Math.sin(stageElapsed * 0.0016);

  if (stage === "welcomeIn" || stage === "welcomeHold" || stage === "welcomeOut"
      || stage === "upcomingIn" || stage === "upcomingHold" || stage === "upcomingOut") {
    return null;
  } else if (stage === "tonightIn") {
    opacity = 1 - easeInOut(Math.min(1, stageElapsed / 1200)) * 0.72;
    t = 0;
  } else if (stage === "tonightHold") {
    opacity = 0.28;
    t = 0;
  } else if (stage === "tonightOut") {
    opacity = 0.28 * (1 - easeInOut(Math.min(1, stageElapsed / 1000)));
    t = 0;
  }

  if (opacity < 0.005) return null;

  // Arm length and glow interpolate between screen (wide, bright) and panel (compact, steady)
  const armLen = 58 - 26 * t;
  const bw = 2.5 - 0.5 * t;
  const glowFactor = (stage === "welcomeIn" || stage === "welcomeOut" || stage === "welcomeHold") ? breathe * 0.5 : t < 0.5 ? breathe : 1;
  const gs1 = (stage === "welcomeIn" || stage === "welcomeOut" || stage === "welcomeHold") ? (10 + 10 * (1 - t)) * breathe * 0.5 : (10 + 10 * (1 - t)) * glowFactor;
  const gs2 = (stage === "welcomeIn" || stage === "welcomeOut" || stage === "welcomeHold") ? (28 + 24 * (1 - t)) * breathe * 0.3 : (28 + 24 * (1 - t)) * glowFactor;

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 15, pointerEvents: "none", opacity }}>
      {["tl", "tr", "bl", "br"].map((key) => {
        const sc = SC[key], pc = PC[key];
        const y = sc[0] + (pc[0] - sc[0]) * t;
        const x = sc[1] + (pc[1] - sc[1]) * t;
        const isTop  = key[0] === "t";
        const isLeft = key[1] === "l";
        return (
          <div
            key={key}
            style={{
              position: "absolute",
              width:  armLen,
              height: armLen,
              top:  isTop  ? y : y - armLen,
              left: isLeft ? x : x - armLen,
              borderTop:    isTop    ? `${bw}px solid ${accentColor}` : "none",
              borderBottom: !isTop   ? `${bw}px solid ${accentColor}` : "none",
              borderLeft:   isLeft   ? `${bw}px solid ${accentColor}` : "none",
              borderRight:  !isLeft  ? `${bw}px solid ${accentColor}` : "none",
              filter: `drop-shadow(0 0 ${gs1}px ${accentGlowStrong}) drop-shadow(0 0 ${gs2}px ${accentGlowSoft})`,
            }}
          />
        );
      })}
    </div>
  );
}

Object.assign(window, { LoopDisplay, pickTonightEvent });
