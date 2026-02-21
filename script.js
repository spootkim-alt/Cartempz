// ════════════════════════════════════════════
// ANIMATION FUSÉE SUR LE CONTOUR FRANCE
// ════════════════════════════════════════════
const bouncePts = [
  [127.6,12.0],[126.0,23.2],[105.1,32.9],[98.7,45.7],
  [65.0,34.5],[68.2,61.8],[16.8,55.3],[12.0,77.8],
  [36.1,90.7],[37.7,101.9],[47.3,97.1],[69.8,135.6],
  [65.0,220.7],[95.5,227.1],[150.1,243.2],[156.5,235.2],
  [161.3,240.0],[159.7,223.9],[174.1,211.1],[223.9,220.7],
  [246.4,201.4],[248.0,185.4],[235.2,180.6],[233.6,132.4],
  [217.5,122.8],[240.0,98.7],[248.0,50.5],[201.4,39.3],
  [188.6,23.2],[177.4,26.4],[179.0,16.8],[156.5,12.0]
];
const pingColors = ['#ff3300','#ff8800','#00dd55','#ff5500','#00cc44'];

const rocketWrap = document.getElementById('rocket-wrap');
const franceWrap = document.getElementById('france-wrap');
const trailCanvas = document.getElementById('trail-canvas');
const trailCtx   = trailCanvas.getContext('2d');

let bounceIdx = 0, bounceTimer = null, trail = [], pingIdx = 0;

function angleTo(a, b) {
    return Math.atan2(b[1]-a[1], b[0]-a[0]) * 180 / Math.PI + 90;
}

function moveRocket(i) {
    const pt   = bouncePts[i];
    const prev = bouncePts[(i-1+bouncePts.length) % bouncePts.length];
    rocketWrap.style.left      = (pt[0]-14) + 'px';
    rocketWrap.style.top       = (pt[1]-14) + 'px';
    rocketWrap.style.transform = `rotate(${angleTo(prev,pt)}deg)`;
    trail.push({x:pt[0], y:pt[1]});
    if (trail.length > 28) trail.shift();
    drawTrail();
    spawnPing(pt[0], pt[1]);
}

function drawTrail() {
    trailCtx.clearRect(0,0,250,250);
    for (let i=1; i<trail.length; i++) {
        const a=trail[i-1], b=trail[i], t=i/trail.length;
        trailCtx.beginPath(); trailCtx.moveTo(a.x,a.y); trailCtx.lineTo(b.x,b.y);
        trailCtx.strokeStyle = `rgba(${Math.round(255*(1-t*0.6))},${Math.round(220*t)},0,${t*0.75})`;
        trailCtx.lineWidth = 2.2;
        trailCtx.shadowColor = t > 0.7 ? '#00dd55' : '#ff5500';
        trailCtx.shadowBlur = 7;
        trailCtx.stroke();
    }
}

function spawnPing(x, y) {
    const p = document.createElement('div');
    p.className = 'ping';
    p.style.left = x+'px'; p.style.top = y+'px';
    p.style.background = pingColors[pingIdx++ % pingColors.length];
    franceWrap.appendChild(p);
    setTimeout(() => p.remove(), 700);
}

function startBounce() {
    moveRocket(bounceIdx);
    bounceTimer = setInterval(() => {
        bounceIdx = (bounceIdx+1) % bouncePts.length;
        moveRocket(bounceIdx);
    }, 300);
}

function stopBounce() {
    clearInterval(bounceTimer); bounceTimer = null;
}

// ════════════════════════════════════════════
// LOADING UI
// ════════════════════════════════════════════
const overlay  = document.getElementById('overlay');
const prog     = document.getElementById('prog');
const ovNote   = document.getElementById('ov-note');
const hudTitle = document.getElementById('hud-title');
const btnRetry = document.getElementById('btn-retry');

function setStep(n, note) {
    for (let i=1; i<n; i++) {
        const el = document.getElementById('s'+i);
        el.classList.remove('active','error');
        el.classList.add('done');
    }
    const cur = document.getElementById('s'+n);
    if (cur) { cur.classList.remove('done','error'); cur.classList.add('active'); }
    prog.style.width = ({1:'10',2:'42',3:'80'}[n]||'0') + '%';
    if (note) ovNote.textContent = note;
}

function stepEchec(label, note) {
    const el = document.getElementById('s2');
    el.classList.remove('active','done');
    el.classList.add('error');
    document.getElementById('s2-label').textContent = '02 — ✗ ' + label;
    ovNote.textContent = note;
    btnRetry.style.display = 'block';
    hudTitle.textContent   = '▸ SIGNAL GPS PERDU ◂';
    hudTitle.style.color   = 'rgba(255,60,60,.85)';
}

function doneLoading(note) {
    stopBounce();
    // Atterrissage au centre France
    rocketWrap.style.left      = '119px';
    rocketWrap.style.top       = '118px';
    rocketWrap.style.transform = 'rotate(0deg) scale(1.3)';

    [1,2,3].forEach(i => {
        const el = document.getElementById('s'+i);
        el.classList.remove('active','error');
        el.classList.add('done');
    });
    prog.style.width = '100%';
    ovNote.textContent   = note || '✓ PRÊT';
    hudTitle.textContent = '▸ SYSTÈME OPÉRATIONNEL ◂';
    hudTitle.style.color = 'rgba(0,220,80,.85)';

    // Disparition de l'overlay après 900ms
    setTimeout(() => overlay.classList.add('hidden'), 900);
}

// ════════════════════════════════════════════
// CONSTANTES
// ════════════════════════════════════════════
const RAYON_KM    = 100;
const DEFAULT_LAT = 46.5;
const DEFAULT_LON = 2;

// ════════════════════════════════════════════
// ÉTAPE 1 — CARTE
// ════════════════════════════════════════════
startBounce();
setStep(1, 'INITIALISATION CARTE…');

const urlP  = new URLSearchParams(window.location.search);
const uLat  = parseFloat(urlP.get('lat'));
const uLon  = parseFloat(urlP.get('lon'));
const uZoom = parseInt(urlP.get('zoom'));

const map = L.map('map', { preferCanvas: true, zoomSnap: 0.5 }).setView(
    (!isNaN(uLat) && !isNaN(uLon)) ? [uLat,uLon] : [DEFAULT_LAT,DEFAULT_LON],
    !isNaN(uZoom) ? uZoom : 6
);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap', maxZoom: 19
}).addTo(map);

if (!isNaN(uLat) && !isNaN(uLon)) {
    L.marker([uLat,uLon]).addTo(map)
     .bindTooltip("Utilisateur", { permanent:true, direction:"top" });
}

// ════════════════════════════════════════════
// ÉTAT GLOBAL
// ════════════════════════════════════════════
let userLat=null, userLon=null, userMarker=null;
const markersLayer = L.layerGroup().addTo(map);
const coordIdx = {};

// ════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════
function haversine(lat1,lon1,lat2,lon2) {
    const R=6371, d2r=Math.PI/180;
    const dLat=(lat2-lat1)*d2r, dLon=(lon2-lon1)*d2r;
    const a=Math.sin(dLat/2)**2+Math.cos(lat1*d2r)*Math.cos(lat2*d2r)*Math.sin(dLon/2)**2;
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function creerMarker(lat,lon,label,adresse) {
    const key=lat+','+lon;
    coordIdx[key]=(coordIdx[key]||0)+1;
    const off=coordIdx[key]*0.00002;

    const m = L.circleMarker([lat+off,lon+off], {
        radius:10, color:'#c0392b', weight:2,
        fillColor:'#e74c3c', fillOpacity:0.9, interactive:true
    });
    m.bindTooltip(label, { permanent:false, direction:'top', offset:[0,-10], className:'tip-arm' });

    let popupReady=false;
    m.on('click', () => {
        if (!popupReady) {
            m.bindPopup(`
                <div style="font-family:'Segoe UI',sans-serif;font-size:13px;line-height:1.6">
                  <b>📦 ${label}</b><br>
                  <span style="color:#555">📍 ${adresse}</span><br><br>
                  <a href="https://www.google.com/maps?q=${lat},${lon}" target="_blank"
                     style="display:block;text-align:center;padding:8px;background:#1a73e8;
                            color:#fff;font-weight:bold;text-decoration:none;border-radius:6px">
                     🗺️ Ouvrir dans Google Maps
                  </a>
                </div>`, { maxWidth:280, minWidth:190 });
            popupReady=true;
        }
        m.openPopup();
    });
    markersLayer.addLayer(m);
}

function recentrer() {
    if (userLat!==null) { map.setView([userLat,userLon],13); if(userMarker) userMarker.openPopup(); }
}

// ════════════════════════════════════════════
// ÉTAPE 3 — CHARGEMENT CSV FILTRÉ
// ════════════════════════════════════════════
function chargerCSV(refLat, refLon, rayon=RAYON_KM) {
    setStep(3, 'TÉLÉCHARGEMENT DES DONNÉES…');

    Papa.parse('points.csv', {
        download:true, header:true, delimiter:";",
        complete: function(results) {
            ovNote.textContent = 'FILTRAGE EN COURS…';
            prog.style.width = '83%';

            const rows = results.data.filter(r => {
                const lat=parseFloat(r.latitude), lon=parseFloat(r.Longitude);
                if (isNaN(lat)||isNaN(lon)) return false;
                return haversine(refLat,refLon,lat,lon) <= rayon;
            });

            let i=0;
            const BATCH=200;

            function insertBatch() {
                const end=Math.min(i+BATCH, rows.length);
                for (; i<end; i++) {
                    const r=rows[i];
                    creerMarker(parseFloat(r.latitude),parseFloat(r.Longitude),r.Référence||'',r.Adresse||'');
                }
                if (i<rows.length) {
                    ovNote.textContent = `AFFICHAGE… ${i} / ${rows.length} ARMOIRES`;
                    requestAnimationFrame(insertBatch);
                } else {
                    const label = rayon<20000
                        ? `✓ ${rows.length} ARMOIRE(S) — RAYON ${rayon} KM`
                        : `✓ ${rows.length} ARMOIRE(S) CHARGÉES`;
                    doneLoading(label);
                }
            }
            requestAnimationFrame(insertBatch);
        },
        error: function(err) {
            ovNote.textContent = '❌ ERREUR CHARGEMENT CSV';
            console.error(err);
        }
    });
}

// ════════════════════════════════════════════
// ÉTAPE 2 — GÉOLOCALISATION
// ════════════════════════════════════════════
function demanderGeoloc() {
    // Reset visuel étape 2 si retry
    btnRetry.style.display = 'none';
    const el2 = document.getElementById('s2');
    el2.classList.remove('error');
    document.getElementById('s2-label').textContent = '02 — TRIANGULATION GPS';
    hudTitle.style.color = 'rgba(255,140,0,.8)';

    setStep(2, 'TRIANGULATION EN COURS…');

    if (!navigator.geolocation) {
        stepEchec('NON SUPPORTÉ', 'TOUTES LES ARMOIRES SERONT AFFICHÉES.');
        setTimeout(() => chargerCSV(DEFAULT_LAT, DEFAULT_LON, 20000), 1800);
        return;
    }

    navigator.geolocation.getCurrentPosition(
        pos => {
            userLat = pos.coords.latitude;
            userLon = pos.coords.longitude;
            map.setView([userLat,userLon], 13);
            userMarker = L.marker([userLat,userLon]).addTo(map)
                .bindTooltip("Vous êtes ici", { permanent:true, direction:"top" })
                .bindPopup("🌍 Votre position actuelle");
            ovNote.textContent = 'POSITION TROUVÉE !';
            chargerCSV(userLat, userLon);
        },
        err => {
            console.warn('Géoloc échouée :', err.message);
            const msgs = {
                1: 'ACCÈS REFUSÉ PAR LE NAVIGATEUR',
                2: 'SIGNAL GPS INDISPONIBLE',
                3: 'DÉLAI DE 25S DÉPASSÉ'
            };
            stepEchec(msgs[err.code]||'POSITION INDISPONIBLE', 'RÉESSAYEZ OU CONTINUEZ SANS GPS.');

            // Bandeau flottant sur la carte
            const details = {
                1: '🚫 Géolocalisation refusée — activez-la dans les paramètres navigateur.',
                2: '📡 Signal GPS indisponible — déplacez-vous ou vérifiez votre réseau.',
                3: '⏱️ Délai 25s dépassé — GPS trop faible ou désactivé.'
            };
            const banner = document.createElement('div');
            banner.style.cssText = `
                position:fixed; bottom:70px; left:50%; transform:translateX(-50%);
                background:rgba(20,10,10,0.96); color:#f0c040;
                border:1px solid rgba(240,192,64,0.35); border-radius:10px;
                padding:12px 20px; font-family:'Segoe UI',sans-serif;
                font-size:13px; font-weight:600; z-index:5000;
                box-shadow:0 4px 16px rgba(0,0,0,0.5); text-align:center;
                max-width:90vw; animation:fadeInUp 0.4s ease;
            `;
            banner.textContent = details[err.code]||'❌ Position indisponible.';
            document.body.appendChild(banner);
            setTimeout(() => banner.remove(), 8000);
        },
        { enableHighAccuracy:true, timeout:25000 }
    );
}

// Lancement après que la carte a le temps de s'afficher
setTimeout(demanderGeoloc, 400);
