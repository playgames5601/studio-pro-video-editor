'use strict';
const $ = s => document.querySelector(s);
const cv = $('#cv'), ctx = cv.getContext('2d'), sc = $('#tlScroll'), tmp = document.createElement('canvas');
const RK = ['9:16', '16:9', '1:1'];
const dims = (r, s) => { const [a, b] = r.split(':').map(Number), [w, h] = a < b ? [s, s * b / a] : [s * a / b, s]; return [Math.round(w / 2) * 2, Math.round(h / 2) * 2]; };
const FILTERS = {
  none: ['Yok', 'none'], bw: ['Siyah-beyaz', 'grayscale(1)'], sepia: ['Sepya', 'sepia(.8)'],
  vivid: ['Canlı', 'saturate(1.8) contrast(1.1)'], cool: ['Soğuk', 'hue-rotate(190deg) saturate(1.2)'],
  warm: ['Sıcak', 'sepia(.35) saturate(1.4) hue-rotate(-10deg)'], bright: ['Parlak', 'brightness(1.3)'], dark: ['Koyu', 'brightness(.75) contrast(1.2)']
};
const PR = {
  x: {l: 'Konum X', min: -100, max: 100, d: 0, st: 1}, y: {l: 'Konum Y', min: -100, max: 100, d: 0, st: 1},
  s: {l: 'Ölçek', min: 10, max: 400, d: 100, st: 1}, r: {l: 'Döndürme', min: -180, max: 180, d: 0, st: 1}, o: {l: 'Opaklık', min: 0, max: 100, d: 100, st: 1},
  br: {l: 'Parlaklık', min: 0, max: 200, d: 100, st: 1}, ct: {l: 'Kontrast', min: 0, max: 200, d: 100, st: 1}, sa: {l: 'Doygunluk', min: 0, max: 200, d: 100, st: 1},
  hu: {l: 'Ton', min: -180, max: 180, d: 0, st: 1}, bl: {l: 'Bulanıklık', min: 0, max: 20, d: 0, st: .5},
  vg: {l: 'Vinyet', min: 0, max: 100, d: 0, st: 1}, sh: {l: 'Titreme', min: 0, max: 100, d: 0, st: 1}, px: {l: 'Pikselleştir', min: 0, max: 100, d: 0, st: 1}
};
const PANELS = {an: ['x', 'y', 's', 'r', 'o'], adj: ['br', 'ct', 'sa', 'hu', 'bl'], fx: ['vg', 'sh', 'px']};
const TRS = {none: 'Yok', fade: 'Solma', slide: 'Kayma', zoom: 'Yakınlaş', blur: 'Bulanık'};
const P = {
  plus: 'M12 5v14M5 12h14', split: 'M12 3v18M7 8l-3 4 3 4M17 8l3 4-3 4', speed: 'M4 16a8 8 0 0116 0M12 16l4-5',
  vol: 'M4 9v6h4l5 4V5L8 9zM17 9a4 4 0 010 6', filter: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M8 15v4',
  text: 'M5 6V4h14v2M12 4v16M9 20h6', del: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3', music: 'M9 18V6l10-2v12M9 18a3 3 0 11-6 0 3 3 0 016 0zM19 16a3 3 0 11-6 0 3 3 0 016 0z',
  adj: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 3v18', fx: 'M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z', anim: 'M12 3l9 9-9 9-9-9z',
  trans: 'M3 8h6v8H3zM15 8h6v8h-6zM9 12h6', play: 'M7 4l13 8-13 8z', pause: 'M6 4h4v16H6zM14 4h4v16h-4z'
};
const ic = n => `<svg viewBox="0 0 24 24"><path d="${P[n]}"/></svg>`;
const S = {clips: [], sel: null, t: 0, play: false, pps: 60, ratio: '9:16', panel: null};
const X = {res: 1080, fps: 30, q: 1, cancel: false, hq: false}, QB = [.08, .14, .24];
const HQ = !!(window.VideoEncoder && window.AudioEncoder && window.Mp4Muxer && window.OfflineAudioContext);
let uid = 0, last = 0, lastSet = 0, pt = -1, exporting = false, finishExport = null, rtCancel = null, AC, DST, hist = [], TB = [];

const cur = () => S.clips.find(c => c.id === S.sel);
const total = () => Math.max(0, ...S.clips.map(c => c.start + c.dur));
const fmt = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');
const endOf = type => Math.max(0, ...S.clips.filter(c => c.type === type).map(c => c.start + c.dur));
const isMedia = c => c.kind === 'video' || c.kind === 'audio';
const cp = c => ({...c, p: {...c.p}, kf: JSON.parse(JSON.stringify(c.kf || {}))});
const snap = () => { hist.push(S.clips.map(cp)); if (hist.length > 40) hist.shift(); };
const PAD = () => sc.clientWidth / 2;
const syncScroll = () => { lastSet = S.t * S.pps; sc.scrollLeft = lastSet; };
function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.i); toast.i = setTimeout(() => t.hidden = true, 2200); }
function refresh() { tools(); renderPanel(); }
function select(id) { S.sel = id; S.panel = null; render(); refresh(); }

/* ---------- Animasyon değerleri ---------- */
function val(c, k, t) {
  const a = c.kf && c.kf[k];
  if (!a || !a.length) return c.p && c.p[k] != null ? c.p[k] : PR[k].d;
  const u = t - c.start; if (u <= a[0][0]) return a[0][1];
  const L = a[a.length - 1]; if (u >= L[0]) return L[1];
  let i = 1; while (a[i][0] < u) i++;
  const p = a[i - 1], q = a[i]; let f = (u - p[0]) / (q[0] - p[0]); f = f * f * (3 - 2 * f);
  return p[1] + (q[1] - p[1]) * f;
}
function trans(c, t) {
  let a = 1, dx = 0, s = 1, bl = 0;
  for (const [m, f, sg] of [[c.tin, (t - c.start) / .6, 1], [c.tout, (c.start + c.dur - t) / .6, -1]]) {
    if (!m || m === 'none' || f >= 1) continue;
    const f0 = Math.max(0, f), e = 1 - f0;
    if (m === 'fade') a *= f0; else if (m === 'slide') dx += sg * e;
    else if (m === 'zoom') { a *= f0; s *= sg > 0 ? .5 + .5 * f0 : 1 + .5 * e; } else if (m === 'blur') { a *= f0; bl += e * 24; }
  }
  return [a, dx, s, bl];
}

/* ---------- Medya ---------- */
const pick = acc => { $('#file').accept = acc; $('#file').click(); };
$('#add').onclick = () => pick('video/*,image/*,audio/*');
$('#file').onchange = async e => {
  let first;
  for (const f of e.target.files) { const c = await addFile(f); if (c && !first) first = c; }
  e.target.value = ''; S.panel = null; if (first) S.t = first.start;
  render(); syncScroll(); refresh();
};
function addFile(f) {
  return new Promise(res => {
    const url = URL.createObjectURL(f), k = f.type.split('/')[0];
    const c = {id: ++uid, type: k === 'audio' ? 'audio' : 'video', kind: k, name: f.name, file: f, off: 0, speed: 1, vol: 1, filter: 'none', fit: 'contain', p: {}, kf: {}, tin: 'none', tout: 'none'};
    const done = () => { c.start = endOf(c.type); snap(); S.clips.push(c); S.sel = c.id; if (c.type === 'video') thumb(c); res(c); };
    if (k === 'image') {
      const el = new Image(); el.onload = () => { c.el = el; c.dur = 5; done(); };
      el.onerror = () => { toast('Görsel açılamadı'); res(); }; el.src = url; return;
    }
    const el = document.createElement(k === 'audio' ? 'audio' : 'video');
    el.preload = 'auto'; el.playsInline = true; el.onseeked = () => { if (!exporting) draw(); };
    el.onloadedmetadata = () => { c.el = el; c.src = c.dur = el.duration; done(); };
    el.onerror = () => { toast('Dosya açılamadı: ' + f.name); res(); }; el.src = url;
  });
}
function thumb(c) {
  const make = () => {
    const e = c.el, iw = e.videoWidth || e.naturalWidth, ih = e.videoHeight || e.naturalHeight; if (!iw) return;
    const t = document.createElement('canvas'); t.width = 112; t.height = Math.round(112 * ih / iw);
    t.getContext('2d').drawImage(e, 0, 0, t.width, t.height); c.thumb = t.toDataURL('image/jpeg', .6); render();
  };
  if (c.kind === 'image') return make();
  const v = c.el; v.addEventListener('seeked', function f() { v.removeEventListener('seeked', f); make(); });
  v.currentTime = Math.min(.3, c.dur / 2);
}
function addText() {
  snap();
  const c = {id: ++uid, type: 'text', kind: 'text', name: 'Metin', start: S.t, dur: 3, off: 0, speed: 1, text: 'Metin yaz', size: 64, color: '#ffffff', y: 75, p: {}, kf: {}, tin: 'fade', tout: 'fade'};
  S.clips.push(c); S.panel = 'tx'; S.sel = c.id; render(); refresh();
}

/* ---------- Düzenleme ---------- */
function split() {
  const c = cur() || S.clips.find(c => S.t > c.start && S.t < c.start + c.dur);
  if (!c || S.t <= c.start + .1 || S.t >= c.start + c.dur - .1) return toast('Playhead klibin içinde olmalı');
  snap(); const d = S.t - c.start, n = {...c, id: ++uid, start: S.t, dur: c.dur - d, off: c.off + d * c.speed, p: {...c.p}, kf: {}, tin: 'none'};
  for (const k in c.kf) n.kf[k] = c.kf[k].map(([u, v]) => [u - d, v]);
  c.dur = d; c.tout = 'none'; S.clips.push(n); render();
}
function del() { snap(); S.clips = S.clips.filter(c => c.id !== S.sel); S.sel = null; S.panel = null; render(); refresh(); }
function undo() { if (!hist.length) return toast('Geri alınacak işlem yok'); S.clips = hist.pop(); S.panel = null; render(); refresh(); }
const panel = n => { S.panel = S.panel === n ? null : n; renderPanel(); tools(); };

function tools() {
  const c = cur(), b = [], pb = (i, l, n) => [i, l, () => panel(n), S.panel === n];
  if (!c) b.push(['plus', 'Medya', () => pick('video/*,image/*')], ['music', 'Müzik', () => pick('audio/*')], ['text', 'Metin', addText]);
  else {
    b.push(['split', 'Böl', split]);
    if (c.type === 'text') b.push(pb('text', 'Düzenle', 'tx'));
    if (isMedia(c)) b.push(pb('speed', 'Hız', 'sp'), pb('vol', 'Ses', 'vol'));
    if (c.type === 'video') b.push(pb('filter', 'Filtre', 'flt'), pb('adj', 'Ayar', 'adj'), pb('fx', 'Efekt', 'fx'));
    if (c.type !== 'audio') b.push(pb('anim', 'Animasyon', 'an'), pb('trans', 'Geçiş', 'tr'));
    if (c.type === 'video') b.push(['fit', 'Doldur', () => { snap(); c.fit = c.fit === 'cover' ? 'contain' : 'cover'; refresh(); }, c.fit === 'cover']);
    b.push(['del', 'Sil', del]);
  }
  TB = b;
  $('#tools').innerHTML = b.map((x, i) => `<button class="tb${x[3] ? ' on' : ''}" data-i="${i}">${ic(x[0])}<span>${x[1]}</span></button>`).join('');
}
$('#tools').onclick = e => { const k = e.target.closest('.tb'); if (k) TB[k.dataset.i][2](); };
$('#panel').addEventListener('pointerdown', () => { if (cur()) snap(); });

function renderPanel() {
  const p = $('#panel'), c = cur(), n = S.panel;
  if (!c || !n) { S.panel = null; p.hidden = true; return; }
  p.hidden = false;
  if (PANELS[n]) {
    p.innerHTML = PANELS[n].map(k => { const d = PR[k]; return `<div class="pr"><label>${d.l} <b data-v="${k}"></b><input type="range" data-k="${k}" min="${d.min}" max="${d.max}" step="${d.st}" oninput="setP('${k}',this.value)"></label><button class="kb" data-k="${k}" onclick="kfT('${k}')" aria-label="Keyframe">◆</button></div>`; }).join('')
      + (n === 'an' ? '<button class="chip" onclick="clrKf()">Animasyonu temizle</button>' : '');
    pt = -1; syncPanel(); return;
  }
  const chips = (key, o) => Object.entries(o).map(([k, v]) => `<button class="chip${c[key] === k ? ' on' : ''}" onclick="set('${key}','${k}')">${Array.isArray(v) ? v[0] : v}</button>`).join('');
  p.innerHTML = n === 'sp' ? `<label>Hız <b>${c.speed}x</b><input type="range" min=".25" max="4" step=".05" value="${c.speed}" oninput="set('speed',this.value)"></label>`
    : n === 'vol' ? `<label>Ses <b>${Math.round(c.vol * 100)}%</b><input type="range" min="0" max="1" step=".05" value="${c.vol}" oninput="set('vol',this.value)"></label>`
    : n === 'flt' ? chips('filter', FILTERS)
    : n === 'tr' ? `<div class="trow"><span>Giriş</span>${chips('tin', TRS)}</div><div class="trow"><span>Çıkış</span>${chips('tout', TRS)}</div>`
    : `<textarea rows="2" oninput="set('text',this.value)">${c.text.replace(/</g, '&lt;')}</textarea>
       <label>Boyut<input type="range" min="24" max="180" value="${c.size}" oninput="set('size',this.value)"></label>
       <label>Dikey konum<input type="range" min="5" max="95" value="${c.y}" oninput="set('y',this.value)"></label>
       <label>Renk<input type="color" value="${c.color}" oninput="set('color',this.value)"></label>`;
}
function syncPanel() {
  const c = cur(); if (!c || !PANELS[S.panel]) return; const u = S.t - c.start;
  document.querySelectorAll('#panel input[data-k]').forEach(i => {
    const k = i.dataset.k, v = val(c, k, S.t); i.value = v; $(`b[data-v="${k}"]`).textContent = Math.round(v * 10) / 10;
    const b = $(`.kb[data-k="${k}"]`), a = c.kf[k] || [];
    b.classList.toggle('has', a.length > 0); b.classList.toggle('on', a.some(q => Math.abs(q[0] - u) < .06));
  });
}
window.set = (k, v) => {
  const c = cur(); if (!c) return;
  if (k === 'speed') { const sp = c.dur * c.speed; c.speed = +v; c.dur = sp / c.speed; $('#panel b').textContent = c.speed + 'x'; }
  else if (k === 'vol') { c.vol = +v; $('#panel b').textContent = Math.round(v * 100) + '%'; }
  else if (k === 'filter' || k === 'tin' || k === 'tout') { c[k] = v; renderPanel(); }
  else c[k] = (k === 'text' || k === 'color') ? v : +v;
  render();
};
window.setP = (k, v) => {
  const c = cur(); if (!c) return; v = +v;
  if (c.kf[k] && c.kf[k].length) {
    const u = Math.max(0, Math.min(c.dur, S.t - c.start)), a = c.kf[k], i = a.findIndex(q => Math.abs(q[0] - u) < .06);
    if (i >= 0) a[i][1] = v; else { a.push([u, v]); a.sort((p, q) => p[0] - q[0]); }
  } else c.p[k] = v;
  syncPanel(); render();
};
window.kfT = k => {
  const c = cur(), u = S.t - c.start; if (u < 0 || u > c.dur) return toast('Playhead klibin içinde olmalı');
  snap(); const a = c.kf[k] = c.kf[k] || [], i = a.findIndex(q => Math.abs(q[0] - u) < .06);
  if (i >= 0) { c.p[k] = a[i][1]; a.splice(i, 1); if (!a.length) delete c.kf[k]; }
  else { a.push([u, val(c, k, S.t)]); a.sort((p, q) => p[0] - q[0]); }
  syncPanel(); render();
};
window.clrKf = () => { const c = cur(); if (c) { snap(); c.kf = {}; syncPanel(); render(); } };

/* ---------- Timeline ---------- */
function render() {
  const pad = PAD(), W = total() * S.pps + pad * 2; $('#tlInner').style.width = W + 'px';
  const step = S.pps >= 100 ? 1 : S.pps >= 45 ? 2 : 5; let h = '';
  for (let s = 0; s * S.pps <= W - pad; s += step) h += `<span style="left:${pad + s * S.pps}px">${fmt(s)}</span>`;
  $('#ruler').innerHTML = h;
  document.querySelectorAll('.row').forEach(r => {
    r.innerHTML = '';
    S.clips.filter(c => c.type === r.dataset.t).forEach(c => {
      const d = document.createElement('div'); d.className = `clip ${c.type}${c.id === S.sel ? ' sel' : ''}`;
      d.style.left = pad + c.start * S.pps + 'px'; d.style.width = Math.max(30, c.dur * S.pps) + 'px';
      if (c.thumb) d.style.backgroundImage = `linear-gradient(#0005,#0005),url(${c.thumb})`;
      const l = document.createElement('i'), rr = document.createElement('i'), lb = document.createElement('span');
      l.className = 'h l'; rr.className = 'h r'; lb.className = 'lb'; lb.textContent = c.type === 'text' ? c.text : c.name;
      d.append(l, lb, rr);
      if (c.id === S.sel) Object.values(c.kf).flat().forEach(([u]) => { const k = document.createElement('b'); k.className = 'kd'; k.style.left = u * S.pps + 'px'; d.append(k); });
      d.onpointerdown = e => { if (c.id === S.sel) drag(e, c, d, pad); };
      d.onclick = () => { if (c.id !== S.sel) select(c.id); };
      r.append(d);
    });
  });
}
function drag(e, c, d, pad) {
  e.preventDefault();
  const m = e.target.classList.contains('l') ? 'l' : e.target.classList.contains('r') ? 'r' : 'm';
  snap(); d.setPointerCapture(e.pointerId);
  const x0 = e.clientX, c0 = {...c}, med = isMedia(c), pts = [0, S.t];
  S.clips.forEach(o => { if (o !== c) pts.push(o.start, o.start + o.dur); });
  const sn = v => { let b = v, bd = 8 / S.pps; for (const p of pts) { const q = Math.abs(v - p); if (q < bd) { bd = q; b = p; } } return b; };
  d.onpointermove = ev => {
    const dx = (ev.clientX - x0) / S.pps;
    if (m === 'm') { const s = Math.max(0, c0.start + dx), a = sn(s), b = sn(s + c.dur) - c.dur; c.start = Math.max(0, a !== s ? a : b); }
    else if (m === 'l') {
      let q = Math.max(dx, -c0.start); if (med) q = Math.max(q, -c0.off / c0.speed); q = Math.min(q, c0.dur - .2);
      c.start = c0.start + q; c.dur = c0.dur - q; c.off = c0.off + q * c0.speed;
    } else { let q = Math.max(dx, .2 - c0.dur); if (med) q = Math.min(q, (c0.src - c0.off) / c0.speed - c0.dur); c.dur = c0.dur + q; }
    d.style.left = pad + c.start * S.pps + 'px'; d.style.width = Math.max(30, c.dur * S.pps) + 'px';
  };
  d.onpointerup = d.onpointercancel = () => { d.onpointermove = null; render(); };
}
$('#tlInner').onclick = e => { if (!e.target.closest('.clip') && S.sel) select(null); };
sc.onscroll = () => { if (Math.abs(sc.scrollLeft - lastSet) < 2) return; lastSet = sc.scrollLeft; S.t = Math.min(total(), lastSet / S.pps); };
const dist = e => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
let pd = 0, p0 = 0;
sc.addEventListener('touchstart', e => { if (!exporting) pause(); if (e.touches.length === 2) { pd = dist(e); p0 = S.pps; } }, {passive: true});
sc.addEventListener('touchmove', e => { if (e.touches.length === 2 && pd) setZoom(p0 * dist(e) / pd); }, {passive: true});
sc.addEventListener('touchend', () => pd = 0);
sc.addEventListener('wheel', () => pause(), {passive: true});
const setZoom = v => { S.pps = Math.min(400, Math.max(10, v)); render(); syncScroll(); };
$('#zi').onclick = () => setZoom(S.pps * 1.4);
$('#zo').onclick = () => setZoom(S.pps / 1.4);
addEventListener('resize', () => { render(); syncScroll(); });

/* ---------- Oran ve oynatma ---------- */
function setRatio(r) { S.ratio = r; [cv.width, cv.height] = dims(r, 720); $('#ratio').textContent = r; }
$('#ratio').onclick = () => { if (!exporting) setRatio(RK[(RK.indexOf(S.ratio) + 1) % RK.length]); };
function audioGraph() {
  AC = AC || new AudioContext(); DST = DST || AC.createMediaStreamDestination();
  for (const c of S.clips) {
    const e = c.el;
    if (e && e.tagName !== 'IMG' && !e._n) { e._n = AC.createMediaElementSource(e); e._n.connect(AC.destination); e._n.connect(DST); }
  }
  return AC.resume();
}
const setIcon = () => $('#play').innerHTML = ic(S.play ? 'pause' : 'play');
function play() { if (!S.clips.length) return toast('Önce medya ekle'); audioGraph(); if (S.t >= total() - .05) S.t = 0; S.play = true; setIcon(); }
function pause() { if (S.play) { S.play = false; setIcon(); } }
$('#play').onclick = () => S.play ? pause() : play();
cv.onclick = () => $('#play').click();

function sync() {
  for (const c of S.clips) {
    if (!isMedia(c)) continue;
    const el = c.el, act = S.t >= c.start && S.t < c.start + c.dur;
    if (!act) { if (!el.paused) el.pause(); continue; }
    const want = c.off + (S.t - c.start) * c.speed;
    el.playbackRate = c.speed; el.volume = Math.min(1, c.vol * (c.type === 'video' ? trans(c, S.t)[0] : 1));
    if (S.play) {
      if (Math.abs(el.currentTime - want) > .3) el.currentTime = want;
      if (el.paused) el.play().catch(() => {});
    } else { if (!el.paused) el.pause(); if (Math.abs(el.currentTime - want) > .04) el.currentTime = want; }
  }
}

/* ---------- Render motoru (önizleme ve dışa aktarma aynı kodu kullanır) ---------- */
function mat(g, c, t, w, h, by) {
  const [a, dx, s, bl] = trans(c, t), sh = val(c, 'sh', t) / 100 * Math.min(w, h) * .025;
  g.globalAlpha = a * val(c, 'o', t) / 100;
  g.translate(w / 2 + val(c, 'x', t) / 100 * w + dx * w + sh * (Math.sin(t * 47) + Math.sin(t * 91)), h / 2 + by + val(c, 'y', t) / 100 * h + sh * (Math.cos(t * 53) + Math.sin(t * 77)));
  g.rotate(val(c, 'r', t) * Math.PI / 180); const k = val(c, 's', t) / 100 * s; g.scale(k, k); return bl;
}
function drawV(g, c, t, w, h) {
  const e = c.el, iw = e.videoWidth || e.naturalWidth, ih = e.videoHeight || e.naturalHeight; if (!iw) return;
  const k = (c.fit === 'cover' ? Math.max : Math.min)(w / iw, h / ih), dw = iw * k, dh = ih * k, u = Math.min(w, h) / 720;
  g.save(); const bl = mat(g, c, t, w, h, 0), F = [];
  if (c.filter !== 'none') F.push(FILTERS[c.filter][1]);
  for (const [q, fn, un] of [['br', 'brightness', '%'], ['ct', 'contrast', '%'], ['sa', 'saturate', '%'], ['hu', 'hue-rotate', 'deg']]) { const v = val(c, q, t); if (v !== PR[q].d) F.push(`${fn}(${v}${un})`); }
  const b = (val(c, 'bl', t) + bl) * u; if (b > 0) F.push(`blur(${b}px)`);
  g.filter = F.join(' ') || 'none';
  const px = val(c, 'px', t);
  if (px > 0) {
    const q = 2 + px * .6 * u, tw = Math.max(4, dw / q | 0), th = Math.max(4, dh / q | 0);
    tmp.width = tw; tmp.height = th; tmp.getContext('2d').drawImage(e, 0, 0, tw, th);
    g.imageSmoothingEnabled = false; g.drawImage(tmp, -dw / 2, -dh / 2, dw, dh);
  } else g.drawImage(e, -dw / 2, -dh / 2, dw, dh);
  g.restore();
  const vg = val(c, 'vg', t) / 100;
  if (vg > 0) {
    g.save(); g.globalAlpha = trans(c, t)[0] * val(c, 'o', t) / 100;
    const r = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .25, w / 2, h / 2, Math.hypot(w, h) * .55);
    r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, `rgba(0,0,0,${vg})`); g.fillStyle = r; g.fillRect(0, 0, w, h); g.restore();
  }
}
function drawT(g, c, t, w, h) {
  const fs = c.size * Math.min(w, h) / 720;
  g.save(); mat(g, c, t, w, h, (c.y / 100 - .5) * h);
  g.font = `800 ${fs}px system-ui,Arial,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.fillStyle = c.color; g.strokeStyle = '#000'; g.lineWidth = fs / 7;
  const ls = c.text.split('\n'), lh = fs * 1.2, y0 = -(ls.length - 1) * lh / 2;
  ls.forEach((x, i) => { g.strokeText(x, 0, y0 + i * lh, w * .92); g.fillText(x, 0, y0 + i * lh, w * .92); });
  g.restore();
}
function frame(g, w, h, t) {
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  if (!S.clips.length) { if (g === ctx) { g.fillStyle = '#555b6e'; g.font = '600 32px system-ui'; g.textAlign = 'center'; g.fillText('Medya eklemek için + bas', w / 2, h / 2); } return; }
  const act = S.clips.filter(c => t >= c.start && t < c.start + c.dur);
  act.filter(c => c.type === 'video').forEach(c => drawV(g, c, t, w, h));
  act.filter(c => c.type === 'text').forEach(c => drawT(g, c, t, w, h));
}
const draw = () => frame(ctx, cv.width, cv.height, S.t);
function ui() {
  const T = total(); $('#tc').textContent = fmt(S.t); $('#tt').textContent = fmt(T);
  if (S.play) { lastSet = S.t * S.pps; sc.scrollLeft = lastSet; }
  if (PANELS[S.panel] && pt !== S.t) { pt = S.t; syncPanel(); }
  if (exporting && !X.hq && $('#pct')) prg(T ? S.t / T * 100 : 0);
}
function loop(ts) {
  if (S.play) {
    S.t += Math.min((ts - last) / 1000, .1);
    if (S.t >= total()) { S.t = total(); pause(); if (exporting && finishExport) finishExport(); }
  }
  last = ts; sync(); if (!X.hq || !exporting) draw(); ui(); requestAnimationFrame(loop);
}

/* ---------- Dışa aktarma ---------- */
function sheet() {
  const o = $('#ovl'); o.hidden = false;
  const ch = (g, l) => l.map(([v, t]) => `<button class="chip${X[g] === v ? ' on' : ''}" onclick="xo('${g}',${v})">${t}</button>`).join('');
  const [w, h] = dims(S.ratio, X.res), mb = (w * h * X.fps * QB[X.q] / 1e6).toFixed(1);
  o.innerHTML = `<div class="sheet"><b>Dışa aktar</b><small>Çözünürlük</small><div class="cr">${ch('res', [[720, '720p'], [1080, '1080p'], [1440, '2K']])}</div>
    <small>Kare hızı</small><div class="cr">${ch('fps', [[24, '24'], [30, '30'], [60, '60']])}</div>
    <small>Kalite</small><div class="cr">${ch('q', [[0, 'Normal'], [1, 'Yüksek'], [2, 'Maksimum']])}</div>
    <small>${HQ ? `${w}×${h}, yaklaşık ${mb} Mb/sn, H.264 MP4` : 'Bu tarayıcı hızlı dışa aktarmayı desteklemiyor, gerçek zamanlı kayıt kullanılacak (720p).'}</small>
    <div class="cr"><button class="pill" onclick="$('#ovl').hidden=true">Vazgeç</button><button class="pill pri" onclick="startExport()">Başlat</button></div></div>`;
}
window.xo = (g, v) => { X[g] = v; sheet(); };
$('#exp').onclick = () => { if (!S.clips.length) return toast('Önce medya ekle'); pause(); sheet(); };
function progUI() {
  $('#ovl').innerHTML = `<div class="sheet"><b>Dışa aktarılıyor… <span id="pct">0%</span></b><div id="prog"><i></i></div><small id="ps">Sekmeyi açık, ekranı uyanık tut.</small><button class="pill" id="cancel">İptal</button></div>`;
  $('#cancel').onclick = () => { X.cancel = true; if (rtCancel) rtCancel(); };
}
function prg(p, m) { $('#prog i').style.width = p + '%'; $('#pct').textContent = Math.round(p) + '%'; if (m) $('#ps').textContent = m; }
function save(blob, ext) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'studiopro-' + Date.now() + '.' + ext; a.click(); toast('Video hazır'); }
window.startExport = async () => {
  X.cancel = false; X.hq = HQ; progUI(); exporting = true;
  try { await (HQ ? exportHQ() : exportRT()); }
  catch (e) { toast('Dışa aktarma hatası: ' + (e.message || e)); }
  exporting = false; rtCancel = null; $('#ovl').hidden = true; S.t = 0; syncScroll();
};
const seek = (el, t) => new Promise(r => {
  if (Math.abs(el.currentTime - t) < .002 && el.readyState >= 2) return r();
  const f = () => { el.removeEventListener('seeked', f); r(); };
  el.addEventListener('seeked', f); el.currentTime = Math.min(t, el.duration - .001); setTimeout(r, 2000);
});
async function mixAudio(T, sr) {
  const oc = new OfflineAudioContext(2, Math.max(1, Math.ceil(T * sr)), sr), cache = new Map();
  for (const c of S.clips) {
    if (!isMedia(c) || !c.vol) continue; let buf;
    try { buf = cache.get(c.file) || await oc.decodeAudioData(await c.file.arrayBuffer()); cache.set(c.file, buf); } catch (e) { continue; }
    const src = oc.createBufferSource(), g = oc.createGain(); src.buffer = buf; src.playbackRate.value = c.speed; g.gain.setValueAtTime(c.vol, 0);
    if (c.type === 'video') {
      if (c.tin === 'fade') { g.gain.setValueAtTime(0, c.start); g.gain.linearRampToValueAtTime(c.vol, c.start + .6); }
      if (c.tout === 'fade') { g.gain.setValueAtTime(c.vol, c.start + c.dur - .6); g.gain.linearRampToValueAtTime(0, c.start + c.dur); }
    }
    src.connect(g).connect(oc.destination); src.start(c.start, c.off, c.dur * c.speed);
  }
  return oc.startRendering();
}
async function exportHQ() {
  const T = total(), fps = X.fps, [w, h] = dims(S.ratio, X.res), n = Math.ceil(T * fps), sr = 48000, bps = Math.round(w * h * fps * QB[X.q]);
  const off = document.createElement('canvas'); off.width = w; off.height = h; const g = off.getContext('2d');
  let vc, ac;
  for (const cd of ['avc1.640034', 'avc1.640033', 'avc1.64002A', 'avc1.640028', 'avc1.42E01F']) {
    const cfg = {codec: cd, width: w, height: h, bitrate: bps, framerate: fps};
    if ((await VideoEncoder.isConfigSupported(cfg)).supported) { vc = cfg; break; }
  }
  if (!vc) throw new Error('Bu cihazda H.264 kodlayıcı yok, çözünürlüğü düşür');
  for (const cd of ['mp4a.40.2', 'opus']) {
    const cfg = {codec: cd, sampleRate: sr, numberOfChannels: 2, bitrate: 192000};
    if ((await AudioEncoder.isConfigSupported(cfg)).supported) { ac = cfg; break; }
  }
  const mux = new Mp4Muxer.Muxer({target: new Mp4Muxer.ArrayBufferTarget(), video: {codec: 'avc', width: w, height: h},
    audio: ac ? {codec: ac.codec === 'opus' ? 'opus' : 'aac', numberOfChannels: 2, sampleRate: sr} : undefined, fastStart: 'in-memory'});
  let err; const ve = new VideoEncoder({output: (c, m) => mux.addVideoChunk(c, m), error: e => err = e}); ve.configure(vc);
  S.clips.forEach(c => isMedia(c) && c.el.pause());
  for (let i = 0; i < n; i++) {
    if (X.cancel || err) break;
    const t = i / fps;
    await Promise.all(S.clips.filter(c => c.kind === 'video' && t >= c.start && t < c.start + c.dur).map(c => seek(c.el, c.off + (t - c.start) * c.speed)));
    frame(g, w, h, t);
    const f = new VideoFrame(off, {timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps)});
    ve.encode(f, {keyFrame: i % (fps * 2) === 0}); f.close();
    while (ve.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 4));
    if (i % 3 === 0) { prg(i / n * 88, `Kare ${i} / ${n}`); await new Promise(r => setTimeout(r)); }
  }
  if (err) throw err; if (X.cancel) return;
  await ve.flush();
  if (ac) {
    prg(90, 'Ses işleniyor…');
    const buf = await mixAudio(T, sr), ae = new AudioEncoder({output: (c, m) => mux.addAudioChunk(c, m), error: e => err = e}); ae.configure(ac);
    const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
    for (let p = 0; p < L.length; p += sr) {
      const N = Math.min(sr, L.length - p), d = new Float32Array(N * 2); d.set(L.subarray(p, p + N)); d.set(R.subarray(p, p + N), N);
      const ad = new AudioData({format: 'f32-planar', sampleRate: sr, numberOfFrames: N, numberOfChannels: 2, timestamp: Math.round(p / sr * 1e6), data: d}); ae.encode(ad); ad.close();
    }
    await ae.flush(); if (err) throw err;
  }
  prg(98, 'Dosya hazırlanıyor…'); mux.finalize(); save(new Blob([mux.target.buffer], {type: 'video/mp4'}), 'mp4');
}
async function exportRT() {
  if (!window.MediaRecorder) throw new Error('Tarayıcı desteklemiyor');
  await audioGraph(); setRatio(S.ratio);
  const mime = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
  const stream = cv.captureStream(30); DST.stream.getAudioTracks().forEach(t => stream.addTrack(t));
  const rec = new MediaRecorder(stream, {mimeType: mime, videoBitsPerSecond: 8e6}), parts = [];
  rec.ondataavailable = e => e.data.size && parts.push(e.data);
  return new Promise(res => {
    rec.onstop = () => { finishExport = null; if (!X.cancel) save(new Blob(parts, {type: mime}), mime.includes('mp4') ? 'mp4' : 'webm'); res(); };
    finishExport = () => rec.state !== 'inactive' && rec.stop(); rtCancel = () => { pause(); finishExport(); };
    S.t = 0; syncScroll(); rec.start(250); setTimeout(play, 400);
  });
}

/* ---------- Başlangıç ---------- */
addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA/.test(e.target.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); $('#play').click(); }
  else if (e.key === 'Delete' && cur()) del();
  else if (e.key.toLowerCase() === 's') split();
});
$('#add').innerHTML = ic('plus'); $('#undo').innerHTML = ic('undo'); $('#undo').onclick = undo;
setIcon(); setRatio('9:16'); render(); refresh(); requestAnimationFrame(loop);
