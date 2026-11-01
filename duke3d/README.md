# Duke Nukem 3D im Browser (privat)

EDuke32 als WebAssembly (Fork `DigitalCyberSoft/eduke32-wasm`, fest auf Commit `37b56ee`), mit deiner eigenen
`DUKE3D.GRP` (Atomic Edition 1.5, Prüfsumme `0xbbc9ce44`). **Nicht öffentlich**: Login Pflicht, die GRP kommt nie ins Git.
Lizenz: EDuke32 = GPL, Build-Engine = Ken Silvermans Lizenz (nicht kommerziell). Das Spiel selbst (GRP) bleibt urheberrechtlich geschützt.

## Bauen (einmalig, ca. 2–5 Minuten)
```bash
./build.sh /pfad/zu/DUKE3D.GRP
```
Installiert bei Bedarf Emscripten nach `.build/emsdk` (oder `EMSDK=/pfad/zu/emsdk` setzen) und schreibt alles nach `web/`
(ca. 30 MB, enthält die GRP → steht in `.gitignore`).

## Starten
```bash
DUKE_PASS=geheim node server.cjs      # http://localhost:8091, Benutzer: duke
```
Docker (loire-pi, Caddy davor): `web/` auf den Pi kopieren, `DUKE_PASS` in `docker-compose.yml` setzen, dann `docker compose up -d --build`.
Caddy: `duke.deine-domain { reverse_proxy 127.0.0.1:8091 }`

## Hinweise
- Maus + WASD/Pfeile wie im Original (Optionen im Spiel), Vollbild-Knopf oben rechts (Tastatursperre: Strg+W schließt den Tab nicht).
- Speicherstände und Einstellungen liegen im Browser (IndexedDB/localStorage).
- Multiplayer läuft serverlos per WebRTC (Menü „Multiplayer“); die Signalisierung geht über öffentliche Nostr-Relays.
  Wer das nicht will, nutzt den Menüpunkt nicht.
- Die Datei heißt `server.cjs`, weil das Repo mit `"type": "module"` läuft.
