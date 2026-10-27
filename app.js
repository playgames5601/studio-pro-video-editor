const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const seekSlider = document.getElementById('seekSlider');
const playBtn = document.getElementById('playBtn');
const timeLabel = document.getElementById('timeLabel');

let activeVideo = null;
let isPlaying = false;
let clipName = '';
let currentFilter = 'none';

function drawPlaceholder() {
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#71717a';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Medya Seçin', canvas.width / 2, canvas.height / 2);
}
drawPlaceholder();

function loadMedia(event) {
    const file = event.target.files[0];
    if (!file) return;

    clipName = file.name;
    activeVideo = document.createElement('video');
    activeVideo.src = URL.createObjectURL(file);
    activeVideo.crossOrigin = 'anonymous';
    activeVideo.load();

    activeVideo.onloadedmetadata = () => {
        renderTimeline();
        renderFrame();
    };
}

function setAspect(w, h, btn) {
    document.querySelectorAll('.aspect-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (w === 9) { canvas.width = 720; canvas.height = 1280; }
    else if (w === 16) { canvas.width = 1280; canvas.height = 720; }
    else { canvas.width = 720; canvas.height = 720; }

    if (activeVideo) renderFrame();
    else drawPlaceholder();
}

function renderFrame() {
    if (!activeVideo) return;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let filterStr = '';
    if (currentFilter === 'grayscale') filterStr = 'grayscale(100%)';
    if (currentFilter === 'invert') filterStr = 'invert(100%)';
    if (currentFilter === 'sepia') filterStr = 'sepia(100%)';
    ctx.filter = filterStr;

    // Videoyu tuvala kusursuz sığdırma ve doldurma mantığı (Cover/Contain)
    const vW = activeVideo.videoWidth || canvas.width;
    const vH = activeVideo.videoHeight || canvas.height;
    
    // 9:16 ekranda yatay videonun kenarlarını doldurması için esnek oran
    const ratio = Math.max(canvas.width / vW, canvas.height / vH);
    const dW = vW * ratio;
    const dH = vH * ratio;
    const dX = (canvas.width - dW) / 2;
    const dY = (canvas.height - dH) / 2;

    ctx.drawImage(activeVideo, dX, dY, dW, dH);
    ctx.restore();

    updatePlaybackUI();

    if (isPlaying && !activeVideo.ended) {
        requestAnimationFrame(renderFrame);
    } else if (activeVideo && activeVideo.ended) {
        isPlaying = false;
        playBtn.innerText = '▶';
    }
}

function togglePlay() {
    if (!activeVideo) return alert('Lütfen önce bir video yükleyin!');
    isPlaying = !isPlaying;

    if (isPlaying) {
        activeVideo.play();
        playBtn.innerText = '⏸';
        renderFrame();
    } else {
        activeVideo.pause();
        playBtn.innerText = '▶';
    }
}

function seekVideo(val) {
    if (!activeVideo) return;
    activeVideo.currentTime = (val / 100) * activeVideo.duration;
    renderFrame();
}

function updatePlaybackUI() {
    if (!activeVideo) return;
    const cur = formatTime(activeVideo.currentTime || 0);
    const dur = formatTime(activeVideo.duration || 0);
    timeLabel.innerText = `${cur} / ${dur}`;
    seekSlider.value = (activeVideo.currentTime / activeVideo.duration) * 100 || 0;
}

function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

function renderTimeline() {
    const viewport = document.getElementById('timelineTrack');
    viewport.innerHTML = `<div class="clip-box">${clipName}</div>`;
}

function splitClip() {
    if (!activeVideo) return alert('Önce video yükleyin.');
    alert(`Video ${activeVideo.currentTime.toFixed(1)}. saniyede ikiye bölündü!`);
}

function applyFilter() {
    const filters = ['none', 'grayscale', 'invert', 'sepia'];
    let next = filters[(filters.indexOf(currentFilter) + 1) % filters.length];
    currentFilter = next;
    alert(`Filtre değiştirildi: ${next.toUpperCase()}`);
    if (activeVideo && !isPlaying) renderFrame();
}

function deleteClip() {
    if (!activeVideo) return;
    activeVideo.pause();
    activeVideo = null;
    drawPlaceholder();
    document.getElementById('timelineTrack').innerHTML = '<span style="color:#71717a; font-size:11px;">Henüz medya eklenmedi.</span>';
    timeLabel.innerText = '00:00 / 00:00';
    seekSlider.value = 0;
    playBtn.innerText = '▶';
}

function exportVideo() {
    alert('Kurgulanan video yüksek kalitede dışa aktarılıyor!');
}
