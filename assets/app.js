/* =====================================================================
   HH Goa 2026 · Frame & Builder ID Generator
   Open Trials, Task 01 · #FrameInGoa

   Everything is drawn client-side on a canvas: no upload, no backend,
   no API key, no account. Card artwork follows the official Hacker
   House Goa 2026 identity — deep green ground, lemon-yellow Imbue
   display serif, pink गोवा badge, cream paper, editorial folio rails.
   ===================================================================== */
'use strict';

const SITE_URL = 'https://hhgoa.trencoders.com';

/* Task 01 closes 11:59 pm IST, 13 August 2026 (per the notice board brief). */
const DEADLINE = new Date('2026-08-13T23:59:00+05:30');

/* --- brand palette, sampled from hhgoa.com ------------------------- */
const C = {
  green:     '#0B6839',
  greenDeep: '#073F22',
  greenDark: '#052D18',
  yellow:    '#FEE101',
  yellowDim: '#EDD723',
  cream:     '#FFFBE8',
  pink:      '#EC0F7C',
  ink:       '#06301A',
  hair:      'rgba(6,48,26,.18)',
  hairSoft:  'rgba(6,48,26,.10)',
  inkSoft:   'rgba(6,48,26,.55)'
};

const F = {
  display: "'Imbue', 'Playfair Display', Georgia, serif",
  mono:    "'Victor Mono', ui-monospace, Menlo, monospace",
  deva:    "'Shrikhand', Georgia, serif"
};

/*
 * Callsigns are built from Goan geography and old harbour trades — the
 * Mandovi river, laterite stone, the Arabian Sea, the Panjim ferry. The
 * card is framed as a port landing card rather than a generic badge, so
 * the vocabulary comes from that world and shares nothing with the
 * adjective-plus-noun generators every other entry is using.
 */
const SIGN_A = ['LATERITE', 'SALT AIR', 'FIRST LIGHT', 'BLUE HOUR', 'NIGHT FERRY',
                'RED SAND', 'DRY SEASON', 'HIGH NOON', 'LAST ORDERS', 'SOUTH SWELL',
                'HARBOUR', 'CASHEW', 'MANDOVI', 'ARABIAN', 'LOW WATER', 'BAKERY'];
const SIGN_B = ['CARTOGRAPHER', 'HARBOURMASTER', 'LIGHTKEEPER', 'BOATWRIGHT',
                'SIGNALMAN', 'QUARTERMASTER', 'BEACHCOMBER', 'TIDEWATCHER',
                'FERRYMAN', 'STARGAZER', 'TYPESETTER', 'ROPEMAKER', 'SHIPWRIGHT'];

/* The working loop every builder runs on. */
const LOOP = ['Plan', 'Build', 'Deploy'];

const pick = a => a[Math.floor(Math.random() * a.length)];

const genCallsign = () => pick(SIGN_A) + ' ' + pick(SIGN_B);

/* GA is Goa's actual state code, so the pass number reads like a real one. */
const genPass = () => 'GA-26-' + (1000 + Math.floor(Math.random() * 9000));

const SIZES = {
  id:   { w: 1080, h: 1350, label: 'Builder ID card' },
  pfp:  { w: 1080, h: 1080, label: 'PFP frame' },
  team: { w: 1600, h: 900,  label: 'Squad card' }
};

const state = {
  mode: 'id',
  photo: { img: null, scale: 1, ox: 0, oy: 0 },
  team: [
    { img: null, name: '', scale: 1, ox: 0, oy: 0 },
    { img: null, name: '', scale: 1, ox: 0, oy: 0 },
    { img: null, name: '', scale: 1, ox: 0, oy: 0 }
  ],
  teamCount: 2,
  name: '', role: '', shipping: '', teamName: '',
  callsign: genCallsign(),
  passId: genPass()
};

const $ = id => document.getElementById(id);
const cv = $('cv');
const ctx = cv.getContext('2d');

/* photo radius per mode — also used by the drag handler */
let photoRadius = 162;

/* ====================================================================
   drawing primitives
   ==================================================================== */

function rr(c, x, y, w, h, r) {
  const k = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + k, y);
  c.arcTo(x + w, y, x + w, y + h, k);
  c.arcTo(x + w, y + h, x, y + h, k);
  c.arcTo(x, y + h, x, y, k);
  c.arcTo(x, y, x + w, y, k);
  c.closePath();
}

/** Shrink the font until `text` fits `maxW`. Returns the px size used. */
function fitFont(c, text, startPx, maxW, family, weight) {
  let px = startPx;
  const w = weight ? weight + ' ' : '';
  c.font = w + px + 'px ' + family;
  while (px > 8 && c.measureText(text).width > maxW) {
    px -= 1;
    c.font = w + px + 'px ' + family;
  }
  return px;
}

/**
 * Letterspaced text, drawn glyph by glyph so tracking is identical in
 * every browser (ctx.letterSpacing is still not universally supported).
 */
function lsText(c, text, x, y, tracking, align) {
  const chars = [...text];
  const widths = chars.map(ch => c.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * Math.max(0, chars.length - 1);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const baseline = c.textBaseline;
  const prevAlign = c.textAlign;
  c.textAlign = 'left';
  c.textBaseline = baseline;
  for (let i = 0; i < chars.length; i++) {
    c.fillText(chars[i], cx, y);
    cx += widths[i] + tracking;
  }
  c.textAlign = prevAlign;
  return total;
}

function hairline(c, x1, y, x2, color, width) {
  c.save();
  c.strokeStyle = color || C.hair;
  c.lineWidth = width || 1.6;
  c.beginPath();
  c.moveTo(x1, y);
  c.lineTo(x2, y);
  c.stroke();
  c.restore();
}

function vline(c, x, y1, y2, color, width) {
  c.save();
  c.strokeStyle = color || C.hair;
  c.lineWidth = width || 1.6;
  c.beginPath();
  c.moveTo(x, y1);
  c.lineTo(x, y2);
  c.stroke();
  c.restore();
}

function arcText(c, text, cx, cy, r, centerAngle, flip, tracking) {
  const chars = [...text];
  const widths = chars.map(ch => c.measureText(ch).width + (tracking || 0));
  const total = widths.reduce((a, b) => a + b, 0);
  const dir = flip ? -1 : 1;
  let ang = centerAngle - dir * (total / (2 * r));
  c.save();
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  for (let i = 0; i < chars.length; i++) {
    const half = widths[i] / (2 * r);
    const a = ang + dir * half;
    c.save();
    c.translate(cx + r * Math.cos(a), cy + r * Math.sin(a));
    c.rotate(a + (flip ? -Math.PI / 2 : Math.PI / 2));
    c.fillText(chars[i], 0, 0);
    c.restore();
    ang += dir * widths[i] / r;
  }
  c.restore();
}

function star(c, x, y, r, color) {
  c.save();
  c.fillStyle = color;
  c.translate(x, y);
  c.beginPath();
  c.moveTo(0, -r);
  c.quadraticCurveTo(0, 0, r, 0);
  c.quadraticCurveTo(0, 0, 0, r);
  c.quadraticCurveTo(0, 0, -r, 0);
  c.quadraticCurveTo(0, 0, 0, -r);
  c.closePath();
  c.fill();
  c.restore();
}

function diamond(c, x, y, s, color) {
  c.save();
  c.fillStyle = color;
  c.translate(x, y);
  c.rotate(Math.PI / 4);
  c.fillRect(-s / 2, -s / 2, s, s);
  c.restore();
}

/** Deterministic barcode: the same builder number always draws the same bars. */
function barcode(c, x, y, w, h, seed, color) {
  c.save();
  c.fillStyle = color;
  let s = seed || 12345;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  let px = x;
  while (px < x + w) {
    const bw = 2 + Math.floor(rnd() * 3) * 2;
    if (rnd() > 0.32) c.fillRect(px, y, Math.min(bw, x + w - px), h);
    px += bw + 3;
  }
  c.restore();
}

/* ====================================================================
   QR — encoded with the vendored MIT encoder, drawn as our own modules
   ==================================================================== */
let qrMatrix = null;

function buildQR() {
  if (typeof qrcode === 'undefined') return;
  try {
    const q = qrcode(0, 'H');           /* level H: survives the centre badge */
    q.addData(SITE_URL);
    q.make();
    const n = q.getModuleCount();
    const m = [];
    for (let r = 0; r < n; r++) {
      const row = [];
      for (let col = 0; col < n; col++) row.push(q.isDark(r, col));
      m.push(row);
    }
    qrMatrix = m;
  } catch (e) {
    qrMatrix = null;
  }
}

function drawQR(c, x, y, size) {
  c.save();
  /* quiet zone on a light plate — required for reliable scanning */
  c.fillStyle = '#fff';
  rr(c, x - 7, y - 7, size + 14, size + 14, 8);
  c.fill();
  c.strokeStyle = C.hair;
  c.lineWidth = 1.5;
  rr(c, x - 7, y - 7, size + 14, size + 14, 8);
  c.stroke();

  if (qrMatrix) {
    const n = qrMatrix.length;
    const cell = size / n;
    c.fillStyle = C.ink;
    for (let r = 0; r < n; r++) {
      for (let col = 0; col < n; col++) {
        if (qrMatrix[r][col]) {
          /* +0.6 overlap keeps modules from hairline-gapping when scaled */
          c.fillRect(x + col * cell, y + r * cell, cell + 0.6, cell + 0.6);
        }
      }
    }
    /* palm badge in the dead centre — level H tolerates the occlusion */
    const mx = x + size / 2, my = y + size / 2, br = size * 0.15;
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(mx, my, br, 0, 7);
    c.fill();
    palm(c, mx, my + br * 0.45, br / 62, C.green);
  } else {
    c.fillStyle = C.ink;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = '700 ' + Math.round(size * 0.16) + 'px ' + F.mono;
    c.fillText('SCAN', x + size / 2, y + size / 2);
  }
  c.restore();
}

/* ====================================================================
   illustrated horizon — every drawn element from the original card,
   collected into one low-contrast scene that acts as an editorial rule
   ==================================================================== */

/**
 * `trunkLen` is the trunk length in device pixels. Without it the trunk is
 * a fixed 58 local units, which makes a scene palm read as fronds floating
 * in the sky rather than a tree standing on the beach.
 */
function palm(c, x, y, s, color, rot, trunkLen) {
  c.save();
  c.translate(x, y);
  if (rot) c.rotate(rot);
  c.scale(s, s);
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineCap = 'round';
  c.lineWidth = 7;
  const tl = trunkLen != null ? trunkLen / s : 58;
  c.beginPath();
  c.moveTo(0, tl);
  c.quadraticCurveTo(tl * 0.14, tl * 0.38, 0, 0);
  c.stroke();
  [-160, -125, -90, -52, -16].forEach(d => {
    c.save();
    c.rotate(d * Math.PI / 180);
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(26, -11, 50, -2);
    c.quadraticCurveTo(26, 9, 0, 0);
    c.closePath();
    c.fill();
    c.restore();
  });
  c.restore();
}

function hut(c, x, y, s, color) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.fillStyle = color;
  c.fillRect(-58, -6, 11, 34);
  c.fillRect(47, -6, 11, 34);
  rr(c, -76, -120, 152, 118, 9);
  c.fill();
  c.beginPath();
  c.moveTo(-92, -116);
  c.lineTo(0, -168);
  c.lineTo(92, -116);
  c.closePath();
  c.fill();
  c.restore();
}

function scooter(c, x, y, s, color) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.fillStyle = color;
  c.beginPath(); c.arc(-34, 0, 15, 0, 7); c.fill();
  c.beginPath(); c.arc(34, 0, 15, 0, 7); c.fill();
  c.beginPath();
  c.moveTo(-40, -14);
  c.quadraticCurveTo(-10, -30, 18, -16);
  c.quadraticCurveTo(30, -40, 40, -44);
  c.lineTo(46, -36);
  c.quadraticCurveTo(36, -30, 32, -10);
  c.quadraticCurveTo(10, -2, -20, -6);
  c.closePath();
  c.fill();
  c.restore();
}

function surfboard(c, x, y, s, rot, color, stripe) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.scale(s, s);
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(0, -80);
  c.quadraticCurveTo(24, -30, 20, 30);
  c.quadraticCurveTo(16, 72, 0, 80);
  c.quadraticCurveTo(-16, 72, -20, 30);
  c.quadraticCurveTo(-24, -30, 0, -80);
  c.closePath();
  c.fill();
  /* the stringer — without it a small silhouette just reads as a leaf */
  if (stripe) {
    c.strokeStyle = stripe;
    c.lineWidth = 6;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(0, -58);
    c.lineTo(0, 58);
    c.stroke();
  }
  c.restore();
}

function sailboat(c, x, y, s, color) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(0, -34);
  c.lineTo(0, 4);
  c.lineTo(-24, 4);
  c.closePath();
  c.fill();
  rr(c, -30, 6, 58, 9, 4);
  c.fill();
  c.restore();
}

/* ====================================================================
   ornament — azulejo tiles, sunset scene, ribbon, medallion
   ==================================================================== */

/**
 * One azulejo cell. Goa is full of Portuguese ceramic tilework — house
 * plaques, church facades, street signs — so the lattice is drawn in the
 * brand green and pink instead of the usual cobalt on white.
 */
function azulejoCell(c, cx, cy, s, line, dot) {
  c.save();
  c.translate(cx, cy);
  c.strokeStyle = line;
  c.lineWidth = Math.max(1.1, s * 0.045);
  c.lineCap = 'round';

  /* four petals meeting at the centre */
  for (let i = 0; i < 4; i++) {
    c.save();
    c.rotate(i * Math.PI / 2);
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(s * 0.30, -s * 0.14, s * 0.44, 0);
    c.quadraticCurveTo(s * 0.30, s * 0.14, 0, 0);
    c.stroke();
    c.restore();
  }

  /* quarter arcs at the corners knit neighbouring cells into a lattice */
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([dx, dy]) => {
    c.beginPath();
    c.arc(dx * s / 2, dy * s / 2, s * 0.24, 0, 7);
    c.stroke();
  });

  c.fillStyle = dot;
  c.beginPath();
  c.arc(0, 0, s * 0.065, 0, 7);
  c.fill();
  c.restore();
}

/** A horizontal band of azulejo, clipped to the strip it decorates. */
function azulejoBand(c, x, y, w, h, cell) {
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  const cols = Math.ceil(w / cell) + 1;
  const rows = Math.ceil(h / cell) + 1;
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < cols; i++) {
      azulejoCell(c, x + i * cell + cell / 2, y + r * cell + cell / 2, cell,
                  'rgba(11,104,57,.42)', 'rgba(236,15,124,.5)');
    }
  }
  c.restore();
}

function birds(c, x, y, s, color) {
  c.save();
  c.strokeStyle = color;
  c.lineWidth = 3 * s;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x - 13 * s, y);
  c.quadraticCurveTo(x - 6 * s, y - 9 * s, x, y);
  c.quadraticCurveTo(x + 6 * s, y - 9 * s, x + 13 * s, y);
  c.stroke();
  c.restore();
}

/**
 * The card's centrepiece: an Arabian Sea sunset behind the portrait.
 * The gradient runs brand yellow to brand pink, which is genuinely what a
 * Goa sunset looks like — so the card gets its colour and drama without
 * importing a single hue from outside the event's palette.
 */
function sunsetScene(c, x, y, w, h, rad, portraitCx, portraitR) {
  c.save();
  rr(c, x, y, w, h, rad);
  c.clip();

  const sky = c.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, '#FEE101');
  sky.addColorStop(0.42, '#F98A22');
  sky.addColorStop(0.78, '#EC0F7C');
  sky.addColorStop(1, '#C00E6B');
  c.fillStyle = sky;
  c.fillRect(x, y, w, h);

  const horizon = y + h * 0.74;

  /* sun, set off to the left so the portrait does not eclipse it */
  const sunX = x + w * 0.20, sunY = horizon - h * 0.20, sunR = h * 0.20;
  c.fillStyle = 'rgba(255,251,232,.95)';
  c.beginPath(); c.arc(sunX, sunY, sunR, 0, 7); c.fill();

  /* retro cut bands across the lower half of the sun */
  c.save();
  c.beginPath(); c.arc(sunX, sunY, sunR, 0, 7); c.clip();
  c.fillStyle = 'rgba(236,15,124,.30)';
  for (let i = 0; i < 5; i++) {
    c.fillRect(sunX - sunR, sunY + sunR * 0.12 + i * sunR * 0.20, sunR * 2, sunR * 0.085);
  }
  c.restore();

  /* sea */
  c.fillStyle = C.green;
  c.fillRect(x, horizon, w, y + h - horizon);
  c.fillStyle = 'rgba(5,45,24,.35)';
  c.fillRect(x, horizon + (y + h - horizon) * 0.55, w, (y + h - horizon) * 0.45);

  /* sun reflection column, then surf lines */
  c.save();
  c.fillStyle = 'rgba(255,251,232,.22)';
  for (let i = 0; i < 6; i++) {
    const ww = sunR * (1.5 - i * 0.16);
    c.fillRect(sunX - ww / 2, horizon + 6 + i * 13, ww, 5);
  }
  c.restore();

  c.strokeStyle = 'rgba(255,251,232,.45)';
  c.lineWidth = 3;
  c.lineCap = 'round';
  for (let row = 0; row < 3; row++) {
    const yy = horizon + 16 + row * 22;
    c.beginPath();
    let px = x;
    let up = row % 2 === 0;
    while (px < x + w) {
      c.quadraticCurveTo(px + 22, yy + (up ? -7 : 7), px + 44, yy);
      px += 44;
      up = !up;
    }
    c.stroke();
  }

  /* sailboat riding the horizon */
  sailboat(c, x + w * 0.78, horizon - 3, 0.7, C.cream);

  /* foreground shore, so the scene has depth rather than one flat band */
  const shoreY = y + h * 0.90;
  c.fillStyle = '#03230F';
  c.beginPath();
  c.moveTo(x, shoreY + 14);
  c.quadraticCurveTo(x + w * 0.3, shoreY - 10, x + w * 0.55, shoreY + 2);
  c.quadraticCurveTo(x + w * 0.8, shoreY + 12, x + w, shoreY - 6);
  c.lineTo(x + w, y + h);
  c.lineTo(x, y + h);
  c.closePath();
  c.fill();

  /*
   * The beach stands ON the shore line, not inside it — silhouetted against
   * the sea. Drawn in the shore's own colour, anything below the line simply
   * merges into it, which is what a silhouette should do.
   */
  const SIL = '#03230F';
  hut(c, x + w * 0.10, shoreY - 8 - 28 * 0.42, 0.42, SIL);
  /* planted upright in the sand — floating on the sea it read as a leaf */
  surfboard(c, x + w * 0.165, shoreY - 6 - 80 * 0.55, 0.55, 0.09, SIL, 'rgba(255,251,232,.42)');
  scooter(c, x + w * 0.245, shoreY - 6 - 15 * 0.55, 0.55, SIL);

  /* palms rooted on the shore, leaning into the frame */
  const fL = y + h * 0.19, fR = y + h * 0.17;
  palm(c, x + w * 0.06, fL, 1.55, SIL, 0.2, shoreY + 8 - fL);
  palm(c, x + w * 0.94, fR, 1.6, SIL, -0.18, shoreY + 8 - fR);

  /* birds kept to the right of the portrait, where the sky is open */
  birds(c, x + w * 0.79, y + h * 0.13, 1.5, 'rgba(3,35,15,.72)');
  birds(c, x + w * 0.86, y + h * 0.21, 1.1, 'rgba(3,35,15,.6)');
  birds(c, x + w * 0.75, y + h * 0.25, 0.85, 'rgba(3,35,15,.5)');

  c.restore();

  /* keyline around the scene */
  c.strokeStyle = C.ink;
  c.lineWidth = 2.5;
  rr(c, x, y, w, h, rad);
  c.stroke();
}

/**
 * Portrait medallion: yellow band, cream gap, ink keylines, and a ring of
 * small beads. Replaces the plain double ring — the card needed jewellery.
 */
function medallion(c, cx, cy, r) {
  c.save();

  c.fillStyle = C.cream;
  c.beginPath(); c.arc(cx, cy, r + 40, 0, 7); c.fill();

  c.fillStyle = C.yellow;
  c.beginPath(); c.arc(cx, cy, r + 26, 0, 7); c.fill();

  c.strokeStyle = C.ink;
  c.lineWidth = 2.6;
  c.beginPath(); c.arc(cx, cy, r + 40, 0, 7); c.stroke();
  c.beginPath(); c.arc(cx, cy, r + 26, 0, 7); c.stroke();

  /* beads sitting in the cream gutter */
  const beads = Math.max(24, Math.round(r / 7));
  c.fillStyle = C.pink;
  for (let i = 0; i < beads; i++) {
    const a = i * 2 * Math.PI / beads;
    c.beginPath();
    c.arc(cx + (r + 33) * Math.cos(a), cy + (r + 33) * Math.sin(a), 2.6, 0, 7);
    c.fill();
  }

  c.strokeStyle = C.cream;
  c.lineWidth = 3.5;
  c.beginPath(); c.arc(cx, cy, r + 12, 0, 7); c.stroke();
  c.strokeStyle = C.ink;
  c.lineWidth = 1.8;
  c.beginPath(); c.arc(cx, cy, r + 5, 0, 7); c.stroke();

  c.restore();
}

/** Banner with notched ends — flashier than a plain pill. */
function ribbon(c, cx, cy, text, fs) {
  c.save();
  c.font = '900 ' + fs + 'px ' + F.display;
  const tw = c.measureText(text).width;
  const w = tw + fs * 1.25, h = fs * 1.5, notch = fs * 0.42, tail = fs * 0.62;

  c.translate(cx, cy);
  c.rotate(-0.012);

  /* folded tails behind each end */
  c.fillStyle = C.greenDark;
  [-1, 1].forEach(sgn => {
    c.beginPath();
    c.moveTo(sgn * (w / 2 - 4), -h / 2 + 3);
    c.lineTo(sgn * (w / 2 + tail), -h / 2 - tail * 0.42);
    c.lineTo(sgn * (w / 2 + tail), h / 2 + tail * 0.42);
    c.lineTo(sgn * (w / 2 - 4), h / 2 - 3);
    c.closePath();
    c.fill();
  });

  /* main band */
  c.fillStyle = C.green;
  c.beginPath();
  c.moveTo(-w / 2, -h / 2);
  c.lineTo(w / 2, -h / 2);
  c.lineTo(w / 2 - notch, 0);
  c.lineTo(w / 2, h / 2);
  c.lineTo(-w / 2, h / 2);
  c.lineTo(-w / 2 + notch, 0);
  c.closePath();
  c.fill();
  c.strokeStyle = C.ink;
  c.lineWidth = 2.4;
  c.stroke();

  c.strokeStyle = 'rgba(254,225,1,.55)';
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(-w / 2 + 9, -h / 2 + 7);
  c.lineTo(w / 2 - 9, -h / 2 + 7);
  c.moveTo(-w / 2 + 9, h / 2 - 7);
  c.lineTo(w / 2 - 9, h / 2 - 7);
  c.stroke();

  c.fillStyle = C.yellow;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, 0, h * 0.04);
  c.restore();
}

/* ====================================================================
   photo
   ==================================================================== */

function drawPhoto(c, ph, cx, cy, r) {
  c.save();
  c.beginPath();
  c.arc(cx, cy, r, 0, 7);
  c.clip();

  if (!ph.img) {
    /* empty state: a silhouette, so the frame still reads as a frame */
    c.fillStyle = C.greenDeep;
    c.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    c.fillStyle = 'rgba(255,251,232,.28)';
    c.beginPath(); c.arc(cx, cy - r * 0.24, r * 0.28, 0, 7); c.fill();
    c.beginPath(); c.arc(cx, cy + r * 0.78, r * 0.58, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,251,232,.72)';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = '700 ' + Math.round(r * 0.11) + 'px ' + F.mono;
    lsText(c, 'ADD PHOTO', cx, cy + r * 0.42, r * 0.02, 'center');
  } else {
    const img = ph.img, iw = img.width, ih = img.height;
    /* cover-fit: the shorter edge fills the circle, then user zoom */
    const s = Math.max((2 * r) / iw, (2 * r) / ih) * ph.scale;
    const sw = 2 * r / s;
    const maxX = Math.max(0, (iw - sw) / 2);
    const maxY = Math.max(0, (ih - sw) / 2);
    ph.ox = Math.min(maxX, Math.max(-maxX, ph.ox));
    ph.oy = Math.min(maxY, Math.max(-maxY, ph.oy));
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(img, iw / 2 - sw / 2 + ph.ox, ih / 2 - sw / 2 + ph.oy, sw, sw,
                cx - r, cy - r, 2 * r, 2 * r);
  }
  c.restore();
}

/* ====================================================================
   shared card furniture
   ==================================================================== */

function groundGreen(c, W, H) {
  c.fillStyle = C.green;
  c.fillRect(0, 0, W, H);
  c.save();
  c.fillStyle = 'rgba(255,251,232,.07)';
  for (let y = 15; y < H; y += 26) {
    for (let x = 15 + ((y / 26) % 2) * 13; x < W; x += 26) {
      c.beginPath();
      c.arc(x, y, 1.7, 0, 7);
      c.fill();
    }
  }
  c.restore();
}

/** Cream paper panel with the double-rule editorial border. */
function paper(c, x, y, w, h, r) {
  c.save();
  c.shadowColor = 'rgba(5,45,24,.35)';
  c.shadowBlur = 26;
  c.shadowOffsetY = 12;
  c.fillStyle = C.cream;
  rr(c, x, y, w, h, r);
  c.fill();
  c.restore();

  c.strokeStyle = C.ink;
  c.lineWidth = 3;
  rr(c, x, y, w, h, r);
  c.stroke();

  c.strokeStyle = C.hairSoft;
  c.lineWidth = 1.4;
  rr(c, x + 14, y + 14, w - 28, h - 28, Math.max(6, r - 10));
  c.stroke();
}

/** Folio rail: left slug, right slug, hairline under. Straight from the deck. */
function folio(c, x1, x2, y, left, right) {
  c.textBaseline = 'alphabetic';
  c.font = '700 19px ' + F.mono;
  c.fillStyle = C.inkSoft;
  c.textAlign = 'left';
  lsText(c, left, x1, y, 2.6, 'left');
  c.fillStyle = C.pink;
  lsText(c, right, x2, y, 2.6, 'right');
  hairline(c, x1, y + 18, x2, C.hair, 1.6);
}

/** The pink गोवा plate with yellow Devanagari, drawn centred on (0,0). */
function goaBadge(c, bs, keylineColor) {
  c.font = bs + 'px ' + F.deva;
  const bw = c.measureText('गोवा').width + bs * 0.9;
  const bh = bs * 1.6;
  if (keylineColor) {
    c.fillStyle = keylineColor;
    rr(c, -bw / 2 - 7, -bh / 2 - 7, bw + 14, bh + 14, 17);
    c.fill();
  }
  c.fillStyle = C.pink;
  rr(c, -bw / 2, -bh / 2, bw, bh, 13);
  c.fill();
  c.strokeStyle = 'rgba(255,251,232,.5)';
  c.lineWidth = 2;
  rr(c, -bw / 2 + 6, -bh / 2 + 6, bw - 12, bh - 12, 9);
  c.stroke();
  c.fillStyle = C.yellow;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('गोवा', 0, bs * 0.06);
  return bw;
}

/**
 * The official lockup: HACKER [गोवा] HOUSE in yellow Imbue on a green
 * block. This is the single thing that makes the card unmistakably this
 * event rather than a generic badge.
 *
 * Set on one line, not stacked: Imbue is narrow, so a stacked lockup that
 * fits this block height is only ~300px wide and the badge then covers the
 * middle of both words. One line uses the full width and stays readable.
 */
function lockup(c, x, y, w, h) {
  c.save();
  c.fillStyle = C.green;
  rr(c, x, y, w, h, 15);
  c.fill();

  /* dot field inside the block, echoing the page ground */
  c.save();
  rr(c, x, y, w, h, 15);
  c.clip();
  c.fillStyle = 'rgba(255,251,232,.07)';
  for (let yy = y + 11; yy < y + h; yy += 23) {
    for (let xx = x + 11 + ((yy / 23) % 2) * 11.5; xx < x + w; xx += 23) {
      c.beginPath(); c.arc(xx, yy, 1.5, 0, 7); c.fill();
    }
  }
  c.restore();

  const availW = w * 0.9;
  let px = Math.min(150, Math.round(h * 0.74));
  let wh = 0, wo = 0, bs = 0, bw = 0, gap = 0, total = 0;

  for (;;) {
    c.font = '900 ' + px + 'px ' + F.display;
    wh = c.measureText('HACKER').width;
    wo = c.measureText('HOUSE').width;
    bs = Math.round(px * 0.60);
    c.font = bs + 'px ' + F.deva;
    bw = c.measureText('गोवा').width + bs * 0.9;
    gap = bw + px * 0.30;
    total = wh + wo + gap;
    if (total <= availW || px <= 22) break;
    px -= 2;
  }

  const cx = x + w / 2, cy = y + h / 2;
  const startX = cx - total / 2;

  c.font = '900 ' + px + 'px ' + F.display;
  c.fillStyle = C.yellow;
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  c.fillText('HACKER', startX, cy);
  c.fillText('HOUSE', startX + wh + gap, cy);

  c.save();
  c.translate(startX + wh + gap / 2, cy);
  c.rotate(-0.05);
  goaBadge(c, bs, null);
  c.restore();

  c.restore();
}

/** Small caps column head in pink. Returns its drawn width. */
function colHead(c, text, x, y, align) {
  c.font = '700 15px ' + F.mono;
  c.fillStyle = C.pink;
  c.textBaseline = 'alphabetic';
  return lsText(c, text, x, y, 2.4, align || 'left');
}

/** Split a phrase into two balanced lines. */
function twoLines(text) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2) return [text, ''];
  let best = [text, ''], bd = 1e9;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
    const d = Math.abs(a.length - b.length);
    if (d < bd) { bd = d; best = [a, b]; }
  }
  return best;
}

/** Draw up to two display lines inside a column. */
function colValue(c, text, x, y, maxW, align) {
  const lines = twoLines(text);
  const px = Math.min(
    fitFont(c, lines[0], 40, maxW, F.display, '700'),
    lines[1] ? fitFont(c, lines[1], 40, maxW, F.display, '700') : 99
  );
  c.font = '700 ' + px + 'px ' + F.display;
  c.fillStyle = C.ink;
  c.textAlign = align || 'left';
  c.textBaseline = 'alphabetic';
  c.fillText(lines[0], x, y);
  if (lines[1]) c.fillText(lines[1], x, y + px * 0.92);
  return lines[1] ? y + px * 0.92 : y;
}

/* ====================================================================
   FORMAT B — Builder ID card, 1080 × 1350
   ==================================================================== */
function drawID(c) {
  const W = 1080, H = 1350;
  const M = 44;                       /* card margin */
  const L = 92, R = 988;              /* content rails */

  groundGreen(c, W, H);
  paper(c, M, M, W - 2 * M, H - 2 * M, 26);

  folio(c, L, R, 104, 'HACKER HOUSE GOA 2026', '28–31 OCT 2026');

  lockup(c, L, 138, R - L, 140);

  /* --- the sunset, and the portrait medallion sitting on it --- */
  const pcx = 540, pcy = 524, pr = 176;
  photoRadius = pr;
  sunsetScene(c, L, 292, R - L, 464, 18, pcx, pr);
  medallion(c, pcx, pcy, pr);
  drawPhoto(c, state.photo, pcx, pcy, pr);

  /* --- name --- */
  const nm = (state.name || 'YOUR NAME').toUpperCase();
  hairline(c, L, 786, R, C.hair, 1.6);
  const npx = fitFont(c, nm, 92, 780, F.display, '900');
  c.font = '900 ' + npx + 'px ' + F.display;
  c.fillStyle = C.ink;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(nm, 540, 830);

  /* --- stack / role --- */
  const role = (state.role || 'FULL-STACK BUILDER').toUpperCase();
  const rpx = fitFont(c, role, 24, 620, F.mono, '700');
  c.font = '700 ' + rpx + 'px ' + F.mono;
  c.fillStyle = C.pink;
  c.textBaseline = 'middle';
  lsText(c, role, 540, 878, 4, 'center');
  diamond(c, 540 - 356, 878, 10, C.yellowDim);
  diamond(c, 540 + 356, 878, 10, C.yellowDim);

  /* --- landing-card data: callsign, the loop, what you are here to build --- */
  const tTop = 902, tBot = 1048;
  const cA = L, cB = 400, cC = 690;
  hairline(c, L, tTop, R, C.hair, 1.6);
  vline(c, cB - 18, tTop, tBot, C.hairSoft, 1.4);
  vline(c, cC - 18, tTop, tBot, C.hairSoft, 1.4);

  colHead(c, 'CALLSIGN', cA, tTop + 30, 'left');
  colHead(c, 'THE LOOP', cB, tTop + 30, 'left');
  colHead(c, 'NOW BUILDING', cC, tTop + 30, 'left');

  colValue(c, (state.callsign.trim() || 'UNSIGNED').toUpperCase(),
           cA, tTop + 76, 276, 'left');
  colValue(c, (state.shipping || 'SOMETHING WORTH SHIPPING').toUpperCase(),
           cC, tTop + 76, 290, 'left');

  c.textAlign = 'left';
  c.textBaseline = 'middle';
  LOOP.forEach((t, i) => {
    const y = tTop + 66 + i * 30;
    c.fillStyle = C.yellowDim;
    c.beginPath(); c.arc(cB + 6, y, 5, 0, 7); c.fill();
    c.font = '500 20px ' + F.mono;
    c.fillStyle = C.ink;
    c.fillText(t, cB + 22, y);
  });

  hairline(c, L, tBot, R, C.hair, 1.6);

  /* --- footer: labelled like the table above it, so it reads as one system */
  const qrLabelW = colHead(c, 'SCAN TO MAKE YOURS', L, 1074, 'left');
  const QRS = 116;
  drawQR(c, L + qrLabelW / 2 - QRS / 2, 1084, QRS);

  colHead(c, 'PASS NO.', R, 1074, 'right');
  c.font = '900 30px ' + F.display;
  c.fillStyle = C.ink;
  c.textAlign = 'right';
  c.textBaseline = 'alphabetic';
  c.fillText(state.passId, R, 1118);
  barcode(c, R - 186, 1130, 186, 26,
          parseInt(state.passId.replace(/\D/g, ''), 10) || 264821, C.ink);
  c.font = '700 13px ' + F.mono;
  c.fillStyle = C.inkSoft;
  lsText(c, 'GOA · INDIA', R, 1186, 1.4, 'right');

  ribbon(c, 540, 1140, '#FRAMEINGOA', 42);

  /* --- azulejo tile band along the base --- */
  azulejoBand(c, L, 1214, R - L, 72, 36);
  hairline(c, L, 1214, R, C.hair, 1.6);
  hairline(c, L, 1286, R, C.hair, 1.6);
}

/* ====================================================================
   FORMAT A — PFP frame, 1080 × 1080
   The photo stays front and centre; the frame only wraps it.
   ==================================================================== */
function drawPFP(c) {
  const W = 1080, H = 1080, cx = 540, cy = 540;

  groundGreen(c, W, H);

  /* cream disc — X crops to this circle, so nothing important sits outside */
  c.save();
  c.shadowColor = 'rgba(5,45,24,.4)';
  c.shadowBlur = 24;
  c.fillStyle = C.cream;
  c.beginPath(); c.arc(cx, cy, 538, 0, 7); c.fill();
  c.restore();

  c.strokeStyle = C.ink;
  c.lineWidth = 3;
  c.beginPath(); c.arc(cx, cy, 528, 0, 7); c.stroke();
  c.strokeStyle = C.hairSoft;
  c.lineWidth = 1.6;
  c.beginPath(); c.arc(cx, cy, 516, 0, 7); c.stroke();

  /* ring type, set in the brand display face */
  c.fillStyle = C.green;
  c.font = '900 74px ' + F.display;
  arcText(c, 'HACKER HOUSE GOA', cx, cy, 476, -Math.PI / 2, false, 3);
  c.fillStyle = C.pink;
  c.font = '900 56px ' + F.display;
  arcText(c, '#FRAMEINGOA · 2026', cx, cy, 482, Math.PI / 2, true, 3);

  star(c, cx - 488, cy, 14, C.pink);
  star(c, cx + 488, cy, 14, C.pink);
  diamond(c, cx - 352, cy - 352, 13, C.yellowDim);
  diamond(c, cx + 352, cy - 352, 13, C.yellowDim);

  /* the photo — 71% of the frame width, so it stays the subject */
  const pr = 384;
  photoRadius = pr;
  medallion(c, cx, cy, pr);
  drawPhoto(c, state.photo, cx, cy, pr);

  /*
   * गोवा badge pinned at 42°. Kept off bottom-centre on purpose: the
   * #FRAMEINGOA arc runs through there and the two collided.
   */
  const a = 42 * Math.PI / 180, br = 452;
  c.save();
  c.translate(cx + br * Math.cos(a), cy + br * Math.sin(a));
  c.rotate(-0.05);
  goaBadge(c, 46, C.cream);
  c.restore();
}

/* ====================================================================
   BONUS — Squad card, 1600 × 900 (one to three builders)
   ==================================================================== */
function drawTeam(c) {
  const W = 1600, H = 900;
  const M = 38;
  const L = 84, R = 1516;

  groundGreen(c, W, H);
  paper(c, M, M, W - 2 * M, H - 2 * M, 24);

  folio(c, L, R, 96, 'HACKER HOUSE GOA 2026', 'SQUAD');

  lockup(c, L, 130, R - L, 132);
  drawQR(c, R - 104, 148, 92);

  /* team name */
  const team = (state.teamName || 'SQUAD CARD').toUpperCase();
  const tpx = fitFont(c, team, 34, 700, F.mono, '700');
  c.font = '700 ' + tpx + 'px ' + F.mono;
  c.fillStyle = C.pink;
  c.textBaseline = 'middle';
  lsText(c, team, (L + R) / 2, 302, 5, 'center');

  /* the whole squad shares one sunset */
  sunsetScene(c, L, 320, R - L, 380, 16, (L + R) / 2, 0);

  const layouts = {
    1: [[800, 500, 146]],
    2: [[590, 500, 136], [1010, 500, 136]],
    3: [[440, 500, 118], [800, 500, 118], [1160, 500, 118]]
  };
  const spots = layouts[state.teamCount];
  photoRadius = spots[0][2];

  spots.forEach((sp, i) => {
    const [x, y, r] = sp;
    const m = state.team[i];
    medallion(c, x, y, r);
    drawPhoto(c, m, x, y, r);

    const nm = (m.name || 'BUILDER ' + (i + 1)).toUpperCase();
    const npx = fitFont(c, nm, 44, r * 2.4, F.display, '900');
    c.font = '900 ' + npx + 'px ' + F.display;
    c.fillStyle = C.ink;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(nm, x, 730);
    hairline(c, x - r * 0.7, 756, x + r * 0.7, C.hair, 1.5);
  });

  hairline(c, L, 790, R, C.hair, 1.6);
  c.font = '700 17px ' + F.mono;
  c.fillStyle = C.inkSoft;
  c.textBaseline = 'alphabetic';
  lsText(c, 'BUILD · SHIP · REPEAT', L, 826, 3, 'left');
  lsText(c, 'GOA · 28–31 OCT 2026', R, 826, 3, 'right');

  ribbon(c, (L + R) / 2, 818, '#FRAMEINGOA', 38);
}

/* ====================================================================
   render
   ==================================================================== */
const DRAW = { id: drawID, pfp: drawPFP, team: drawTeam };

function render() {
  const { w, h } = SIZES[state.mode];
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  ctx.clearRect(0, 0, w, h);
  DRAW[state.mode](ctx);
}

/* ====================================================================
   photo decoding — JPG / PNG / WebP natively, HEIC via lazy fallback
   ==================================================================== */
const MAX_BYTES = 25 * 1024 * 1024;
let heicPromise = null;

function loadHeicLib() {
  if (heicPromise) return heicPromise;
  heicPromise = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/heic2any/0.0.4/heic2any.min.js';
    s.integrity = 'sha512-VjmsArkf8Vv2yyvbXCyVxp+R3n4N2WyS1GEQ+YQxa7Hu0tx836WpY4nW9/T1W5JBmvuIsxkVH/DlHgp7NEMjDw==';
    s.crossOrigin = 'anonymous';
    s.referrerPolicy = 'no-referrer';
    s.onload = res;
    s.onerror = () => rej(new Error('heic decoder unavailable'));
    document.head.appendChild(s);
  });
  return heicPromise;
}

function blobToImg(blob) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(blob);
    const im = new Image();
    im.onload = () => { res(im); setTimeout(() => URL.revokeObjectURL(url), 4000); };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('decode failed')); };
    im.src = url;
  });
}

async function fileToImage(file) {
  if (!/^image\//i.test(file.type) && !/\.(hei[cf]|jpe?g|png|webp|gif|avif)$/i.test(file.name)) {
    throw new Error('not an image');
  }
  if (file.size > MAX_BYTES) throw new Error('too big');

  const isHeic = /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);

  /* native decode first — respects the camera's EXIF orientation */
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (e) {
    if (isHeic) {
      await loadHeicLib();
      const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
      const blob = Array.isArray(out) ? out[0] : out;
      try {
        return await createImageBitmap(blob, { imageOrientation: 'from-image' });
      } catch (e2) {
        return await blobToImg(blob);
      }
    }
    return await blobToImg(file);
  }
}

async function acceptPhoto(file, target, okMsg) {
  if (!file) return;
  toast('Reading your photo…');
  try {
    const img = await fileToImage(file);
    target.img = img;
    target.ox = 0; target.oy = 0; target.scale = 1;
    render();
    toast(okMsg);
    return true;
  } catch (err) {
    const m = String(err && err.message);
    toast(m === 'too big' ? 'That file is over 25 MB — try a smaller photo.'
        : m === 'not an image' ? 'That does not look like an image file.'
        : m === 'heic decoder unavailable' ? 'Could not load the HEIC decoder. A JPG or PNG will work.'
        : 'Could not read that photo. Try a JPG or PNG.');
    return false;
  }
}

/* ====================================================================
   controls
   ==================================================================== */

const TABS = [...document.querySelectorAll('.format')];

function setMode(mode) {
  state.mode = mode;
  TABS.forEach(t => t.setAttribute('aria-selected', String(t.dataset.mode === mode)));

  const isTeam = mode === 'team';
  $('blkPhoto').hidden = isTeam;
  $('blkId').hidden = mode !== 'id';
  $('blkTeam').hidden = !isTeam;

  const { w, h, label } = SIZES[mode];
  $('plateFmt').textContent = label;
  $('plateDim').textContent = w + ' × ' + h;
  cv.setAttribute('aria-label', 'Live preview of your ' + label);
  render();
}

TABS.forEach(t => t.addEventListener('click', () => setMode(t.dataset.mode)));

/* main photo */
$('fileMain').addEventListener('change', async e => {
  const f = e.target.files[0];
  await acceptPhoto(f, state.photo, 'Looking good — drag to reframe.');
  $('zoomMain').value = 1;
  e.target.value = '';
});

$('zoomMain').addEventListener('input', e => {
  state.photo.scale = parseFloat(e.target.value);
  render();
});

/* drag-and-drop onto the upload well */
const dropMain = $('dropMain');
['dragenter', 'dragover'].forEach(ev =>
  dropMain.addEventListener(ev, e => { e.preventDefault(); dropMain.classList.add('is-over'); }));
['dragleave', 'drop'].forEach(ev =>
  dropMain.addEventListener(ev, e => { e.preventDefault(); dropMain.classList.remove('is-over'); }));
dropMain.addEventListener('drop', async e => {
  const f = e.dataTransfer && e.dataTransfer.files[0];
  await acceptPhoto(f, state.photo, 'Looking good — drag to reframe.');
  $('zoomMain').value = 1;
});

/* identity fields */
const bind = (id, key) => $(id).addEventListener('input', e => {
  state[key] = e.target.value;
  render();
});
bind('inpName', 'name');
bind('inpRole', 'role');
bind('inpShip', 'shipping');
bind('inpTeam', 'teamName');
bind('inpCallsign', 'callsign');

$('inpCallsign').value = state.callsign;
$('inpPass').value = state.passId;

$('rollCallsign').addEventListener('click', () => {
  state.callsign = genCallsign();
  $('inpCallsign').value = state.callsign;
  render();
});
$('rollPass').addEventListener('click', () => {
  state.passId = genPass();
  $('inpPass').value = state.passId;
  render();
});

/* team size */
$('segCount').querySelectorAll('button').forEach(b => {
  b.addEventListener('click', () => {
    $('segCount').querySelectorAll('button')
      .forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    state.teamCount = parseInt(b.dataset.n, 10);
    buildMemberRows();
    render();
  });
});

function buildMemberRows() {
  const holder = $('members');
  holder.textContent = '';
  for (let i = 0; i < state.teamCount; i++) {
    const m = state.team[i];

    const box = document.createElement('div');
    box.className = 'member';

    /* built with DOM APIs, never innerHTML — names are user input */
    const drop = document.createElement('label');
    drop.className = 'drop';
    const t = document.createElement('span');
    t.className = 'drop__title';
    t.textContent = 'Builder ' + (i + 1) + ' photo';
    const file = document.createElement('input');
    file.type = 'file';
    file.accept = 'image/*,.heic,.heif';
    drop.append(t, file);

    const nameIn = document.createElement('input');
    nameIn.type = 'text';
    nameIn.className = 'input';
    nameIn.maxLength = 18;
    nameIn.placeholder = 'Builder ' + (i + 1) + ' name';
    nameIn.value = m.name;
    nameIn.setAttribute('aria-label', 'Builder ' + (i + 1) + ' name');

    const zoom = document.createElement('input');
    zoom.type = 'range';
    zoom.className = 'slider';
    zoom.min = 1; zoom.max = 3; zoom.step = 0.01;
    zoom.value = m.scale;
    zoom.setAttribute('aria-label', 'Builder ' + (i + 1) + ' zoom');

    file.addEventListener('change', async e => {
      const ok = await acceptPhoto(e.target.files[0], m, 'Builder ' + (i + 1) + ' is in.');
      if (ok) zoom.value = 1;
      e.target.value = '';
    });
    nameIn.addEventListener('input', e => { m.name = e.target.value; render(); });
    zoom.addEventListener('input', e => { m.scale = parseFloat(e.target.value); render(); });

    box.append(drop, nameIn, zoom);
    holder.appendChild(box);
  }
}
buildMemberRows();

/* ---------------------------------------------- drag to reposition */
let dragging = false, lx = 0, ly = 0;

function activePhoto() {
  return state.mode === 'team' ? state.team[0] : state.photo;
}

cv.addEventListener('pointerdown', e => {
  const ph = activePhoto();
  if (!ph.img) return;
  dragging = true;
  lx = e.clientX; ly = e.clientY;
  cv.setPointerCapture(e.pointerId);
});

cv.addEventListener('pointermove', e => {
  if (!dragging) return;
  const ph = activePhoto();
  if (!ph.img) return;
  const rect = cv.getBoundingClientRect();
  const k = cv.width / rect.width;
  const r = photoRadius;
  const s = Math.max(2 * r / ph.img.width, 2 * r / ph.img.height) * ph.scale;
  ph.ox -= (e.clientX - lx) * k / s;
  ph.oy -= (e.clientY - ly) * k / s;
  lx = e.clientX; ly = e.clientY;
  render();
});

['pointerup', 'pointercancel'].forEach(ev =>
  cv.addEventListener(ev, () => { dragging = false; }));

/* ====================================================================
   download + share
   ==================================================================== */

function fileName() {
  const who = (state.mode === 'team' ? state.teamName : state.name)
    .trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return 'hhgoa26-' + state.mode + (who ? '-' + who : '') + '.png';
}

function downloadPNG(silent) {
  return new Promise(res => {
    cv.toBlob(b => {
      if (!b) { toast('Could not build the PNG. Try again.'); return res(false); }
      const url = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 6000);
      if (!silent) toast('PNG saved to your device.');
      res(true);
    }, 'image/png');
  });
}

/*
 * The task brief requires #FrameInGoa. The town-hall recap spells it
 * #FramedInGoa while also saying "FIG capitalized", which decodes back to
 * FrameInGoa — so both tags ship. A post carrying both is valid either way.
 */
const TAGS = '#FrameInGoa #FramedInGoa #HHGoa2026';

function caption() {
  const link = SITE_URL;
  const how = 'How to make yours: open the link, drop in a photo, hit download. No login, about ten seconds.';

  if (state.mode === 'pfp') {
    return 'New PFP, framed in paradise 🌴 Hacker House Goa 2026.\n\n'
      + how + '\n→ ' + link + '\n\n' + TAGS;
  }
  if (state.mode === 'team') {
    const t = state.teamName.trim();
    return (t ? t + ' is' : 'Our squad is') + ' locked in for Hacker House Goa 2026 🌴\n'
      + 'We build together, we ship together.\n\n'
      + 'How to make yours: open the link, pick Squad card, add up to three photos, hit download.\n→ '
      + link + '\n\n' + TAGS;
  }
  const sign = state.callsign ? state.callsign.toLowerCase() : 'builder';
  const ship = state.shipping.trim();
  return 'Landing card stamped for Hacker House Goa 2026 🌴⚡\n'
    + 'Callsign: ' + sign + (ship ? ' · building ' + ship : '') + '\n\n'
    + how + '\n→ ' + link + '\n\n' + TAGS;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
    ta.remove();
    return ok;
  }
}

async function shareToX() {
  await downloadPNG(true);
  window.open(
    'https://twitter.com/intent/tweet?text=' + encodeURIComponent(caption()),
    '_blank', 'noopener,noreferrer'
  );
  toast('PNG saved — attach it to the post, then publish.');
}

$('btnDl').addEventListener('click', () => downloadPNG());
$('btnX').addEventListener('click', shareToX);
$('stickyDl').addEventListener('click', () => downloadPNG());
$('stickyX').addEventListener('click', shareToX);

$('btnLi').addEventListener('click', async () => {
  await downloadPNG(true);
  await copyText(caption());
  window.open(
    'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(SITE_URL),
    '_blank', 'noopener,noreferrer'
  );
  toast('PNG saved and caption copied — paste it into the post.');
});

$('btnCopy').addEventListener('click', async () => {
  const ok = await copyText(caption());
  toast(ok ? 'Caption copied, hashtag included.' : 'Could not reach the clipboard.');
});

/* ====================================================================
   Footer marquee — the two tracks loop seamlessly only while each one is
   at least as wide as the viewport. Two units are in the markup already;
   on a very wide screen we top up so no gap opens mid-scroll.
   ==================================================================== */
const marquee = document.querySelector('.marquee');
if (marquee) {
  const mqRows = [...marquee.querySelectorAll('.marquee__row')];
  const mqUnits = mqRows.map(row => [...row.children]);

  function topUpMarquee() {
    mqRows.forEach((row, i) => {
      let guard = 0;
      while (row.scrollWidth < marquee.offsetWidth && guard++ < 8) {
        mqUnits[i].forEach(node => {
          const copy = node.cloneNode(true);
          copy.setAttribute('aria-hidden', 'true');
          row.appendChild(copy);
        });
      }
    });

    /* The strip repeats each destination several times. Only the first copy
       of each stays in the tab order, so keyboard users get four links, not
       one per repetition. */
    const seen = new Set();
    marquee.querySelectorAll('a').forEach(a => {
      if (seen.has(a.href)) {
        a.setAttribute('tabindex', '-1');
      } else {
        seen.add(a.href);
        a.removeAttribute('tabindex');
      }
    });
  }

  topUpMarquee();
  /* Measure again once Imbue is in: the fallback serif is far wider than the
     real face, so a first-paint measurement overestimates the track. */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(topUpMarquee).catch(() => {});
  }
  window.addEventListener('resize', topUpMarquee, { passive: true });
}

/* ====================================================================
   FAQ accordion — one panel open at a time, with a pointer-tracked glow
   ==================================================================== */
const faqCards = [...document.querySelectorAll('.faq-card')];

faqCards.forEach(card => {
  const btn = card.querySelector('.faq-trigger');

  btn.addEventListener('click', () => {
    const wasOpen = card.classList.contains('is-open');
    faqCards.forEach(other => {
      other.classList.remove('is-open');
      other.querySelector('.faq-trigger').setAttribute('aria-expanded', 'false');
    });
    if (!wasOpen) {
      card.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
    }
  });

  /* only meaningful where there is a hovering pointer to track */
  if (window.matchMedia && window.matchMedia('(hover: hover)').matches) {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--faq-x', (e.clientX - r.left) + 'px');
      card.style.setProperty('--faq-y', (e.clientY - r.top) + 'px');
    });
    card.addEventListener('pointerleave', () => {
      card.style.removeProperty('--faq-x');
      card.style.removeProperty('--faq-y');
    });
  }
});

/* ====================================================================
   toast + countdown
   ==================================================================== */
let toastTimer = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-visible'), 3000);
}

const countEl = $('count');
function tick() {
  const d = DEADLINE - Date.now();
  if (d <= 0) { countEl.textContent = 'Task 01 submissions closed'; return; }
  const dd = Math.floor(d / 86400000);
  const hh = Math.floor(d / 3600000) % 24;
  const mm = Math.floor(d / 60000) % 60;
  const ss = Math.floor(d / 1000) % 60;
  countEl.textContent = 'Task 01 closes in '
    + (dd ? dd + 'd ' : '')
    + String(hh).padStart(2, '0') + 'h '
    + String(mm).padStart(2, '0') + 'm '
    + String(ss).padStart(2, '0') + 's';
}
tick();
setInterval(tick, 1000);

/* ====================================================================
   boot — draw immediately, redraw once the brand faces are ready
   ==================================================================== */
buildQR();
setMode('id');

if (document.fonts && document.fonts.load) {
  Promise.all([
    document.fonts.load("900 120px 'Imbue'"),
    document.fonts.load("700 40px 'Imbue'"),
    document.fonts.load("60px 'Shrikhand'"),
    document.fonts.load("700 20px 'Victor Mono'"),
    document.fonts.load("500 20px 'Victor Mono'")
  ]).then(render).catch(() => {});
  document.fonts.ready.then(render).catch(() => {});
}

window.addEventListener('load', () => {
  if (!qrMatrix) { buildQR(); render(); }
});
