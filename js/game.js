'use strict';
(() => {
  const pl = planck;
  const V = (x, y) => new pl.Vec2(x, y);
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);
  let W = 0, H = 0, DPR = 1;

  // ---------------- 配置 ----------------
  const SLING = { x: 0, y: 3.3 };
  const MAX_DRAG = 2.0, MAX_SPEED = 24, GRAV = -10, DT = 1 / 60;
  const MAT = {
    wood: { density: 0.8, friction: 0.7, restitution: 0.05, hp: 6, score: 500, debris: ['#d99a52', '#b47331', '#ecc07d', '#8a5320'] },
    ice: { density: 0.7, friction: 0.1, restitution: 0.05, hp: 3, score: 400, debris: ['#e6f8ff', '#a6dcf7', '#ffffff', '#7cc4ea'] },
    stone: { density: 2.2, friction: 0.9, restitution: 0.02, hp: 22, score: 700, debris: ['#a3aab0', '#7d858c', '#c4c9cd', '#5f666c'] },
    tnt: { density: 0.8, friction: 0.6, restitution: 0.05, hp: 1.5, score: 1000, debris: ['#c46a2a', '#8a4416', '#d42020', '#333'] },
  };
  const BIRD = {
    red: { r: 0.42, d: 5, mult: { wood: 1, ice: 1, stone: 0.6 }, name: '红鸟', skill: '点击：战吼震退', feather: '#e3262d' },
    blue: { r: 0.3, d: 5, mult: { wood: 0.5, ice: 2.6, stone: 0.3 }, name: '蓝鸟', skill: '点击：一分为三', feather: '#4aa6e6' },
    yellow: { r: 0.46, d: 4.5, mult: { wood: 2.2, ice: 0.8, stone: 0.4 }, name: '黄鸟', skill: '点击：加速冲刺', feather: '#fbcf13' },
    black: { r: 0.55, d: 5.5, mult: { wood: 0.8, ice: 0.8, stone: 1.0 }, name: '炸弹鸟', skill: '点击：引爆', feather: '#2b2b2b' },
    white: { r: 0.58, d: 4, mult: { wood: 0.8, ice: 0.8, stone: 0.6 }, name: '白鸟', skill: '点击：投下炸弹蛋', feather: '#f2f2f2' },
    terence: { r: 0.9, d: 5, mult: { wood: 1.4, ice: 1.4, stone: 1.2 }, name: '大红鸟', skill: '点击：震天怒吼', feather: '#b3141e' },
  };
  const PIG = {
    small: { r: 0.38, hp: 1.0, score: 5000 },
    medium: { r: 0.52, hp: 1.8, score: 5000 },
    large: { r: 0.7, hp: 3.0, score: 5000 },
    helmet: { r: 0.54, hp: 4.5, score: 5000 },
    mustache: { r: 0.7, hp: 5.0, score: 7000 },
    king: { r: 0.88, hp: 9.0, score: 10000 },
  };
  const BIRD_BONUS = 10000;

  // ---------------- 存档 ----------------
  const Save = {
    d: { stars: {}, best: {}, unlocked: 1 },
    load() { try { const s = JSON.parse(localStorage.getItem('ab_save') || 'null'); if (s) this.d = Object.assign(this.d, s); } catch (e) { } },
    store() { try { localStorage.setItem('ab_save', JSON.stringify(this.d)); } catch (e) { } },
  };
  Save.load();

  let G = null;
  let paused = false;
  let screen = 'menu';

  function sfx(name, ...a) { if (G && G.demo) return; Sfx[name](...a); }

  // ---------------- 关卡加载 ----------------
  function loadLevel(idx, demo = false) {
    const level = LEVELS[idx];
    const world = new pl.World({ gravity: V(0, GRAV) });
    G = {
      idx, level, world, demo, ents: [], pigs: 0, score: 0, t: 0,
      queue: level.birds.map((type, i) => ({ type, x: -1.6 - i * 1.3, hop: Math.random() * 3 })),
      loaded: null, loading: null, phase: 'intro', introT: 0,
      parts: [], pops: [], trail: [], prevTrail: [], active: [], destroyQ: [], pendExpl: [], slow: [],
      cam: { x: 0, y: 0 }, zoom: 30, zoomT: 30, manual: false, shake: 0, settleT: 0, winT: 0,
      blockScoreTotal: 0, noDamage: true, aim: null, pouch: { x: SLING.x, y: SLING.y, vx: 0, vy: 0 },
      theme: Art.THEMES[level.theme] || Art.THEMES.day, focusX: null, bonusT: 0, seed: 1,
      minX: -8, maxX: 40, maxY: 12, lastLaunch: 0, demoT: 0, pigIdleT: 3,
    };
    world.on('pre-solve', onPreSolve);
    const ground = world.createBody({ type: 'static' });
    ground.createFixture(new pl.Edge(V(-200, 0), V(400, 0)), { friction: 0.9 });
    ground.setUserData({ kind: 'ground' });

    level.build(makeBuilder());
    // 预先稳定结构
    for (let i = 0; i < 90; i++) world.step(DT, 10, 6);
    G.destroyQ.length = 0;

    let maxX = 0, maxY = 0;
    for (const e of G.ents) {
      if (!e.body && e.kind !== 'terrain') continue;
      if (e.kind === 'terrain') { maxX = Math.max(maxX, e.maxX); maxY = Math.max(maxY, ...e.verts.map(v => v[1])); continue; }
      const p = e.body.getPosition();
      const ext = e.r || Math.max(e.dw || 0, e.dh || 0) / 2;
      maxX = Math.max(maxX, p.x + ext); maxY = Math.max(maxY, p.y + ext);
    }
    G.maxX = maxX + 5; G.maxY = Math.max(12, maxY + 4);
    G.minX = -4.5 - level.birds.length * 1.3;
    const pigScore = G.ents.filter(e => e.kind === 'pig').reduce((s, e) => s + PIG[e.type].score, 0);
    const nb = level.birds.length;
    G.t2 = Math.round((pigScore + G.blockScoreTotal * 0.45 + BIRD_BONUS * Math.floor(nb * 0.2)) / 1000) * 1000;
    G.t3 = Math.round((pigScore + G.blockScoreTotal * 0.75 + BIRD_BONUS * Math.max(1, Math.floor(nb * 0.4))) / 1000) * 1000;
    computeZoom(true);
    G.cam.x = camBounds().hi;
    G.cam.y = -1.5 + H / 2 / G.zoom;
    if (!demo) {
      updateHud();
      showTip(level.tip);
    }
    return G;
  }

  function makeBuilder() {
    const B = {
      box(mat, x, y, w, h, ang = 0) { return addBlock(mat, 'box', { w, h }, x, y + h / 2, ang); },
      col(mat, x, y, h, t = 0.3) { return B.box(mat, x, y, t, h); },
      plank(mat, x, y, w, t = 0.3) { return B.box(mat, x, y, w, t); },
      frame(mat, x, y, w, h, t = 0.3) {
        B.col(mat, x - w / 2 + t / 2, y, h, t); B.col(mat, x + w / 2 - t / 2, y, h, t);
        B.plank(mat, x, y + h, w, t); return y + h + t;
      },
      pig(type, x, y) { addPig(type, x, y + PIG[type].r + 0.01); },
      tnt(x, y) { addBlock('tnt', 'box', { w: 0.9, h: 0.9 }, x, y + 0.45, 0); },
      ball(mat, x, y, r) { const e = addBlock(mat, 'circle', { r }, x, y + r, 0); e.hp = e.maxHp = e.hp * 3; e.body.setAngularDamping(0.05); },
      tri(mat, x, y, w, h, kind = 'up') {
        const verts = kind === 'up' ? [[-w / 2, -h / 2], [w / 2, -h / 2], [0, h / 2]]
          : kind === 'r' ? [[-w / 2, -h / 2], [w / 2, -h / 2], [-w / 2, h / 2]]
            : [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2]];
        addBlock(mat, 'poly', { verts, w, h }, x, y + h / 2, 0);
      },
      terrain(verts) { addTerrain(verts); },
      hill(x0, x1, h) { addTerrain([[x0, 0], [x1, 0], [x1, h], [x0, h]]); },
    };
    return B;
  }

  function addBlock(mat, shape, dims, x, y, ang) {
    const M = MAT[mat];
    const body = G.world.createBody({ type: 'dynamic', position: V(x, y), angle: ang, angularDamping: 0.1 });
    let sh, area;
    if (shape === 'box') { sh = new pl.Box(dims.w / 2, dims.h / 2); area = dims.w * dims.h; }
    else if (shape === 'circle') { sh = new pl.Circle(dims.r); area = Math.PI * dims.r * dims.r; }
    else { sh = new pl.Polygon(dims.verts.map(v => V(v[0], v[1]))); area = dims.w * dims.h / 2; }
    body.createFixture(sh, { density: M.density, friction: M.friction, restitution: M.restitution });
    const hp = M.hp * Math.min(2.5, Math.max(0.6, 0.5 + area * 0.6));
    const e = Object.assign({ kind: 'block', mat, shape, body, hp, maxHp: hp, seed: (G.seed++ * 7919) ^ 0x5bd1e995, flash: 0, score: M.score }, dims);
    Art.makeDetails(e);
    body.setUserData(e);
    G.ents.push(e);
    G.blockScoreTotal += M.score;
    return e;
  }

  function addPig(type, x, y) {
    const P = PIG[type];
    const body = G.world.createBody({ type: 'dynamic', position: V(x, y), angularDamping: 1.2 });
    body.createFixture(new pl.Circle(P.r), { density: 0.8, friction: 0.6, restitution: 0.15 });
    const e = { kind: 'pig', type, r: P.r, body, hp: P.hp, maxHp: P.hp, blinkT: Math.random() * 3, squash: 0, flash: 0, hurtT: 0 };
    body.setUserData(e);
    G.ents.push(e);
    G.pigs++;
  }

  function addTerrain(verts) {
    const body = G.world.createBody({ type: 'static' });
    body.createFixture(new pl.Polygon(verts.map(v => V(v[0], v[1]))), { friction: 0.8 });
    const e = { kind: 'terrain', verts, minX: Math.min(...verts.map(v => v[0])), maxX: Math.max(...verts.map(v => v[0])), seed: G.seed++ * 31, body };
    body.setUserData(e);
    G.ents.push(e);
  }

  function spawnBird(type, x, y, vx, vy) {
    const B = BIRD[type];
    const body = G.world.createBody({ type: 'dynamic', position: V(x, y), bullet: true, angularDamping: 0.8 });
    body.createFixture(new pl.Circle(B.r), { density: B.d, friction: 0.6, restitution: 0.3, filterGroupIndex: -1 });
    body.setLinearVelocity(V(vx, vy));
    const e = { kind: 'bird', type, r: B.r, body, age: 0, still: 0, used: false, hitAny: false, fuse: -1, blinkT: 2, squash: 0 };
    body.setUserData(e);
    G.ents.push(e);
    G.active.push(e);
    return e;
  }

  // ---------------- 碰撞与伤害 ----------------
  function onPreSolve(contact) {
    const A = contact.getFixtureA().getBody(), B = contact.getFixtureB().getBody();
    const ea = A.getUserData(), eb = B.getUserData();
    if (!ea || !eb) return;
    if (ea.dead || eb.dead) { contact.setEnabled(false); return; }
    if (ea.kind === 'egg' || eb.kind === 'egg') {
      const egg = ea.kind === 'egg' ? ea : eb, other = egg === ea ? eb : ea;
      if (other.kind !== 'bird' && other.kind !== 'egg') {
        const p = egg.body.getPosition();
        egg.dead = true; G.destroyQ.push(egg);
        G.pendExpl.push({ x: p.x, y: p.y, R: 3.4, power: 15, dmg: 26, delay: 0, stoneMult: 1.2 });
        contact.setEnabled(false);
      }
      return;
    }
    const man = contact.getManifold();
    if (!man.pointCount) return;
    const wm = contact.getWorldManifold(null);
    if (!wm) return;
    const p = wm.points[0], n = wm.normal;
    const va = A.getLinearVelocityFromWorldPoint(p), vb = B.getLinearVelocityFromWorldPoint(p);
    const speed = -((vb.x - va.x) * n.x + (vb.y - va.y) * n.y);
    if (speed < 0.9) return;
    if (ea.kind === 'bird') birdHit(ea, speed);
    if (eb.kind === 'bird') birdHit(eb, speed);
    if (G.noDamage) return;
    const ma = A.isDynamic() ? A.getMass() : 0, mb = B.isDynamic() ? B.getMass() : 0;
    const meff = (ma && mb) ? ma * mb / (ma + mb) : (ma || mb);
    const imp = meff * (speed - 0.9);
    const ka = impact(ea, eb, imp, speed, p), kb = impact(eb, ea, imp, speed, p);
    if (ka && B.isDynamic()) { contact.setEnabled(false); G.slow.push([B, eb.kind === 'bird' ? 0.8 : 0.9]); }
    if (kb && A.isDynamic()) { contact.setEnabled(false); G.slow.push([A, ea.kind === 'bird' ? 0.8 : 0.9]); }
    if (speed > 4 && (ea.kind === 'ground' || eb.kind === 'ground' || ea.kind === 'terrain' || eb.kind === 'terrain')) dust(p.x, p.y, Math.min(6, speed / 2));
  }

  function birdHit(b, speed) {
    if (!b.hitAny) { b.hitAny = true; G.trailDone = true; }
    if (speed > 4) {
      b.squash = Math.min(0.25, speed / 60);
      if (speed > 7) feathers(b, Math.min(6, Math.floor(speed / 5)));
      if (b.type === 'black' && b.fuse < 0 && !b.used) b.fuse = 1.6;
    }
  }

  function impact(t, other, imp, speed, p) {
    if (t.kind !== 'block' && t.kind !== 'pig') return false;
    let mult = 1;
    if (other.kind === 'bird') {
      mult = t.kind === 'pig' ? 1.6 : (BIRD[other.type].mult[t.mat === 'tnt' ? 'wood' : t.mat] || 1);
    }
    const dmg = imp * mult;
    if (dmg < 0.05) return false;
    t.hp -= dmg;
    t.flash = Math.min(1, t.flash + dmg / t.maxHp * 1.5);
    const k = dmg / t.maxHp * 6;
    if (k > 0.3) sfx('hit', t.kind === 'pig' ? 'pig' : t.mat, k);
    if (t.kind === 'pig') { t.squash = Math.min(0.22, 0.05 + dmg / t.maxHp * 0.3); t.hurtT = 0.8; }
    if (t.kind === 'block' && dmg > t.maxHp * 0.15 && t.hp > 0) chips(t, p, 3);
    if (t.hp <= 0) { kill(t); return true; }
    return false;
  }

  function damageDirect(e, dmg) {
    if (e.dead || dmg <= 0) return;
    e.hp -= dmg; e.flash = 1;
    if (e.kind === 'pig') { e.squash = 0.2; e.hurtT = 1; }
    if (e.hp <= 0) kill(e);
  }

  function kill(e) {
    if (e.dead) return;
    e.dead = true;
    G.destroyQ.push(e);
    const p = e.body.getPosition();
    if (e.kind === 'pig') {
      G.pigs--;
      addScore(PIG[e.type].score, p.x, p.y + e.r, '#7be04a', 1.3);
      pigPoof(e);
      sfx('pigPop');
    } else if (e.kind === 'block') {
      addScore(e.score, p.x, p.y, e.mat === 'ice' ? '#bfeaff' : e.mat === 'stone' ? '#e0e4e8' : '#ffd38a', 0.9);
      debris(e);
      sfx('breakMat', e.mat);
      if (e.mat === 'tnt') G.pendExpl.push({ x: p.x, y: p.y, R: 3.1, power: 12, dmg: 12, delay: 0.07, stoneMult: 1 });
    }
  }

  function addScore(v, x, y, color, size = 1) {
    if (G.demo) return;
    G.score += v;
    G.pops.push({ x, y, text: String(v), color, t: 0, life: 1.3, size });
    updateHud();
  }

  function explode(x, y, R, power, dmg, src, stoneMult = 1) {
    for (const e of G.ents) {
      if (e.dead || !e.body || e === src) continue;
      if (e.kind !== 'block' && e.kind !== 'pig' && e.kind !== 'bird') continue;
      const c = e.body.getWorldCenter();
      let dx = c.x - x, dy = c.y - y;
      const d = Math.hypot(dx, dy);
      const ext = e.r || Math.max(e.dw || 0, e.dh || 0) / 2 || 0.5;
      const dd = Math.max(0, d - ext * 0.5);
      if (dd > R) continue;
      const f = 1 - dd / R;
      if (d < 1e-3) { dx = 0; dy = 1; } else { dx /= d; dy /= d; }
      const m = e.body.getMass();
      const J = power * f * Math.sqrt(m);
      e.body.applyLinearImpulse(V(dx * J, dy * J + J * 0.35), c, true);
      e.body.applyAngularImpulse((Math.random() - 0.5) * J * 0.4 * Math.max(0.2, ext), true);
      if (e.kind !== 'bird') damageDirect(e, dmg * f * (e.mat === 'stone' ? stoneMult : 1));
    }
    G.shake = Math.max(G.shake, 0.5 + R * 0.12);
    boom(x, y, R);
    sfx('explode');
  }

  // ---------------- 小鸟技能 ----------------
  function useAbility() {
    const b = G.active.find(a => a.kind === 'bird' && !a.dead && !a.used);
    if (!b) return false;
    if (b.type !== 'black' && b.type !== 'red' && b.type !== 'terence' && b.hitAny) return false;
    b.used = true;
    const v = b.body.getLinearVelocity(), p = b.body.getPosition();
    const sp = Math.hypot(v.x, v.y) || 1;
    sfx('ability', b.type);
    switch (b.type) {
      case 'blue': {
        for (const da of [-0.2, 0.2]) {
          const c = Math.cos(da), s = Math.sin(da);
          const nx = -v.y / sp, ny = v.x / sp;
          const nb = spawnBird('blue', p.x + nx * da * 3, p.y + ny * da * 3, v.x * c - v.y * s, v.x * s + v.y * c);
          nb.used = true;
        }
        ring(p.x, p.y, 1.2, '#bfe6ff');
        feathers(b, 6);
        break;
      }
      case 'yellow': {
        const ns = Math.max(sp * 2.0, 28);
        b.body.setLinearVelocity(V(v.x / sp * ns, v.y / sp * ns));
        b.boost = 0.6;
        ring(p.x, p.y, 1.0, '#fff3a0');
        break;
      }
      case 'black':
        detonate(b);
        break;
      case 'white': {
        const egg = { kind: 'egg', r: 0.32 };
        const body = G.world.createBody({ type: 'dynamic', position: V(p.x, p.y - 0.8), bullet: true });
        body.createFixture(new pl.Circle(0.32), { density: 6, friction: 0.5, restitution: 0.1, filterGroupIndex: -1 });
        body.setLinearVelocity(V(0, -26));
        egg.body = body; body.setUserData(egg);
        G.ents.push(egg); G.active.push(egg);
        b.body.setLinearVelocity(V(v.x * 1.15 + 5, 15));
        b.laid = true;
        feathers(b, 8);
        smoke(p.x, p.y - 0.3, 6, 'rgba(255,255,255,0.9)', 0.6);
        break;
      }
      case 'red':
      case 'terence': {
        const big = b.type === 'terence';
        const R = big ? 5 : 3.5;
        for (const e of G.ents) {
          if (e.dead || !e.body || (e.kind !== 'block' && e.kind !== 'pig')) continue;
          const c = e.body.getWorldCenter();
          const dx = c.x - p.x, dy = c.y - p.y, d = Math.hypot(dx, dy);
          if (d > R || d < 1e-3) continue;
          const J = (big ? 9 : 5) * (1 - d / R) * Math.sqrt(e.body.getMass());
          e.body.applyLinearImpulse(V(dx / d * J, dy / d * J + J * 0.2), c, true);
          if (big) damageDirect(e, 2.5 * (1 - d / R));
        }
        ring(p.x, p.y, R, 'rgba(255,255,255,0.9)');
        ring(p.x, p.y, R * 0.7, 'rgba(255,120,100,0.8)');
        G.shake = Math.max(G.shake, big ? 0.6 : 0.25);
        break;
      }
    }
    return true;
  }

  function detonate(b) {
    const p = b.body.getPosition();
    b.used = true; b.dead = true; G.destroyQ.push(b);
    G.pendExpl.push({ x: p.x, y: p.y, R: 3.8, power: 18, dmg: 32, delay: 0, stoneMult: 1.5, src: b });
  }

  // ---------------- 粒子 ----------------
  const rnd = (a, b) => a + Math.random() * (b - a);
  function part(o) { if (G.parts.length < 900) G.parts.push(Object.assign({ t: 0, rot: 0, vr: 0, g: -9, drag: 0.5 }, o)); }

  function debris(e) {
    const p = e.body.getPosition(), a = e.body.getAngle(), v = e.body.getLinearVelocity();
    const cols = MAT[e.mat].debris;
    const area = e.dw * e.dh;
    const n = Math.max(6, Math.min(22, Math.round(area * 14)));
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let i = 0; i < n; i++) {
      const lx = rnd(-0.5, 0.5) * e.dw, ly = rnd(-0.5, 0.5) * e.dh;
      const x = p.x + lx * ca - ly * sa, y = p.y + lx * sa + ly * ca;
      const long = e.mat === 'wood' ? rnd(1.5, 3) : 1;
      part({ type: 'shard', x, y, vx: v.x * 0.4 + rnd(-3, 3), vy: v.y * 0.4 + rnd(0, 5), rot: rnd(0, 6), vr: rnd(-12, 12), life: rnd(0.9, 1.8), s: rnd(0.07, 0.2), long, color: cols[i % cols.length], g: -14, alpha: e.mat === 'ice' ? 0.85 : 1 });
    }
    smoke(p.x, p.y, Math.round(n / 3), e.mat === 'stone' ? 'rgba(170,170,170,0.7)' : e.mat === 'ice' ? 'rgba(230,248,255,0.8)' : 'rgba(210,180,140,0.6)', 0.5);
  }
  function chips(e, p, n) {
    const cols = MAT[e.mat].debris;
    for (let i = 0; i < n; i++) part({ type: 'shard', x: p.x, y: p.y, vx: rnd(-3, 3), vy: rnd(0, 4), rot: rnd(0, 6), vr: rnd(-10, 10), life: rnd(0.5, 1), s: rnd(0.05, 0.1), long: 1, color: cols[i % cols.length], g: -14, alpha: 1 });
  }
  function smoke(x, y, n, color, size = 0.6) {
    for (let i = 0; i < n; i++) part({ type: 'smoke', x: x + rnd(-0.3, 0.3), y: y + rnd(-0.3, 0.3), vx: rnd(-1.5, 1.5), vy: rnd(-0.5, 1.5), life: rnd(0.6, 1.1), s: size * rnd(0.6, 1.2), grow: rnd(0.8, 1.6), color, g: 0.5, drag: 2 });
  }
  function dust(x, y, n) {
    if (G.noDamage) return;
    for (let i = 0; i < n; i++) part({ type: 'smoke', x: x + rnd(-0.3, 0.3), y: y + 0.1, vx: rnd(-2, 2), vy: rnd(0.2, 1.2), life: rnd(0.4, 0.8), s: rnd(0.15, 0.3), grow: 1.2, color: 'rgba(190,160,120,0.6)', g: 0, drag: 3 });
  }
  function feathers(b, n) {
    const p = b.body.getPosition();
    const c = BIRD[b.type].feather;
    for (let i = 0; i < n; i++) part({ type: 'feather', x: p.x + rnd(-0.3, 0.3), y: p.y + rnd(-0.3, 0.3), vx: rnd(-3, 3), vy: rnd(0, 4), rot: rnd(0, 6), vr: rnd(-6, 6), life: rnd(1.2, 2.2), s: b.r * rnd(0.35, 0.6), color: c, g: -2.5, drag: 2.5, sway: rnd(0, 6) });
  }
  function pigPoof(e) {
    const p = e.body.getPosition();
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2;
      part({ type: 'smoke', x: p.x + Math.cos(a) * e.r * 0.5, y: p.y + Math.sin(a) * e.r * 0.5, vx: Math.cos(a) * rnd(2, 4), vy: Math.sin(a) * rnd(2, 4), life: rnd(0.5, 0.9), s: e.r * rnd(0.5, 0.8), grow: 1.3, color: i % 3 ? 'rgba(255,255,255,0.95)' : 'rgba(170,230,120,0.95)', g: 0, drag: 4 });
    }
    ring(p.x, p.y, e.r * 2.2, 'rgba(255,255,255,0.8)');
  }
  function ring(x, y, R, color) { part({ type: 'ring', x, y, vx: 0, vy: 0, life: 0.45, s: R, color, g: 0 }); }
  function boom(x, y, R) {
    part({ type: 'flash', x, y, vx: 0, vy: 0, life: 0.3, s: R * 0.9, g: 0 });
    ring(x, y, R * 1.1, 'rgba(255,240,200,0.9)');
    for (let i = 0; i < 18; i++) {
      const a = rnd(0, Math.PI * 2), sp = rnd(2, 8);
      part({ type: 'fire', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(0.35, 0.7), s: rnd(0.4, 0.9), grow: 1.4, g: 2, drag: 3 });
    }
    for (let i = 0; i < 14; i++) {
      const a = rnd(0, Math.PI * 2), sp = rnd(1, 4);
      part({ type: 'smoke', x: x + Math.cos(a) * 0.5, y: y + Math.sin(a) * 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 1, life: rnd(1, 1.8), s: rnd(0.5, 1.0), grow: 1.8, color: 'rgba(70,65,60,0.7)', g: 1, drag: 2 });
    }
    for (let i = 0; i < 16; i++) {
      const a = rnd(0, Math.PI * 2), sp = rnd(6, 14);
      part({ type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(0.3, 0.7), s: 0.06, g: -10, drag: 1 });
    }
  }

  // ---------------- 主更新 ----------------
  function step() {
    G.t += DT;
    if (G.t > 0.35) G.noDamage = false;
    G.world.step(DT, 10, 6);

    for (const [body, k] of G.slow) {
      const u = body.getUserData();
      if (u && !u.dead) { const v = body.getLinearVelocity(); body.setLinearVelocity(V(v.x * k, v.y * k)); }
    }
    G.slow.length = 0;

    for (let i = G.pendExpl.length - 1; i >= 0; i--) {
      const ex = G.pendExpl[i];
      ex.delay -= DT;
      if (ex.delay <= 0) { G.pendExpl.splice(i, 1); explode(ex.x, ex.y, ex.R, ex.power, ex.dmg, ex.src, ex.stoneMult); }
    }

    // 掉出世界
    for (const e of G.ents) {
      if (e.dead || !e.body || (e.kind !== 'block' && e.kind !== 'pig')) continue;
      const p = e.body.getPosition();
      if (p.y < -6 || p.x < -40 || p.x > G.maxX + 60) kill(e);
    }

    // 小鸟
    for (const b of G.active) {
      if (b.dead) continue;
      b.age += DT;
      const p = b.body.getPosition(), v = b.body.getLinearVelocity();
      const sp = Math.hypot(v.x, v.y);
      if (b.kind === 'egg') {
        if (b.age > 4 || p.y < -3) { b.dead = true; G.destroyQ.push(b); }
        continue;
      }
      if (!G.trailDone && b === G.active[0] && b.age - (b.lastTrail || 0) > 0.035) {
        b.lastTrail = b.age;
        G.trail.push({ x: p.x, y: p.y, s: (G.trail.length % 3 === 0) ? 0.16 : 0.09 });
      }
      if (b.boost > 0) {
        b.boost -= DT;
        part({ type: 'streak', x: p.x, y: p.y, vx: 0, vy: 0, life: 0.25, s: b.r, ang: Math.atan2(v.y, v.x), g: 0 });
      }
      if (b.fuse > 0) {
        b.fuse -= DT;
        if (b.fuse <= 0 && !b.used) { detonate(b); continue; }
      }
      b.still = sp < 0.35 ? b.still + DT : 0;
      if (b.hitAny) b.hitT = (b.hitT || 0) + DT;
      const out = p.x < -20 || p.x > G.maxX + 25 || p.y < -4;
      const rollingBack = b.hitT > 1.2 && v.x < -0.5 && p.x < 8;
      if (b.still > 1.0 || out || b.age > 12 || b.hitT > 6 || rollingBack) retire(b);
    }

    // 销毁
    if (G.destroyQ.length) {
      for (const e of G.destroyQ) if (e.body) { G.world.destroyBody(e.body); e.body = null; }
      G.destroyQ.length = 0;
      G.ents = G.ents.filter(e => !e.dead);
    }
    G.active = G.active.filter(b => !b.dead);

    updatePhase(DT);
  }

  function retire(b) {
    if (b.dead) return;
    if (b.type === 'black' && !b.used) { detonate(b); return; }
    b.dead = true; G.destroyQ.push(b);
    feathers(b, 8);
    smoke(b.body.getPosition().x, b.body.getPosition().y, 6, 'rgba(255,255,255,0.9)', b.r * 1.2);
    sfx('poof');
  }

  function worldQuiet() {
    for (const e of G.ents) {
      if (!e.body || (e.kind !== 'block' && e.kind !== 'pig')) continue;
      if (!e.body.isAwake()) continue;
      const v = e.body.getLinearVelocity();
      if (Math.hypot(v.x, v.y) > 0.25 || Math.abs(e.body.getAngularVelocity()) > 0.4) return false;
    }
    return true;
  }

  function updatePhase(dt) {
    // 胜利判定
    if (G.pigs <= 0 && G.phase !== 'bonus' && G.phase !== 'won' && G.phase !== 'lost') {
      G.winT += dt;
      if (G.winT > 1.6 && (G.active.length === 0 || G.winT > 4)) {
        if (G.demo) { G.phase = 'won'; G.demoEnd = 1.5; return; }
        G.phase = 'bonus'; G.bonusT = 0.6; G.aim = null;
        if (G.loaded) { G.queue.unshift({ type: G.loaded, x: SLING.x, y: SLING.y, onSling: true }); G.loaded = null; }
      }
    }
    switch (G.phase) {
      case 'intro':
        G.introT += dt;
        if (G.introT > 2.2) G.phase = 'load';
        break;
      case 'load':
        if (!G.queue.length && !G.loading) { G.phase = 'settle'; G.settleT = 0; break; }
        if (!G.loading) {
          const q = G.queue.shift();
          G.loading = { type: q.type, t: 0, fx: q.x, fy: BIRD[q.type].r };
          G.manual = false;
        }
        G.loading.t += dt / 0.55;
        if (G.loading.t >= 1) {
          G.loaded = G.loading.type; G.loading = null; G.phase = 'ready';
          sfx('squawk', G.loaded);
          if (!G.demo) updateHud();
        }
        break;
      case 'ready':
        if (G.demo) {
          G.demoT += dt;
          if (G.demoT > 1.3) { G.demoT = 0; demoShot(); }
        }
        break;
      case 'flying':
        if (!G.active.length) { G.phase = 'settle'; G.settleT = 0; }
        break;
      case 'settle':
        G.settleT += dt;
        if (G.pigs <= 0) break;
        if ((G.settleT > 0.8 && worldQuiet()) || G.settleT > 4.5) {
          if (G.queue.length) G.phase = 'load';
          else {
            G.phase = 'lost';
            if (G.demo) { G.demoEnd = 1.5; break; }
            sfx('lose');
            setTimeout(() => showResult(false), 900);
          }
        }
        break;
      case 'bonus':
        G.bonusT -= dt;
        if (G.bonusT <= 0) {
          if (G.queue.length) {
            const q = G.queue.shift();
            const x = q.onSling ? SLING.x : q.x, y = q.onSling ? SLING.y : BIRD[q.type].r;
            G.score += BIRD_BONUS;
            G.pops.push({ x, y: y + 0.8, text: String(BIRD_BONUS), color: '#ffe14d', t: 0, life: 1.6, size: 1.4 });
            for (let i = 0; i < 10; i++) part({ type: 'feather', x, y, vx: rnd(-3, 3), vy: rnd(0, 4), rot: rnd(0, 6), vr: rnd(-6, 6), life: rnd(1.2, 2), s: 0.2, color: BIRD[q.type].feather, g: -2.5, drag: 2.5, sway: rnd(0, 6) });
            sfx('bonus');
            updateHud();
            G.bonusT = 0.5;
          } else {
            G.phase = 'won';
            sfx('win');
            setTimeout(() => showResult(true), 500);
          }
        }
        break;
    }
    if (G.demo && G.demoEnd !== undefined) {
      G.demoEnd -= dt;
      if (G.demoEnd <= 0) startDemo();
    }
  }

  // ---------------- 发射 ----------------
  function launch(dx, dy) {
    const len = Math.hypot(dx, dy);
    const k = MAX_SPEED / MAX_DRAG;
    const type = G.loaded;
    G.loaded = null;
    G.prevTrail = G.trail; G.trail = []; G.trailDone = false;
    const b = spawnBird(type, SLING.x + dx, SLING.y + dy, -dx * k, -dy * k);
    G.phase = 'flying';
    G.manual = false;
    G.pouch.x = SLING.x + dx; G.pouch.y = SLING.y + dy;
    G.pouch.vx = -dx * 18; G.pouch.vy = -dy * 18;
    sfx('launch'); sfx('squawk', type);
    if (!G.demo) updateHud();
    return b;
  }

  function demoShot() {
    const pigs = G.ents.filter(e => e.kind === 'pig');
    const target = pigs[Math.floor(Math.random() * pigs.length)];
    if (!target) return;
    const tp = target.body.getPosition();
    // 求一个能命中目标的发射角
    const dx = tp.x - SLING.x, dy = tp.y - SLING.y;
    const g = -GRAV;
    for (let tries = 0; tries < 40; tries++) {
      const ang = rnd(0.2, 0.95);
      const c = Math.cos(ang), t = Math.tan(ang);
      const den = 2 * c * c * (dx * t - dy);
      if (den <= 0) continue;
      const v = Math.sqrt(g * dx * dx / den) * rnd(0.98, 1.04);
      if (v > MAX_SPEED) continue;
      const d = v / MAX_SPEED * MAX_DRAG;
      launch(-Math.cos(ang) * d, -Math.sin(ang) * d);
      return;
    }
    launch(-1.7, -1.0);
  }

  // ---------------- 相机 ----------------
  function computeZoom(reset) {
    if (!G) return;
    const fit = Math.min(W / (G.maxX - G.minX), H / (G.maxY + 1.8));
    G.fitZoom = fit;
    G.baseZoom = Math.max(fit, Math.min(H / 20, W / 26));
    if (reset || !(G.userZoom > 0)) G.userZoom = 1;
    G.zoomT = Math.min(Math.max(G.baseZoom * G.userZoom, fit), H / 8);
    G.userZoom = G.zoomT / G.baseZoom;
    if (reset) G.zoom = G.zoomT;
    if (!(G.zoom > 0) || !isFinite(G.zoom)) G.zoom = G.zoomT;
    if (!isFinite(G.cam.x) || !isFinite(G.cam.y)) { G.cam.x = camBounds().lo; G.cam.y = -1.5 + H / 2 / G.zoom; }
  }
  function camBounds() {
    const halfW = W / 2 / G.zoom;
    let lo = G.minX + halfW, hi = G.maxX - halfW;
    if (lo > hi) lo = hi = (G.minX + G.maxX) / 2;
    return { lo, hi };
  }
  function updateCamera(dt) {
    G.zoom += (G.zoomT - G.zoom) * Math.min(1, dt * 8);
    const { lo, hi } = camBounds();
    const halfW = W / 2 / G.zoom, halfH = H / 2 / G.zoom;
    let tx = lo, ty = -1.5 + halfH, k = 3;
    const focus = G.active.find(b => !b.dead && b.body);
    if (G.manual) tx = G.cam.x;
    else if (G.phase === 'intro') { tx = G.introT < 1.0 ? hi : lo; k = 2; }
    else if (focus) {
      const p = focus.body.getPosition();
      tx = p.x + halfW * 0.2;
      G.focusX = tx;
      ty = Math.max(ty, p.y - halfH * 0.5);
      k = 4;
    } else if ((G.phase === 'settle' || G.phase === 'flying' || G.phase === 'lost') && G.focusX !== null) tx = G.focusX;
    else if (G.phase === 'bonus' || G.phase === 'won') tx = lo;
    tx = Math.min(hi, Math.max(lo, tx));
    G.cam.x += (tx - G.cam.x) * Math.min(1, dt * k);
    G.cam.y += (ty - G.cam.y) * Math.min(1, dt * 3);
    if (G.phase === 'load' || G.phase === 'ready') G.focusX = null;
  }

  // ---------------- 每帧更新（非物理） ----------------
  function updateVisual(dt) {
    for (const p of G.parts) {
      p.t += dt;
      p.vy += p.g * dt;
      p.vx *= 1 - Math.min(1, p.drag * dt);
      if (p.type === 'feather') { p.vy *= 1 - Math.min(1, 2 * dt); p.x += Math.sin(p.t * 4 + p.sway) * dt * 0.8; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.type === 'shard' && p.y < 0.05) { p.y = 0.05; p.vy *= -0.3; p.vx *= 0.7; p.vr *= 0.5; }
    }
    G.parts = G.parts.filter(p => p.t < p.life);
    for (const p of G.pops) p.t += dt;
    G.pops = G.pops.filter(p => p.t < p.life);
    for (const e of G.ents) {
      if (e.flash > 0) e.flash = Math.max(0, e.flash - dt * 4);
      if (e.squash) e.squash *= Math.pow(0.02, dt);
      if (e.hurtT > 0) e.hurtT -= dt;
      if (e.blinkT !== undefined) { e.blinkT -= dt; if (e.blinkT < -0.14) e.blinkT = rnd(1.5, 4.5); }
    }
    for (let i = 0; i < G.queue.length; i++) {
      const q = G.queue[i];
      if (q.onSling) continue;
      let tx = -1.7;
      for (let j = 0; j < i; j++) tx -= BIRD[G.queue[j].type].r * 2 + 0.45;
      tx -= BIRD[q.type].r;
      q.x += (tx - q.x) * Math.min(1, dt * 5);
      q.hop -= dt;
      if (q.hop < -0.4) q.hop = rnd(1.5, 4);
    }
    // 皮兜回弹
    const P = G.pouch;
    if (!G.aim) {
      const ax = (SLING.x - P.x) * 260 - P.vx * 9, ay = (SLING.y - P.y) * 260 - P.vy * 9;
      P.vx += ax * dt; P.vy += ay * dt;
      P.x += P.vx * dt; P.y += P.vy * dt;
    }
    G.shake *= Math.pow(0.03, dt);
    // 猪偶尔哼哼
    if (G.phase === 'ready') {
      G.pigIdleT -= dt;
      if (G.pigIdleT < 0) { G.pigIdleT = rnd(4, 9); sfx('pigOink'); }
    }
    updateCamera(dt);
  }

  // ---------------- 渲染 ----------------
  function worldTransform(sx = 0, sy = 0) {
    const z = G.zoom;
    ctx.setTransform(z * DPR, 0, 0, z * DPR, (W / 2 - G.cam.x * z + sx) * DPR, (H / 2 + G.cam.y * z + sy) * DPR);
  }

  function lookVec(e, tx, ty) {
    const p = e.body.getPosition(), a = e.body.getAngle();
    let dx = tx - p.x, dy = -(ty - p.y);
    const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const c = Math.cos(a), s = Math.sin(a);
    return { x: dx * c - dy * s, y: dx * s + dy * c };
  }

  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (!G) { ctx.fillStyle = '#7cc8f0'; ctx.fillRect(0, 0, W, H); return; }
    if (!isFinite(G.cam.x + G.cam.y + G.zoom) || G.zoom <= 0) { G.zoom = 0; computeZoom(); }
    const z = G.zoom;
    const shx = G.shake > 0.01 ? rnd(-1, 1) * G.shake * 10 : 0, shy = G.shake > 0.01 ? rnd(-1, 1) * G.shake * 10 : 0;
    const groundSY = H / 2 + G.cam.y * z;
    Art.drawBackground(ctx, W, H, G.cam.x, groundSY + shy, z, performance.now() / 1000, G.theme);
    if (G.level.theme === 'night') drawStars();
    worldTransform(shx, shy);
    const left = G.cam.x - W / 2 / z - 2, right = G.cam.x + W / 2 / z + 2;
    Art.drawGround(ctx, left, right, G.theme);
    for (const e of G.ents) if (e.kind === 'terrain') Art.drawTerrain(ctx, e);

    // 轨迹
    drawTrail(G.prevTrail, 0.45);
    drawTrail(G.trail, 0.95);

    // 弹弓后部
    const aimP = G.aim ? { x: SLING.x + G.aim.dx, y: SLING.y + G.aim.dy } : null;
    let pouch = aimP ? pouchPos(aimP) : { x: G.pouch.x - (G.loaded ? BIRD[G.loaded].r * 0.85 : 0), y: G.pouch.y };
    ctx.save(); ctx.translate(SLING.x, -0);
    Art.drawSlingBack(ctx, [pouch.x, -pouch.y]);
    ctx.restore();
    Art.drawPouch(ctx, [pouch.x, -pouch.y], aimP ? -Math.atan2(G.aim.dy, G.aim.dx) : 0);

    // 排队的小鸟
    const tnow = G.t;
    for (const q of G.queue) {
      const r = BIRD[q.type].r;
      let x = q.x, y = r;
      if (q.onSling) { x = SLING.x; y = SLING.y; }
      else if (q.hop < 0) y += Math.sin((-q.hop / 0.4) * Math.PI) * 0.35;
      drawBirdAt(q.type, x, y, 0, { look: { x: 1, y: 0 }, blink: (Math.sin(tnow * 1.3 + x) > 0.97) });
    }
    if (G.loading) {
      const L = G.loading, u = Math.min(1, L.t), e = u * u * (3 - 2 * u);
      const x = L.fx + (SLING.x - L.fx) * e, y = L.fy + (SLING.y - L.fy) * e + Math.sin(u * Math.PI) * 1.6;
      drawBirdAt(L.type, x, y, -u * Math.PI * 2, { look: { x: 1, y: 0 } });
    }

    // 物体
    for (const e of G.ents) {
      if (e.kind !== 'block' || !e.body) continue;
      const p = e.body.getPosition();
      if (p.x < left - 4 || p.x > right + 4) continue;
      ctx.save(); ctx.translate(p.x, -p.y); ctx.rotate(-e.body.getAngle());
      Art.drawBlock(ctx, e, tnow);
      ctx.restore();
    }
    const focus = G.active.find(b => b.kind === 'bird' && b.body);
    const fp = focus ? focus.body.getPosition() : (aimP || SLING);
    for (const e of G.ents) {
      if (e.kind !== 'pig' || !e.body) continue;
      const p = e.body.getPosition();
      const dist = Math.hypot(fp.x - p.x, fp.y - p.y);
      ctx.save(); ctx.translate(p.x, -p.y); ctx.rotate(-e.body.getAngle());
      Art.drawPig(ctx, e, e.r, {
        look: lookVec(e, fp.x, fp.y), blink: e.blinkT < 0 && e.hurtT <= 0, scared: (focus && dist < 5) || e.hurtT > 0,
        laugh: G.phase === 'lost', squash: e.squash, t: tnow,
      });
      if (e.flash > 0) { Art.circ(ctx, 0, 0, e.r); ctx.fillStyle = `rgba(255,255,255,${e.flash * 0.4})`; ctx.fill(); }
      ctx.restore();
    }
    for (const e of G.ents) {
      if (!e.body) continue;
      if (e.kind === 'egg') {
        const p = e.body.getPosition();
        ctx.save(); ctx.translate(p.x, -p.y); ctx.rotate(-e.body.getAngle()); Art.drawEgg(ctx, e.r); ctx.restore();
      } else if (e.kind === 'bird') {
        const p = e.body.getPosition(), v = e.body.getLinearVelocity();
        const sp = Math.hypot(v.x, v.y) || 1;
        drawBirdAt(e.type, p.x, p.y, e.body.getAngle(), {
          look: { x: v.x / sp, y: -v.y / sp }, blink: e.still > 0.5, squash: e.squash, armed: e.fuse > 0, t: tnow,
        });
      }
    }

    // 弹弓上的小鸟 + 前部
    if (G.loaded) {
      const bp = aimP || { x: G.pouch.x, y: G.pouch.y };
      drawBirdAt(G.loaded, bp.x, bp.y, 0, { look: { x: 1, y: 0 }, blink: !G.aim && Math.sin(tnow * 1.1) > 0.97 });
    }
    Art.drawSlingFront(ctx, [pouch.x, -pouch.y]);

    if (G.aim) drawAimGuide();
    drawParticles();

    // 分数弹出（屏幕空间）
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    for (const p of G.pops) {
      const sx = (p.x - G.cam.x) * z + W / 2, sy = H / 2 - (p.y - G.cam.y) * z - p.t * 40;
      const a = p.t < p.life * 0.7 ? 1 : 1 - (p.t - p.life * 0.7) / (p.life * 0.3);
      const sc = Math.min(1, p.t * 8) * p.size;
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = `900 ${Math.round(22 * sc)}px "Arial Black", "Microsoft YaHei", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(40,20,0,0.85)'; ctx.strokeText(p.text, sx, sy);
      ctx.fillStyle = p.color; ctx.fillText(p.text, sx, sy);
    }
    ctx.globalAlpha = 1;
  }

  let starField = null;
  function drawStars() {
    if (!starField) { const R = Art.rng(42); starField = Array.from({ length: 90 }, () => [R(), R() * 0.55, R()]); }
    const t = performance.now() / 1000;
    for (const [x, y, s] of starField) {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2 + s * 20);
      ctx.fillStyle = '#fff'; ctx.fillRect(x * W, y * H, 1.5 + s, 1.5 + s);
    }
    ctx.globalAlpha = 1;
  }

  function pouchPos(bp) {
    const d = Math.hypot(G.aim.dx, G.aim.dy) || 1;
    const r = BIRD[G.loaded] ? BIRD[G.loaded].r : 0.4;
    return { x: bp.x + G.aim.dx / d * r * 0.8, y: bp.y + G.aim.dy / d * r * 0.8 };
  }

  function drawBirdAt(type, x, y, angle, o) {
    ctx.save(); ctx.translate(x, -y); ctx.rotate(-angle);
    Art.drawBird(ctx, type, BIRD[type].r, o);
    ctx.restore();
  }

  function drawTrail(tr, alpha) {
    if (!tr.length) return;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.strokeStyle = `rgba(0,0,0,${alpha * 0.15})`; ctx.lineWidth = 0.03;
    for (const p of tr) { Art.circ(ctx, p.x, -p.y, p.s); ctx.fill(); ctx.stroke(); }
  }

  function drawAimGuide() {
    const { dx, dy } = G.aim;
    const k = MAX_SPEED / MAX_DRAG;
    let x = SLING.x + dx, y = SLING.y + dy, vx = -dx * k, vy = -dy * k;
    const power = Math.hypot(dx, dy) / MAX_DRAG;
    for (let i = 1; i <= 16; i++) {
      const t = i * 0.065;
      const px = x + vx * t, py = y + vy * t + 0.5 * GRAV * t * t;
      const a = (1 - i / 17) * 0.9;
      Art.circ(ctx, px, -py, 0.11 * (1 - i / 22));
      ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fill();
    }
    // 力度指示（拉满时变红）
    ctx.save(); ctx.translate(SLING.x, -SLING.y);
    ctx.beginPath(); ctx.arc(0, 0, MAX_DRAG + 0.25, Math.atan2(-dy, dx) - 0.35, Math.atan2(-dy, dx) + 0.35);
    ctx.lineCap = 'round'; ctx.lineWidth = 0.1; ctx.strokeStyle = `hsla(${120 - power * 120},90%,55%,${0.25 + power * 0.5})`; ctx.stroke();
    ctx.restore();
  }

  function drawParticles() {
    for (const p of G.parts) {
      const u = p.t / p.life;
      ctx.save(); ctx.translate(p.x, -p.y);
      switch (p.type) {
        case 'shard':
          ctx.rotate(p.rot); ctx.globalAlpha = (u > 0.7 ? (1 - u) / 0.3 : 1) * p.alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.moveTo(-p.s * p.long, -p.s * 0.5); ctx.lineTo(p.s * p.long, -p.s * 0.3); ctx.lineTo(p.s * 0.6 * p.long, p.s * 0.5); ctx.lineTo(-p.s * 0.8 * p.long, p.s * 0.4); ctx.closePath(); ctx.fill();
          ctx.lineWidth = 0.015; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.stroke();
          break;
        case 'smoke':
          ctx.globalAlpha = 1 - u;
          Art.circ(ctx, 0, 0, p.s * (1 + u * p.grow)); ctx.fillStyle = p.color; ctx.fill();
          break;
        case 'feather':
          ctx.rotate(p.rot + Math.sin(p.t * 5) * 0.5); ctx.globalAlpha = u > 0.7 ? (1 - u) / 0.3 : 1;
          Art.ell(ctx, 0, 0, p.s, p.s * 0.3); ctx.fillStyle = p.color; ctx.fill();
          ctx.lineWidth = 0.015; ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-p.s, 0); ctx.lineTo(p.s, 0); ctx.stroke();
          break;
        case 'ring':
          ctx.globalAlpha = 1 - u;
          Art.circ(ctx, 0, 0, p.s * (0.2 + u * 0.8)); ctx.lineWidth = 0.15 * (1 - u) + 0.02; ctx.strokeStyle = p.color; ctx.stroke();
          break;
        case 'flash': {
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.s * (0.6 + u));
          g.addColorStop(0, `rgba(255,255,230,${1 - u})`); g.addColorStop(0.4, `rgba(255,200,60,${0.9 * (1 - u)})`); g.addColorStop(1, 'rgba(255,100,0,0)');
          ctx.fillStyle = g; Art.circ(ctx, 0, 0, p.s * (0.6 + u)); ctx.fill();
          break;
        }
        case 'fire': {
          const r = p.s * (1 + u * p.grow);
          ctx.globalAlpha = 1 - u;
          Art.circ(ctx, 0, 0, r);
          ctx.fillStyle = u < 0.3 ? '#fff3a0' : u < 0.6 ? '#ff9a1f' : '#c0392b'; ctx.fill();
          break;
        }
        case 'spark':
          ctx.globalAlpha = 1 - u;
          ctx.strokeStyle = '#ffe680'; ctx.lineWidth = 0.06;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-p.vx * 0.03, p.vy * 0.03); ctx.stroke();
          break;
        case 'streak':
          ctx.globalAlpha = (1 - u) * 0.6;
          ctx.rotate(-p.ang);
          ctx.fillStyle = '#fff6b0';
          Art.ell(ctx, -p.s * 1.5, 0, p.s * 1.6, p.s * 0.5); ctx.fill();
          break;
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // ---------------- 输入 ----------------
  const pointers = new Map();
  let drag = null, pinch = null;
  function toWorld(sx, sy) { return { x: G.cam.x + (sx - W / 2) / G.zoom, y: G.cam.y - (sy - H / 2) / G.zoom }; }

  canvas.addEventListener('pointerdown', ev => {
    Sfx.init();
    if (!G || G.demo || paused || screen !== 'play') return;
    canvas.setPointerCapture(ev.pointerId);
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: G.userZoom };
      if (G.aim) G.aim = null;
      drag = null;
      return;
    }
    const w = toWorld(ev.clientX, ev.clientY);
    if (G.phase === 'intro') { G.introT = 2.2; return; }
    if (G.phase === 'ready' && G.loaded && Math.hypot(w.x - SLING.x, w.y - SLING.y) < 2.2) {
      G.aim = { dx: 0, dy: 0, ox: w.x - SLING.x, oy: w.y - SLING.y };
      G.manual = false;
      updateAim(w);
      return;
    }
    if (G.phase === 'flying' && useAbility()) return;
    drag = { sx: ev.clientX, cx: G.cam.x, moved: false };
  });
  canvas.addEventListener('pointermove', ev => {
    if (!G || G.demo || screen !== 'play') return;
    if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      G.userZoom = pinch.z * d / pinch.d; computeZoom(); G.manual = true;
      return;
    }
    if (G.aim) { updateAim(toWorld(ev.clientX, ev.clientY)); return; }
    if (drag) {
      const dx = ev.clientX - drag.sx;
      if (Math.abs(dx) > 4) drag.moved = true;
      if (drag.moved) {
        G.manual = true;
        const { lo, hi } = camBounds();
        G.cam.x = Math.min(hi, Math.max(lo, drag.cx - dx / G.zoom));
      }
    }
  });
  function endPointer(ev) {
    pointers.delete(ev.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!G || G.demo) return;
    if (G.aim) {
      const { dx, dy } = G.aim;
      G.aim = null;
      if (Math.hypot(dx, dy) > 0.4 && G.loaded && G.phase === 'ready') launch(dx, dy);
      else { G.pouch.x = SLING.x; G.pouch.y = SLING.y; }
    }
    drag = null;
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', ev => {
    if (!G || G.demo || screen !== 'play') return;
    ev.preventDefault();
    G.userZoom *= Math.exp(-ev.deltaY * 0.0012);
    computeZoom();
  }, { passive: false });

  function updateAim(w) {
    let dx = w.x - SLING.x - G.aim.ox * 0.3, dy = w.y - SLING.y - G.aim.oy * 0.3;
    // 不允许拉到弹弓前方太远
    const len = Math.hypot(dx, dy);
    if (len > MAX_DRAG) { dx = dx / len * MAX_DRAG; dy = dy / len * MAX_DRAG; }
    if (SLING.y + dy < 0.5) dy = 0.5 - SLING.y;
    const old = Math.hypot(G.aim.dx, G.aim.dy), nl = Math.hypot(dx, dy);
    if (Math.abs(nl - old) > 0.05) sfx('stretch', nl / MAX_DRAG);
    G.aim.dx = dx; G.aim.dy = dy;
  }

  window.addEventListener('keydown', ev => {
    if (screen !== 'play' || !G) return;
    if (ev.code === 'Space') { if (G.phase === 'flying') useAbility(); ev.preventDefault(); }
    else if (ev.code === 'KeyR') restart();
    else if (ev.code === 'Escape') togglePause();
  });

  // ---------------- UI ----------------
  function showOnly(id) {
    for (const s of ['menu', 'levels', 'pause', 'result']) $(s).classList.toggle('hidden', s !== id);
    $('hud').classList.toggle('hidden', !(id === null || id === 'pause' || id === 'result'));
  }

  function updateHud() {
    if (!G || G.demo) return;
    $('score').textContent = G.score.toLocaleString();
    $('best').textContent = '最高分 ' + (Save.d.best[G.idx] || 0).toLocaleString();
    $('lvName').textContent = `${G.idx + 1}. ${G.level.name}`;
    const t = G.loaded || (G.queue[0] && G.queue[0].type);
    $('birdHint').textContent = t ? `${BIRD[t].name} · ${BIRD[t].skill}` : '';
    $('birdsLeft').textContent = '剩余小鸟 ' + (G.queue.length + (G.loaded ? 1 : 0));
  }

  let tipTimer = null;
  function showTip(text) {
    const el = $('tip');
    el.textContent = text;
    el.classList.remove('hidden');
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => el.classList.add('hidden'), 5000);
  }

  function startLevel(i) {
    Sfx.init();
    paused = false;
    screen = 'play';
    loadLevel(i);
    showOnly(null);
  }
  function restart() { if (G && !G.demo) { sfx('click'); startLevel(G.idx); } }
  function togglePause() {
    if (screen !== 'play' || !G || G.phase === 'won' || G.phase === 'lost') return;
    paused = !paused;
    showOnly(paused ? 'pause' : null);
  }

  function showResult(win) {
    if (!G || G.demo || screen !== 'play') return;
    const i = G.idx;
    let stars = 0;
    if (win) {
      stars = G.score >= G.t3 ? 3 : G.score >= G.t2 ? 2 : 1;
      Save.d.stars[i] = Math.max(Save.d.stars[i] || 0, stars);
      Save.d.unlocked = Math.max(Save.d.unlocked, Math.min(LEVELS.length, i + 2));
    }
    const prevBest = Save.d.best[i] || 0;
    if (win && G.score > prevBest) Save.d.best[i] = G.score;
    Save.store();
    $('resTitle').textContent = win ? (i === LEVELS.length - 1 ? '猪王被打败了！' : '关卡完成！') : '关卡失败…';
    $('resScore').textContent = G.score.toLocaleString();
    $('resBest').textContent = win && G.score > prevBest ? '新纪录！' : '最高分 ' + Math.max(prevBest, 0).toLocaleString();
    $('resBest').classList.toggle('record', win && G.score > prevBest);
    $('btnNext').classList.toggle('hidden', !win || i >= LEVELS.length - 1);
    $('result').classList.toggle('lose', !win);
    const st = document.querySelectorAll('#result .star');
    st.forEach(s => s.classList.remove('on'));
    showOnly('result');
    for (let k = 0; k < stars; k++) setTimeout(() => { st[k].classList.add('on'); Sfx.star(k); }, 450 + k * 400);
  }

  function buildLevelGrid() {
    const grid = $('levelGrid');
    grid.innerHTML = '';
    LEVELS.forEach((lv, i) => {
      const b = document.createElement('button');
      const locked = i + 1 > Save.d.unlocked;
      b.className = 'lvbtn' + (locked ? ' locked' : '') + ' theme-' + lv.theme;
      const s = Save.d.stars[i] || 0;
      b.innerHTML = locked ? '<span class="lock"></span>' :
        `<span class="num">${i + 1}</span><span class="lvn">${lv.name}</span><span class="mini">${[0, 1, 2].map(k => `<i class="${k < s ? 'on' : ''}"></i>`).join('')}</span>`;
      if (!locked) b.onclick = () => { Sfx.click(); startLevel(i); };
      grid.appendChild(b);
    });
    const total = Object.values(Save.d.stars).reduce((a, b) => a + b, 0);
    $('totalStars').textContent = `★ ${total} / ${LEVELS.length * 3}`;
  }

  function startDemo() {
    loadLevel(Math.floor(Math.random() * LEVELS.length), true);
    G.introT = 2.2;
  }

  function goMenu() {
    screen = 'menu'; paused = false;
    startDemo();
    showOnly('menu');
  }
  function goLevels() {
    screen = 'levels'; paused = false;
    if (!G || !G.demo) startDemo();
    buildLevelGrid();
    showOnly('levels');
  }

  function syncSoundButtons() {
    document.querySelectorAll('.btnSound').forEach(b => b.classList.toggle('off', Sfx.muted));
    document.querySelectorAll('.btnMusic').forEach(b => b.classList.toggle('off', !Sfx.musicOn));
  }

  $('btnPlay').onclick = () => { Sfx.init(); Sfx.click(); goLevels(); };
  $('btnBack').onclick = () => { Sfx.click(); goMenu(); };
  $('btnPause').onclick = () => { Sfx.click(); togglePause(); };
  $('btnRestart').onclick = () => restart();
  $('btnResume').onclick = () => { Sfx.click(); togglePause(); };
  $('btnPRestart').onclick = () => restart();
  $('btnPLevels').onclick = () => { Sfx.click(); goLevels(); };
  $('btnRLevels').onclick = () => { Sfx.click(); goLevels(); };
  $('btnRRetry').onclick = () => restart();
  $('btnNext').onclick = () => { Sfx.click(); startLevel(Math.min(LEVELS.length - 1, G.idx + 1)); };
  document.querySelectorAll('.btnSound').forEach(b => b.onclick = () => { Sfx.init(); Sfx.toggleMute(); syncSoundButtons(); });
  document.querySelectorAll('.btnMusic').forEach(b => b.onclick = () => { Sfx.init(); Sfx.toggleMusic(); syncSoundButtons(); });
  syncSoundButtons();

  // ---------------- 主循环 ----------------
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(320, window.innerWidth); H = Math.max(200, window.innerHeight);
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    if (G) computeZoom();
  }
  window.addEventListener('resize', resize);
  resize();

  let last = performance.now(), acc = 0;
  function frame(now) {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    if (G && !paused) {
      acc += dt;
      let n = 0;
      while (acc >= DT && n < 4) { step(); acc -= DT; n++; }
      if (n === 4) acc = 0;
      updateVisual(dt);
    }
    render();
    requestAnimationFrame(frame);
  }

  goMenu();
  requestAnimationFrame(frame);

  // 调试用
  window.__AB = {
    get G() { return G; }, startLevel, LEVELS, useAbility,
    launch: (dx, dy) => { if (G && G.phase === 'ready') launch(dx, dy); },
    aimAt(x, y, hi) {
      const dx = x - SLING.x, dy = y - SLING.y, g = -GRAV;
      for (let a = hi ? 1.2 : 0.05; hi ? a > 0.05 : a < 1.3; a += hi ? -0.005 : 0.005) {
        const c = Math.cos(a), den = 2 * c * c * (dx * Math.tan(a) - dy);
        if (den <= 0) continue;
        const v = Math.sqrt(g * dx * dx / den);
        if (v > MAX_SPEED) continue;
        const d = v / MAX_SPEED * MAX_DRAG;
        launch(-Math.cos(a) * d, -Math.sin(a) * d);
        return { a, v };
      }
    },
    bot(idx, seedShots) {
      startLevel(idx); this.tick(3.5);
      const log = [];
      let guard = 0;
      while (guard++ < 12) {
        let w = 0;
        while (G.phase !== 'ready' && G.phase !== 'won' && G.phase !== 'lost' && w++ < 1200) { step(); updateVisual(DT); }
        if (G.phase !== 'ready') break;
        const pigs = G.ents.filter(e => e.kind === 'pig');
        const tg = pigs[Math.floor(Math.random() * pigs.length)];
        const p = tg.body.getPosition();
        const type = G.loaded;
        const hi = Math.random() < 0.35;
        this.aimAt(p.x + (Math.random() - 0.5) * 1.5, p.y + (Math.random() - 0.3), hi);
        const trig = { blue: 7, yellow: 9, white: 0.3, red: 0, terence: 1, black: 0.5 }[type];
        let used = false;
        for (let i = 0; i < 60 * 14 && G.phase === 'flying'; i++) {
          step(); updateVisual(DT);
          const b = G.active[0];
          if (!used && b && b.body && b.kind === 'bird' && b.body.getPosition().x > p.x - trig) { useAbility(); used = true; }
        }
        log.push(type + (hi ? '^' : '') + ':' + G.pigs);
      }
      let w = 0;
      while (G.phase !== 'won' && G.phase !== 'lost' && w++ < 1500) { step(); updateVisual(DT); }
      render();
      return { idx, phase: G.phase, score: G.score, t2: G.t2, t3: G.t3, log: log.join(' ') };
    },
    view(x, y, z) { G.manual = true; G.zoom = G.zoomT = z; G.cam.x = x; G.cam.y = y; render(); },
    tick(sec) { for (let i = 0; i < sec * 60; i++) { if (paused) break; step(); updateVisual(DT); } render(); },
  };
})();
