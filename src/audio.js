/* Nightdrive — endless generative night-drive soundtrack (Web Audio).
 *
 * Everything is synthesised live. Each track is composed on the fly (style,
 * key, tempo, progression, melodies) in one of three 80s styles:
 *   miami   — four-on-the-floor disco: gated snare, octave bass,
 *             sidechain-pumped supersaw chords, arps and a soaring lead;
 *   amiga   — a tracker/MOD tune: crunchy 8-bit drum samples, chords as fast
 *             chip arpeggios, squarewave leads with vibrato, slides and echo;
 *   electro — an 808-style kit with cowbell and Simmons toms, a sequenced
 *             synth bass, brass stabs, orchestra hits and staccato riffs;
 *   noir    — slow, dark outrun in the spirit of Kavinsky's Nightcall: a
 *             gritty driven bass pulsing in eighths, a huge gated snare on
 *             two and four, brooding pads, a lonely echoing lead, a deep
 *             robot voice in the verses and a soft female voice answering.
 * Every track follows an arc built on anticipation: intro → verse → build →
 * drop → breakdown → a longer build → the final drop with a key lift → outro.
 * A vocal pack (spoken hooks, sung chops, and robot lines sung through a
 * vocoder) is woven in, and rain, thunder and tyre hiss follow the weather.
 */
(function () {
  'use strict';
  const ND = window.ND;

  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const MINOR = [0, 2, 3, 5, 7, 8, 10];
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  // Chord loops as natural-minor scale degrees (0 = i). Degree 4 is played as a
  // major V (harmonic minor) when `dom` is set.
  const PROGS = [
    { d: [0, 5, 2, 6] }, { d: [0, 6, 5, 6] }, { d: [5, 6, 0, 0] }, { d: [0, 3, 5, 4], dom: true },
    { d: [0, 5, 3, 4], dom: true }, { d: [3, 5, 0, 6] }, { d: [0, 2, 6, 5] }, { d: [5, 2, 6, 0] },
    { d: [5, 6, 2, 0] }, { d: [3, 6, 2, 5] }, { d: [0, 5, 6, 4], dom: true }, { d: [5, 4, 0, 6], dom: true },
  ];

  const STYLES = ['miami', 'amiga', 'electro', 'noir'];
  const BPMS = {
    miami: [108, 110, 112, 114, 115, 116, 118, 120, 122],
    amiga: [118, 120, 122, 125, 125, 128],
    electro: [104, 106, 108, 110, 112, 115, 118],
    noir: [86, 88, 90, 91, 92, 94, 96],
  };
  // Noir chords: slow, dark minor loops (no bright major V)
  const NOIR_PROGS = [{ d: [0, 5, 2, 6] }, { d: [0, 5, 6, 0] }, { d: [0, 3, 5, 4] }, { d: [5, 6, 0, 0] }, { d: [0, 6, 5, 6] }, { d: [0, 2, 5, 6] }];

  // Lead rhythms over two bars: [16th step, length]
  const RHYTHMS = {
    miami: [
      [[0, 3], [3, 3], [6, 2], [8, 4], [12, 2], [14, 2], [16, 6], [22, 2], [24, 6], [30, 2]],
      [[0, 2], [2, 2], [4, 4], [10, 2], [12, 4], [16, 2], [18, 2], [20, 6], [28, 4]],
      [[2, 2], [4, 2], [6, 4], [12, 4], [18, 2], [20, 2], [22, 4], [28, 2], [30, 2]],
      [[0, 6], [6, 2], [8, 6], [14, 2], [16, 4], [20, 4], [24, 8]],
      [[0, 8], [8, 4], [12, 4], [16, 12], [28, 4]],
      [[0, 3], [3, 3], [6, 4], [10, 2], [12, 4], [16, 3], [19, 3], [22, 4], [26, 6]],
    ],
    // tracker runs: quick 16th figures around held notes
    amiga: [
      [[0, 1], [1, 1], [2, 2], [4, 4], [8, 1], [9, 1], [10, 2], [12, 4], [16, 1], [17, 1], [18, 2], [20, 2], [22, 2], [24, 8]],
      [[0, 6], [6, 1], [7, 1], [8, 6], [14, 1], [15, 1], [16, 4], [20, 2], [22, 2], [24, 4], [28, 1], [29, 1], [30, 2]],
      [[0, 2], [2, 1], [3, 1], [4, 2], [6, 2], [8, 8], [16, 2], [18, 1], [19, 1], [20, 2], [22, 2], [24, 8]],
      [[0, 4], [4, 1], [5, 1], [6, 1], [7, 1], [8, 4], [12, 4], [16, 3], [19, 3], [22, 2], [24, 1], [25, 1], [26, 1], [27, 1], [28, 4]],
    ],
    // long, lonely notes with room to echo
    noir: [
      [[0, 6], [6, 2], [8, 8], [16, 6], [22, 2], [24, 8]],
      [[0, 4], [4, 4], [8, 12], [20, 4], [24, 8]],
      [[0, 8], [8, 6], [14, 2], [16, 16]],
      [[2, 2], [4, 10], [16, 4], [20, 4], [24, 8]],
    ],
    // staccato, syncopated riffs with room for octave jumps
    electro: [
      [[0, 2], [3, 1], [6, 1], [8, 2], [10, 1], [11, 1], [14, 2], [16, 2], [19, 1], [22, 2], [24, 1], [26, 2], [28, 4]],
      [[0, 1], [2, 1], [3, 2], [6, 2], [8, 1], [10, 1], [12, 4], [16, 1], [18, 1], [19, 2], [22, 2], [24, 6]],
      [[0, 3], [3, 3], [6, 2], [10, 1], [11, 1], [12, 2], [16, 3], [19, 3], [22, 1], [23, 1], [24, 8]],
      [[0, 2], [2, 2], [4, 1], [6, 1], [7, 1], [8, 4], [14, 1], [15, 1], [16, 2], [18, 2], [20, 1], [22, 1], [23, 1], [24, 4], [28, 2], [30, 2]],
    ],
  };
  // calmer rhythms for the verse melodies
  const VERSE_RHYTHMS = [
    [[0, 6], [6, 2], [8, 8], [16, 6], [22, 2], [24, 8]],
    [[0, 4], [4, 4], [8, 8], [16, 4], [20, 4], [24, 8]],
    [[2, 2], [4, 6], [12, 4], [18, 2], [20, 6], [28, 4]],
    [[0, 8], [8, 3], [11, 5], [16, 8], [24, 4], [28, 4]],
  ];
  // Grooves. Kicks, chip chords and bass are one bar of 16ths; cowbells and
  // stabs span two bars. Bass hits are [step, interval above the root, length].
  const KICKS = {
    amiga: [[0, 4, 8, 12], [0, 4, 8, 12], [0, 3, 8, 11], [0, 6, 8, 12]],
    electro: [[0, 6, 10], [0, 3, 6, 10], [0, 4, 8, 12], [0, 7, 10], [0, 6, 8, 11]],
    noir: [[0, 8], [0, 8, 10], [0, 7, 8], [0, 10]], // half-time
  };
  const CHIP_CHORDS = [[0, 4, 8, 12], [0, 3, 6, 8, 11, 14], [0, 2, 4, 6, 8, 10, 12, 14], [0, 6, 8, 14]];
  const BELLS = [[2, 6, 11, 14, 18, 22, 27, 30], [0, 3, 6, 10, 12, 16, 19, 22, 26, 28], [3, 6, 10, 14, 19, 22, 26, 30]];
  const STABS = [[2, 6, 10, 14, 18, 22, 26, 30], [0, 3, 6, 10, 16, 19, 22, 26, 28], [3, 6, 11, 14, 19, 22, 27, 30], [0, 6, 12, 16, 22, 28]];
  const BASSES = {
    // the pulse: eighths on the root, an octave or a fifth to turn the bar around
    noir: [
      [[0, 0, 2], [2, 0, 2], [4, 0, 2], [6, 0, 2], [8, 0, 2], [10, 0, 2], [12, 0, 2], [14, 12, 2]],
      [[0, 0, 2], [2, 0, 2], [4, 12, 2], [6, 0, 2], [8, 0, 2], [10, 0, 2], [12, 12, 2], [14, 0, 2]],
      [[0, 0, 3], [3, 0, 1], [4, 0, 2], [6, 0, 2], [8, 0, 3], [11, 0, 1], [12, 0, 2], [14, 7, 2]],
    ],
    amiga: [
      [[0, 0, 2], [3, 0, 1], [4, 12, 2], [6, 0, 2], [8, 0, 2], [11, 0, 1], [12, 12, 2], [14, 7, 2]],
      [[0, 0, 2], [2, 12, 2], [4, 0, 2], [6, 12, 2], [8, 0, 2], [10, 12, 2], [12, 0, 2], [14, 12, 2]],
      [[0, 0, 3], [3, 0, 3], [6, 12, 2], [8, 0, 3], [11, 0, 3], [14, 12, 2]],
    ],
    electro: [
      [[0, 0, 2], [3, 0, 1], [4, 12, 1], [6, 0, 2], [8, 0, 1], [10, 0, 1], [11, 12, 1], [14, 0, 2]],
      [[0, 0, 1], [1, 0, 1], [3, 0, 1], [6, 0, 2], [8, 0, 1], [9, 0, 1], [11, 7, 1], [14, 12, 2]],
      [[0, 0, 3], [3, 0, 3], [6, 0, 2], [8, 0, 1], [10, 12, 1], [11, 0, 1], [12, 7, 2], [14, 12, 2]],
      [[0, 0, 1], [2, 0, 1], [3, 12, 1], [5, 0, 1], [6, 0, 1], [8, 0, 1], [10, 0, 1], [11, 12, 1], [13, 0, 1], [14, 7, 2]],
    ],
  };
  // Vocoder: filter bands, envelope make-up gain and output level.
  const VOC_BANDS = 18, VOC_GAIN = 12, VOC_OUT = 0.75;
  // The driver won't bring the same subject up again for this long (seconds):
  // one lightning remark per storm, not one per strike.
  const TALK_COOLDOWN = { lightning: 240, storm: 300, rain: 150, window: 400, clear: 150, mist: 150, heli: 200, blimp: 300, smoke: 300, fast: 60, slow: 60, stop: 90 };
  // Talk box: first three formants of the vowels it "sings" through, and the
  // closed vowel every note opens from.
  const FORMANTS = { a: [730, 1090, 2440], e: [530, 1840, 2480], i: [300, 2200, 2950], o: [570, 840, 2410], u: [320, 800, 2240] };
  const TB_VOWELS = ['a', 'o', 'a', 'e', 'a', 'o', 'i', 'a'];
  // What the vocoder sings: chord-tone indices, one per syllable, and the last note.
  const VOC_MELODIES = [
    { notes: [0, 0, 1, 2, 1], end: 0 }, { notes: [2, 1, 1, 0], end: 0 }, { notes: [0, 2, 1, 2], end: 1 },
    { notes: [1, 1, 2, 3], end: 2 }, { notes: [0, 1, 2, 3], end: 3 },
  ];
  const ARPS = [
    [0, 1, 2, 3, 0, 1, 2, 3], [0, 2, 1, 3, 0, 2, 1, 3], [0, 1, 2, 3, 2, 1, 0, 1],
    [0, 3, 2, 3, 1, 3, 2, 3], [3, 2, 1, 0, 3, 2, 1, 0], [0, 0, 2, 1, 3, 1, 2, 1],
  ];
  // Vocal chop rhythms over two bars: [16th step, length]
  const CHOP_RHYTHMS = [
    [[0, 3], [3, 3], [6, 2], [12, 2], [16, 3], [19, 3], [22, 2], [28, 4]],
    [[2, 2], [6, 2], [10, 2], [14, 2], [18, 2], [22, 2], [26, 2], [30, 2]],
    [[0, 6], [8, 2], [10, 2], [12, 4], [16, 6], [24, 8]],
    [[0, 2], [2, 2], [4, 4], [12, 2], [14, 2], [16, 2], [18, 2], [20, 8]],
  ];
  const CHOP_NOTES = [[3, 2, 3, 1, 3, 2, 0, 2], [0, 1, 2, 3, 2, 1, 2, 3], [3, 3, 2, 2, 1, 1, 2, 3]];

  // Pitch of a sung clip (autocorrelation over a steady slice), in MIDI.
  function detectPitch(d, sr, from, to) {
    const N = 2048;
    const start = Math.max(0, Math.floor(from + (to - from) * 0.35));
    if (start + N * 2 > d.length) return null;
    const minLag = Math.floor(sr / 1000), maxLag = Math.floor(sr / 75);
    let best = 0, bestLag = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let s = 0, e1 = 0, e2 = 0;
      for (let i = 0; i < N; i++) {
        const a = d[start + i], b = d[start + i + lag];
        s += a * b; e1 += a * a; e2 += b * b;
      }
      const c = s / Math.sqrt(e1 * e2 + 1e-12);
      if (c > best) { best = c; bestLag = lag; }
    }
    if (best < 0.6 || !bestLag) return null;
    return 69 + 12 * Math.log2(sr / bestLag / 440);
  }

  // Syllable onsets of a spoken line, in seconds from its first sound: the
  // points where the loudness climbs again after a dip.
  function syllables(d, sr, from, to) {
    const hop = Math.round(sr * 0.01), env = [];
    for (let i = from; i < to; i += hop) {
      const e = Math.min(to, i + hop);
      let s = 0;
      for (let j = i; j < e; j++) s += d[j] * d[j];
      env.push(Math.sqrt(s / Math.max(1, e - i)));
    }
    const sm = env.map((v, i) => (env[i - 1] || v) * 0.25 + v * 0.5 + (env[i + 1] || v) * 0.25);
    const peak = Math.max(...sm) || 1;
    const out = [0];
    let hi = 0, lo = Infinity, armed = false, last = 0;
    for (let i = 0; i < sm.length; i++) {
      const v = sm[i];
      if (!armed) {
        hi = Math.max(hi, v);
        if (hi > 0.2 * peak && v < 0.5 * hi) { armed = true; lo = v; }
      } else {
        lo = Math.min(lo, v);
        if (v > Math.max(1.8 * lo, 0.22 * peak) && i - last >= 12) {
          out.push((i * hop) / sr);
          last = i;
          armed = false;
          hi = v;
        }
      }
    }
    return out;
  }

  // Band-limited pulse wave for the chip sounds (duty 0.5 is a square).
  function pulseWave(ctx, duty) {
    const n = 64, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    return ctx.createPeriodicWave(re, im);
  }

  const WORDS_A = ['Midnight', 'Neon', 'Chrome', 'Velvet', 'Magenta', 'Electric', 'Crystal', 'Ocean', 'Laser', 'Violet', 'Golden', 'Satin', 'Cobalt', 'Cherry', 'Silver', 'Tropic', 'Lunar', 'Infinite', 'Silent',
    'Pastel', 'Sockless', 'Mullet', 'Hairspray', 'Undercover', 'Shoulder Pad', 'Permed'];
  const WORDS_B = ['Causeway', 'Boulevard', 'Afterglow', 'Overdrive', 'Riviera', 'Mirage', 'Heatwave', 'Skyline', 'Horizon', 'Nightcall', 'Arcade', 'Coastline', 'Getaway', 'Afterhours', 'Parallel', 'Cruise', 'Satellite', 'Palms', 'Motel', 'Signal',
    'Stakeout', 'Sax Solo', 'Car Phone', 'Montage', 'Mixtape', 'Alibi', 'Tan Line'];

  // ---------------------------------------------------------------------------
  // Composition
  // ---------------------------------------------------------------------------
  // A two-bar melodic cell: a random walk over scale degrees on a rhythm,
  // with the odd octave jump.
  function cell(r, rhythm, start, leaps) {
    const notes = [];
    let deg = start;
    for (let i = 0; i < rhythm.length; i++) {
      const [st, len] = rhythm[i];
      if (i > 0) {
        if (leaps && r() < leaps) deg += deg > 3 ? -7 : 7;
        else {
          const up = st < 16 ? 0.62 : 0.38;
          const mag = r() < 0.65 ? 1 : r() < 0.7 ? 2 : 3;
          deg += r() < up ? mag : -mag;
        }
        deg = ND.clamp(deg, -2, 9);
      }
      notes.push({ st, len, deg, strong: st % 4 === 0 });
    }
    return notes;
  }

  // An eight-bar phrase of two-bar cells, A A' B A'': a statement, its answer,
  // a contrast (often the statement moved up the scale) and a return home.
  function phrase(r, rhythms, leaps = 0) {
    const A = cell(r, r.pick(rhythms), r.pick([0, 2, 4]), leaps);
    A[A.length - 1].deg = r.pick([2, 4, 7]);
    const A2 = A.map((n, i) => (i >= A.length - 3 ? { ...n, deg: n.deg + r.pick([-2, -1, 1, 2]) } : n));
    const B = r() < 0.45
      ? A.map((n) => ({ ...n, deg: Math.min(11, n.deg + r.pick([2, 3, 4])) }))
      : cell(r, r.pick(rhythms), r.pick([2, 4, 5]), leaps);
    const A3 = A.map((n, i) => (i === A.length - 1 ? { ...n, deg: r.pick([0, 7]) } : n));
    return [A, A2, B, A3];
  }

  function makeTrack(r, prev, index, force) {
    let tonic;
    do tonic = r.int(0, 11); while (prev && tonic === prev.tonic);
    // mostly a change of style from one track to the next
    let style = force || r.pick(STYLES);
    if (!force && prev && style === prev.style && r() < 0.7) style = r.pick(STYLES.filter((x) => x !== prev.style));
    const bpm = r.pick(BPMS[style]);
    const noir = style === 'noir';
    const progs = noir ? NOIR_PROGS : PROGS;
    const verse = r.pick(progs);
    let drop = r() < 0.55 ? verse : r.pick(progs);
    const chordBars = noir || r() < 0.45 ? 2 : 1; // noir chords take their time
    const buildBars = noir ? 4 : 8;
    const longBuild = noir ? (r() < 0.5 ? 8 : 4) : r() < 0.65 ? 16 : 8; // the second wait is usually longer
    // at noir's slow tempo, shorter sections keep a track near four minutes
    const sections = [
      { name: 'intro', bars: noir ? 8 : r() < 0.5 ? 16 : 8, energy: 0.25 },
      { name: 'verse', bars: 16, energy: 0.55 },
      { name: 'build', bars: buildBars, energy: 0.7 },
      { name: 'drop', bars: 16, energy: 1.0 },
      { name: 'break', bars: noir ? 8 : r() < 0.5 ? 16 : 8, energy: 0.3 },
      { name: 'build', bars: longBuild, energy: 0.75, second: true },
      { name: 'drop', bars: noir ? 16 : r() < 0.5 ? 24 : 16, energy: 1.0, final: true },
      { name: 'outro', bars: noir ? 8 : 16, energy: 0.4 },
    ];
    let bar = 0;
    for (const s of sections) { s.start = bar; bar += s.bars; }
    const hook = phrase(r, RHYTHMS[style], style === 'electro' ? 0.15 : style === 'amiga' ? 0.08 : 0);
    const verseMel = phrase(r, VERSE_RHYTHMS);
    const name = `${r.pick(WORDS_A)} ${r.pick(WORDS_B)}`;
    return {
      index, name, bpm, tonic, key: `${NOTE_NAMES[tonic]} minor`,
      style, styleName: style.toUpperCase(),
      verse, drop, chordBars, sections, totalBars: bar,
      hook, verseMel,
      arp: r.pick(ARPS),
      lift: r() < 0.6 ? 2 : r() < 0.5 ? 1 : 3,
      leadWave: style === 'amiga' ? r.pick(['pulse25', 'pulse25', 'pulse12', 'square']) : noir ? 'sawtooth' : r.pick(['sawtooth', 'sawtooth', 'square']),
      leadCenter: style === 'amiga' ? 74 : noir ? 67 : 70,
      bassOct: r.pick([true, true, false]),
      padBright: r.range(0.45, 0.8),
      swingHat: r() < 0.3,
      kickPat: KICKS[style] ? r.pick(KICKS[style]) : null,
      bassPat: BASSES[style] ? r.pick(BASSES[style]) : null,
      chipPat: r.pick(CHIP_CHORDS),
      bellPat: r.pick(BELLS),
      stabPat: r.pick(STABS),
      talkbox: r() < { miami: 0.5, amiga: 0.2, electro: 0.6, noir: 0 }[style],
    };
  }

  // Scale degree -> MIDI in a given octave register around `center`.
  function degMidi(tonic, deg, center) {
    const o = Math.floor(deg / 7);
    const i = ((deg % 7) + 7) % 7;
    let m = tonic + MINOR[i] + 12 * o;
    while (m < center - 6) m += 12;
    while (m > center + 6) m -= 12;
    return m;
  }

  // Scale degree -> MIDI without folding: degree 0 is the tonic nearest
  // `center`, so melodies keep their contour and octave jumps.
  function scaleMidi(tonic, deg, center) {
    let base = tonic;
    while (base < center - 6) base += 12;
    while (base > center + 5) base -= 12;
    const o = Math.floor(deg / 7);
    return base + MINOR[((deg % 7) + 7) % 7] + 12 * o;
  }

  function chordPcs(tonic, d, dom) {
    const deg = (k) => MINOR[((d + k) % 7 + 7) % 7] + 12 * Math.floor((d + k) / 7);
    const tones = [deg(0), deg(2), deg(4), deg(d === 0 || d === 3 ? 8 : 6)]; // m9 on i / iv, 7ths elsewhere
    if (dom && ((d % 7) + 7) % 7 === 4) tones[1] += 1; // major V
    return tones.map((t) => tonic + t);
  }

  function voice(pcs, prev, lo = 55) {
    // choose the inversion closest to the previous voicing
    const base = pcs.map((p) => { let m = p; while (m < lo) m += 12; while (m >= lo + 12) m -= 12; return m; }).sort((a, b) => a - b);
    const cands = [];
    for (let inv = 0; inv < base.length; inv++) {
      const v = base.map((m, i) => (i < inv ? m + 12 : m)).sort((a, b) => a - b);
      cands.push(v);
    }
    if (!prev) return cands[0];
    let best = cands[0], bd = Infinity;
    for (const v of cands) {
      const d = v.reduce((s, m, i) => s + Math.abs(m - (prev[i] || m)), 0);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  // ---------------------------------------------------------------------------
  // Engine
  // ---------------------------------------------------------------------------
  class Music {
    constructor(seed = 1985, opts = {}) {
      this.seed = seed;
      this.r = ND.rng(seed * 13 + 7);
      this.forceStyle = STYLES.includes(opts.style) ? opts.style : null;
      // the opening scene: hold an inviting loop (intro, then the verse over and
      // over) until launch() sends the track into its first drop
      this.lobby = !!opts.lobby;
      this.chatter = true; // the driver talks
      this.talkReq = [];
      this.recentTalk = [];
      this.tagSaid = {};
      this.ctx = null;
      this.enabled = false;
      this.trackIndex = 0;
      this.kicks = [];
      this.marks = [];
      this.listeners = [];
    }

    // ---- graph ----------------------------------------------------------------
    build(ctx, live = true) {
      this.ctx = ctx;
      const N = (this.n = {});
      N.master = ctx.createGain();
      N.master.gain.value = 0.78;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10; comp.knee.value = 10; comp.ratio.value = 2.4; comp.attack.value = 0.008; comp.release.value = 0.25;
      const lim = ctx.createDynamicsCompressor();
      lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;
      N.out = ctx.createGain();
      N.out.gain.value = 1;
      N.master.connect(comp).connect(lim).connect(N.out);
      N.out.connect(ctx.destination);
      if (live && ctx.createMediaStreamDestination) {
        N.rec = ctx.createMediaStreamDestination();
        N.out.connect(N.rec);
      }
      // music bus: sidechain duck -> sweepable low-pass
      N.duck = ctx.createGain();
      N.sweep = ctx.createBiquadFilter();
      N.sweep.type = 'lowpass'; N.sweep.frequency.value = 18000; N.sweep.Q.value = 0.9;
      N.music = ctx.createGain();
      N.music.gain.value = 0.9;
      // the bed: everything but the vocals, dipped while the driver talks
      N.bed = ctx.createGain();
      N.bed.connect(N.master);
      N.music.connect(N.duck).connect(N.sweep).connect(N.bed);
      N.lead = ctx.createGain();
      N.lead.gain.value = 0.9;
      N.lead.connect(N.sweep);
      N.drums = ctx.createGain();
      N.drums.gain.value = 0.95;
      N.drums.connect(N.bed);
      // warm saturation for the 808 kick
      N.sat = ctx.createWaveShaper();
      const sat = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) sat[i] = Math.tanh(((i / 1023) * 2 - 1) * 2.2) / Math.tanh(2.2);
      N.sat.curve = sat;
      const satOut = ctx.createGain(); satOut.gain.value = 0.62;
      N.sat.connect(satOut).connect(N.drums);
      // grit: the noir bass's overdrive, into the music bus so it pumps
      N.grit = ctx.createWaveShaper();
      const grit = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) grit[i] = Math.tanh(((i / 1023) * 2 - 1) * 3.2) / Math.tanh(3.2);
      N.grit.curve = grit;
      const gritOut = ctx.createGain(); gritOut.gain.value = 0.55;
      N.grit.connect(gritOut).connect(N.music);
      // reverbs
      N.verb = ctx.createConvolver();
      N.verb.buffer = this.impulse(ctx, 3.4, 2.2, false);
      N.verbIn = ctx.createGain();
      N.verbOut = ctx.createGain();
      N.verbOut.gain.value = 0.55;
      const verbHP = ctx.createBiquadFilter();
      verbHP.type = 'highpass'; verbHP.frequency.value = 260;
      N.verbIn.connect(verbHP).connect(N.verb).connect(N.verbOut).connect(N.sweep);
      N.gated = ctx.createConvolver();
      N.gated.buffer = this.impulse(ctx, 0.34, 0, true);
      N.gatedIn = ctx.createGain();
      const gOut = ctx.createGain();
      gOut.gain.value = 0.7;
      N.gatedIn.connect(N.gated).connect(gOut).connect(N.bed);
      // ping-pong delay (dotted eighth, set per track)
      N.delayIn = ctx.createGain();
      const dl = (N.dl = ctx.createDelay(2)), dr = (N.dr = ctx.createDelay(2));
      const fb = ctx.createGain(); fb.gain.value = 0.42;
      const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 3200;
      const merger = ctx.createChannelMerger(2);
      N.delayIn.connect(dl);
      dl.connect(dr);
      dr.connect(dlp).connect(fb).connect(dl);
      dl.connect(merger, 0, 0);
      dr.connect(merger, 0, 1);
      const dOut = ctx.createGain(); dOut.gain.value = 0.5;
      merger.connect(dOut).connect(N.sweep);
      // vocals: hooks bypass the sidechain and the sweep (they must be heard in
      // the silent beat before a drop); chops go through the music bus and pump
      N.vox = ctx.createGain();
      N.vox.gain.value = 0.9;
      const voxHP = ctx.createBiquadFilter();
      voxHP.type = 'highpass'; voxHP.frequency.value = 170;
      N.vox.connect(voxHP).connect(N.master);
      this.vox = { hooks: [], chops: [], robots: [], driver: [], ready: false };
      this.recentHooks = [];
      this.voxLoading = this.loadVocals(ctx);
      // noise buffers
      this.white = this.noise(ctx, 2, 'white');
      this.pink = this.noise(ctx, 4, 'pink');
      this.brown = this.noise(ctx, 6, 'brown');
      // chip waveforms, drum samples, and the vocoder's rectifier curve
      this.waves = { pulse25: pulseWave(ctx, 0.25), pulse12: pulseWave(ctx, 0.125) };
      this.smp = this.makeSamples(ctx);
      this.absCurve = new Float32Array(2049);
      for (let i = 0; i < 2049; i++) this.absCurve[i] = Math.abs(i / 1024 - 1);
      // ambience
      N.amb = ctx.createGain();
      N.amb.gain.value = 1;
      N.amb.connect(N.master);
      this.buildAmbience(ctx);
    }

    async loadVocals(ctx) {
      const pack = window.ND_VOCALS;
      if (!pack || !pack.clips || !pack.clips.length) return;
      for (const clip of pack.clips) {
        try {
          const bin = atob(clip.data);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const buf = await new Promise((res, rej) => {
            const p = ctx.decodeAudioData(bytes.buffer, res, rej);
            if (p && p.then) p.then(res, rej);
          });
          const d = buf.getChannelData(0), sr = buf.sampleRate;
          let peak = 0;
          for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
          let on = 0, off = d.length - 1;
          while (on < d.length && Math.abs(d[on]) < peak * 0.05) on++;
          while (off > on && Math.abs(d[off]) < peak * 0.03) off--;
          const item = {
            id: clip.id, text: clip.text, tags: clip.tags || [], voice: clip.voice, buf,
            onset: Math.max(0, on / sr - 0.012), dur: (off - on) / sr + 0.05,
            norm: Math.min(4, 0.7 / (peak || 1)),
          };
          if (clip.kind !== 'chop') item.syl = syllables(d, sr, on, off);
          if (clip.kind === 'chop') {
            item.midi = detectPitch(d, sr, on, off);
            if (item.midi == null) continue; // unpitched: not usable as a chop
            this.vox.chops.push(item);
          } else if (clip.kind === 'robot') this.vox.robots.push(item);
          else if (clip.kind === 'driver') {
            // loudness every 25 ms, for lip sync
            const hop = Math.round(sr / 40), env = [];
            for (let i = on; i < off; i += hop) {
              let e = 0;
              for (let j = i; j < Math.min(off, i + hop); j++) e += d[j] * d[j];
              env.push(Math.sqrt(e / hop));
            }
            const mx = Math.max(...env) || 1;
            item.env = env.map((v) => v / mx);
            this.vox.driver.push(item);
          } else this.vox.hooks.push(item);
        } catch (e) {
          console.warn('Nightdrive: vocal clip failed to load', clip.id, e);
        }
      }
      this.vox.ready = this.vox.hooks.length + this.vox.chops.length + this.vox.robots.length + this.vox.driver.length > 0;
    }

    impulse(ctx, secs, decay, gated) {
      const sr = ctx.sampleRate, len = Math.floor(sr * secs);
      const buf = ctx.createBuffer(2, len, sr);
      const r = ND.rng(99);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        let lp = 0;
        for (let i = 0; i < len; i++) {
          const t = i / len;
          const env = gated ? (t < 0.8 ? 0.9 - t * 0.3 : Math.max(0, (1 - t) * 3.5)) : Math.pow(1 - t, decay);
          lp += ((r() * 2 - 1) - lp) * (gated ? 0.6 : 0.35 + 0.5 * (1 - t));
          d[i] = lp * env * (i < sr * 0.004 && !gated ? i / (sr * 0.004) : 1);
        }
      }
      return buf;
    }

    noise(ctx, secs, kind) {
      const sr = ctx.sampleRate, len = Math.floor(sr * secs);
      const buf = ctx.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      const r = ND.rng(kind.length * 31);
      let b0 = 0, b1 = 0, b2 = 0, br = 0;
      for (let i = 0; i < len; i++) {
        const w = r() * 2 - 1;
        if (kind === 'white') d[i] = w;
        else if (kind === 'pink') {
          b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527;
          d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
        } else {
          br = (br + 0.02 * w) / 1.02;
          d[i] = br * 3.5;
        }
      }
      return buf;
    }

    // A one-shot sample computed from fn(t). With `rate`, each value is held
    // for a period of that sample rate and quantised to `bits`, the way an
    // 8-bit Amiga sample aliases and crunches.
    sample(ctx, secs, fn, rate, bits) {
      const sr = ctx.sampleRate, len = Math.floor(sr * secs);
      const buf = ctx.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      const q = bits ? Math.pow(2, bits - 1) : 0;
      let held = 0, last = -1;
      for (let i = 0; i < len; i++) {
        const j = rate ? Math.floor((i * rate) / sr) : i;
        if (j !== last) {
          last = j;
          held = fn(j / (rate || sr));
          if (q) held = Math.round(held * q) / q;
        }
        d[i] = held;
      }
      return buf;
    }

    makeSamples(ctx) {
      const r = ND.rng(1987);
      const PAULA = 16574; // an Amiga playing C-3
      const sq = (f, t) => (Math.sin(2 * Math.PI * f * t) > 0 ? 1 : -1);
      // tracker kit
      let ph = 0;
      const kick = this.sample(ctx, 0.3, (t) => {
        ph += (2 * Math.PI * (52 + 150 * Math.exp(-t / 0.028))) / PAULA;
        return Math.sin(ph) * Math.exp(-t / 0.1) * 0.95;
      }, PAULA, 6);
      const snare = this.sample(ctx, 0.22, (t) => ND.clamp((r() * 2 - 1) * 0.75 * Math.exp(-t / 0.055) + Math.sin(2 * Math.PI * 190 * t) * 0.5 * Math.exp(-t / 0.035), -1, 1), PAULA, 6);
      let prev = 0;
      const tick = (dec) => (t) => { const n = r() * 2 - 1, h = n - prev; prev = n; return h * 0.45 * Math.exp(-t / dec); };
      const hat = this.sample(ctx, 0.07, tick(0.016), 28000, 6);
      const open = this.sample(ctx, 0.3, tick(0.075), 28000, 6);
      // 808-style metal: six square oscillators, high-passed twice
      const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800];
      const metal = (dec, secs) => {
        let x1 = 0, y1 = 0, w1 = 0, z1 = 0;
        return this.sample(ctx, secs, (t) => {
          let x = 0;
          for (const f of METAL) x += sq(f, t);
          x /= 6;
          const y = 0.54 * (y1 + x - x1); x1 = x; y1 = y;
          const z = 0.54 * (z1 + y - w1); w1 = y; z1 = z;
          return z * Math.exp(-t / dec) * 1.6;
        });
      };
      // 808 cowbell: two squares with a two-stage decay
      let cx = 0, cy = 0, cl = 0;
      const cowbell = this.sample(ctx, 0.35, (t) => {
        const x = (sq(540, t) + sq(800, t)) * 0.5;
        const y = 0.93 * (cy + x - cx); cx = x; cy = y;
        cl += (y - cl) * 0.45;
        return cl * (0.55 * Math.exp(-t / 0.012) + 0.45 * Math.exp(-t / 0.09)) * 0.8;
      });
      return { kick, snare, hat, open, hat808: metal(0.018, 0.08), open808: metal(0.11, 0.4), cowbell };
    }

    buildAmbience(ctx) {
      const N = this.n;
      // rain
      const rain = ctx.createBufferSource();
      rain.buffer = this.pink; rain.loop = true;
      N.rainLP = ctx.createBiquadFilter(); N.rainLP.type = 'lowpass'; N.rainLP.frequency.value = 2400;
      const rainHP = ctx.createBiquadFilter(); rainHP.type = 'highpass'; rainHP.frequency.value = 350;
      N.rainG = ctx.createGain(); N.rainG.gain.value = 0;
      rain.connect(rainHP).connect(N.rainLP).connect(N.rainG).connect(N.amb);
      rain.start();
      // tyres hissing on the wet road
      const hiss = ctx.createBufferSource();
      hiss.buffer = this.white; hiss.loop = true;
      const hissBP = ctx.createBiquadFilter(); hissBP.type = 'bandpass'; hissBP.frequency.value = 3800; hissBP.Q.value = 0.6;
      N.hissG = ctx.createGain(); N.hissG.gain.value = 0;
      hiss.connect(hissBP).connect(N.hissG).connect(N.amb);
      hiss.start();
      // the flat-12 idling under it all
      const e1 = ctx.createOscillator(), e2 = ctx.createOscillator();
      e1.type = 'sawtooth'; e1.frequency.value = 41;
      e2.type = 'sawtooth'; e2.frequency.value = 82.6;
      N.engine = [e1, e2];
      const eLP = ctx.createBiquadFilter(); eLP.type = 'lowpass'; eLP.frequency.value = 150; eLP.Q.value = 2;
      const eG = (N.engineG = ctx.createGain()); eG.gain.value = 0.035;
      const wob = ctx.createOscillator(); wob.frequency.value = 0.23;
      const wobG = ctx.createGain(); wobG.gain.value = 1.4;
      wob.connect(wobG).connect(e1.frequency);
      e1.connect(eLP); e2.connect(eLP); eLP.connect(eG).connect(N.amb);
      e1.start(); e2.start(); wob.start();
    }

    // ---- life cycle ---------------------------------------------------------------
    start() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        this.enabled = true;
        this.n.out.gain.setTargetAtTime(1, this.ctx.currentTime, 0.2);
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC({ latencyHint: 'playback' });
      this.build(ctx, true);
      this.enabled = true;
      this.newTrack();
      this.nextTime = ctx.currentTime + 0.15;
      this.startTicker();
      ND.bus.on('lightning', (e) => { this.thunder(e); this.request('lightning', 6); });
      ND.bus.on('weather', (e) => {
        const tag = { drizzle: 'rain', rain: 'rain', storm: 'storm', clear: 'clear', mist: 'mist' }[e.phase];
        if (tag) this.request(tag);
      });
      ND.bus.on('heli', () => this.request('heli', 20));
      ND.bus.on('blimp', () => this.request('blimp', 30));
      ND.bus.on('arm-out', () => this.request('smoke'));
      ND.bus.on('window-up', () => this.request('window'));
      ND.bus.on('pods', (e) => { if (this.enabled) this.sfxPopup(this.ctx.currentTime + 0.02, e.up); });
      ND.bus.on('speed', (e) => this.request(e.zone, 8));
      this.emit('start');
    }
    toggle() {
      if (!this.ctx || !this.enabled) { this.start(); return true; }
      this.enabled = false;
      this.n.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
      return false;
    }
    startTicker() {
      const tick = () => this.pump();
      try {
        // worker timers keep ticking in background tabs
        const src = 'let id=setInterval(()=>postMessage(0),25);';
        this.worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
        this.worker.onmessage = tick;
      } catch (e) {
        setInterval(tick, 25);
      }
    }
    pump() {
      const ctx = this.ctx;
      if (!ctx) return;
      const ahead = document.hidden ? 1.5 : 0.35;
      this.scheduleUntil(ctx.currentTime + ahead);
      this.updateAmbience();
    }
    newTrack() {
      const prev = this.track;
      this.track = makeTrack(this.r, prev, this.trackIndex++, this.forceStyle);
      if (this.lobby) {
        // eight bars of intro, then the verse loops while we wait
        const S = this.track.sections;
        S[0].bars = 8;
        let b = 0;
        for (const sec of S) { sec.start = b; b += sec.bars; }
        this.track.totalBars = b;
      }
      this.bar = 0;
      this.stepIdx = 0;
      this.prevVoicing = null;
      this.prevLead = null;
      const T = this.track;
      this.stepDur = 60 / T.bpm / 4;
      if (this.n.dl) {
        const t = this.ctx.currentTime;
        this.n.dl.delayTime.setValueAtTime(this.stepDur * 3, Math.max(t, this.nextTime || t));
        this.n.dr.delayTime.setValueAtTime(this.stepDur * 3, Math.max(t, this.nextTime || t));
      }
      if (!this.lobby) this.mark({ t: this.nextTime || 0, type: 'track', track: T });
      this.emit('track', T);
      this.vplan = this.planVocals(T);
    }

    // Where the vocals go in this track (clips are picked when they play).
    planVocals(T) {
      const r = this.r, plan = { hooks: [], chop: null };
      const find = (name, pred = () => true) => T.sections.find((s) => s.name === name && pred(s));
      const intro = find('intro'), brk = find('break'), build2 = find('build', (s) => s.second);
      const build1 = find('build', (s) => !s.second), fin = find('drop', (s) => s.final), outro = find('outro');
      if (r() < 0.75) plan.hooks.push({ bar: intro.start + Math.floor(intro.bars * 0.4), k: 0, tag: 'intro' });
      if (r() < 0.9) plan.hooks.push({ bar: brk.start + 1, k: 8, tag: 'break' });
      if (r() < 0.8) plan.hooks.push({ bar: build2.start + Math.floor(build2.bars / 2), k: 0, tag: 'build', robo: r() < 0.4 });
      if (r() < 0.5) plan.hooks.push({ bar: outro.start + 6, k: 0, tag: 'outro' });
      plan.chop = { pick: r(), rhythm: r.pick(CHOP_RHYTHMS), notes: r.pick(CHOP_NOTES), octave: r() < 0.5 ? 12 : 0 };
      // robot vocoder: a chorus of two lines opening each drop (four in the
      // final one), a line in the breakdown, and one in electro verses
      const R = { pick: [r(), r()], mel: [r.pick(VOC_MELODIES), r.pick(VOC_MELODIES)], events: [], dropIn: [] };
      for (const d of T.sections) {
        if (d.name !== 'drop') continue;
        R.events.push({ bar: d.start + 1, slot: 0 }, { bar: d.start + 5, slot: 1 });
        if (d.final) R.events.push({ bar: d.start + 9, slot: 0 }, { bar: d.start + 13, slot: 1 });
      }
      R.events.push({ bar: brk.start + 4, slot: 0, soft: true });
      if (T.style === 'electro') R.events.push({ bar: find('verse').start + 12, slot: 1, soft: true });
      plan.robot = R;
      // noir has its own voices: a deep robot telling the verse, and a soft
      // female voice in the choruses, the robot answering her
      plan.noir = { robo: [], her: [], pick: [r(), r()], mel: [r.pick(VOC_MELODIES), r.pick(VOC_MELODIES)] };
      if (T.style === 'noir') {
        R.events.length = 0;
        const v = find('verse');
        for (let b = 2; b < v.bars; b += 4) plan.noir.robo.push({ bar: v.start + b, slot: (b >> 2) % 2 });
        for (const d of T.sections) {
          if (d.name !== 'drop') continue;
          for (let b = 0; b < d.bars; b += 4) plan.noir.her.push({ bar: d.start + b });
          plan.noir.robo.push({ bar: d.start + 2, slot: 0 }, { bar: d.start + 10, slot: 1 });
        }
        plan.noir.her.push({ bar: brk.start + 2 });
        plan.noir.robo.push({ bar: brk.start + 6, slot: 1 });
      }
      // the driver's moments in the song
      plan.talk = [];
      if (r() < 0.55) plan.talk.push({ bar: intro.start + 2, k: 0, tag: 'track' });
      if (r() < 0.4) plan.talk.push({ bar: build1.start + 3, k: 0, tag: 'build' });
      if (r() < 0.45) plan.talk.push({ bar: find('drop').start + 2, k: 8, tag: 'drop' });
      if (r() < 0.5) plan.talk.push({ bar: brk.start + (brk.bars >= 16 ? 10 : 6), k: 0, tag: 'smooth' });
      // the bar before each drop belongs to one voice, timed to end as the
      // drop lands: a whispered hook, the driver, or the robot
      for (const [bar, odds] of [[fin.start - 1, [0.35, 0.65, 0.9]], [build1.start + build1.bars - 1, [0.2, 0.55, 0.8]]]) {
        const x = r();
        if (x < odds[0]) plan.hooks.push({ bar, k: 0, tag: 'drop-in', align: true, robo: r() < 0.35 });
        else if (x < odds[1]) plan.talk.push({ bar, k: 0, tag: 'drop-in', align: true });
        else if (x < odds[2]) R.dropIn.push({ bar, mel: r.pick(VOC_MELODIES) });
      }
      return plan;
    }

    // ---- the driver --------------------------------------------------------------------
    // Something happened in the world he might talk about (for a while).
    request(tag, ttl = 12) {
      if (!this.ctx) return;
      const cool = TALK_COOLDOWN[tag];
      if (cool && this.ctx.currentTime - (this.tagSaid[tag] ?? -1e9) < cool) return;
      if (this.talkReq.some((q) => q.tag === tag)) return;
      this.talkReq.push({ tag, until: this.ctx.currentTime + ttl });
    }

    pickTalk(tag) {
      const pool = this.vox.driver.filter((h) => h.tags.includes(tag));
      if (!pool.length) return null;
      const fresh = pool.filter((h) => !this.recentTalk.includes(h.id));
      return this.r.pick(fresh.length ? fresh : pool);
    }

    // Is nothing else sung from now through the next `n` bars?
    clearAhead(t, n) {
      if ((this.busyUntil || 0) > t) return false;
      const P = this.vplan, hit = (e) => e.bar >= this.bar && e.bar <= this.bar + n;
      return !P.hooks.some(hit) && !P.talk.some(hit) && !P.robot.events.some(hit) && !P.robot.dropIn.some(hit) && !P.noir.robo.some(hit) && !P.noir.her.some(hit);
    }

    driverTalk(t, s, sb, k) {
      if (this.lobby) {
        if (k % 4 || t < (this.talkEnd || 0) + 1.5 || !this.clearAhead(t, 1)) return;
        this.talkReq = this.talkReq.filter((q) => q.until > t && t - (this.tagSaid[q.tag] ?? -1e9) >= (TALK_COOLDOWN[q.tag] || 0));
        let tag = null;
        if (!this.helloSaid) {
          // say hello as soon as his voice has loaded (or give up after a few seconds)
          if (this.helloBy == null) this.helloBy = t + 6;
          if (this.pickTalk('hello')) { tag = 'hello'; this.helloSaid = true; }
          else if (t > this.helloBy) this.helloSaid = true;
          else return;
        } else if (this.talkReq.length) tag = this.talkReq.pop().tag;
        else if (t >= (this.nextLobby || 0)) tag = 'lobby';
        if (!tag) return;
        const clip = this.pickTalk(tag);
        if (!clip) return;
        this.say(t + (tag === 'hello' ? 0.6 : 0), clip, true); // in the lobby he talks to us
        this.tagSaid[tag] = t;
        this.nextLobby = t + clip.dur + 8 + this.r() * 8;
        return;
      }
      for (const ev of this.vplan.talk) {
        if (ev.bar !== this.bar || ev.k !== k) continue;
        const clip = this.pickTalk(ev.tag);
        if (!clip) continue;
        const at = ev.align ? Math.max(t, t + this.stepDur * 16 - clip.dur - 0.02) : t;
        this.say(at, clip, ev.tag === 'camera', ev.align);
        return;
      }
      if (k % 8 || t < (this.talkEnd || 0) + 12) return;
      if (s.name === 'build' && sb >= s.bars - 2) return;
      if (!this.clearAhead(t, 2)) return;
      // reactions first (freshest), otherwise the odd musing
      this.talkReq = this.talkReq.filter((q) => q.until > t && t - (this.tagSaid[q.tag] ?? -1e9) >= (TALK_COOLDOWN[q.tag] || 0));
      if (this.nextIdle == null) this.nextIdle = t + 25;
      let tag = null;
      if (this.talkReq.length) tag = this.talkReq.pop().tag;
      else if (t >= this.nextIdle) tag = this.r.pick(s.name === 'break' || s.name === 'intro' ? ['smooth', 'idle', 'camera'] : ['idle', 'idle', 'camera', 'smooth']);
      if (!tag) return;
      const clip = this.pickTalk(tag);
      if (!clip) return;
      this.say(t, clip, tag === 'camera' || (tag === 'idle' && this.r() < 0.25));
      this.tagSaid[tag] = t;
      this.nextIdle = t + clip.dur + 35 + this.r() * 50;
    }

    // He talks over the music like a radio DJ: the bed dips under his voice.
    say(t, clip, cam, toDrop) {
      const c = this.ctx, N = this.n;
      const src = c.createBufferSource(); src.buffer = clip.buf;
      const eq = c.createBiquadFilter(); eq.type = 'peaking'; eq.frequency.value = 2800; eq.gain.value = 2.5; eq.Q.value = 0.8;
      const g = c.createGain(); g.gain.value = clip.norm * 0.95;
      src.connect(eq).connect(g).connect(N.vox);
      const rs = c.createGain(); rs.gain.value = 0.12; g.connect(rs).connect(N.verbIn);
      src.start(t, clip.onset); src.stop(t + clip.dur + 0.2);
      N.bed.gain.setTargetAtTime(0.6, Math.max(c.currentTime, t - 0.08), 0.06);
      N.bed.gain.setTargetAtTime(1, t + clip.dur, toDrop ? 0.02 : 0.3);
      this.talkEnd = t + clip.dur;
      this.busyUntil = Math.max(this.busyUntil || 0, this.talkEnd);
      this.recentTalk.push(clip.id);
      if (this.recentTalk.length > 14) this.recentTalk.shift();
      this.mark({ t, type: 'talk', clip, cam });
    }

    // Marks are consumed in time order, and some are scheduled ahead of others.
    mark(m) {
      let i = this.marks.length;
      while (i > 0 && this.marks[i - 1].t > m.t) i--;
      this.marks.splice(i, 0, m);
    }

    // The noir robot's two lines for this track.
    noirLine(slot) {
      const P = this.vplan.noir, list = this.vox.robots.filter((x) => x.tags.includes('noir'));
      if (!list.length) return null;
      if (!P.clips) {
        const a = Math.floor(P.pick[0] * list.length);
        let b = Math.floor(P.pick[1] * list.length);
        if (b === a) b = (b + 1) % list.length;
        P.clips = [list[a], list[b]];
      }
      return P.clips[slot];
    }

    // The two chorus lines for this track, fixed the first time they're sung.
    robotLine(slot) {
      const R = this.vplan.robot, list = this.vox.robots.filter((x) => !x.tags.includes('drop-in') && !x.tags.includes('noir'));
      if (!R.clips) {
        const a = Math.floor(R.pick[0] * list.length);
        let b = Math.floor(R.pick[1] * list.length);
        if (b === a) b = (b + 1) % list.length;
        R.clips = [list[a], list[b]];
      }
      return R.clips[slot];
    }

    pickHook(tag) {
      const pool = this.vox.hooks.filter((h) => h.tags.includes(tag));
      if (!pool.length) return null;
      const fresh = pool.filter((h) => !this.recentHooks.includes(h.id));
      const h = this.r.pick(fresh.length ? fresh : pool);
      this.recentHooks.push(h.id);
      if (this.recentHooks.length > 6) this.recentHooks.shift();
      return h;
    }
    skip() {
      if (!this.ctx) return;
      // fade what is ringing, then start fresh on the next step
      this.n.sweep.frequency.setTargetAtTime(300, this.ctx.currentTime, 0.1);
      this.newTrack();
      this.nextTime = this.ctx.currentTime + 0.4;
    }
    on(fn) { this.listeners.push(fn); }
    emit(type, data) { for (const f of this.listeners) f(type, data); }

    // ---- sequencer ----------------------------------------------------------------
    section() {
      const T = this.track;
      for (const s of T.sections) if (this.bar < s.start + s.bars) return s;
      return T.sections[T.sections.length - 1];
    }

    scheduleUntil(tEnd) {
      while (this.nextTime < tEnd) {
        if (this.jump && this.nextTime >= this.jump.at - 1e-4) this.doJump(this.nextTime);
        this.step(this.nextTime);
        this.nextTime += this.stepDur;
        if (++this.stepIdx >= 16) {
          this.stepIdx = 0;
          this.bar++;
          if (this.lobby) {
            const v = this.track.sections.find((sec) => sec.name === 'verse');
            if (this.bar >= v.start + v.bars) this.bar = v.start;
          }
          if (this.bar >= this.track.totalBars) {
            this.newTrack();
          }
        }
      }
    }

    // START in the opening scene: on the next beat, jump into the first build
    // (its snare roll, the silent beat) so the drop lands as the car pulls
    // away, no earlier than minAt. Returns the drop's audio time.
    launch(minAt) {
      if (!this.ctx || !this.track) return null;
      const T = this.track;
      const b1 = T.sections.find((sec) => sec.name === 'build' && !sec.second);
      const steps = (4 - (this.stepIdx % 4)) % 4;
      const at = Math.max(this.nextTime + steps * this.stepDur, this.ctx.currentTime + 0.05);
      // as many bars of the build as it takes for the drop to land after minAt
      const bar = 16 * this.stepDur;
      const n = ND.clamp(Math.ceil((minAt - at) / bar - 1e-6), 2, b1.bars);
      this.jump = { bar: b1.start + b1.bars - n, at, n };
      this.lobby = false;
      const dropAt = at + n * bar;
      // the bar before the drop is the driver's
      const slot = b1.start + b1.bars - 1, P = this.vplan;
      if (P) {
        P.talk = P.talk.filter((e) => e.bar !== slot);
        P.hooks = P.hooks.filter((e) => e.bar !== slot);
        if (P.robot) P.robot.dropIn = P.robot.dropIn.filter((e) => e.bar !== slot);
      }
      this.titleAtDrop = true; // "Now playing" as we roll
      this.launchDrop = dropAt;
      return dropAt;
    }
    doJump(t) {
      const N = this.n, dur = this.stepDur * 16 * this.jump.n;
      this.bar = this.jump.bar;
      this.stepIdx = 0;
      this.jump = null;
      // what the build's first bar would have set up, over the bars that are left
      N.sweep.frequency.cancelScheduledValues(t);
      N.sweep.frequency.setValueAtTime(1600, t);
      N.sweep.frequency.exponentialRampToValueAtTime(16000, t + dur);
      N.music.gain.cancelScheduledValues(t);
      N.music.gain.setValueAtTime(0.75, t);
      N.music.gain.linearRampToValueAtTime(0.95, t + dur - this.stepDur * 4);
      this.riser(t, dur);
      this.mark({ t, type: 'section', name: 'build', final: false, energy: 0.75 });
    }
    // His line to the camera, timed to end as the drop lands.
    goLine(dropAt, earliest) {
      if (!this.ctx || !this.vox || !this.vox.driver.length) return false;
      // a line that fits between his cigarette and the drop
      const pool = this.vox.driver.filter((h) => h.tags.includes('go'));
      if (!pool.length) return false;
      const fit = pool.filter((h) => dropAt - h.dur - 0.06 >= earliest);
      const clip = fit.length ? this.r.pick(fit) : pool.reduce((a, b) => (b.dur < a.dur ? b : a));
      if (dropAt - clip.dur - 0.06 < this.ctx.currentTime - 0.3) return true; // too late now: let the drop speak
      const at = Math.max(this.ctx.currentTime + 0.02, dropAt - clip.dur - 0.06);
      this.say(at, clip, true, true);
      return true;
    }

    // ---- the car: door, starter, engine ---------------------------------------------
    sfxDoor(t, close) {
      const c = this.ctx, N = this.n;
      const src = c.createBufferSource(); src.buffer = this.white;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = close ? 900 : 2400; bp.Q.value = 1.2;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(close ? 0.5 : 0.25, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (close ? 0.12 : 0.06));
      src.connect(bp).connect(g).connect(N.master);
      src.start(t, Math.random()); src.stop(t + 0.2);
      if (close) {
        const o = c.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
        const og = c.createGain();
        og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.7, t + 0.006); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        o.connect(og).connect(N.master); o.start(t); o.stop(t + 0.25);
      }
    }
    // The pop-up headlights: a little electric motor, and a soft thunk as they seat.
    sfxPopup(t, up) {
      const c = this.ctx, N = this.n, dur = 0.7;
      const o = c.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(up ? 150 : 175, t);
      o.frequency.linearRampToValueAtTime(up ? 185 : 140, t + dur);
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 1.4;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.06);
      g.gain.setValueAtTime(0.05, t + dur - 0.1);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(bp).connect(g).connect(N.master);
      o.start(t); o.stop(t + dur + 0.05);
      const k = c.createOscillator(); k.type = 'sine';
      k.frequency.setValueAtTime(140, t + dur - 0.04); k.frequency.exponentialRampToValueAtTime(70, t + dur + 0.08);
      const kg = c.createGain();
      kg.gain.setValueAtTime(0.0001, t + dur - 0.04);
      kg.gain.exponentialRampToValueAtTime(0.18, t + dur - 0.035);
      kg.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1);
      k.connect(kg).connect(N.master); k.start(t + dur - 0.05); k.stop(t + dur + 0.15);
    }
    // Flat-12: the starter turns, it catches with a blip, then idles until we go.
    engineStart(t) {
      const c = this.ctx, N = this.n;
      const out = c.createGain(); out.gain.value = 0;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 2;
      const sh = c.createWaveShaper(); sh.curve = this.n.grit.curve;
      const a = c.createOscillator(), b = c.createOscillator();
      a.type = 'sawtooth'; b.type = 'square';
      const f = [a.frequency, b.frequency];
      a.connect(sh); b.connect(sh);
      sh.connect(lp).connect(out).connect(N.master);
      // starter: four uneven turns
      for (let i = 0; i < 4; i++) {
        const ti = t + i * 0.11;
        out.gain.setValueAtTime(0.0001, ti);
        out.gain.exponentialRampToValueAtTime(0.16, ti + 0.02);
        out.gain.exponentialRampToValueAtTime(0.03, ti + 0.09);
      }
      f.forEach((p, k) => { p.setValueAtTime(26 * (k ? 0.5 : 1), t); });
      // it catches: a blip of revs, then a lumpy idle
      const tc = t + 0.46;
      out.gain.setValueAtTime(0.05, tc);
      out.gain.exponentialRampToValueAtTime(0.3, tc + 0.08);
      out.gain.exponentialRampToValueAtTime(0.14, tc + 0.6);
      f.forEach((p, k) => {
        const m = k ? 0.5 : 1;
        p.setValueAtTime(40 * m, tc);
        p.exponentialRampToValueAtTime(115 * m, tc + 0.14);
        p.exponentialRampToValueAtTime(46 * m, tc + 0.6);
      });
      lp.frequency.setValueAtTime(520, tc);
      lp.frequency.exponentialRampToValueAtTime(1500, tc + 0.14);
      lp.frequency.exponentialRampToValueAtTime(420, tc + 0.6);
      a.start(t); b.start(t);
      this.eng = { out, f, lp, a, b };
    }
    // ... and on the drop she goes
    engineGo(t) {
      const E = this.eng;
      if (!E) return;
      this.eng = null;
      E.f.forEach((p, k) => {
        const m = k ? 0.5 : 1;
        p.cancelScheduledValues(t); p.setValueAtTime(48 * m, t);
        p.exponentialRampToValueAtTime(190 * m, t + 0.7);
        p.exponentialRampToValueAtTime(120 * m, t + 1.6);
      });
      E.lp.frequency.cancelScheduledValues(t); E.lp.frequency.setValueAtTime(600, t);
      E.lp.frequency.exponentialRampToValueAtTime(2600, t + 0.6);
      E.out.gain.cancelScheduledValues(t); E.out.gain.setValueAtTime(0.16, t);
      E.out.gain.exponentialRampToValueAtTime(0.34, t + 0.35);
      E.out.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
      E.a.stop(t + 2.7); E.b.stop(t + 2.7);
    }

    chordAt(bar, prog) {
      const T = this.track;
      const idx = Math.floor(bar / T.chordBars) % 4;
      return { deg: prog.d[idx], dom: prog.dom, idx };
    }

    step(t) {
      const T = this.track, s = this.section(), k = this.stepIdx;
      const sb = this.bar - s.start; // bar within section
      const lastBar = sb === s.bars - 1;
      const prog = s.name === 'drop' || (s.name === 'build' && s.second) ? T.drop : T.verse;
      const ch = this.chordAt(this.bar, prog);
      const lift = s.final ? T.lift : 0;
      const tonic = T.tonic + lift;
      const pcs = chordPcs(tonic, ch.deg, ch.dom);
      const beat = k % 4 === 0;
      const secT = (sb * 16 + k) / (s.bars * 16);
      const N = this.n;

      // section starts: filter moves, marks for the visuals
      if (k === 0 && sb === 0) {
        this.mark({ t, type: 'section', name: s.name, final: !!s.final, energy: s.energy });
        if (s.name === 'drop') {
          this.impact(t, s.final ? 1.2 : 1);
          this.crash(t, 1);
          if (T.style === 'amiga' || T.style === 'electro') this.orch(t, voice(pcs.slice(0, 3), null, 55), s.final ? 1.1 : 0.95);
          N.sweep.frequency.cancelScheduledValues(t);
          N.sweep.frequency.setValueAtTime(18000, t);
          this.mark({ t, type: 'drop', final: !!s.final });
          if (this.titleAtDrop) { this.titleAtDrop = false; this.mark({ t, type: 'track', track: T }); }
        }
        if (s.name === 'break') {
          N.sweep.frequency.cancelScheduledValues(t);
          N.sweep.frequency.setValueAtTime(3000, t);
          N.sweep.frequency.exponentialRampToValueAtTime(900, t + this.stepDur * 16 * 2);
          this.downlifter(t + this.stepDur * 2, this.stepDur * 32);
        }
        if (s.name === 'intro') {
          N.sweep.frequency.cancelScheduledValues(t);
          N.sweep.frequency.setValueAtTime(420, t);
          N.sweep.frequency.exponentialRampToValueAtTime(5000, t + this.stepDur * 16 * s.bars);
        }
        if (s.name === 'build') {
          N.sweep.frequency.cancelScheduledValues(t);
          N.sweep.frequency.setValueAtTime(s.second ? 700 : 1400, t);
          N.sweep.frequency.exponentialRampToValueAtTime(16000, t + this.stepDur * 16 * s.bars);
          this.riser(t, this.stepDur * 16 * s.bars);
        }
        if (s.name === 'verse' || s.name === 'outro') {
          N.sweep.frequency.cancelScheduledValues(t);
          N.sweep.frequency.setValueAtTime(s.name === 'verse' ? 7000 : 12000, t);
          if (s.name === 'outro') N.sweep.frequency.exponentialRampToValueAtTime(500, t + this.stepDur * 16 * s.bars);
        }
      }

      // section loudness: quiet intros and breakdowns make the drops land
      if (k === 0 && sb === 0) {
        const G = N.music.gain;
        const L = { intro: 0.6, verse: 0.72, build: 0.72, drop: 1, break: 0.66, outro: 0.8 }[s.name];
        G.cancelScheduledValues(t);
        G.setValueAtTime(L, t);
        if (s.name === 'build') G.linearRampToValueAtTime(0.95, t + this.stepDur * 16 * s.bars - this.stepDur * 4);
        if (s.name === 'outro') G.linearRampToValueAtTime(0.25, t + this.stepDur * 16 * s.bars);
      }
      // --- vocal hooks
      if (this.vox && this.vox.ready && this.vplan) {
        for (const ev of this.vplan.hooks) {
          if (ev.bar !== this.bar || ev.k !== k) continue;
          const h = this.pickHook(ev.tag);
          if (!h) continue;
          // drop-in lines end exactly where the drop lands, after the silent beat
          const at = ev.align ? Math.max(t, t + this.stepDur * 16 - h.dur - 0.02) : t;
          if (ev.robo) this.vocode(at, h, this.r.pick(VOC_MELODIES), voice(pcs, null, 62), 0.85);
          else this.hook(at, h, ev.tag);
        }
      }
      // --- robot vocoder lines: sung on the chord, so always in tune
      const RB = this.vplan && this.vplan.robot;
      if (RB && k === 0 && !this.lobby && this.vox && this.vox.robots.length) {
        for (const ev of RB.events) {
          if (ev.bar !== this.bar) continue;
          const clip = this.robotLine(ev.slot);
          this.vocode(t, clip, RB.mel[ev.slot], voice(pcs, null, clip.voice === 'her' ? 62 : 52), ev.soft ? 0.75 : 1);
        }
        for (const ev of RB.dropIn) {
          if (ev.bar !== this.bar) continue;
          const pool = this.vox.robots.filter((x) => x.tags.includes('drop-in'));
          if (!pool.length) continue;
          const clip = this.r.pick(pool);
          this.vocode(Math.max(t, t + this.stepDur * 16 - clip.dur - 0.02), clip, ev.mel, voice(pcs, null, 52), 1);
        }
      }
      // --- noir: the deep robot and the woman who answers him
      if (T.style === 'noir' && k === 0 && !this.lobby && this.vox && this.vox.ready && this.vplan) {
        const NP = this.vplan.noir;
        for (const ev of NP.robo) {
          if (ev.bar !== this.bar) continue;
          const clip = this.noirLine(ev.slot);
          if (clip) this.vocode(t, clip, NP.mel[ev.slot], voice(pcs, null, 40), 1.05, 0.55);
        }
        for (const ev of NP.her) {
          if (ev.bar !== this.bar) continue;
          const h = this.pickHook('noir');
          if (h) this.hook(t + this.stepDur * 2, h, 'noir');
        }
      }
      // --- the driver
      if (this.chatter && this.vox && this.vox.driver.length && this.vplan) this.driverTalk(t, s, sb, k);
      // --- the wait: one beat of silence before every drop
      const gap = T.style !== 'noir' && s.name === 'build' && lastBar && k >= 12;
      if (gap) {
        if (k === 12) {
          N.music.gain.cancelScheduledValues(t);
          N.music.gain.setValueAtTime(0.0001, t);
          N.lead.gain.setValueAtTime(0.0001, t);
          N.lead.gain.setValueAtTime(0.9, t + this.stepDur * 4);
        }
        return;
      }

      // ------------------------------------------------ drums
      if (T.style === 'noir') this.drumsNoir(t, s, sb, k, lastBar, secT);
      else if (T.style === 'amiga') this.drumsAmiga(t, s, sb, k, lastBar, secT);
      else if (T.style === 'electro') this.drumsElectro(t, s, sb, k, lastBar, secT);
      else this.drumsMiami(t, s, sb, k, lastBar, secT);

      // ------------------------------------------------ bass
      const bassOn = s.name === 'verse' || s.name === 'drop' || s.name === 'build' || (s.name === 'outro' && sb < 8) || (s.name === 'intro' && sb >= s.bars - 4);
      const root = degMidi(tonic, ch.deg, 38);
      if (bassOn && T.bassPat) {
        // sequenced bass line; its last hit anticipates the next chord
        const hit = T.bassPat.find((b) => b[0] === k);
        if (hit) {
          const next = hit === T.bassPat[T.bassPat.length - 1] && (this.bar + 1) % T.chordBars === 0;
          const m = (next ? degMidi(tonic, this.chordAt(this.bar + 1, prog).deg, 38) : root) + hit[1];
          const dur = this.stepDur * hit[2] * 0.9;
          if (T.style === 'amiga') this.chipBass(t, m, dur, s.name === 'drop' ? 0.9 : 0.7);
          else if (T.style === 'noir') this.noirBass(t, m, dur, s.name === 'drop' ? 1 : 0.8, s.name === 'drop' ? 0.75 : 0.45 + secT * 0.2);
          else this.bass(t, m, dur, 0.85, s.name === 'drop' ? 0.85 : 0.55);
        }
      } else if (bassOn) {
        if (T.bassOct || s.name === 'drop') {
          if (k % 2 === 0) {
            const hi = k % 4 === 2;
            let m = root + (hi ? 12 : 0);
            // pickup into the next chord
            if (k === 14 && (this.bar + 1) % T.chordBars === 0) {
              const nx = this.chordAt(this.bar + 1, prog);
              m = degMidi(tonic, nx.deg, 38) + 12;
            }
            this.bass(t, m, this.stepDur * 1.7, hi ? 0.62 : 0.8, s.name === 'drop' ? 0.9 : 0.55);
          }
        } else if (k % 4 === 0 || k === 6 || k === 14) {
          this.bass(t, root + (k === 6 ? 12 : 0), this.stepDur * 3, 0.8, 0.5);
        }
      } else if (s.name === 'break' && k === 0 && this.bar % T.chordBars === 0) {
        if (T.style === 'noir') this.noirBass(t, root, this.stepDur * 16 * T.chordBars * 0.95, 0.6, 0.15);
        else this.bass(t, root, this.stepDur * 16 * T.chordBars * 0.95, 0.5, 0.2);
      }

      // ------------------------------------------------ chords
      const chordStart = k === 0 && this.bar % T.chordBars === 0;
      if (T.style === 'miami') {
        if (chordStart) {
          const v = voice(pcs, this.prevVoicing, 55);
          this.prevVoicing = v;
          const dur = this.stepDur * 16 * T.chordBars;
          const big = s.name === 'drop';
          const bright = big ? 1 : s.name === 'build' ? 0.4 + secT * 0.6 : s.name === 'break' ? 0.35 : T.padBright * (s.name === 'verse' ? 0.7 : 0.5);
          const vel = s.name === 'outro' ? 0.26 * (1 - secT) + 0.05 : big ? 0.4 : s.name === 'verse' ? 0.2 : 0.26;
          this.pad(t, v, dur, bright, vel, big ? 5 : 3, big ? 0.03 : 0.5);
          if (s.final) this.pad(t, v.map((m) => m + 12), dur, 0.8, 0.12, 2, 0.05);
        }
      } else if (T.style === 'noir') {
        // brooding pads that swell open in the choruses
        if (chordStart) {
          const v = voice(pcs, this.prevVoicing, 55);
          this.prevVoicing = v;
          const dur = this.stepDur * 16 * T.chordBars;
          const big = s.name === 'drop';
          this.pad(t, v, dur, big ? 0.55 : s.name === 'build' ? 0.3 + secT * 0.3 : 0.28, big ? 0.34 : s.name === 'break' ? 0.26 : 0.22, big ? 5 : 3, big ? 0.3 : 0.9);
          if (big) this.pad(t, v.map((m) => m + 12), dur, 0.45, 0.12, 2, 0.6);
        }
      } else if (T.style === 'amiga') {
        // tracker chords: fast arpeggios in the groove, a soft string pad in the quiet parts
        const grooveOn = s.name === 'verse' || s.name === 'drop' || s.name === 'build' || (s.name === 'intro' && sb >= 4) || (s.name === 'outro' && sb < 8);
        if (grooveOn && T.chipPat.includes(k)) {
          const next = T.chipPat.find((x) => x > k);
          const len = (next == null ? 16 + T.chipPat[0] : next) - k;
          this.chipChord(t, voice(pcs.slice(0, 3), null, 62), this.stepDur * len * 0.92, s.name === 'drop' ? 0.2 : 0.14, s.name === 'drop' ? 'pulse25' : 'pulse12');
        }
        if (chordStart && s.name !== 'drop' && s.name !== 'verse') {
          const v = voice(pcs, this.prevVoicing, 55);
          this.prevVoicing = v;
          this.pad(t, v, this.stepDur * 16 * T.chordBars, 0.3, s.name === 'break' ? 0.24 : 0.16, 2, 0.4);
        }
        if (s.name === 'drop' && sb % 8 === 0 && sb > 0 && k === 0) this.orch(t, voice(pcs.slice(0, 3), null, 55), 0.8);
      } else {
        // electro: brass stabs in the groove, orchestra hits, a soft pad elsewhere
        if ((s.name === 'drop' || s.name === 'verse' || s.name === 'build') && T.stabPat.includes((this.bar % 2) * 16 + k)) {
          this.stab(t, voice(pcs, null, 57), s.name === 'drop' ? 0.34 : 0.24, s.name === 'drop' ? 1 : 0.45 + secT * 0.4);
        }
        if (chordStart && s.name !== 'drop') {
          const v = voice(pcs, this.prevVoicing, 55);
          this.prevVoicing = v;
          this.pad(t, v, this.stepDur * 16 * T.chordBars, 0.35, s.name === 'break' ? 0.22 : 0.14, 3, 0.3);
        }
        if (s.name === 'drop' && sb % 4 === 0 && sb > 0 && k === 0) this.orch(t, voice(pcs.slice(0, 3), null, 55), 0.75);
      }

      // ------------------------------------------------ arp
      const arpOn = s.name === 'verse' || s.name === 'build' || s.name === 'drop' || (s.name === 'intro' && sb >= 4) || s.name === 'break';
      if (arpOn) {
        const v = voice(pcs, null, 64);
        const idx = T.arp[k % 8];
        const bright = s.name === 'drop' ? 0.9 : s.name === 'break' ? 0.3 : 0.4 + secT * 0.4;
        if (T.style === 'miami') {
          if (s.name !== 'break' || k % 2 === 0) {
            const m = v[idx % v.length] + (k >= 8 && s.name === 'drop' ? 12 : 0);
            this.arp(t, m, s.name === 'drop' ? 0.16 : s.name === 'break' ? 0.1 : 0.13, bright);
          }
        } else if (T.style === 'noir') {
          // only the builds get a pulse, climbing with the tension
          if (s.name === 'build' && k % 2 === 0) this.arp(t, v[idx % v.length], 0.07 + secT * 0.06, 0.25 + secT * 0.5, 'sawtooth');
        } else if (s.name !== 'drop' && (T.style === 'amiga' ? s.name !== 'break' || k % 2 === 0 : k % 2 === 0)) {
          // chip bleeps an octave up (amiga), sequencer blips on the eighths (electro)
          const amiga = T.style === 'amiga';
          this.arp(t, v[idx % v.length] + (amiga ? 12 : 0), amiga ? 0.09 : 0.11, bright, amiga ? 'pulse12' : 'square');
        }
      }

      // ------------------------------------------------ vocal chops ride the drops
      const chopsOn = T.style !== 'noir' && (sb >= 8 || (s.final && !(this.vplan && this.vplan.robot)));
      if (s.name === 'drop' && chopsOn && this.vox && this.vox.ready && this.vox.chops.length && this.vplan) {
        const P = this.vplan.chop;
        const pos = (this.bar % 2) * 16 + k;
        const hitIdx = P.rhythm.findIndex(([st]) => st === pos);
        if (hitIdx >= 0) {
          const clip = this.vox.chops[Math.floor(P.pick * this.vox.chops.length) % this.vox.chops.length];
          const v = voice(pcs, null, 67);
          const m = v[P.notes[hitIdx % P.notes.length] % v.length] + P.octave;
          this.chopNote(t, clip, m, this.stepDur * P.rhythm[hitIdx][1] * 0.9, s.final ? 0.42 : 0.34);
        }
      }

      // ------------------------------------------------ lead
      // Melodies are eight-bar phrases of two-bar cells: the hook in the drops
      // (slowed down in the breakdown) and a calmer tune in the verse.
      const leadOn = s.name === 'drop' || (s.name === 'break' && sb >= 4) || (s.name === 'verse' && sb >= 8 && T.style !== 'noir');
      if (leadOn) {
        const ci = Math.floor(sb / 2) % 4;
        const cellNotes = (s.name === 'verse' ? T.verseMel : T.hook)[ci];
        const pos = (sb % 2) * 16 + k;
        // second time through a drop, the contrast cell climbs an octave
        const low = Math.max(...cellNotes.map((n) => n.deg)) <= 4;
        const up = T.style !== 'miami' && s.name === 'drop' && ci === 2 && Math.floor(sb / 8) % 2 === 1 && low ? 7 : 0;
        for (const n of cellNotes) {
          if (n.st !== pos) continue;
          if (s.name === 'break' && !n.strong) continue;
          let m = T.style === 'miami' ? degMidi(tonic, ch.deg + n.deg, 76) : scaleMidi(tonic, n.deg + up, T.leadCenter);
          if (n.strong) {
            // land strong beats on chord tones
            let best = m, bd = 99;
            for (const p of pcs) for (let o = -1; o <= 1; o++) {
              const c = p + 12 * Math.round((m - p) / 12) + o * 12;
              if (Math.abs(c - m) < bd) { bd = Math.abs(c - m); best = c; }
            }
            m = best;
          }
          if (s.final && m < (T.style === 'miami' ? 76 : T.leadCenter)) m += 12;
          if (m > 93) m -= 12;
          const stac = T.style === 'electro' && n.len <= 2 && s.name !== 'break';
          const dur = this.stepDur * n.len * (s.name === 'break' ? 1.8 : stac ? 0.55 : 0.95);
          const vel = s.name === 'drop' ? 0.34 : s.name === 'break' ? 0.22 : 0.2;
          // talk-box tracks hand the second half of each drop to the talk box
          if (T.talkbox && s.name === 'drop' && sb % 16 >= 8) this.talkbox(t, m, dur, vel);
          else this.lead(t, m, dur, vel, T.leadWave);
          if (s.final) this.lead(t, m - 12 + (MINOR.includes((m - 3 - tonic + 120) % 12) ? -3 : -4), dur, vel * 0.45, T.style === 'amiga' ? 'pulse12' : 'square');
          // tracker echo: the note again three steps later, quieter
          if (T.style === 'amiga' && n.len <= 2 && s.name !== 'break') this.lead(t + this.stepDur * 3, m, dur, vel * 0.3, T.leadWave, true);
          this.prevLead = m;
        }
      }
    }

    // ---- drum kits -------------------------------------------------------------------
    drumsMiami(t, s, sb, k, lastBar, secT) {
      const T = this.track, beat = k % 4 === 0;
      const kickOn =
        (s.name === 'intro' && sb >= s.bars / 2) || s.name === 'verse' || s.name === 'drop' ||
        (s.name === 'build' && sb < s.bars - 2) || (s.name === 'outro' && sb < s.bars - 4);
      if (kickOn && beat) this.kick(t, s.name === 'drop' ? 1 : s.name === 'intro' ? 0.6 : 0.82, s.name === 'drop' ? 0.62 : 0.4);
      const clapOn = s.name === 'verse' || s.name === 'drop' || (s.name === 'outro' && sb < 8);
      if (clapOn && (k === 4 || k === 12)) this.snare(t, s.name === 'drop' ? 1 : 0.75, s.name === 'drop');
      // hats
      const hatsOn = s.name !== 'break' && !(s.name === 'intro' && sb < 2);
      if (hatsOn) {
        if (k % 4 === 2 && (s.name !== 'intro' || sb >= 4)) this.hat(t + (T.swingHat ? this.stepDur * 0.12 : 0), true, s.name === 'drop' ? 0.55 : 0.4);
        if (k % 2 === 0 && s.name !== 'intro') this.hat(t, false, 0.22 + (k % 4 === 0 ? 0.06 : 0));
        if (s.name === 'drop' && k % 2 === 1) this.hat(t, false, 0.12);
        if (s.name === 'intro' && k % 2 === 0) this.hat(t, false, 0.14);
      }
      // build: accelerating snare roll
      if (s.name === 'build') {
        const q = sb / s.bars;
        const div = q < 0.5 ? 4 : q < 0.75 ? 2 : 1;
        if (k % div === 0) {
          const v = 0.25 + 0.75 * secT;
          this.snare(t, v * 0.8, false, 1 + secT * 0.8);
          if (sb === s.bars - 2 && k >= 8) this.snare(t + this.stepDur / 2, v * 0.7, false, 1.9);
        }
      }
      // fills at phrase ends
      if ((s.name === 'drop' || s.name === 'verse') && sb % 8 === 7 && k >= 12 && !lastBar) this.snare(t, 0.5 + (k - 12) * 0.12, false, 1.2);
      if (s.name === 'drop' && sb % 8 === 0 && sb > 0 && k === 0) this.crash(t, 0.6);
    }

    // Tracker kit: crunchy 8-bit samples, pitched like MOD instruments.
    drumsAmiga(t, s, sb, k, lastBar, secT) {
      const T = this.track, S = this.smp;
      const kickOn =
        (s.name === 'intro' && sb >= s.bars / 2) || s.name === 'verse' || s.name === 'drop' ||
        (s.name === 'build' && sb < s.bars - 2) || (s.name === 'outro' && sb < s.bars - 4);
      if (kickOn && T.kickPat.includes(k)) this.drum(t, S.kick, s.name === 'drop' ? 1 : 0.75, 1, s.name === 'drop' ? 0.35 : 0.2);
      const snareOn = s.name === 'verse' || s.name === 'drop' || (s.name === 'outro' && sb < 8);
      if (snareOn && (k === 4 || k === 12)) this.drum(t, S.snare, s.name === 'drop' ? 0.85 : 0.65);
      if (snareOn && s.name === 'drop' && k === 14 && sb % 2 === 1) this.drum(t, S.snare, 0.3, 1.15);
      const hatsOn = s.name !== 'break' && !(s.name === 'intro' && sb < 4);
      if (hatsOn && k % 2 === 0) this.drum(t, k % 4 === 2 && s.name === 'drop' ? S.open : S.hat, k % 4 === 2 ? 0.45 : 0.3, 1, 0, 0.35);
      if (hatsOn && s.name === 'drop' && k % 2 === 1) this.drum(t, S.hat, 0.16, 1.1, 0, 0.35);
      // build: a snare roll that climbs in pitch
      if (s.name === 'build') {
        const q = sb / s.bars;
        const div = q < 0.5 ? 4 : q < 0.75 ? 2 : 1;
        if (k % div === 0) this.drum(t, S.snare, 0.3 + 0.55 * secT, 1 + secT * 0.9);
      }
      // fills: pitched snares running down the kit at phrase ends
      if ((s.name === 'drop' || s.name === 'verse') && sb % 8 === 7 && k >= 12 && !lastBar) this.drum(t, S.snare, 0.6, 1.35 - (k - 12) * 0.1);
      if (s.name === 'drop' && sb % 8 === 0 && sb > 0 && k === 0) this.crash(t, 0.5);
    }

    // Electro kit: 808-style kick, claps, metallic hats, cowbell, Simmons toms.
    // Noir kit: a half-time kick, a huge gated snare on two and four, soft hats,
    // and a tom run instead of a snare roll into each chorus.
    drumsNoir(t, s, sb, k, lastBar, secT) {
      const T = this.track;
      const kickOn = (s.name === 'intro' && sb >= s.bars / 2) || s.name === 'verse' || s.name === 'drop' || s.name === 'build' || (s.name === 'outro' && sb < s.bars - 2);
      if (kickOn && T.kickPat.includes(k)) this.kick(t, s.name === 'drop' ? 1 : 0.85, s.name === 'drop' ? 0.35 : 0.25);
      const snareOn = s.name === 'verse' || s.name === 'drop' || s.name === 'build' || (s.name === 'outro' && sb < s.bars - 2);
      if (snareOn && (k === 4 || k === 12)) this.snare(t, s.name === 'drop' ? 1 : 0.85, true, 0.92);
      const hatsOn = s.name !== 'break' && !(s.name === 'intro' && sb < s.bars / 2);
      if (hatsOn && k % 2 === 0) this.hat(t, s.name === 'drop' && k === 14, s.name === 'drop' ? 0.2 : 0.14);
      if (hatsOn && s.name === 'drop' && k % 2 === 1) this.hat(t, false, 0.07);
      if (s.name === 'build' && lastBar && k >= 8 && k % 2 === 0) this.tom(t, 170 - (k - 8) * 16, 0.8);
      if ((s.name === 'drop' || s.name === 'verse') && sb % 8 === 7 && k >= 12 && k % 2 === 0 && !lastBar) this.tom(t, 150 - (k - 12) * 20, 0.6);
      if (s.name === 'drop' && sb % 8 === 0 && sb > 0 && k === 0) this.crash(t, 0.5);
    }

    drumsElectro(t, s, sb, k, lastBar, secT) {
      const T = this.track, S = this.smp;
      const kickOn =
        (s.name === 'intro' && sb >= s.bars / 2) || s.name === 'verse' || s.name === 'drop' ||
        (s.name === 'build' && sb < s.bars - 2) || (s.name === 'outro' && sb < s.bars - 4);
      if (kickOn && T.kickPat.includes(k)) this.kick808(t, s.name === 'drop' ? 1 : 0.8, s.name === 'drop' ? 0.55 : 0.35);
      const clapOn = s.name === 'verse' || s.name === 'drop' || (s.name === 'outro' && sb < 8);
      if (clapOn && (k === 4 || k === 12)) this.snare(t, s.name === 'drop' ? 0.9 : 0.7, true);
      const hatsOn = s.name !== 'break' && !(s.name === 'intro' && sb < 2);
      if (hatsOn) {
        const busy = s.name === 'drop' || (s.name === 'build' && sb >= s.bars / 2);
        if (k % 2 === 0) this.drum(t, k % 4 === 2 && s.name === 'drop' ? S.open808 : S.hat808, k % 4 === 2 ? 0.34 : 0.26, 1, 0, 0.3);
        else if (busy) this.drum(t, S.hat808, 0.15, 1, 0, 0.3);
      }
      if ((s.name === 'drop' || (s.name === 'verse' && sb >= 8)) && T.bellPat.includes((this.bar % 2) * 16 + k)) this.drum(t, S.cowbell, 0.3, 1, 0, -0.25);
      // build: snare roll, then a tom run into the drop
      if (s.name === 'build') {
        const q = sb / s.bars;
        const div = q < 0.5 ? 4 : q < 0.75 ? 2 : 1;
        if (k % div === 0) this.snare(t, (0.25 + 0.75 * secT) * 0.7, false, 1 + secT * 0.6);
        if (sb === s.bars - 2 && k >= 8 && k % 2 === 0) this.tom(t, 200 - (k - 8) * 16, 0.8);
      }
      // Simmons tom fills at phrase ends
      if ((s.name === 'drop' || s.name === 'verse') && sb % 8 === 7 && k >= 10 && k % 2 === 0 && !lastBar) this.tom(t, 190 - (k - 10) * 18, 0.7);
      if (s.name === 'drop' && sb % 8 === 0 && sb > 0 && k === 0) this.crash(t, 0.55);
    }

    // ---- instruments ------------------------------------------------------------
    env(g, t, a, peak, d, sus, rel, end) {
      const p = g.gain;
      p.setValueAtTime(0.0001, t);
      p.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
      if (d) p.exponentialRampToValueAtTime(Math.max(0.0002, peak * sus), t + a + d);
      if (end != null) {
        p.setValueAtTime(Math.max(0.0002, peak * (d ? sus : 1)), Math.max(t + a + (d || 0), end - rel));
        p.exponentialRampToValueAtTime(0.0001, end);
      }
    }

    duckAt(t, depth) {
      const d = this.n.duck.gain;
      d.setValueAtTime(1 - depth, t);
      d.setTargetAtTime(1, t + 0.02, this.stepDur * 0.9);
    }

    kick(t, v, duck) {
      const c = this.ctx, N = this.n;
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(52, t + 0.09);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.35);
      this.env(g, t, 0.003, 1.1 * v, 0.42, 0.001, 0, null);
      o.connect(g).connect(N.drums);
      o.start(t); o.stop(t + 0.5);
      const n = c.createBufferSource(); n.buffer = this.white;
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
      const ng = c.createGain();
      this.env(ng, t, 0.001, 0.22 * v, 0.012, 0.01, 0, null);
      n.connect(hp).connect(ng).connect(N.drums);
      n.start(t, 0.1); n.stop(t + 0.03);
      this.kickMark(t, duck);
    }

    snare(t, v, big, pitch = 1) {
      const c = this.ctx, N = this.n;
      const n = c.createBufferSource(); n.buffer = this.white;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700 * pitch; bp.Q.value = 0.7;
      const g = c.createGain();
      this.env(g, t, 0.001, 0.62 * v, 0.2, 0.01, 0, null);
      n.connect(bp).connect(g);
      g.connect(N.drums);
      const send = c.createGain(); send.gain.value = big ? 0.85 : 0.35;
      g.connect(send).connect(N.gatedIn);
      n.start(t, (t * 7.3) % 1.5); n.stop(t + 0.26);
      const o = c.createOscillator(), og = c.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(210 * pitch, t);
      o.frequency.exponentialRampToValueAtTime(160 * pitch, t + 0.06);
      this.env(og, t, 0.001, 0.4 * v, 0.1, 0.01, 0, null);
      o.connect(og).connect(N.drums);
      o.start(t); o.stop(t + 0.14);
      if (big) {
        // clap layer
        for (let i = 0; i < 3; i++) {
          const cn = c.createBufferSource(); cn.buffer = this.white;
          const cb = c.createBiquadFilter(); cb.type = 'bandpass'; cb.frequency.value = 1150; cb.Q.value = 1.2;
          const cg = c.createGain();
          const tt = t - 0.012 + i * 0.009;
          this.env(cg, tt, 0.001, 0.32 * v, 0.02, 0.05, 0, null);
          cn.connect(cb).connect(cg).connect(N.drums);
          cg.connect(send);
          cn.start(Math.max(0, tt), 0.5 + i * 0.1); cn.stop(tt + 0.05);
        }
      }
    }

    hat(t, open, v) {
      const c = this.ctx, N = this.n;
      const n = c.createBufferSource(); n.buffer = this.white;
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = open ? 6500 : 8000;
      const g = c.createGain();
      const len = open ? 0.24 : 0.035;
      this.env(g, t, 0.001, v * 0.5, len, 0.01, 0, null);
      let out = g;
      if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = open ? 0.25 : 0.35; g.connect(p); out = p; }
      n.connect(hp).connect(g);
      out.connect(N.drums);
      n.start(t, (t * 3.1) % 1.5); n.stop(t + len + 0.05);
    }

    crash(t, v) {
      const c = this.ctx, N = this.n;
      const n = c.createBufferSource(); n.buffer = this.white;
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4200;
      const g = c.createGain();
      this.env(g, t, 0.002, 0.42 * v, 2.4, 0.001, 0, null);
      n.connect(hp).connect(g).connect(N.drums);
      const s = c.createGain(); s.gain.value = 0.3; g.connect(s).connect(N.verbIn);
      n.start(t, 0); n.stop(t + 2.5);
    }

    impact(t, v) {
      const c = this.ctx, N = this.n;
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(90, t);
      o.frequency.exponentialRampToValueAtTime(32, t + 1.1);
      this.env(g, t, 0.004, 0.9 * v, 1.6, 0.001, 0, null);
      o.connect(g).connect(N.master);
      o.start(t); o.stop(t + 1.7);
    }

    riser(t, dur) {
      const c = this.ctx, N = this.n;
      const n = c.createBufferSource(); n.buffer = this.white; n.loop = true;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.5;
      bp.frequency.setValueAtTime(300, t);
      bp.frequency.exponentialRampToValueAtTime(9000, t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + dur * 0.97);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      n.connect(bp).connect(g).connect(N.master);
      const s = c.createGain(); s.gain.value = 0.4; g.connect(s).connect(N.verbIn);
      n.start(t); n.stop(t + dur + 0.05);
      // pitch riser
      const o = c.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(1320, t + dur);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
      const og = c.createGain();
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(0.07, t + dur * 0.97);
      og.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(lp).connect(og).connect(N.master);
      og.connect(s);
      o.start(t); o.stop(t + dur + 0.05);
    }

    downlifter(t, dur) {
      const c = this.ctx, N = this.n;
      const n = c.createBufferSource(); n.buffer = this.white; n.loop = true;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.5;
      bp.frequency.setValueAtTime(7000, t);
      bp.frequency.exponentialRampToValueAtTime(200, t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.16, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      n.connect(bp).connect(g).connect(N.verbIn);
      n.start(t); n.stop(t + dur);
    }

    bass(t, m, dur, v, bright) {
      const c = this.ctx, N = this.n;
      const f = hz(m);
      const o1 = c.createOscillator(), o2 = c.createOscillator();
      o1.type = 'sawtooth'; o1.frequency.value = f;
      o2.type = 'square'; o2.frequency.value = f; o2.detune.value = -6;
      const o2g = c.createGain(); o2g.gain.value = 0.45;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6;
      lp.frequency.setValueAtTime(260 + 2200 * bright, t);
      lp.frequency.setTargetAtTime(220 + 300 * bright, t + 0.005, 0.07);
      const g = c.createGain();
      this.env(g, t, 0.004, 0.36 * v, 0.12, 0.7, 0.03, t + dur);
      o1.connect(lp); o2.connect(o2g).connect(lp);
      lp.connect(g).connect(N.music);
      o1.start(t); o2.start(t); o1.stop(t + dur + 0.02); o2.stop(t + dur + 0.02);
    }

    pad(t, notes, dur, bright, v, voices, attack) {
      const c = this.ctx, N = this.n;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8;
      lp.frequency.setValueAtTime(500 + 5200 * bright * bright, t);
      const g = c.createGain();
      const rel = 1.6;
      this.env(g, t, attack, v / Math.sqrt(notes.length * voices) * 1.6, 0, 1, rel, t + dur + rel * 0.6);
      lp.connect(g).connect(N.music);
      const send = c.createGain(); send.gain.value = 0.42; g.connect(send).connect(N.verbIn);
      const det = voices === 5 ? [-16, -7, 0, 7, 16] : voices === 3 ? [-9, 0, 9] : [-6, 6];
      // spread detuned voices across two panned groups for width
      const sides = [-0.65, 0.65].map((pan) => {
        if (!c.createStereoPanner) return lp;
        const p = c.createStereoPanner();
        p.pan.value = pan;
        p.connect(lp);
        return p;
      });
      notes.forEach((m, ni) => {
        det.forEach((cents, vi) => {
          const o = c.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = hz(m);
          o.detune.value = cents + (ni - 1.5) * 1.5;
          o.connect(sides[(vi + ni) % 2]);
          o.start(t);
          o.stop(t + dur + rel + 0.1);
        });
      });
    }

    arp(t, m, v, bright, wave = 'square') {
      const c = this.ctx, N = this.n;
      const o = c.createOscillator(); this.setWave(o, wave); o.frequency.value = hz(m);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3;
      lp.frequency.setValueAtTime(700 + 5000 * bright, t);
      lp.frequency.exponentialRampToValueAtTime(380, t + 0.14);
      const g = c.createGain();
      this.env(g, t, 0.002, v * 0.5, 0.16, 0.05, 0, null);
      o.connect(lp).connect(g).connect(N.music);
      const s = c.createGain(); s.gain.value = 0.55; g.connect(s).connect(N.delayIn);
      o.start(t); o.stop(t + 0.22);
    }

    // The lead voice. Miami: detuned saws gliding between close notes.
    // Amiga: one pulse channel with a tracker octave blip, slides and delayed
    // vibrato, panned hard like an Amiga channel. Electro: saws that bend up
    // into long notes.
    lead(t, m, dur, v, wave, echo = false) {
      const c = this.ctx, N = this.n, style = this.track.style;
      const amiga = style === 'amiga', electro = style === 'electro', noir = style === 'noir';
      const f = hz(m);
      const g = c.createGain();
      if (amiga) this.env(g, t, 0.003, v, 0.12, 0.7, 0.05, t + dur + 0.04);
      else if (noir) this.env(g, t, 0.05, v * 0.85, 0.3, 0.8, 0.3, t + dur + 0.2);
      else this.env(g, t, 0.012, v, 0.18, 0.78, 0.18, t + dur + 0.12);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.6;
      lp.frequency.setValueAtTime(amiga ? 7000 : 5200, t);
      if (!amiga) lp.frequency.exponentialRampToValueAtTime(2600, t + 0.3);
      const lfo = c.createOscillator(); lfo.frequency.value = amiga ? 6.8 : noir ? 4.5 : 5.6;
      const lfoG = c.createGain();
      lfoG.gain.setValueAtTime(0, t);
      if (amiga) {
        lfoG.gain.setValueAtTime(0, t + Math.min(0.12, dur * 0.4));
        lfoG.gain.linearRampToValueAtTime(f * 0.012, t + Math.min(0.35, dur));
      } else lfoG.gain.linearRampToValueAtTime(f * 0.007, t + Math.min(0.5, dur));
      lfo.connect(lfoG);
      const near = !echo && this.prevLead && Math.abs(this.prevLead - m) <= (amiga ? 5 : 7);
      const from = near ? hz(this.prevLead) : electro && !echo && dur > this.stepDur * 3 ? hz(m - 2) : f;
      const glide = amiga ? 0.07 : noir ? 0.12 : electro && !near ? 0.09 : 0.045;
      const layers = amiga ? [[wave, 0, 0.75], ['square', -1200, 0.16]] : [[wave, -8, 0.5], [wave, 8, 0.5], ['square', -1200, 0.22]];
      const oscs = [];
      for (const [type, det, gain] of layers) {
        const o = c.createOscillator();
        this.setWave(o, type);
        if (amiga && !near && !echo) {
          o.frequency.setValueAtTime(f * 2, t);
          o.frequency.setValueAtTime(f, t + 0.02);
        } else {
          o.frequency.setValueAtTime(from, t);
          o.frequency.exponentialRampToValueAtTime(f, t + glide);
        }
        o.detune.value = det;
        lfoG.connect(o.frequency);
        const og = c.createGain(); og.gain.value = gain;
        o.connect(og).connect(lp);
        oscs.push(o);
      }
      lp.connect(g);
      if (amiga && c.createStereoPanner) {
        const p = c.createStereoPanner(); p.pan.value = 0.5;
        g.connect(p).connect(N.lead);
      } else g.connect(N.lead);
      const rs = c.createGain(); rs.gain.value = amiga ? 0.12 : noir ? 0.55 : 0.38; g.connect(rs).connect(N.verbIn);
      const ds = c.createGain(); ds.gain.value = amiga ? 0.2 : noir ? 0.5 : 0.3; g.connect(ds).connect(N.delayIn);
      const end = t + dur + 0.2;
      lfo.start(t); lfo.stop(end);
      for (const o of oscs) { o.start(t); o.stop(end); }
    }

    // Talk box: a buzzy synth shaped by a mouth. Three formant filters glide
    // from a closed "oo" into the note's vowel, so every note says "wah".
    talkbox(t, m, dur, v) {
      const c = this.ctx, N = this.n;
      const f = hz(m);
      const src = c.createGain();
      const from = this.prevLead && Math.abs(this.prevLead - m) <= 7 ? hz(this.prevLead) : f;
      const lfo = c.createOscillator(); lfo.frequency.value = 5.2;
      const lfoG = c.createGain();
      lfoG.gain.setValueAtTime(0, t);
      lfoG.gain.linearRampToValueAtTime(f * 0.01, t + Math.min(0.4, dur));
      lfo.connect(lfoG);
      const oscs = [];
      for (const [type, det, gain] of [['sawtooth', -6, 0.6], ['square', 6, 0.35]]) {
        const o = c.createOscillator(); o.type = type; o.detune.value = det;
        o.frequency.setValueAtTime(from, t);
        o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
        lfoG.connect(o.frequency);
        const og = c.createGain(); og.gain.value = gain;
        o.connect(og).connect(src);
        oscs.push(o);
      }
      const g = c.createGain();
      this.env(g, t, 0.015, v * 2.1, 0.2, 0.8, 0.12, t + dur + 0.08);
      const vow = FORMANTS[TB_VOWELS[(this.tbIdx = (this.tbIdx || 0) + 1) % TB_VOWELS.length]];
      [[7, 1], [11, 0.6], [14, 0.35]].forEach(([q, level], i) => {
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
        bp.frequency.setValueAtTime(FORMANTS.u[i], t);
        bp.frequency.exponentialRampToValueAtTime(vow[i], t + Math.min(0.12, dur * 0.5));
        const bg = c.createGain(); bg.gain.value = level;
        src.connect(bp).connect(bg).connect(g);
      });
      g.connect(N.lead);
      const rs = c.createGain(); rs.gain.value = 0.3; g.connect(rs).connect(N.verbIn);
      const ds = c.createGain(); ds.gain.value = 0.25; g.connect(ds).connect(N.delayIn);
      const end = t + dur + 0.2;
      lfo.start(t); lfo.stop(end);
      for (const o of oscs) { o.start(t); o.stop(end); }
    }

    hook(t, h, tag) {
      const c = this.ctx, N = this.n;
      const src = c.createBufferSource();
      src.buffer = h.buf;
      const g = c.createGain();
      g.gain.value = h.norm * (tag === 'drop-in' ? 0.95 : 0.8);
      // a touch of "radio" colour in intros, fuller elsewhere
      const eq = c.createBiquadFilter();
      eq.type = tag === 'intro' ? 'bandpass' : 'peaking';
      eq.frequency.value = tag === 'intro' ? 1800 : 3200;
      if (tag === 'intro') eq.Q.value = 0.7; else { eq.gain.value = 3; eq.Q.value = 0.8; }
      src.connect(eq).connect(g).connect(N.vox);
      const rs = c.createGain(); rs.gain.value = tag === 'noir' ? 0.7 : 0.5; g.connect(rs).connect(N.verbIn);
      const ds = c.createGain(); ds.gain.value = tag === 'drop-in' ? 0.15 : tag === 'noir' ? 0.45 : 0.32; g.connect(ds).connect(N.delayIn);
      src.start(t, h.onset);
      src.stop(t + h.dur + 0.2);
      this.busyUntil = Math.max(this.busyUntil || 0, t + h.dur);
      this.mark({ t, type: 'vocal', text: h.text });
    }

    chopNote(t, clip, m, dur, v) {
      const c = this.ctx, N = this.n;
      // retune to the target note, choosing the octave closest to the source
      let shift = m - clip.midi;
      while (shift > 6) shift -= 12;
      while (shift < -6) shift += 12;
      const src = c.createBufferSource();
      src.buffer = clip.buf;
      src.playbackRate.value = Math.pow(2, shift / 12);
      const g = c.createGain();
      const peak = v * clip.norm;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
      g.gain.setValueAtTime(peak, t + Math.max(0.01, dur - 0.04));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
      src.connect(g).connect(N.music);
      const rs = c.createGain(); rs.gain.value = 0.28; g.connect(rs).connect(N.verbIn);
      const ds = c.createGain(); ds.gain.value = 0.18; g.connect(ds).connect(N.delayIn);
      src.start(t, clip.onset + Math.min(0.12, clip.dur * 0.1));
      src.stop(t + dur + 0.1);
    }

    setWave(o, w) {
      if (this.waves && this.waves[w]) o.setPeriodicWave(this.waves[w]);
      else o.type = w;
    }

    // A drum sample. `duck` > 0 marks it as a kick: sidechain pump + visuals.
    drum(t, buf, v, rate = 1, duck = 0, pan = 0) {
      const c = this.ctx, N = this.n;
      const src = c.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      const g = c.createGain(); g.gain.value = v;
      src.connect(g);
      if (pan && c.createStereoPanner) {
        const p = c.createStereoPanner(); p.pan.value = pan;
        g.connect(p).connect(N.drums);
      } else g.connect(N.drums);
      src.start(t);
      if (duck) this.kickMark(t, duck);
    }

    kickMark(t, duck) {
      this.duckAt(t, duck);
      this.kicks.push(t);
      if (this.kicks.length > 64) this.kicks.shift();
    }

    // 808-style kick: a long, saturated sine boom.
    kick808(t, v, duck) {
      const c = this.ctx, N = this.n;
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(130, t);
      o.frequency.exponentialRampToValueAtTime(50, t + 0.05);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.6);
      this.env(g, t, 0.002, 1.2 * v, 0.7, 0.001, 0, null);
      o.connect(g).connect(N.sat);
      o.start(t); o.stop(t + 0.8);
      this.kickMark(t, duck);
    }

    // Simmons-style electronic tom: a falling sine through the gated reverb.
    tom(t, f, v) {
      const c = this.ctx, N = this.n;
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f * 1.7, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.12);
      const g = c.createGain();
      this.env(g, t, 0.002, 0.55 * v, 0.35, 0.001, 0, null);
      o.connect(g).connect(N.drums);
      const s = c.createGain(); s.gain.value = 0.35; g.connect(s).connect(N.gatedIn);
      o.start(t); o.stop(t + 0.4);
    }

    // The 80s orchestra hit: a big chord with a noisy bite, gone in half a second.
    orch(t, notes, v) {
      const c = this.ctx, N = this.n;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1;
      lp.frequency.setValueAtTime(5000, t);
      lp.frequency.exponentialRampToValueAtTime(900, t + 0.4);
      const g = c.createGain();
      this.env(g, t, 0.004, 0.3 * v, 0.5, 0.001, 0, null);
      lp.connect(g).connect(N.master);
      const rs = c.createGain(); rs.gain.value = 0.5; g.connect(rs).connect(N.verbIn);
      const voices = [...notes.map((m) => [m, 'sawtooth']), [notes[0] - 12, 'square'], [notes[0] + 12, 'sawtooth']];
      voices.forEach(([m, type], i) => {
        const o = c.createOscillator(); o.type = type;
        o.frequency.value = hz(m);
        o.detune.value = (i % 2 ? 7 : -7);
        o.connect(lp);
        o.start(t); o.stop(t + 0.6);
      });
      const n = c.createBufferSource(); n.buffer = this.white;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.8;
      const ng = c.createGain();
      this.env(ng, t, 0.001, 0.8, 0.06, 0.01, 0, null);
      n.connect(bp).connect(ng).connect(lp);
      n.start(t, 0.3); n.stop(t + 0.15);
    }

    // Tracker chord: one pulse channel racing through the chord tones at the
    // 50 Hz frame rate (the 0xy arpeggio effect), panned hard left.
    chipChord(t, notes, dur, v, wave) {
      const c = this.ctx, N = this.n;
      const o = c.createOscillator(); this.setWave(o, wave);
      for (let x = 0, i = 0; x < dur; x += 1 / 50, i++) o.frequency.setValueAtTime(hz(notes[i % notes.length]), t + x);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6500;
      const g = c.createGain();
      this.env(g, t, 0.002, v, dur * 0.8, 0.4, 0.02, t + dur);
      o.connect(lp).connect(g);
      if (c.createStereoPanner) {
        const p = c.createStereoPanner(); p.pan.value = -0.55;
        g.connect(p).connect(N.music);
      } else g.connect(N.music);
      const ds = c.createGain(); ds.gain.value = 0.15; g.connect(ds).connect(N.delayIn);
      o.start(t); o.stop(t + dur + 0.03);
    }

    // Noir bass: two detuned saws and a sub-octave square through a resonant
    // filter, then driven hard: fat, gritty and analog.
    noirBass(t, m, dur, v, bright) {
      const c = this.ctx, N = this.n;
      const f = hz(m);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4;
      lp.frequency.setValueAtTime(320 + 1500 * bright, t);
      lp.frequency.setTargetAtTime(190 + 520 * bright, t + 0.01, 0.12);
      const g = c.createGain();
      this.env(g, t, 0.006, 0.3 * v, 0.2, 0.75, 0.04, t + dur);
      const oscs = [];
      for (const [type, det, gain, mult] of [['sawtooth', -9, 0.5, 1], ['sawtooth', 9, 0.5, 1], ['square', 0, 0.45, 0.5]]) {
        const o = c.createOscillator(); o.type = type; o.frequency.value = f * mult; o.detune.value = det;
        const og = c.createGain(); og.gain.value = gain;
        o.connect(og).connect(lp);
        oscs.push(o);
      }
      lp.connect(g).connect(N.grit);
      for (const o of oscs) { o.start(t); o.stop(t + dur + 0.05); }
    }

    // Tracker bass: a plucked square.
    chipBass(t, m, dur, v) {
      const c = this.ctx, N = this.n;
      const o = c.createOscillator(); o.type = 'square'; o.frequency.value = hz(m);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2400, t);
      lp.frequency.exponentialRampToValueAtTime(700, t + 0.12);
      const g = c.createGain();
      this.env(g, t, 0.002, 0.3 * v, 0.1, 0.6, 0.02, t + dur);
      o.connect(lp).connect(g).connect(N.music);
      o.start(t); o.stop(t + dur + 0.03);
    }

    // Brass-like synth stab: detuned saws through a snappy filter.
    stab(t, notes, v, bright) {
      const c = this.ctx, N = this.n;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2.5;
      lp.frequency.setValueAtTime(900 + 4200 * bright, t);
      lp.frequency.exponentialRampToValueAtTime(600, t + 0.16);
      const g = c.createGain();
      this.env(g, t, 0.004, (v / Math.sqrt(notes.length * 2)) * 1.5, 0.22, 0.001, 0, null);
      lp.connect(g).connect(N.music);
      const rs = c.createGain(); rs.gain.value = 0.3; g.connect(rs).connect(N.verbIn);
      for (const m of notes) for (const det of [-7, 7]) {
        const o = c.createOscillator(); o.type = 'sawtooth';
        o.frequency.value = hz(m); o.detune.value = det;
        o.connect(lp);
        o.start(t); o.stop(t + 0.3);
      }
    }

    // Robot vocoder. The spoken line (the modulator) is split into bands, and
    // each band's loudness opens the same band of a synth (the carrier) that
    // sings the line: a lead voice stepping through the melody syllable by
    // syllable, the chord underneath, and a little noise for the consonants.
    vocode(t, clip, mel, tones, v, verb = 0.35) {
      const c = this.ctx, N = this.n;
      const end = t + clip.dur;
      const out = c.createGain(); out.gain.value = v * VOC_OUT;
      out.connect(N.vox);
      const rs = c.createGain(); rs.gain.value = verb; out.connect(rs).connect(N.verbIn);
      const ds = c.createGain(); ds.gain.value = 0.22; out.connect(ds).connect(N.delayIn);
      const mod = c.createBufferSource(); mod.buffer = clip.buf;
      const modG = c.createGain(); modG.gain.value = clip.norm;
      mod.connect(modG);
      const car = c.createGain();
      const lead = c.createOscillator(); lead.type = 'sawtooth';
      const leadG = c.createGain(); leadG.gain.value = 0.8;
      lead.connect(leadG).connect(car);
      let prevF = 0;
      clip.syl.forEach((at, i) => {
        const idx = i === clip.syl.length - 1 ? mel.end : mel.notes[i % mel.notes.length];
        const f = hz(tones[idx % tones.length]);
        if (!prevF) lead.frequency.setValueAtTime(f, t);
        else {
          lead.frequency.setValueAtTime(prevF, t + at);
          lead.frequency.exponentialRampToValueAtTime(f, t + at + 0.035);
        }
        prevF = f;
      });
      const oscs = [lead];
      for (const m of tones) {
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m);
        const og = c.createGain(); og.gain.value = 0.2;
        o.connect(og).connect(car);
        oscs.push(o);
      }
      const hiss = c.createBufferSource(); hiss.buffer = this.white; hiss.loop = true;
      const hissG = c.createGain(); hissG.gain.value = 0.12;
      hiss.connect(hissG).connect(car);
      for (let i = 0; i < VOC_BANDS; i++) {
        const f = 150 * Math.pow(7000 / 150, i / (VOC_BANDS - 1));
        const mb = c.createBiquadFilter(); mb.type = 'bandpass'; mb.frequency.value = f; mb.Q.value = 5;
        const rect = c.createWaveShaper(); rect.curve = this.absCurve;
        const env = c.createBiquadFilter(); env.type = 'lowpass'; env.frequency.value = 40;
        const amt = c.createGain(); amt.gain.value = VOC_GAIN;
        modG.connect(mb).connect(rect).connect(env).connect(amt);
        const cb = c.createBiquadFilter(); cb.type = 'bandpass'; cb.frequency.value = f; cb.Q.value = 5;
        const vca = c.createGain(); vca.gain.value = 0;
        amt.connect(vca.gain);
        car.connect(cb).connect(vca).connect(out);
      }
      // sibilants straight through
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000;
      const hpG = c.createGain(); hpG.gain.value = 0.25;
      modG.connect(hp).connect(hpG).connect(out);
      mod.start(t, clip.onset); mod.stop(end + 0.1);
      for (const o of oscs) { o.start(t); o.stop(end + 0.3); }
      hiss.start(t, (t * 3.7) % 1.5); hiss.stop(end + 0.3);
      // the lead line steps back while the robot sings
      N.lead.gain.setTargetAtTime(0.4, t, 0.05);
      N.lead.gain.setTargetAtTime(0.9, end, 0.2);
      this.busyUntil = Math.max(this.busyUntil || 0, end);
      this.mark({ t, type: 'vocal', text: clip.text });
    }

    // ---- weather -------------------------------------------------------------------
    updateAmbience() {
      const w = ND.world && ND.world.weather;
      if (!w || !this.n) return;
      const t = this.ctx.currentTime;
      const rain = w.v.rain;
      this.n.rainG.gain.setTargetAtTime(rain * 0.3, t, 0.5);
      this.n.rainLP.frequency.setTargetAtTime(1600 + rain * 3200, t, 0.5);
      // the engine note and the tyres follow the speed pedal (not the music)
      const sp = ND.world.speed / ND.SPEED;
      this.n.engine[0].frequency.setTargetAtTime(41 * (0.8 + 0.3 * sp), t, 0.4);
      this.n.engine[1].frequency.setTargetAtTime(82.6 * (0.8 + 0.3 * sp), t, 0.4);
      this.n.engineG.gain.setTargetAtTime(0.035 * (0.8 + 0.25 * sp), t, 0.4);
      this.n.hissG.gain.setTargetAtTime((0.004 + rain * 0.05) * Math.min(1.8, sp), t, 0.5);
      this.n.verbOut.gain.setTargetAtTime(0.55 + rain * 0.2, t, 1);
    }

    thunder(e) {
      if (!this.ctx || !this.enabled) return;
      const c = this.ctx, N = this.n;
      const delay = e.near ? 0.15 + Math.random() * 0.4 : 0.8 + Math.random() * 2.2;
      const t = c.currentTime + delay;
      const n = c.createBufferSource(); n.buffer = this.brown;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = e.near ? 900 : 380;
      lp.frequency.setTargetAtTime(160, t + 0.3, 1.2);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.9 * e.intensity, t + (e.near ? 0.04 : 0.4));
      g.gain.setTargetAtTime(0.35 * e.intensity, t + 0.6, 0.6);
      g.gain.setTargetAtTime(0.0001, t + 2, 1.4);
      n.connect(lp).connect(g).connect(N.amb);
      const s = c.createGain(); s.gain.value = 0.3; g.connect(s).connect(N.verbIn);
      n.start(t, Math.random() * 1.5); n.stop(t + 7);
      if (e.near) {
        const cr = c.createBufferSource(); cr.buffer = this.white;
        const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
        const cg = c.createGain();
        this.env(cg, t, 0.002, 0.35 * e.intensity, 0.35, 0.001, 0, null);
        cr.connect(hp).connect(cg).connect(N.amb);
        cr.start(t); cr.stop(t + 0.5);
      }
    }

    // ---- sync info for the visuals ------------------------------------------------------
    heard() {
      if (!this.ctx) return 0;
      return this.ctx.currentTime - (this.ctx.outputLatency || this.ctx.baseLatency || 0);
    }
    pulse() {
      if (!this.ctx || !this.enabled) return { playing: false, kick: 0, drop: 0, energy: 0 };
      const now = this.heard();
      let lastKick = -1;
      for (let i = this.kicks.length - 1; i >= 0; i--) if (this.kicks[i] <= now) { lastKick = this.kicks[i]; break; }
      const kick = lastKick < 0 ? 0 : Math.exp(-(now - lastKick) / 0.11);
      // consume marks that have become audible
      while (this.marks.length && this.marks[0].t <= now) {
        const m = this.marks.shift();
        if (m.type === 'section') this.curSection = m;
        if (m.type === 'drop') { this.lastDrop = m.t; this.lastDropFinal = m.final; ND.bus.emit('drop', m); }
        if (m.type === 'track') { this.shownTrack = m.track; this.trackShownAt = now; ND.bus.emit('track', m.track); }
        if (m.type === 'talk') this.talk = m;
      }
      const drop = this.lastDrop != null ? Math.exp(-(now - this.lastDrop) / (this.lastDropFinal ? 1.4 : 0.9)) : 0;
      let talk = null;
      if (this.talk) {
        const age = now - this.talk.t, clip = this.talk.clip;
        if (age < clip.dur + 0.6) talk = { mouth: age < clip.dur ? clip.env[Math.floor(age * 40)] || 0 : 0, cam: this.talk.cam, age, left: clip.dur - age, text: clip.text };
        else this.talk = null;
      }
      return { playing: true, kick, drop, energy: this.curSection ? this.curSection.energy : 0, section: this.curSection && this.curSection.name, track: this.shownTrack, trackAge: now - (this.trackShownAt || -99), talk };
    }

    // ---- offline render (tests / previews) -------------------------------------------------
    async renderOffline(seconds, sr = 44100) {
      const ctx = new OfflineAudioContext(2, Math.floor(sr * seconds), sr);
      this.build(ctx, false);
      await this.voxLoading;
      this.enabled = true;
      this.newTrack();
      this.nextTime = 0.05;
      this.scheduleUntil(seconds);
      return ctx.startRendering();
    }
  }

  ND.Music = Music;
  ND.makeTrack = makeTrack;
})();
