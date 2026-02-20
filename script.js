// ------------------
// 0. Lire paramètres URL
// ------------------
function getURLParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        lat: parseFloat(params.get('lat')),
        lon: parseFloat(params.get('lon')),
        zoom: parseInt(params.get('zoom'))
    };
}
const params = getURLParams();
const coordIndex = {};
const allMarkers = []; // stocker tous les markers pour gérer les tooltips

// ------------------
// 1. Initialiser la carte
// ------------------
const defaultLat = 46.5;
const defaultLon = 2;
const defaultZoom = 6;

const map = L.map('map', { preferCanvas: false }).setView(
    (!isNaN(params.lat) && !isNaN(params.lon))
        ? [params.lat, params.lon]
        : [defaultLat, defaultLon],
    (!isNaN(params.zoom))
        ? params.zoom
        : defaultZoom
);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

// Marqueur utilisateur (si transmis via URL)
if (!isNaN(params.lat) && !isNaN(params.lon)) {
    L.marker([params.lat, params.lon])
        .addTo(map)
        .bindTooltip("Utilisateur", { permanent: true, direction: "top" });
}

// ------------------
// 2. Gestion des tooltips selon le zoom
// Seuil : zoom >= 14 ≈ vue < 2km
// ------------------
const ZOOM_SEUIL = 14;

function updateTooltips() {
    const zoomActuel = map.getZoom();
    const afficher = zoomActuel >= ZOOM_SEUIL;
    allMarkers.forEach(marker => {
        const tooltip = marker.getTooltip();
        if (tooltip) {
            if (afficher) {
                tooltip.options.permanent = true;
                // Forcer l'ouverture si pas déjà ouverte
                if (!marker.isTooltipOpen()) {
                    marker.openTooltip();
                }
            } else {
                if (marker.isTooltipOpen()) {
                    marker.closeTooltip();
                }
                tooltip.options.permanent = false;
            }
        }
    });
}

map.on('zoomend', updateTooltips);

// ------------------
// 3. Charger et afficher le CSV
// ------------------
Papa.parse('points.csv', {
    download: true,
    header: true,
    delimiter: ";",
    step: function(row) {
        const lat = parseFloat(row.data.latitude);
        const lon = parseFloat(row.data.Longitude);
        const label = row.data.Référence || '';
        const Adresse = row.data.Adresse || '';

        if (!isNaN(lat) && !isNaN(lon)) {
            const key = lat + ',' + lon;
            coordIndex[key] = (coordIndex[key] || 0) + 1;
            const offset = coordIndex[key] * 0.00002;

            const marker = L.circleMarker([lat + offset, lon + offset], {
                radius: 10,               // Gros point, facile à toucher
                color: '#c0392b',         // Bordure rouge foncé
                weight: 2,
                fillColor: '#e74c3c',     // Rouge vif
                fillOpacity: 0.9
            })
            .addTo(map)
            .bindTooltip(label, {
                permanent: false,         // géré dynamiquement par updateTooltips
                direction: 'top',
                offset: [0, -10],
                className: 'tooltip-armoire'
            })
            .bindPopup(`
                <div style="font-family:'Segoe UI',sans-serif;font-size:13px;line-height:1.6;">
                  <b style="font-size:14px;">📦 ${label}</b><br>
                  <span style="color:#555;">📍 ${Adresse}</span><br><br>
                  <a href="https://www.google.com/maps?q=${lat},${lon}" 
                     target="_blank" 
                     style="display:block;text-align:center;padding:9px;background:#1a73e8;color:#fff;font-weight:bold;text-decoration:none;border-radius:6px;">
                     🗺️ Ouvrir dans Google Maps
                  </a>
                </div>
            `, {
                maxWidth: 300,
                minWidth: 200
            });

            allMarkers.push(marker);
        }
    },
    complete: function() {
        // Appliquer l'état initial des tooltips après chargement
        updateTooltips();
    }
});

// ------------------
// 4. Style CSS injecté pour les tooltips
// ------------------
const style = document.createElement('style');
style.textContent = `
    .tooltip-armoire {
        background: rgba(30, 30, 30, 0.88);
        color: #fff;
        border: none;
        border-radius: 5px;
        padding: 4px 8px;
        font-size: 12px;
        font-weight: 600;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        white-space: nowrap;
    }
    .tooltip-armoire::before {
        border-top-color: rgba(30, 30, 30, 0.88) !important;
    }
`;
document.head.appendChild(style);

// ------------------
// 5. Géolocalisation utilisateur
// ------------------
function geolocateUser() {
    if (!navigator.geolocation) {
        alert("La géolocalisation n'est pas supportée par votre navigateur.");
        return;
    }
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            map.setView([lat, lon], 14);
            L.marker([lat, lon])
                .addTo(map)
                .bindTooltip("Vous êtes ici", { permanent: true, direction: "top" })
                .bindPopup("🌍 Position actuelle")
                .openPopup();
        },
        (err) => {
            console.error(err);
            alert("Impossible de récupérer votre position.");
        },
        { enableHighAccuracy: true }
    );
}

// Lancement automatique
geolocateUser();
