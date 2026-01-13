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
const coordIndex = {}; // pour gérer les points GPS identiques

// ------------------
// 1. Initialiser la carte
// ------------------
const defaultLat = 46.5;
const defaultLon = 2;
const defaultZoom = 6;

const map = L.map('map', { preferCanvas: true }).setView(
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
// 2. Charger et afficher le CSV
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
            const offset = coordIndex[key] * 0.00002; // ~2 mètres

            L.circleMarker([lat + offset, lon + offset], {
                radius: 3,
                color: 'red',
                fillOpacity: 0.6
            })
            .addTo(map)
            .bindTooltip(label, { direction: 'top' })
            .bindPopup(`
                <div style="font-size:13px; line-height:1.4;">
                  <b>Référence :</b> ${label}<br>
                  <b>Adresse :</b> ${Adresse}<br><br>
                  <a href="https://www.google.com/maps?q=${lat},${lon}" 
                     target="_blank" 
                     style="display:block;text-align:center;padding:8px;background:#1a73e8;color:#fff;font-weight:bold;text-decoration:none;border-radius:5px;">
                     📍 Ouvrir dans Google Maps
                  </a>
                </div>
            `, {
                maxWidth: 300,
                minWidth: 200
            });
        }
    }
});

// ------------------
// 3. Géolocalisation utilisateur
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
