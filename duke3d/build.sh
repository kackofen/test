#!/usr/bin/env bash
# Baut EDuke32 (WebAssembly) MIT deiner eigenen DUKE3D.GRP nach duke3d/web/.
# Aufruf:  ./build.sh /pfad/zu/DUKE3D.GRP
# Voraussetzungen: git, make, Python 3, Node 22; Emscripten wird bei Bedarf nach .build/emsdk installiert
# (oder EMSDK=/pfad/zu/emsdk setzen). Die GRP wird NICHT ins Git übernommen: web/ und .build/ stehen in .gitignore.
set -euo pipefail
GRP="${1:-${GRP:-}}"
[ -f "$GRP" ] || { echo "Aufruf: $0 /pfad/zu/DUKE3D.GRP" >&2; exit 1; }
HERE="$(cd "$(dirname "$0")" && pwd)"
B="$HERE/.build"; mkdir -p "$B"

# Feste Versionen (reproduzierbar)
EDUKE_URL=https://github.com/DigitalCyberSoft/eduke32-wasm
EDUKE_REF=37b56eefaf8125eaa853c417512019cc7ad94b81
SDL_TAG=release-2.32.10

# 1) Emscripten (braucht Python >= 3.10; macOS liefert nur 3.9 mit -> passendes Python suchen)
PY=""
for c in python3.15 python3.14 python3.13 python3.12 python3.11 python3.10 python3 /opt/homebrew/bin/python3 /usr/local/bin/python3; do
  p="$(command -v "$c" 2>/dev/null || true)"; [ -n "$p" ] || continue
  if "$p" -c 'import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)' 2>/dev/null; then PY="$p"; break; fi
done
[ -n "$PY" ] || { echo "Fehler: Python >= 3.10 nicht gefunden. macOS: 'brew install python@3.13'" >&2; exit 1; }
export EMSDK_PYTHON="$PY"; echo "Python für Emscripten: $PY"
if [ -z "${EMSDK:-}" ]; then
  EMSDK="$B/emsdk"
  if [ ! -d "$EMSDK" ]; then git clone --depth 1 https://github.com/emscripten-core/emsdk "$EMSDK"; fi
  if [ ! -d "$EMSDK/upstream/emscripten" ]; then "$EMSDK/emsdk" install latest && "$EMSDK/emsdk" activate latest; fi
fi
# shellcheck disable=SC1091
source "$EMSDK/emsdk_env.sh" >/dev/null 2>&1 || true
command -v em++ >/dev/null || { echo "Fehler: Emscripten ist nicht installiert (em++ fehlt). Meldungen oben prüfen." >&2; exit 1; }

# 2) Quellen (SDL2 lokal, weil Emscripten es sonst als ZIP von github.com/archive lädt – das scheitert hinter manchen Proxys)
[ -d "$B/eduke32-wasm" ] || { git clone "$EDUKE_URL" "$B/eduke32-wasm"; }
git -C "$B/eduke32-wasm" fetch -q origin 2>/dev/null || true
git -C "$B/eduke32-wasm" checkout -q -f "$EDUKE_REF"
git -C "$B/eduke32-wasm" clean -q -fd platform source 2>/dev/null || true
# eigene Änderungen (z. B. 16:9-Modus) als Patches auf den festen Stand legen
for P in "$HERE"/patches/*.patch; do [ -f "$P" ] && git -C "$B/eduke32-wasm" apply "$P" && echo "Patch angewendet: $(basename "$P")"; done
[ -d "$B/SDL2-src" ] || git clone -q --depth 1 --branch "$SDL_TAG" https://github.com/libsdl-org/SDL "$B/SDL2-src"
export EMCC_LOCAL_PORTS="sdl2=$B/SDL2-src"

# 3) Bauen, GRP kommt als eingebettete Spieldaten (eduke32.data) hinein
cd "$B/eduke32-wasm"
rm -f eduke32.js eduke32.wasm eduke32.data
# macOS bringt nur make 3.81 mit; wenn vorhanden, wird GNU make 4 (gmake, per "brew install make") bevorzugt
MAKE_BIN="$(command -v gmake || command -v make)"
JOBS="$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)"
"$MAKE_BIN" PLATFORM=EMSCRIPTEN EM_SINGLE_FILE=0 NETDUKE32=1 obj=obj-em GAME_DATA="$GRP" -j"$JOBS"

# 4) Ausgabe
OUT="$HERE/web"; rm -rf "$OUT"; mkdir -p "$OUT"
cp eduke32.js eduke32.wasm eduke32.data platform/emscripten/eduke32-net.js "$OUT/"
sed "s/__BUILD_ID__/$(date +%s)/g" platform/emscripten/index.html > "$OUT/index.html"
echo "Fertig: $OUT ($(du -sh "$OUT" | cut -f1))"
