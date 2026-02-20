// ─────────────────────────────────────────────
// LOADING UI
// ─────────────────────────────────────────────
const prog    = document.getElementById('prog');
const ovNote  = document.getElementById('ov-note');
const overlay = document.getElementById('overlay');

function setStep(n, note) {
    for (let i = 1; i < n; i++) {
        const el = document.getElementById('s' + i);
        el.classList.remove('active'); el.classList.add('done');
        el.querySelector('.step-icon').textContent = '✅';
    }
    const cur = document.getElementById('s' + n);
    if (cur) cur.classList.add('active');
    prog.style.width = ({ 1: '10', 2: '40', 3: '75' }[n] || '0') + '%';
    if (note) ovNote.textContent = note;
}

function doneLoading(note) {
    [1,2,3].forEach(i => {
        const el = document.getElementById('s' + i);
        el.classList.remove('active'); el.classList.add('done');
        el.querySelector('.step-icon').textContent = '✅';
    });
    prog.style.width = '100%';
    ovNote.textContent = note || 'Prêt !';
    setTimeout(() => overlay.classList.add('hidden'), 600);
}

// ─────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────
const RAYON_KM    = 100;
const DEFAULT_LAT = 46.5;
const DEFAULT_LON = 2;

// ─────────────────────────────────────────────
// ÉTAPE 1 — CARTE  (preferCanvas = rendu unique sur <canvas>)
// ─────────────────────────────────────────────
setStep(1, 'Initialisation de la carte…');

const urlP = new URLSearchParams(window.location.search);
const uLat = parseFloat(urlP.get('lat'));
const uLon = parseFloat(urlP.get('lon'));
const uZoom = parseInt(urlP.get('zoom'));

const map = L.map('map', {
    preferCanvas: true,   // ← CRITIQUE : 1 canvas au lieu de N éléments DOM
    zoomSnap: 0.5
}).setView(
    (!isNaN(uLat) && !isNaN(uLon)) ? [uLat, uLon] : [DEFAULT_LAT, DEFAULT_LON],
    !isNaN(uZoom) ? uZoom : 6
);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap', maxZoom: 19
}).addTo(map);

if (!isNaN(uLat) && !isNaN(uLon)) {
    L.marker([uLat, uLon]).addTo(map)
        .bindTooltip("Utilisateur", { permanent: true, direction: "top" });
}

// ─────────────────────────────────────────────
// ÉTAT GLOBAL
// ─────────────────────────────────────────────
let userLat = null, userLon = null, userMarker = null;

// Couche de markers (canvas)
const markersLayer = L.layerGroup().addTo(map);

// Index pour éviter la superposition exacte
const coordIdx = {};

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371, d2r = Math.PI / 180;
    const dLat = (lat2 - lat1) * d2r;
    const dLon = (lon2 - lon1) * d2r;
    const a = Math.sin(dLat/2)**2 +
              Math.cos(lat1*d2r)*Math.cos(lat2*d2r)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Tooltips uniquement au survol (hover), jamais permanentes
function syncTooltips() { /* désactivé — tooltips hover uniquement */ }

// Créer un marker — popup en LAZY (construit au premier clic seulement)
function creerMarker(lat, lon, label, adresse) {
    const key = lat + ',' + lon;
    coordIdx[key] = (coordIdx[key] || 0) + 1;
    const off = coordIdx[key] * 0.00002;

    const m = L.circleMarker([lat + off, lon + off], {
        radius: 10,
        color: '#c0392b',
        weight: 2,
        fillColor: '#e74c3c',
        fillOpacity: 0.9,
        interactive: true
    });

    // Tooltip au survol (léger — pas de DOM permanent)
    m.bindTooltip(label, {
        permanent: false,
        direction: 'top',
        offset: [0, -10],
        className: 'tip-arm'
    });

    // Popup LAZY : le HTML n'est construit qu'au premier clic
    let popupReady = false;
    m.on('click', () => {
        if (!popupReady) {
            m.bindPopup(`
                <div style="font-family:'Segoe UI',sans-serif;font-size:13px;line-height:1.6">
                  <b>📦 ${label}</b><br>
                  <span style="color:#555">📍 ${adresse}</span><br><br>
                  <a href="https://www.google.com/maps?q=${lat},${lon}"
                     target="_blank"
                     style="display:block;text-align:center;padding:8px;background:#1a73e8;
                            color:#fff;font-weight:bold;text-decoration:none;border-radius:6px">
                     🗺️ Ouvrir dans Google Maps
                  </a>
                </div>`, { maxWidth: 280, minWidth: 190 });
            popupReady = true;
        }
        m.openPopup();
    });

    markersLayer.addLayer(m);
}

// ─────────────────────────────────────────────
// ÉTAPE 3 — CHARGEMENT CSV FILTRÉ
// Astuce : on lit tout en `complete` (1 seule opération JS),
// puis on filtre et crée les markers par batch via requestAnimationFrame
// pour ne pas bloquer le thread UI.
// ─────────────────────────────────────────────
function chargerCSV(refLat, refLon, rayon = RAYON_KM) {
    setStep(3, 'Téléchargement des données…');

    Papa.parse('points.csv', {
        download: true,
        header: true,
        delimiter: ";",
        // complete = lecture unique en mémoire (bien plus rapide que step)
        complete: function(results) {
            ovNote.textContent = 'Filtrage des armoires proches…';
            prog.style.width = '80%';

            // Filtrer en mémoire (rapide, pas de DOM)
            const rows = results.data.filter(r => {
                const lat = parseFloat(r.latitude);
                const lon = parseFloat(r.Longitude);
                if (isNaN(lat) || isNaN(lon)) return false;
                return haversine(refLat, refLon, lat, lon) <= rayon;
            });

            // Insérer les markers par lots de 200 via rAF
            // → le navigateur peut respirer entre chaque lot
            let i = 0;
            const BATCH = 200;

            function insertBatch() {
                const end = Math.min(i + BATCH, rows.length);
                for (; i < end; i++) {
                    const r = rows[i];
                    creerMarker(
                        parseFloat(r.latitude),
                        parseFloat(r.Longitude),
                        r.Référence || '',
                        r.Adresse   || ''
                    );
                }
                if (i < rows.length) {
                    ovNote.textContent = `Affichage… ${i} / ${rows.length} armoires`;
                    requestAnimationFrame(insertBatch);
                } else {
                    syncTooltips();
                    doneLoading(`✅ ${rows.length} armoire(s) chargée(s)${rayon < 20000 ? ` dans un rayon de ${rayon} km` : ''}.`);
                }
            }

            requestAnimationFrame(insertBatch);
        },
        error: function(err) {
            ovNote.textContent = '❌ Erreur de chargement du CSV.';
            console.error(err);
        }
    });
}

// ─────────────────────────────────────────────
// ÉTAPE 2 — GÉOLOCALISATION
// ─────────────────────────────────────────────
function recentrer() {
    if (userLat !== null) {
        map.setView([userLat, userLon], 13);
        if (userMarker) userMarker.openPopup();
    }
}

setTimeout(() => {
    setStep(2, 'Demande de géolocalisation…');

    if (!navigator.geolocation) {
        ovNote.textContent = 'Géolocalisation non disponible — France entière.';
        chargerCSV(DEFAULT_LAT, DEFAULT_LON);
        return;
    }

    navigator.geolocation.getCurrentPosition(
        pos => {
            userLat = pos.coords.latitude;
            userLon = pos.coords.longitude;
            map.setView([userLat, userLon], 13);
            userMarker = L.marker([userLat, userLon]).addTo(map)
                .bindTooltip("Vous êtes ici", { permanent: true, direction: "top" })
                .bindPopup("🌍 Votre position actuelle");
            ovNote.textContent = 'Position trouvée !';
            chargerCSV(userLat, userLon);
        },
        err => {
            console.warn('Géoloc échouée :', err.message);

            // Message explicatif selon la cause
            const msgs = {
                1: '🚫 Géolocalisation refusée par le navigateur — toutes les armoires sont affichées.',
                2: '📡 Signal GPS indisponible — toutes les armoires sont affichées.',
                3: '⏱️ Délai de géolocalisation dépassé — toutes les armoires sont affichées.'
            };
            const msg = msgs[err.code] || '❌ Position indisponible — toutes les armoires sont affichées.';

            // Afficher un bandeau d'avertissement visible sur la carte
            const banner = document.createElement('div');
            banner.style.cssText = `
                position:fixed; bottom:70px; left:50%; transform:translateX(-50%);
                background:rgba(30,30,40,0.95); color:#f0c040;
                border:1px solid rgba(240,192,64,0.4); border-radius:10px;
                padding:12px 20px; font-family:'Segoe UI',sans-serif;
                font-size:13px; font-weight:600; z-index:5000;
                box-shadow:0 4px 16px rgba(0,0,0,0.4); text-align:center;
                max-width:90vw; animation: fadeInUp 0.4s ease;
            `;
            banner.textContent = msg;
            document.body.appendChild(banner);
            setTimeout(() => banner.remove(), 6000);

            // Charger TOUT (rayon = rayon de la Terre ≈ 20 000 km)
            chargerCSV(DEFAULT_LAT, DEFAULT_LON, 20000);
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}, 350);
