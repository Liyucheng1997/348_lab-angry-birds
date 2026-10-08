'use strict';
// WebAudio 合成音效 + 简单背景音乐，无需任何音频文件。
const Sfx = (() => {
  let ac = null, master = null, sfxGain = null, musicGain = null, noiseBuf = null;
  let muted = false, musicOn = true;
  let lastPlay = {};
  try { muted = localStorage.getItem('ab_muted') === '1'; musicOn = localStorage.getItem('ab_music') !== '0'; } catch (e) { }

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ac.destination);
    sfxGain = ac.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);
    musicGain = ac.createGain(); musicGain.gain.value = musicOn ? 0.22 : 0; musicGain.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 1.5, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startMusic();
  }

  function throttle(name, ms) {
    const now = performance.now();
    if (lastPlay[name] && now - lastPlay[name] < ms) return false;
    lastPlay[name] = now; return true;
  }

  function tone(f0, f1, dur, type = 'sine', vol = 0.3, delay = 0, dest) {
    if (!ac) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, vol, f0, f1, type = 'lowpass', delay = 0, q = 1) {
    if (!ac) return;
    const t = ac.currentTime + delay;
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfxGain);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  const S = {
    stretch(k) { if (throttle('stretch', 90)) tone(180 + k * 260, 220 + k * 300, 0.08, 'sawtooth', 0.04); },
    launch() { noise(0.35, 0.35, 3000, 400, 'bandpass', 0, 2); tone(500, 160, 0.18, 'triangle', 0.15); },
    squawk(type) {
      const base = { red: 900, blue: 1400, yellow: 1100, black: 600, white: 800, terence: 380 }[type] || 900;
      tone(base, base * 1.6, 0.08, 'sawtooth', 0.12);
      tone(base * 1.5, base * 0.7, 0.22, 'square', 0.08, 0.07);
    },
    ability(type) {
      if (type === 'yellow') { noise(0.4, 0.4, 800, 6000, 'bandpass', 0, 3); tone(400, 1600, 0.3, 'sawtooth', 0.1); }
      else if (type === 'blue') { tone(1500, 2400, 0.1, 'square', 0.08); tone(1800, 2800, 0.1, 'square', 0.08, 0.06); tone(2100, 3200, 0.1, 'square', 0.08, 0.12); }
      else if (type === 'white') { tone(700, 300, 0.2, 'square', 0.12); tone(300, 1200, 0.35, 'triangle', 0.1, 0.1); }
      else if (type === 'red' || type === 'terence') { tone(700, 1400, 0.25, 'sawtooth', 0.12); tone(1000, 600, 0.3, 'square', 0.08, 0.15); }
    },
    hit(mat, k) {
      if (!throttle('hit' + mat, 45)) return;
      const v = Math.min(0.5, 0.08 + k * 0.04);
      if (mat === 'wood' || mat === 'tnt') { tone(220 + Math.random() * 60, 90, 0.12, 'triangle', v); noise(0.08, v * 0.6, 1500, 300); }
      else if (mat === 'stone') { tone(120, 60, 0.15, 'sine', v); noise(0.1, v * 0.7, 900, 150); }
      else if (mat === 'ice') { tone(1800 + Math.random() * 600, 1200, 0.1, 'sine', v * 0.6); tone(2600, 2000, 0.08, 'triangle', v * 0.4); }
      else if (mat === 'pig') { tone(300, 180, 0.1, 'square', v * 0.4); }
      else if (mat === 'ground') { noise(0.1, v * 0.5, 600, 100); }
    },
    breakMat(mat) {
      if (!throttle('break' + mat, 60)) return;
      if (mat === 'wood' || mat === 'tnt') { noise(0.35, 0.4, 2500, 200); tone(160, 60, 0.25, 'sawtooth', 0.12); for (let i = 0; i < 3; i++) tone(300 + Math.random() * 200, 100, 0.06, 'triangle', 0.1, i * 0.05); }
      else if (mat === 'stone') { noise(0.5, 0.5, 1200, 80); tone(90, 40, 0.4, 'sine', 0.3); }
      else if (mat === 'ice') { for (let i = 0; i < 6; i++) tone(2000 + Math.random() * 2500, 1500, 0.15, 'sine', 0.12, i * 0.03); noise(0.3, 0.25, 8000, 3000, 'highpass'); }
    },
    pigPop() {
      if (!throttle('pig', 70)) return;
      tone(520, 140, 0.25, 'square', 0.15);
      noise(0.25, 0.3, 3000, 400, 'bandpass', 0, 1.5);
      tone(800, 400, 0.15, 'sine', 0.15, 0.08);
    },
    pigOink() { if (throttle('oink', 600)) { tone(260, 200, 0.12, 'sawtooth', 0.06); tone(240, 170, 0.14, 'sawtooth', 0.06, 0.16); } },
    explode() {
      if (!throttle('boom', 50)) return;
      noise(1.2, 0.9, 1800, 40); tone(110, 30, 0.8, 'sine', 0.6); noise(0.3, 0.5, 6000, 500, 'bandpass');
    },
    poof() { noise(0.25, 0.25, 2000, 400, 'bandpass', 0, 1); },
    click() { tone(900, 1200, 0.06, 'triangle', 0.15); },
    star(i) { tone(880 * Math.pow(1.26, i), 1760 * Math.pow(1.26, i), 0.25, 'triangle', 0.25); tone(1320 * Math.pow(1.26, i), 1320 * Math.pow(1.26, i), 0.4, 'sine', 0.12, 0.05); },
    win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.3, 'triangle', 0.2, i * 0.12)); },
    lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, f * 0.97, 0.35, 'triangle', 0.18, i * 0.2)); tone(200, 150, 0.6, 'sawtooth', 0.05, 0.9); },
    bonus() { tone(1200, 1800, 0.15, 'triangle', 0.18); },
  };

  // ---------- 背景音乐：轻快的五声音阶小调 ----------
  let musicTimer = null, nextNote = 0, step = 0;
  const BPM = 112, SPB = 60 / BPM / 2;
  const chords = [[261.6, 329.6, 392], [220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7]];
  const melody = [0, 2, 4, 2, 5, 4, 2, -1, 4, 5, 7, 5, 4, 2, 0, -1, 2, 4, 5, 4, 2, 0, 2, -1, 4, 2, 0, -2, 0, -1, -1, -1];
  const scale = [523.3, 587.3, 659.3, 784, 880, 1046.5, 1174.7, 1318.5];
  function startMusic() {
    if (musicTimer) return;
    nextNote = ac.currentTime + 0.1;
    musicTimer = setInterval(() => {
      while (nextNote < ac.currentTime + 0.25) {
        const bar = Math.floor(step / 8) % 4;
        const ch = chords[bar];
        if (step % 2 === 0) tone(ch[0] / 2, ch[0] / 2, SPB * 1.6, 'triangle', 0.18, nextNote - ac.currentTime, musicGain);
        if (step % 2 === 1) { tone(ch[1], ch[1], SPB * 0.8, 'sine', 0.06, nextNote - ac.currentTime, musicGain); tone(ch[2], ch[2], SPB * 0.8, 'sine', 0.05, nextNote - ac.currentTime, musicGain); }
        const m = melody[step % melody.length];
        if (m >= 0) tone(scale[m], scale[m], SPB * 1.5, 'square', 0.035, nextNote - ac.currentTime, musicGain);
        nextNote += SPB; step++;
      }
    }, 60);
  }

  return Object.assign(S, {
    init,
    get muted() { return muted; },
    get musicOn() { return musicOn; },
    toggleMute() {
      muted = !muted; if (master) master.gain.value = muted ? 0 : 0.8;
      try { localStorage.setItem('ab_muted', muted ? '1' : '0'); } catch (e) { }
      return muted;
    },
    toggleMusic() {
      musicOn = !musicOn; if (musicGain) musicGain.gain.value = musicOn ? 0.22 : 0;
      try { localStorage.setItem('ab_music', musicOn ? '1' : '0'); } catch (e) { }
      return musicOn;
    },
  });
})();
