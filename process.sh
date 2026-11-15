#!/bin/sh
# Usage: ./process.sh <raw-capture.png> <version-id> <scene-id>
# Scales a native-res capture with nearest neighbour to its shot size (shotSize in data.js).
# A picture that fills a 4:3 screen (320x200 on a PC, Amiga, ST) becomes 1600x1200, stretched
# as its monitor did. One with square pixels (the Macs) keeps its shape, e.g. 1600x1000; the
# page letterboxes it.
set -eu
[ $# -eq 3 ] || { echo "usage: $0 <raw.png> <version-id> <scene-id>" >&2; exit 1; }
here=$(cd "$(dirname "$0")" && pwd)
size=$(node --input-type=module -e "
  const { ALL_VERSIONS, shotSize } = await import('file://$here/data.js');
  const v = ALL_VERSIONS.find(v => v.id === process.argv[1]);
  if (!v) { console.error('unknown version ' + process.argv[1]); process.exit(1); }
  console.log(shotSize(v).join(' '));
" "$2")
set -- "$1" "$2" "$3" $size
out="shots/$2/$3.png"
mkdir -p "shots/$2"
ffmpeg -loglevel error -y -i "$1" -vf "scale=$4:$5:flags=neighbor" "$out"
echo "$out"
