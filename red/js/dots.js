/* ===================================================================
   skz.dev, red dots edition: the renderer.

   The DOM lays the page out and carries the real text and links.
   This module paints every visible pixel onto one low-resolution
   canvas whose cells are either red or black.

   Slow layers, redrawn 24 times a second and kept until the next time:
     ground  the sine wave field and loose grit, dithered to 1 bit
     figure  the λ and the plume streaming off it, dithered to 1 bit

   Every display frame, composed from those (so scrolling and the wind
   stay smooth and cost almost nothing):
     ground -> figure -> wind streaks -> quiet zones behind text
            -> rules and corners -> kitten -> type
   =================================================================== */

const RED = 0xff0000ff;            /* #ff0000, as little-endian ABGR */
const BLACK = 0xff000000;
const SCENE_HZ = 24;               /* how often the dithered layers are redrawn */
const KITTEN_FPS = 24;             /* the reference clip's frame rate */
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
const params = new URLSearchParams(location.search);
const PERF = params.has('perf');               /* ?perf logs frame costs to the console */
const FORCED_CELL = +params.get('cell') || 0; /* ?cell=3 fixes the dot size; tools/og-card.html uses it */

/* 64x64 tile of uniform noise: dither jitter, thinning, and the intro dissolve. */
const tile = new Float32Array(4096);
for (let i = 0; i < 4096; i++) tile[i] = Math.random();

let cell = 2, cols = 0, rows = 0;
let unit = 1.5;                    /* cells per 3 px; lengths tuned on a 3 px grid are multiplied by it */
let streakPad = 80;
let image, px;                     /* the frame, as 32-bit pixels */
let base;                          /* the dithered ground, as 32-bit pixels */
let terrain, work;                 /* tone buffers */
let words = [], anchors = [], rules = [], shelves = [], boxes = [], hero = null;
let fig = null, figKey = '';
let kit = null;                    /* the kitten: { el, w, h, poses, x, y, on } */
let streaks = [];
let probe = null;                  /* measures the tallest the viewport gets (mobile toolbars hidden) */
let last = 0, sceneClock = 0, lastScroll = -1;
let reveal = 0, count = 0, time = 0, jx = 0, jy = 0;
let sizeDirty = true, layoutDirty = true, sceneDirty = true, paintDirty = true;
let mouseX = 0, mouseY = 0;
const cam = { x: 200, y: 2000 };   /* starts high and settles, as on skz.dev */
let hoverEl = null, focusEl = null;
const perf = { scene: 0, frame: 0, n: 0 };

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

/* Serpentine Floyd-Steinberg from a tone buffer (consumed) to pixels. The
   threshold is jittered so the grain shimmers instead of settling into worms. */
function dither(src, dst, w, h, off) {
	for (let y = 0; y < h; y++) {
		const row = y * w, down = y + 1 < h;
		const trow = ((y + jy) & 63) << 6;
		if (y & 1) {
			for (let x = w - 1; x >= 0; x--) {
				const i = row + x, v = src[i];
				const on = v > 0.5 + (tile[trow + ((x + jx) & 63)] - 0.5) * 0.5;
				dst[i] = on ? RED : off;
				if (v === 0) continue;                 /* nothing to carry */
				const e = on ? v - 1 : v;
				if (x > 0) src[i - 1] += e * 0.4375;
				if (down) {
					if (x + 1 < w) src[i + w + 1] += e * 0.1875;
					src[i + w] += e * 0.3125;
					if (x > 0) src[i + w - 1] += e * 0.0625;
				}
			}
		} else {
			for (let x = 0; x < w; x++) {
				const i = row + x, v = src[i];
				const on = v > 0.5 + (tile[trow + ((x + jx) & 63)] - 0.5) * 0.5;
				dst[i] = on ? RED : off;
				if (v === 0) continue;
				const e = on ? v - 1 : v;
				if (x + 1 < w) src[i + 1] += e * 0.4375;
				if (down) {
					if (x > 0) src[i + w - 1] += e * 0.1875;
					src[i + w] += e * 0.3125;
					if (x + 1 < w) src[i + w + 1] += e * 0.0625;
				}
			}
		}
	}
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

	/* Links are drawn from the words inside them: one run per line of text. */
	anchors = [];
	const anchorOf = new Map();
	for (const el of document.querySelectorAll(LINKS)) {
		const a = { el, lines: [], underline: !!el.closest('.about-body') };
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
		const link = el.closest(LINKS);
		const a = link ? anchorOf.get(link) : null;
		words.push({ x: box.x, y: box.y, g: glyph(str, style, box.w, box.h), a });
		if (a) {
			const line = a.lines.find((l) => l.y === box.y);
			if (line) {
				line.x0 = Math.min(line.x0, box.x);
				line.x1 = Math.max(line.x1, box.x + box.w);
			} else {
				a.lines.push({ y: box.y, h: box.h, x0: box.x, x1: box.x + box.w });
			}
		}
	}

	const collect = (sel) => [...document.querySelectorAll(sel)]
		.map((el) => ({ el, r: el.getBoundingClientRect() }))
		.filter((o) => visible(o.r));
	rules = collect('[data-rule]').map((o) => toCells(o.r));
	boxes = collect('[data-box]').map((o) => toCells(o.r));
	shelves = collect('[data-shelf]').map((o) => toCells(o.r));
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

	/* Everything about a cell that does not change from moment to moment. */
	const lee = dir;
	const lit = new Float32Array(n);      /* body: how much light falls on it (from upwind, above) */
	const amp = new Float32Array(n);      /* plume: how strong it can get here; -1 = nothing here */
	for (let y = 0, i = 0; y < h; y++) {
		for (let x = 0; x < w; x++, i++) {
			const s = smear[i];
			if (s < 0.02) { amp[i] = -1; continue; }
			const across = (x - pl) / box.w;
			lit[i] = 0.3 + 0.62 * (1 - 0.55 * (lee < 0 ? 1 - across : across) - 0.25 * ((y - pt) / box.h));
			amp[i] = (1 - mask[i]) * Math.pow(s, 1.5) * 0.62;
		}
	}

	fig = {
		x: box.x - pl, y: box.y - pt, w, h, pl, pt, bh: box.h, lee,
		mask, edge, lit, amp,
		tone: new Float32Array(n), cover: new Float32Array(n), bits: new Uint32Array(n),
	};
}

/* The figure for the current moment: a lit, modelled body with a hard
   outline, and a torn plume of dots streaming off it downwind. */
function drawFigure() {
	if (!fig) return;
	const { w, h, bh, lee, mask, edge, lit, amp, tone, cover, bits } = fig;
	const t = time;
	const z = 120 / bh;                /* noise was tuned on a figure 120 cells tall */
	const gain = reveal < 1 ? reveal * reveal : 1;
	const wx = WIND.x * z, wy = WIND.y * z;
	for (let y = 0, i = 0; y < h; y++) {
		for (let x = 0; x < w; x++, i++) {
			const a = amp[i];
			if (a < 0) { tone[i] = 0; cover[i] = 0; continue; }
			const m = mask[i];
			let body = 0, plume = 0;
			if (m > 0) {
				if (edge[i]) body = 1;
				else {
					const n = vnoise(x * z * 0.07 - lee * t * 0.5, y * z * 0.07 + t * 0.15);
					body = m * clamp(lit[i] + 0.45 * (n - 0.5), 0.24, 1);
				}
			}
			if (a > 0.004) {
				const u = x * wx + y * wy, v = y * wx - x * wy;
				const n = 0.65 * vnoise(u * 0.028 - t * 1.0, v * 0.2 + t * 0.07)
					+ 0.35 * vnoise(u * 0.08 - t * 2.2, v * 0.5);
				plume = a * smooth(0.32, 0.66, n);
			}
			tone[i] = (body + plume) * gain;
			cover[i] = m > plume ? m : plume;
		}
	}
	dither(tone, bits, w, h, 0);
}

/* --- The kitten ----------------------------------------------------- */

/* Easter egg. A sprite sheet of the reference clip's twelve frames, dot for
   dot: red channel is the dot, alpha is the silhouette that hides whatever
   is behind it. Played at the clip's own frame rate. */
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

/* --- The ground: wave field and grit -------------------------------- */

const sinX = new Float32Array(AMOUNT), sinY = new Float32Array(AMOUNT);

function addTone(x, y, v) {
	if (x >= 0 && y >= 0 && x < cols && y < rows) terrain[y * cols + x] += v;
}

function drawGround() {
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
		const dx = ix * SEPARATION - half - ex;
		for (let iy = 0; iy < AMOUNT; iy++) {
			const dy = sinX[ix] * 50 + sinY[iy] * 50 - ey, dz = iy * SEPARATION - half - ez;
			const depth = dx * fx + dy * fy + dz * fz;
			if (depth < 160) continue;
			const sx = ((dx * rx + dz * rz) / (depth * FOV_TAN * aspect) * 0.5 + 0.5) * cols;
			const sy = (0.5 - (dx * ux + dy * uy + dz * uz) / (depth * FOV_TAN) * 0.5) * rows;
			const scale = (sinX[ix] + 1) * 8 + (sinY[iy] + 1) * 8;
			const r = Math.min(rMax, 0.5 * scale * (300 / depth) * sizeK);
			if (sx < -r || sy < -r || sx > cols + r || sy > rows + r) continue;

			if (r < 0.6) {
				/* Smaller than a cell: add its area as tone, shared across four cells.
				   The far field dissolves into haze. */
				const a = Math.PI * r * r * 3.2 * (1 - smooth(1500, 6000, depth));
				const x0 = Math.floor(sx - 0.5), y0 = Math.floor(sy - 0.5);
				const tx = sx - 0.5 - x0, ty = sy - 0.5 - y0;
				addTone(x0, y0, a * (1 - tx) * (1 - ty));
				addTone(x0 + 1, y0, a * tx * (1 - ty));
				addTone(x0, y0 + 1, a * (1 - tx) * ty);
				addTone(x0 + 1, y0 + 1, a * tx * ty);
			} else {
				const x0 = Math.max(0, Math.floor(sx - r - 1)), x1 = Math.min(cols - 1, Math.ceil(sx + r + 1));
				const y0 = Math.max(0, Math.floor(sy - r - 1)), y1 = Math.min(rows - 1, Math.ceil(sy + r + 1));
				for (let y = y0; y <= y1; y++) {
					for (let x = x0; x <= x1; x++) {
						const c = r + 0.5 - Math.hypot(x + 0.5 - sx, y + 0.5 - sy);
						if (c > 0) terrain[y * cols + x] += c > 1 ? 1 : c;
					}
				}
			}
		}
	}

	/* Terrain under loose grit that thickens toward the ground, then to dots. */
	const gain = reveal < 1 ? reveal * reveal : 1;
	const gx = jx * 7919, gy = jy * 6151;
	for (let y = 0, i = 0; y < rows; y++) {
		const grit = (0.007 + 0.075 * smooth(0.3, 1, y / rows)) * gain;
		for (let x = 0; x < cols; x++, i++) {
			const v = terrain[i];
			work[i] = hash2(x + gx, y + gy) < grit ? 1 : (v > 0.92 ? 0.92 : v) * gain;
		}
	}
	dither(work, base, cols, rows, BLACK);
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
			speed: ((13 + Math.random() * 9) * unit + len * 0.25) * 24,     /* cells per second */
			gap: Math.random() < 0.45 ? 2 + ((Math.random() * 3) | 0) : 0,  /* some are dotted */
			show: Math.random(),
		});
	}
}

function moveStreaks(dt) {
	const W = cols + 2 * streakPad, H = rows + 2 * streakPad;
	for (const s of streaks) {
		s.x -= s.dx * s.speed * dt;    /* down the line: left, and a little down */
		s.y -= s.dy * s.speed * dt;
		if (s.x < 0) s.x += W;
		if (s.y >= H) s.y -= H;
	}
}

function paintStreaks() {
	for (const s of streaks) {
		/* Fewer in the sky than near the ground. */
		if (s.show > 0.3 + 0.7 * clamp((s.y - streakPad) / rows, 0, 1)) continue;
		for (let k = 0; k < s.len; k++) {
			if (s.gap && k % s.gap) continue;
			const x = Math.round(s.x - streakPad + s.dx * k), y = Math.round(s.y - streakPad + s.dy * k);
			if (x >= 0 && y >= 0 && x < cols && y < rows) px[y * cols + x] = RED;
		}
	}
}

/* --- The frame ------------------------------------------------------ */

function fill(x, y, w, h, color, dotted) {
	const x0 = Math.max(0, x), x1 = Math.min(cols, x + w);
	const y0 = Math.max(0, y), y1 = Math.min(rows, y + h);
	for (let yy = y0; yy < y1; yy++) {
		const row = yy * cols;
		if (dotted) {
			for (let xx = x0; xx < x1; xx++) if (!((xx + yy) & 1)) px[row + xx] = color;
		} else if (x1 > x0) {
			px.fill(color, row + x0, row + x1);
		}
	}
}

function stamp(bitmap, bw, bh, x, y, color, dissolve) {
	const x0 = Math.max(0, x), x1 = Math.min(cols, x + bw);
	const y0 = Math.max(0, y), y1 = Math.min(rows, y + bh);
	for (let yy = y0; yy < y1; yy++) {
		const src = (yy - y) * bw - x, dst = yy * cols;
		for (let xx = x0; xx < x1; xx++) {
			if (!bitmap[src + xx]) continue;
			if (dissolve && tile[((yy & 63) << 6) + (xx & 63)] > reveal) continue;
			px[dst + xx] = color;
		}
	}
}

/* Remove a share of the lit cells in a span: 0 keeps nothing, 1 keeps all. */
function thin(y, x0, x1, keep) {
	const row = y * cols, trow = (y & 63) << 6;
	for (let x = x0; x < x1; x++) {
		if (px[row + x] !== BLACK && tile[trow + (x & 63)] > keep) px[row + x] = BLACK;
	}
}

function paintFigure(oy) {
	const top = fig.y - oy;
	const x0 = Math.max(0, fig.x), x1 = Math.min(cols, fig.x + fig.w);
	const y0 = Math.max(0, top), y1 = Math.min(rows, top + fig.h);
	const { bits, cover, w } = fig;
	for (let y = y0; y < y1; y++) {
		const src = (y - top) * w - fig.x, dst = y * cols, trow = (y & 63) << 6;
		for (let x = x0; x < x1; x++) {
			const j = src + x;
			if (bits[j]) px[dst + x] = RED;
			else if (cover[j] > tile[trow + (x & 63)]) px[dst + x] = BLACK;   /* it stands in front of the field */
		}
	}
}

/* Keep the field and the wind out from behind text: black right around
   each block, fading back in over a few cells. */
function paintShelves(oy) {
	const F = Math.round(9 * unit), core = Math.round(4 * unit);
	for (const s of shelves) {
		const top = s.y - oy;
		if (top - F >= rows || top + s.h + F <= 0) continue;
		fill(s.x - core, top - core, s.w + 2 * core, s.h + 2 * core, BLACK);
		const xa = Math.max(0, s.x - F), xb = Math.min(cols, s.x + s.w + F);
		const y0 = Math.max(0, top - F), y1 = Math.min(rows, top + s.h + F);
		for (let y = y0; y < y1; y++) {
			const dy = y < top ? top - y : y >= top + s.h ? y - (top + s.h) + 1 : 0;
			if (dy > core) {
				/* Above or below the block: the whole row, by distance from the block. */
				const k = (dy - core) / (F - core);
				thin(y, xa, xb, k * k);
				continue;
			}
			for (let d = core + 1; d <= F; d++) {
				const k = (d - core) / (F - core);
				const l = s.x - d, r = s.x + s.w + d - 1;
				if (l >= 0 && l < cols) thin(y, l, l + 1, k * k);
				if (r >= 0 && r < cols) thin(y, r, r + 1, k * k);
			}
		}
	}
}

function compose(now) {
	const oy = Math.round(window.scrollY / cell);
	px.set(base);
	if (fig) paintFigure(oy);
	paintStreaks();
	paintShelves(oy);

	/* Corner fiducials of the hero, the rule, the card. */
	if (hero) {
		const inset = Math.round(3 * unit), arm = Math.round(7 * unit);
		const l = hero.x + inset, r = hero.x + hero.w - inset - 1;
		const t = hero.y - oy + inset, b = hero.y - oy + hero.h - inset - 1;
		fill(l, t, arm, 1, RED); fill(l, t, 1, arm, RED);
		fill(r - arm + 1, t, arm, 1, RED); fill(r, t, 1, arm, RED);
		fill(l, b, arm, 1, RED); fill(l, b - arm + 1, 1, arm, RED);
		fill(r - arm + 1, b, arm, 1, RED); fill(r, b - arm + 1, 1, arm, RED);
	}
	for (const r of rules) fill(r.x, r.y - oy, r.w, r.h, RED);
	for (const r of boxes) {
		const y = r.y - oy;
		if (y >= rows || y + r.h <= 0) continue;
		fill(r.x, y, r.w, r.h, BLACK);
		fill(r.x, y, r.w, 1, RED, true); fill(r.x, y + r.h - 1, r.w, 1, RED, true);
		fill(r.x, y, 1, r.h, RED, true); fill(r.x + r.w - 1, y, 1, r.h, RED, true);
	}

	/* The kitten, in front of the weather. */
	if (kit && kit.on) {
		const y = kit.y - oy;
		if (y < rows && y + kit.h > 0) {
			const pose = kit.poses[reduce.matches ? 0 : Math.floor(now / 1000 * KITTEN_FPS) % KITTEN_POSES];
			stamp(pose.halo, kit.w, kit.h, kit.x, y, BLACK, false);
			stamp(pose.dots, kit.w, kit.h, kit.x, y, RED, false);
		}
	}

	/* Type. Clear a black slot behind every word first, then light it. A link
	   under the pointer, a finger or keyboard focus is drawn inverted. */
	const hot = (a) => a && (a.el === hoverEl || a.el === focusEl);
	const dissolve = reveal < 1;
	for (const wd of words) {
		const y = wd.y - oy;
		if (y < rows && y + wd.g.h > 0) fill(wd.x - 4, y, wd.g.w + 8, wd.g.h, BLACK);
	}
	for (const a of anchors) {
		if (hot(a)) for (const l of a.lines) fill(l.x0 - 3, l.y - oy - 1, l.x1 - l.x0 + 6, l.h + 2, RED);
		else if (a.underline) for (const l of a.lines) fill(l.x0, l.y - oy + l.h - 1, l.x1 - l.x0, 1, RED);
	}
	for (const wd of words) {
		const y = wd.y - oy;
		if (y >= rows || y + wd.g.h <= 0) continue;
		stamp(wd.g.b, wd.g.w, wd.g.h, wd.x, y, hot(wd.a) ? BLACK : RED, dissolve);
	}

	ctx.putImageData(image, 0, 0);
}

/* --- Sizing --------------------------------------------------------- */

function resize() {
	const vw = root.clientWidth;
	/* The tallest the viewport gets. On phones the browser's toolbars slide
	   away while scrolling; sizing to the tall case means that never forces
	   the canvas to be rebuilt mid-scroll. */
	const vh = Math.max(window.innerHeight, probe ? probe.offsetHeight : 0);
	const dpr = window.devicePixelRatio || 1;
	/* 2 px dots (1.5 px on phones), never more than about 1100 across, and always
	   a whole number of device pixels so every dot is the same size. */
	const want = FORCED_CELL || (vw < 600 ? 1.5 : Math.max(2, Math.ceil(vw / 1100)));
	cell = Math.max(1, Math.round(want * dpr)) / dpr;
	unit = 3 / cell;
	root.style.setProperty('--c', cell + 'px');

	const c = Math.ceil(vw / cell), r = Math.ceil(vh / cell);
	/* A slightly shorter viewport (a toolbar sliding in) is not worth rebuilding for. */
	const fits = c === cols && r <= rows && r >= rows * 0.7;
	if (!fits) {
		cols = c;
		rows = r;
		canvas.width = cols;
		canvas.height = rows;
		image = ctx.createImageData(cols, rows);
		px = new Uint32Array(image.data.buffer);
		const n = cols * rows;
		base = new Uint32Array(n);
		terrain = new Float32Array(n);
		work = new Float32Array(n);
		seedStreaks();
		sceneDirty = true;
	}
	canvas.style.width = cols * cell + 'px';
	canvas.style.height = rows * cell + 'px';
}

/* --- Loop ----------------------------------------------------------- */

function drawScene() {
	const t0 = PERF ? performance.now() : 0;
	jx = (Math.random() * 64) | 0;
	jy = (Math.random() * 64) | 0;
	drawGround();
	drawFigure();
	if (PERF) perf.scene += performance.now() - t0;
}

function frame(now) {
	requestAnimationFrame(frame);
	const t0 = PERF ? performance.now() : 0;
	const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
	last = now;

	if (sizeDirty) {
		resize();
		sizeDirty = false;
		layoutDirty = true;
	}
	if (layoutDirty) {
		const had = fig;
		layout();
		layoutDirty = false;
		if (fig !== had) sceneDirty = true;
		paintDirty = true;
	}

	if (!reduce.matches) {
		moveStreaks(dt);
		if (reveal < 1) reveal = Math.min(1, reveal + dt / 1.25);
		sceneClock += dt;
		if (sceneClock >= 1 / SCENE_HZ) {
			sceneClock = sceneClock > 3 / SCENE_HZ ? 0 : sceneClock - 1 / SCENE_HZ;
			count += 3 / SCENE_HZ;             /* the wave rolls as fast as on skz.dev */
			time += 1 / SCENE_HZ;
			easeCamera(0.12);
			sceneDirty = true;
		}
		paintDirty = true;
	}

	const sy = window.scrollY;
	if (sy !== lastScroll) {
		lastScroll = sy;
		paintDirty = true;
	}

	if (sceneDirty) {
		drawScene();
		sceneDirty = false;
		paintDirty = true;
	}
	if (paintDirty) {
		compose(now);
		paintDirty = false;
	}

	if (PERF) {
		perf.frame += performance.now() - t0;
		if (++perf.n === 120) {
			console.log('dots ' + cols + 'x' + rows + ': ' + (perf.frame / 120).toFixed(2) + ' ms per frame, of which scene '
				+ (perf.scene / 120).toFixed(2) + ' ms');
			perf.scene = perf.frame = perf.n = 0;
		}
	}
}

function settle() {
	/* No motion: show the finished picture at once. */
	reveal = 1;
	easeCamera(1);
	sceneDirty = true;
}

function refont() {
	glyphs.clear();
	figKey = '';
	fig = null;
	layoutDirty = true;
}

async function init() {
	wrapWords(document.querySelector('main'));

	probe = document.createElement('div');
	probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100vh;height:100lvh;visibility:hidden;pointer-events:none';
	document.body.appendChild(probe);

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
	sceneDirty = true;
	if (reduce.matches) settle();
	root.classList.add('dots');
	root.classList.remove('nodots');

	window.addEventListener('resize', () => { sizeDirty = true; });
	new ResizeObserver(() => { layoutDirty = true; }).observe(document.querySelector('main'));
	fonts.addEventListener('loadingdone', refont);
	reduce.addEventListener('change', () => { if (reduce.matches) settle(); paintDirty = true; });

	window.addEventListener('pointermove', (e) => {
		if (e.pointerType === 'touch') return;     /* a finger scrolls; it should not swing the camera */
		mouseX = e.clientX - window.innerWidth / 2;
		mouseY = e.clientY - window.innerHeight / 2;
	}, { passive: true });

	/* Hover with a mouse; with a finger, light the link only while it is pressed. */
	const link = (node) => (node instanceof Element ? node.closest(LINKS) : null);
	const setHover = (el) => { if (hoverEl !== el) { hoverEl = el; paintDirty = true; } };
	document.addEventListener('pointerover', (e) => { if (e.pointerType !== 'touch') setHover(link(e.target)); });
	document.addEventListener('pointerout', (e) => { if (e.pointerType !== 'touch' && !link(e.relatedTarget)) setHover(null); });
	document.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') setHover(link(e.target)); });
	document.addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') setHover(null); });
	document.addEventListener('pointercancel', () => setHover(null));
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
