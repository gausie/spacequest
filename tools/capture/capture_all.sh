#!/bin/sh
# Recapture every scene of every version from scenes.json and publish them to shots/.
#
#   tools/capture/capture_all.sh [version ...]
#
# Needs Docker and the game data under games/ (see tools/capture/README.md). Nothing here
# makes judgement calls: rooms, timings and debugger commands all come from scenes.json, and
# moving scenes are matched to the reference version automatically.
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
OUT="$ROOT/games/cap/docker"
cd "$HERE"

docker compose build

all=$(python3 -c "import json;print(' '.join(json.load(open('scenes.json'))['versions']))")
refs=$(python3 -c "import json;print(' '.join(json.load(open('scenes.json'))['reference'].values()))")
versions=${*:-$all}

run() {
  for v in "$@"; do
    rm -rf "$OUT/raw/$v"
    docker compose run --rm -T capture run "$v" > "$OUT/run-$v.log" 2>&1 &
  done
  wait
}

mkdir -p "$OUT"
# References first: every other version is matched against them.
todo_refs=""; todo_rest=""
for v in $versions; do
  case " $refs " in *" $v "*) todo_refs="$todo_refs $v" ;; *) todo_rest="$todo_rest $v" ;; esac
done
[ -n "$todo_refs" ] && run $todo_refs
[ -n "$todo_rest" ] && run $todo_rest

grep -h "NO SCREENSHOT" "$OUT"/run-*.log || true

# Trim the interface, centre the playfield, scale to 1600x1200 into shots/.
rm -rf "$OUT/final"
docker compose run --rm -T --entrypoint python3 capture /work/postprocess.py /out/raw /out/final
for d in "$OUT"/final/*/; do
  v=$(basename "$d")
  for f in "$d"*.png; do
    [ -e "$f" ] || continue  # a version with no captures
    (cd "$ROOT" && ./process.sh "$f" "$v" "$(basename "$f" .png)" > /dev/null)
  done
done
echo "done: $(ls "$ROOT"/shots/*/*.png | wc -l) screenshots in shots/"
