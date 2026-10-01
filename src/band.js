/* Nightdrive — the session players. Extra instruments that sit in on some
 * tracks and not others, so each track has its own band: a chicken-scratch
 * funk guitar, an FM electric piano, FM bells and marimba, an FM slap bass,
 * congas, bongos, shaker and timbales, a synth sax, a choir, laser zaps and
 * record scratches. The arrangement (which players, how the intro, builds and
 * breakdown go) is chosen per track in audio.js; this decides when they play.
 */
(function () {
  'use strict';
  const ND = window.ND;
  const { hz, voice } = ND.musicUtil;

  // Funk guitar, one bar of sixteenths: x = a chord stab, m = a muted scratch.
  const GTR_FUNK = ['..x...x...x..xm.', 'x.mxm.x.mxm.x.mx', '..x.mx..x.mx..x.', '....x.......x...', 'm.x.m.xmm.x.m.xm'];
  // Noir guitar: a clean, slow picking over the chord [step, chord tone]
  const GTR_NOIR = [[[0, 0], [3, 1], [6, 2], [8, 1], [11, 2], [14, 3]], [[0, 0], [4, 2], [6, 1], [10, 3], [12, 2]]];
  // Electric piano comping over two bars: [step, length]
  const EP_PATS = [
    [[0, 6], [6, 2], [10, 4], [16, 6], [22, 2], [26, 4]],
    [[2, 2], [6, 4], [12, 2], [18, 2], [22, 4], [28, 2]],
    [[0, 14], [14, 2], [16, 12], [28, 4]],
    [[3, 3], [8, 2], [11, 5], [19, 3], [24, 2], [27, 5]],
  ];
  // Bell counter-melodies over two bars: [step, chord tone (0-7 across two octaves)]
  const BELL_PATS = [
    [[0, 0], [3, 2], [6, 4], [8, 3], [11, 2], [14, 1], [16, 0], [19, 2], [22, 4], [24, 5], [27, 4], [30, 2]],
    [[0, 4], [2, 3], [4, 2], [6, 0], [10, 2], [12, 3], [16, 4], [18, 5], [20, 4], [22, 2], [26, 3], [28, 2]],
    [[0, 2], [4, 4], [6, 5], [8, 4], [12, 2], [14, 3], [16, 1], [20, 2], [22, 3], [24, 2], [28, 0]],
  ];
  // Hand drums, one bar
  const CONGA_PATS = [
    [[2, 'hi'], [3, 'hi'], [6, 'slap'], [7, 'hi'], [10, 'hi'], [11, 'lo'], [14, 'slap'], [15, 'lo']],
    [[0, 'hi'], [3, 'slap'], [6, 'hi'], [8, 'lo'], [10, 'hi'], [11, 'hi'], [14, 'slap']],
    [[0, 'bongo'], [2, 'bongoHi'], [3, 'bongo'], [4, 'hi'], [6, 'bongo'], [8, 'bongo'], [10, 'bongoHi'], [11, 'bongo'], [12, 'hi'], [14, 'bongo']],
  ];
  const DRUM_F = { hi: 340, lo: 235, slap: 350, bongo: 520, bongoHi: 690 };
  const DRUM_PAN = { hi: 0.3, lo: -0.15, slap: 0.3, bongo: 0.45, bongoHi: 0.5 };
  // FM recipes: [modulator ratio, index, index decay (s), amplitude decay (s)]
  const FM = { bell: [3.5, 2.6, 1.4, 1.9], marimba: [4, 1.3, 0.05, 0.38], glock: [3, 1.5, 0.25, 0.65] };

  const M = ND.Music.prototype;
  Object.assign(M, {
    // ---- per track ----------------------------------------------------------------------
    bandPlan(T) {
      const r = this.r;
      return {
        gtr: T.style === 'noir' ? r.pick(GTR_NOIR) : r.pick(GTR_FUNK),
        ep: r.pick(EP_PATS),
        bell: r.pick(BELL_PATS),
        conga: r.pick(CONGA_PATS),
        bellKind: { miami: r.pick(['marimba', 'bell']), amiga: 'glock', electro: 'marimba', noir: 'bell', cosmic: 'bell' }[T.style],
      };
    },

    // ---- when they play ------------------------------------------------------------------
    extras(t, s, sb, k, X) {
      const T = this.track, A = T.arr, L = A.layers, name = s.name;
      if (!T.band) T.band = this.bandPlan(T);
      const B = T.band;
      const { pcs, secT, chordStart } = X;
      const drop = name === 'drop', verse = name === 'verse', brk = name === 'break', build = name === 'build';
      const intro = name === 'intro', outro = name === 'outro';
      const keysBreak = brk && A.brk === 'keys';
      // the groove parts: verse, drops, the start of builds, the outro, the intro once they're cued
      const groove = drop || verse || (build && sb < s.bars - 2) || (outro && sb < 8) || (intro && sb >= A.ip.layer) || (brk && A.brk === 'groove' && sb >= 2);
      const pos = (this.bar % 2) * 16 + k;
      const late = !drop || sb >= 8 || s.final; // second half of a drop, or the final one

      // funk guitar: chicken-scratch sixteenths on the chord (noir: slow clean picking)
      if (L.has('guitar') && (groove || keysBreak)) {
        if (T.style === 'noir') {
          const hit = B.gtr.find((h) => h[0] === k);
          if (hit && !drop) {
            const v = voice(pcs, null, 60);
            this.gtrNote(t, v[hit[1] % v.length], this.stepDur * 6, 0.16, false);
          }
        } else if (!keysBreak) {
          const ch = B.gtr[k];
          if (ch === 'x') this.gtrChord(t, voice(pcs.slice(0, 3), null, 64), this.stepDur * 0.8, drop ? 0.2 : 0.16, false, k % 2);
          else if (ch === 'm') this.gtrChord(t, voice(pcs.slice(0, 3), null, 64), 0.03, 0.12, true, k % 2);
        }
      }

      // electric piano: comping in the verse, chords in a keys breakdown, the odd drop
      const epOn = (L.has('epiano') && (verse || (intro && sb >= A.ip.layer) || (outro && sb < 12) || brk || (drop && sb >= 8 && !L.has('guitar')))) || keysBreak;
      if (epOn) {
        if (keysBreak && chordStart) this.epiano(t, voice(pcs, null, 58), this.stepDur * 16 * T.chordBars * 0.95, 0.24);
        else if (!keysBreak) {
          const hit = B.ep.find((h) => h[0] === pos);
          if (hit) this.epiano(t, voice(pcs, null, 60), this.stepDur * hit[1] * 0.9, drop ? 0.2 : 0.17);
        }
      }

      // bells: a counter-melody in the second half of the drops, and over a keys breakdown
      if ((L.has('bells') && ((drop && late) || (brk && sb >= 4))) || (keysBreak && sb >= 2)) {
        const hit = B.bell.find((h) => h[0] === pos);
        if (hit && (!brk || k % 2 === 0)) {
          const v = voice(pcs, null, 72), ext = [...v, ...v.map((m) => m + 12)];
          this.bell(t, ext[hit[1] % ext.length], this.stepDur * 2, brk ? 0.09 : 0.11, B.bellKind);
        }
      }

      // hand drums and a shaker in the groove; timbales roll into each phrase
      const percOn = groove || (intro && sb >= A.ip.perc);
      if (L.has('latin') && percOn) {
        const hit = B.conga.find((h) => h[0] === k);
        if (hit && (!intro || sb >= A.ip.perc)) this.conga(t, hit[1], drop ? 1 : 0.8);
        if (k % 2 === 0 || drop) this.shaker(t, (k % 4 === 2 ? 0.34 : 0.2) * (drop ? 1 : 0.8));
        if ((drop || verse) && sb % 8 === 7 && k >= 12) this.timbale(t, [620, 560, 470, 410][k - 12], 0.5 + (k - 12) * 0.1);
        if (drop && sb === 0 && k === 0) this.timbale(t, 520, 0.8);
      }

      // the choir: "aah" over the drops' second half (all of the final one) and the breakdown
      if (L.has('choir') && chordStart && ((drop && late) || brk)) {
        this.choir(t, voice(pcs.slice(0, 3), null, 62), this.stepDur * 16 * T.chordBars, drop ? 0.2 : 0.16);
      }

      // laser zaps: the odd pew-pew in the drops, a volley at the end of the build
      if (L.has('zap')) {
        if (drop && ((pos === 14 && sb % 2 === 1) || (sb % 4 === 3 && (k === 12 || k === 14)))) this.zap(t, 0.13, 2400 + (k % 4) * 300);
        if (build && sb === s.bars - 2 && k % 2 === 0) this.zap(t, 0.06 + secT * 0.08, 900 + k * 160);
      }

      // record scratches on a vocal, old-school electro style
      if (L.has('scratch')) {
        if (drop && sb % 4 === 3 && (k === 8 || k === 12)) this.scratch(t, this.stepDur * 2, 0.4);
        if (verse && sb % 8 === 7 && k === 12) this.scratch(t, this.stepDur * 4, 0.32);
        if (intro && A.intro === 'drums' && sb === 1 && k === 8) this.scratch(t, this.stepDur * 4, 0.32);
      }

      // extra handclaps: a syncopated clap and a clap roll at the end of every other bar
      if (L.has('claps') && (drop || (verse && sb >= 8))) {
        if (pos === 26) this.snare(t, 0.35, true, 1.12);
        if (drop && pos >= 29 && sb % 4 === 3) this.snare(t, 0.3 + (pos - 29) * 0.1, true, 1.08);
      }
    },

    // ---- the instruments ------------------------------------------------------------------
    // Shared bits built once per audio context: the guitar's plucked strings
    // (Karplus-Strong, rendered ahead) and its little amp.
    bandInit() {
      if (this.bandCtx === this.ctx) return;
      this.bandCtx = this.ctx;
      const c = this.ctx, N = this.n;
      const f0 = 196;
      this.gtr = { ring: this.ksPluck(f0, 1.6, 0.996, 0.55, 11), mute: this.ksPluck(f0, 0.14, 0.9, 0.35, 12), f: c.sampleRate / (Math.round(c.sampleRate / f0) + 0.5) };
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 180;
      const drive = c.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) curve[i] = Math.tanh(((i / 1023) * 2 - 1) * 1.6) / Math.tanh(1.6);
      drive.curve = curve;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
      const out = c.createGain(); out.gain.value = 0.9;
      hp.connect(drive).connect(lp).connect(out);
      if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = 0.35; out.connect(p).connect(N.music); } else out.connect(N.music);
      const ds = c.createGain(); ds.gain.value = 0.2; out.connect(ds).connect(N.delayIn);
      const rs = c.createGain(); rs.gain.value = 0.15; out.connect(rs).connect(N.verbIn);
      this.gtrIn = hp;
    },

    // A plucked string: a burst of noise circulating through a damped delay line.
    ksPluck(f0, secs, damp, bright, seed) {
      const c = this.ctx, sr = c.sampleRate, len = Math.floor(sr * secs);
      const buf = c.createBuffer(1, len, sr), d = buf.getChannelData(0);
      const P = Math.round(sr / f0), r = ND.rng(seed);
      let lp = 0;
      for (let i = 0; i < P; i++) { lp += (r() * 2 - 1 - lp) * bright; d[i] = lp; }
      for (let i = P; i < len; i++) d[i] = damp * 0.5 * (d[i - P] + (i > P ? d[i - P - 1] : 0));
      // take out any DC and fade the tail
      let mean = 0;
      for (let i = 0; i < len; i++) mean += d[i];
      mean /= len;
      let peak = 0;
      for (let i = 0; i < len; i++) { d[i] -= mean; peak = Math.max(peak, Math.abs(d[i])); }
      for (let i = 0; i < len; i++) d[i] = (d[i] / (peak || 1)) * 0.9 * Math.min(1, (len - i) / (sr * 0.03));
      return buf;
    },

    gtrNote(t, m, dur, v, muted) {
      this.bandInit();
      const c = this.ctx, G = this.gtr;
      const src = c.createBufferSource();
      src.buffer = muted ? G.mute : G.ring;
      src.playbackRate.value = hz(m) / G.f;
      const g = c.createGain();
      g.gain.setValueAtTime(v, t);
      g.gain.setValueAtTime(v, t + dur);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
      src.connect(g).connect(this.gtrIn);
      src.start(t);
      src.stop(t + dur + 0.07);
    },

    // a strum: the strings a few milliseconds apart, down or up
    gtrChord(t, notes, dur, v, muted, up) {
      const ns = [...notes].sort((a, b) => a - b);
      if (up) ns.reverse();
      ns.forEach((m, i) => this.gtrNote(t + i * 0.007, m, dur, v * (i === 0 ? 1 : 0.85), muted));
    },

    // FM slap bass: one operator plucking another, plus a triangle underneath for weight.
    fmBass(t, m, dur, v, pop, from) {
      const c = this.ctx, N = this.n, f = hz(m);
      const car = c.createOscillator(), mod = c.createOscillator(), sub = c.createOscillator();
      car.type = 'sine'; mod.type = 'sine'; sub.type = 'triangle';
      for (const o of [car, mod, sub]) {
        if (from != null) {
          o.frequency.setValueAtTime(hz(from), t);
          o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
        } else o.frequency.value = f;
      }
      const mg = c.createGain();
      mg.gain.setValueAtTime(f * (pop ? 3.4 : 2.3), t);
      mg.gain.exponentialRampToValueAtTime(f * 0.3, t + (pop ? 0.08 : 0.14));
      mod.connect(mg).connect(car.frequency);
      const sg = c.createGain(); sg.gain.value = 0.55;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
      const g = c.createGain();
      this.env(g, t, 0.003, 0.36 * v, 0.18, 0.55, 0.03, t + dur);
      car.connect(lp); sub.connect(sg).connect(lp);
      lp.connect(g).connect(N.music);
      for (const o of [car, mod, sub]) { o.start(t); o.stop(t + dur + 0.05); }
    },

    // FM bells, marimba and glockenspiel: a sine ringing a sine at an odd ratio.
    bell(t, m, dur, v, kind = 'bell') {
      const c = this.ctx, N = this.n, f = hz(m), [ratio, index, idec, adec] = FM[kind] || FM.bell;
      const car = c.createOscillator(), mod = c.createOscillator();
      car.type = 'sine'; mod.type = 'sine';
      car.frequency.value = f; mod.frequency.value = f * ratio;
      const mg = c.createGain();
      mg.gain.setValueAtTime(f * ratio * index, t);
      mg.gain.exponentialRampToValueAtTime(f * ratio * 0.02, t + idec);
      mod.connect(mg).connect(car.frequency);
      const g = c.createGain();
      const end = t + Math.max(dur, adec) + 0.1;
      this.env(g, t, 0.002, v, adec, 0.02, 0.05, end);
      car.connect(g);
      let out = g;
      if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = (((m * 5) % 12) / 12 - 0.5) * 0.9; g.connect(p); out = p; }
      out.connect(N.music);
      const ds = c.createGain(); ds.gain.value = 0.3; g.connect(ds).connect(N.delayIn);
      const rs = c.createGain(); rs.gain.value = 0.25; g.connect(rs).connect(N.verbIn);
      car.start(t); mod.start(t); car.stop(end + 0.05); mod.stop(end + 0.05);
    },

    // FM electric piano: a tine that rings bright then mellows, with a little auto-pan.
    epiano(t, notes, dur, v) {
      const c = this.ctx, N = this.n;
      const out = c.createGain();
      const end = t + dur + 0.25;
      this.env(out, t, 0.003, v, 0.9, 0.45, 0.2, end);
      let dest = out;
      const oscs = [];
      if (c.createStereoPanner) {
        const p = c.createStereoPanner();
        const lfo = c.createOscillator(); lfo.frequency.value = 4.2;
        const lg = c.createGain(); lg.gain.value = 0.35;
        lfo.connect(lg).connect(p.pan);
        out.connect(p);
        dest = p;
        oscs.push(lfo);
      }
      dest.connect(N.music);
      const rs = c.createGain(); rs.gain.value = 0.3; out.connect(rs).connect(N.verbIn);
      const ds = c.createGain(); ds.gain.value = 0.15; out.connect(ds).connect(N.delayIn);
      const per = 1.3 / notes.length;
      for (const m of notes) {
        const f = hz(m);
        // the body: ratio 1, its brightness falling away
        const car = c.createOscillator(), mod = c.createOscillator();
        car.frequency.value = f; mod.frequency.value = f;
        const mg = c.createGain();
        mg.gain.setValueAtTime(f * 1.8, t);
        mg.gain.exponentialRampToValueAtTime(f * 0.25, t + 0.4);
        mod.connect(mg).connect(car.frequency);
        const cg = c.createGain(); cg.gain.value = per;
        car.connect(cg).connect(out);
        // the tine: a high, fast-dying ping on top
        const tc = c.createOscillator(), tm = c.createOscillator();
        tc.frequency.value = f; tm.frequency.value = f * 7;
        const tmg = c.createGain();
        tmg.gain.setValueAtTime(f * 7 * 0.5, t);
        tmg.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.05);
        tm.connect(tmg).connect(tc.frequency);
        const tg = c.createGain();
        tg.gain.setValueAtTime(per * 0.45, t);
        tg.gain.exponentialRampToValueAtTime(per * 0.02, t + 0.3);
        tc.connect(tg).connect(out);
        oscs.push(car, mod, tc, tm);
      }
      for (const o of oscs) { o.start(t); o.stop(end + 0.05); }
    },

    // Congas and bongos: a skin (a sine that drops in pitch) and a slap of noise.
    conga(t, kind, v) {
      const c = this.ctx, N = this.n, f = DRUM_F[kind] || 340, slap = kind === 'slap';
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f * 1.3, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.025);
      const g = c.createGain();
      this.env(g, t, 0.001, (slap ? 0.22 : 0.38) * v, slap ? 0.06 : 0.17, 0.001, 0, null);
      const n = c.createBufferSource(); n.buffer = this.white;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = slap ? 2600 : 1500; bp.Q.value = 1.2;
      const ng = c.createGain();
      this.env(ng, t, 0.001, (slap ? 0.5 : 0.12) * v, slap ? 0.035 : 0.015, 0.01, 0, null);
      let dest = N.drums;
      if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = DRUM_PAN[kind] || 0.2; p.connect(N.drums); dest = p; }
      o.connect(g).connect(dest);
      n.connect(bp).connect(ng).connect(dest);
      o.start(t); o.stop(t + 0.25);
      n.start(t, (t * 5.1) % 1.5); n.stop(t + 0.06);
    },

    shaker(t, v) {
      const c = this.ctx, N = this.n;
      const n = c.createBufferSource(); n.buffer = this.white;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 6500; bp.Q.value = 1.4;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v * 0.3, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      let dest = N.drums;
      if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = -0.4; p.connect(N.drums); dest = p; }
      n.connect(bp).connect(g).connect(dest);
      n.start(t, (t * 2.3) % 1.5); n.stop(t + 0.07);
    },

    timbale(t, f, v) {
      const c = this.ctx, N = this.n;
      const g = c.createGain();
      this.env(g, t, 0.001, 0.28 * v, 0.3, 0.001, 0, null);
      const oscs = [f, f * 1.48].map((x) => { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = x; o.connect(g); return o; });
      const n = c.createBufferSource(); n.buffer = this.white;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 4000; bp.Q.value = 1;
      const ng = c.createGain();
      this.env(ng, t, 0.001, 0.3 * v, 0.04, 0.01, 0, null);
      n.connect(bp).connect(ng).connect(g);
      let dest = N.drums;
      if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = 0.2; p.connect(N.drums); dest = p; }
      g.connect(dest);
      const s = c.createGain(); s.gain.value = 0.25; g.connect(s).connect(N.gatedIn);
      for (const o of oscs) { o.start(t); o.stop(t + 0.35); }
      n.start(t, (t * 4.7) % 1.5); n.stop(t + 0.06);
    },

    // The synth sax: a reedy saw and pulse scooping up into each note, through a
    // sax's formants, with breath on the attack and a vibrato that blooms late.
    sax(t, m, dur, v) {
      const c = this.ctx, N = this.n, f = hz(m);
      const src = c.createGain();
      const lfo = c.createOscillator(); lfo.frequency.value = 5.3;
      const lfoG = c.createGain();
      lfoG.gain.setValueAtTime(0, t);
      lfoG.gain.setValueAtTime(0, t + Math.min(0.2, dur * 0.5));
      lfoG.gain.linearRampToValueAtTime(f * 0.014, t + Math.min(0.5, dur));
      lfo.connect(lfoG);
      const oscs = [lfo];
      for (const [w, det, gain] of [['sawtooth', 0, 0.6], ['pulse25', 4, 0.35]]) {
        const o = c.createOscillator();
        this.setWave(o, w);
        o.detune.value = det;
        o.frequency.setValueAtTime(f * 0.94, t);
        o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
        lfoG.connect(o.frequency);
        const og = c.createGain(); og.gain.value = gain;
        o.connect(og).connect(src);
        oscs.push(o);
      }
      // breath
      const n = c.createBufferSource(); n.buffer = this.white; n.loop = true;
      const nb = c.createBiquadFilter(); nb.type = 'bandpass'; nb.frequency.value = 1600; nb.Q.value = 0.9;
      const ng = c.createGain();
      ng.gain.setValueAtTime(0.0001, t);
      ng.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
      ng.gain.exponentialRampToValueAtTime(0.1, t + 0.15);
      ng.gain.setValueAtTime(0.1, t + dur);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1);
      n.connect(nb).connect(ng).connect(src);
      const g = c.createGain();
      this.env(g, t, 0.04, v * 2, 0.2, 0.85, 0.12, t + dur + 0.1);
      for (const [fc, q, lvl] of [[550, 4, 1], [1250, 5, 0.7], [2700, 6, 0.4]]) {
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fc; bp.Q.value = q;
        const bg = c.createGain(); bg.gain.value = lvl;
        src.connect(bp).connect(bg).connect(g);
      }
      const body = c.createBiquadFilter(); body.type = 'lowpass'; body.frequency.value = 1800;
      const bodyG = c.createGain(); bodyG.gain.value = 0.35;
      src.connect(body).connect(bodyG).connect(g);
      g.connect(N.lead);
      const rs = c.createGain(); rs.gain.value = 0.45; g.connect(rs).connect(N.verbIn);
      const ds = c.createGain(); ds.gain.value = 0.25; g.connect(ds).connect(N.delayIn);
      const end = t + dur + 0.25;
      for (const o of oscs) { o.start(t); o.stop(end); }
      n.start(t, (t * 1.9) % 1.5); n.stop(end);
    },

    // The choir: detuned saws singing "aah" through a mouth of three formants.
    choir(t, notes, dur, v) {
      const c = this.ctx, N = this.n;
      const out = c.createGain();
      const end = t + dur + 1;
      this.env(out, t, 0.45, v, 0, 1, 1, end);
      const src = c.createGain(); src.gain.value = 1 / notes.length;
      const lfo = c.createOscillator(); lfo.frequency.value = 5;
      const lg = c.createGain(); lg.gain.value = 9; // cents of vibrato
      lfo.connect(lg);
      const oscs = [lfo];
      for (const m of notes) for (const det of [-9, 9]) {
        const o = c.createOscillator(); o.type = 'sawtooth';
        o.frequency.value = hz(m); o.detune.value = det;
        lg.connect(o.detune);
        o.connect(src);
        oscs.push(o);
      }
      for (const [fc, q, lvl] of [[730, 6, 1], [1090, 8, 0.6], [2440, 10, 0.3]]) {
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fc; bp.Q.value = q;
        const bg = c.createGain(); bg.gain.value = lvl * 2.2;
        src.connect(bp).connect(bg).connect(out);
      }
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      const lpg = c.createGain(); lpg.gain.value = 0.3;
      src.connect(lp).connect(lpg).connect(out);
      out.connect(N.music);
      const rs = c.createGain(); rs.gain.value = 0.6; out.connect(rs).connect(N.verbIn);
      for (const o of oscs) { o.start(t); o.stop(end + 0.05); }
    },

    // Pew: a pulse wave diving from high to low.
    zap(t, v, hi = 2600) {
      const c = this.ctx, N = this.n;
      const o = c.createOscillator();
      this.setWave(o, 'pulse25');
      o.frequency.setValueAtTime(hi, t);
      o.frequency.exponentialRampToValueAtTime(110, t + 0.14);
      const g = c.createGain();
      this.env(g, t, 0.001, v, 0.14, 0.01, 0, null);
      let dest = g;
      if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = Math.sin(t * 7.7) * 0.6; g.connect(p); dest = p; }
      dest.connect(N.music);
      const ds = c.createGain(); ds.gain.value = 0.45; g.connect(ds).connect(N.delayIn);
      o.start(t); o.stop(t + 0.17);
    },

    // A baby scratch on a vocal: forward, then back, the "record" speeding up and slowing down.
    scratch(t, dur, v) {
      const vox = this.vox;
      const pool = vox && vox.ready ? (vox.chops.length ? vox.chops : vox.hooks) : null;
      if (!pool || !pool.length) return;
      const clip = pool[(this.scratchIdx = (this.scratchIdx || 0) + 1) % pool.length];
      const c = this.ctx, N = this.n;
      if (!clip.rev || clip.rev.sampleRate !== clip.buf.sampleRate) {
        const b = clip.buf, rb = c.createBuffer(b.numberOfChannels, b.length, b.sampleRate);
        for (let ch = 0; ch < b.numberOfChannels; ch++) rb.getChannelData(ch).set(Array.from(b.getChannelData(ch)).reverse());
        clip.rev = rb;
      }
      const half = dur / 2, len = clip.buf.duration;
      const p0 = Math.min(len - 0.3, clip.onset + Math.min(0.08, clip.dur * 0.2));
      const travel = half * 1.05;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v * clip.norm, t + 0.006);
      g.gain.setValueAtTime(v * clip.norm, t + dur - 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.01);
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.6;
      bp.connect(g).connect(N.music);
      const ds = c.createGain(); ds.gain.value = 0.2; g.connect(ds).connect(N.delayIn);
      const push = (buf, at, offset) => {
        const src = c.createBufferSource(); src.buffer = buf;
        const pr = src.playbackRate;
        pr.setValueAtTime(0.3, at);
        pr.linearRampToValueAtTime(1.9, at + half * 0.45);
        pr.linearRampToValueAtTime(0.3, at + half);
        src.connect(bp);
        src.start(at, ND.clamp(offset, 0, len - 0.05));
        src.stop(at + half + 0.005);
      };
      push(clip.buf, t, p0);
      push(clip.rev, t + half, len - (p0 + travel));
    },
  });
})();
