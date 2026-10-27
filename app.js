const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const seekSlider = document.getElementById('seekSlider');
const playBtn = document.getElementById('playBtn');
const timeLabel = document.getElementById('timeLabel');

let activeVideo = null;
let isPlaying = false;
let clipName = '';

let videoTransform = {
    scale: 1,
    filter: 'none'
};

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
    if (videoTransform.filter === 'grayscale') filterStr = 'grayscale(100%)';
    if (videoTransform.filter === 'invert') filterStr = 'invert(100%)';
    if (videoTransform.filter === 'sepia') filterStr = 'sepia(100%)';
    ctx.filter = filterStr;

    // Proportional Center Crop Fit
    const vWidth = activeVideo.videoWidth || canvas.width;
    const vHeight = activeVideo.videoHeight || canvas.height;
    const scaleFactor = Math.min(canvas.width / vWidth, canvas.height / vHeight) * videoTransform.scale;

    const drawW = vWidth * scaleFactor;
    const drawH = vHeight * scaleFactor;
    const drawX = (canvas.width - drawW) / 2;
    const drawY = (canvas.height - drawH) / 2;

    ctx.drawImage(activeVideo, drawX, drawY, drawW, drawH);
    ctx.restore();

    updatePlaybackUI();

    if (isPlaying && !activeVideo.ended) {
        requestAnimationFrame(renderFrame);
    } else if (activeVideo.ended) {
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
    if (!activeVideo) return;
    alert(`Video ${activeVideo.currentTime.toFixed(1)}. saniyede bölündü!`);
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
    alert('Kurgulanan video dışa aktarılıyor!');
}
