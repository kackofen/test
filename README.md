# BRASILI – Road to Rio (Version 1.3)

Internes 3D-Jump-and-Run fürs Team zur Frauen-WM 2027: ein Level pro WM-Spiel (64), Weltkarte, Login,
3 Leben pro Versuch mit Checkpoints, unendlich viele Versuche, Bestenliste und ein Comic-Stadion-Intro
vor jedem Level. Seit 1.3 läuft alles über den Server; die Pixel-Version (1.1) ist entfernt.

## Das Spiel

Weltkarte mit 9 Inseln (Gruppe A–H à 6 Spiele, K.-o.-Welt mit 16). Ein Level öffnet sich, sobald das davor
geschafft ist, die nächste Welt nach dem letzten Level der vorigen. Spielbar sind Gruppe A (Neuseeland, Norwegen,
Philippinen, Schweiz) und Gruppe B (Australien, Irland, Nigeria, Kanada), jedes Land mit eigener 3D-Welt; die Mannschaften sind Platzhalter von 2023.

- **Login ist Pflicht** (Spitzname, E-Mail, Passwort). Fortschritt, Sticker-Album, Bonuslevel und Punkte liegen auf dem
  Server (`data/db.json`), nicht im Browser – man kann also auf jedem Gerät weiterspielen.
- **3 Leben pro Versuch, 3 Checkpoints** (Cooling Break 1. HZ, Halbzeit, Cooling Break 2. HZ). Leben verloren → zurück zum
  letzten Checkpoint (Uhr = Stand dort, mindestens 20 s). Nach dem 3. Leben Game over, das Level startet wieder beim Anstoß.
- **Unendlich viele Versuche.** Für die Bestenliste zählt der **beste** Versuch pro Level (`SCORE_MODE=first`: der erste beendete).
- **Drei Finales** im Wechsel: Kopfball, Freistoß (Winkel + Kraft über die Mauer), Elfmeter (Ecke + Höhe).
- **Hauptmenü** (beim Start und mit `Esc` auf der Karte): Weiterspielen, Album, Bestenliste, Einstellungen (Grafikstufe), Credits, Abmelden.
- **Bonuslevel „The Goal Wall“** (Torwandschießen) öffnet sich nach dem ersten Tor in der Welt (bisher Welt 1 und 2); bis zu 6 × 250 + 500 Punkte.
- **Sticker-Album:** 11 Spielerinnen pro Team, die Sticker kommen mit dem beendeten Level ins Album.
- **Bestenliste** im Spiel (Knopf „TOP LIST“ oder Taste `L`, gesamt oder pro Level) und für das Dashboard (`board.html`).
- Steuerung: Pfeiltasten/A-D, Shift = Sprint, Leertaste = Springen/Schießen, Esc = Pause, `A` = Album, `L` = Bestenliste. Gamepad und Touch gehen auch.

## Punkte

| Was | Punkte |
|---|---|
| Strafraum erreicht | 1.000 |
| Länder-Sammelobjekt | 10 |
| Spielerinnen-Sticker | 100 |
| Alle 11 Sticker einer Halbzeit | +500 |
| Verteidigerin übersprungen | 50 |
| Restzeit pro Sekunde (je Halbzeit) | 5 |
| Finale (Kopfball-Power / Schussqualität) | bis 500 |
| Tor | 1.500 |

Gewertet wird nur ein beendeter Versuch. Der Server rechnet alles selbst nach (`public/js/shared/rules.js`, `scoring.js`,
`finale.js`): Werte werden auf die Maxima des Levels gedeckelt, zu schnelle Läufe abgelehnt, Freistoß und Elfmeter
aus Winkel/Ziel + Kraft neu berechnet, Sticker nur aus dem Kader der beiden Teams angenommen, Level nur bei erfülltem Freischalt-Stand gestartet.

## Installation auf loire-pi (Docker Compose)

```bash
# Ordner kopieren, z. B. nach /home/clink/brasili
cd /home/clink/brasili
mkdir -p data              # hier liegt die Datenbank (data/db.json)
nano docker-compose.yml    # ADMIN_EMAILS = deine E-Mail, optional INVITE_CODE
docker compose up -d --build
docker compose logs -f     # "BRASILI running on :8090"
```

Das Spiel läuft dann auf `http://127.0.0.1:8090` (nur lokal erreichbar, für Caddy).

### Caddy

Variante A – als Unterseite `clink.com.de/brasili/` (keine DNS-Änderung nötig), im bestehenden
`clink.com.de { … }`-Block ergänzen:

```
redir /brasili /brasili/
handle_path /brasili/* {
	reverse_proxy 127.0.0.1:8090
}
```

Variante B – eigene Subdomain (A/CNAME-Eintrag `brasili` bei Porkbun anlegen):

```
brasili.clink.com.de {
	reverse_proxy 127.0.0.1:8090
}
```

Läuft Caddy selbst in Docker, zeigt `127.0.0.1` auf den Caddy-Container. Dann den
`brasili`-Service ins selbe Docker-Netz wie Caddy hängen und `reverse_proxy brasili:8090`
verwenden (den `ports:`-Eintrag kannst du dann weglassen).

Danach `caddy reload` bzw. den Caddy-Container neu starten.

## Einstellungen (docker-compose.yml)

| Variable | Bedeutung |
|---|---|
| `UNLOCK_ALL` | `1` = Testphase, alle Level für alle offen · `0` = nur durch Spielen (Standard) |
| `ADMIN_EMAILS` | Admins: TEST-Knopf („unlock all“ nur für das eigene Konto) und Level zurücksetzen |
| `INVITE_CODE` | wenn gesetzt, braucht man zum Registrieren diesen Team-Code |
| `BOARD_KEY` | Schlüssel für die Dashboard-Bestenliste |
| `SCORE_MODE` | `best` = bester Versuch zählt (Standard) · `first` = erster beendeter Versuch zählt |
| `FRAME_ANCESTORS` | Seiten, die `board.html` per iframe einbetten dürfen |

Nach Änderungen: `docker compose up -d`.

## Bestenliste im Dashboard

`board.html` ist eine schlanke Anzeige (Top 10 gesamt + zuletzt gespieltes Level), aktualisiert sich jede
Minute. Im Dashboard z. B.:

```html
<iframe src="https://clink.com.de/brasili/board.html?key=DEIN_BOARD_KEY" style="width:100%;height:100%;border:0"></iframe>
```

## Admin

Als Admin eingeloggt (Browser-Konsole oder curl mit deinem Login-Cookie):

```js
// alle Ergebnisse eines Spielers für ein Level zurücksetzen
fetch('api/admin/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nickname: 'Linda', matchId: 1 }) })
// kompletter Fortschritt (Level, Bonus, Album) eines Spielers: body: { nickname: 'Linda' } · aller Spieler (nach der Testphase): body: {}
fetch('api/admin/users').then(r => r.json()).then(console.log)
```

Backup: einfach `data/db.json` kopieren.

### Update von Version 1.2 (Pixel / Prototyp)

Ordner ersetzen (den `data`-Ordner behalten!), `docker-compose.yml` übernehmen (`UNLOCK_MODE`, `UNLOCK_TIME`, `UNLOCK_OFFSET`,
`SIM_NOW` gibt es nicht mehr, dafür `UNLOCK_ALL`), dann `docker compose up -d --build`. Die Konten bleiben erhalten, die
Ergebnisse der Pixel-Version bleiben unangetastet in `db.json` (`runs`), zählen aber nicht mehr: der Fortschritt der 3D-Version
beginnt bei null. Der alte Link `/proto3d.html` leitet auf die Startseite um.

## Nach der Auslosung (11.12.2026) und den Kader-Nominierungen

Alle Daten stehen in `tools/build-data.mjs` (Teams, Trikotfarben, Spielplan) und
`tools/squads2023.txt` (Kader). Ändern, dann:

```bash
node tools/build-data.mjs     # schreibt public/data/*.json
docker compose up -d --build
```

Neue Länderwelten in 3D: `WORLDS` in `public/js/game3d/themes3d.js` **und** `WORLD3D_CODES` in `public/js/shared/rules.js`
ergänzen (nur dann ist ein Level spielbar). Die Level-Layouts entstehen aus der Spielnummer und bleiben gleich, egal welche Teams eingetragen werden.

Achtung: Wer zum Testen schon gespielt hat, behält seine Punkte. Vor dem Start der WM die Testläufe mit `api/admin/reset` (leerer body) löschen.

## Entwickeln

```bash
npm install                    # nur esbuild (für den Einzeldatei-Build)
node server/server.js          # http://localhost:8090 (Daten in ./data)
npm run build:3d               # dist/brasili3d.html – eine Datei, läuft ohne Server (Gast, Stand im Browser)
```

## Technik

- Node.js 22 ohne Abhängigkeiten, Daten in einer JSON-Datei. Für ~250 Spieler ausreichend.
- Spielkern `public/js/game/sim.js`: Regeln, Physik, Checkpoints und Leben, unabhängig von der Grafik; Renderer in `public/js/game3d/` (Three.js, liegt in `public/vendor`).
- Alle Grafiken entstehen im Code (Three.js-Primitiven, Canvas-Texturen).
- Credits für Fotos und Schriften: `public/fonts/OFL-*.txt`, Fotos laut Intro (Wikimedia Commons).
