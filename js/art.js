'use strict';
// 所有美术绘制：小鸟、猪、材质方块、地形、弹弓、背景。
// 约定：世界坐标单位为米，绘制时 y 轴向下（世界 y 取负）。
const Art = (() => {
  const TAU = Math.PI * 2;

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function ell(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); }
  function circ(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ================= 小鸟 =================
  function eye(ctx, x, y, rx, ry, o, lidColor) {
    ell(ctx, x, y, rx, ry);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 0.05; ctx.strokeStyle = '#1b1b1b'; ctx.stroke();
    if (o.blink) {
      ell(ctx, x, y, rx * 1.05, ry * 1.05); ctx.fillStyle = lidColor; ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - rx, y + ry * 0.1); ctx.quadraticCurveTo(x, y + ry * 0.6, x + rx, y + ry * 0.1);
      ctx.stroke();
      return;
    }
    const lx = (o.look ? o.look.x : 1) * rx * 0.38, ly = (o.look ? o.look.y : 0) * ry * 0.38;
    const pr = o.scared ? rx * 0.3 : rx * 0.46;
    circ(ctx, x + lx, y + ly, pr); ctx.fillStyle = '#111'; ctx.fill();
    circ(ctx, x + lx - pr * 0.35, y + ly - pr * 0.4, pr * 0.32); ctx.fillStyle = '#fff'; ctx.fill();
  }

  function tailFeathers(ctx, x, y, color, n, len, spread) {
    ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const a = Math.PI + (i - (n - 1) / 2) * spread;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(0, -0.06);
      ctx.quadraticCurveTo(len * 0.6, -0.16, len, 0);
      ctx.quadraticCurveTo(len * 0.6, 0.16, 0, 0.06);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  function beak(ctx, x, y, len, h, upper = '#fbb81d', lower = '#e2860d', line = '#7a4a00') {
    ctx.lineWidth = 0.04; ctx.strokeStyle = line;
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.55); ctx.quadraticCurveTo(x + len * 0.55, y + h * 0.55, x + len * 0.85, y + h * 0.62);
    ctx.quadraticCurveTo(x + len * 0.55, y + h * 1.25, x + 0.02, y + h * 1.05); ctx.closePath();
    ctx.fillStyle = lower; ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.quadraticCurveTo(x + len * 0.6, y - h * 0.15, x + len, y + h * 0.55);
    ctx.quadraticCurveTo(x + len * 0.6, y + h * 0.75, x, y + h * 0.7); ctx.closePath();
    ctx.fillStyle = upper; ctx.fill(); ctx.stroke();
    ell(ctx, x + len * 0.35, y + h * 0.18, len * 0.18, h * 0.08, -0.1); ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill();
  }

  function brows(ctx, pts, color = '#141414') {
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  }

  function bodyGrad(ctx, c0, c1, c2, r = 1.05) {
    const g = ctx.createRadialGradient(-0.35, -0.45, 0.08, 0, 0, r);
    g.addColorStop(0, c0); g.addColorStop(0.55, c1); g.addColorStop(1, c2);
    return g;
  }

  function roundBird(ctx, o, P) {
    // 尾羽
    tailFeathers(ctx, -0.82, 0.08, P.tail, 3, P.tailLen || 0.5, 0.42);
    // 冠羽
    ctx.lineWidth = 0.05; ctx.strokeStyle = P.line;
    for (const f of P.crest) {
      ctx.save(); ctx.translate(f[0], f[1]); ctx.rotate(f[2]);
      ell(ctx, 0, -f[3], f[4], f[3]); ctx.fillStyle = f[5] || P.main; ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    // 身体
    circ(ctx, 0, 0, 1); ctx.fillStyle = bodyGrad(ctx, P.light, P.main, P.dark); ctx.fill();
    ctx.save(); circ(ctx, 0, 0, 1); ctx.clip();
    ell(ctx, 0.12, 0.78, 0.8, 0.52); ctx.fillStyle = P.belly; ctx.fill();
    ell(ctx, 0.12, 0.9, 0.7, 0.32); ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fill();
    if (P.stripe) { ctx.fillStyle = P.stripe; ell(ctx, -0.25, -0.75, 0.6, 0.25, -0.3); ctx.fill(); }
    // 底部阴影
    ell(ctx, 0.1, 1.1, 1.2, 0.45); ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fill();
    ctx.restore();
    ell(ctx, -0.38, -0.52, 0.3, 0.16, -0.6); ctx.fillStyle = 'rgba(255,255,255,0.32)'; ctx.fill();
    circ(ctx, 0, 0, 1); ctx.lineWidth = 0.07; ctx.strokeStyle = P.line; ctx.stroke();
    // 眼睛
    eye(ctx, 0.2, -0.12, 0.2, 0.24, o, P.main);
    eye(ctx, 0.6, -0.1, 0.19, 0.23, o, P.main);
    // 眉毛
    brows(ctx, P.brows || [-0.08, -0.56, 0.42, -0.33, 0.92, -0.54, 0.94, -0.4, 0.43, -0.17, -0.08, -0.42]);
    beak(ctx, 0.42, 0.06, P.beakLen || 0.72, P.beakH || 0.3);
  }

  const BIRD_ART = {
    red(ctx, o) {
      roundBird(ctx, o, {
        main: '#e3262d', light: '#ff7a68', dark: '#93101b', line: '#4a0a0a', belly: '#f4dcc0', tail: '#1d1d1d',
        crest: [[-0.12, -0.9, -0.45, 0.28, 0.13], [0.08, -0.93, 0.15, 0.34, 0.14]],
      });
    },
    terence(ctx, o) {
      roundBird(ctx, o, {
        main: '#b3141e', light: '#e2564d', dark: '#5d0710', line: '#2e0505', belly: '#e5c7a6', tail: '#151515', tailLen: 0.45,
        crest: [[-0.1, -0.92, -0.4, 0.22, 0.12], [0.08, -0.95, 0.15, 0.26, 0.12]],
        brows: [-0.15, -0.62, 0.42, -0.28, 1.0, -0.6, 1.0, -0.38, 0.43, -0.08, -0.15, -0.4],
        beakLen: 0.66, beakH: 0.34,
      });
    },
    blue(ctx, o) {
      roundBird(ctx, o, {
        main: '#4aa6e6', light: '#a9dcff', dark: '#1d5f98', line: '#0f2f4f', belly: '#d7eefc', tail: '#1d1d1d', tailLen: 0.42,
        stripe: 'rgba(20,70,120,0.35)',
        crest: [[-0.1, -0.9, -0.35, 0.24, 0.09, '#1d1d1d'], [0.05, -0.93, 0.2, 0.28, 0.09, '#1d1d1d']],
        brows: [-0.02, -0.5, 0.42, -0.32, 0.86, -0.48, 0.86, -0.4, 0.43, -0.22, -0.02, -0.42],
        beakLen: 0.6, beakH: 0.26,
      });
    },
    yellow(ctx, o) {
      const pts = [[1.3, 0.38], [-0.7, -1.05], [-0.85, 0.9]];
      const path = () => {
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const a = pts[i], b = pts[(i + 1) % 3];
          const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
          if (i === 0) ctx.moveTo(mx, my);
          const c = pts[(i + 1) % 3], d = pts[(i + 2) % 3];
          const nx = (c[0] + d[0]) / 2, ny = (c[1] + d[1]) / 2;
          ctx.quadraticCurveTo(c[0], c[1], nx, ny);
        }
        ctx.closePath();
      };
      tailFeathers(ctx, -0.8, 0.25, '#1d1d1d', 3, 0.45, 0.4);
      // 黑色冠羽
      ctx.fillStyle = '#1d1d1d';
      for (const k of [-0.3, 0, 0.3]) {
        ctx.save(); ctx.translate(-0.55, -0.75); ctx.rotate(-1.9 + k);
        ell(ctx, 0.3, 0, 0.32, 0.07); ctx.fill(); ctx.restore();
      }
      path();
      const g = ctx.createLinearGradient(-0.4, -0.8, 0.4, 0.9);
      g.addColorStop(0, '#fff07a'); g.addColorStop(0.5, '#fbcf13'); g.addColorStop(1, '#c79a00');
      ctx.fillStyle = g; ctx.fill();
      ctx.save(); path(); ctx.clip();
      ell(ctx, 0.0, 0.9, 1.0, 0.45); ctx.fillStyle = '#fff3c4'; ctx.fill();
      ctx.restore();
      ell(ctx, -0.35, -0.35, 0.22, 0.1, -0.9); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fill();
      path(); ctx.lineWidth = 0.07; ctx.strokeStyle = '#5a4300'; ctx.stroke();
      eye(ctx, 0.08, -0.15, 0.18, 0.22, o, '#fbcf13');
      eye(ctx, 0.45, -0.05, 0.17, 0.2, o, '#fbcf13');
      brows(ctx, [-0.18, -0.48, 0.3, -0.22, 0.72, -0.32, 0.72, -0.2, 0.3, -0.08, -0.18, -0.36]);
      beak(ctx, 0.35, 0.12, 0.95, 0.3);
    },
    black(ctx, o) {
      // 引信
      ctx.lineWidth = 0.09; ctx.strokeStyle = '#3a3a3a';
      ctx.beginPath(); ctx.moveTo(0, -0.95); ctx.quadraticCurveTo(0.15, -1.2, 0.05, -1.35); ctx.stroke();
      const flick = o.armed ? 1 + 0.4 * Math.sin(o.t * 40) : 0.6;
      circ(ctx, 0.05, -1.38, 0.12 * flick); ctx.fillStyle = '#ffd23f'; ctx.fill();
      circ(ctx, 0.05, -1.38, 0.06 * flick); ctx.fillStyle = '#fff'; ctx.fill();
      tailFeathers(ctx, -0.85, 0.1, '#111', 3, 0.4, 0.4);
      circ(ctx, 0, 0, 1); ctx.fillStyle = bodyGrad(ctx, '#6b6b6b', '#2b2b2b', '#080808'); ctx.fill();
      ctx.save(); circ(ctx, 0, 0, 1); ctx.clip();
      ell(ctx, 0.12, 0.85, 0.7, 0.4); ctx.fillStyle = '#5b5b5b'; ctx.fill();
      // 眼周橙色
      ell(ctx, 0.42, -0.1, 0.6, 0.38); ctx.fillStyle = 'rgba(255,140,30,0.25)'; ctx.fill();
      ctx.restore();
      ell(ctx, -0.4, -0.5, 0.28, 0.14, -0.6); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fill();
      if (o.armed) {
        circ(ctx, 0, 0, 1); ctx.fillStyle = `rgba(255,40,20,${0.25 + 0.25 * Math.sin(o.t * 30)})`; ctx.fill();
      }
      circ(ctx, 0, 0, 1); ctx.lineWidth = 0.07; ctx.strokeStyle = '#000'; ctx.stroke();
      eye(ctx, 0.2, -0.12, 0.2, 0.24, o, '#2b2b2b');
      eye(ctx, 0.62, -0.1, 0.19, 0.23, o, '#2b2b2b');
      brows(ctx, [-0.1, -0.56, 0.42, -0.3, 0.95, -0.55, 0.97, -0.4, 0.43, -0.14, -0.1, -0.4], '#000');
      beak(ctx, 0.42, 0.08, 0.66, 0.3);
    },
    white(ctx, o) {
      ctx.fillStyle = '#222';
      for (const k of [-0.25, 0, 0.25]) {
        ctx.save(); ctx.translate(0, -1.08); ctx.rotate(-Math.PI / 2 + k);
        ell(ctx, 0.18, 0, 0.2, 0.05); ctx.fill(); ctx.restore();
      }
      tailFeathers(ctx, -0.88, 0.25, '#e7e7e7', 3, 0.35, 0.4);
      ell(ctx, 0, -0.06, 0.96, 1.1);
      const g = ctx.createRadialGradient(-0.3, -0.5, 0.1, 0, 0, 1.2);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#f2f2f2'); g.addColorStop(1, '#bdbdbd');
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 0.07; ctx.strokeStyle = '#6b6b6b'; ctx.stroke();
      ell(ctx, 0.85, 0.25, 0.14, 0.09); ctx.fillStyle = 'rgba(255,140,170,0.55)'; ctx.fill();
      ell(ctx, -0.05, 0.28, 0.14, 0.09); ctx.fill();
      eye(ctx, 0.2, -0.15, 0.19, 0.23, o, '#f2f2f2');
      eye(ctx, 0.6, -0.12, 0.18, 0.22, o, '#f2f2f2');
      brows(ctx, [0.0, -0.5, 0.42, -0.36, 0.84, -0.5, 0.84, -0.43, 0.42, -0.28, 0.0, -0.43], '#555');
      beak(ctx, 0.45, 0.06, 0.55, 0.26);
    },
  };

  function drawBird(ctx, type, r, o) {
    ctx.save();
    ctx.scale(r, r);
    if (o.squash) ctx.scale(1 + o.squash, 1 - o.squash);
    BIRD_ART[type](ctx, o);
    ctx.restore();
  }

  function drawEgg(ctx, r) {
    ctx.save(); ctx.scale(r, r);
    ell(ctx, 0, 0.05, 0.85, 1.05);
    const g = ctx.createRadialGradient(-0.3, -0.4, 0.05, 0, 0, 1.2);
    g.addColorStop(0, '#fff'); g.addColorStop(1, '#d9d2c3');
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 0.08; ctx.strokeStyle = '#6b6252'; ctx.stroke();
    ctx.restore();
  }

  // ================= 猪 =================
  function drawPig(ctx, p, r, o) {
    const dmg = 1 - Math.max(0, p.hp) / p.maxHp;
    ctx.save(); ctx.scale(r, r);
    const sq = o.squash || 0;
    ctx.scale(1 + sq, 1 - sq);
    const line = '#2b5e10';
    ctx.lineWidth = 0.07; ctx.strokeStyle = line;
    // 耳朵
    for (const s of [-1, 1]) {
      circ(ctx, s * 0.58, -0.76, 0.24); ctx.fillStyle = '#7fcd34'; ctx.fill(); ctx.stroke();
      circ(ctx, s * 0.58, -0.76, 0.12); ctx.fillStyle = '#4f9a1e'; ctx.fill();
    }
    // 身体
    ell(ctx, 0, 0, 1, 0.93);
    const g = ctx.createRadialGradient(-0.35, -0.42, 0.05, 0, 0, 1.1);
    g.addColorStop(0, '#c4f57a'); g.addColorStop(0.55, '#80cf35'); g.addColorStop(1, '#4b9619');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ell(ctx, 0, 0, 1, 0.93); ctx.clip();
    // 斑点
    ctx.fillStyle = 'rgba(70,140,25,0.35)';
    circ(ctx, -0.62, 0.3, 0.1); ctx.fill(); circ(ctx, -0.5, 0.48, 0.06); ctx.fill(); circ(ctx, 0.7, 0.45, 0.08); ctx.fill();
    ell(ctx, 0, 1.05, 1.2, 0.4); ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fill();
    // 伤痕
    if (dmg > 0.3) {
      ell(ctx, 0.45, -0.18, 0.34, 0.3); ctx.fillStyle = 'rgba(90,60,110,0.45)'; ctx.fill();
      ell(ctx, -0.55, 0.35, 0.18, 0.12, 0.3); ctx.fillStyle = 'rgba(90,60,110,0.35)'; ctx.fill();
    }
    if (dmg > 0.6) {
      ell(ctx, -0.4, -0.2, 0.32, 0.28); ctx.fillStyle = 'rgba(70,40,90,0.45)'; ctx.fill();
      ctx.strokeStyle = 'rgba(40,70,20,0.8)'; ctx.lineWidth = 0.04;
      ctx.beginPath(); ctx.moveTo(-0.75, -0.45); ctx.lineTo(-0.6, -0.55); ctx.moveTo(-0.72, -0.55); ctx.lineTo(-0.63, -0.43); ctx.stroke();
    }
    ctx.restore();
    ell(ctx, -0.38, -0.5, 0.3, 0.16, -0.5); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fill();
    ell(ctx, 0, 0, 1, 0.93); ctx.lineWidth = 0.07; ctx.strokeStyle = line; ctx.stroke();
    // 眼睛
    const eo = { look: o.look, blink: o.blink, scared: o.scared };
    eye(ctx, -0.42, -0.22, 0.21, 0.21, eo, '#80cf35');
    eye(ctx, 0.42, -0.22, 0.21, 0.21, eo, '#80cf35');
    if (dmg > 0.6) { // 黑眼圈
      ctx.lineWidth = 0.06; ctx.strokeStyle = 'rgba(60,30,80,0.7)'; circ(ctx, 0.42, -0.22, 0.25); ctx.stroke();
    }
    // 鼻子
    ell(ctx, 0, 0.14, 0.37, 0.28);
    const sg = ctx.createRadialGradient(-0.1, 0.05, 0.02, 0, 0.14, 0.4);
    sg.addColorStop(0, '#c8f58e'); sg.addColorStop(1, '#8ed448');
    ctx.fillStyle = sg; ctx.fill(); ctx.lineWidth = 0.05; ctx.strokeStyle = line; ctx.stroke();
    ctx.fillStyle = '#2b5e10';
    ell(ctx, -0.13, 0.15, 0.07, 0.11); ctx.fill(); ell(ctx, 0.13, 0.15, 0.07, 0.11); ctx.fill();
    // 嘴
    if (p.type !== 'mustache') {
      ctx.beginPath();
      if (o.laugh) { ctx.moveTo(-0.3, 0.52); ctx.quadraticCurveTo(0, 0.85, 0.3, 0.52); ctx.closePath(); ctx.fillStyle = '#1f3d0a'; ctx.fill(); }
      else { ctx.moveTo(-0.22, 0.58); ctx.quadraticCurveTo(0, 0.7, 0.22, 0.56); ctx.lineWidth = 0.05; ctx.strokeStyle = line; ctx.stroke(); }
      if (o.laugh || dmg < 0.6) {
        ctx.fillStyle = '#fff'; ctx.fillRect(-0.08, 0.58, 0.07, 0.08); ctx.fillRect(0.02, 0.58, 0.07, 0.08);
      }
    }
    // 类型装饰
    if (p.type === 'helmet') drawHelmet(ctx, dmg);
    else if (p.type === 'king') drawCrown(ctx, o.t);
    else if (p.type === 'mustache') drawMustache(ctx);
    ctx.restore();
  }

  function drawHelmet(ctx, dmg) {
    ctx.save();
    ctx.beginPath(); ctx.rect(-1.3, -1.4, 2.6, 1.0); ctx.clip();
    circ(ctx, 0, -0.05, 1.08);
    const g = ctx.createLinearGradient(-1, -1, 1, 0);
    g.addColorStop(0, '#e6eaee'); g.addColorStop(0.4, '#a5adb5'); g.addColorStop(1, '#5d656d');
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 0.07; ctx.strokeStyle = '#2f353b'; ctx.stroke();
    ell(ctx, -0.4, -0.75, 0.3, 0.1, -0.5); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
    if (dmg > 0.3) {
      ctx.strokeStyle = '#3a4046'; ctx.lineWidth = 0.04;
      ctx.beginPath(); ctx.moveTo(0.2, -1.05); ctx.lineTo(0.35, -0.8); ctx.lineTo(0.25, -0.65); ctx.lineTo(0.45, -0.5); ctx.stroke();
      circ(ctx, -0.5, -0.65, 0.1); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
    }
    if (dmg > 0.6) {
      ctx.beginPath(); ctx.moveTo(-0.3, -1.05); ctx.lineTo(-0.15, -0.8); ctx.lineTo(-0.35, -0.55); ctx.stroke();
    }
    ctx.restore();
    rrect(ctx, -1.12, -0.5, 2.24, 0.16, 0.08);
    ctx.fillStyle = '#7d858d'; ctx.fill(); ctx.lineWidth = 0.05; ctx.strokeStyle = '#2f353b'; ctx.stroke();
    ctx.fillStyle = '#d5dade';
    for (const x of [-0.75, -0.25, 0.25, 0.75]) { circ(ctx, x, -0.42, 0.04); ctx.fill(); }
  }

  function drawCrown(ctx, t) {
    ctx.save(); ctx.translate(0, -0.78);
    ctx.beginPath();
    ctx.moveTo(-0.55, 0.12); ctx.lineTo(-0.62, -0.42); ctx.lineTo(-0.3, -0.18); ctx.lineTo(0, -0.55);
    ctx.lineTo(0.3, -0.18); ctx.lineTo(0.62, -0.42); ctx.lineTo(0.55, 0.12); ctx.closePath();
    const g = ctx.createLinearGradient(0, -0.55, 0, 0.12);
    g.addColorStop(0, '#fff3a0'); g.addColorStop(0.5, '#f7c51e'); g.addColorStop(1, '#b8860b');
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 0.05; ctx.strokeStyle = '#6b4e00'; ctx.stroke();
    for (const [x, y, c] of [[-0.62, -0.42, '#e33'], [0, -0.55, '#3af'], [0.62, -0.42, '#e33']]) {
      circ(ctx, x, y, 0.07); ctx.fillStyle = '#ffe680'; ctx.fill(); ctx.stroke();
    }
    ell(ctx, 0, -0.05, 0.1, 0.12); ctx.fillStyle = '#d0213a'; ctx.fill(); ctx.stroke();
    ell(ctx, -0.33, 0.0, 0.07, 0.08); ctx.fillStyle = '#2a7be0'; ctx.fill(); ctx.stroke();
    ell(ctx, 0.33, 0.0, 0.07, 0.08); ctx.fill(); ctx.stroke();
    const s = 0.5 + 0.5 * Math.sin((t || 0) * 3);
    ctx.fillStyle = `rgba(255,255,255,${s})`;
    ctx.beginPath(); ctx.moveTo(-0.02, -0.11); ctx.lineTo(0.02, -0.11); ctx.lineTo(0, -0.18); ctx.fill();
    ctx.restore();
  }

  function drawMustache(ctx) {
    ctx.fillStyle = '#d8d8d0'; ctx.strokeStyle = '#6d6d64'; ctx.lineWidth = 0.04;
    for (const s of [-1, 1]) { // 浓眉
      ctx.save(); ctx.scale(s, 1);
      ctx.beginPath(); ctx.moveTo(0.15, -0.5); ctx.quadraticCurveTo(0.45, -0.68, 0.75, -0.45);
      ctx.quadraticCurveTo(0.45, -0.48, 0.15, -0.38); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = '#8a5a2b'; ctx.strokeStyle = '#3d2410';
    for (const s of [-1, 1]) {
      ctx.save(); ctx.scale(s, 1);
      ctx.beginPath(); ctx.moveTo(0, 0.38);
      ctx.bezierCurveTo(0.3, 0.3, 0.6, 0.35, 0.82, 0.62);
      ctx.bezierCurveTo(0.6, 0.55, 0.62, 0.72, 0.4, 0.62);
      ctx.bezierCurveTo(0.25, 0.6, 0.1, 0.62, 0, 0.5); ctx.closePath();
      ctx.fill(); ctx.stroke(); ctx.restore();
    }
  }

  // ================= 方块 / 材质 =================
  function makeDetails(e) {
    const R = rng(e.seed);
    const w = e.shape === 'circle' ? e.r * 2 : e.w, h = e.shape === 'circle' ? e.r * 2 : e.h;
    e.dw = w; e.dh = h;
    e.grain = [];
    const along = w >= h;
    const n = Math.max(2, Math.round((along ? h : w) / 0.09));
    for (let i = 0; i < n; i++) e.grain.push({ off: (i + 0.5) / n + (R() - 0.5) * 0.3 / n, amp: 0.01 + R() * 0.025, f: 2 + R() * 4, ph: R() * TAU });
    e.knots = [];
    const nk = Math.floor((w * h) / 0.5 + R() * 1.5);
    for (let i = 0; i < nk; i++) e.knots.push({ x: (R() - 0.5) * w * 0.8, y: (R() - 0.5) * h * 0.7, s: 0.04 + R() * 0.05 });
    e.spots = [];
    const ns = Math.floor(w * h * 18) + 3;
    for (let i = 0; i < ns; i++) e.spots.push({ x: (R() - 0.5) * w, y: (R() - 0.5) * h, r: 0.02 + R() * 0.07, l: R() < 0.5 });
    e.streaks = [];
    for (let i = 0; i < Math.max(2, Math.floor((w + h) * 1.5)); i++) e.streaks.push({ x: (R() - 0.5) * (w + h), wd: 0.03 + R() * 0.08 });
    e.cracks = [];
    for (let i = 0; i < 7; i++) {
      const pts = [];
      let x, y;
      const side = Math.floor(R() * 4);
      if (side === 0) { x = (R() - 0.5) * w; y = -h / 2; }
      else if (side === 1) { x = (R() - 0.5) * w; y = h / 2; }
      else if (side === 2) { x = -w / 2; y = (R() - 0.5) * h; }
      else { x = w / 2; y = (R() - 0.5) * h; }
      pts.push(x, y);
      let ang = Math.atan2(-y, -x) + (R() - 0.5) * 1.2;
      const segs = 3 + Math.floor(R() * 3);
      const len = Math.min(w, h) * 0.35 + Math.max(w, h) * 0.12;
      for (let s = 0; s < segs; s++) {
        ang += (R() - 0.5) * 1.1;
        x += Math.cos(ang) * len / segs * (0.6 + R()); y += Math.sin(ang) * len / segs * (0.6 + R());
        pts.push(x, y);
      }
      e.cracks.push(pts);
    }
  }

  function shapePath(ctx, e) {
    if (e.shape === 'circle') circ(ctx, 0, 0, e.r);
    else if (e.shape === 'poly') {
      ctx.beginPath();
      e.verts.forEach((v, i) => i ? ctx.lineTo(v[0], -v[1]) : ctx.moveTo(v[0], -v[1]));
      ctx.closePath();
    } else rrect(ctx, -e.w / 2, -e.h / 2, e.w, e.h, Math.min(0.05, e.w * 0.15, e.h * 0.15));
  }

  const MAT_STYLE = {
    wood: { g: ['#ecb86e', '#cf9149', '#a96a2b'], line: '#5a3210' },
    stone: { g: ['#b8bec3', '#959ca3', '#6f777f'], line: '#3d4349' },
    ice: { g: ['rgba(225,248,255,0.95)', 'rgba(160,220,248,0.88)', 'rgba(110,190,235,0.9)'], line: '#3f8fbf' },
    tnt: { g: ['#d98a3d', '#b8642a', '#8a4416'], line: '#4a1f06' },
  };

  function drawBlock(ctx, e, t) {
    const st = MAT_STYLE[e.mat];
    const w = e.dw, h = e.dh;
    ctx.save();
    shapePath(ctx, e); ctx.clip();
    const along = w >= h;
    const g = along ? ctx.createLinearGradient(0, -h / 2, 0, h / 2) : ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    g.addColorStop(0, st.g[0]); g.addColorStop(0.5, st.g[1]); g.addColorStop(1, st.g[2]);
    ctx.fillStyle = g; ctx.fillRect(-w / 2 - 0.1, -h / 2 - 0.1, w + 0.2, h + 0.2);

    if (e.mat === 'wood' || e.mat === 'tnt') {
      if (e.shape === 'circle') {
        ctx.strokeStyle = 'rgba(110,60,20,0.45)'; ctx.lineWidth = 0.025;
        for (let r = e.r * 0.15; r < e.r; r += e.r * 0.17) { circ(ctx, 0.02, 0.01, r); ctx.stroke(); }
      } else {
        ctx.strokeStyle = e.mat === 'tnt' ? 'rgba(80,30,5,0.35)' : 'rgba(115,62,20,0.42)';
        ctx.lineWidth = 0.022;
        for (const gr of e.grain) {
          ctx.beginPath();
          if (along) {
            const y0 = -h / 2 + gr.off * h;
            for (let x = -w / 2; x <= w / 2 + 0.05; x += 0.08) {
              const y = y0 + Math.sin(x * gr.f + gr.ph) * gr.amp;
              x === -w / 2 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
          } else {
            const x0 = -w / 2 + gr.off * w;
            for (let y = -h / 2; y <= h / 2 + 0.05; y += 0.08) {
              const x = x0 + Math.sin(y * gr.f + gr.ph) * gr.amp;
              y === -h / 2 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
          }
          ctx.stroke();
        }
        for (const k of e.knots) {
          ell(ctx, k.x, k.y, along ? k.s * 1.8 : k.s, along ? k.s : k.s * 1.8);
          ctx.fillStyle = 'rgba(100,50,15,0.5)'; ctx.fill();
          ctx.strokeStyle = 'rgba(100,50,15,0.35)';
          ell(ctx, k.x, k.y, (along ? k.s * 1.8 : k.s) * 1.6, (along ? k.s : k.s * 1.8) * 1.6); ctx.stroke();
        }
      }
      if (e.mat === 'tnt') {
        ctx.strokeStyle = '#6b2f0b'; ctx.lineWidth = 0.08;
        ctx.strokeRect(-w / 2 + 0.06, -h / 2 + 0.06, w - 0.12, h - 0.12);
        rrect(ctx, -w * 0.38, -h * 0.2, w * 0.76, h * 0.4, 0.04);
        ctx.fillStyle = '#d42020'; ctx.fill(); ctx.lineWidth = 0.03; ctx.strokeStyle = '#5a0000'; ctx.stroke();
        ctx.save(); ctx.scale(0.01, 0.01);
        ctx.fillStyle = '#fff'; ctx.font = `900 ${Math.round(h * 30)}px Arial Black, Arial, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('TNT', 0, h * 2);
        ctx.restore();
      } else if (e.shape === 'box' && Math.max(w, h) > 1.2) {
        ctx.fillStyle = '#4a3a2a';
        const L = Math.max(w, h) / 2 - 0.15;
        for (const s of [-1, 1]) for (const q of [-0.25, 0.25]) {
          const px = along ? s * L : q * w, py = along ? q * h : s * L;
          circ(ctx, px, py, 0.025); ctx.fill();
        }
      }
    } else if (e.mat === 'stone') {
      for (const s of e.spots) {
        circ(ctx, s.x, s.y, s.r);
        ctx.fillStyle = s.l ? 'rgba(255,255,255,0.18)' : 'rgba(40,45,50,0.18)'; ctx.fill();
      }
    } else if (e.mat === 'ice') {
      ctx.save(); ctx.rotate(-0.7);
      for (const s of e.streaks) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(s.x, -w - h, s.wd, (w + h) * 2); }
      ctx.restore();
      for (const s of e.spots.slice(0, 5)) { circ(ctx, s.x, s.y, s.r * 0.5); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill(); }
    }
    // 斜面高光 / 阴影
    ctx.lineWidth = 0.07;
    ctx.strokeStyle = e.mat === 'ice' ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.28)';
    ctx.save(); ctx.translate(-0.035, -0.035); shapePath(ctx, e); ctx.restore(); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.save(); ctx.translate(0.035, 0.035); shapePath(ctx, e); ctx.restore(); ctx.stroke();

    // 裂缝
    const dmg = 1 - Math.max(0, e.hp) / e.maxHp;
    if (dmg > 0.08) {
      const n = Math.min(e.cracks.length, Math.ceil(dmg * e.cracks.length * 1.1));
      for (let i = 0; i < n; i++) {
        const c = e.cracks[i];
        for (const pass of [0, 1]) {
          ctx.beginPath();
          for (let j = 0; j < c.length; j += 2) {
            const x = c[j] + (pass ? 0.02 : 0), y = c[j + 1] + (pass ? 0.02 : 0);
            j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.lineWidth = pass ? 0.02 : 0.035;
          ctx.strokeStyle = pass ? (e.mat === 'ice' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)') : (e.mat === 'ice' ? 'rgba(40,110,160,0.8)' : 'rgba(30,20,10,0.75)');
          ctx.stroke();
        }
      }
    }
    if (e.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${e.flash * 0.6})`; ctx.fillRect(-w, -h, w * 2, h * 2); }
    ctx.restore();
    shapePath(ctx, e); ctx.lineWidth = 0.045; ctx.strokeStyle = st.line; ctx.stroke();
  }

  // ================= 地形 =================
  function drawTerrain(ctx, e) {
    ctx.save();
    ctx.beginPath();
    e.verts.forEach((v, i) => i ? ctx.lineTo(v[0], -v[1]) : ctx.moveTo(v[0], -v[1]));
    ctx.closePath();
    const top = Math.max(...e.verts.map(v => v[1]));
    const g = ctx.createLinearGradient(0, -top, 0, 0);
    g.addColorStop(0, '#9a6a3a'); g.addColorStop(1, '#5e3a1c');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    const R = rng(e.seed);
    ctx.strokeStyle = 'rgba(60,30,10,0.25)'; ctx.lineWidth = 0.08;
    for (let y = 0.5; y < top; y += 0.7) {
      ctx.beginPath();
      for (let x = e.minX - 1; x < e.maxX + 1; x += 0.5) ctx.lineTo(x, -y + Math.sin(x * 1.3 + y) * 0.08);
      ctx.stroke();
    }
    for (let i = 0; i < (e.maxX - e.minX) * top * 1.2; i++) {
      const x = e.minX + R() * (e.maxX - e.minX), y = R() * top;
      ell(ctx, x, -y, 0.08 + R() * 0.12, 0.06 + R() * 0.08, R());
      ctx.fillStyle = R() < 0.5 ? 'rgba(170,150,130,0.6)' : 'rgba(60,35,15,0.4)'; ctx.fill();
    }
    ctx.restore();
    ctx.lineWidth = 0.05; ctx.strokeStyle = '#3b230e'; ctx.stroke();
    // 草皮：朝上的边
    const n = e.verts.length;
    for (let i = 0; i < n; i++) {
      const a = e.verts[i], b = e.verts[(i + 1) % n];
      // CCW 多边形，外法线 = (dy, -dx)
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy); if (len < 0.01) continue;
      const ny = -dx / len;
      if (ny < 0.5) continue;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a[0], -a[1]); ctx.lineTo(b[0], -b[1]);
      ctx.lineWidth = 0.34; ctx.strokeStyle = '#3f8f1f'; ctx.stroke();
      ctx.lineWidth = 0.2; ctx.strokeStyle = '#6fca37'; ctx.stroke();
      ctx.fillStyle = '#7ad642';
      const steps = Math.floor(len / 0.25);
      for (let s = 0; s < steps; s++) {
        const u = (s + 0.5) / steps, x = a[0] + dx * u, y = -(a[1] + dy * u);
        ctx.beginPath(); ctx.moveTo(x - 0.06, y - 0.05); ctx.lineTo(x + 0.02 * Math.sin(s * 7), y - 0.22 - (s % 3) * 0.04); ctx.lineTo(x + 0.06, y - 0.05); ctx.fill();
      }
    }
    ctx.restore();
  }

  // ================= 弹弓 =================
  const SL = { backTip: [0.42, -3.62], frontTip: [-0.32, -3.55] };
  function woodStroke(ctx, pts, w) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.lineWidth = w + 0.08; ctx.strokeStyle = '#3e2109'; ctx.stroke();
    ctx.lineWidth = w; ctx.strokeStyle = '#8b5626'; ctx.stroke();
    ctx.save(); ctx.translate(-w * 0.2, 0);
    ctx.lineWidth = w * 0.3; ctx.strokeStyle = 'rgba(255,210,150,0.35)'; ctx.stroke();
    ctx.restore();
  }
  function drawSlingBack(ctx, pouch) {
    woodStroke(ctx, [[0.05, 0.1], [0.05, -2.1], [0.42, -3.62]], 0.36);
    // 树皮纹理
    ctx.strokeStyle = 'rgba(40,20,5,0.4)'; ctx.lineWidth = 0.03;
    for (let y = -0.3; y > -2; y -= 0.35) { ctx.beginPath(); ctx.moveTo(-0.08, y); ctx.lineTo(0.15, y - 0.12); ctx.stroke(); }
    if (pouch) band(ctx, SL.backTip, pouch);
  }
  function drawPouch(ctx, pouch, angle) {
    ctx.save(); ctx.translate(pouch[0], pouch[1]); ctx.rotate(angle);
    rrect(ctx, -0.12, -0.38, 0.3, 0.76, 0.12);
    ctx.fillStyle = '#4a2a12'; ctx.fill(); ctx.lineWidth = 0.04; ctx.strokeStyle = '#1e0f04'; ctx.stroke();
    ctx.restore();
  }
  function drawSlingFront(ctx, pouch) {
    if (pouch) band(ctx, SL.frontTip, pouch);
    woodStroke(ctx, [[0.0, -2.0], [-0.32, -3.55]], 0.34);
    // 绑带
    ctx.fillStyle = '#5a3210';
    ctx.save(); ctx.translate(-0.3, -3.35); ctx.rotate(0.3); ctx.fillRect(-0.22, -0.08, 0.44, 0.16); ctx.restore();
  }
  function band(ctx, tip, p) {
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(tip[0], tip[1]); ctx.lineTo(p[0], p[1]);
    ctx.lineWidth = 0.17; ctx.strokeStyle = '#2b1406'; ctx.stroke();
    ctx.lineWidth = 0.07; ctx.strokeStyle = '#5b2d10'; ctx.stroke();
  }

  // ================= 背景（屏幕空间） =================
  const clouds = [];
  { const R = rng(7); for (let i = 0; i < 14; i++) clouds.push({ x: R() * 4000, y: 0.08 + R() * 0.3, s: 0.6 + R() * 0.9, sp: 4 + R() * 8, seed: Math.floor(R() * 1e6) }); }

  function noise1(x, seed) {
    return Math.sin(x * 0.013 + seed) * 0.5 + Math.sin(x * 0.031 + seed * 2.1) * 0.3 + Math.sin(x * 0.07 + seed * 3.3) * 0.2;
  }

  function cloudShape(ctx, x, y, s, seed) {
    const R = rng(seed);
    ctx.beginPath();
    const n = 5 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) {
      const cx = x + (i - n / 2) * 28 * s + R() * 10 * s, cy = y - Math.sin((i / (n - 1)) * Math.PI) * 22 * s;
      ctx.moveTo(cx + 30 * s, cy); ctx.arc(cx, cy, (22 + R() * 14) * s, 0, TAU);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill();
  }

  function drawBackground(ctx, W, H, camX, groundSY, zoom, t, theme) {
    const th = theme || THEMES.day;
    const g = ctx.createLinearGradient(0, 0, 0, groundSY);
    g.addColorStop(0, th.sky[0]); g.addColorStop(0.6, th.sky[1]); g.addColorStop(1, th.sky[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 太阳
    const sx = W * 0.82, sy = H * 0.16, sr = Math.min(W, H) * 0.07;
    const sg = ctx.createRadialGradient(sx, sy, sr * 0.3, sx, sy, sr * 3);
    sg.addColorStop(0, th.sunGlow); sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg; ctx.fillRect(sx - sr * 3, sy - sr * 3, sr * 6, sr * 6);
    circ(ctx, sx, sy, sr); ctx.fillStyle = th.sun; ctx.fill();
    // 云
    for (const c of clouds) {
      const span = W + 600;
      let x = ((c.x + t * c.sp - camX * zoom * 0.08) % span + span) % span - 300;
      cloudShape(ctx, x, c.y * H, c.s * Math.max(0.6, H / 900), c.seed);
    }
    const unit = zoom;
    // 远山
    layer(ctx, W, groundSY, camX * zoom * 0.15, unit * 7.5, unit * 3, 11, th.far, false);
    layer(ctx, W, groundSY, camX * zoom * 0.3, unit * 4.5, unit * 2.2, 37, th.mid, false);
    // 近处丘陵 + 树
    layer(ctx, W, groundSY, camX * zoom * 0.5, unit * 2.2, unit * 1.3, 73, th.near, true, unit, th);
  }

  function layer(ctx, W, base, off, hgt, amp, seed, color, trees, unit, th) {
    ctx.beginPath(); ctx.moveTo(0, base + 2);
    const step = 6;
    const scale = 1 / Math.max(0.3, amp / 60);
    for (let x = 0; x <= W + step; x += step) {
      const y = base - hgt - noise1((x + off) * scale * 0.6, seed) * amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, base + 2); ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    if (trees) {
      const sp = unit * 3.2;
      const start = Math.floor(off / sp) - 1;
      for (let i = start; i < start + W / sp + 3; i++) {
        const R = rng(i * 977 + seed);
        if (R() < 0.35) continue;
        const wx = i * sp - off + R() * sp * 0.5;
        const y = base - hgt - noise1((wx + off) * scale * 0.6, seed) * amp;
        const s = unit * (0.5 + R() * 0.4);
        ctx.fillStyle = th.trunk; ctx.fillRect(wx - s * 0.08, y - s * 0.9, s * 0.16, s * 1.0);
        circ(ctx, wx, y - s * 1.2, s * 0.55); ctx.fillStyle = th.tree; ctx.fill();
        circ(ctx, wx - s * 0.15, y - s * 1.35, s * 0.25); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
      }
    }
  }

  // 地面（世界空间）
  function drawGround(ctx, x0, x1, th) {
    th = th || THEMES.day;
    const g = ctx.createLinearGradient(0, 0, 0, 6);
    g.addColorStop(0, th.dirt[0]); g.addColorStop(1, th.dirt[1]);
    ctx.fillStyle = g; ctx.fillRect(x0, 0, x1 - x0, 40);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    const s0 = Math.floor(x0 / 1.3);
    for (let i = s0; i < x1 / 1.3 + 1; i++) {
      const R = rng(i * 131 + 5);
      ell(ctx, i * 1.3 + R(), 0.8 + R() * 3, 0.15 + R() * 0.2, 0.08 + R() * 0.1, R()); ctx.fill();
    }
    ctx.fillStyle = th.grassDark; ctx.fillRect(x0, -0.05, x1 - x0, 0.42);
    ctx.fillStyle = th.grass; ctx.fillRect(x0, -0.05, x1 - x0, 0.25);
    ctx.fillStyle = th.grassLight;
    const b0 = Math.floor(x0 / 0.22);
    for (let i = b0; i < x1 / 0.22 + 1; i++) {
      const x = i * 0.22, hh = 0.14 + ((i * 37) % 7) * 0.025;
      ctx.beginPath(); ctx.moveTo(x - 0.07, 0); ctx.lineTo(x + 0.02 * ((i % 3) - 1), -hh); ctx.lineTo(x + 0.07, 0); ctx.fill();
    }
    // 小花
    for (let i = Math.floor(x0 / 2.7); i < x1 / 2.7 + 1; i++) {
      const R = rng(i * 53 + 9); if (R() < 0.5) continue;
      const x = i * 2.7 + R() * 2;
      circ(ctx, x, -0.12, 0.07); ctx.fillStyle = R() < 0.5 ? '#ffe14d' : '#ff8fb1'; ctx.fill();
      circ(ctx, x, -0.12, 0.03); ctx.fillStyle = '#fff'; ctx.fill();
    }
  }

  const THEMES = {
    day: { sky: ['#5ec4ff', '#a8e3ff', '#e9f8ff'], sun: '#fff6c9', sunGlow: 'rgba(255,245,200,0.7)', far: '#a9cde6', mid: '#8fc79a', near: '#6db35a', tree: '#4d9a3c', trunk: '#6b4422', dirt: ['#8a5a2d', '#4f3017'], grass: '#6cc63a', grassDark: '#3f8f1f', grassLight: '#8de05a' },
    sunset: { sky: ['#ff8a5c', '#ffc27a', '#ffe9c2'], sun: '#fff0b0', sunGlow: 'rgba(255,200,120,0.8)', far: '#c98a8f', mid: '#a88a6a', near: '#7b9a4a', tree: '#5b7d33', trunk: '#5a3a1e', dirt: ['#7a4a26', '#432513'], grass: '#7cb83a', grassDark: '#4a7d1f', grassLight: '#a0d65a' },
    snow: { sky: ['#8fb7e8', '#c9def5', '#f3f8ff'], sun: '#ffffff', sunGlow: 'rgba(255,255,255,0.7)', far: '#d6e4f2', mid: '#b9cfe3', near: '#e8f1fa', tree: '#4a7d6a', trunk: '#5a4030', dirt: ['#7d6a5a', '#4a3a2d'], grass: '#f4f9ff', grassDark: '#b9d0e6', grassLight: '#ffffff' },
    night: { sky: ['#14183a', '#2e3a78', '#6b6fa8'], sun: '#f4f1d0', sunGlow: 'rgba(220,220,255,0.35)', far: '#2b3366', mid: '#253f4a', near: '#1f4a2c', tree: '#163a20', trunk: '#2a1c10', dirt: ['#4a321c', '#22160b'], grass: '#3f8f2f', grassDark: '#245a1a', grassLight: '#55a83f' },
  };

  return { rng, drawBird, drawEgg, drawPig, drawBlock, makeDetails, drawTerrain, drawSlingBack, drawSlingFront, drawPouch, drawBackground, drawGround, THEMES, circ, ell, rrect, SL };
})();
