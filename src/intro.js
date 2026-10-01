/* Nightdrive — the opening scene. The car is parked outside NIGHT DRIVE with
 * the engine off; he leans on it, smokes, looks around and talks to us now and
 * then. START sends him into the car: he flicks the cigarette, the door swings
 * open, he drops in, fires her up, puts the shades on, says his line to the
 * camera, and the car pulls away as the music drops.
 */
(function () {
  'use strict';
  const ND = window.ND;
  const { W, Y, SPEED } = ND;

  const LEAN_X = 202;          // car-local x of his centre, leaning on the strakes
  const FOOT_Y = Y.CAR + 17;   // his feet on the road, just in front of the car
  const SEAT = [144, 5];       // where the driver's head sits, car-local

  // The launch, in seconds from START. Getting in, the engine, the shades, a
  // look at the camera and a cigarette all come first; his line ends on the
  // drop, and the music jumps so the drop lands after all of it.
  const TL = {
    flick: 0, stand: 0.3, turn: 0.42, walkEnd: 0.95, doorOpen: 1.0, reachEnd: 1.2, doorOpened: 1.3,
    cut: 1.36, closeStart: 1.56, closeEnd: 1.76,
    ignite: 1.86, catch: 2.32, shades: 2.66, shadesOn: 3.06, cam: 3.2,
    lighter: 3.55, flame: 3.71, lit: 3.95, flameOut: 4.13, lighterDown: 4.31, puff: 4.47, line: 4.65,
  };
  const MIN_DROP = 6.8;   // seconds from START to the drop, at least
  const STRIDE = 44;      // px of road per walk cycle

  // --- side-view poses (car coordinates) ------------------------------------------
  const P = (hip, sh, nk, na, fk, fa, ne, nh, fe, fh) => ({ hip, sh, nearLeg: { knee: nk, ankle: na }, farLeg: { knee: fk, ankle: fa }, nearArm: { elbow: ne, hand: nh }, farArm: { elbow: fe, hand: fh } });
  const standAt = (x) => P([x, 36], [x - 1, 0], [x - 1, 64], [x, 92], [x + 2, 64], [x + 3, 92], [x + 1, 17], [x - 1, 33], [x + 3, 17], [x + 2, 33]);
  function walkAt(x, ph) {
    const bob = Math.abs(Math.sin(ph)) * 1.2;
    const H = [x, 37 - bob], S = [x - 2, 1 - bob];
    const leg = (p) => {
      const a = 0.42 * Math.sin(p), b = 0.15 + 0.8 * Math.pow(Math.max(0, Math.cos(p - 0.35)), 2);
      const K = [H[0] - 28 * Math.sin(a), H[1] + 28 * Math.cos(a)], s = a - b;
      return { knee: K, ankle: [K[0] - 28 * Math.sin(s), K[1] + 28 * Math.cos(s)] };
    };
    const arm = (p, dx) => {
      const au = -0.35 * Math.sin(p), af = au + 0.3;
      const E = [S[0] + dx - 17 * Math.sin(au), S[1] + 17 * Math.cos(au)];
      return { elbow: E, hand: [E[0] - 16 * Math.sin(af), E[1] + 16 * Math.cos(af)] };
    };
    return { hip: H, sh: S, nearLeg: leg(ph), farLeg: leg(ph + Math.PI), nearArm: arm(ph + Math.PI, 0), farArm: arm(ph, 2) };
  }
  const REACH = P([178, 36], [177, 0], [177, 64], [178, 92], [180, 64], [181, 92], [172, 16], [166, 31], [180, 17], [179, 33]);
  const SEATED = P([160, 56], [154, 25], [128, 50], [118, 70], [131, 51], [121, 71], [147, 40], [139, 22], [151, 40], [142, 24]);
  const ease = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => (Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * t) : typeof a === 'object' ? Object.fromEntries(Object.keys(a).map((k) => [k, lerp(a[k], b[k], t)])) : a + (b - a) * t);
  const span = (t, a, b) => ND.clamp((t - a) / (b - a), 0, 1);

  class Intro {
    constructor(world) {
      this.w = world;
      this.state = 'lobby';
      this.tick = 0;
      this.D = ND.genDude();
      this.r = ND.rng(world.seed + 606);
      this.arm = 'hold';
      this.nextDrag = 60 * 2.5;
      this.drag = null;
      this.view = 'cam';
      this.nextLook = 60 * 5;
      this.lookUntil = 0;
      this.blinkUntil = 0;
      this.nextBlink = 90;
      this.smoke = [];
      this.embers = [];
      this.walk = 0;       // his offset (px) during the launch walk
      this.lift = 0;
      this.hidden = false;
      this.prompt = 1;
      this.comp = ND.canvas(this.D.W, this.D.H);
      this.cx = ND.ctx(this.comp);
    }
    get active() { return this.state !== 'done'; }
    get lobby() { return this.state === 'lobby'; }

    // --- START ---------------------------------------------------------------------
    start(music) {
      if (this.state !== 'lobby') return;
      this.state = 'launch';
      this.music = music && music.ctx && music.enabled ? music : null;
      let T = 8.0, dropAt = null, startCT = null;
      if (this.music) {
        startCT = this.music.ctx.currentTime;
        dropAt = this.music.launch(startCT + MIN_DROP);
        if (dropAt != null) T = dropAt - this.music.heard();
      }
      this.seq = { t0: this.tick, T, dropAt, startCT, said: false, done: {} };
      ND.bus.emit('intro-launch');
    }

    // seconds since START; "has moment p come" (once)
    get t() { return this.seq ? (this.tick - this.seq.t0) / 60 : 0; }
    once(p) {
      if (this.t < TL[p] || this.seq.done[p]) return false;
      this.seq.done[p] = true;
      return true;
    }
    sfxTime() { return this.music ? this.music.ctx.currentTime + 0.01 : null; }

    update() {
      this.tick++;
      const w = this.w, h = w.hero, r = this.r;
      const T = this.tick;
      // hair in the breeze, blinking, looking around
      this.sway = 0.5 + 0.5 * Math.sin(T * 0.05) * (0.6 + 0.4 * Math.sin(T * 0.013));
      if (T >= this.nextBlink) { this.blinkUntil = T + 7; this.nextBlink = T + r.int(150, 330); }
      const mp = ND.renderer && ND.renderer.mp, talking = mp && mp.talk && mp.talk.cam && mp.talk.left > -0.2;

      if (this.state === 'lobby') {
        if (!talking && T >= this.nextLook) {
          this.view = r.pick(['left', 'left', 'side']);
          this.lookUntil = T + r.int(70, 170);
          this.nextLook = this.lookUntil + r.int(150, 360);
        }
        if (T >= this.lookUntil || talking) this.view = 'cam';
        // a drag every few seconds: lift, draw, lower, then breathe out
        if (!this.drag && !talking && T >= this.nextDrag) this.drag = { t0: T };
        if (this.drag) {
          const d = T - this.drag.t0;
          this.arm = d < 12 ? 'lift' : d < 62 ? 'drag' : d < 72 ? 'lift' : 'hold';
          if (d === 90) this.puff();
          if (d > 90) { this.drag = null; this.nextDrag = T + r.int(240, 480); }
        } else this.arm = 'hold';
      }

      if (this.state === 'launch') this.launchUpdate(mp);

      // cigarette smoke curling up from the ember (while he still has it)
      const tip = this.tipWorld();
      if (tip && T % 3 === 0) this.smoke.push({ x: tip[0], y: tip[1] - 1, vx: 0.05 + r() * 0.12, vy: -0.28 - r() * 0.2, age: 0, life: 70 + r() * 40, ph: r() * 6 });
      for (const p of this.smoke) {
        p.x += p.vx + Math.sin(p.age * 0.08 + p.ph) * 0.12;
        p.y += p.vy;
        p.vy *= 0.992;
        p.age++;
      }
      this.smoke = this.smoke.filter((p) => p.age < p.life);
      // the flicked cigarette: an arc, a bounce of sparks, a dying glow
      for (const e of this.embers) {
        if (e.spark) { e.x += e.vx; e.y += e.vy; e.vy += 0.12; e.age++; continue; }
        if (!e.down) {
          e.x += e.vx; e.y += e.vy; e.vy += 0.16;
          if (e.y >= e.floor) {
            e.y = e.floor; e.down = true;
            for (let i = 0; i < 7; i++) this.embers.push({ spark: true, x: e.x, y: e.y, vx: (r() - 0.6) * 2.2, vy: -0.6 - r() * 1.4, age: 0, life: 10 + r() * 14 });
          }
        }
        e.age++;
      }
      this.embers = this.embers.filter((e) => e.age < e.life);
      this.prompt = this.state === 'lobby' ? Math.min(1, this.prompt + 0.05) : Math.max(0, this.prompt - 0.08);
    }

    launchUpdate(mp) {
      const w = this.w, h = w.hero, S = this.seq, r = this.r, t = this.t;
      this.drag = null;
      this.view = 'cam';
      // --- on foot: flick the cigarette, stand up, turn up the street
      if (t < TL.stand) this.arm = 'flick';
      if (this.once('flick')) this.flickAt = this.tick + Math.round(0.12 * 60);
      if (this.tick === this.flickAt) {
        const tip = this.tipWorld();
        if (tip) this.embers.push({ x: tip[0], y: tip[1], vx: -2.4, vy: -2.2, floor: FOOT_Y + 3, age: 0, life: 150 });
        this.cigGone = true;
      }
      if (t >= TL.stand && t < TL.turn) { this.arm = 'down'; this.pose = 'stand'; this.lift = 1; if (t > TL.stand + 0.06) this.view = 'left'; }
      // --- the side view: walk to the door and open it; then, old-school, he's
      // simply in the seat (one cut), and the door slams
      let pose = null;
      if (t >= TL.turn && t < TL.closeEnd) {
        const ph = (x) => ((202 - x) / STRIDE) * Math.PI * 2;
        if (t < TL.walkEnd) {
          const x = 202 - 23 * span(t, TL.turn, TL.walkEnd);
          pose = walkAt(x, ph(x));
        } else if (t < TL.cut) {
          pose = lerp(walkAt(179, ph(179)), REACH, ease(span(t, TL.walkEnd, TL.reachEnd)));
        } else {
          pose = Object.assign(lerp(SEATED, SEATED, 0), { small: true, inside: { torso: 1, head: 1, arm: 1, farArm: 1, thigh: 1, shin: 1, farLeg: 1 } });
        }
        pose.blink = this.tick < this.blinkUntil;
        pose.sway = this.sway;
        this.profile = ND.renderDudeProfile(pose);
        h.seat = this.profile.inC ? { c: this.profile.inC, box: this.profile.box } : null;
      } else {
        this.profile = null;
        if (t >= TL.closeEnd) h.seat = null;
      }
      this.hidden = t >= TL.turn;
      if (this.once('doorOpen') && this.music) this.music.sfxDoor(this.sfxTime(), false);
      if (t >= TL.doorOpen && t < TL.closeStart) h.door = ease(span(t, TL.doorOpen, TL.doorOpened));
      if (t >= TL.closeStart) {
        h.door = 1 - span(t, TL.closeStart, TL.closeEnd) ** 2; // swung shut, hard
        if (t >= TL.closeEnd && !h.driverIn) {
          h.door = 0; h.driverIn = true; h.seat = null;
          if (this.music) this.music.sfxDoor(this.sfxTime(), true);
        }
      }
      // --- in the car: start her up
      if (this.once('ignite') && this.music) this.music.engineStart(this.sfxTime());
      if (t >= TL.ignite) {
        const d = Math.round((t - TL.ignite) * 60);
        h.idleBob = d < 28 ? (d % 6 < 3 ? 1 : 0) : d < 40 ? (d % 4 < 2 ? 1 : 0) : 0;
        if (t >= TL.catch) {
          h.lights = t < TL.catch + 0.2 ? (ND.hash(d, 77) < 0.6 ? 1 : 0.2) : 1;
          h.engine = 1;
          h.podsUp = true; // and the pop-ups come up
        }
        if (this.once('catch')) for (let i = 0; i < 9; i++) h.smoke.push({ x: 290 + r() * 3, y: 62 + r() * 2, vx: 0.4 + r() * 0.6, vy: -0.15 - r() * 0.25, age: 0, life: 40 + r() * 30, ph: r() * 6, exh: true });
      }
      // shades on, then a look at us
      if (t >= TL.shades) h.shades = ease(span(t, TL.shades, TL.shadesOn));
      if (t >= TL.cam && !S.go) h.lookCam = true;
      // a cigarette: lighter up, flame, lit, a puff of smoke
      if (t >= TL.lighter && t < TL.lighterDown) {
        h.lighter = span(t, TL.lighter, TL.lighterDown);
        h.flame = t >= TL.flame && t < TL.flameOut ? 0.7 + 0.3 * ND.noise(t * 30, 2.2, 9) : 0;
      } else { h.lighter = null; h.flame = 0; }
      if (t >= TL.lit && !S.go) h.cig = 'cam';
      if (this.once('puff') && h.emberAt) {
        const [mx, my] = [h.emberAt[0] - 4, h.emberAt[1] - 1];
        for (let i = 0; i < 12; i++) h.smoke.push({ x: mx + r() * 2, y: my + r() * 2, vx: 0.2 + r() * 0.5, vy: -0.25 - r() * 0.3, age: 0, life: 50 + r() * 30, ph: r() * 6 });
      }
      if (h.cig && h.emberAt && this.tick % 4 === 0) h.smoke.push({ x: h.emberAt[0], y: h.emberAt[1] - 1, vx: 0.05 + r() * 0.1, vy: -0.3 - r() * 0.15, age: 0, life: 40 + r() * 20, ph: r() * 6 });
      // his line, ending on the drop (once his voice is loaded and he's lit up)
      if (!S.said && this.music && S.dropAt != null && t >= TL.cam) S.said = this.music.goLine(S.dropAt, S.startCT + TL.line);
      // the drop: she goes
      const goT = S.dropAt != null && this.music ? S.dropAt - this.music.heard() : S.T - t;
      if (!S.go && goT <= 0.02) {
        S.go = this.tick;
        h.shades = 1; h.lights = 1; h.podsUp = true; h.idleBob = 0; h.lighter = null; h.flame = 0;
        w.parked = false;
        w.weather.hold = false;
        w.speedTarget = SPEED;
        if (this.music) this.music.engineGo(this.music.ctx.currentTime);
        if (ND.signState) ND.signState.surge = 0.6;
        for (let i = 0; i < 14; i++) h.smoke.push({ x: 290 + r() * 4, y: 61 + r() * 3, vx: 0.8 + r() * 1.4, vy: -0.2 - r() * 0.3, age: 0, life: 30 + r() * 30, ph: r() * 6, exh: true });
      }
      if (S.go) {
        const since = (this.tick - S.go) / 60;
        // a proper launch, then the drift in the lane fades back in
        w.speed = Math.min(SPEED * 1.15, w.speed + 0.11);
        h.drift = Math.min(1, h.drift + 1 / 180);
        // eyes back on the road, cigarette in his lips; then the arm goes out
        if (since > 0.7) { h.lookCam = false; if (h.cig) h.cig = 'side'; }
        if (since > 1.3 && !S.armOut) { S.armOut = true; h.armQuiet = true; h.armHoldUntil = w.tick; }
        if (h.armOut > 0) h.cig = null;
        if (since > 1.9) {
          this.state = 'done';
          h.drift = 1;
          ND.bus.emit('intro-done');
        }
      }
    }

    // breathe out: a cloud from his mouth, drifting up and away
    puff() {
      const r = this.r, [mx, my] = this.mouthWorld();
      for (let i = 0; i < 12; i++) this.smoke.push({ x: mx + r() * 2, y: my + r() * 2, vx: 0.25 + r() * 0.55, vy: -0.2 - r() * 0.35, age: 0, life: 50 + r() * 40, ph: r() * 6, big: true });
    }

    // where he stands this frame (sprite top-left)
    origin() {
      const h = this.w.hero;
      return [Math.round(h.x + h.dx + LEAN_X + this.walk - this.D.W / 2), FOOT_Y - this.D.FOOT - this.lift];
    }
    frameName() {
      if (this.state === 'launch') return this.pose || this.arm;
      return this.arm;
    }
    tipWorld() {
      if (this.hidden || this.cigGone) return null;
      const f = this.D.frames[this.frameName()];
      if (!f || !f.tip) return null;
      const [ox, oy] = this.origin();
      return [ox + f.tip[0], oy + f.tip[1]];
    }
    mouthWorld() {
      const [ox, oy] = this.origin();
      return [ox + this.D.HX + 8, oy + this.D.HY + 13];
    }

    // --- drawing -----------------------------------------------------------------------
    draw(R, rr) {
      if (this.profile && this.profile.outC) {
        // walking to the door and getting in: the parts of him still outside the car
        const h = this.w.hero, P = this.profile;
        const ox = Math.round(h.x + h.dx) + P.box.x, oy = h.y + P.box.y;
        rr.reflect(P.outC, ox, FOOT_Y, 92 - P.box.y + 1, 0.3, R.t, 70);
        R.c.drawImage(P.outC, ox, oy);
        rr.occlude(P.outC, ox, oy);
      }
      if (this.hidden || this.state === 'done') { this.drawEmbers(R); return; }
      const { c, g } = R;
      const D = this.D, fr = D.frames[this.frameName()];
      const cross = this.frameName() in { hold: 1, lift: 1, drag: 1, flick: 1 };
      const mp = rr.mp, tk = mp && mp.talk;
      let view = this.view, mouth = 0;
      if (tk && tk.cam && this.state === 'lobby') {
        view = 'cam';
        mouth = tk.mouth > 0.55 ? 2 : tk.mouth > 0.2 ? 1 : 0;
      }
      if (this.arm === 'drag' && !mouth) mouth = 0;
      const blink = this.tick < this.blinkUntil;
      const x = this.cx;
      x.clearRect(0, 0, D.W, D.H);
      x.drawImage(fr.c, 0, 0);
      ND.drawDudeHead(x, D.HX + (cross ? 1 : 0), D.HY, view, mouth, blink, this.sway);
      const [ox, oy] = this.origin();
      rr.reflect(this.comp, ox, FOOT_Y, D.H, 0.3, R.t, 70);
      // a soft contact shadow on the road
      c.fillStyle = 'rgba(10,4,20,0.35)';
      c.fillRect(ox + 8, FOOT_Y - 1, D.W - 16, 2);
      c.drawImage(this.comp, ox, oy);
      rr.occlude(this.comp, ox, oy);
      // the ember glows (brighter while he draws on it)
      const tip = this.tipWorld();
      if (tip) {
        const hot = this.arm === 'drag' ? 1 : 0.55 + 0.25 * ND.noise(R.t * 8, 1.7, 5);
        c.fillStyle = `rgb(255,${(120 + hot * 120) | 0},${(40 + hot * 80) | 0})`;
        c.fillRect(Math.round(tip[0]), Math.round(tip[1]), 1, 1);
        g.fillStyle = `rgba(255,120,40,${0.5 + hot * 0.5})`;
        g.fillRect(Math.round(tip[0]) - 1, Math.round(tip[1]) - 1, 3, 3);
      }
      this.drawEmbers(R);
    }
    drawEmbers(R) {
      const { c, g } = R;
      for (const e of this.embers) {
        const k = e.age / e.life;
        if (e.spark) {
          c.fillStyle = `rgba(255,${(200 - k * 120) | 0},60,${1 - k})`;
          c.fillRect(Math.round(e.x), Math.round(e.y), 1, 1);
          continue;
        }
        const glow = e.down ? Math.max(0, 1 - k * 1.2) : 1;
        c.fillStyle = `rgba(255,160,70,${glow})`;
        c.fillRect(Math.round(e.x), Math.round(e.y), 2, 1);
        g.fillStyle = `rgba(255,110,40,${glow * 0.8})`;
        g.fillRect(Math.round(e.x) - 1, Math.round(e.y) - 1, 4, 3);
      }
    }

    // after bloom: his smoke, and the START prompt, crisp on top
    drawPost(R, rr) {
      const { c } = R;
      for (const p of this.smoke) {
        const k = p.age / p.life;
        c.fillStyle = `rgba(190,176,222,${(p.big ? 0.55 : 0.4) * Math.pow(1 - k, 0.8)})`;
        const sz = p.big ? 1 + Math.floor(k * 3) : k > 0.5 ? 2 : 1;
        c.fillRect(Math.round(p.x), Math.round(p.y), sz, sz);
      }
      if (this.prompt > 0.01) this.drawPrompt(R, rr);
    }

    drawPrompt(R, rr) {
      const { c } = R;
      if (!this.pm) {
        const big = ND.textMask('PRESS START', { scale: 2, gap: 2 });
        const small = ND.textMask(ND.touch ? 'TAP HERE' : 'ENTER  SPACE  OR CLICK HERE', { small: true, gap: 1 });
        const snd = ND.textMask(ND.touch ? 'TAP ANYWHERE ELSE FOR SOUND' : 'CLICK ANYWHERE FOR SOUND', { small: true, gap: 1 });
        const bw = Math.max(big.w, small.w) + 20, bh = big.h + small.h + 16;
        const pb = new ND.PB(bw, bh), gl = new ND.PB(bw, bh);
        for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
          const edge = x === 0 || y === 0 || x === bw - 1 || y === bh - 1;
          pb.set(x, y, edge ? 0 : ND.pack(14, 6, 28, 200));
        }
        ND.neonPath(pb, gl, [[1, 1], [bw - 2, 1], [bw - 2, bh - 2], [1, bh - 2], [1, 1]], ...ND.NEON.cyan);
        ND.neonMask(pb, gl, big, Math.round((bw - big.w) / 2), 6, ...ND.NEON.pink);
        ND.neonMask(pb, gl, small, Math.round((bw - small.w) / 2), 8 + big.h + 3, ...ND.NEON.white, { halo: false });
        const sp = new ND.PB(snd.w + 4, snd.h + 4), sg = new ND.PB(snd.w + 4, snd.h + 4);
        ND.neonMask(sp, sg, snd, 2, 2, ...ND.NEON.cyan, { halo: false });
        this.pm = { box: ND.sprite(pb, gl), snd: ND.sprite(sp, sg) };
      }
      const P = this.pm, b = P.box;
      const bx = Math.round((W - b.w) / 2), by = 312 - Math.max(Math.round(rr.letter || 0), rr.cropY || 0);
      this.box = { x: bx, y: by, w: b.w, h: b.h };
      const blink = this.state !== 'lobby' || Math.floor(R.t * 1.6) % 5 !== 4;
      c.globalAlpha = this.prompt * (blink ? 1 : 0.35);
      c.drawImage(b.c, bx, by);
      if (b.g) {
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = this.prompt * (blink ? 0.7 : 0.2);
        c.drawImage(b.g, bx, by);
        c.globalCompositeOperation = 'source-over';
      }
      if (!(ND.music && ND.music.ctx && ND.music.enabled) && !ND.muted) {
        c.globalAlpha = this.prompt * (0.6 + 0.4 * Math.sin(R.t * 3));
        c.drawImage(P.snd.c, Math.round((W - P.snd.w) / 2), by - P.snd.h - 3);
      }
      c.globalAlpha = 1;
    }

    // is a point (world pixels) on the START button?
    hits(x, y) {
      const b = this.box;
      return !!b && x >= b.x - 6 && x <= b.x + b.w + 6 && y >= b.y - 6 && y <= b.y + b.h + 6;
    }
  }

  ND.Intro = Intro;
})();
