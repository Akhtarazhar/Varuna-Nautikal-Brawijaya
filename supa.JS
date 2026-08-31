// ==========================================
// 1. KONFIGURASI SUPABASE
// ==========================================
const SUPABASE_URL = "https://usljlghwqdfprvmbnvlv.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzbGpsZ2h3cWRmcHJ2bWJudmx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MDc0MzMsImV4cCI6MjEwMDQ4MzQzM30.lVS9iDg08k7sww0T7xO1Yw4xH0bYVEuAE1PyDXZUvtE"; 

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
const elSOG = document.getElementById('SOG');
const elCOG = document.getElementById('COG');
const elPos = document.getElementById('Position');
const elHeading = document.getElementById('heading');
const elGeo = document.getElementById('geot');
const elSkor = document.getElementById('skor');
const imgSurface = document.getElementById('cam-surface');
const imgUnderwater = document.getElementById('cam-underwater');

// ==========================================
// 2. SETUP CHART.JS
// ==========================================
const ctx = document.getElementById('realtimePlot').getContext('2d');

const chart = new Chart(ctx, {
    type: 'line',
    data: {
        datasets: [{
            label: 'Lintasan ASV',
            data: [], 
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            fill: false,
            tension: 0.1,
            showLine: true,
            pointRadius: 3
        }]
    },
    options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: { type: 'linear', min: 0, max: 30, beginAtZero: true },
            y: { min: 0, max: 30, beginAtZero: true }
        },
        plugins: {
            legend: { display: false }
        }
    }
});

// Fungsi untuk menerjemahkan derajat heading menjadi mata angin
function getCardinalDirection(heading) {
    if (heading == null) return "--";
    
    // Normalisasi nilai agar selalu berada di antara 0-360
    let h = heading % 360;
    if (h < 0) h += 360;

    if (h >= 315 || h < 45) {
        return "North";
    } else if (h >= 45 && h < 135) {
        return "East";
    } else if (h >= 135 && h < 225) {
        return "South";
    } else {
        return "West";
    }
}

// Fungsi update dashboard
function updateDashboard(data) {
    if (!data) return;

    // Update Text
    if (elSOG) elSOG.innerHTML = (data.sog !== undefined ? data.sog : 0) + " Knot";
    if (elCOG) elCOG.innerHTML = (data.cog !== undefined ? data.cog : 0) + "&#176;";
    if (elHeading) {
        let headingValue = data.heading !== undefined ? data.heading : 0;
        let cardinal = getCardinalDirection(headingValue);
    
    // Menampilkan format: "North (0°)" atau hanya "North" saja
        elHeading.innerHTML = cardinal;
    }
    if (elPos) elPos.innerHTML = data.position || data.position_label || "--";
    if (elGeo) elGeo.innerHTML = data.geotag || data.raw_coordinate || data.koordinat || "--";
    if (elSkor) elSkor.innerHTML = data.score || 0;

    // Update Chart
    if (data.x != null && data.y != null) {
        const posX = parseFloat(data.x);
        const posY = parseFloat(data.y);

        chart.data.datasets[0].data.push({ x: posX, y: posY });
        
        // Batasi maksimal 200 titik di grafik
        if (chart.data.datasets[0].data.length > 200) {
            chart.data.datasets[0].data.shift();
        }
        chart.update();
    }
}

// ==========================================
// 3. LOGIKA REALTIME DATABASE
// ==========================================
async function fetchLatestData() {
    const { data, error } = await supabase
        .from('mission_logs')
        .select('*')
        .order('id', { ascending: false })
        .limit(1)
        .single();

    if (data) updateDashboard(data);
}
fetchLatestData();

const channel = supabase.channel('realtime-mission')
    .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mission_logs' },
        (payload) => {
            console.log('⚡ Realtime Data Diterima:', payload.new);
            updateDashboard(payload.new);
        }
    )
    .subscribe();

// ==========================================
// 4. LOGIKA GAMBAR (STORAGE)
// ==========================================
async function updateImages() {
    const { data, error } = await supabase
        .storage
        .from('mission_images')
        .list('', {
            limit: 10,
            sortBy: { column: 'created_at', order: 'desc' }
        });

    if (error || !data || data.length === 0) return;

    const surfaceFile = data.find(f => f.name.includes('green') || f.name.includes('surface'));
    const underwaterFile = data.find(f => f.name.includes('blue') || f.name.includes('underwater'));
    const timestamp = new Date().getTime(); 

    if (surfaceFile && imgSurface) {
        const { data: publicUrl } = supabase.storage.from('mission_images').getPublicUrl(surfaceFile.name);
        imgSurface.src = publicUrl.publicUrl + "?t=" + timestamp;
    }

    if (underwaterFile && imgUnderwater) {
        const { data: publicUrl } = supabase.storage.from('mission_images').getPublicUrl(underwaterFile.name);
        imgUnderwater.src = publicUrl.publicUrl + "?t=" + timestamp;
    }
}

setInterval(updateImages, 3000);
updateImages();

// ==========================================
// 5. MODAL IMAGE (POPUP)
// ==========================================
var modal = document.createElement("div");
modal.id = "imageModal";
modal.innerHTML = `
    <div class="modal-content">
        <span class="close">&times;</span>
        <img id="modalImage" alt="Image Detail">
        <div id="caption"></div>
    </div>
`;
document.body.appendChild(modal);

const modalImg = document.getElementById("modalImage");
const captionText = document.getElementById("caption");
const span = modal.querySelector(".close");

function openModal() {
    modal.style.display = "block";
    modalImg.src = this.src;
    captionText.innerHTML = this.alt;
}

if (imgSurface) imgSurface.onclick = openModal;
if (imgUnderwater) imgUnderwater.onclick = openModal;

if (span) {
    span.onclick = function() {
        modal.style.display = "none";
    }
}
window.onclick = function(event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
}