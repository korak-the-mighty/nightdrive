/* Nightdrive — the driver on foot, for the opening scene: leaning on the car
 * under the NIGHT DRIVE sign, ankles crossed, cigarette in hand, the mullet
 * moving in the breeze. Same face as the man at the wheel (cars.js), minus the
 * shades: he puts those on when he gets in.
 *
 * Body frames are drawn once (arm and leg poses); the head is composed live
 * from pixel maps so it can look around, blink, talk and let its hair blow.
 */
(function () {
  'use strict';
  const ND = window.ND;
  const { rgb } = ND;

  const DW = 48, DH = 124, FOOT = 122; // body frame size, feet row
  const HX = 13, HY = 3;               // where the head map sits in the frame
  const BODY_DY = 4;                   // the body sits this much lower, under the bigger head

  // ---- heads ------------------------------------------------------------------
  // Standing, he gets a bigger head than the 18-px one at the wheel, so his face
  // reads: feathered hair falling over the brow, defined brows, squinted eyes,
  // a proper nose, stubble, a smirk. The mullet is the hair on the right.
  const PAL = {
    H: rgb('#fff2b0'), h: rgb('#f2c662'), d: rgb('#c48c36'), k: rgb('#7a4e22'),
    S: rgb('#f8c6a6'), s: rgb('#e49c7c'), z: rgb('#b06a54'), e: rgb('#c4705a'), n: rgb('#a8624e'),
    E: rgb('#2a1420'), W: rgb('#fff8f0'), b: rgb('#8a5a2a'), u: rgb('#d89a80'),
    l: rgb('#c86a62'), T: rgb('#fff8ee'), m: rgb('#5a1a24'), G: rgb('#0c0a14'), g: rgb('#ff7ad8'),
  };
  // three-quarter view, to the camera (22 x 24)
  const CAM = [
    '.......kkkkkkk........',
    '.....kkHHHHHHhkk......',
    '...kkhHHHHHHHhhhkk....',
    '..khhhHHHHHHHhhhddk...',
    '..khhhhhhhhhhhhhddk...',
    '.khhhhhhhhhhhhhhdddk..',
    '.khhhhhhhhhhhhhhddddkk',
    '.khSSdhhhhhhhhhhdddddk',
    '.khbbbSSSbbbhhhhdddddk',
    '.khWEESSsWEEShhhdddddk',
    '.kSSsSSSsSsSSshhdddddk',
    '.kSSSSSSsSSSSsehdddddk',
    '..SSSSSSsSSSsseddddddk',
    '..SSSSzszSSSssdddddddk',
    '...SSSSSSlSSSsdddddddk',
    '...uSllllzSSshddddddk.',
    '....uSSSSSuSuhdddddk..',
    '....SSuSuSSu.kdddddk..',
    '.....uSuSuS..kddddk...',
    '......SSSSS..kddddk...',
    '......zzzzzz.kdddk....',
    '......nnnnnn.kkkkk....',
    '......nnnnnn..........',
    '......nnnnnn..........',
  ];
  // [x, y, pixel] edits for talking, blinking and glancing aside
  const CAM_MOUTH = [[], [[5, 15, 'l'], [6, 15, 'm'], [7, 15, 'm'], [8, 15, 'l']],
    [[5, 15, 'l'], [6, 15, 'T'], [7, 15, 'T'], [8, 15, 'l'], [5, 16, 'l'], [6, 16, 'm'], [7, 16, 'm'], [8, 16, 'l']]];
  const CAM_BLINK = [[3, 9, 'z'], [4, 9, 'z'], [5, 9, 'z'], [9, 9, 'z'], [10, 9, 'z'], [11, 9, 'z']];
  const CAM_SIDE = [[3, 9, 'E'], [4, 9, 'E'], [5, 9, 'W'], [9, 9, 'E'], [10, 9, 'E'], [11, 9, 'W']];
  // profile, looking up the street (left)
  const SIDE = [
    '.........kkkkk........',
    '.......kkHHHHhkk......',
    '.....kkHHHHHHhhhkk....',
    '.....kHHHHHHHhhhdk....',
    '....khhhhhhhhhhhddk...',
    '...khhhhhhhhhhhhdddk..',
    '...khhhhhhhhhhhhdddk..',
    '...khhhSSSShhhhhdddk..',
    '...kbbbSSSShhhhhdddk..',
    '...kEWSSSSshhhhhdddk..',
    '...SSSsSSSshhhhhdddk..',
    '..SSSSSSSSsehhhhdddk..',
    '.SSsSSSSSSseehdddddk..',
    '..SzSSSSSSshhhdddddk..',
    '...SSSSSSSshhhdddddk..',
    '...llzSSSSshhhdddddk..',
    '...uSSSSSSshhhddddk...',
    '....uSuSuSshhhdddk....',
    '....SuSuSSshhhdddk....',
    '.....SSSSSshhhddk.....',
    '......zzzzzzhhddk.....',
    '......nnnnnnhhdk......',
    '......nnnnnnkkk.......',
    '......nnnnnn..........',
  ];
  const SIDE_MOUTH = [[], [[3, 15, 'm']], [[3, 15, 'm'], [4, 15, 'm'], [3, 16, 'm']]];
  const SIDE_BLINK = [[4, 9, 'z'], [5, 9, 'z']];
  // the small profile from the car (cars.js), for the moment he's in the seat
  const SIDE_SMALL = [
    '......kkkkkk......',
    '....kkhHHHHhkk....',
    '...khHHHhhhhhhk...',
    '..khHhhhhhhhhhdk..',
    '..khhhhhhhhhhhddk.',
    '.khhhhhhhhhhhhdddk',
    '.kShhhhshhhhhhdddk',
    '..Sddssssshhhhdddk',
    '.SSSEsssssehhhdddk',
    '..SSSSssszeehhdddk',
    'SSSSssssszeehhdddk',
    '..SSsssssszzhhdddk',
    '.SSSssssszzzhhdddk',
    '..SSsssszzzzhhddk.',
    '..Ssssszzzzzhhdddk',
    '....zzzzzzzzhhdddk',
    '......nnnnnnhhddk.',
    '......nnnnnhhdddk.',
  ];
  const edit = (rows, edits) => {
    const g = rows.map((r) => [...r]);
    for (const [x, y, ch] of edits) if (g[y]) g[y][x] = ch;
    return g.map((r) => r.join(''));
  };

  // rows -> pixel canvas, with the mullet shifted by the wind (hair right of
  // column 13, lower rows move most)
  function headCanvas(rows, edits, sway, flip) {
    rows = edit(rows, edits || []);
    const w = rows[0].length + 3, h = rows.length;
    const pb = new ND.PB(w, h);
    rows.forEach((row, y) => {
      const o = y >= 9 ? Math.round(sway * ((y - 8) / (h - 9)) * 2.4) : y <= 2 ? Math.round(sway * 0.8) : 0;
      [...row].forEach((ch, x) => {
        if (ch === '.') return;
        const hair = ch === 'h' || ch === 'H' || ch === 'd' || ch === 'k';
        const dx = hair && x >= 13 ? o : 0;
        const c = PAL[ch];
        const px = flip ? w - 1 - (x + dx) : x + dx;
        pb.set(px, y, ND.pack(c[0], c[1], c[2]));
        // fill the gap the blown hair leaves behind
        if (dx) for (let k = 0; k < dx; k++) {
          const cc = PAL[row[13]] || PAL.h;
          const qx = flip ? w - 1 - (13 + k) : 13 + k;
          if (!(pb.alpha(qx, y))) pb.set(qx, y, ND.pack(cc[0], cc[1], cc[2]));
        }
      });
    });
    return pb;
  }

  // ---- body ---------------------------------------------------------------------
  const C = {
    blazer: rgb('#8fb8f0'), blazerL: rgb('#d2e8ff'), blazerD: rgb('#5474b4'), blazerDD: rgb('#34467e'),
    tee: rgb('#262030'), teeD: rgb('#18141e'),
    pants: rgb('#f0ece4'), pantsD: rgb('#bdb4cc'), pantsDD: rgb('#8e86a8'),
    skin: rgb('#f0b494'), skinL: rgb('#f8c6a6'), skinD: rgb('#b06a54'),
    shoe: rgb('#dcc294'), shoeD: rgb('#9c7a4c'), sole: rgb('#3a2620'),
    ink: rgb('#1c1028'), gold: rgb('#ffd65a'), paper: rgb('#f6f2e8'), filter: rgb('#d8963c'),
  };

  // a tapered limb: discs along the bone, radius easing from r0 to r1
  function bone(pb, a, b, r0, r1, col) {
    const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pb.disc(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, r0 + (r1 - r0) * t, ND.pack(col[0], col[1], col[2]));
    }
  }
  // limb with a 1px darker rim, so parts read against each other
  function limb(pb, a, b, r0, r1, col, rim) {
    bone(pb, a, b, r0 + 0.8, r1 + 0.8, rim);
    bone(pb, a, b, r0, r1, col);
  }

  // Arm poses for the cigarette hand (screen left). hand = where the fingers
  // are, cig = direction the cigarette points.
  const ARMS = {
    hold: { el: [9, 45], hand: [16, 38], cig: [-0.9, -0.45] },
    lift: { el: [8, 41], hand: [14, 28], cig: [-0.85, -0.55] },
    drag: { el: [10, 38], hand: [19, 19], cig: [-0.95, -0.2] },
    flick: { el: [4, 39], hand: [0, 31], cig: [-1, -0.1] },
    down: { el: [9, 44], hand: [11, 58], cig: null },
    reach: { el: [4, 37], hand: [-3, 42], cig: null },
  };
  // leg poses: [hip, knee, ankle] for the back (screen-right) and front leg
  const LEGS = {
    cross: { back: [[27, 59], [26, 86], [17, 113]], front: [[17, 59], [15, 85], [24, 114]] },
    stand: { back: [[27, 59], [28, 86], [29, 114]], front: [[17, 59], [16, 86], [15, 114]] },
    step: { back: [[27, 59], [32, 85], [35, 113]], front: [[17, 59], [11, 84], [7, 112]] },
  };

  function drawBody(armName, legName, shift = 0) {
    const pb = new ND.PB(DW, DH);
    const A = ARMS[armName], L = LEGS[legName];
    const sx = shift; // upper body leans a little on the car
    // back leg, then the front leg crossing over it
    const leg = (pts, front) => {
      const [hip, knee, ank] = pts;
      limb(pb, hip, knee, 4.6, 3.8, front ? C.pants : C.pantsD, C.pantsDD);
      limb(pb, knee, ank, 3.6, 2.6, front ? C.pants : C.pantsD, C.pantsDD);
      // crease down the front of the trouser leg
      pb.lineFn(knee[0], knee[1] + 2, ank[0], ank[1] - 3, (x, y) => pb.set(x, y, ND.pack(...(front ? C.pantsD : C.pantsDD))));
      // bare ankle (no socks, obviously) and a loafer pointing out
      const out = ank[0] < 24 ? -1 : 1;
      pb.rect(Math.round(ank[0]) - 1, Math.round(ank[1]) - 1, 3, 2, ND.pack(...C.skin));
      const fy = Math.round(ank[1]) + 1;
      for (let y = 0; y < 5; y++) {
        const x0 = Math.round(ank[0]) - (out < 0 ? 6 - (y > 2 ? 1 : 0) : 2), x1 = Math.round(ank[0]) + (out > 0 ? 6 - (y > 2 ? 1 : 0) : 2);
        for (let x = x0; x <= x1; x++) {
          const c = y === 4 ? C.sole : y === 0 ? C.shoeD : x === x0 || x === x1 ? C.shoeD : C.shoe;
          pb.set(x, fy + y - 1, ND.pack(c[0], c[1], c[2]));
        }
      }
    };
    leg(L.back, false);
    leg(L.front, true);
    // torso: the blazer (with 80s shoulders), open over the tee
    const torso = [[10 + sx, 24], [34 + sx, 23], [36 + sx, 30], [34 + sx, 54], [32, 62], [13, 62], [11, 54], [8 + sx, 30]];
    pb.polyFn(torso, (x, y) => {
      const v = (y - 23) / 44;
      let c = ND.mix(C.blazer, C.blazerD, v * 0.5);
      if (x > 29 + sx) c = ND.mix(c, C.blazerD, 0.35); // turning away
      if (x < 13 + sx) c = ND.mix(c, C.blazerL, 0.25);
      pb.set(x, y, ND.pack(c[0], c[1], c[2]));
    });
    // outline of the torso
    const tset = new Set();
    pb.polyFn(torso, (x, y) => tset.add(x + ',' + y));
    for (const k of tset) {
      const [x, y] = k.split(',').map(Number);
      if (!tset.has(x - 1 + ',' + y) || !tset.has(x + 1 + ',' + y) || !tset.has(x + ',' + (y + 1))) pb.set(x, y, ND.pack(...C.blazerDD));
    }
    // tee in the open front, lapels
    const tee = [[18 + sx, 22], [27 + sx, 22], [26 + sx, 40], [25, 61], [20, 61], [19 + sx, 40]];
    pb.polyFn(tee, (x, y) => pb.set(x, y, ND.pack(...(x > 24 + sx ? C.teeD : C.tee))));
    pb.lineFn(18 + sx, 23, 21 + sx, 44, (x, y) => { pb.set(x, y, ND.pack(...C.blazerL)); pb.set(x - 1, y, ND.pack(...C.blazer)); });
    pb.lineFn(27 + sx, 23, 24 + sx, 44, (x, y) => { pb.set(x, y, ND.pack(...C.blazerD)); pb.set(x + 1, y, ND.pack(...C.blazer)); });
    pb.lineFn(21 + sx, 44, 20, 61, (x, y) => pb.set(x, y, ND.pack(...C.blazerD)));
    pb.lineFn(24 + sx, 44, 25, 61, (x, y) => pb.set(x, y, ND.pack(...C.blazerD)));
    // belt, pocket flaps, and a pink pocket square
    for (let x = 20; x <= 25; x++) pb.set(x, 56, ND.pack(...C.shoeD));
    pb.set(22, 56, ND.pack(...C.gold));
    for (let x = 12; x <= 17; x++) pb.set(x + sx, 49, ND.pack(...C.blazerDD));
    for (let x = 27; x <= 32; x++) pb.set(x + sx, 49, ND.pack(...C.blazerDD));
    for (let x = 28; x <= 31; x++) { pb.set(x + sx, 30, ND.pack(...C.blazerDD)); }
    pb.set(29 + sx, 28, ND.pack(255, 110, 200)); pb.set(30 + sx, 28, ND.pack(255, 160, 220)); pb.set(29 + sx, 29, ND.pack(255, 80, 180)); pb.set(30 + sx, 29, ND.pack(255, 110, 200));
    // hand-in-pocket arm (screen right): sleeve out to the elbow, forearm
    // angling back in, the hand gone into the trouser pocket
    limb(pb, [32 + sx, 26], [37 + sx, 43], 3.4, 3.0, C.blazerD, C.blazerDD);
    pb.disc(37 + sx, 43, 2.8, ND.pack(...C.blazerL));
    pb.disc(37 + sx, 43, 1.9, ND.pack(...C.blazerD));
    limb(pb, [37 + sx, 44], [32 + sx, 57], 2.1, 1.9, C.skin, C.skinD);
    pb.set(35 + sx, 51, ND.pack(...C.gold)); pb.set(36 + sx, 51, ND.pack(...C.gold));
    // neck
    pb.rect(19 + sx, 19, 6, 5, ND.pack(...C.skinD));
    pb.rect(20 + sx, 19, 4, 4, ND.pack(...C.skin));
    // the cigarette arm (screen left), in front of the torso
    const sh = [10 + sx, 27];
    limb(pb, sh, A.el, 3.8, 3.2, C.blazer, C.blazerDD);
    // pushed-up sleeve bunched at the elbow
    pb.disc(A.el[0], A.el[1], 3.4, ND.pack(...C.blazerL));
    pb.disc(A.el[0], A.el[1], 2.4, ND.pack(...C.blazer));
    limb(pb, A.el, A.hand, 2.3, 2.0, C.skin, C.skinD);
    pb.disc(A.hand[0], A.hand[1], 2.1, ND.pack(...C.skin));
    pb.set(Math.round(A.hand[0]) + 1, Math.round(A.hand[1]) - 1, ND.pack(...C.skinL));
    let tip = null;
    if (A.cig) {
      const [dx, dy] = A.cig;
      const x0 = A.hand[0] - 1, y0 = A.hand[1] - 1;
      pb.set(Math.round(x0), Math.round(y0), ND.pack(...C.filter));
      for (let k = 1; k <= 4; k++) pb.set(Math.round(x0 + dx * k), Math.round(y0 + dy * k), ND.pack(...C.paper));
      tip = [x0 + dx * 5, y0 + dy * 5];
    }
    // light: the sign behind and above rims him in pink, DRIVE adds cyan on
    // the right, the street fills the front softly
    const src = pb.d.slice();
    const on = (x, y) => x >= 0 && y >= 0 && x < DW && y < DH && src[y * DW + x] >>> 24;
    for (let y = 0; y < DH; y++)
      for (let x = 0; x < DW; x++) {
        const i = y * DW + x;
        if (!(src[i] >>> 24)) continue;
        let c = [src[i] & 255, (src[i] >> 8) & 255, (src[i] >> 16) & 255];
        if (!on(x, y - 1)) c = ND.mix(c, [255, 120, 220], 0.55);
        else if (!on(x, y - 2)) c = ND.mix(c, [255, 140, 225], 0.2);
        if (!on(x - 1, y)) c = ND.mix(c, [255, 110, 210], 0.35);
        if (!on(x + 1, y)) c = ND.mix(c, [90, 230, 255], 0.4);
        c = ND.mix(c, [150, 110, 220], 0.08 + 0.1 * (y / DH)); // the night itself
        pb.set(x, y, ND.pack(c[0], c[1], c[2]));
      }
    // a thin dark outline so he reads against the busy street
    for (let y = 0; y < DH; y++)
      for (let x = 0; x < DW; x++) {
        if (src[y * DW + x] >>> 24) continue;
        if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) pb.set(x, y, ND.pack(C.ink[0], C.ink[1], C.ink[2], 200));
      }
    return { c: pb.canvas(), tip };
  }

  function genDude() {
    const frames = {};
    const lower = (f) => {
      const cv = ND.canvas(DW, DH);
      cv.getContext('2d').drawImage(f.c, 0, BODY_DY);
      return { c: cv, tip: f.tip && [f.tip[0], f.tip[1] + BODY_DY] };
    };
    for (const arm of ['hold', 'lift', 'drag', 'flick']) frames[arm] = lower(drawBody(arm, 'cross', 1));
    frames.stand = lower(drawBody('down', 'stand', 0));
    frames.step = lower(drawBody('down', 'step', 0));
    frames.reach = lower(drawBody('reach', 'stand', 0));
    return { frames, W: DW, H: DH, FOOT, HX, HY };
  }

  // Draws the head at (x, y) = its map origin. view: 'cam' | 'left' | 'right'.
  function drawHead(ctx, x, y, view, mouth, blink, sway) {
    sway = Math.round(sway * 4) / 4; // a few wind positions are plenty
    const key = view + mouth + (blink ? 'b' : '') + sway;
    let cv = headCache[key];
    if (!cv) cv = headCache[key] = renderHead(view, mouth, blink, sway);
    ctx.drawImage(cv, view === 'right' ? x - 3 : x, y); // the flipped map is offset by 3
    return cv;
  }
  function renderHead(view, mouth, blink, sway) {
    let pb;
    if (view === 'cam' || view === 'side') {
      pb = headCanvas(CAM, [...(view === 'side' ? CAM_SIDE : []), ...(blink ? CAM_BLINK : []), ...(CAM_MOUTH[mouth] || [])], sway, false);
    } else {
      pb = headCanvas(SIDE, [...(blink ? SIDE_BLINK : []), ...(SIDE_MOUTH[mouth] || [])], sway, view === 'right');
    }
    // the same neon light as the body: pink on top, cyan on the right edge
    const src = pb.d.slice(), w = pb.w, h = pb.h;
    const on = (xx, yy) => xx >= 0 && yy >= 0 && xx < w && yy < h && src[yy * w + xx] >>> 24;
    for (let yy = 0; yy < h; yy++)
      for (let xx = 0; xx < w; xx++) {
        const i = yy * w + xx;
        if (!(src[i] >>> 24)) continue;
        let c = [src[i] & 255, (src[i] >> 8) & 255, (src[i] >> 16) & 255];
        if (!on(xx, yy - 1)) c = ND.mix(c, [255, 130, 225], 0.5);
        if (!on(xx + 1, yy)) c = ND.mix(c, [90, 230, 255], 0.3);
        pb.set(xx, yy, ND.pack(c[0], c[1], c[2]));
      }
    return pb.canvas();
  }
  const headCache = {};

  // ---- side view, for walking to the door and getting in -------------------------
  // A posed body facing left, in the car's coordinates. Pose: hip, shoulder,
  // and for each limb the elbow/knee and hand/ankle; `inside` names the parts
  // that are already in the car (drawn into a second layer the car clips to its
  // doorway, so he slides in behind the bodywork instead of popping).
  const PBOX = { x: 70, y: -44, w: 170, h: 150 };
  const pbIn = new ND.PB(PBOX.w, PBOX.h), pbOut = new ND.PB(PBOX.w, PBOX.h);

  function renderProfile(pose) {
    pbIn.d.fill(0); pbOut.d.fill(0);
    const ins = pose.inside || {};
    const L = (part) => (ins[part] ? pbIn : pbOut);
    const at = (p) => [p[0] - PBOX.x, p[1] - PBOX.y];
    const H = at(pose.hip), S = at(pose.sh);
    const u = [H[0] - S[0], H[1] - S[1]], ul = Math.hypot(u[0], u[1]) || 1;
    u[0] /= ul; u[1] /= ul;
    const f = [-u[1], u[0]]; // towards his front (left when upright)
    const shade = (c, k) => ND.scale(c, k);
    const leg = (lg, far) => {
      const k = far ? 0.72 : 1;
      const K = at(lg.knee), A = at(lg.ankle);
      const pb = L(far ? 'farLeg' : 'thigh');
      limb(pb, H, K, 4.6, 3.8, shade(C.pants, k), C.pantsDD);
      const ps = L(far ? 'farLeg' : 'shin');
      limb(ps, K, A, 3.6, 2.6, shade(C.pants, k), C.pantsDD);
      ps.lineFn(K[0], K[1] + 1, A[0], A[1] - 3, (x, y) => ps.set(x, y, ND.pack(...shade(C.pantsD, k))));
      // ankle and a loafer pointing forward (left)
      ps.rect(Math.round(A[0]) - 1, Math.round(A[1]) - 1, 3, 2, ND.pack(...shade(C.skin, k)));
      const fx = Math.round(A[0]), fy = Math.round(A[1]) + 1;
      for (let y = 0; y < 3; y++) for (let x = -8 + (y === 0 ? 3 : 0); x <= 2; x++) {
        const c = y === 2 ? C.sole : x === -8 || y === 0 ? C.shoeD : C.shoe;
        ps.set(fx + x, fy + y - 1, ND.pack(...shade(c, k)));
      }
    };
    const arm = (am, far) => {
      const k = far ? 0.72 : 1;
      const E = at(am.elbow), Hd = at(am.hand), Sx = far ? [S[0] + 2, S[1] + 1] : S;
      const pb = L(far ? 'farArm' : 'arm');
      limb(pb, Sx, E, 3.5, 3.0, shade(C.blazer, k), C.blazerDD);
      pb.disc(E[0], E[1], 2.9, ND.pack(...shade(C.blazerL, k)));
      pb.disc(E[0], E[1], 2.0, ND.pack(...shade(C.blazer, k)));
      limb(pb, E, Hd, 2.2, 1.9, shade(C.skin, k), C.skinD);
      pb.disc(Hd[0], Hd[1], 2.0, ND.pack(...shade(C.skin, k)));
      if (!far) { const wx = E[0] + (Hd[0] - E[0]) * 0.8, wy = E[1] + (Hd[1] - E[1]) * 0.8; pb.set(Math.round(wx), Math.round(wy), ND.pack(...C.gold)); }
    };
    // back to front: far leg and arm, torso and head, near leg and arm
    leg(pose.farLeg, true);
    arm(pose.farArm, true);
    const T = L('torso');
    const torso = [
      [S[0] + f[0] * 6, S[1] + f[1] * 6], [S[0] - f[0] * 6, S[1] - f[1] * 6],
      [H[0] - f[0] * 6 + u[0] * 4, H[1] - f[1] * 6 + u[1] * 4], [H[0] + f[0] * 5 + u[0] * 3, H[1] + f[1] * 5 + u[1] * 3],
      [S[0] + f[0] * 7 + u[0] * 12, S[1] + f[1] * 7 + u[1] * 12],
    ];
    T.polyFn(torso, (x, y) => {
      const v = ((x - S[0]) * u[0] + (y - S[1]) * u[1]) / ul;
      T.set(x, y, ND.pack(...ND.mix(C.blazer, C.blazerD, ND.clamp(v, 0, 1) * 0.5)));
    });
    // the open blazer shows a strip of tee down the chest
    T.lineFn(S[0] + f[0] * 5 + u[0] * 2, S[1] + f[1] * 5 + u[1] * 2, S[0] + f[0] * 6 + u[0] * 16, S[1] + f[1] * 6 + u[1] * 16, (x, y) => { T.set(x, y, ND.pack(...C.tee)); T.set(x + 1, y, ND.pack(...C.tee)); });
    T.rect(Math.round(S[0] - 2 + f[0] * 2), Math.round(S[1] - 4), 4, 5, ND.pack(...C.skin)); // neck
    // head: the side map, its neck on top of the shoulders
    // (seated, the small head from the car; on his feet, the big one)
    const hp = pose.small ? headCanvas(SIDE_SMALL, [], pose.sway || 0, false)
      : headCanvas(SIDE, [...(pose.blink ? SIDE_BLINK : []), ...(SIDE_MOUTH[pose.mouth || 0] || [])], pose.sway || 0, false);
    const hx = Math.round(S[0] + f[0] * 1.5 - (pose.small ? 9 : 8.5)), hy = Math.round(S[1] - (pose.small ? 20 : 24));
    L('head').blit(hp, hx, hy);
    leg(pose.nearLeg, false);
    arm(pose.nearArm, false);
    // light: outside he catches the sign (pink on top, cyan behind); inside the
    // cabin is darker and there's no outline
    for (const [pb, inside] of [[pbOut, false], [pbIn, true]]) {
      const src = pb.d.slice(), w = pb.w, h = pb.h;
      const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] >>> 24;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (!(src[i] >>> 24)) {
            if (!inside && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) pb.set(x, y, ND.pack(C.ink[0], C.ink[1], C.ink[2], 200));
            continue;
          }
          let c = [src[i] & 255, (src[i] >> 8) & 255, (src[i] >> 16) & 255];
          if (inside) c = ND.mix(ND.scale(c, 0.78), [120, 70, 160], 0.12);
          else {
            if (!on(x, y - 1)) c = ND.mix(c, [255, 120, 220], 0.5);
            if (!on(x + 1, y)) c = ND.mix(c, [90, 230, 255], 0.35);
            if (!on(x - 1, y)) c = ND.mix(c, [255, 110, 210], 0.25);
            c = ND.mix(c, [150, 110, 220], 0.08);
          }
          pb.set(x, y, ND.pack(c[0], c[1], c[2]));
        }
    }
    const out = { box: PBOX, inC: pbIn.isEmpty() ? null : pbIn.canvas(), outC: pbOut.isEmpty() ? null : pbOut.canvas() };
    return out;
  }

  ND.genDude = genDude;
  ND.renderDudeProfile = renderProfile;
  ND.drawDudeHead = drawHead;
  ND.DUDE_PAL = PAL;
  ND.DUDE = { W: DW, H: DH, FOOT, HX, HY };
})();
