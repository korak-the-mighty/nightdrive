/* Nightdrive — core utilities: constants, RNG, colour, dithering, pixel buffers, noise. */
(function () {
  'use strict';
  const ND = (window.ND = window.ND || {});

  // ---------------------------------------------------------------------------
  // World constants. Everything is authored for a 640x360 pixel world, which
  // scales by an exact integer to 720p (2x), 1080p (3x), 1440p (4x) and 4K (6x).
  // ---------------------------------------------------------------------------
  const W = 640, H = 360;
  ND.W = W;
  ND.H = H;
  ND.CX = W / 2;
  ND.HORIZON = 180;   // vanishing line of the ground plane
  ND.SPEED = 4;       // road pixels per tick at depth factor 1 (the hero lane)
  ND.TICK = 1 / 60;   // fixed simulation step

  // Ground plane: screen row <-> parallax factor.
  ND.fAt = (y) => (y - ND.HORIZON) / 96;
  ND.yAt = (f) => ND.HORIZON + f * 96;

  // Important rows of the street.
  ND.Y = {
    BUILD: 228,   // building bases / back of the sidewalk (f = 0.5)
    CURB: 252,    // curb edge (f = 0.75)
    FAR: 262,     // far traffic lane ground contact
    CAR: 276,     // hero car ground contact (f = 1)
    LINE: 300,    // lane line
    ONC: 330,     // oncoming lane ground contact (the lane in front of the centre line)
  };
  ND.ONC_SCALE = 1.7; // oncoming cars are drawn this much bigger than the far lane's (the big specials 1.5)

  // ---------------------------------------------------------------------------
  // Deterministic RNG (mulberry32) + hashing.
  // ---------------------------------------------------------------------------
  ND.rng = function (seed) {
    let a = seed >>> 0;
    const r = function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.range = (lo, hi) => lo + (hi - lo) * r();
    r.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * r());
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    r.chance = (p) => r() < p;
    return r;
  };

  ND.hash = function (a, b = 0, c = 0) {
    let n = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2147483647);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    n ^= n >>> 16;
    return (n >>> 0) / 4294967296;
  };

  // ---------------------------------------------------------------------------
  // Colour helpers. Colours are [r,g,b] arrays (0..255) for maths and packed
  // little-endian ABGR uint32 values for pixel buffers.
  // ---------------------------------------------------------------------------
  ND.rgb = function (hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
  ND.clamp255 = clamp255;
  ND.pack = (r, g, b, a = 255) =>
    ((clamp255(a) << 24) | (clamp255(b) << 16) | (clamp255(g) << 8) | clamp255(r)) >>> 0;
  ND.packHex = (hex, a = 255) => {
    const c = ND.rgb(hex);
    return ND.pack(c[0], c[1], c[2], a);
  };
  ND.mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  ND.scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  ND.css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  ND.lerp = (a, b, t) => a + (b - a) * t;
  ND.clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  ND.smooth = (t) => t * t * (3 - 2 * t);

  // Multi-stop gradient: stops = [[t, [r,g,b]], ...]
  ND.grad = function (stops, t) {
    if (t <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        const a = stops[i - 1], b = stops[i];
        return ND.mix(a[1], b[1], (t - a[0]) / (b[0] - a[0]));
      }
    }
    return stops[stops.length - 1][1];
  };

  // ---------------------------------------------------------------------------
  // Ordered dithering (Bayer 4x4) — gives gradients that authentic pixel look.
  // ---------------------------------------------------------------------------
  const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  ND.bayer = (x, y) => (B4[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
  ND.dq = function (v, x, y, step = 14) {
    const q = Math.round(v / step + ND.bayer(x, y) - 0.5) * step;
    return q < 0 ? 0 : q > 255 ? 255 : q;
  };

  // ---------------------------------------------------------------------------
  // Pixel buffer: fast per-pixel sprite authoring, converted to a canvas once.
  // ---------------------------------------------------------------------------
  class PB {
    constructor(w, h) {
      this.w = w | 0;
      this.h = h | 0;
      this.d = new Uint32Array(this.w * this.h);
    }
    in(x, y) {
      return x >= 0 && y >= 0 && x < this.w && y < this.h;
    }
    set(x, y, c) {
      x |= 0; y |= 0;
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      this.d[y * this.w + x] = c;
    }
    get(x, y) {
      x |= 0; y |= 0;
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
      return this.d[y * this.w + x];
    }
    alpha(x, y) {
      return this.get(x, y) >>> 24;
    }
    // Set with dithered quantisation of an [r,g,b] float colour.
    dset(x, y, c, a = 255, step = 14) {
      x |= 0; y |= 0;
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      this.d[y * this.w + x] = ND.pack(ND.dq(c[0], x, y, step), ND.dq(c[1], x, y, step), ND.dq(c[2], x, y, step), a);
    }
    // Alpha-blend an [r,g,b] colour on top (a in 0..1).
    blend(x, y, c, a) {
      x |= 0; y |= 0;
      if (a <= 0 || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      const i = y * this.w + x, o = this.d[i];
      const oa = (o >>> 24) / 255;
      if (oa === 0) {
        this.d[i] = ND.pack(c[0], c[1], c[2], a * 255);
        return;
      }
      const na = a + oa * (1 - a);
      const k = a / na;
      const r = (o & 255) + (c[0] - (o & 255)) * k;
      const g = ((o >> 8) & 255) + (c[1] - ((o >> 8) & 255)) * k;
      const b = ((o >> 16) & 255) + (c[2] - ((o >> 16) & 255)) * k;
      this.d[i] = ND.pack(r, g, b, na * 255);
    }
    // Additive light (keeps alpha, raises it to at least `a`).
    add(x, y, c, s = 1) {
      x |= 0; y |= 0;
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      const i = y * this.w + x, o = this.d[i];
      const oa = o >>> 24;
      const r = (o & 255) + c[0] * s, g = ((o >> 8) & 255) + c[1] * s, b = ((o >> 16) & 255) + c[2] * s;
      this.d[i] = ND.pack(r, g, b, Math.max(oa, 255));
    }
    rgbAt(x, y) {
      const o = this.get(x, y);
      return [o & 255, (o >> 8) & 255, (o >> 16) & 255];
    }
    rect(x, y, w, h, c) {
      const x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0);
      const x1 = Math.min(this.w, (x + w) | 0), y1 = Math.min(this.h, (y + h) | 0);
      for (let yy = y0; yy < y1; yy++) this.d.fill(c, yy * this.w + x0, yy * this.w + x1);
    }
    hline(x0, x1, y, c) {
      if (x1 < x0) { const t = x0; x0 = x1; x1 = t; }
      this.rect(x0, y, x1 - x0 + 1, 1, c);
    }
    vline(x, y0, y1, c) {
      if (y1 < y0) { const t = y0; y0 = y1; y1 = t; }
      this.rect(x, y0, 1, y1 - y0 + 1, c);
    }
    line(x0, y0, x1, y1, c) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        this.set(x0, y0, c);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
    // Calls fn(x,y) for each pixel of a line.
    lineFn(x0, y0, x1, y1, fn) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy, i = 0;
      const n = Math.max(dx, -dy) || 1;
      for (;;) {
        fn(x0, y0, i / n);
        i++;
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
    disc(cx, cy, r, c) {
      const rr = r * r + r * 0.6;
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          const dx = x - cx, dy = y - cy;
          if (dx * dx + dy * dy <= rr) this.set(x, y, c);
        }
    }
    discFn(cx, cy, r, fn) {
      const rr = r * r + r * 0.6;
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          const dx = x - cx, dy = y - cy;
          if (dx * dx + dy * dy <= rr) fn(x, y, Math.sqrt(dx * dx + dy * dy) / (r || 1));
        }
    }
    // Thick line made of discs.
    thick(x0, y0, x1, y1, r, c) {
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        if (r <= 0.5) this.set(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), c);
        else this.disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, c);
      }
    }
    // Scanline polygon fill (pixel centres). pts = [[x,y],...]
    poly(pts, c) {
      this.polyFn(pts, (x, y) => this.set(x, y, c));
    }
    polyFn(pts, fn) {
      let minY = Infinity, maxY = -Infinity;
      for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
      minY = Math.max(0, Math.floor(minY));
      maxY = Math.min(this.h - 1, Math.ceil(maxY));
      const xs = [];
      for (let y = minY; y <= maxY; y++) {
        const sy = y + 0.5;
        xs.length = 0;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const a = pts[i], b = pts[j];
          if ((a[1] <= sy && b[1] > sy) || (b[1] <= sy && a[1] > sy)) {
            xs.push(a[0] + ((sy - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
          }
        }
        xs.sort((p, q) => p - q);
        for (let k = 0; k + 1 < xs.length; k += 2) {
          const x0 = Math.max(0, Math.ceil(xs[k] - 0.5)), x1 = Math.min(this.w - 1, Math.floor(xs[k + 1] - 0.5));
          for (let x = x0; x <= x1; x++) fn(x, y);
        }
      }
    }
    // Draw another buffer on top (src-over, binary alpha fast path).
    blit(src, dx, dy, flipX = false) {
      for (let y = 0; y < src.h; y++)
        for (let x = 0; x < src.w; x++) {
          const c = src.d[y * src.w + (flipX ? src.w - 1 - x : x)];
          const a = c >>> 24;
          if (a === 0) continue;
          if (a === 255) this.set(dx + x, dy + y, c);
          else this.blend(dx + x, dy + y, [c & 255, (c >> 8) & 255, (c >> 16) & 255], a / 255);
        }
    }
    flipped() {
      const o = new PB(this.w, this.h);
      for (let y = 0; y < this.h; y++)
        for (let x = 0; x < this.w; x++) o.d[y * this.w + x] = this.d[y * this.w + (this.w - 1 - x)];
      return o;
    }
    // Outline: every transparent pixel touching an opaque one gets colour c.
    outline(c, diag = false) {
      const src = this.d.slice();
      const w = this.w, h = this.h;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          if (src[y * w + x] >>> 24) continue;
          let hit = false;
          for (let dy = -1; dy <= 1 && !hit; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              if (!diag && dx && dy) continue;
              const xx = x + dx, yy = y + dy;
              if (xx >= 0 && yy >= 0 && xx < w && yy < h && src[yy * w + xx] >>> 24 > 128) { hit = true; break; }
            }
          if (hit) this.d[y * w + x] = c;
        }
    }
    isEmpty() {
      for (let i = 0; i < this.d.length; i++) if (this.d[i] >>> 24) return false;
      return true;
    }
    canvas() {
      const cv = ND.canvas(this.w, this.h);
      const ctx = cv.getContext('2d');
      const id = ctx.createImageData(this.w, this.h);
      new Uint32Array(id.data.buffer).set(this.d);
      ctx.putImageData(id, 0, 0);
      return cv;
    }
  }
  ND.PB = PB;

  // ---------------------------------------------------------------------------
  // Canvas helpers
  // ---------------------------------------------------------------------------
  ND.canvas = function (w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, w | 0);
    c.height = Math.max(1, h | 0);
    return c;
  };
  ND.ctx = function (c, opts) {
    const x = c.getContext('2d', opts);
    x.imageSmoothingEnabled = false;
    return x;
  };

  // ---------------------------------------------------------------------------
  // Value noise + fBm
  // ---------------------------------------------------------------------------
  function h2(ix, iy, s) {
    let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(s, 1442695041);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    n ^= n >>> 16;
    return (n >>> 0) / 4294967296;
  }
  ND.noise = function (x, y, s = 0) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = h2(ix, iy, s), b = h2(ix + 1, iy, s), c = h2(ix, iy + 1, s), d = h2(ix + 1, iy + 1, s);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };
  ND.fbm = function (x, y, oct = 4, s = 0) {
    let v = 0, amp = 0.5, f = 1, n = 0;
    for (let i = 0; i < oct; i++) {
      v += amp * ND.noise(x * f, y * f, s + i * 31);
      n += amp;
      amp *= 0.5;
      f *= 2;
    }
    return v / n;
  };

  // ---------------------------------------------------------------------------
  // Sprite = colour canvas + optional emissive (glow) canvas, same size.
  // ---------------------------------------------------------------------------
  ND.sprite = function (pb, gpb, ox = 0, oy = 0) {
    return {
      c: pb.canvas(),
      g: gpb && !gpb.isEmpty() ? gpb.canvas() : null,
      w: pb.w,
      h: pb.h,
      ox,
      oy,
    };
  };
})();
