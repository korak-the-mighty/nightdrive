/* Nightdrive — the oncoming specials: a fire truck (with its dalmatian), an
 * ambulance, a red sports car with the cops right behind it, an ice-cream van,
 * a hot-dog van, a stretch limo with someone waving out of the sunroof, and a
 * pink convertible full of big hair and a boombox. Drawn at the far lane's
 * scale facing left like the other traffic; the oncoming lane mirrors them.
 */
(function () {
  'use strict';
  const ND = window.ND;
  const { rgb } = ND;
  const WR = 13; // wheel radius, as on the traffic

  // --- little drawing kit -------------------------------------------------------------
  function kit(w, h) {
    const pb = new ND.PB(w, h), gl = new ND.PB(w, h);
    const P = (c, a = 255) => ND.pack(c[0], c[1], c[2], a);
    return {
      pb, gl, P,
      // painted panel: lit top edge, darker towards the sill, a pink/cyan night tint
      body(poly, base, y0, y1) {
        pb.polyFn(poly, (x, y) => {
          const t = ND.clamp((y - y0) / Math.max(1, y1 - y0), 0, 1);
          let c = ND.scale(base, 1.12 - t * 0.5);
          c = ND.mix(c, [255, 120, 220], 0.08 * (1 - t));
          c = ND.mix(c, [110, 190, 255], 0.1 * t);
          pb.dset(x, y, c, 255, 8);
        });
        // lit top edge
        const set = new Set();
        pb.polyFn(poly, (x, y) => set.add(x + ',' + y));
        for (const k of set) {
          const [x, y] = k.split(',').map(Number);
          if (!set.has(x + ',' + (y - 1))) pb.set(x, y, P(ND.mix(ND.scale(base, 1.45), [255, 210, 240], 0.35)));
        }
      },
      glass(poly) {
        pb.polyFn(poly, (x, y) => {
          let c = ND.mix(rgb('#3c3270'), rgb('#120e24'), ND.clamp((y % 40) / 22, 0, 1));
          if ((x + y * 2) % 23 < 2) c = ND.mix(c, rgb('#c0a8f0'), 0.35);
          pb.set(x, y, P(c));
        });
      },
      rect(x, y, w2, h2, c) { pb.rect(x, y, w2, h2, P(c)); },
      px(x, y, c) { pb.set(x, y, P(c)); },
      chrome(x0, x1, y, k = 1) { for (let x = x0; x <= x1; x++) pb.set(x, y, P(ND.scale(rgb('#dcdcee'), k))); },
      arch(cx, cy, r = WR + 2) { pb.discFn(cx, cy, r, (x, y) => { if (y <= cy + 2) pb.set(x, y, P(rgb('#0e0a14'))); }); },
      lamp(x, y, w2, h2, c, g) { for (let yy = y; yy < y + h2; yy++) for (let xx = x; xx < x + w2; xx++) { pb.set(xx, yy, P(c)); gl.set(xx, yy, P(g)); } },
      // lettering is painted back to front: the oncoming lane flips the whole sprite
      text(s, x, y, c, small = true) {
        const mk = ND.textMask(s, { small, gap: 1 });
        for (let yy = 0; yy < mk.h; yy++) for (let xx = 0; xx < mk.w; xx++) if (mk.m[yy * mk.w + xx]) pb.set(x + mk.w - 1 - xx, y + yy, P(c));
        return mk.w;
      },
    };
  }
  const firstRow = (pb) => { for (let i = 0; i < pb.d.length; i++) if (pb.d[i] >>> 24) return Math.floor(i / pb.w); return 0; };
  const finish = (K, w, h, extra) => Object.assign({
    body: ND.sprite(K.pb, K.gl), w, h, ground: h - 1, wheelR: WR, top: firstRow(K.pb),
  }, extra);

  // --- the fire truck: cab, red body, ladder, light bar, a dalmatian riding along -----
  function fireTruck() {
    const w = 300, h = 84, wy = h - 1 - WR, K = kit(w, h), red = rgb('#d01c2a');
    K.body([[2, 34], [5, 18], [12, 8], [70, 8], [74, 12], [74, wy + 2], [2, wy + 2]], red, 8, wy);
    K.body([[74, 20], [298, 20], [298, wy + 2], [74, wy + 2]], red, 20, wy);
    for (const wx of [46, 222, 254]) K.arch(wx, wy);
    K.glass([[9, 18], [16, 11], [40, 11], [40, 32], [9, 32]]);
    K.glass([[44, 11], [68, 11], [68, 32], [44, 32]]);
    // ladder along the top
    K.chrome(70, 296, 13, 0.9); K.chrome(70, 296, 17, 0.7);
    for (let x = 74; x <= 294; x += 8) for (let y = 14; y <= 16; y++) K.px(x, y, rgb('#b8bcd0'));
    for (const x of [90, 200, 280]) for (let y = 18; y <= 20; y++) K.px(x, y, rgb('#8a8ea8'));
    // compartments, chrome strip, white reflective band
    for (let x = 102; x < 296; x += 28) for (let y = 24; y < wy - 4; y++) K.px(x, y, ND.scale(red, 0.6));
    K.chrome(74, 297, 44, 0.95); K.chrome(74, 297, 45, 0.7);
    for (let x = 2; x < 298; x++) for (let y = 52; y <= 54; y++) if (K.pb.alpha(x, y)) K.px(x, y, ND.mix(rgb('#f4f2ea'), rgb('#ffd27a'), (x % 6 < 3) ? 0 : 0.4));
    K.text('FIRE DEPT', 110, 32, rgb('#ffd65a'));
    // light bar on the cab
    K.rect(18, 3, 44, 5, rgb('#2a2434'));
    K.lamp(0, 46, 4, 5, rgb('#fff6da'), [255, 240, 200]);
    K.lamp(295, 48, 4, 8, rgb('#ff2a3c'), [255, 30, 50]);
    for (let y = 58; y <= 64; y++) for (let x = 0; x <= 6; x++) K.px(x, y, ND.scale(rgb('#dcdcee'), 1 - x * 0.05));
    // the dalmatian, head out of the passenger window (ears drawn live)
    const anim = (ctx, t) => {
      const dx = 50, dy = 14;
      ctx.fillStyle = '#f4f2f0'; ctx.fillRect(dx, dy, 9, 8); ctx.fillRect(dx - 3, dy + 3, 4, 4);
      ctx.fillStyle = '#16121c';
      ctx.fillRect(dx - 3, dy + 3, 1, 1); ctx.fillRect(dx + 2, dy + 2, 1, 1); ctx.fillRect(dx + 6, dy + 5, 2, 1); ctx.fillRect(dx + 4, dy + 6, 1, 1);
      ctx.fillRect(dx + 1, dy + 1, 1, 1); // eye
      const flap = Math.sin(t * 22) > 0 ? 1 : 0; // ears in the wind
      ctx.fillStyle = '#26202c'; ctx.fillRect(dx + 7, dy - 1 - flap, 3, 4);
      ctx.fillStyle = '#ff6a8a'; if (Math.sin(t * 9) > 0.3) ctx.fillRect(dx - 2, dy + 7, 2, 2); // tongue
    };
    return finish(K, w, h, {
      wheels: [[46, wy], [222, wy], [254, wy]], wheelFrames: ND.genTrafficWheels('rally', false), lampY: 48, anim,
      flash: [{ x: 18, y: 3, w: 12, h: 5, col: '#ff2040', rate: 8 }, { x: 50, y: 3, w: 12, h: 5, col: '#ff2040', rate: 8, ph: 1 }, { x: 34, y: 3, w: 10, h: 5, col: '#ffffff', rate: 4 }],
    });
  }

  // --- the ambulance: a van cab and a tall white box -------------------------------------
  function ambulance() {
    const w = 230, h = 80, wy = h - 1 - WR, K = kit(w, h), white = rgb('#eceaf4');
    K.body([[2, 40], [6, 30], [14, 22], [48, 20], [52, 24], [52, wy + 2], [2, wy + 2]], white, 20, wy);
    K.body([[50, 6], [228, 6], [228, wy + 2], [50, wy + 2]], white, 6, wy);
    for (const wx of [40, 190]) K.arch(wx, wy);
    K.glass([[10, 30], [18, 24], [40, 24], [40, 38], [10, 38]]);
    for (let x = 2; x < 228; x++) for (let y = 42; y <= 47; y++) if (K.pb.alpha(x, y)) K.px(x, y, y < 45 ? rgb('#ff5a2a') : rgb('#d82a2a'));
    K.text('AMBULANCE', 96, 24, rgb('#d82a2a'));
    for (let y = 8; y < wy; y++) K.px(226, y, rgb('#a8a6b8'));
    K.glass([[200, 14], [222, 14], [222, 30], [200, 30]]);
    K.rect(50, 1, 178, 5, rgb('#2a2434'));
    K.lamp(0, 50, 4, 5, rgb('#fff6da'), [255, 240, 200]);
    K.lamp(225, 50, 4, 8, rgb('#ff2a3c'), [255, 30, 50]);
    return finish(K, w, h, {
      wheels: [[40, wy], [190, wy]], wheelFrames: ND.genTrafficWheels('dogdish', false), lampY: 52,
      flash: [{ x: 52, y: 1, w: 12, h: 5, col: '#ff2040', rate: 7 }, { x: 214, y: 1, w: 12, h: 5, col: '#ff2040', rate: 7, ph: 1 }, { x: 132, y: 1, w: 10, h: 5, col: '#ffffff', rate: 5 }],
    });
  }

  // --- the red sports car: low, wide hips, a whale-tail spoiler --------------------------
  function sportsCar() {
    const w = 196, h = 54, wy = h - 1 - WR, K = kit(w, h), red = rgb('#e0141e');
    K.body([[0, 34], [2, 28], [26, 23], [58, 19], [78, 9], [98, 7], [122, 10], [148, 19], [176, 20], [192, 22], [195, 30], [195, wy + 2], [0, wy + 2]], red, 7, wy);
    for (const wx of [36, 158]) K.arch(wx, wy);
    K.glass([[82, 11], [98, 9], [98, 19], [70, 19]]);
    K.glass([[102, 9], [120, 12], [134, 19], [102, 19]]);
    K.body([[164, 16], [192, 11], [194, 16], [168, 20]], rgb('#1a141e'), 11, 20); // the whale tail
    for (let x = 22; x <= 32; x++) K.px(x, 22, rgb('#ffb0b0'));
    K.lamp(0, 28, 3, 4, rgb('#fff6da'), [255, 240, 200]);
    K.lamp(192, 26, 3, 5, rgb('#ff2a3c'), [255, 30, 50]);
    for (let x = 0; x < 196; x++) for (let y = 36; y <= 38; y++) if (K.pb.alpha(x, y)) K.px(x, y, rgb('#1a141e'));
    return finish(K, w, h, { wheels: [[36, wy], [158, wy]], wheelFrames: ND.genTrafficWheels('snowflake', false), lampY: 30 });
  }

  // --- a van with something enormous on the roof -------------------------------------------
  function van(kind) {
    // box top T; the roof prop sits above it, kept low so it never rises over our car
    const w = 216, h = 82, wy = h - 1 - WR, T = 26, K = kit(w, h);
    const ice = kind === 'icecream';
    const cab = ice ? rgb('#8fe8d0') : rgb('#ffd23a'), box = ice ? rgb('#ffb0d8') : rgb('#e8322a');
    K.body([[2, T + 22], [6, T + 13], [16, T + 4], [52, T + 2], [56, T + 6], [56, wy + 2], [2, wy + 2]], cab, T + 2, wy);
    K.body([[54, T], [214, T], [214, wy + 2], [54, wy + 2]], box, T, wy);
    for (const wx of [40, 176]) K.arch(wx, wy);
    K.glass([[10, T + 13], [18, T + 7], [42, T + 7], [42, T + 20], [10, T + 20]]);
    // serving hatch with a striped awning, someone inside
    K.rect(88, T + 9, 84, 14, [40, 22, 40]);
    for (let x = 88; x < 172; x++) for (let y = T + 4; y < T + 9; y++) K.px(x, y, (Math.floor((x - 88) / 6) % 2) ? rgb('#ffffff') : ice ? rgb('#40c0a0') : rgb('#ffd23a'));
    K.rect(126, T + 12, 6, 6, [240, 180, 150]); K.rect(124, T + 18, 10, 5, ice ? [120, 220, 200] : [255, 255, 255]);
    K.text(ice ? 'ICE CREAM' : 'HOT DOGS', 98, T + 26, ice ? rgb('#ffffff') : rgb('#ffd23a'));
    K.lamp(0, T + 27, 4, 5, rgb('#fff6da'), [255, 240, 200]);
    K.lamp(211, T + 27, 4, 8, rgb('#ff2a3c'), [255, 30, 50]);
    const P = K.P;
    if (ice) {
      // a giant cone: wafer with a cross-hatch, a swirl of strawberry and vanilla, a cherry
      K.pb.polyFn([[122, T - 9], [142, T - 9], [132, T + 1]], (x, y) => K.pb.set(x, y, P((x + y) % 4 === 0 || (x - y + 100) % 4 === 0 ? rgb('#b07a3a') : rgb('#e8b878'))));
      K.pb.discFn(132, T - 14, 7, (x, y) => { if (y <= T - 9) K.pb.set(x, y, P(((x * 2 + y) % 7 < 3) ? rgb('#ff9ad0') : rgb('#fff4f8'))); });
      K.pb.discFn(132, T - 21, 2, (x, y) => K.pb.set(x, y, P(rgb('#e8142a'))));
    } else {
      // a giant hot dog: bun, sausage, a squiggle of mustard
      const b = T - 10;
      for (let x = 92; x <= 176; x++) {
        const t = (x - 92) / 84, half = Math.sin(t * Math.PI);
        for (let y = Math.round(b + 4 - half * 3); y <= Math.round(b + 7 + half * 3); y++) K.px(x, y, y > b + 6 ? rgb('#c88a48') : rgb('#e8b070'));
        for (let y = Math.round(b + 1 - half * 2); y <= b + 4; y++) K.px(x, y, rgb('#a83a22'));
        K.px(x, Math.round(b + 1 - half * 2 + (Math.floor(x / 4) % 2 ? 0 : 1)), rgb('#ffd21e'));
      }
      for (let x = 86; x <= 92; x++) for (let y = b + 1; y <= b + 4; y++) K.px(x, y, rgb('#8a2a1a'));
      for (let x = 176; x <= 182; x++) for (let y = b + 1; y <= b + 4; y++) K.px(x, y, rgb('#8a2a1a'));
      for (let x = 130; x <= 134; x++) for (let y = b + 8; y < T; y++) K.px(x, y, rgb('#8c8ca0')); // the post
    }
    return finish(K, w, h, { wheels: [[40, wy], [176, wy]], wheelFrames: ND.genTrafficWheels('cover', true), lampY: T + 29 });
  }

  // --- the stretch limo, with someone waving out of the sunroof ------------------------------
  function limo() {
    // O rows of headroom above the roof for the one waving out of the sunroof
    const O = 8, w = 380, h = 58 + O, wy = h - 1 - WR, K = kit(w, h), pearl = rgb('#e6e2f0');
    K.body([[0, O + 36], [2, O + 30], [6, O + 28], [52, O + 26], [60, O + 16], [64, O + 15], [336, O + 15], [342, O + 16], [350, O + 26], [374, O + 28], [378, O + 32], [378, wy + 2], [0, wy + 2]], pearl, O + 15, wy);
    for (const wx of [40, 336]) K.arch(wx, wy);
    K.glass([[62, O + 25], [68, O + 18], [92, O + 18], [92, O + 25]]);
    for (let x = 98; x < 330; x += 34) K.glass([[x, O + 18], [x + 30, O + 18], [x + 30, O + 25], [x, O + 25]]);
    K.chrome(4, 374, O + 32, 0.9); K.chrome(4, 374, wy - 2, 0.6);
    K.lamp(0, O + 30, 3, 4, rgb('#fff6da'), [255, 240, 200]);
    K.lamp(375, O + 30, 3, 5, rgb('#ff2a3c'), [255, 30, 50]);
    const anim = (ctx, t) => {
      // a party animal out of the sunroof, waving at everyone
      const sx = 214, sy = O + 15;
      ctx.fillStyle = '#ff5ab4'; ctx.fillRect(sx, sy - 9, 8, 9);           // shirt
      ctx.fillStyle = '#f0b494'; ctx.fillRect(sx + 1, sy - 16, 6, 7);       // face
      ctx.fillStyle = '#2a1a14'; ctx.fillRect(sx - 1, sy - 19, 10, 4); ctx.fillRect(sx - 2, sy - 16, 3, 5); // big hair
      ctx.fillStyle = '#16121c'; ctx.fillRect(sx + 2, sy - 13, 4, 1);       // shades
      const a = Math.sin(t * 10) * 3;
      ctx.fillStyle = '#f0b494'; ctx.fillRect(sx + 8, sy - 9, 2, 2); ctx.fillRect(sx + 9 + Math.round(a * 0.5), sy - 13, 2, 4); ctx.fillRect(sx + 9 + Math.round(a), sy - 16, 3, 3);
    };
    return finish(K, w, h, { wheels: [[40, wy], [336, wy]], wheelFrames: ND.genTrafficWheels('wire', true), lampY: O + 31, anim, top: O - 4 });
  }

  // --- the pink convertible: tail fins, three heads of big hair, a boombox ------------------
  function partyCar() {
    const w = 222, h = 60, wy = h - 1 - WR, K = kit(w, h), pink = rgb('#ff6ab8');
    K.body([[0, 38], [3, 31], [40, 28], [196, 28], [210, 18], [216, 18], [218, 30], [220, 38], [220, wy + 2], [0, wy + 2]], pink, 18, wy);
    for (const wx of [40, 180]) K.arch(wx, wy);
    K.chrome(2, 218, 33, 0.95); K.chrome(4, 216, wy - 1, 0.7);
    for (let y = 16; y <= 28; y++) K.px(70 + Math.round((28 - y) * 0.5), y, rgb('#e8e8f4')); // windscreen frame
    K.rect(84, 24, 120, 4, [250, 240, 240]); // white leather tops of the seats
    K.lamp(0, 32, 3, 4, rgb('#fff6da'), [255, 240, 200]);
    K.lamp(213, 18, 4, 6, rgb('#ff2a3c'), [255, 30, 50]);
    const folks = [[96, '#ffe070', '#8af0ff'], [128, '#1c1018', '#ffd23a'], [160, '#c8401c', '#b090ff']];
    const anim = (ctx, t) => {
      folks.forEach(([fx, hair, top], i) => {
        const bob = Math.round(Math.abs(Math.sin(t * 7.5 + i)) * 2);
        const y0 = 6 - bob;
        ctx.fillStyle = top; ctx.fillRect(fx - 4, y0 + 13, 10, 9);
        ctx.fillStyle = '#f0b494'; ctx.fillRect(fx - 2, y0 + 5, 6, 8);
        ctx.fillStyle = hair; ctx.fillRect(fx - 4, y0 + 1, 10, 6); ctx.fillRect(fx - 5, y0 + 4, 3, 8); ctx.fillRect(fx + 4, y0 + 4, 3, 7);
        if (i === 1) { ctx.fillStyle = '#f0b494'; ctx.fillRect(fx + 6, y0 + 2 - bob, 2, 8); } // hands up
      });
      // the boombox on the back seat, speakers pumping
      const p = Math.sin(t * 15) > 0 ? 1 : 0;
      ctx.fillStyle = '#16121c'; ctx.fillRect(184, 12, 24, 13);
      ctx.fillStyle = '#c8ccdc'; ctx.fillRect(185, 10, 22, 2);
      ctx.fillStyle = '#8a8ea8'; ctx.fillRect(186, 15, 7, 7); ctx.fillRect(199, 15, 7, 7);
      ctx.fillStyle = '#2a2436'; ctx.fillRect(188 - p, 17 - p, 3 + p * 2, 3 + p * 2); ctx.fillRect(201 - p, 17 - p, 3 + p * 2, 3 + p * 2);
    };
    return finish(K, w, h, { wheels: [[40, wy], [180, wy]], wheelFrames: ND.genTrafficWheels('wire', true), lampY: 34, anim, top: 4 });
  }

  // The specials and how they behave in the oncoming lane.
  // v: own speed towards us (the ordinary cars do 3.4-4.8). The jokes take it easy so
  // they're on screen for about two seconds; the chase is the exception.
  ND.ONCOMING_SPECIALS = {
    fire: { sprite: 'fire', v: 1.0, siren: 'fire', talk: 'oc-fire', engine: 70, loud: 0.28 },
    ambulance: { sprite: 'ambulance', v: 1.6, siren: 'wail', talk: 'oc-ambulance' },
    chase: { sprite: 'sports', v: 5.6, engine: 150, loud: 0.3, then: 'cops', gap: 40 },
    cops: { sprite: 'police', v: 5.2, siren: 'yelp', talk: 'oc-chase', follow: true },
    icecream: { sprite: 'icecream', v: 0.3, tune: 'icecream', talk: 'oc-icecream' },
    hotdog: { sprite: 'hotdog', v: 0.3, tune: 'hotdog', talk: 'oc-hotdog' },
    limo: { sprite: 'limo', v: 1.0, talk: 'oc-limo', engine: 80 },
    party: { sprite: 'party', v: 0.6, tune: 'party', talk: 'oc-party' },
  };

  ND.genVehicles = function (seed) {
    const police = ND.genTraffic(seed, { special: 'police', mirrorText: true });
    const b = police.bar;
    police.flash = [{ x: b.x, y: b.y, w: b.w >> 1, h: b.h, col: '#ff2040', rate: 7 }, { x: b.x + (b.w >> 1), y: b.y, w: b.w - (b.w >> 1), h: b.h, col: '#3060ff', rate: 7, ph: 1 }];
    return {
      fire: fireTruck(), ambulance: ambulance(), sports: sportsCar(), police,
      icecream: van('icecream'), hotdog: van('hotdog'), limo: limo(), party: partyCar(),
    };
  };
})();
