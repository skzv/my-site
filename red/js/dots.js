/* ===================================================================
   skz.dev, red dots edition: the renderer.

   The DOM lays the page out and carries the real text and links.
   This module paints every visible pixel onto one low-resolution
   canvas whose cells are either red or black:

     tone   terrain (the sine wave field) + the λ figure and its plume
     dither serpentine Floyd-Steinberg down to 1 bit
     wind   diagonal streaks, drawn as lit cells
     type   each DOM word stamped at its own position in a pixel font

   24 ticks a second; the tone layers advance on every second tick.
   =================================================================== */

const RED = 0xff0000ff;            /* #ff0000, as little-endian ABGR */
const BLACK = 0xff000000;
const TICK = 1000 / 24;
const WIND_DEG = 20;               /* streaks lie on a line rising to the right at this angle */
/* As measured in the reference clip, the wind blows down that line: left and slightly down. */
const WIND = { x: -Math.cos(WIND_DEG * Math.PI / 180), y: Math.sin(WIND_DEG * Math.PI / 180) };

/* The wave field, as on skz.dev. */
const SEPARATION = 140, AMOUNT = 130;
const FOV_TAN = Math.tan((75 / 2) * Math.PI / 180);

const root = document.documentElement;
const canvas = document.getElementById('dots');
const ctx = canvas.getContext('2d', { alpha: false });
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
const LINKS = 'main a:not(.mark)';  /* the λ is a link too, but it is drawn as the figure */

/* 64x64 tile of uniform noise: dither jitter and the intro dissolve. */
const tile = new Float32Array(4096);
for (let i = 0; i < 4096; i++) tile[i] = Math.random();

let cell = 2, cols = 0, rows = 0;
let unit = 1.5;                    /* cells per 3 px; lengths tuned on a 3 px grid are multiplied by it */
let streakPad = 80;
let image, px, tone, work, terrain, bits, out, quiet;
let words = [], anchors = [], rules = [], shelves = [], boxes = [], hero = null;
let anchorOf = new Map();
let fig = null, figKey = '';
let kit = null;                    /* the kitten: { el, w, h, poses, x, y, on } */
let streaks = [];
let tick = 0, lastTick = 0, lastScroll = -1;
let reveal = 0, count = 0, time = 0, jx = 0, jy = 0;
let sizeDirty = true, layoutDirty = true, toneDirty = true, paintDirty = true;
let mouseX = 0, mouseY = 0;
const cam = { x: 200, y: 2000 };   /* starts high and settles, as on skz.dev */
let hoverEl = null, focusEl = null;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const snap = (v) => Math.round(v - 0.001);

function hash2(ix, iy) {
	let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) | 0;
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y) {
	const ix = Math.floor(x), iy = Math.floor(y);
	const fx = x - ix, fy = y - iy;
	const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
	const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
	return a + (b - a) * ux + (c - a + (a - b + d - c) * ux) * uy;
}

/* --- Words --------------------------------------------------------- */

/* Wrap every word in a span so each one can be measured and stamped. */
function wrapWords(scope) {
	const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
	const nodes = [];
	while (walker.nextNode()) nodes.push(walker.currentNode);
	for (const node of nodes) {
		if (!node.nodeValue.trim() || node.parentElement.closest('[data-nodots]')) continue;
		const frag = document.createDocumentFragment();
		for (const part of node.nodeValue.split(/(\s+)/)) {
			if (!part) continue;
			if (/^\s+$/.test(part)) { frag.append(part); continue; }
			const span = document.createElement('span');
			span.className = 'w';
			span.textContent = part;
			frag.append(span);
		}
		node.replaceWith(frag);
	}
}

/* 1-bit bitmap of a word, rasterised once at one font pixel per cell. */
const glyphs = new Map();
const gcan = document.createElement('canvas');
const gctx = gcan.getContext('2d', { willReadFrequently: true });

function glyph(str, style, w, h) {
	const key = style.size + '|' + style.family + '|' + str;
	let g = glyphs.get(key);
	if (g) return g;
	gcan.width = w;
	gcan.height = h;
	gctx.font = style.size + 'px ' + style.family;
	gctx.textBaseline = 'alphabetic';
	gctx.fillStyle = '#fff';
	const m = gctx.measureText(str);
	const asc = m.fontBoundingBoxAscent || style.size;
	const desc = m.fontBoundingBoxDescent || style.size * 0.27;
	gctx.fillText(str, 0, Math.round((h - asc - desc) / 2 + asc));
	const data = gctx.getImageData(0, 0, w, h).data;
	const b = new Uint8Array(w * h);
	for (let i = 0; i < b.length; i++) b[i] = data[i * 4 + 3] > 110 ? 1 : 0;
	g = { w, h, b };
	glyphs.set(key, g);
	return g;
}

/* --- Layout: read the DOM, in cells, in document coordinates -------- */

function layout() {
	const sx = window.scrollX, sy = window.scrollY;
	const toCells = (r) => ({
		x: snap((r.left + sx) / cell),
		y: snap((r.top + sy) / cell),
		w: Math.max(1, Math.round(r.width / cell)),
		h: Math.max(1, Math.round(r.height / cell)),
	});
	const visible = (r) => r.width > 0 && r.height > 0;

	anchors = [];
	anchorOf = new Map();
	for (const el of document.querySelectorAll(LINKS)) {
		const a = {
			el,
			rects: [...el.getClientRects()].filter(visible).map(toCells),
			underline: !!el.closest('.about-body'),
		};
		anchorOf.set(el, a);
		anchors.push(a);
	}

	const styles = new Map();
	words = [];
	for (const el of document.querySelectorAll('main .w')) {
		const r = el.getBoundingClientRect();
		if (!visible(r)) continue;
		const parent = el.parentElement;
		let style = styles.get(parent);
		if (!style) {
			const cs = getComputedStyle(parent);
			style = {
				size: Math.round(parseFloat(cs.fontSize) / cell * 100) / 100,
				family: cs.fontFamily,
				upper: cs.textTransform === 'uppercase',
			};
			styles.set(parent, style);
		}
		const box = toCells(r);
		const str = style.upper ? el.textContent.toUpperCase() : el.textContent;
		const a = el.closest(LINKS);
		words.push({ x: box.x, y: box.y, g: glyph(str, style, box.w, box.h), a: a ? anchorOf.get(a) : null });
	}

	const collect = (sel) => [...document.querySelectorAll(sel)]
		.map((el) => ({ el, r: el.getBoundingClientRect() }))
		.filter((o) => visible(o.r));
	rules = collect('[data-rule]').map((o) => toCells(o.r));
	boxes = collect('[data-box]').map((o) => toCells(o.r));
	shelves = collect('[data-shelf]').map((o) => ({ ...toCells(o.r), k: parseFloat(o.el.dataset.shelf) || 0.14 }));
	hero = toCells(document.querySelector('.hero').getBoundingClientRect());

	if (kit) {
		const r = kit.el.getBoundingClientRect();
		kit.on = visible(r);
		if (kit.on) {
			const box = toCells(r);
			kit.x = box.x + box.w - kit.w;       /* stands in the corner of its box */
			kit.y = box.y + box.h - kit.h;
		}
	}

	const mark = document.querySelector('.mark').getBoundingClientRect();
	if (visible(mark)) buildFigure(toCells(mark));
	else fig = null;
}

/* --- The λ figure -------------------------------------------------- */

function buildFigure(box) {
	const key = box.w + 'x' + box.h;
	if (fig && figKey === key) {
		fig.x = box.x - fig.pl;
		fig.y = box.y - fig.pt;
		return;
	}
	figKey = key;

	/* Room around the glyph for the plume, which streams downwind. */
	const reach = Math.round(box.w * 1.25), drift = Math.round(reach * 0.45);
	const pl = WIND.x < 0 ? reach : 4, pr = WIND.x < 0 ? 4 : reach;
	const pt = WIND.y < 0 ? drift : 4, pb = WIND.y < 0 ? 4 : drift;
	const w = box.w + pl + pr, h = box.h + pt + pb;

	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	const g = c.getContext('2d', { willReadFrequently: true });
	const font = (size) => 'italic 400 ' + size + 'px "EB Garamond", Georgia, "Times New Roman", serif';
	g.font = font(100);
	const m = g.measureText('λ');
	const inkW = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
	const inkH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
	const k = Math.min(box.w / inkW, box.h / inkH);
	g.font = font(100 * k);
	g.fillStyle = g.strokeStyle = '#fff';
	g.textBaseline = 'alphabetic';
	g.lineJoin = 'round';
	g.lineWidth = Math.max(1.5, box.h * 0.024);   /* thicken the hairlines */
	const gx = pl + (box.w - inkW * k) / 2 + m.actualBoundingBoxLeft * k;
	const gy = pt + (box.h - inkH * k) / 2 + m.actualBoundingBoxAscent * k;
	g.fillText('λ', gx, gy);
	g.strokeText('λ', gx, gy);

	const data = g.getImageData(0, 0, w, h).data;
	const n = w * h;
	const mask = new Float32Array(n);
	for (let i = 0; i < n; i++) mask[i] = data[i * 4 + 3] / 255;

	const edge = new Uint8Array(n);
	for (let y = 1; y < h - 1; y++) {
		for (let x = 1; x < w - 1; x++) {
			const i = y * w + x;
			if (mask[i] > 0.5 && (mask[i - 1] <= 0.5 || mask[i + 1] <= 0.5 || mask[i - w] <= 0.5 || mask[i + w] <= 0.5)) edge[i] = 1;
		}
	}

	/* Smear the glyph downwind, one column at a time, fading as it goes.
	   This is where the plume is allowed to appear. */
	const smear = new Float32Array(n);
	const dir = WIND.x < 0 ? -1 : 1;                      /* columns are visited downwind */
	const slope = Math.abs(WIND.y / WIND.x);              /* rows drifted per column */
	const upwindRow = WIND.y > 0 ? -1 : 1;
	const decay = Math.exp(-1 / (box.w * 0.42));
	const first = dir > 0 ? 0 : w - 1;
	for (let y = 0; y < h; y++) smear[y * w + first] = mask[y * w + first];
	for (let x = first + dir; x >= 0 && x < w; x += dir) {
		for (let y = 0; y < h; y++) {
			const yn = y + upwindRow;
			const other = yn >= 0 && yn < h ? smear[yn * w + x - dir] : 0;
			const carried = (smear[y * w + x - dir] * (1 - slope) + other * slope) * decay;
			const i = y * w + x;
			smear[i] = mask[i] > carried ? mask[i] : carried;
		}
	}

	fig = {
		x: box.x - pl, y: box.y - pt, w, h, pl, pt, bw: box.w, bh: box.h,
		mask, edge, smear, tone: new Float32Array(n), cover: new Float32Array(n),
	};
	shadeFigure();
}

/* Tone of the figure for the current moment: a lit, modelled body with a
   hard outline, and a torn plume of dots streaming off it downwind. */
function shadeFigure() {
	if (!fig) return;
	const { w, h, pl, pt, bw, bh, mask, edge, smear, tone: ft, cover } = fig;
	const t = time;
	const z = 120 / bh;                /* noise was tuned on a figure 120 cells tall */
	const lee = WIND.x < 0 ? -1 : 1;
	for (let y = 0, i = 0; y < h; y++) {
		for (let x = 0; x < w; x++, i++) {
			const s = smear[i];
			if (s < 0.02) { ft[i] = 0; cover[i] = 0; continue; }
			const m = mask[i];
			let body = 0, plume = 0;
			if (m > 0) {
				const across = (x - pl) / bw;                  /* lit from upwind, above */
				const light = 1 - 0.55 * (lee < 0 ? 1 - across : across) - 0.25 * ((y - pt) / bh);
				const n = vnoise(x * z * 0.07 - lee * t * 0.5, y * z * 0.07 + t * 0.15);
				body = m * clamp(0.3 + 0.62 * light + 0.45 * (n - 0.5), 0.24, 1);
				if (edge[i]) body = 1;
			}
			if (m < 1) {
				const u = (x * WIND.x + y * WIND.y) * z, v = (y * WIND.x - x * WIND.y) * z;
				const n = 0.65 * vnoise(u * 0.028 - t * 1.0, v * 0.2 + t * 0.07)
					+ 0.35 * vnoise(u * 0.08 - t * 2.2, v * 0.5);
				plume = (1 - m) * Math.pow(s, 1.5) * smooth(0.32, 0.66, n) * 0.62;
			}
			ft[i] = body + plume;
			cover[i] = m > plume ? m : plume;
		}
	}
}

/* --- The kitten ----------------------------------------------------- */

/* Easter egg. A sprite sheet of the reference clip's twelve frames, dot for
   dot: red channel is the dot, alpha is the silhouette that hides whatever
   is behind it. One frame per tick, so it plays exactly as the clip does. */
const KITTEN_POSES = 12;

function loadKitten() {
	const el = document.querySelector('.kitten');
	if (!el) return;
	const img = new Image();
	img.onload = () => {
		try {
			const w = img.width / KITTEN_POSES, h = img.height;
			const c = document.createElement('canvas');
			c.width = img.width;
			c.height = h;
			const g = c.getContext('2d', { willReadFrequently: true });
			g.drawImage(img, 0, 0);
			const poses = [];
			for (let p = 0; p < KITTEN_POSES; p++) {
				const d = g.getImageData(p * w, 0, w, h).data;
				const dots = new Uint8Array(w * h), shape = new Uint8Array(w * h);
				for (let i = 0; i < dots.length; i++) {
					shape[i] = d[i * 4 + 3] > 127 ? 1 : 0;
					dots[i] = shape[i] && d[i * 4] > 127 ? 1 : 0;
				}
				/* The silhouette grown by two cells: a clear margin around the kitten. */
				const halo = new Uint8Array(w * h);
				for (let y = 0; y < h; y++) {
					for (let x = 0; x < w; x++) {
						if (!shape[y * w + x]) continue;
						for (let yy = Math.max(0, y - 2); yy <= Math.min(h - 1, y + 2); yy++) {
							for (let xx = Math.max(0, x - 2); xx <= Math.min(w - 1, x + 2); xx++) halo[yy * w + xx] = 1;
						}
					}
				}
				poses.push({ dots, halo });
			}
			kit = { el, w, h, poses, x: 0, y: 0, on: false };
			layoutDirty = true;
		} catch (err) { /* no kitten, no harm */ }
	};
	img.src = new URL('../assets/img/kitten.png', import.meta.url).href;
}

/* --- The wave field ------------------------------------------------ */

const sinX = new Float32Array(AMOUNT), sinY = new Float32Array(AMOUNT);

function addTone(x, y, v) {
	if (x >= 0 && y >= 0 && x < cols && y < rows) terrain[y * cols + x] += v;
}

function drawTerrain() {
	terrain.fill(0);
	/* Camera looks at the origin from (cam.x, cam.y, 1000). */
	const ex = cam.x, ey = cam.y, ez = 1000;
	const el = Math.hypot(ex, ey, ez);
	const fx = -ex / el, fy = -ey / el, fz = -ez / el;
	const rl = Math.hypot(fz, fx);
	const rx = -fz / rl, rz = fx / rl;                       /* right = forward x up */
	const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy; /* up = right x forward */
	const aspect = cols / rows;
	const half = (AMOUNT * SEPARATION) / 2;
	const sizeK = rows / 900;          /* skz.dev's point sizes, relative to viewport height */
	const rMax = 1.6 * unit;           /* near points stay dots, not blobs */

	for (let i = 0; i < AMOUNT; i++) {
		sinX[i] = Math.sin((i + count) * 0.3);
		sinY[i] = Math.sin((i + count) * 0.5);
	}
	for (let ix = 0; ix < AMOUNT; ix++) {
		const wx = ix * SEPARATION - half - ex;
		for (let iy = 0; iy < AMOUNT; iy++) {
			const dx = wx, dy = sinX[ix] * 50 + sinY[iy] * 50 - ey, dz = iy * SEPARATION - half - ez;
			const depth = dx * fx + dy * fy + dz * fz;
			if (depth < 160) continue;
			const sx = ((dx * rx + dz * rz) / (depth * FOV_TAN * aspect) * 0.5 + 0.5) * cols;
			const sy = (0.5 - (dx * ux + dy * uy + dz * uz) / (depth * FOV_TAN) * 0.5) * rows;
			const scale = (sinX[ix] + 1) * 8 + (sinY[iy] + 1) * 8;
			const r = Math.min(rMax, 0.5 * scale * (300 / depth) * sizeK);
			if (sx < -r || sy < -r || sx > cols + r || sy > rows + r) continue;
			const haze = 1 - smooth(1500, 6000, depth);   /* the far field dissolves */

			if (r < 0.6) {
				/* Smaller than a cell: add its area as tone, shared across four cells. */
				const a = Math.PI * r * r * 3.2 * haze;
				const x0 = Math.floor(sx - 0.5), y0 = Math.floor(sy - 0.5);
				const tx = sx - 0.5 - x0, ty = sy - 0.5 - y0;
				addTone(x0, y0, a * (1 - tx) * (1 - ty));
				addTone(x0 + 1, y0, a * tx * (1 - ty));
				addTone(x0, y0 + 1, a * (1 - tx) * ty);
				addTone(x0 + 1, y0 + 1, a * tx * ty);
			} else {
				const g = 1;
				const x0 = Math.max(0, Math.floor(sx - r - 1)), x1 = Math.min(cols - 1, Math.ceil(sx + r + 1));
				const y0 = Math.max(0, Math.floor(sy - r - 1)), y1 = Math.min(rows - 1, Math.ceil(sy + r + 1));
				for (let y = y0; y <= y1; y++) {
					for (let x = x0; x <= x1; x++) {
						const c = r + 0.5 - Math.hypot(x + 0.5 - sx, y + 0.5 - sy);
						if (c > 0) terrain[y * cols + x] += (c > 1 ? 1 : c) * g;
					}
				}
			}
		}
	}
}

function easeCamera(k) {
	cam.x += (mouseX + 200 - cam.x) * k;
	cam.y += (Math.max(-mouseY + 200, 120) - cam.y) * k;
}

/* --- Wind streaks -------------------------------------------------- */

function seedStreaks() {
	const n = Math.round((cols * rows) / (300 * unit * unit));
	streakPad = Math.ceil(52 * unit);
	streaks = [];
	for (let i = 0; i < n; i++) {
		const long = Math.random() < 0.3;
		const len = (long ? 12 + Math.random() * 34 : 2 + Math.random() * 9) * unit;
		const a = (WIND_DEG + (Math.random() - 0.5) * 7) * Math.PI / 180;
		streaks.push({
			x: Math.random() * (cols + 2 * streakPad),
			y: Math.random() * (rows + 2 * streakPad),
			len,
			dx: Math.cos(a), dy: -Math.sin(a),
			speed: (13 + Math.random() * 9) * unit + len * 0.25,
			gap: Math.random() < 0.45 ? 2 + ((Math.random() * 3) | 0) : 0,   /* some are dotted */
			show: Math.random(),
		});
	}
}

function moveStreaks() {
	const W = cols + 2 * streakPad, H = rows + 2 * streakPad;
	for (const s of streaks) {
		s.x -= s.dx * s.speed;         /* down the line: left, and a little down */
		s.y -= s.dy * s.speed;
		if (s.x < 0) s.x += W;
		if (s.y >= H) s.y -= H;
	}
}

function drawStreaks() {
	for (const s of streaks) {
		/* Fewer in the sky than near the ground. */
		if (s.show > 0.3 + 0.7 * clamp((s.y - streakPad) / rows, 0, 1)) continue;
		for (let k = 0; k < s.len; k++) {
			if (s.gap && k % s.gap) continue;
			const x = Math.round(s.x - streakPad + s.dx * k), y = Math.round(s.y - streakPad + s.dy * k);
			if (x >= 0 && y >= 0 && x < cols && y < rows && !quiet[y * cols + x]) out[y * cols + x] = 1;
		}
	}
}

/* --- Tone -> bits --------------------------------------------------- */

function buildBits() {
	const oy = Math.round(window.scrollY / cell);
	const gain = reveal < 1 ? reveal * reveal : 1;

	/* Terrain, under loose grit that thickens toward the ground. */
	const gx = jx * 7919, gy = jy * 6151;
	for (let y = 0, i = 0; y < rows; y++) {
		const grit = (0.007 + 0.075 * smooth(0.3, 1, y / rows)) * gain;
		for (let x = 0; x < cols; x++, i++) {
			const v = terrain[i];
			tone[i] = hash2(x + gx, y + gy) < grit ? 1 : (v > 0.92 ? 0.92 : v) * gain;
		}
	}

	/* The figure stands in front of the field. */
	if (fig) {
		const top = fig.y - oy;
		const x0 = Math.max(0, fig.x), x1 = Math.min(cols, fig.x + fig.w);
		const y0 = Math.max(0, top), y1 = Math.min(rows, top + fig.h);
		for (let y = y0; y < y1; y++) {
			for (let x = x0; x < x1; x++) {
				const j = (y - top) * fig.w + (x - fig.x);
				const c = fig.cover[j];
				if (c <= 0) continue;
				const i = y * cols + x;
				const v = tone[i] * (1 - c) + fig.tone[j] * gain;
				tone[i] = v > 1 ? 1 : v;
			}
		}
	}

	/* Quieten the field behind text, and keep the wind out of it. */
	const F = Math.round(9 * unit), core = Math.round(4 * unit);
	quiet.fill(0);
	for (const s of shelves) {
		const top = s.y - oy;
		const x0 = Math.max(0, s.x - F), x1 = Math.min(cols, s.x + s.w + F);
		const y0 = Math.max(0, top - F), y1 = Math.min(rows, top + s.h + F);
		for (let y = y0; y < y1; y++) {
			const dy = y < top ? top - y : y >= top + s.h ? y - (top + s.h) + 1 : 0;
			for (let x = x0; x < x1; x++) {
				const dx = x < s.x ? s.x - x : x >= s.x + s.w ? x - (s.x + s.w) + 1 : 0;
				const d = dx > dy ? dx : dy;
				const i = y * cols + x;
				if (d < core) {
					quiet[i] = 1;
					if (tone[i] === 1) tone[i] = 0;        /* no grit between words */
				}
				tone[i] *= s.k + (1 - s.k) * (d / F) * (d / F);
			}
		}
	}

	/* Serpentine Floyd-Steinberg, with the threshold jittered so the grain
	   shimmers from tick to tick instead of settling into worms. */
	work.set(tone);
	const w = cols, h = rows;
	for (let y = 0; y < h; y++) {
		const row = y * w, down = y + 1 < h;
		const trow = ((y + jy) & 63) << 6;
		if (y & 1) {
			for (let x = w - 1; x >= 0; x--) {
				const i = row + x, v = work[i];
				const on = v > 0.5 + (tile[trow + ((x + jx) & 63)] - 0.5) * 0.5 ? 1 : 0;
				bits[i] = on;
				const e = v - on;
				if (x > 0) work[i - 1] += e * 0.4375;
				if (down) {
					if (x + 1 < w) work[i + w + 1] += e * 0.1875;
					work[i + w] += e * 0.3125;
					if (x > 0) work[i + w - 1] += e * 0.0625;
				}
			}
		} else {
			for (let x = 0; x < w; x++) {
				const i = row + x, v = work[i];
				const on = v > 0.5 + (tile[trow + ((x + jx) & 63)] - 0.5) * 0.5 ? 1 : 0;
				bits[i] = on;
				const e = v - on;
				if (x + 1 < w) work[i + 1] += e * 0.4375;
				if (down) {
					if (x > 0) work[i + w - 1] += e * 0.1875;
					work[i + w] += e * 0.3125;
					if (x + 1 < w) work[i + w + 1] += e * 0.0625;
				}
			}
		}
	}
}

/* --- Final frame ---------------------------------------------------- */

function fill(x, y, w, h, v, dotted) {
	const x0 = Math.max(0, x), x1 = Math.min(cols, x + w);
	const y0 = Math.max(0, y), y1 = Math.min(rows, y + h);
	for (let yy = y0; yy < y1; yy++) {
		for (let xx = x0; xx < x1; xx++) {
			if (dotted && ((xx + yy) & 1)) continue;
			out[yy * cols + xx] = v;
		}
	}
}

function stamp(bitmap, bw, bh, x, y, v, dissolve) {
	const x0 = Math.max(0, x), x1 = Math.min(cols, x + bw);
	const y0 = Math.max(0, y), y1 = Math.min(rows, y + bh);
	for (let yy = y0; yy < y1; yy++) {
		const src = (yy - y) * bw - x, dst = yy * cols;
		for (let xx = x0; xx < x1; xx++) {
			if (!bitmap[src + xx]) continue;
			if (dissolve && tile[((yy & 63) << 6) + (xx & 63)] > reveal) continue;
			out[dst + xx] = v;
		}
	}
}

function compose() {
	const oy = Math.round(window.scrollY / cell);
	out.set(bits);
	drawStreaks();

	/* Corner fiducials of the hero, the rule, the card outline, underlines. */
	if (hero) {
		const inset = Math.round(3 * unit), arm = Math.round(7 * unit);
		const l = hero.x + inset, r = hero.x + hero.w - inset - 1;
		const t = hero.y - oy + inset, b = hero.y - oy + hero.h - inset - 1;
		fill(l, t, arm, 1, 1); fill(l, t, 1, arm, 1);
		fill(r - arm + 1, t, arm, 1, 1); fill(r, t, 1, arm, 1);
		fill(l, b, arm, 1, 1); fill(l, b - arm + 1, 1, arm, 1);
		fill(r - arm + 1, b, arm, 1, 1); fill(r, b - arm + 1, 1, arm, 1);
	}
	for (const r of rules) fill(r.x, r.y - oy, r.w, r.h, 1);
	for (const r of boxes) {
		const y = r.y - oy;
		fill(r.x, y, r.w, r.h, 0);
		fill(r.x, y, r.w, 1, 1, true); fill(r.x, y + r.h - 1, r.w, 1, 1, true);
		fill(r.x, y, 1, r.h, 1, true); fill(r.x + r.w - 1, y, 1, r.h, 1, true);
	}

	/* The kitten, in front of the weather. */
	if (kit && kit.on) {
		const pose = kit.poses[reduce.matches ? 0 : tick % KITTEN_POSES];
		stamp(pose.halo, kit.w, kit.h, kit.x, kit.y - oy, 0, false);
		stamp(pose.dots, kit.w, kit.h, kit.x, kit.y - oy, 1, false);
	}

	/* Type. Clear a black slot behind every word first, then light it. A link
	   under the pointer or keyboard focus is drawn inverted. */
	const hot = (a) => a && (a.el === hoverEl || a.el === focusEl);
	const dissolve = reveal < 1;
	for (const wd of words) fill(wd.x - 4, wd.y - oy, wd.g.w + 8, wd.g.h, 0);
	for (const a of anchors) {
		if (hot(a)) for (const r of a.rects) fill(r.x - 3, r.y - oy - 1, r.w + 6, r.h + 2, 1);
		else if (a.underline) for (const r of a.rects) fill(r.x, r.y - oy + r.h - 1, r.w, 1, 1);
	}
	for (const wd of words) {
		const y = wd.y - oy;
		if (y >= rows || y + wd.g.h < 0) continue;
		stamp(wd.g.b, wd.g.w, wd.g.h, wd.x, y, hot(wd.a) ? 0 : 1, dissolve);
	}

	for (let i = 0; i < out.length; i++) px[i] = out[i] ? RED : BLACK;
	ctx.putImageData(image, 0, 0);
}

/* --- Sizing --------------------------------------------------------- */

function resize() {
	const vw = root.clientWidth, vh = window.innerHeight;
	const dpr = window.devicePixelRatio || 1;
	/* 2 px dots (1.5 px on phones), never more than about 1100 across, and always
	   a whole number of device pixels so every dot is the same size. */
	const want = vw < 600 ? 1.5 : Math.max(2, Math.ceil(vw / 1100));
	cell = Math.max(1, Math.round(want * dpr)) / dpr;
	unit = 3 / cell;
	root.style.setProperty('--c', cell + 'px');

	const c = Math.ceil(vw / cell), r = Math.ceil(vh / cell);
	if (c !== cols || r !== rows) {
		cols = c;
		rows = r;
		canvas.width = cols;
		canvas.height = rows;
		image = ctx.createImageData(cols, rows);
		px = new Uint32Array(image.data.buffer);
		const n = cols * rows;
		tone = new Float32Array(n);
		work = new Float32Array(n);
		terrain = new Float32Array(n);
		bits = new Uint8Array(n);
		out = new Uint8Array(n);
		quiet = new Uint8Array(n);
		seedStreaks();
	}
	canvas.style.width = cols * cell + 'px';
	canvas.style.height = rows * cell + 'px';
	drawTerrain();
}

/* --- Loop ----------------------------------------------------------- */

function stepScene() {
	count += 0.25;
	time += 1 / 12;
	easeCamera(0.22);
	jx = (Math.random() * 64) | 0;
	jy = (Math.random() * 64) | 0;
	drawTerrain();
	shadeFigure();
}

function frame(now) {
	requestAnimationFrame(frame);

	if (sizeDirty) {
		resize();
		sizeDirty = false;
		layoutDirty = toneDirty = true;
	}
	if (layoutDirty) {
		layout();
		layoutDirty = false;
		toneDirty = true;
	}

	if (!reduce.matches && now - lastTick >= TICK) {
		lastTick = now - lastTick > TICK * 4 ? now : lastTick + TICK;
		tick++;
		moveStreaks();
		if (reveal < 1) {
			reveal = Math.min(1, reveal + 1 / 30);
			toneDirty = true;
		}
		if (tick & 1) {
			stepScene();
			toneDirty = true;
		}
		paintDirty = true;
	}

	const sy = window.scrollY;
	if (sy !== lastScroll) {
		lastScroll = sy;
		toneDirty = true;
	}

	if (toneDirty) {
		buildBits();
		toneDirty = false;
		paintDirty = true;
	}
	if (paintDirty) {
		compose();
		paintDirty = false;
	}
}

function settle() {
	/* No motion: show the finished picture at once. */
	reveal = 1;
	easeCamera(1);
	drawTerrain();
	shadeFigure();
	toneDirty = true;
}

function refont() {
	glyphs.clear();
	figKey = '';
	fig = null;
	layoutDirty = true;
}

async function init() {
	wrapWords(document.querySelector('main'));

	const fonts = document.fonts;
	await Promise.race([
		Promise.all([
			fonts.load('11px "Departure Mono"'),
			fonts.load('italic 400 64px "EB Garamond"', 'λ'),
		]).catch(() => {}),
		new Promise((done) => setTimeout(done, 2500)),
	]);

	resize();
	layout();
	sizeDirty = layoutDirty = false;
	if (reduce.matches) settle();
	root.classList.add('dots');
	root.classList.remove('nodots');

	window.addEventListener('resize', () => { sizeDirty = true; });
	new ResizeObserver(() => { layoutDirty = true; }).observe(document.querySelector('main'));
	fonts.addEventListener('loadingdone', refont);
	reduce.addEventListener('change', () => { if (reduce.matches) settle(); });

	window.addEventListener('pointermove', (e) => {
		mouseX = e.clientX - window.innerWidth / 2;
		mouseY = e.clientY - window.innerHeight / 2;
	}, { passive: true });

	const link = (node) => (node instanceof Element ? node.closest(LINKS) : null);
	document.addEventListener('pointerover', (e) => { hoverEl = link(e.target); paintDirty = true; });
	document.addEventListener('pointerout', (e) => { if (!link(e.relatedTarget)) { hoverEl = null; paintDirty = true; } });
	document.addEventListener('focusin', (e) => {
		const a = link(e.target);
		focusEl = a && a.matches(':focus-visible') ? a : null;
		paintDirty = true;
	});
	document.addEventListener('focusout', () => { focusEl = null; paintDirty = true; });

	loadKitten();
	requestAnimationFrame(frame);
}

init().catch((err) => {
	/* Fall back to the plain page. */
	root.classList.remove('dots');
	root.classList.add('nodots');
	console.error(err);
});
