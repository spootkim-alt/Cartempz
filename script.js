<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <title>Carte Hakim</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css">
    <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
    <script src="https://unpkg.com/papaparse@5.4.1/papaparse.min.js"></script>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0f1923; }
        #map { width: 100%; height: 100vh; }

        /* ── Overlay ── */
        #overlay {
            position: fixed; inset: 0;
            background: rgba(10, 18, 28, 0.93);
            backdrop-filter: blur(8px);
            z-index: 9999;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center; gap: 24px;
            transition: opacity 0.5s ease;
        }
        #overlay.hidden { opacity: 0; pointer-events: none; }

        .ov-title {
            font-family: 'Segoe UI', sans-serif;
            font-size: 22px; font-weight: 700;
            color: #e74c3c;
            letter-spacing: 1px;
            text-shadow: 0 0 24px rgba(231,76,60,0.4);
        }

        .ov-card {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.09);
            border-radius: 14px;
            padding: 24px 32px;
            display: flex; flex-direction: column;
            align-items: center; gap: 16px;
            min-width: 280px; max-width: 340px;
        }

        .steps { display: flex; flex-direction: column; gap: 12px; width: 100%; }

        .step {
            display: flex; align-items: center; gap: 12px;
            opacity: 0.3;
            transition: opacity 0.35s, transform 0.35s;
            font-family: 'Segoe UI', sans-serif;
        }
        .step.active  { opacity: 1; transform: translateX(4px); }
        .step.done    { opacity: 0.55; }

        .step-icon {
            width: 34px; height: 34px; border-radius: 50%;
            background: rgba(231,76,60,0.12);
            border: 2px solid rgba(231,76,60,0.25);
            display: flex; align-items: center; justify-content: center;
            font-size: 15px; flex-shrink: 0;
            transition: background 0.3s, border-color 0.3s;
        }
        .step.active .step-icon {
            background: rgba(231,76,60,0.28);
            border-color: #e74c3c;
            animation: pulse 1.2s infinite;
        }
        .step.done .step-icon { background: rgba(46,204,113,0.18); border-color: #2ecc71; }

        @keyframes pulse {
            0%   { box-shadow: 0 0 0 0 rgba(231,76,60,0.5); }
            70%  { box-shadow: 0 0 0 10px rgba(231,76,60,0); }
            100% { box-shadow: 0 0 0 0 rgba(231,76,60,0); }
        }

        .step-label { color: #d0dde8; font-size: 13px; font-weight: 500; }
        .step.active .step-label { color: #fff; font-weight: 600; }
        .step.done   .step-label { color: #2ecc71; }

        .prog-wrap {
            width: 100%; height: 4px;
            background: rgba(255,255,255,0.07);
            border-radius: 99px; overflow: hidden;
        }
        .prog-fill {
            height: 100%; width: 0%;
            background: linear-gradient(90deg, #e74c3c, #e67e22);
            border-radius: 99px;
            transition: width 0.4s ease;
        }

        #ov-note {
            color: rgba(255,255,255,0.35);
            font-size: 12px; font-family: 'Segoe UI', sans-serif;
            text-align: center;
        }

        /* ── Bouton flottant ── */
        #btn-loc {
            position: fixed; bottom: 20px; right: 20px; z-index: 1000;
            background: #e74c3c; color: #fff; border: none; border-radius: 50px;
            padding: 11px 18px; font-size: 13px; font-weight: 600;
            cursor: pointer; box-shadow: 0 4px 14px rgba(231,76,60,0.4);
            font-family: 'Segoe UI', sans-serif;
            transition: background 0.2s, transform 0.2s;
        }
        #btn-loc:hover { background: #c0392b; transform: translateY(-2px); }

        /* ── Tooltip armoires ── */
        .tip-arm {
            background: rgba(18,18,26,0.92) !important;
            color: #fff !important; border: 1px solid rgba(231,76,60,0.35) !important;
            border-radius: 5px !important; padding: 3px 8px !important;
            font-size: 11px !important; font-weight: 600 !important;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4) !important;
            white-space: nowrap !important;
        }
        .tip-arm::before { border-top-color: rgba(18,18,26,0.92) !important; }
    </style>
</head>
<body>
    <div id="overlay">
        <div class="ov-title">📦 Carte Armoires</div>
        <div class="ov-card">
            <div class="steps">
                <div class="step" id="s1"><div class="step-icon">🗺️</div><div class="step-label">Initialisation de la carte</div></div>
                <div class="step" id="s2"><div class="step-icon">📍</div><div class="step-label">Localisation de votre position</div></div>
                <div class="step" id="s3"><div class="step-icon">📡</div><div class="step-label">Chargement des armoires proches</div></div>
            </div>
            <div class="prog-wrap"><div class="prog-fill" id="prog"></div></div>
            <div id="ov-note">Démarrage…</div>
        </div>
    </div>

    <div id="map"></div>
    <button id="btn-loc" onclick="recentrer()">📍 Me localiser</button>

    <script src="script.js"></script>
</body>
</html>
