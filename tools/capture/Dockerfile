# Headless ScummVM for scripted screenshots: Xvfb for the display, xdotool for input.
# ScummVM is built from source (only the AGI and SCI engines) so captures don't depend on
# whatever version the distro ships; 2.9 lacks some Mac SCI cursor handling.
FROM debian:trixie-slim AS build
# The branch of scummvm/scummvm#8080, which adds AGI's black-and-white Mac render mode
# (--render-mode=macintoshbw: the B&W interpreter's own patterns and pattern phase, worked out
# from its 68k code); without it that mode falls back to EGA. Docker caches the clone, so after
# the branch moves rebuild with --build-arg SCUMMVM_REF=<commit> or --no-cache.
ARG SCUMMVM_REPO=https://github.com/gausie/scummvm.git
ARG SCUMMVM_REF=agi-mac-bw
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates git g++ make pkg-config libsdl2-dev libpng-dev zlib1g-dev libgl-dev \
    && rm -rf /var/lib/apt/lists/*
RUN git init -q /src && cd /src && git remote add origin "$SCUMMVM_REPO" \
    && git fetch -q --depth 1 origin "$SCUMMVM_REF" && git checkout -q FETCH_HEAD \
    && grep -q render_BlockMacintoshBW engines/agi/graphics.cpp
WORKDIR /src
# The AGI debugger's runopcode reads argv[2..6] whatever the argument count, and the unused
# entries are uninitialised: with fewer than five arguments it segfaults. Check argc instead.
RUN sed -i -E 's/p\[([0-4])\] = argv\[([2-6])\] \?/p[\1] = argc > \2 ?/' engines/agi/console.cpp \
    && grep -q 'p\[4\] = argc > 6 ?' engines/agi/console.cpp
# Text console: the debugger reads commands on stdin and prints to stdout, so capture.py can
# drive it over a pty and read state back.
RUN ./configure --disable-all-engines --enable-engines=agi,sci --enable-release --disable-debug --enable-text-console \
      --prefix=/opt/scummvm \
    && make -j"$(nproc)" && make install

FROM debian:trixie-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      libsdl2-2.0-0 libsndio7.0 libpng16-16t64 xvfb xdotool x11-utils imagemagick python3 python3-pil libgl1-mesa-dri libgl1 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /opt/scummvm /opt/scummvm
RUN ln -s /opt/scummvm/bin/scummvm /usr/local/bin/scummvm
ENV SDL_AUDIODRIVER=dummy
WORKDIR /work
