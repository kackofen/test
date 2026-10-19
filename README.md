# BRASILI – Road to Rio (Version 1.2)

Internes Jump-and-Run fürs Team zur Frauen-WM 2027: 64 Level, eines pro WM-Spiel,
Adventskalender-Freischaltung, Login, 3 Leben pro Versuch mit Checkpoints, unendlich viele
Versuche, Bestenliste und ein Comic-Stadion-Intro vor jedem Level.

## Regeln (neu in 1.1)

- **3 Checkpoints pro Level:** Cooling Break in der 1. Halbzeit, Halbzeitpause, Cooling Break in
  der 2. Halbzeit. Wer dort durchläuft, sieht „Cooling Break!“ und die Checkpoint-Fahne geht hoch.
- **3 Leben pro Versuch:** Wer ein Leben verliert, macht am letzten erreichten Checkpoint weiter,
  mit dem Punktestand von dort. Die Uhr steht dann wieder auf dem Stand des Checkpoints,
  mindestens aber auf 20 Sekunden.
- **Game over:** Nach dem 3. verlorenen Leben ist der Versuch vorbei, das Level startet wieder
  beim Anstoß.
- **Unendlich viele Versuche:** Jedes Level bleibt spielbar, auch nach dem Spieltag. Für die
  Bestenliste zählt der **beste** Versuch. Mit `SCORE_MODE=first` zählt stattdessen der erste
  beendete Versuch, danach spielt man nur noch zum Spaß.
- Das Team wählt man einmal pro Level, es bleibt für alle weiteren Versuche gleich.
- Rund um die Checkpoints stehen keine Verteidigerinnen, damit niemand direkt nach dem
  Neustart wieder umgegrätscht wird.

## Was in Version 1 steckt

- **Spielplan:** echte Daten, Städte und Stadien der WM 2027. Die Mannschaften sind Platzhalter
  von 2023, gruppenweise eingesetzt (Gruppe A 2023 → Gruppe-A-Spiele 2027 …). Die
  Spielnummern der Gruppenphase sind vorläufig.
- **Spielbar** sind alle Spiele, bei denen beide Länder eine fertige Welt haben (aktuell 8 Länder:
  NZL, NOR, GER, MAR, AUS, FRA, ESP, ENG). Das ergibt 6 Level: #1, #15, #56, #59, #62, #64 (Finale).
  Alle anderen Türen zeigen „Level in production“.
- **Level:** 1. Halbzeit in der Welt von Team A, 2. Halbzeit in der Welt von Team B (je 90 Sekunden
  Uhr = 45 Spielminuten), Cooling Breaks und Halbzeit-Tor als Checkpoints, am Ende Flanke +
  Kopfball: je höher Brasili den Ball trifft, desto mehr Power. Ab 45 % Power ist er drin.
- **Kader:** je 11 Sticker pro Halbzeit über Sprungfelder (Bonus-Sprung), Name platzt auf.
  Verteidigerinnen tragen Namen des Gegners, die Torhüterin steht im Tor, Fan-Banner mit Namen.
- **Intro:** pro Stadion ca. 10 Sekunden. Fotos (Wikimedia Commons, gemeinfrei/CC0 bzw. CC mit
  Nennung) werden im Browser in Comic-Illustrationen umgewandelt. Fotos gibt es aktuell für Rio,
  Porto Alegre, Fortaleza und Brasília; die anderen 4 Stadien bekommen ein gezeichnetes Comic-Panel.

## Punkte

| Was | Punkte |
|---|---|
| Strafraum erreicht | 1.000 |
| Länder-Sammelobjekt | 10 |
| Spielerinnen-Sticker | 100 |
| Alle 11 Sticker einer Halbzeit | +500 |
| Verteidigerin übersprungen | 50 |
| Restzeit pro Sekunde (je Halbzeit) | 5 |
| Kopfball-Power | bis 500 |
| Tor | 1.500 |

Gewertet wird nur ein beendeter Versuch (Kopfball gespielt). Es zählt der beste Versuch pro Level
(bzw. der erste mit `SCORE_MODE=first`). Der Server rechnet alles selbst nach, deckelt unmögliche
Werte und lehnt Läufe ab, die schneller sind als physikalisch möglich.

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
| `UNLOCK_MODE` | `all` = Testphase, alle Türen offen · `date` = Adventskalender |
| `UNLOCK_TIME`, `UNLOCK_OFFSET` | Türöffnung am Spieltag, Standard 06:00 MESZ |
| `SIM_NOW` | „Jetzt“ simulieren, um den Kalender zu testen |
| `ADMIN_EMAILS` | Admins (können Level zurücksetzen) |
| `INVITE_CODE` | wenn gesetzt, braucht man zum Registrieren diesen Team-Code |
| `BOARD_KEY` | Schlüssel für die Dashboard-Bestenliste |
| `SCORE_MODE` | `best` = bester Versuch zählt (Standard) · `first` = erster beendeter Versuch zählt |
| `FRAME_ANCESTORS` | Seiten, die `board.html` per iframe einbetten dürfen |

Nach Änderungen: `docker compose up -d`.

## Bestenliste im Dashboard

`board.html` ist eine schlanke Anzeige (Top 10 gesamt + letztes Level), aktualisiert sich jede
Minute. Im Dashboard z. B.:

```html
<iframe src="https://clink.com.de/brasili/board.html?key=DEIN_BOARD_KEY" style="width:100%;height:100%;border:0"></iframe>
```

## Admin

Als Admin eingeloggt (Browser-Konsole oder curl mit deinem Login-Cookie):

```js
// alle Läufe eines Spielers für ein Level zurücksetzen
fetch('api/admin/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nickname: 'Linda', matchId: 64 }) })
// alle Läufe aller Spieler (z. B. nach der Testphase): body: JSON.stringify({})
fetch('api/admin/users').then(r => r.json()).then(console.log)
```

Backup: einfach `data/db.json` kopieren.

### Update von Version 1.0

Ordner ersetzen (den `data`-Ordner behalten!), dann `docker compose up -d --build`. Die Datenbank
wird beim Start automatisch umgestellt: bisherige Ergebnisse bleiben als bester Versuch erhalten,
die verbrauchten Leben zählen als Versuche. Wer ein Level mit 0 Punkten verloren hatte, kann es
jetzt einfach erneut spielen.

## Nach der Auslosung (11.12.2026) und den Kader-Nominierungen

Alle Daten stehen in `tools/build-data.mjs` (Teams, Trikotfarben, Spielplan) und
`tools/squads2023.txt` (Kader). Ändern, dann:

```bash
node tools/build-data.mjs     # schreibt public/data/*.json
docker compose up -d --build
```

Neue Länder brauchen eine Welt in `public/js/game/themes.js` (Hintergrund, Wahrzeichen,
Sammelobjekt, Tier) und `theme: true` in `build-data.mjs`. Ohne eigene Welt ist das Level
gesperrt („Level in production“). Die Level-Layouts selbst entstehen aus der Spielnummer und
bleiben gleich, egal welche Teams eingetragen werden.

Achtung: Wer zum Testen schon gespielt hat, behält seine Punkte. Vor dem Start der WM die
Testläufe mit `api/admin/reset` (leerer body) löschen.

## 3D-Prototyp (Weltkarte)

Unter `/proto3d.html` (z. B. `https://clink.com.de/brasili/proto3d.html`) läuft der 3D-Prototyp
(Three.js, liegt in `public/vendor`). So soll das Spiel künftig aussehen:

- **Weltkarte** mit 9 Inseln: Gruppe A–H (je 6 Spiele) und die K.-o.-Welt (16 Spiele). Brasili läuft
  von Level zu Level. Freigeschaltet wird nur durch Spielen: Ein Level öffnet sich, wenn das davor
  geschafft ist. Der Knopf „TEST: UNLOCK ALL“ öffnet zum Testen alles.
- **Spielbar ist Gruppe A** (Neuseeland, Norwegen, Philippinen, Schweiz), jedes Land mit eigener
  3D-Welt (Landschaft, Wahrzeichen, Tiere, Sammelobjekt). Beide Halbzeiten werden gespielt.
- **Drei Finales** im Wechsel: Kopfball, Freistoß (Winkel + Kraft über die Mauer), Elfmeter
  (Ecke + Höhe, Kamera hinter der Schützin).
- **Bonuslevel „The Goal Wall“** (Torwandschießen): öffnet sich, sobald in der Welt ein Tor fällt.
- **Sticker-Album**: 32 Teams × 11 Spielerinnen; Sticker kommen ins Album, wenn das Level geschafft ist.

Der Prototyp speichert den Fortschritt nur im Browser (localStorage) und braucht keinen Login.
`npm install` und dann `npm run build:3d` bauen daraus eine einzelne HTML-Datei in `dist/`.

## Technik

- Node.js 22 ohne Abhängigkeiten, Daten in einer JSON-Datei. Für ~250 Spieler ausreichend.
- Spielkern `public/js/game/sim.js`: Regeln, Physik, Checkpoints und Leben, unabhängig von der
  Grafik. Die Pixel-Version (`engine.js`) und der 3D-Prototyp (`game3d/`) nutzen denselben Kern.
- Spiel: HTML5-Canvas, 384×216 Pixel, alle Grafiken im Code gezeichnet.
- Steuerung: Pfeiltasten/A-D, Shift = Sprint, Leertaste = Springen (gedrückt halten = höher), Esc = Pause.
  Gamepad funktioniert ebenfalls.
- Credits für Fotos und Schriften: im Spiel unter „Credits“.
