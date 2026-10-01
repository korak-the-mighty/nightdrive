/* Nightdrive — the car stereo: an 80s head unit in the corner of the picture.
 * One station per sound — 88.5 NOIR, 92.3 ELECTRO, 97.9 MIAMI, 103.5 AMIGA —
 * and 107.7 NIGHT FM, which plays them all. ←/→, the presets, the tuning knob or
 * dragging the needle along the band changes station, with static in between.
 * It sits over the picture (not in it), so it never shows up in a recording.
 */
(function () {
  'use strict';
  const ND = window.ND;

  const STATIONS = [
    { f: 88.5, name: 'NOIR', style: 'noir', slogan: 'LATE AND LONELY' },
    { f: 92.3, name: 'ELECTRO', style: 'electro', slogan: 'ROBOTS ONLY' },
    { f: 97.9, name: 'MIAMI', style: 'miami', slogan: 'PASTEL HITS' },
    { f: 103.5, name: 'AMIGA', style: 'amiga', slogan: '16-BIT GOLD' },
    { f: 107.7, name: 'NIGHT FM', style: null, slogan: 'THE ALL NIGHT MIX' },
  ];
  const F0 = 87.5, F1 = 108.5;
  const RW = 128, RH = 44;
  // where things are on the faceplate
  const LCD = { x: 22, y: 3, w: 84, h: 30 };
  const BAND = { x0: 27, x1: 101, y: 21 };
  const KNOB_L = { x: 11, y: 16 }, KNOB_R = { x: 116, y: 16 }, KR = 7;
  const PRESET = { x: 22, y: 35, w: 16, h: 7, gap: 1 };
  const SETTLE = 0.4; // seconds of hiss fading out once the needle stops
  const fx = (f) => BAND.x0 + ((f - F0) / (F1 - F0)) * (BAND.x1 - BAND.x0);
  const xf = (x) => ND.clamp(F0 + ((x - BAND.x0) / (BAND.x1 - BAND.x0)) * (F1 - F0), F0, F1);
  const nearest = (f) => STATIONS.reduce((b, s, i) => (Math.abs(s.f - f) < Math.abs(STATIONS[b].f - f) ? i : b), 0);

  const VFD = '#8af8ff', VFD_HALO = '#16424c', VFD_DIM = '#0d2228', PINK = '#ff6ad0', AMBER = '#ffb85a', NEEDLE = '#ff3048';

  class Radio {
    constructor(opts) {
      this.music = opts.music;
      this.screen = opts.screen;
      this.power = opts.power || (() => {});
      this.toast = opts.toast || (() => {});
      this.cv = document.createElement('canvas');
      this.cv.id = 'radio';
      this.cv.width = RW;
      this.cv.height = RH;
      this.cv.setAttribute('aria-label', 'Car radio: arrow keys left and right change station');
      document.body.appendChild(this.cv);
      this.c = this.cv.getContext('2d');
      this.masks = new Map();
      const st = this.music.forceStyle;
      this.cur = Math.max(0, STATIONS.findIndex((s) => s.style === (st || null)));
      this.f = this.target = STATIONS[this.cur].f;
      this.drag = null;
      this.scroll = 0;
      this.last = 0;
      this.dirty = true;
      this.bind();
      this.place();
      window.addEventListener('resize', () => this.place());
      const loop = (now) => { requestAnimationFrame(loop); this.tick(now); };
      requestAnimationFrame(loop);
    }

    get station() { return STATIONS[this.cur]; }

    // --- tuning -------------------------------------------------------------------------
    step(d) {
      const from = this.drag ? nearest(this.f) : STATIONS.findIndex((s) => s.f === this.target);
      this.tune((from + d + STATIONS.length) % STATIONS.length);
    }
    tune(i) {
      this.target = STATIONS[i].f;
      this.dirty = true;
      if (document.body.classList.contains('nohud')) this.toast(STATIONS[i].f.toFixed(1) + ' ' + STATIONS[i].name);
    }
    // static gets louder the further the needle is from a station
    staticAt(f) {
      const d = Math.min(...STATIONS.map((s) => Math.abs(s.f - f)));
      return ND.clamp(d / 0.5, 0, 1);
    }
    arrive() {
      const i = STATIONS.findIndex((s) => s.f === this.target);
      if (i < 0 || i === this.cur) return;
      this.cur = i;
      this.music.station(STATIONS[i].style);
    }

    tick(now) {
      const dt = Math.min(0.1, (now - (this.last || now)) / 1000);
      this.last = now;
      let lvl = 0;
      if (this.drag) {
        lvl = this.staticAt(this.f);
      } else if (this.f !== this.target) {
        // the needle sweeps over at a steady rate, crackling all the way
        const sp = 26 * dt, d = this.target - this.f;
        this.f = Math.abs(d) <= sp ? this.target : this.f + Math.sign(d) * sp;
        lvl = Math.max(0.6, this.staticAt(this.f));
        if (this.f === this.target) { this.arrive(); this.settle = SETTLE; }
        this.dirty = true;
      }
      // locked on: the hiss fades as the new station comes in
      if (!this.drag && this.f === this.target && this.settle > 0) {
        this.settle = Math.max(0, this.settle - dt);
        lvl = (0.6 * this.settle) / SETTLE;
      }
      if (lvl !== this.lvl) { this.music.tuner(lvl, this.f); this.lvl = lvl; }
      // the second line scrolls when it's too long for the window
      const line = this.line2();
      if (line !== this.lineText) { this.lineText = line; this.scroll = 0; this.dirty = true; }
      const lw = this.mask(line).w;
      if (lw > LCD.w - 6) {
        const s = Math.floor(now / 90) % (lw + 24);
        if (s !== this.scroll) { this.scroll = s; this.dirty = true; }
      }
      const on = !!(this.music.ctx && this.music.enabled);
      if (on !== this.on) { this.on = on; this.dirty = true; }
      if (this.dirty) { this.draw(); this.dirty = false; }
    }

    line2() {
      const m = this.music, T = m.track;
      if (!m.ctx) return 'PRESS ANY KEY';
      if (this.f !== this.target || this.drag) return 'SEARCHING...';
      if (T && m.shownTrack === T) return T.name;
      return this.station.slogan;
    }

    // --- input ---------------------------------------------------------------------------
    local(e) {
      const b = this.cv.getBoundingClientRect();
      return { x: ((e.clientX - b.left) / b.width) * RW, y: ((e.clientY - b.top) / b.height) * RH };
    }
    bind() {
      const cv = this.cv;
      cv.addEventListener('pointerdown', (e) => {
        const { x, y } = this.local(e);
        e.preventDefault();
        if (y >= PRESET.y - 1) {
          const i = Math.floor((x - PRESET.x) / (PRESET.w + PRESET.gap));
          if (i >= 0 && i < STATIONS.length) this.tune(i);
          return;
        }
        if (Math.hypot(x - KNOB_L.x, y - KNOB_L.y) <= KR + 3) { this.power(); this.dirty = true; return; }
        if (Math.hypot(x - KNOB_R.x, y - KNOB_R.y) <= KR + 3) { this.step(x < KNOB_R.x ? -1 : 1); return; }
        if (x >= LCD.x && x < LCD.x + LCD.w && y >= LCD.y && y < LCD.y + LCD.h) {
          // grab the needle and drag it along the band
          try { cv.setPointerCapture(e.pointerId); } catch (err) { /* fine without */ }
          this.drag = { id: e.pointerId };
          this.f = xf(x);
          this.dirty = true;
        }
      });
      cv.addEventListener('pointermove', (e) => {
        if (!this.drag || e.pointerId !== this.drag.id) return;
        this.f = xf(this.local(e).x);
        this.dirty = true;
      });
      const up = (e) => {
        if (!this.drag || e.pointerId !== this.drag.id) return;
        this.drag = null;
        this.tune(nearest(this.f));
      };
      cv.addEventListener('pointerup', up);
      cv.addEventListener('pointercancel', up);
      cv.addEventListener('wheel', (e) => { e.preventDefault(); this.step(e.deltaY > 0 || e.deltaX > 0 ? 1 : -1); }, { passive: false });
    }

    // sits in the top-left corner of the picture (bottom-left on phones), at the picture's pixel size
    place() {
      const b = this.screen.getBoundingClientRect();
      if (!b.width) return;
      const s = b.width / ND.W;
      const pad = Math.round(6 * s);
      this.cv.style.width = RW * s + 'px';
      this.cv.style.height = RH * s + 'px';
      this.cv.style.left = Math.max(b.left, 0) + pad + 'px';
      if (ND.touch) {
        this.cv.style.top = 'auto';
        this.cv.style.bottom = Math.max(innerHeight - b.bottom, 0) + pad + 'px';
      } else {
        this.cv.style.top = Math.max(b.top, 0) + pad + 'px';
        this.cv.style.bottom = 'auto';
      }
    }

    // --- drawing -------------------------------------------------------------------------
    mask(s, big) {
      const k = (big ? 'B' : 's') + s;
      if (!this.masks.has(k)) this.masks.set(k, ND.textMask(s, big ? { gap: 1 } : { small: true, gap: 1 }));
      return this.masks.get(k);
    }
    text(s, x, y, col, opts = {}) {
      const m = this.mask(s, opts.big), c = this.c;
      const clip = opts.clip;
      const put = (px, py) => { if (!clip || (px >= clip[0] && px < clip[1])) c.fillRect(px, py, 1, 1); };
      if (opts.halo) {
        c.fillStyle = opts.halo;
        for (let yy = 0; yy < m.h; yy++) for (let xx = 0; xx < m.w; xx++) if (m.m[yy * m.w + xx]) {
          put(x + xx - 1, y + yy); put(x + xx + 1, y + yy); c.fillRect(x + xx, y + yy - 1, 1, 1); c.fillRect(x + xx, y + yy + 1, 1, 1);
        }
      }
      c.fillStyle = col;
      for (let yy = 0; yy < m.h; yy++) for (let xx = 0; xx < m.w; xx++) if (m.m[yy * m.w + xx]) put(x + xx, y + yy);
      return m.w;
    }
    knob(k, ang, label) {
      const c = this.c;
      for (let y = -KR; y <= KR; y++) for (let x = -KR; x <= KR; x++) {
        const d = Math.hypot(x, y);
        if (d > KR + 0.3) continue;
        let col;
        if (d > KR - 1.6) {
          // knurled chrome rim, lit from above
          const lit = ND.clamp(0.55 - y / KR * 0.45, 0.1, 1);
          const knurl = Math.round(Math.atan2(y, x) * 6) % 2 ? 0.8 : 1;
          const v = Math.round(60 + 170 * lit * knurl);
          col = `rgb(${v},${v},${v + 18})`;
        } else {
          const v = Math.round(30 + (-y / KR) * 14);
          col = `rgb(${v},${v - 2},${v + 8})`;
        }
        c.fillStyle = col;
        c.fillRect(k.x + x, k.y + y, 1, 1);
      }
      // the pointer notch
      c.fillStyle = '#e8e8f4';
      for (let r = 1; r <= KR - 2; r++) c.fillRect(Math.round(k.x + Math.sin(ang) * r), Math.round(k.y - Math.cos(ang) * r), 1, 1);
      this.text(label, k.x - (this.mask(label).w >> 1), k.y + KR + 4, '#6a6880');
    }

    draw() {
      const c = this.c, on = this.on;
      c.clearRect(0, 0, RW, RH);
      // brushed black chassis with a chrome bevel
      for (let y = 0; y < RH; y++) {
        c.fillStyle = y === 0 ? '#7a7890' : y === 1 ? '#3a3848' : y === RH - 1 ? '#050408' : y % 2 ? '#15131c' : '#18161f';
        const inset = y === 0 || y === RH - 1 ? 1 : 0;
        c.fillRect(inset, y, RW - inset * 2, 1);
      }
      c.fillStyle = '#2a2836'; c.fillRect(0, 1, 1, RH - 2);
      c.fillStyle = '#0a090e'; c.fillRect(RW - 1, 1, 1, RH - 2);

      // knobs: power/volume on the left (with its LED), tuning on the right
      this.knob(KNOB_L, on ? 2.2 : -2.2, 'PWR');
      c.fillStyle = on ? '#ff3048' : '#401018';
      c.fillRect(KNOB_L.x + KR + 1, KNOB_L.y - KR, 2, 2);
      this.knob(KNOB_R, ((this.f - F0) / (F1 - F0)) * 5 - 2.5, 'TUNE');

      // the display window
      const L = LCD;
      c.fillStyle = '#5a586c'; c.fillRect(L.x - 1, L.y - 1, L.w + 2, L.h + 2);
      c.fillStyle = '#0a0910'; c.fillRect(L.x - 1, L.y + L.h, L.w + 2, 1);
      for (let y = L.y; y < L.y + L.h; y++) { c.fillStyle = y % 2 ? '#050b0e' : '#071014'; c.fillRect(L.x, y, L.w, 1); }

      // readout: FM, the frequency on ghost segments, the station
      const fs = this.f.toFixed(1).padStart(5, ' ');
      this.text('FM', L.x + 3, L.y + 4, on ? '#3a8a98' : VFD_DIM);
      this.text('888.8', L.x + 12, L.y + 2, VFD_DIM, { big: true });
      if (on) {
        // a blank leading digit stays a ghost
        const lead = fs[0] === ' ' ? 6 : 0;
        this.text(fs.trim(), L.x + 12 + lead, L.y + 2, VFD, { big: true, halo: VFD_HALO });
        const st = STATIONS[nearest(this.f)];
        const locked = this.staticAt(this.f) < 0.05;
        const nm = locked ? st.name : '- - -';
        this.text(nm, L.x + L.w - 2 - this.mask(nm).w, L.y + 4, PINK, { halo: '#401636' });
        // second line
        const line = this.lineText || '';
        const lw = this.mask(line).w, room = L.w - 6;
        const x0 = lw > room ? L.x + 3 + room - this.scroll : L.x + 3;
        this.text(line, x0, L.y + 11, '#5ad0e0', { clip: [L.x + 2, L.x + L.w - 2] });
      }

      // the band: numbers, ticks, station marks, the needle
      const by = BAND.y;
      for (let f = 88; f <= 108; f += 4) {
        const s = String(f), x = Math.round(fx(f)) - (this.mask(s).w >> 1);
        this.text(s, x, by, on ? AMBER : '#3a2a18');
      }
      for (let f = 88; f <= 108; f++) {
        c.fillStyle = on ? '#8a6a3a' : '#2a2014';
        c.fillRect(Math.round(fx(f)), by + (f % 4 ? 7 : 6), 1, f % 4 ? 1 : 2);
      }
      for (const s of STATIONS) { c.fillStyle = on ? PINK : '#3a1430'; c.fillRect(Math.round(fx(s.f)), by + 9, 1, 1); }
      const nx = Math.round(fx(this.f));
      if (on) { c.fillStyle = '#5a1020'; c.fillRect(nx - 1, by, 3, 11); }
      c.fillStyle = on ? NEEDLE : '#5a1820';
      c.fillRect(nx, by, 1, 11);

      // presets
      STATIONS.forEach((s, i) => {
        const x = PRESET.x + i * (PRESET.w + PRESET.gap), y = PRESET.y, act = i === this.cur && on;
        c.fillStyle = '#4a4858'; c.fillRect(x, y, PRESET.w, 1);
        c.fillStyle = act ? '#2c3a48' : '#24222e'; c.fillRect(x, y + 1, PRESET.w, PRESET.h - 2);
        c.fillStyle = '#08070c'; c.fillRect(x, y + PRESET.h - 1, PRESET.w, 1);
        const d = String(i + 1);
        this.text(d, x + (PRESET.w >> 1) - 1, y + 1, act ? VFD : '#8a88a0', act ? { halo: VFD_HALO } : {});
      });
    }
  }

  ND.Radio = Radio;
  ND.STATIONS = STATIONS;
})();
