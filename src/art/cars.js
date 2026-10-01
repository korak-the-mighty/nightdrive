/* Nightdrive — the hero 80s supercar (with driver) and background traffic. */
(function () {
  'use strict';
  const ND = window.ND;
  const { rgb } = ND;

  // ===========================================================================
  // Hero car — white flat-12 wedge with side strakes, facing left.
  // Local coords: 300 x 76, ground contact on row 75.
  // ===========================================================================
  const HW = 300, HH = 76;
  const WHEEL_R = 21;
  const WHEELS = [[66, 54], [246, 54]];

  const TOP = [
    [1, 42], [4, 39.5], [14, 37.6], [34, 35.2], [60, 31.8], [84, 28.6], [100, 26.4], [104, 26],
    [140, 2], [146, 1.2], [196, 1.2], [203, 2.2], [212, 4.6],
    [232, 9.5], [252, 13.4], [272, 15.8], [288, 17.2], [295, 18.6], [298, 21],
  ];

  function topY(x) {
    if (x <= TOP[0][0]) return TOP[0][1];
    for (let i = 1; i < TOP.length; i++) {
      if (x <= TOP[i][0]) {
        const a = TOP[i - 1], b = TOP[i];
        return a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
      }
    }
    return 22;
  }

  function arch(pts, cx, cy, r, sill) {
    const a0 = Math.asin((sill - cy) / r);
    const a1 = -Math.PI - a0;
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  }

  function bodyPolygon() {
    const pts = TOP.slice();
    pts.push([299, 30], [299, 50], [298, 58], [296, 61.5], [272, 62]);
    arch(pts, WHEELS[1][0], WHEELS[1][1], 24.5, 62);
    pts.push([220, 62], [92, 62]);
    arch(pts, WHEELS[0][0], WHEELS[0][1], 24.5, 62);
    pts.push([40, 62], [8, 61.5], [3, 60], [0.6, 55], [0.4, 46]);
    return pts;
  }

  // Driver: solid profile facing left (forehead, wraparound shades, nose,
  // lips, chin, jaw, ear, neck) with a blond mullet, pastel jacket.
  // Origin placed at car-local (144, 5); rows past the beltline are clipped.
  const DRIVER = [
    '......kkkkkk......',
    '....kkhHHHHhkk....',
    '...khHHHhhhhhhk...',
    '..khHhhhhhhhhhdk..',
    '..khhhhhhhhhhhddk.',
    '.khhhhhhhhhhhhdddk',
    '.kShhhhshhhhhhdddk',
    '..SSSssssshhhhdddk',
    '.GGGGGGGGGehhhdddk',
    '..GgGGssszeehhdddk',
    'SSSSssssszeehhdddk',
    '..SSsssssszzhhdddk',
    '.SSSssssszzzhhdddk',
    '..SSsssszzzzhhddk.',
    '..Ssssszzzzzhhdddk',
    '....zzzzzzzzhhdddk',
    '......nnnnnnhhddk.',
    '......nnnnnhhdddk.',
    '.....cwnnnnbhddk..',
    '...cwbbbbbbbbbbBB.',
    '..cwbbbwbbbbbbbbBB',
  ];
  // Talking in profile: the lips part at the front of the face.
  const DRIVER_TALK = [
    { 12: '.mSSssssszzzhhdddk' },
    { 12: '.mmSssssszzzhhdddk', 13: '..mSsssszzzzhhddk.' },
  ];
  // Turned to the camera: shades, a grin, the mullet framing the face.
  const DRIVER_CAM = [
    '.....kkkkkkk......',
    '...kkhHHHHHhkk....',
    '..khHHHhhhhhhhk...',
    '.khHhhhhhhhhhhdk..',
    '.khhhhhhhhhhhhddk.',
    'khhhSSSSSSShhhdddk',
    'khhSSSSSSSSShhdddk',
    'khSSSSSSSSSSShdddk',
    'khGGGGGGGGGGGhdddk',
    'khGgGGGsGgGGGhdddk',
    'khSSSSSsSSSSShdddk',
    'khSSSSszsSSSShdddk',
    '.hSSSSSSSSSSShdddk',
    '.hSSSlllllSSShddk.',
    '.hsSSSSSSSSSshdddk',
    '..hzsssssssszhdddk',
    '...hzzzzzzzzhhddk.',
    '....nnnnnnnhhdddk.',
    '....cwnnnnnbhddk..',
    '...cwbbbbbbbbbbBB.',
    '..cwbbbwbbbbbbbbBB',
  ];
  const DRIVER_CAM_TALK = [
    {},
    { 13: '.hSSlTTTTTlSShddk.' },
    { 13: '.hSSlTTTTTlSShddk.', 14: '.hsSSlmmmlSSshdddk' },
  ];
  const DRIVER_PAL = {
    H: rgb('#fff2b0'), h: rgb('#f2c662'), d: rgb('#c48c36'), k: rgb('#7a4e22'),
    S: rgb('#f8c6a6'), s: rgb('#e49c7c'), z: rgb('#b06a54'), e: rgb('#c4705a'), n: rgb('#a8624e'),
    G: rgb('#0c0a14'), g: rgb('#ff7ad8'),
    c: rgb('#3a3446'), w: rgb('#262030'), b: rgb('#96c2f0'), B: rgb('#5c80bc'), // dark tee under the blazer
    l: rgb('#d07a6a'), T: rgb('#fff8ee'), m: rgb('#5a1a24'), E: rgb('#2a1420'),
  };
  const DRIVER_O = [144, 5];

  // Before the shades go on (the opening scene): eyes and brows instead.
  const BARE = { 7: '..Sddssssshhhhdddk', 8: '.SSSEsssssehhhdddk', 9: '..SSSSssszeehhdddk' };
  const BARE_CAM = { 7: 'khSddSSSSSddShdddk', 8: 'khSEESSSSSEEShdddk', 9: 'khSSSSSsSSSSShdddk' };

  function genDriver() {
    const w = DRIVER[0].length, h = DRIVER.length;
    const draw = (rows, over = {}) => {
      const pb = new ND.PB(w, h);
      rows.forEach((base, y) => {
        const row = over[y] || base;
        if (row.length !== w) throw new Error('driver row ' + y + ' has length ' + row.length);
        [...row].forEach((ch, x) => {
          if (ch === '.') return;
          const c = DRIVER_PAL[ch];
          pb.set(x, y, ND.pack(c[0], c[1], c[2]));
        });
      });
      return pb.canvas();
    };
    // the shades coming up from his hand to his eyes (lower rows first)
    const slide = [4, 2].map((dy) => {
      const over = Object.assign({}, BARE);
      for (const r of [8, 9]) {
        const shade = DRIVER[r], row = [...(over[r + dy] || DRIVER[r + dy])];
        [...shade].forEach((ch, x) => { if (ch === 'G' || ch === 'g') row[x] = ch; });
        over[r + dy] = row.join('');
      }
      // fingers holding the arm of the shades
      const hr = [...(over[10 + dy] || DRIVER[10 + dy])];
      hr[12] = 'S'; hr[13] = 'S';
      over[10 + dy] = hr.join('');
      return draw(DRIVER, over);
    });
    return {
      c: draw(DRIVER),
      talk: DRIVER_TALK.map((o) => draw(DRIVER, o)),     // mouth half / fully open
      cam: DRIVER_CAM_TALK.map((o) => draw(DRIVER_CAM, o)), // facing us: closed, grin, open
      bare: draw(DRIVER, BARE),
      bareTalk: DRIVER_TALK.map((o) => draw(DRIVER, Object.assign({}, BARE, o))),
      bareCam: DRIVER_CAM_TALK.map((o) => draw(DRIVER_CAM, Object.assign({}, BARE_CAM, o))),
      slide,
      x: DRIVER_O[0], y: DRIVER_O[1],
    };
  }

  // The driver's arm out of the window: sleeve resting on the door sill,
  // forearm hanging outside, cigarette between the fingers. Frames cover
  // the forearm's swing; the ember is drawn live.
  function genDriverArm() {
    const OX = 128, OY = 19, AW = 30, AH = 32, N = 11;
    const th0 = -0.08, th1 = 0.34;
    const skin = rgb('#e8a282'), skinL = rgb('#f8c6a6'), skinD = rgb('#a8604c');
    const sleeve = rgb('#96c2f0'), sleeveL = rgb('#d4ecff'), sleeveD = rgb('#5c80bc');
    const frames = [];
    for (let f = 0; f < N; f++) {
      const th = th0 + (f / (N - 1)) * (th1 - th0);
      const ux = -Math.sin(th), uy = Math.cos(th);
      const E = [146.2 - OX, 28.4 - OY];
      const Wr = [E[0] + ux * 10.5, E[1] + uy * 10.5];
      const Hd = [Wr[0] + ux * 2.3, Wr[1] + uy * 2.3];
      // forearm + hand silhouette, shaded by exposure (lit from the front/left)
      const arm = new ND.PB(AW, AH);
      const steps = 24;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        arm.disc(E[0] + (Wr[0] - E[0]) * t, E[1] + (Wr[1] - E[1]) * t, 2.05 - t * 0.5, 1);
      }
      arm.disc(Hd[0], Hd[1], 1.95, 1);
      arm.disc(Hd[0] - 0.8, Hd[1] + 1.1, 1.1, 1); // curled fingers
      const pb = new ND.PB(AW, AH);
      for (let y = 0; y < AH; y++)
        for (let x = 0; x < AW; x++) {
          if (!arm.get(x, y)) continue;
          const lf = arm.get(x - 1, y), rt = arm.get(x + 1, y);
          const c = !lf ? skinL : !rt ? skinD : skin;
          pb.set(x, y, ND.pack(c[0], c[1], c[2]));
        }
      // watch band across the wrist
      const px = uy, py = -ux;
      for (let k = -1.6; k <= 1.6; k += 0.5) {
        const wx = Wr[0] - ux * 0.8 + px * k, wy = Wr[1] - uy * 0.8 + py * k;
        pb.set(Math.round(wx), Math.round(wy), ND.pack(...(k < 0 ? [255, 214, 90] : [184, 138, 32])));
      }
      // rolled sleeve resting on the sill (drawn over the elbow)
      const sc = [149 - OX, 25.6 - OY];
      for (let y = -3; y <= 3; y++)
        for (let x = -6; x <= 6; x++) {
          const d = (x * x) / 27 + (y * y) / 8.5;
          if (d > 1) continue;
          let c = x < -2 ? sleeveL : x > 2 ? sleeveD : sleeve;
          if (y >= 2) c = ND.mix(c, sleeveD, 0.5);
          if ((x + 6) % 4 === 1 && y < 2) c = [255, 255, 255];
          pb.set(Math.round(sc[0] + x), Math.round(sc[1] + y), ND.pack(c[0], c[1], c[2]));
        }
      // cuff
      for (let x = -3; x <= 1; x++) pb.set(Math.round(sc[0] + x - 1), Math.round(sc[1] + 2), ND.pack(228, 242, 255));
      // cigarette: filter at the fingers, paper pointing forward and down
      const ca = 0.42 - th * 0.35;
      const dx = -Math.cos(ca), dy = Math.sin(ca);
      const C0 = [Hd[0] - 1.3, Hd[1] + 0.9];
      pb.set(Math.round(C0[0]), Math.round(C0[1]), ND.pack(216, 150, 80));
      for (let k = 1; k <= 4; k++) pb.set(Math.round(C0[0] + dx * k), Math.round(C0[1] + dy * k), ND.pack(246, 242, 232));
      const tip = [OX + C0[0] + dx * 5, OY + C0[1] + dy * 5];
      frames.push({ c: pb.canvas(), tip, th });
    }
    return { frames, ox: OX, oy: OY, th0, th1, N };
  }

  function genHeroCar() {
    const pb = new ND.PB(HW, HH), gl = new ND.PB(HW, HH);
    const poly = bodyPolygon();
    const P = (c) => ND.pack(c[0], c[1], c[2]);

    // ---- underbody shadow between the wheels (we see the dark road under the car)
    for (let y = 60; y < 73; y++)
      for (let x = 30; x < 286; x++) {
        const a = ND.clamp(1 - (y - 60) / 13, 0, 1) * 0.92;
        pb.set(x, y, ND.pack(10, 6, 18, a * 255));
      }

    // ---- body paint
    // bright upper flank, a crisp "horizon" reflection, darker lower flank
    const ramp = [
      [0, rgb('#ffffff')], [0.1, rgb('#f7f4fd')], [0.46, rgb('#e9e4f6')], [0.52, rgb('#dcd6ee')],
      [0.535, rgb('#b9b1d6')], [0.62, rgb('#c4bcdf')], [0.82, rgb('#a69ec6')], [0.93, rgb('#8a82ac')], [1, rgb('#645c86')],
    ];
    const tintTop = rgb('#ffc8ee'), tintLow = rgb('#7fc8ff'), tintWarm = rgb('#ffae8a'), tintMag = rgb('#e89aff');
    pb.polyFn(poly, (x, y) => {
      const ty = topY(x);
      const dt = y - ty;
      let c;
      if (dt < 3.5 && x < 292) {
        // upper surfaces: hood, roof, deck — reflect the pink sky glow
        c = ND.mix(rgb('#fff0fa'), tintTop, 0.3 + (dt / 3.5) * 0.35);
        if (dt < 1) c = rgb('#ffffff');
      } else {
        const t = ND.clamp((y - 24) / 38, 0, 1);
        c = ND.grad(ramp, t);
        // environment tints: pink neon from above-behind, cyan from the street, warm lamps low
        c = ND.mix(c, tintTop, ND.clamp(0.28 - t * 0.5, 0, 0.28) * (0.4 + (x / HW) * 0.6));
        c = ND.mix(c, tintMag, ND.clamp(1 - Math.abs(t - 0.62) * 5, 0, 1) * 0.16);
        c = ND.mix(c, tintLow, ND.clamp((t - 0.55) * 0.9, 0, 0.3) * (1 - (x / HW) * 0.7));
        c = ND.mix(c, tintWarm, ND.clamp((t - 0.6) * 0.6, 0, 0.2) * (x / HW));
        // shoulder crease highlight
        if (Math.abs(dt - 4.5) < 0.6 && (x < 104 || x > 208)) c = ND.mix(c, [255, 255, 255], 0.7);
        if (Math.abs(dt - 5.5) < 0.6 && (x < 104 || x > 208)) c = ND.scale(c, 0.93);
        // front fender / rear haunch curvature: darker as the surface turns away
        const fx = Math.min(1, x / 18), rx = Math.min(1, (HW - x) / 14);
        c = ND.scale(c, 0.82 + 0.18 * Math.min(fx, rx));
      }
      if (y >= 61) c = rgb('#4e4870');
      pb.dset(x, y, c, 255, 6);
    });
    // lower body character line
    for (let x = 12; x < 290; x++) {
      if (x > 40 && x < 92) continue;
      if (x > 220 && x < 272) continue;
      pb.set(x, 57, ND.pack(150, 142, 186));
      pb.set(x, 58, ND.pack(118, 110, 158));
    }

    // tail face (slightly darker vertical plane)
    for (let y = 21; y < 61; y++) {
      pb.dset(298, y, rgb('#b4b0cc'), 255, 6);
      pb.dset(297, y, rgb('#d0cce0'), 255, 6);
    }
    // front bumper face / nose lip
    for (let y = 43; y < 61; y++) pb.dset(0, y, rgb('#bdb9d4'), 255, 6);
    pb.hline(4, 44, 60, P(rgb('#3a3654')));
    pb.hline(3, 42, 61, P(rgb('#24203a')));
    for (let x = 6; x < 38; x += 3) pb.set(x, 58, P(rgb('#5a5678'))); // lower grille slots

    // wheel arch interiors (dark) + lip highlight
    for (const [wx, wy] of WHEELS) {
      pb.discFn(wx, wy, 24.5, (x, y, d) => {
        if (y > 62) return;
        if (d > 0.96) pb.set(x, y, P(rgb('#e8e4f4')));
        else pb.set(x, y, P(d > 0.9 ? rgb('#2a2440') : rgb('#110d1a')));
      });
    }

    // ---- greenhouse
    // windshield seen edge-on: dark glass wedge with neon reflections
    // windshield seen from the side: smooth tinted glass between the rake and
    // the A-pillar, one soft reflection band
    const shield = [[101, 26.6], [104, 26], [140, 2], [146, 1.4], [146, 3.6], [143.5, 3.6], [113.5, 26.6]];
    pb.polyFn(shield, (x, y) => {
      let c = ND.mix(rgb('#30285e'), rgb('#141030'), ND.clamp((y - 2) / 24, 0, 1));
      pb.set(x, y, ND.pack(c[0], c[1], c[2]));
    });
    // frame highlight: the top pixel of each glass column (inside the outline)
    for (let x = 102; x <= 146; x++) {
      for (let y = 0; y < 28; y++) {
        const i = y * HW + x;
        if (pb.d[i] >>> 24 && y >= Math.floor(topY(x)) && ND.clamp(x, 101, 146) === x) {
          const inShield = y > topY(x) - 0.5 && y < topY(x) + 1.5;
          if (inShield) { pb.set(x, y, P(rgb('#eeeaf8'))); break; }
        }
      }
    }
    const glassDoor = [[114.5, 26], [144.5, 4], [172, 4], [172, 26]];
    const glassRear = [[176, 4], [197, 4], [202, 6], [206, 14], [208, 26], [176, 26]];
    pb.polyFn(glassRear, (x, y) => {
      const v = (y - 4) / 22;
      let c = ND.mix(rgb('#3a2f6a'), rgb('#140f28'), v);
      if ((x + y) % 11 < 2) c = ND.mix(c, rgb('#b09ad8'), 0.25);
      pb.set(x, y, ND.pack(c[0], c[1], c[2], 190));
    });
    pb.polyFn(glassDoor, (x, y) => {
      const v = (y - 4) / 22;
      const c = ND.mix(rgb('#2a2250'), rgb('#120e22'), v);
      pb.set(x, y, ND.pack(c[0], c[1], c[2], 165)); // open window: we see through to the far side
    });
    // A-pillar: one slim dark post with a lit leading edge
    pb.lineFn(113, 26, 143, 4, (x, y) => {
      pb.set(x, y, P(rgb('#8e88b0')));
      pb.set(x + 1, y, P(rgb('#1a1628')));
    });
    // B-pillar
    for (let y = 3; y < 27; y++) {
      pb.set(173, y, P(rgb('#1c1830')));
      pb.set(174, y, P(rgb('#2c2842')));
      pb.set(175, y, P(rgb('#48446a')));
    }
    // window frame / beltline rubber
    pb.hline(106, 208, 26, P(rgb('#1e1a2e')));
    pb.hline(106, 208, 27, P(rgb('#fdfbff')));
    // roof edge
    pb.hline(139, 200, 3, P(rgb('#cfc8e4')));
    // fuel filler on the buttress
    pb.discFn(216, 15, 4.2, (x, y, d) => { if (d > 0.72) pb.set(x, y, P(rgb('#b8b2d0'))); });
    pb.set(213, 13, P(rgb('#ffffff')));

    // ---- interior visible through the open window
    // steering wheel + dash
    // steering wheel rim and dash, inside the cabin behind the A-pillar
    pb.thick(136, 13, 138, 23, 0.9, P(rgb('#0e0a16')));
    pb.thick(121, 23, 140, 21, 1.1, P(rgb('#16121e')));
    // seat back / headrest
    for (let y = 6; y < 26; y++) for (let x = 162; x < 171; x++) {
      if (y < 9 && (x < 164 || x > 168)) continue;
      pb.set(x, y, P(x === 162 ? rgb('#3a3450') : rgb('#1a1626')));
    }

    // ---- side strakes
    for (let i = 0; i < 7; i++) {
      const y = 35 + i * 3;
      const xs = Math.round(111 + i * 0.6), xe = Math.round(196 - i * 0.4);
      for (let x = xs; x <= xe; x++) {
        const intake = x > 176;
        pb.set(x, y, P(intake ? rgb('#f2f0f8') : rgb('#ffffff')));
        pb.set(x, y + 1, P(intake ? rgb('#8e8aaa') : rgb('#d6d2e6')));
        if (x > xs) pb.set(x, y + 2, P(intake ? rgb('#0e0b16') : rgb('#6a6688')));
      }
      pb.set(xe + 1, y + 1, P(rgb('#b0acc8')));
    }
    // door shut lines
    pb.lineFn(105, 28, 107, 60, (x, y) => pb.set(x, y, P(rgb('#9894b4'))));
    for (let y = 28; y < 60; y++) if (y < 35 || y > 56) pb.set(173, y, P(rgb('#9894b4')));

    // ---- side mirror on the A-pillar
    pb.line(122, 19, 124, 19, P(rgb('#2a2440')));
    pb.polyFn([[115, 15.5], [120.5, 15], [122.5, 16.5], [122, 20.5], [116, 20.5], [114.5, 19]], (x, y) => {
      const c = y < 17 ? rgb('#ffffff') : y < 19 ? rgb('#e6e2f2') : rgb('#b4aed0');
      pb.set(x, y, P(c));
    });
    pb.hline(116, 121, 21, P(rgb('#4a4470')));

    // ---- lights
    const amber = rgb('#ffa21e'), red = rgb('#ff2438');
    for (let y = 45; y <= 48; y++) for (let x = 1; x <= 6; x++) { pb.set(x, y, P(ND.mix(amber, [255, 240, 200], x < 3 ? 0.4 : 0))); gl.set(x, y, ND.pack(255, 150, 30)); }
    for (let x = 28; x <= 33; x++) { pb.set(x, 46, P(amber)); pb.set(x, 47, P(ND.scale(amber, 0.75))); gl.set(x, 46, ND.pack(200, 110, 20)); }
    for (let y = 27; y <= 41; y++) for (let x = 293; x <= 298; x++) {
      const louvre = (y - 27) % 3 === 2;
      const c = louvre ? ND.scale(red, 0.35) : ND.mix(red, [255, 200, 200], x > 296 ? 0.3 : 0);
      pb.set(x, y, P(c));
      if (!louvre) gl.set(x, y, ND.pack(255, 30, 50));
    }
    for (let x = 277; x <= 282; x++) { pb.set(x, 44, P(red)); gl.set(x, 44, ND.pack(200, 20, 40)); }

    const body = ND.sprite(pb, gl);
    body.glowPts = { tail: [296, 34], front: [3, 46] };
    // the same lamps switched off (engine off, in the opening scene)
    const off = new ND.PB(HW, HH);
    for (let y = 45; y <= 48; y++) for (let x = 1; x <= 6; x++) off.set(x, y, P(ND.mix(rgb('#8a6a4a'), rgb('#d8d0e4'), x < 3 ? 0.4 : 0)));
    for (let x = 28; x <= 33; x++) { off.set(x, 46, P(rgb('#9a7a5a'))); off.set(x, 47, P(rgb('#6a5440'))); }
    for (let y = 27; y <= 41; y++) for (let x = 293; x <= 298; x++) off.set(x, y, P((y - 27) % 3 === 2 ? rgb('#2a0a14') : ND.mix(rgb('#6a1a2a'), rgb('#a05a6a'), x > 296 ? 0.3 : 0)));
    for (let x = 277; x <= 282; x++) off.set(x, 44, P(rgb('#5a1422')));
    body.lampsOff = off.canvas();

    // Paint mask for live environment reflections: strongest on the upper
    // flank above the paint's horizon line, faint on the lower flank.
    const mask = new ND.PB(HW, HH);
    mask.polyFn(poly, (x, y) => {
      if (y > 60) return;
      const dt = y - topY(x);
      const a = dt < 3.5 ? 0.2 : y < 44 ? 0.3 : 0.55 + ND.clamp((y - 44) / 14, 0, 1) * 0.45;
      mask.set(x, y, ND.pack(255, 255, 255, a * 255));
    });
    for (const g of [shield, glassDoor, glassRear]) mask.polyFn(g, (x, y) => mask.set(x, y, 0));
    for (const [wx, wy] of WHEELS) mask.discFn(wx, wy, 24.5, (x, y) => { if (y <= 62) mask.set(x, y, 0); });
    mask.rect(176, 34, 24, 24, 0);
    mask.rect(0, 44, 8, 6, 0);
    mask.rect(290, 25, 10, 20, 0);
    body.mask = mask.canvas();
    return body;
  }

  // Five-spoke star rims with motion blur; 12 frames cover 72 degrees.
  function genWheelFrames(R = WHEEL_R, spokes = 5, blur = 0.2) {
    const S = R * 2 + 1;
    const frames = [];
    const nF = 12;
    const period = (Math.PI * 2) / spokes;
    for (let f = 0; f < nF; f++) {
      const pb = new ND.PB(S, S);
      const th = (f / nF) * period;
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const dx = x - R, dy = y - R;
          const d = Math.hypot(dx, dy);
          if (d > R + 0.4) continue;
          const ang = Math.atan2(dy, dx);
          const light = 0.5 - 0.5 * Math.cos(ang + Math.PI * 0.75); // lit from upper-left
          let c;
          const rr = d / R;
          if (rr > 0.9) {
            c = ND.mix(rgb('#100c16'), rgb('#3a344c'), Math.pow(light, 3) * 0.9);
          } else if (rr > 0.71) {
            c = ND.mix(rgb('#1a1524'), rgb('#2c2638'), light * 0.8);
            if (rr > 0.86 && rr < 0.9) c = ND.mix(c, rgb('#3c364e'), 0.5);
          } else if (rr > 0.66) {
            c = ND.mix(rgb('#7a7a92'), rgb('#f0f0fa'), light);
          } else {
            // rim face: spokes with motion blur
            let cover = 0;
            const samples = 4;
            for (let k = 0; k < samples; k++) {
              const a = ang - th - (k / samples) * blur; // trail lies behind a counter-clockwise spin
              let m = ((a % period) + period) % period;
              if (m > period / 2) m -= period;
              const halfW = (2.9 - d * 0.07) / Math.max(1.5, d);
              if (Math.abs(m) < halfW + 0.02 && d > 3) cover++;
            }
            cover /= samples;
            let gap = rgb('#1c1828');
            if (d > 7 && d < 12.5) gap = ND.mix(rgb('#3c3850'), rgb('#56526a'), light * 0.5); // brake disc
            if (d > 8 && d < 12.5 && ang > -1.0 && ang < -0.2) gap = rgb('#2a2636'); // caliper (fixed)
            const spoke = ND.mix(rgb('#8c8ca4'), rgb('#e6e6f2'), light);
            c = ND.mix(gap, spoke, cover);
            if (d <= 4.6) c = ND.mix(rgb('#8c8ca4'), rgb('#dcdcea'), light);
            if (d <= 2.6) c = rgb('#f2c230');
            if (d <= 1.0) c = rgb('#3a2a10');
          }
          pb.set(x, y, ND.pack(c[0], c[1], c[2]));
        }
      frames.push(pb.canvas());
    }
    return { frames, R, S, period };
  }

  // ===========================================================================
  // Traffic — 70s–80s American cars in the far lane, facing left: full-size
  // sedans, personal-luxury coupes with padded vinyl roofs, a Trans Am, a
  // woodie wagon, a square-body pickup, a Checker cab and a cruiser.
  // The models are laid out on a 162 x 48 design grid and drawn K = 1.25 times
  // that, so a sedan's roof comes up to the head of someone walking past.
  // Sprite 203 x 60, ground contact on row 59, wheel centres on row 46.
  // ===========================================================================
  const K = 1.25;
  const TW = Math.ceil(162 * K), TH = 60, TG = 59, WY = 46, WR = 13, ARCH = 14.6;
  const MODELS = {
    // '77–'90 full-size sedan (Caprice, LTD): flat hood and deck, formal roof
    sedan: {
      top: [[0, 26], [1, 22], [3, 20.5], [48, 19.5], [51, 18.5], [61, 8.5], [64, 7.8], [101, 7.8], [104, 8.6], [114, 18.6], [117, 19.3], [157, 19.8], [160, 21.5], [161, 26]],
      wheels: [30, 126], square: 2.6, rocker: 36, belt: 19, trim: 27, bumpers: true,
      windows: [[[52, 18], [61, 9.4], [81, 9.4], [81, 18]], [[84, 9.4], [98, 9.4], [98, 18], [84, 18]]],
      doors: [82.5, 111], vinylFrom: 62, heads: [70, 91], wheel: 'cover', ww: true,
    },
    // personal-luxury coupe (Eldorado, Continental Mark V): endless hood,
    // padded vinyl roof with an opera window, stand-up hood ornament
    coupe: {
      top: [[0, 26], [1, 22], [3, 20.3], [58, 19.3], [61, 18.3], [71, 8.8], [74, 8.2], [102, 8.2], [106, 9], [117, 18.6], [120, 19.3], [157, 19.8], [160, 21.5], [161, 26]],
      wheels: [34, 126], square: 2.3, rocker: 36, belt: 19, trim: 27, bumpers: true,
      windows: [[[62, 18], [71, 9.8], [98, 9.8], [98, 18]]],
      doors: [100], vinylFrom: 72, opera: [105, 12.5], heads: [84], wheel: 'wire', ww: true, ornament: true,
    },
    // '77–'81 Trans Am: beak nose, shaker scoop, long fastback glass, ducktail
    muscle: {
      top: [[0, 29], [2, 25.5], [7, 23], [52, 21.5], [55, 20.5], [69, 11], [72, 10.3], [89, 10.3], [93, 11], [127, 19.5], [150, 19.8], [151, 17.4], [159, 17.2], [161, 21], [161, 28]],
      wheels: [31, 124], square: 2, rocker: 35.5, belt: 20.5,
      windows: [[[56, 20], [69, 11.8], [88, 11.8], [88, 20]], [[91, 12.2], [93, 12.2], [118, 19.6], [91, 19.6]]],
      doors: [90], heads: [76], wheel: 'snowflake', scoop: [30, 43], airdam: true, stripe: true,
    },
    // woodie wagon (Country Squire): the long roof, wood-grain sides, a roof rack
    wagon: {
      top: [[0, 26], [1, 22], [3, 20.5], [48, 19.5], [51, 18.5], [61, 8.5], [64, 7.8], [153, 7.8], [157, 8.6], [159, 11], [160, 20], [161, 26]],
      wheels: [30, 128], square: 2.6, rocker: 36, belt: 19, trim: 27, bumpers: true,
      windows: [[[52, 18], [61, 9.4], [81, 9.4], [81, 18]], [[84, 9.4], [108, 9.4], [108, 18], [84, 18]], [[112, 9.4], [150, 9.4], [154, 11], [155, 18], [112, 18]]],
      doors: [82.5, 110], heads: [70, 94], wheel: 'cover', ww: true, wood: true, rack: [70, 148],
    },
    // square-body pickup (C10): high hood, short cab, open bed, two-tone
    pickup: {
      top: [[0, 25], [1, 20], [3, 18.4], [46, 18], [49, 17], [56, 7.6], [58, 7], [76, 7], [78, 8], [79, 17.5], [158, 17.5], [160, 18.5], [161, 25]],
      wheels: [30, 124], square: 2.8, rocker: 35, belt: 17, trim: 26, bumpers: true,
      windows: [[[50, 16.5], [56.5, 8.2], [75, 8.2], [75, 16.5]]],
      doors: [79.5], heads: [67], wheel: 'rally', twoTone: true, bed: [81, 157],
    },
    // Checker Marathon: the rounded 50s body that never changed, tall roof
    checker: {
      top: [[0, 27], [1, 22], [4, 19.6], [10, 18.8], [42, 19], [45, 18], [55, 7.8], [59, 6.8], [104, 6.8], [108, 7.8], [117, 18.2], [124, 19], [152, 19.3], [158, 20.5], [161, 24], [161, 27]],
      wheels: [32, 126], square: 2, rocker: 36, belt: 18.5, trim: 27, bumpers: true,
      windows: [[[46, 17.6], [55.5, 8.6], [80, 8.6], [80, 17.6]], [[83, 8.6], [103, 8.6], [107, 10], [113, 17.6], [83, 17.6]]],
      doors: [81.5, 115], heads: [68, 94], wheel: 'dogdish',
    },
  };
  // period paint: earth tones, metallics, two-tone-friendly colours
  const ERA_COLS = ['#6e2b1e', '#8a5a2b', '#c9a25a', '#5f6b3a', '#2d4a3e', '#1f2f5a', '#8fa7c9', '#e9e0c8',
    '#b9bcc6', '#7a1424', '#1a1822', '#f0eee8', '#a33b2a', '#3d5f8a', '#4a2f4a'].map(rgb);
  const VINYLS = ['#f2ecdc', '#e2d4b4', '#5a1420', '#1c181c', '#4a3424'].map(rgb);
  const MUSCLE_COLS = ['#141218', '#141218', '#e8e8f0', '#9a1c1c', '#c8a24a', '#2a3f7a'].map(rgb);

  function topAt(top, x) {
    if (x <= top[0][0]) return top[0][1];
    for (let i = 1; i < top.length; i++) {
      if (x <= top[i][0]) {
        const a = top[i - 1], b = top[i];
        return a[1] + ((x - a[0]) / (b[0] - a[0] || 1)) * (b[1] - a[1]);
      }
    }
    return top[top.length - 1][1];
  }

  // Wheels: 4 frames of a spinning 27 px wheel in the car's period style.
  // Distances are measured in the design grid's 21 px wheel.
  function genTrafficWheels(style, ww) {
    const P = (c) => ND.pack(c[0], c[1], c[2]);
    const sym = { cover: 8, wire: 16, snowflake: 10, dogdish: 5, rally: 6 }[style];
    const S = WR * 2 + 1, u = 10 / WR;
    const frames = [];
    for (let f = 0; f < 4; f++) {
      const pb = new ND.PB(S, S);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const d = Math.hypot(x - WR, y - WR) * u, a = Math.atan2(y - WR, x - WR);
        if (d > 10.1) continue;
        const lit = 0.5 - 0.5 * Math.cos(a + 2.3); // lit from the upper left
        const spin = a - (f / 4) * ((Math.PI * 2) / sym);
        const rimR = style === 'snowflake' ? 7.2 : 6.4;
        let c;
        if (d > 7.9) c = ND.mix(rgb('#0c0a10'), rgb('#2e2a36'), lit * 0.8);
        else if (d > rimR) {
          c = ww && d > 6.5 ? ND.mix(rgb('#b8b4c6'), rgb('#f6f4fa'), lit) : ND.mix(rgb('#141018'), rgb('#302a3a'), lit);
          // raised white letters on the muscle car
          if (style === 'snowflake' && d > 7.4 && Math.cos(spin * 24) > 0.8 && Math.sin(a) < -0.2) c = rgb('#d8d4e0');
        } else if (style === 'wire') {
          c = ND.mix(rgb('#3a3848'), rgb('#5a5870'), lit);
          if (Math.abs(Math.sin(spin * 8)) < 0.3 || d > 5.7) c = ND.mix(rgb('#9a9ab4'), rgb('#f2f2fa'), lit);
          if (d < 1.9) c = rgb('#e8d890'); // knock-off spinner
        } else if (style === 'snowflake') {
          c = Math.cos(spin * 10) > 0.05 || d < 2.2 || d > 6.4 ? ND.mix(rgb('#8a6a2a'), rgb('#f0d27a'), lit) : rgb('#241a14');
        } else if (style === 'dogdish') {
          c = ND.mix(rgb('#1a1822'), rgb('#3a3648'), lit);
          if (d < 3.4) c = ND.mix(rgb('#8c8ca4'), rgb('#f0f0f8'), lit);
          else if (d > 4.3 && d < 5 && Math.cos(spin * 5) > 0.85) c = rgb('#56526a');
        } else if (style === 'rally') {
          c = ND.mix(rgb('#6a6c7c'), rgb('#b4b6c6'), lit);
          if (d > 5.5) c = ND.mix(rgb('#a0a0b8'), rgb('#f4f4fa'), lit);
          else if (d > 2.6 && d < 4.8 && Math.cos(spin * 6) > 0.6) c = rgb('#24222e');
          if (d < 1.6) c = rgb('#d02a34');
        } else {
          // full wheel cover with radial fins
          c = ND.mix(rgb('#8a8aa4'), rgb('#eaeaf6'), lit);
          if (d > 2.4 && d < 5.7 && Math.cos(spin * 8) > 0.55) c = ND.mix(c, rgb('#4a4860'), 0.6);
          if (d > 5.7) c = ND.mix(c, rgb('#5a5870'), 0.4);
          if (d < 1.8) c = rgb('#f4f0e0');
        }
        pb.set(x, y, P(c));
      }
      frames.push(pb.canvas());
    }
    return frames;
  }

  function genTraffic(seed, opts = {}) {
    const r = ND.rng(seed);
    const special = 'special' in opts ? opts.special : r.chance(0.08) ? 'taxi' : r.chance(0.05) ? 'police' : null;
    const kind = special === 'taxi' ? 'checker' : special === 'police' ? 'sedan' : opts.kind || r.pick(['sedan', 'sedan', 'coupe', 'muscle', 'wagon', 'pickup']);
    const M = MODELS[kind];
    let base = opts.color || (special === 'taxi' ? rgb('#f2b21a') : special === 'police' ? rgb('#16161e') : kind === 'muscle' ? r.pick(MUSCLE_COLS) : r.pick(ERA_COLS));
    const vinyl = M.vinylFrom && !special && (kind === 'coupe' ? r() < 0.85 : r() < 0.35) ? r.pick(VINYLS) : null;
    const upper = M.twoTone ? rgb('#eeeae0') : null;
    const pb = new ND.PB(TW, TH), gl = new ND.PB(TW, TH);
    const P = (c) => ND.pack(c[0], c[1], c[2]);
    // design grid -> sprite pixels
    const s = (v) => v * K, n = (v) => Math.round(v * K);
    const sp = (pts) => pts.map(([x, y]) => [x * K, y * K]);
    const top = sp(M.top), windows = M.windows.map(sp);
    const belt = s(M.belt), rocker = n(M.rocker), trim = M.trim && n(M.trim);
    const wheels = M.wheels.map(n);
    const X0 = n(6), X1 = n(156); // where the side trim runs
    // wheel openings: round on the older and sportier cars, squarish on the boxes
    const inArch = (x, y) => {
      for (const wx of wheels) {
        const dx = Math.abs(x - wx) / ARCH, dy = (WY - y) / ARCH;
        if (dx <= 1 && (dy <= 0 || Math.pow(dx, M.square) + Math.pow(dy, M.square) <= 1)) return true;
      }
      return false;
    };
    const inWindow = (x, y) => windows.some((w) => { let inside = false; for (let i = 0, j = w.length - 1; i < w.length; j = i++) { const a = w[i], b = w[j]; if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside; } return inside; });
    const pts = top.slice();
    pts.push([s(161), rocker - 3], [s(158), rocker], [s(3), rocker], [0, rocker - 3]);
    // ---- paint
    pb.polyFn(pts, (x, y) => {
      if (inArch(x, y)) return;
      const ty = topAt(top, x + 0.5), dt = y - ty;
      let c;
      if (y < belt) c = vinyl && x >= s(M.vinylFrom) ? vinyl : base; // pillars and roof
      else {
        const t = ND.clamp((y - belt) / (rocker - belt), 0, 1);
        c = upper && y < belt + 6 ? upper : base;
        c = ND.scale(c, 1.16 - t * 0.55);
        if (y === Math.floor(belt) + 1) c = ND.scale(c, 1.25); // the shoulder catches the light
        c = ND.mix(c, [255, 120, 220], 0.08 * (1 - t));
        c = ND.mix(c, [110, 190, 255], 0.1 * t);
      }
      if (dt < 1.2) c = ND.mix(ND.scale(c, 1.45), [255, 205, 240], 0.3); // lit top edge
      if (vinyl && x >= s(M.vinylFrom) && y < belt && (x * 7 + y * 3) % 5 === 0) c = ND.scale(c, 0.9); // grain
      pb.dset(x, y, c, 255, 8);
    });
    // arch interiors
    for (const wx of wheels) pb.discFn(wx, WY, ARCH, (x, y) => { if (y <= rocker && inArch(x, y) && pb.alpha(x, y) === 0) pb.set(x, y, P(rgb('#0e0a14'))); });
    for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
      if (!inArch(x, y) || y > rocker - 1) continue;
      if (!inArch(x, y - 1) && pb.alpha(x, y - 1)) pb.set(x, y - 1, P(ND.scale(base, 0.55))); // arch lip
      pb.set(x, y, P(rgb('#0e0a14')));
    }
    // ---- glass, with the people inside
    pb.polyFn(pts, (x, y) => {
      if (!inWindow(x + 0.5, y + 0.5)) return;
      let c = ND.mix(rgb('#3c3270'), rgb('#120e24'), ND.clamp((y - s(8)) / s(11), 0, 1));
      if ((x + y * 2) % 24 < 2) c = ND.mix(c, rgb('#b0a0e0'), 0.3);
      pb.set(x, y, P(c));
    });
    for (const hx of M.heads.map(s)) {
      const hy = belt - s(6.5);
      pb.discFn(hx, hy, s(2.6), (x, y) => { if (inWindow(x + 0.5, y + 0.5)) pb.set(x, y, P(rgb('#241a2a'))); });
      for (let y = Math.round(hy + 2.5); y < belt; y++) for (let x = Math.round(hx - 4); x <= hx + 4; x++) if (inWindow(x + 0.5, y + 0.5)) pb.set(x, y, P(rgb('#1e1624')));
    }
    // chrome window sill along the beltline
    for (let x = 0; x < TW; x++) {
      const y = Math.floor(belt);
      if (inWindow(x + 0.5, y - 0.5)) pb.set(x, y, P(rgb('#d8d8ea')));
    }
    // ---- body details
    const chrome = (x, y, k = 1) => pb.set(x, y, P(ND.scale(rgb('#dcdcee'), k)));
    const doors = M.doors.map(n);
    for (const dx of doors) for (let y = Math.ceil(belt) + 1; y < rocker - 1; y++) if (!inArch(dx, y)) pb.set(dx, y, P(ND.scale(base, 0.62)));
    for (const dx of doors) for (let x = dx - 6; x <= dx - 4; x++) chrome(x, Math.ceil(belt) + 4); // door handles
    if (trim) for (let x = X0; x < X1; x++) {
      if (inArch(x, trim) || inArch(x, trim + 1)) continue;
      chrome(x, trim, 0.95);
      pb.set(x, trim + 1, P(rgb('#2a2434')));
    }
    for (let x = X0; x < X1; x++) if (!inArch(x, rocker - 1)) chrome(x, rocker - 1, 0.75); // rocker moulding
    if (M.opera) pb.discFn(s(M.opera[0]), s(M.opera[1]), s(1.8), (x, y) => pb.set(x, y, P(rgb('#bcb4e0'))));
    if (M.ornament) { // stand-up hood ornament
      const oy = Math.ceil(topAt(top, 4.5) - 0.5);
      chrome(4, oy - 1); chrome(4, oy - 2); chrome(4, oy - 3); pb.set(4, oy - 4, P(rgb('#fff6d8')));
    }
    if (M.rack) {
      const ry = Math.ceil(s(7.8) - 0.5); // the first roof row
      for (let x = n(M.rack[0]); x <= n(M.rack[1]); x++) chrome(x, ry - 3, 0.8);
      for (let x = n(M.rack[0]); x <= n(M.rack[1]); x += 16) { chrome(x, ry - 2, 0.6); chrome(x, ry - 1, 0.5); }
    }
    if (M.bed) { // the open bed: rail on top, the far side's inner wall just visible
      const by = Math.ceil(s(17.5) - 0.5);
      for (let x = n(M.bed[0]); x < n(M.bed[1]); x++) { chrome(x, by - 1, 0.7); pb.set(x, by - 2, P(ND.scale(base, 0.5))); }
    }
    if (M.wood) { // wood-grain panel with a light surround
      const y0 = n(21), y1 = n(33);
      for (let y = y0; y <= y1; y++) for (let x = X0; x < X1; x++) {
        if (inArch(x, y) || inArch(x - 1, y) || inArch(x + 1, y) || inArch(x, y + 1)) continue;
        const edge = y === y0 || y === y1 || x === X0 || x === X1 - 1 || inArch(x - 2, y) || inArch(x + 2, y) || inArch(x, y + 2);
        const grain = Math.sin((x / K) * 0.33 + Math.sin((y / K) * 1.9 + (x / K) * 0.05) * 1.6) > 0.35;
        const c = edge ? rgb('#d4b07a') : ND.mix(rgb('#8a5328'), rgb('#5e3418'), grain ? 0.7 : 0);
        pb.dset(x, y, ND.scale(c, 1.05 - (y - y0) * 0.02), 255, 6);
      }
    }
    if (M.scoop) { // shaker hood scoop
      for (let x = n(M.scoop[0]); x <= n(M.scoop[1]); x++) for (let y = n(19); y <= n(19) + 3; y++) pb.set(x, y, P(y === n(19) ? rgb('#8c8ca4') : rgb('#16121c')));
    }
    if (M.airdam) for (let x = 1; x < n(24); x++) for (let y = n(32); y <= n(34); y++) pb.set(x, y, P(rgb('#141018')));
    if (M.stripe) { // pinstripe, gold on black
      const sc = base[0] < 60 ? rgb('#e0b44a') : ND.scale(base, 0.5);
      const y = Math.round(belt) + 3;
      for (let x = n(8); x < n(150); x++) if (!inArch(x, y)) pb.set(x, y, P(sc));
    }
    // ---- bumpers: chrome with a black rubber strip, wrapping the corners
    const BUMP = ['#f2f2fa', '#cfd2e6', '#9aa0c0', '#d6d8ec', '#2a2634', '#b0b4cc', '#7c80a0', '#54587a'].map(rgb);
    if (M.bumpers) for (let y = n(26); y < n(34); y++) {
      const b = BUMP[ND.clamp(Math.floor((y + 0.5) / K) - 26, 0, BUMP.length - 1)];
      for (let x = 0; x <= n(5); x++) pb.set(x, y, P(ND.scale(b, 1 - (x / K) * 0.03)));
      for (let x = n(155); x < TW - 1; x++) pb.set(x, y, P(ND.scale(b, 0.9 + ((x - n(155)) / K) * 0.02)));
    } else for (let y = n(27); y <= n(31); y++) { pb.set(0, y, P(ND.scale(base, 0.7))); pb.set(TW - 2, y, P(ND.scale(base, 0.6))); }
    // ---- lights (on: it's night)
    const lamp = (x, y, c, g) => { pb.set(x, y, P(c)); gl.set(x, y, ND.pack(g[0], g[1], g[2])); };
    const hy = kind === 'muscle' ? n(25) : Math.round(topAt(top, 2.5)) + 1;
    for (let y = hy; y < hy + 5; y++) for (let x = 0; x <= 3; x++) if (y !== hy + 2 || kind === 'muscle') lamp(x, y, rgb('#fff6da'), [255, 240, 200]);
    if (kind !== 'muscle') { lamp(6, hy + 5, rgb('#ffa21e'), [200, 120, 20]); lamp(7, hy + 5, rgb('#ffa21e'), [200, 120, 20]); } // amber marker
    const ty0 = Math.max(n(19), Math.round(topAt(top, s(159))) + 1);
    for (let y = ty0; y < n(26); y++) for (let x = n(158); x < TW - 1; x++) {
      const louvre = kind === 'muscle' && y % 2 === 0;
      lamp(x, y, louvre ? rgb('#5a0c16') : rgb('#ff2a3c'), louvre ? [60, 6, 12] : [255, 30, 50]);
    }
    lamp(n(151), n(24), rgb('#e0203a'), [140, 16, 28]); lamp(n(151) + 1, n(24), rgb('#e0203a'), [140, 16, 28]); // red side marker
    // ---- the specials
    let bar = null;
    const roofRow = Math.ceil(Math.min(...top.map((p) => p[1])) - 0.5); // first row of the roof
    if (special === 'taxi') {
      for (let x = n(5); x < n(157); x++) for (let y = n(23); y <= n(23) + 1; y++) if (!inArch(x, y)) pb.set(x, y, P(((x >> 1) + y) % 2 ? rgb('#141018') : rgb('#f4f2ea')));
      const sx = n(76), sw = 18, sh = 7, sy = roofRow - sh;
      pb.rect(sx, sy, sw, sh, P(rgb('#ffe890')));
      for (let x = sx; x < sx + sw; x++) for (let y = sy; y < sy + sh; y++) gl.set(x, y, ND.pack(200, 170, 70));
      const mk = ND.textMask('TAXI', { small: true, gap: 0 });
      for (let y = 0; y < mk.h; y++) for (let x = 0; x < mk.w; x++) if (mk.m[y * mk.w + x]) pb.set(sx + 3 + x, sy + 1 + y, P(rgb('#402808')));
    }
    if (special === 'police') {
      for (let y = Math.ceil(belt) + 1; y < rocker - 1; y++) for (let x = n(52); x < n(112); x++) if (!inArch(x, y) && y !== trim && y !== trim + 1) pb.set(x, y, P(ND.scale(rgb('#eeeef4'), 1.05 - (y - belt) * 0.016)));
      const mk = ND.textMask('POLICE', { small: true, gap: 1 });
      for (let y = 0; y < mk.h; y++) for (let x = 0; x < mk.w; x++) if (mk.m[y * mk.w + x]) pb.set(n(58) + (opts.mirrorText ? mk.w - 1 - x : x), Math.ceil(belt) + 3 + y, P(rgb('#16161e')));
      bar = { x: n(73), y: roofRow - 4, w: 26, h: 4 };
      pb.rect(bar.x, bar.y, bar.w, bar.h, P(rgb('#2a2a3a')));
      chrome(n(58), n(15)); chrome(n(58) + 1, n(15)); // A-pillar spotlight
    }
    return {
      body: ND.sprite(pb, gl),
      wheels: wheels.map((x) => [x, WY]),
      wheelR: WR,
      wheelFrames: genTrafficWheels(M.wheel, M.ww && !special),
      lampY: hy + 2,
      bar,
      w: TW,
      h: TH,
      ground: TG,
      special,
      kind,
    };
  }

  // Door window glass (rolled up in the rain): tint, highlights, raindrops.
  function genWindowGlass(seed) {
    const r = ND.rng(seed);
    const poly = [[114.5, 26], [144.5, 4], [172, 4], [172, 26]];
    const pb = new ND.PB(HW, 28);
    pb.polyFn(poly, (x, y) => {
      let a = 60, c = [150, 140, 215];
      const s = x + y * 1.3;
      if (s % 23 < 3) { a = 125; c = [235, 225, 255]; }
      else if (s % 23 < 5) { a = 90; c = [255, 150, 230]; }
      pb.set(x, y, ND.pack(c[0], c[1], c[2], a));
    });
    for (let i = 0; i < 11; i++) {
      const x = r.int(122, 170), y = r.int(7, 22);
      if (!pb.alpha(x, y)) continue;
      pb.set(x, y, ND.pack(235, 230, 255, 150));
      for (let k = 1; k < r.int(2, 4); k++) if (pb.alpha(x, y + k)) pb.set(x, y + k, ND.pack(200, 195, 240, 90));
    }
    return pb.canvas();
  }

  ND.genHeroCar = genHeroCar;
  ND.genWindowGlass = genWindowGlass;
  ND.genDriver = genDriver;
  ND.genDriverArm = genDriverArm;
  ND.genWheelFrames = genWheelFrames;
  ND.genTraffic = genTraffic;
  ND.genTrafficWheels = genTrafficWheels;
  ND.HERO = { W: HW, H: HH, WHEELS, WHEEL_R, topY };
  ND.TRAFFIC = { W: TW, H: TH };
})();
