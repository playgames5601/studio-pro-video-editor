'use strict';
const $ = s => document.querySelector(s);
const cv = $('#cv'), ctx = cv.getContext('2d');
const RES = {'9:16': [720, 1280], '16:9': [1280, 720], '1:1': [1000, 1000]};
const FILTERS = {
  none: ['Yok', 'none'], bw: ['Siyah-beyaz', 'grayscale(1)'], sepia: ['Sepya', 'sepia(.8)'],
  vivid: ['Canlı', 'saturate(1.8) contrast(1.1)'], cool: ['Soğuk', 'hue-rotate(190deg) saturate(1.2)'],
  warm: ['Sıcak', 'sepia(.35) saturate(1.4) hue-rotate(-10deg)'], bright: ['Parlak', 'brightness(1.3)'],
  dark: ['Koyu', 'brightness(.75) contrast(1.2)']
};
const S = {clips: [], sel: null, t: 0, play: false, pps: 60, ratio: '9:16'};
let uid = 0, last = 0, exporting = false, finishExport = null, AC, DST, hist = [];

const cur = () => S.clips.find(c => c.id === S.sel);
const total = () => Math.max(0, ...S.clips.map(c => c.start + c.dur));
const fmt = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');
const endOf = type => Math.max(0, ...S.clips.filter(c => c.type === type).map(c => c.start + c.dur));
const isMedia = c => c.kind === 'video' || c.kind === 'audio';
const snap = () => { hist.push(S.clips.map(c => ({...c}))); if (hist.length > 40) hist.shift(); };
function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.i); toast.i = setTimeout(() => t.hidden = true, 1800); }

/* ---------- Medya ekleme ---------- */
$('#add').onclick = () => $('#file').click();
$('#file').onchange = async e => {
  for (const f of e.target.files) await addFile(f);
  e.target.value = ''; render(); fill();
};
function addFile(f) {
  return new Promise(res => {
    const url = URL.createObjectURL(f), k = f.type.split('/')[0];
    const c = {id: ++uid, type: k === 'audio' ? 'audio' : 'video', kind: k, name: f.name, off: 0, speed: 1, vol: 1, filter: 'none', fit: 'contain', fade: false};
    const done = () => { c.start = endOf(c.type); snap(); S.clips.push(c); S.sel = c.id; res(); };
    if (k === 'image') {
      const el = new Image();
      el.onload = () => { c.el = el; c.dur = 5; done(); };
      el.onerror = () => { toast('Görsel açılamadı'); res(); };
      el.src = url; return;
    }
    const el = document.createElement(k === 'audio' ? 'audio' : 'video');
    el.preload = 'auto'; el.playsInline = true; el.onseeked = () => draw();
    el.onloadedmetadata = () => { c.el = el; c.src = c.dur = el.duration; done(); };
    el.onerror = () => { toast('Dosya açılamadı: ' + f.name); res(); };
    el.src = url;
  });
}
$('#text').onclick = () => {
  snap();
  const c = {id: ++uid, type: 'text', kind: 'text', name: 'Metin', start: S.t, dur: 3, off: 0, speed: 1, text: 'Metin yaz', size: 64, color: '#ffffff', y: 75, fade: true};
  S.clips.push(c); S.sel = c.id; render(); fill();
};

/* ---------- Düzenleme ---------- */
$('#split').onclick = () => {
  const c = cur() || S.clips.find(c => S.t > c.start && S.t < c.start + c.dur);
  if (!c || S.t <= c.start + .1 || S.t >= c.start + c.dur - .1) return toast('Playhead klibin içinde olmalı');
  snap();
  const d = S.t - c.start;
  S.clips.push({...c, id: ++uid, start: S.t, dur: c.dur - d, off: c.off + d * c.speed});
  c.dur = d; render();
};
$('#del').onclick = () => { if (!cur()) return toast('Önce bir klip seç'); snap(); S.clips = S.clips.filter(c => c.id !== S.sel); S.sel = null; render(); fill(); };
$('#undo').onclick = () => { if (!hist.length) return toast('Geri alınacak işlem yok'); S.clips = hist.pop(); render(); fill(); };

/* ---------- Inspector ---------- */
const show = (sel, ok) => document.querySelectorAll(sel).forEach(e => e.hidden = !ok);
$('#flt').innerHTML = Object.entries(FILTERS).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('');
function fill() {
  const c = cur(); $('#insp').hidden = !c; if (!c) return;
  const vis = c.type === 'video', tx = c.type === 'text';
  show('.m', isMedia(c)); show('.vis', vis); show('.tx', tx); show('.fd', vis || tx);
  $('#sp').value = c.speed; $('#spv').textContent = c.speed + 'x'; $('#vol').value = c.vol;
  $('#flt').value = c.filter; $('#fit').checked = c.fit === 'cover'; $('#fade').checked = !!c.fade;
  if (tx) { $('#txt').value = c.text; $('#sz').value = c.size; $('#py').value = c.y; $('#col').value = c.color; }
}
const on = (id, f) => $(id).addEventListener('input', e => { const c = cur(); if (c) { f(c, e.target); render(); } });
on('#sp', (c, i) => { const span = c.dur * c.speed; c.speed = +i.value; c.dur = span / c.speed; $('#spv').textContent = c.speed + 'x'; });
on('#vol', (c, i) => c.vol = +i.value);
on('#flt', (c, i) => c.filter = i.value);
on('#fit', (c, i) => c.fit = i.checked ? 'cover' : 'contain');
on('#fade', (c, i) => c.fade = i.checked);
on('#txt', (c, i) => c.text = i.value);
on('#sz', (c, i) => c.size = +i.value);
on('#py', (c, i) => c.y = +i.value);
on('#col', (c, i) => c.color = i.value);

/* ---------- Timeline ---------- */
function render() {
  const W = Math.max(innerWidth, (total() + 6) * S.pps);
  $('#tlInner').style.width = W + 'px';
  const step = S.pps >= 100 ? 1 : S.pps >= 45 ? 2 : 5; let h = '';
  for (let s = 0; s * S.pps < W; s += step) h += `<span style="left:${s * S.pps}px">${fmt(s)}</span>`;
  $('#ruler').innerHTML = h;
  document.querySelectorAll('.row').forEach(r => {
    r.innerHTML = '';
    S.clips.filter(c => c.type === r.dataset.t).forEach(c => {
      const d = document.createElement('div');
      d.className = `clip ${c.type}${c.id === S.sel ? ' sel' : ''}`;
      d.style.left = c.start * S.pps + 'px'; d.style.width = Math.max(30, c.dur * S.pps) + 'px';
      const l = document.createElement('i'), rr = document.createElement('i');
      l.className = 'h l'; rr.className = 'h r';
      d.append(l, document.createTextNode(c.type === 'text' ? c.text : c.name), rr);
      d.onpointerdown = e => drag(e, c, d);
      r.append(d);
    });
  });
}
function drag(e, c, d) {
  e.preventDefault(); e.stopPropagation();
  const m = e.target.classList.contains('l') ? 'l' : e.target.classList.contains('r') ? 'r' : 'm';
  if (S.sel !== c.id) { S.sel = c.id; document.querySelectorAll('.clip').forEach(x => x.classList.remove('sel')); d.classList.add('sel'); fill(); }
  snap(); d.setPointerCapture(e.pointerId);
  const x0 = e.clientX, c0 = {...c}, med = isMedia(c);
  const pts = [0, S.t]; S.clips.forEach(o => { if (o !== c) pts.push(o.start, o.start + o.dur); });
  const sn = v => { let b = v, bd = 8 / S.pps; for (const p of pts) { const q = Math.abs(v - p); if (q < bd) { bd = q; b = p; } } return b; };
  d.onpointermove = ev => {
    const dx = (ev.clientX - x0) / S.pps;
    if (m === 'm') {
      let s = Math.max(0, c0.start + dx); const a = sn(s), b = sn(s + c.dur) - c.dur;
      c.start = Math.max(0, a !== s ? a : b);
    } else if (m === 'l') {
      let q = Math.max(dx, -c0.start); if (med) q = Math.max(q, -c0.off / c0.speed); q = Math.min(q, c0.dur - .2);
      c.start = c0.start + q; c.dur = c0.dur - q; c.off = c0.off + q * c0.speed;
    } else {
      let q = Math.max(dx, .2 - c0.dur); if (med) q = Math.min(q, (c0.src - c0.off) / c0.speed - c0.dur);
      c.dur = c0.dur + q;
    }
    d.style.left = c.start * S.pps + 'px'; d.style.width = Math.max(30, c.dur * S.pps) + 'px';
  };
  d.onpointerup = d.onpointercancel = () => { d.onpointermove = null; render(); };
}
const rl = $('#ruler');
const seek = e => { S.t = Math.min(total(), Math.max(0, (e.clientX - $('#tlInner').getBoundingClientRect().left) / S.pps)); };
rl.onpointerdown = e => { if (exporting) return; pause(); rl.setPointerCapture(e.pointerId); seek(e); rl.onpointermove = seek; };
rl.onpointerup = () => rl.onpointermove = null;
$('#zi').onclick = () => { S.pps = Math.min(400, S.pps * 1.4); render(); };
$('#zo').onclick = () => { S.pps = Math.max(10, S.pps / 1.4); render(); };

/* ---------- Oran ---------- */
function setRatio(r) {
  S.ratio = r; [cv.width, cv.height] = RES[r];
  document.querySelectorAll('#ratios button').forEach(b => b.classList.toggle('on', b.dataset.r === r));
}
$('#ratios').onclick = e => { if (e.target.dataset.r && !exporting) setRatio(e.target.dataset.r); };

/* ---------- Oynatma ---------- */
function audioGraph() {
  AC = AC || new AudioContext(); DST = DST || AC.createMediaStreamDestination();
  for (const c of S.clips) {
    const e = c.el;
    if (e && e.tagName !== 'IMG' && !e._n) { e._n = AC.createMediaElementSource(e); e._n.connect(AC.destination); e._n.connect(DST); }
  }
  return AC.resume();
}
function play() {
  if (!S.clips.length) return toast('Önce medya ekle');
  audioGraph(); if (S.t >= total() - .05) S.t = 0; S.play = true;
}
function pause() { S.play = false; }
$('#play').onclick = () => S.play ? pause() : play();
const alpha = c => c.fade ? Math.max(0, Math.min(1, (S.t - c.start) / .5, (c.start + c.dur - S.t) / .5)) : 1;

function sync() {
  for (const c of S.clips) {
    if (!isMedia(c)) continue;
    const el = c.el, act = S.t >= c.start && S.t < c.start + c.dur;
    if (!act) { if (!el.paused) el.pause(); continue; }
    const want = c.off + (S.t - c.start) * c.speed;
    el.playbackRate = c.speed; el.volume = Math.min(1, c.vol * (c.type === 'video' ? alpha(c) : 1));
    if (S.play) {
      if (Math.abs(el.currentTime - want) > .3) el.currentTime = want;
      if (el.paused) el.play().catch(() => {});
    } else {
      if (!el.paused) el.pause();
      if (Math.abs(el.currentTime - want) > .04) el.currentTime = want;
    }
  }
}
function draw() {
  const [w, h] = RES[S.ratio]; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  const act = S.clips.filter(c => S.t >= c.start && S.t < c.start + c.dur);
  for (const c of act.filter(c => c.type === 'video')) {
    const el = c.el, iw = el.videoWidth || el.naturalWidth, ih = el.videoHeight || el.naturalHeight; if (!iw) continue;
    const k = (c.fit === 'cover' ? Math.max : Math.min)(w / iw, h / ih), dw = iw * k, dh = ih * k;
    ctx.save(); ctx.globalAlpha = alpha(c); ctx.filter = FILTERS[c.filter][1];
    ctx.drawImage(el, (w - dw) / 2, (h - dh) / 2, dw, dh); ctx.restore();
  }
  for (const c of act.filter(c => c.type === 'text')) {
    ctx.save(); ctx.globalAlpha = alpha(c); ctx.font = `800 ${c.size}px system-ui,Arial,sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.fillStyle = c.color; ctx.strokeStyle = '#000'; ctx.lineWidth = c.size / 7;
    const ls = c.text.split('\n'), lh = c.size * 1.2, y0 = h * c.y / 100 - (ls.length - 1) * lh / 2;
    ls.forEach((t, i) => { ctx.strokeText(t, w / 2, y0 + i * lh, w * .92); ctx.fillText(t, w / 2, y0 + i * lh, w * .92); });
    ctx.restore();
  }
}
function ui() {
  const T = total();
  $('#time').textContent = fmt(S.t) + ' / ' + fmt(T); $('#play').textContent = S.play ? '❚❚' : '▶';
  const x = S.t * S.pps; $('#head').style.transform = `translateX(${x}px)`;
  if (S.play) { const sc = $('#tlScroll'); if (x > sc.scrollLeft + sc.clientWidth - 30 || x < sc.scrollLeft) sc.scrollLeft = x - 40; }
  if (exporting) { const p = Math.min(100, T ? S.t / T * 100 : 0); $('#prog i').style.width = p + '%'; $('#pct').textContent = Math.round(p) + '%'; }
}
function loop(ts) {
  if (S.play) {
    S.t += Math.min((ts - last) / 1000, .1);
    if (S.t >= total()) { S.t = total(); pause(); if (exporting && finishExport) finishExport(); }
  }
  last = ts; sync(); draw(); ui(); requestAnimationFrame(loop);
}

/* ---------- Dışa aktarma ---------- */
$('#exp').onclick = async () => {
  if (!S.clips.length) return toast('Önce medya ekle');
  if (!window.MediaRecorder) return toast('Tarayıcın dışa aktarmayı desteklemiyor');
  await audioGraph(); pause();
  const mime = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
  const stream = cv.captureStream(30); DST.stream.getAudioTracks().forEach(t => stream.addTrack(t));
  const rec = new MediaRecorder(stream, {mimeType: mime, videoBitsPerSecond: 8e6}), parts = []; let cancelled = false;
  rec.ondataavailable = e => e.data.size && parts.push(e.data);
  rec.onstop = () => {
    exporting = false; finishExport = null; $('#ovl').hidden = true; S.t = 0;
    if (cancelled) return;
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(parts, {type: mime}));
    a.download = 'studiopro-' + Date.now() + (mime.includes('mp4') ? '.mp4' : '.webm'); a.click(); toast('Video hazır');
  };
  finishExport = () => rec.state !== 'inactive' && rec.stop();
  $('#cancel').onclick = () => { cancelled = true; pause(); finishExport(); };
  S.t = 0; exporting = true; $('#ovl').hidden = false; rec.start(250);
  setTimeout(play, 400);
};

/* ---------- Klavye ve başlangıç ---------- */
addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); $('#play').click(); }
  else if (e.key === 'Delete' || e.key === 'Backspace') $('#del').click();
  else if (e.key.toLowerCase() === 's') $('#split').click();
});
setRatio('9:16'); render(); fill(); requestAnimationFrame(loop);
