# OpenGL-Versuch (Stufe 1) – Ergebnis: funktioniert nicht ohne größeren Umbau

Getestet mit dem Fork-Stand `37b56ee`, Emscripten 6.0.13, Chromium (SwiftShader). Der Fork baut absichtlich ohne OpenGL
(`Common.mak`: `override USE_OPENGL := 0` für EMSCRIPTEN).

## Was ich gemacht habe (alles nur im Scratchpad, nicht im Repo)
- `USE_OPENGL := 1`, `POLYMER := 0`, `USE_LIBVPX := 0` für EMSCRIPTEN.
- Die Debug-`EM_ASM`-Aufrufe (`actors.cpp`, `oldnet.cpp`, `player.cpp`, `premap.cpp`, `savegame.cpp`) kompilieren mit GL nicht,
  weil `sprite[]`/`sector[]` dann `SpriteTracker<>`/`SectorTracker<>` sind -> Argumente mit `(int)` casten. Danach baut und linkt es.
- `sdlayer.cpp`: SDL von Emscripten lehnt `SDL_GL_CONTEXT_FLAGS`/`RESET_NOTIFICATION` ab ("context attributes are not supported")
  -> für `__EMSCRIPTEN__` nur Major/Minor-Version setzen. Danach wird der Kontext erstellt.

## Wo es scheitert
- **WebGL 2 (`-sFULL_ES3`, Kontext 3.0):** `RuntimeError: null function` direkt nach "Setting video mode 960x720 (32-bpp)".
  Polymost ruft Desktop-OpenGL-Funktionen auf, die WebGL nicht hat; der Lader liefert dafür Null-Zeiger. Schwarzes Bild.
- **`-sLEGACY_GL_EMULATION` (Kontext 2.0):** `ReferenceError: warnOnce is not defined` in Emscriptens eigener Emulation
  (die Meldung dort lautet selbst: "do not expect it to work").

## Fazit / Wege
1. **Polymost auf GLES3/WebGL2 portieren** (alle benutzten Desktop-GL-Aufrufe finden und ersetzen, Shader auf GLSL ES 3.00,
   Texturformate/`glGetTexImage`/`glPolygonMode` & Co.). Mehrere Tage Arbeit, Ergebnis ungewiss.
2. **Software-Renderer behalten** und die Schärfe über höhere interne Auflösung (Einstellungen -> Auflösung, 16:9 bis 1080p) verbessern.
   Hochauflösende Texturen (HRP) gehen damit nicht, sie brauchen Polymost.
