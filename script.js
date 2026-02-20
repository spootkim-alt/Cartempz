// =====================================================
// UTILITAIRES CHARGEMENT
// =====================================================
const overlay      = document.getElementById('loading-overlay');
const progressFill = document.getElementById('progress-fill');
const loaderNote   = document.getElementById('loader-note');

function setStep(num, note) {
    // Marquer les étapes précédentes comme "done"
    for (let i = 1; i < num; i++) {
        const el = document.getElementById('step-' + i);
        if (el) {
            el.classList.remove('active');
            el.classList.add('done');
            el.querySelector('.step-icon').textContent = '✅';
        }
    }
    // Marquer l'étape courante comme active
    const cur = document.getElementById('step-' + num);
    if (cur) cur.classList.add('active');

    // Progression par étape
    const pct = { 1: 10, 2: 40, 3: 75 }[num] || 0;
    progressFill.style.width = pct + '%';
    if (note) loaderNote.textContent = note;
}

function finishLoading() {
    [1, 2, 3].forEach(i => {
        const el = document.getElementById('step-' + i);
        if (el) {
            el.classList.remove('active');
            el.classList.add('done');
            el.querySelector('.step-icon').textContent = '✅';
        }
    });
    progressFill.style.width = '100%';
    loaderNote.textContent = 'Carte prête !';
    setTimeout(() => overlay.classList.add('hidden'), 700);
}

// =====================================================
// 0. PARAMÈTRES URL
// =====================================================
function getURLParams() {
    const p = new URLSearchParams(window.location.search);
    return {
        lat:  parseFloat(p.get('lat')),
        lon:  parseFloat(p.get('lon')),
        zoom: parseInt(p.get('zoom'))
    };
}
const urlParams = getURLParams();

// =====================================================
// 1. INITIALISER LA CARTE  (Étape 1)
// =====================================================
setStep(1, 'Initialisation de la carte…');

const defaultLat  = 46.5;
const defaultLon  = 2;
const defaultZoom = 6;

const map = L.map('map', { preferCanvas: false }).setView(
    (!isNaN(urlParams.lat) && !isNaN(urlParams.lon))
        ? [urlParams.lat, urlParams.lon]
        : [defaultLat, defaultLon],
    !isNaN(urlParams.zoom) ? urlParams.zoom : defaultZoom
);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19
}).addTo(map);

// Marqueur URL éventuel
if (!isNaN(urlParams.lat) && !isNaN(urlParams.lon)) {
    L.marker([urlParams.lat, urlParams.lon])
        .addTo(map)
        .bindTooltip("Utilisateur", { permanent: true, direction: "top" });
}

// =====================================================
// VARIABLES GLOBALES
// =====================================================
const coordIndex = {};
const allMarkers = [];
const ZOOM_SEUIL = 14;   // zoom ≥ 14 ≈ vue < 2 km → tooltips permanentes
const RAYON_KM   = 100;  // filtre géographique

let userLat = null;
let userLon = null;
let userMarker = null;

// =====================================================
// HELPERS
// =====================================================

// Distance Haversine (km)
function distanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Gestion tooltips selon zoom
function updateTooltips() {
    const show = map.getZoom() >= ZOOM_SEUIL;
    allMarkers.forEach(m => {
        const tt = m.getTooltip();
        if (!tt) return;
        if (show) {
            tt.options.permanent = true;
            if (!m.isTooltipOpen()) m.openTooltip();
        } else {
            if (m.isTooltipOpen()) m.closeTooltip();
            tt.options.permanent = false;
        }
    });
}
map.on('zoomend', updateTooltips);

// Ajouter un marker armoire
function ajouterMarker(lat, lon, label, adresse) {
    const key = lat + ',' + lon;
    coordIndex[key] = (coordIndex[key] || 0) + 1;
    const offset = coordIndex[key] * 0.00002;

    const marker = L.circleMarker([lat + offset, lon + offset], {
        radius: 10,
        color: '#c0392b',
        weight: 2,
        fillColor: '#e74c3c',
        fillOpacity: 0.9
    })
    .addTo(map)
    .bindTooltip(label, {
        permanent: false,
        direction: 'top',
        offset: [0, -10],
        className: 'tooltip-armoire'
    })
    .bindPopup(`
        <div style="font-family:'Segoe UI',sans-serif;font-size:13px;line-height:1.6;">
          <b style="font-size:14px;">📦 ${label}</b><br>
          <span style="color:#555;">📍 ${adresse}</span><br><br>
          <a href="https://www.google.com/maps?q=${lat},${lon}"
             target="_blank"
             style="display:block;text-align:center;padding:9px;background:#1a73e8;color:#fff;font-weight:bold;text-decoration:none;border-radius:6px;">
             🗺️ Ouvrir dans Google Maps
          </a>
        </div>
    `, { maxWidth: 300, minWidth: 200 });

    allMarkers.push(marker);
}

// Bouton Me localiser (bouton flottant)
function recentrerUtilisateur() {
    if (userLat !== null && userLon !== null) {
        map.setView([userLat, userLon], 13);
        if (userMarker) userMarker.openPopup();
    }
}

// =====================================================
// 3. CHARGEMENT CSV FILTRÉ  (Étape 3)
// =====================================================
function chargerArmoiresProches(refLat, refLon) {
    setStep(3, 'Téléchargement des données…');

    let count = 0;
    let total = 0;

    Papa.parse('points.csv', {
        download: true,
        header: true,
        delimiter: ";",
        step: function(row) {
            total++;
            const lat = parseFloat(row.data.latitude);
            const lon = parseFloat(row.data.Longitude);
            if (isNaN(lat) || isNaN(lon)) return;

            const dist = distanceKm(refLat, refLon, lat, lon);
            if (dist <= RAYON_KM) {
                const label   = row.data.Référence || '';
                const adresse = row.data.Adresse   || '';
                ajouterMarker(lat, lon, label, adresse);
                count++;

                // Mise à jour visuelle tous les 50 points traités
                if (total % 50 === 0) {
                    loaderNote.textContent = `${count} armoire(s) trouvée(s) sur ${total} lues…`;
                    const fill = Math.min(95, 75 + (count / 10));
                    progressFill.style.width = fill + '%';
                }
            }
        },
        complete: function() {
            loaderNote.textContent = `✅ ${count} armoire(s) dans un rayon de ${RAYON_KM} km.`;
            updateTooltips();
            finishLoading();
        },
        error: function(err) {
            loaderNote.textContent = '❌ Erreur lors du chargement du fichier CSV.';
            console.error(err);
        }
    });
}

// =====================================================
// SÉQUENCE PRINCIPALE
// =====================================================
setTimeout(() => {
    setStep(2, 'Demande de géolocalisation…');

    if (!navigator.geolocation) {
        loaderNote.textContent = 'Géolocalisation non supportée — centré sur la France.';
        chargerArmoiresProches(defaultLat, defaultLon);
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            userLat = position.coords.latitude;
            userLon = position.coords.longitude;

            // Recentrer la carte sur l'utilisateur
            map.setView([userLat, userLon], 13);

            // Marqueur utilisateur
            userMarker = L.marker([userLat, userLon])
                .addTo(map)
                .bindTooltip("Vous êtes ici", { permanent: true, direction: "top" })
                .bindPopup("🌍 Votre position actuelle");

            loaderNote.textContent = 'Position trouvée ! Chargement des armoires proches…';

            // Charger uniquement les points dans les 100 km
            chargerArmoiresProches(userLat, userLon);
        },
        (err) => {
            console.warn('Géolocalisation échouée :', err.message);
            loaderNote.textContent = 'Position indisponible — chargement centré sur la France…';
            chargerArmoiresProches(defaultLat, defaultLon);
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}, 400); // Petit délai pour laisser la carte s'afficher
