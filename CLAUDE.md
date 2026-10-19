# BRASILI – Übergabe für Claude Code

Internes Spaß-Jump-and-Run für Lindas Team (ca. 250 Spieler) zur Frauen-WM 2027 in Brasilien.
Privat, nicht öffentlich, nicht zum Vertrieb. Getrennt vom Dashboard `clink.com.de/fwwc27`
(dort höchstens die Bestenliste über `board.html`).

## Zusammenarbeit
- Linda schreibt Deutsch → auf Deutsch antworten. Die Oberfläche des Spiels ist **Englisch**.
- YAML-Dateien (z. B. `docker-compose.yml`) immer **komplett** ausgeben, nicht nur den geänderten Teil.
- Linda will nichts selbst zeichnen oder Level bauen: alles wird im Code erzeugt (Grafik, Level, Welten).
- Hosting: Test auf **loire-pi** (Raspberry Pi, Docker Compose, Caddy als Reverse Proxy), später eigener Webserver.

## Entscheidungen (Stand Oktober 2026)
- **Weiter nur in 3D** (Three.js r159, Toon-Look mit schwarzen Konturen). Die Pixel-Version (v1.1) wird nicht ausgebaut.
- **Weltkarte wie bei aktuellen Super-Mario-Spielen:** 9 Welten = Gruppe A–H (je 6 Spiele) + K.-o.-Welt (16 Spiele).
- **Freischalten nur durch Spielen** (kein Datum/Adventskalender mehr in der 3D-Version):
  ein Level öffnet sich, wenn das davor geschafft ist; die nächste Welt nach dem letzten Level der vorigen.
- **Bonuslevel** pro Gruppen-Welt (Prototyp: „The Goal Wall“ / Torwandschießen), öffnet sich nach dem ersten Tor in der Welt.
- **Regeln:** 3 Leben pro Versuch, 3 Checkpoints (Cooling Break 1. HZ, Halbzeit, Cooling Break 2. HZ),
  Leben verloren → zurück zum letzten Checkpoint (Uhr = Stand dort, mind. 20 s), nach 3 Leben Game over → Neustart ab Anstoß,
  unendlich viele Versuche, für die Bestenliste zählt der **beste** Versuch (`SCORE_MODE=first` möglich).
- Ein Level = ein WM-Spiel: 1. Halbzeit in der Welt von Team A, 2. Halbzeit in der von Team B, ca. 2 × 90 s.
  Man wählt ein Team und spielt gegen das andere – gleiche Bedingungen für beide Seiten.
- **Finales im Wechsel:** Kopfball (Flanke, je höher getroffen desto mehr Power), Freistoß (Winkel + Kraft über die Mauer),
  Elfmeter (Ecke + Höhe). Gruppenspiele: Kopfball, Freistoß, Elfmeter, Kopfball, Freistoß, Elfmeter (`shared/finale.js`).
- **Kader:** 11 Spielerinnen pro Team als Sticker über Bonus-Sprünge, Name platzt auf; Sticker-Album über das ganze Turnier.
- **Stadion-Intro** (~10 s, Comic-Stil) vor jedem Level: Stadtmotiv → Stadion → Schriftzug → Flug hinein → Übergang zum Level.
  Fotos von Wikimedia Commons (gemeinfrei/CC), im Browser zu Comic gefiltert; ohne Fotos gezeichnete Panels.
- Ton: vorerst stumm. Steuerung: Tastatur (Pfeile/WASD, Shift Sprint, Leertaste Springen/Schießen, Esc Pause), Gamepad, Touch.
- **Mannschaften = Platzhalter von 2023**, echter Spielplan 2027 (Daten, Städte, Stadien). Nach der Auslosung am
  **11.12.2026** und den Kader-Nominierungen werden Teams/Kader in `tools/build-data.mjs` + `tools/squads2023.txt` ersetzt.

## Aufbau
```
server/server.js          Node 22 ohne Abhängigkeiten: Login (Spitzname, E-Mail, Passwort; scrypt), Läufe, Bestenliste,
                          JSON-Datenbank data/db.json. Gehört noch zur Pixel-Version v1.1 (Finale dort immer Kopfball).
public/index.html, js/app.js, js/api.js     Pixel-Version v1.1 (Kalender, Login, Bestenliste)
public/proto3d.html       3D-Prototyp mit Weltkarte (ohne Server, Fortschritt im localStorage)
public/js/shared/         levelgen.js (deterministischer Level-Baukasten pro Spielnummer, LEVEL_VERSION 2),
                          finale.js (Freistoß-Physik, Elfmeter-Ausgang – von Spiel UND Server genutzt),
                          scoring.js (Punkte, vom Server nachgerechnet), rng.js
public/js/game/sim.js     Spielkern ohne Grafik: Physik, Checkpoints, Leben, Finales, Events (sim.on('goal', …))
public/js/game/engine.js  Pixel-Renderer v1.1 (nutzt sim.js)
public/js/game3d/
  app3d.js      Ablauf: Titel → Karte → Teamwahl → Intro → Level → Ergebnis → Karte; Bonus; Album; Touch
  map3d.js      Weltkarte (Inseln, Knoten, Brücken, Laufen, Karten-HUD)
  progress.js   Fortschritt (localStorage), Welten aus dem Spielplan, Freischalt-Regeln
  game3d.js     3D-Renderer des Spielkerns (zwei Länderwelten, Kamera, Finales, HUD, Partikel)
  world.js      Spielstreifen, Sammelobjekte, Checkpoints, Stadion
  themes3d.js   Länderwelten in 3D: WORLDS.ESP/NZL/NOR/SUI/PHI (+ neutrale Welt für alle anderen)
  bonus3d.js    Bonuslevel The Goal Wall
  album.js      Sticker-Album
  rig.js, toon.js   prozedurale Spielerin (Animationen), Toon-Materialien/Konturen
public/js/game/intro.js, comicfx.js   Stadion-Intro + Comic-Filter
public/data/*.json        Teams, Kader, Spielplan, Stadien (aus tools/build-data.mjs)
tools/                    build-data.mjs, build-demo.mjs (Pixel-Vorschau), build-demo3d.mjs (3D-Einzeldatei),
                          fetch-intro-images.mjs (Fotos fürs Docker-Image)
public/dev-3d.html        Testseite: lädt ein Level (?m=Spielnummer), `g.advance(sek)` spielt deterministisch weiter
```

## Starten / bauen / testen
- Server: `node server/server.js` → Pixel-Version auf `/`, 3D-Prototyp auf `/proto3d.html`.
  Docker: `docker compose up -d --build` (Einstellungen in `docker-compose.yml`, siehe README).
- Ohne Server: `cd public && python3 -m http.server 8099` → `http://localhost:8099/proto3d.html`.
- Einzeldatei bauen: `npm install` (nur esbuild), dann `npm run build:3d` → `dist/brasili3d.html`.
- Tests: Playwright mit Chromium; für WebGL im Headless-Modus `--use-angle=swiftshader --enable-unsafe-swiftshader`.
  Echtzeit ist dort langsam → `dev-3d.html` und `g.advance()` / `g.sim.step()` für deterministische Abläufe nutzen.
  Kopf-los prüfen: `node`-Skripte können `Sim` direkt laufen lassen (siehe Finale-Test: Sim + computeScore).
- `public/dev-*.html` sind nur zum Testen; der Server liefert `/dev-*` nicht aus, `.dockerignore` lässt sie weg.

## Konventionen
- Level sind deterministisch pro Spielnummer (`generateLevel(matchId)`); Änderungen am Generator → `LEVEL_VERSION` erhöhen.
- Spiel-Logik nur in `sim.js`/`shared/`, Grafik nur in den Renderern. Server rechnet alles nach (Mindestzeit, Deckelung,
  Freistoß/Elfmeter über `finale.js` aus Winkel/Ziel + Kraft).
- Keine externen Grafiken/Modelle: alles prozedural (Three.js-Primitiven, Canvas-Texturen, `toon()` + Konturen).
- Neue Länderwelt = Eintrag in `WORLDS` (themes3d.js): Himmel, Boden-/Block-Textur, Sammelobjekt, `build()` mit
  Hügeln, Wahrzeichen, Pflanzen, Tieren – typische Elemente des Landes, keine Klischees über Menschen.

## Offene Punkte / nächste Schritte
1. Server + App auf die 3D-Version umstellen: Login, Fortschritt/Album/Bonus auf dem Server statt localStorage,
   Bestenliste (bester Versuch), Freischalt-Regeln serverseitig, Dashboard-Bestenliste (`board.html`).
2. 3D-Welten für die übrigen Teams (nach der Auslosung die 32 echten Teams), danach Gruppen B–H und K.-o.-Welt spielbar.
3. Bonuslevel für die anderen Welten (Varianten), K.-o.-Welt mit Stadion-Finale ausbauen.
4. Ideen gegen Eintönigkeit (mit Linda besprochen): Geist des besten Laufs von Kolleg:innen (Eingaben aufzeichnen –
   Spielkern ist deterministisch, Server könnte Läufe nachspielen), Wetter/Tageszeit nach Anstoßzeit,
   eigene Spielmechanik pro Welt (Eis, Wind …), Bonusziele/Abzeichen pro Level.
5. Später: Ton (im Moment stumm).
