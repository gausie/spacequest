#!/bin/sh
# Usage: ./process.sh <raw-capture.png> <version-id> <scene-id>
# Scales a native-res capture to 1600x1200 with nearest neighbour, which also
# applies 4:3 aspect correction for 320x200 sources (5x horizontal, 6x vertical).
set -eu
[ $# -eq 3 ] || { echo "usage: $0 <raw.png> <version-id> <scene-id>" >&2; exit 1; }
out="shots/$2/$3.png"
mkdir -p "shots/$2"
ffmpeg -loglevel error -y -i "$1" -vf "scale=1600:1200:flags=neighbor" "$out"
echo "$out"
