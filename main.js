// ==========================================
// 1. IMPORT & KONFIGURASI FIREBASE
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getDatabase, ref as dbRef, onValue } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js";
import { getStorage, ref as storageRef, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

// Konfigurasi Firebase Project Anda
const firebaseConfig = {
  apiKey: "AIzaSyBIdAspxe_duNrktQujrNrcVD553aQFvFM",
  authDomain: "varuna-asv.firebaseapp.com",
  databaseURL: "https://varuna-asv-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "varuna-asv",
  storageBucket: "varuna-asv.firebasestorage.app",
  messagingSenderId: "1081087333757",
  appId: "1:1081087333757:web:63406bde7becdc59e4a814"
};

// Inisialisasi Firebase Client
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const storage = getStorage(app);

// Referensi DOM Elements
const elSOG = document.getElementById('SOG');
const elCOG = document.getElementById('COG');
const elPos = document.getElementById('Position');
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
            data: [], // Data akan diisi realtime
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

// Variable untuk mencegah duplikasi titik chart beruntun yang sama
let lastX = null;
let lastY = null;

// Fungsi update tampilan data dashboard
function updateDashboard(data) {
    if (!data) return;

    // Update Text (Penyesuaian nama field dari Python ke Firebase)
    if (elSOG) elSOG.innerHTML = (data.SOG !== undefined ? Number(data.SOG).toFixed(2) : "0.0") + " Knot";
    if (elCOG) elCOG.innerHTML = (data.COG !== undefined ? Number(data.COG).toFixed(1) : "0") + "&#176;";
    if (elPos) elPos.innerHTML = data.Position || "--";
    if (elGeo) elGeo.innerHTML = data.Geotag || "--";
    if (elSkor) elSkor.innerHTML = data.Score !== undefined ? data.Score : 0;

    // Update Chart (Push data titik koordinat baru)
    if (data.x != null && data.y != null && !isNaN(data.x) && !isNaN(data.y)) {
        if (data.x !== lastX || data.y !== lastY) {
            chart.data.datasets[0].data.push({ x: Number(data.x), y: Number(data.y) });
            
            // Batasi maksimal 200 titik di chart agar performa browser tetap ringan
            if (chart.data.datasets[0].data.length > 200) {
                chart.data.datasets[0].data.shift();
            }
            
            chart.update();
            lastX = data.x;
            lastY = data.y;
        }
    }
}

// ==========================================
// 3. LOGIKA REALTIME DATABASE (FIREBASE)
// ==========================================
const dataNodeRef = dbRef(database, "data");

// Listener Realtime (Otomatis terpanggil setiap ada update data dari Python)
onValue(dataNodeRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        console.log("🔥 Data Realtime Diterima:", data);
        updateDashboard(data);
    } else {
        console.warn("⚠️ Node 'data' di Firebase kosong.");
    }
}, (error) => {
    console.error("❌ Error membaca Realtime Database:", error);
});

// ==========================================
// 4. LOGIKA GAMBAR (FIREBASE STORAGE)
// ==========================================
function updateImages() {
    console.log("🔄 Mengecek gambar baru di Firebase Storage...");

    const timestamp = new Date().getTime(); // Anti-cache browser

    // 1. Ambil URL Surface Cam
    if (imgSurface) {
        getDownloadURL(storageRef(storage, 'images/surface.jpg'))
            .then((url) => {
                imgSurface.src = url + "&t=" + timestamp;
                console.log("✅ Surface Cam Updated");
            })
            .catch(() => {
                // Abaikan jika gambar belum diupload dari Python
            });
    }

    // 2. Ambil URL Underwater Cam
    if (imgUnderwater) {
        getDownloadURL(storageRef(storage, 'images/underwater.jpg'))
            .then((url) => {
                imgUnderwater.src = url + "&t=" + timestamp;
                console.log("✅ Underwater Cam Updated");
            })
            .catch(() => {
                // Abaikan jika gambar belum diupload dari Python
            });
    }
}

// Cek dan refresh gambar setiap 4 detik
setInterval(updateImages, 4000);
updateImages(); // Jalankan pertama kali saat halaman dimuat

// ==========================================
// 5. MODAL IMAGE (POPUP GAMBAR)
// ==========================================
const modal = document.createElement("div");
modal.id = "imageModal";
modal.style.display = "none";
modal.style.position = "fixed";
modal.style.zIndex = "1000";
modal.style.left = "0";
modal.style.top = "0";
modal.style.width = "100%";
modal.style.height = "100%";
modal.style.backgroundColor = "rgba(0,0,0,0.85)";
modal.style.justifyContent = "center";
modal.style.alignItems = "center";

modal.innerHTML = `
    <div style="position:relative; background:#fff; padding:20px; border-radius:10px; max-width:85%; max-height:85vh; text-align:center;">
        <span class="close-modal" style="position:absolute; top:10px; right:15px; font-size:28px; cursor:pointer; font-weight:bold; color:#333;">&times;</span>
        <img id="modalImage" style="max-width:100%; max-height:70vh; border-radius:6px; object-fit:contain;" alt="Detail Camera">
        <div id="caption" style="margin-top:10px; font-weight:600; color:#333; font-family:'Montserrat', sans-serif;"></div>
    </div>
`;
document.body.appendChild(modal);

const modalImg = document.getElementById("modalImage");
const captionText = document.getElementById("caption");
const closeModalBtn = modal.querySelector(".close-modal");

function openModal(imgElem, title) {
    if (imgElem) {
        imgElem.onclick = () => {
            modal.style.display = "flex";
            modalImg.src = imgElem.src;
            captionText.innerHTML = title;
        };
    }
}

openModal(imgSurface, "Surface Camera View");
openModal(imgUnderwater, "Underwater Camera View");

if (closeModalBtn) {
    closeModalBtn.onclick = () => { modal.style.display = "none"; };
}
modal.onclick = (e) => {
    if (e.target === modal) modal.style.display = "none";
};