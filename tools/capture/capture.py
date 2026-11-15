"""Scripted ScummVM screenshots inside the capture container (Xvfb + xdotool).

    capture.py run [version ...] [--scene id ...]   capture from scenes.json
    capture.py survey <version> <from>-<to>         one frame per room, for picking scenes
    capture.py burst <version> <room> <n> <gap>     n frames gap seconds apart, for timing cutscenes
    capture.py record <engine> [scene ...]          store each scene's object state from the reference
                                                     (--merge: keep existing entries, add new objects)

Game data is mounted read-only at /games, output goes to /out."""
import json, os, pty, re, socket, subprocess, sys, threading, time, glob, shutil
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
CFG = json.load(open(os.path.join(HERE, "scenes.json")))
GAMES, OUT = "/games", "/out"
DISPLAY = ":99"
INI = "/tmp/scummvm.ini"


def sh(*a, **k):
    return subprocess.run(a, env={**os.environ, "DISPLAY": DISPLAY}, **k)


def start_display():
    if sh("xdpyinfo", capture_output=True).returncode == 0: return
    subprocess.Popen(["Xvfb", DISPLAY, "-screen", "0", "1600x1200x24"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(50):
        if sh("xdpyinfo", capture_output=True).returncode == 0: return
        time.sleep(0.1)
    raise SystemExit("Xvfb did not start")


def write_ini(shots):
    # Plain F-keys for the debugger and screenshots keep xdotool input simple.
    open(INI, "w").write(f"""[scummvm]
savepath=/tmp/saves
screenshotpath={shots}/
updates_check=0
gfx_mode=opengl
stretch_mode=pixel-perfect

aspect_ratio=false
filtering=false
fullscreen=false

[keymapper]
keymap_global_DEBUGGER=F11
keymap_sdl-graphics_SCRS=F12
""")
    os.makedirs("/tmp/saves", exist_ok=True)


class Game:
    def __init__(self, version, shots):
        v = CFG["versions"][version]
        args = ["scummvm", f"--config={INI}", f"--path={GAMES}/{v['path']}"]
        if v.get("render"): args.append(f"--render-mode={v['render']}")
        args.append(v["game"])
        self.v, self.shots = v, shots
        self.log = open(os.path.join(shots, "scummvm.log"), "a")
        # ScummVM is built with the text console, so the debugger talks over this terminal:
        # commands go in on stdin and their output comes back, instead of typing into a window.
        self.tty, slave = pty.openpty()
        self.out, self.lock, self.paused, self.at = "", threading.Lock(), False, 0
        self.proc = subprocess.Popen(args, env={**os.environ, "DISPLAY": DISPLAY, "SDL_AUDIODRIVER": "dummy"},
                                     stdin=slave, stdout=slave, stderr=slave)
        os.close(slave)
        threading.Thread(target=self._read, daemon=True).start()
        self.win = None
        for _ in range(100):
            r = sh("xdotool", "search", "--pid", str(self.proc.pid), "--onlyvisible", "--name", ".", capture_output=True, text=True)
            if r.stdout.strip():
                self.win = r.stdout.split()[-1]; break
            time.sleep(0.1)
        if not self.win:
            self.proc.kill()
            raise RuntimeError("no ScummVM window")

    def key(self, *keys, delay=0.3):
        for k in keys:
            sh("xdotool", "key", "--window", self.win, k); time.sleep(delay)

    def type(self, text):
        sh("xdotool", "type", "--window", self.win, "--delay", "40", text); time.sleep(0.2)

    def boot(self, steps=None):
        time.sleep(self.v.get("boot_wait", 6))
        for step in (self.v.get("boot", []) if steps is None else steps):
            if step.startswith("type:"): self.type(step[5:])
            elif step.startswith("wait:"): time.sleep(float(step[5:]))
            else: self.key(step)

    def _read(self):
        while True:
            try: data = os.read(self.tty, 65536).decode(errors="replace")
            except OSError: return
            if not data: return
            self.log.write(data); self.log.flush()
            with self.lock: self.out += data

    def _prompt(self, since, timeout=10):
        end = time.time() + timeout
        while time.time() < end:
            with self.lock:
                i = self.out.find("debug> ", since)
                if i >= 0: return i
            time.sleep(0.05)
        raise RuntimeError("debugger prompt did not appear")

    def console(self, *cmds, may_resume=False):
        """Pause in the debugger, run cmds, return each command's output; the game stays
        paused (and its window unchanged) until resume()."""
        if self.paused:
            at = self.at
        else:
            with self.lock: start = len(self.out)
            # The key is sometimes dropped while a room is loading; press again.
            for attempt in range(4):
                self.key("F11", delay=0)
                try: at = self._prompt(start, timeout=3) + 7; break
                except RuntimeError:
                    if attempt == 3: raise
            self.paused = True
        results = []
        for cmd in cmds:
            os.write(self.tty, (cmd + "\n").encode())
            try: nxt = self._prompt(at, timeout=10 if not may_resume else 3)
            except RuntimeError:
                # Sending a message that starts a script can hand control back to the game.
                if not may_resume: raise
                self.paused = False; results.append(""); return results
            with self.lock: text = self.out[at:nxt]
            results.append(text.split("\n", 1)[1] if "\n" in text else "")
            at = nxt + 7
        self.at = at
        return results

    def resume(self):
        if self.paused:
            with self.lock: start = len(self.out)
            os.write(self.tty, b"exit\n"); time.sleep(0.2)
            # A late F11 from a retry opens the debugger again straight away: close it too.
            with self.lock: again = self.out.find("debug> ", start) >= 0
            if again: os.write(self.tty, b"exit\n"); time.sleep(0.1)
            self.paused = False

    def run(self, *cmds):
        r = self.console(*cmds); self.resume(); return r

    def room(self, n, debug=(), setup=()):
        self.run(*debug, f"room {n}")
        after = self.v.get("after_debug", []) + list(setup)
        if after:
            # Debugger commands once the room has been set up, e.g. stopping Roger
            # (AGI v6 = ego direction) so he doesn't wander off at a version-dependent speed,
            # or starting a scene's event. {room} is the SCI room object (global 2).
            time.sleep(0.5)
            if any("{room}" in c for c in after):
                room = re.search(r"== ([0-9a-f]{4}:[0-9a-f]{4})", self.console("vv g 2")[0]).group(1)
                after = [c.replace("{room}", room) for c in after]
            self.console(*after, may_resume=True); self.resume()

    def hide_cursor(self):
        # Park the pointer outside the 800x600 game window so no cursor is drawn into the frame.
        sh("xdotool", "mousemove", "1599", "1199"); time.sleep(0.2)

    def grab(self, dest):
        r = sh("import", "-window", self.win, "-depth", "8", f"png:{dest}", capture_output=True)
        return r.returncode == 0 and os.path.exists(dest)

    def screenshot(self, dest, tries=4):
        # ScummVM shows a "Screenshot saved" message for a couple of seconds, and it lands
        # in the next screenshot. normalize() spots it (non-uniform blocks), so wait and retry.
        for attempt in range(tries):
            self.hide_cursor()
            if not self.grab(dest): continue
            try:
                normalize(dest, self.v["native"], strict=self.v.get("strict", True))
                return True
            except RuntimeError as e:
                print(f"  retry {attempt + 1}: {e}", flush=True)
                os.remove(dest)
                time.sleep(0.5)
        return False

    def quit(self):
        self.proc.terminate()
        try: self.proc.wait(5)
        except subprocess.TimeoutExpired: self.proc.kill()
        time.sleep(0.5)


def normalize(path, native, ignore=(), strict=True):
    """ScummVM's OpenGL screenshot is the whole window with the game scaled by an integer
    (pixel-perfect). Crop it out and take one sample per game pixel, refusing if any
    scaled block isn't a single colour (wrong native size or a stray overlay)."""
    im = Image.open(path).convert("RGB")
    W, H = im.size; w, h = native
    k = min(W // w, H // h)
    ox, oy = (W - w * k) // 2, (H - h * k) // 2
    px = im.load()
    out = Image.new("RGB", (w, h)); op = out.load()
    bad, first = 0, None
    for y in range(h):
        for x in range(w):
            c = px[ox + x * k, oy + y * k]
            skip = any(ix <= x < ix + iw and iy <= y < iy + ih for ix, iy, iw, ih in ignore)
            if not skip and px[ox + x * k + k - 1, oy + y * k + k - 1] != c:
                bad += 1; first = first if bad > 1 else (x, y)
            op[x, y] = c
    # Some interpreters (Amiga AGI) clamp their own pointer to the screen, leaving its tip on
    # the bottom-right pixel when the real pointer is parked outside the window.
    if bad == 1 and first == (w - 1, h - 1):
        op[w - 1, h - 1] = op[w - 2, h - 1]; bad = 0
    if bad and not strict:
        # Mac SCI draws its text at double resolution, which can't be sampled losslessly.
        print(f"  {os.path.basename(path)}: {bad} hi-res blocks kept (first at {first})", flush=True); bad = 0
    if bad: raise RuntimeError(f"{path}: {bad} non-uniform blocks at {w}x{h} k={k}, first at {first}")
    out.save(path)


def session(version):
    shots = os.path.join(OUT, "tmp", f"{version}-{socket.gethostname()}")
    os.makedirs(shots, exist_ok=True)
    write_ini(shots)
    return shots


def stats(path):
    b = Image.open(path).convert("RGB").tobytes()
    px = [b[i:i + 3] for i in range(0, len(b), 3)]
    return len(set(px)), px.count(b"\0\0\0") / len(px)


def pixels(path):
    return list(Image.open(path).convert("RGB").resize((320, 200), Image.NEAREST).getdata())


def closest(frames, ref):
    """The frame that best matches the reference version's frame. Palettes differ, so first
    learn a colour mapping from the background (most pixels agree), then count the pixels
    that still disagree: misplaced sprites and text boxes."""
    r = pixels(ref)
    def score(f):
        c = pixels(f)
        votes = {}
        for a, b in zip(c, r):
            votes.setdefault(a, {}).setdefault(b, 0); votes[a][b] += 1
        mapping = {a: max(v, key=v.get) for a, v in votes.items()}
        return sum(mapping[a] != b for a, b in zip(c, r))
    return min(frames, key=score)


def game_rect(native, W=800, H=600):
    w, h = native; k = min(W // w, H // h)
    return (W - w * k) // 2, (H - h * k) // 2, k


def cursor_free_shot(g, dest):
    """SCI games draw their own cursor and keep it inside the picture, so take one frame
    with it parked bottom-left and one bottom-right, and patch each corner from the other."""
    w, h = g.v["native"]
    ox, oy, k = game_rect((w, h))
    # Whole game pixels, so the cursor lands on the scaled grid.
    corners = [(ox, oy + (h - 1) * k), (ox + (w - 1) * k, oy + (h - 1) * k)]
    paths = []
    for i, (x, y) in enumerate(corners):
        # Approach the corner in steps: some interpreters (Mac SCI) only pick up real motion.
        for dx in (40, 20, 0):
            sh("xdotool", "mousemove", "--window", g.win, str(x + (dx if i == 0 else -dx)), str(y - dx)); time.sleep(0.4)
        time.sleep(0.8)
        p = dest + f".{i}.png"
        if not g.grab(p): return False
        # The corner holding the cursor gets replaced from the other frame, so don't check it.
        patch = 32
        corner = (0, h - patch, patch, patch) if i == 0 else (w - patch, h - patch, patch, patch)
        try: normalize(p, g.v["native"], ignore=[corner], strict=g.v.get("strict", True))
        except RuntimeError as e:
            print(f"  corner {i}: {e}", flush=True); return False
        paths.append(p)
    a, b = (Image.open(p).convert("RGB") for p in paths)
    patch = 32
    out = a.copy()
    out.paste(b.crop((0, h - patch, patch, h)), (0, h - patch))  # a has the cursor bottom-left
    out.save(dest)
    if not os.environ.get("KEEP_CORNERS"):
        for p in paths: os.remove(p)
    return True


# Rooms use more than the first 16 slots (the spider droid in room 19 is object 16).
AGI_OBJECTS = 24


def agi_state(g):
    """Every drawn screen object, read while the game is paused in the debugger."""
    state = {}
    for i, text in enumerate(g.console(*[f"screenobj {i}" for i in range(AGI_OBJECTS)])):
        text = text.replace("\r", "")
        m = re.search(r"view: (\d+), loop: (\d+), cel: (\d+)\nflags: (.*)\n", text)
        pos = re.search(r"\nxPos: (\d+), yPos: (\d+)", text)
        pri = re.search(r"priority: (\d+)", text)
        if m and "Drawn" in m.group(4).split():
            state[str(i)] = [int(m.group(1)), int(m.group(2)), int(m.group(3)), int(pos.group(1)), int(pos.group(2)), int(pri.group(1))]
    return state


def agi_apply(g, state, current):
    """Set every screen object to the recorded [view, loop, cel, x, y, priority] and freeze it,
    so each version shows exactly the same moment. Same logic, same object numbers."""
    cmds = []
    for i in range(AGI_OBJECTS):
        k = str(i)
        if k not in state:
            if k in current: cmds.append(f"runopcode erase {i}")
            continue
        view, loop, cel, x, y, pri = state[k]
        if k not in current:
            cmds += [f"runopcode load.view {view}", f"runopcode animate.obj {i}", f"runopcode set.view {i} {view}",
                     f"runopcode position {i} {x} {y}", f"runopcode draw {i}"]
        elif current[k][0] != view:
            cmds += [f"runopcode load.view {view}", f"runopcode set.view {i} {view}"]
        cmds += [f"runopcode stop.motion {i}", f"runopcode stop.cycling {i}", f"runopcode set.loop {i} {loop}",
                 f"runopcode fix.loop {i}", f"runopcode set.cel {i} {cel}", f"runopcode set.priority {i} {pri}",
                 f"runopcode reposition.to {i} {x} {y}"]
    return cmds


AL = re.compile(r"^([0-9a-f]{4}:[0-9a-f]{4}) \((.*?)\), script (-?\d+), view (\d+) \((\d+), (\d+)\), pal \d+, at (-?\d+), (-?\d+),.*\(z: (-?\d+), prio: \d+, shown: (\d+)", re.M)


def sci_objects(g):
    """Animate list as {name#n: (address, [view, loop, cel, x, y, z], visible)}; heap addresses
    differ between versions, names (and their order) don't. ("shown" in the list only means
    redrawn this frame; visibility is the signal's Hidden bit.)"""
    objs, seen = {}, {}
    al, room = g.console("animate_list", "vv g 11")
    room = int(re.search(r"== [0-9a-f]{4}:([0-9a-f]{4})", room).group(1), 16)
    for m in AL.finditer(al.replace("\r", "")):
        addr, name, script = m.group(1), m.group(2), int(m.group(3))
        # The list is only rebuilt when something animates, so a room without actors still
        # shows the previous room's. Rooms are scripts below 100: drop other rooms' actors,
        # keep globals (0), this room's and those of helper scripts (the bar's band is 300).
        if script not in (0, room) and script < 100: continue
        n = seen[name] = seen.get(name, -1) + 1
        objs[f"{name}#{n}"] = (addr, [int(m.group(i)) for i in range(4, 10)], not int(m.group(10)) & 0x0008)
    return objs


def read_state(g):
    if g.v["engine"] == "agi": return agi_state(g)
    # y <= 0 puts the whole sprite above the picture (Roger parked at 0,0 in rooms he isn't in).
    return {k: v for k, (_, v, visible) in sci_objects(g).items() if visible and v[4] > 0}


def sci_apply(state, objs):
    """Freeze every recorded actor at its [view, loop, cel, x, y, z]: no motion, no cycling,
    no script, then set the properties directly."""
    cmds = []
    for k, (a, _, visible) in objs.items():
        if visible and k not in state: cmds += [f"send {a} setScript 0", f"send {a} setCycle 0", f"send {a} hide"]
    for k, (view, loop, cel, x, y, z) in state.items():
        if k not in objs: continue  # the version doesn't have it (staged_shot says so)
        a = objs[k][0]
        if k.startswith("ego#"):
            # Roger's head (a separate Head actor) only shows while his StopWalk cycler is
            # running, and looks around while moveHead is set: keep the one, clear the other.
            cmds += [f"send {a} moveHead 0"]
        else:
            cmds += [f"send {a} setCycle 0"]
        cmds += [f"send {a} setMotion 0", f"send {a} setScript 0",
                 f"send {a} view {view}", f"send {a} loop {loop}", f"send {a} cel {cel}",
                 f"send {a} x {x}", f"send {a} y {y}", f"send {a} z {z}",
                 # An actor flagged stopUpd isn't redrawn, so its new cel would never show.
                 f"send {a} startUpd", f"send {a} show"]
    return cmds


def apply_state(g, state):
    if g.v["engine"] == "agi":
        out = g.console(*agi_apply(g, state, agi_state(g)))
    else:
        # Stop the room's own script too (global 2 is curRoom), or a cutscene carries on.
        room = re.search(r"== ([0-9a-f]{4}:[0-9a-f]{4})", g.console("vv g 2")[0]).group(1)
        out = g.console(f"send {room} setScript 0", *sci_apply(state, sci_objects(g)))
    bad = [o for o in out if "Unknown opcode" in o or "wants" in o]
    if bad: raise RuntimeError(f"debugger refused: {bad[0].strip()}")


def paused_grab(g, dest, ignore=()):
    if not g.grab(dest): return False
    try:
        normalize(dest, g.v["native"], ignore=ignore, strict=g.v.get("strict", True)); return True
    except RuntimeError as e:
        print(f"  {e}", flush=True); return False


def staged_shot(g, dest, state, ignore=()):
    """Apply the recorded state, let the game redraw it, pause, check the state really is
    what was asked for, and grab the window while the game is paused."""
    corners = g.v.get("cursor") == "corners"
    w, h = g.v["native"]; ox, oy, k = game_rect((w, h)); patch = 32
    # SCI keeps its cursor inside the picture: two frames, cursor bottom-left then bottom-right.
    spots = [(ox, oy + (h - 1) * k, (0, h - patch, patch, patch)),
             (ox + (w - 1) * k, oy + (h - 1) * k, (w - patch, h - patch, patch, patch))] if corners else [None]
    # Objects driven every cycle by the room itself (a bobbing droid) are set but not
    # checked; objects this version doesn't have can't be set, so aren't checked either.
    if g.v["engine"] == "sci":
        have = sci_objects(g)
        for k in state:
            if k not in have: print(f"  {k}: not in {g.v['game']} at {g.v['path']}, skipped", flush=True)
        want = {k: v for k, v in state.items() if k in have and k not in ignore}
    else:
        want = {k: v for k, v in state.items() if k not in ignore}
    for attempt in range(8):
        apply_state(g, state)
        if g.v["engine"] == "sci":
            # A message box opened before the room script was stopped stays up: close it
            # (the script can't open another), then set the state again.
            for _ in range(5):
                if len(re.findall(r"^\s*\d+:", g.console("window_list")[0], re.M)) <= 1: break
                g.resume(); g.key("Return"); time.sleep(0.4)
            apply_state(g, state)
        g.resume(); time.sleep(0.4)
        paths, got = [], None
        for i, spot in enumerate(spots):
            g.resume()
            if spot:
                x, y, _ = spot
                # Approach in steps: some interpreters (Mac SCI) only pick up real motion.
                for dx in (40, 20, 0):
                    sh("xdotool", "mousemove", "--window", g.win, str(x + (dx if i == 0 else -dx)), str(y - dx)); time.sleep(0.3)
                time.sleep(0.5)
            else:
                g.hide_cursor()
            got = {k: v for k, v in read_state(g).items() if k not in ignore}
            if got != want: break
            p = dest if not spot else f"{dest}.{i}.png"
            if not paused_grab(g, p, ignore=[spot[2]] if spot else ()): got = None; break
            paths.append(p)
        g.resume()
        if got == want and len(paths) == len(spots):
            if corners:
                a, b = (Image.open(p).convert("RGB") for p in paths)
                a.paste(b.crop((0, h - patch, patch, h)), (0, h - patch)); a.save(dest)
                for p in paths: os.remove(p)
            return True
        if got is not None and got != want:
            diff = {k: (want.get(k), got.get(k)) for k in set(want) | set(got) if want.get(k) != got.get(k)}
            print(f"  state mismatch (attempt {attempt + 1}): {diff}", flush=True)
    return False


def capture_scene(version, scene, room, waits, dest_dir, label=None, debug=(), after_room=None, timeline=(), state=None, record=None, setup=(), dismiss=False, ignore=()):
    """One fresh game per scene; waits is the list of seconds after the room change at
    which to take a frame (a cutscene gets several, the config picks which one is kept)."""
    shots = session(version)
    # Starting OpenGL on a busy machine occasionally fails; just try again.
    for attempt in range(3):
        try:
            g = Game(version, shots); break
        except RuntimeError as e:
            print(f"{version}/{scene}: {e}, retrying", flush=True); time.sleep(3)
    else:
        print(f"{version}/{scene}: NO SCREENSHOT (ScummVM would not start)", flush=True)
        return []
    out = []
    try:
        g.hide_cursor()
        # room None = a moment during start-up (the title), captured before the usual boot keys.
        if room is None:
            g.proc_start = time.time()
        else:
            g.boot()
            g.room(room, debug, setup)
        t0 = time.time()
        pending = sorted(timeline)  # [(seconds after the room change, key)], e.g. dismiss a message
        for i, w in enumerate(waits):
            while pending and pending[0][0] <= w:
                at, key = pending.pop(0)
                time.sleep(max(0, at - (time.time() - t0))); g.key(key)
            if dismiss:
                # Close SCI message boxes as they appear (the window list grows past the
                # picture's own port), so events play out without guessing when text shows.
                while time.time() - t0 < w:
                    time.sleep(min(0.5, max(0, w - (time.time() - t0))))
                    wl = g.console("window_list")[0]; g.resume()
                    if len(re.findall(r"^\s*\d+:", wl, re.M)) > 1: g.key("Return")
            time.sleep(max(0, w - (time.time() - t0)))
            if record is not None:
                # Read the moment's state instead of photographing it (see "record"), before
                # dismissing any message: a box doesn't change the state, staging clears it.
                record.update(read_state(g)); g.resume(); out.append("state"); continue
            keys = CFG["versions"][version].get("after_room", []) if after_room is None else after_room
            for k in keys: g.key(k)
            name = f"{label or scene}" + (f"-{i:02d}" if len(waits) > 1 else "") + ".png"
            dest = os.path.join(dest_dir, name)
            if g.v.get("cursor") == "wiggle":
                # Mac SCI only redraws its cursor on real motion: wiggle inside, then leave.
                for x, y in ((300, 300), (340, 320), (380, 300)):
                    sh("xdotool", "mousemove", "--window", g.win, str(x), str(y)); time.sleep(0.3)
            if state is not None:
                ok = staged_shot(g, dest, state, ignore)
            else:
                ok = cursor_free_shot(g, dest) if g.v.get("cursor") == "corners" else g.screenshot(dest)
            if ok:
                c, black = stats(dest)
                out.append(name)
                print(f"{version}/{name}: {Image.open(dest).size} colours={c} black={black:.2f}", flush=True)
            else:
                print(f"{version}/{name}: NO SCREENSHOT", flush=True)
    except RuntimeError as e:
        # One scene going wrong (debugger never answered, state not reproducible) shouldn't
        # take the rest of the version's scenes with it.
        print(f"{version}/{scene}: NO SCREENSHOT ({e})", flush=True)
        if os.environ.get("CONSOLE_TAIL"): print(g.out[-int(os.environ["CONSOLE_TAIL"]):], flush=True)
    finally:
        g.quit()
    return out


def main():
    start_display()
    cmd = sys.argv[1]
    if cmd == "survey":
        version, rng = sys.argv[2], sys.argv[3]
        a, b = map(int, rng.split("-"))
        d = os.path.join(OUT, "survey", version); os.makedirs(d, exist_ok=True)
        for n in range(a, b + 1):
            capture_scene(version, f"room{n:03d}", n, [4], d)
    elif cmd == "burst":
        version, n, gap = sys.argv[2], int(sys.argv[4]), float(sys.argv[5])
        debug = [a for a in sys.argv[6:] if not a.startswith("--keys=")]
        keys = [a[7:] for a in sys.argv[6:] if a.startswith("--keys=")]
        keys = None if not keys else [k for k in keys[0].split(",") if k]
        timeline = [(float(a.split(":")[0]), a.split(":")[1]) for a in debug if ":" in a and a.split(":")[0].replace(".", "").isdigit()]
        debug = [a for a in debug if a not in [f"{t:g}:{k}" for t, k in timeline] and not (":" in a and a.split(":")[0].replace(".", "").isdigit())]
        room = None if sys.argv[3] == "none" else int(sys.argv[3])
        d = os.path.join(OUT, "burst", version); os.makedirs(d, exist_ok=True)
        capture_scene(version, "boot" if room is None else f"room{room:03d}", room, [1 + i * gap for i in range(n)], d,
                      label=(f"room{room:03d}-" + "-".join(x.replace(" ", "") for x in debug)) if debug else None, debug=debug, after_room=keys, timeline=timeline)
    elif cmd == "record":
        # Read each scene's state (every object's view, loop, cel and position) in the
        # reference version and store it in scenes.json; "run" then recreates it everywhere.
        merge = "--merge" in sys.argv
        engine, only = sys.argv[2], set(a for a in sys.argv[3:] if a != "--merge")
        ref = CFG["reference"][engine]
        for scene, s in CFG["scenes"][engine].items():
            if only and scene not in only: continue
            st = {}
            if capture_scene(ref, scene, s["room"], [s.get("wait", 4)], os.path.join(OUT, "tmp"), debug=s.get("debug", []),
                             after_room=s.get("after_room"), timeline=[tuple(x) for x in s.get("keys", [])], record=st, setup=s.get("setup", []), dismiss=s.get("dismiss", False)):
                cfg = json.load(open(os.path.join(HERE, "scenes.json")))
                old = cfg["scenes"][engine][scene].get("state", {})
                # --merge keeps entries edited by hand (Roger's pose) and only adds new objects.
                cfg["scenes"][engine][scene]["state"] = {**st, **old} if merge else st
                cfg["scenes"][engine][scene].pop("align", None)
                json.dump(cfg, open(os.path.join(HERE, "scenes.json"), "w"), indent=1)
                print(f"{engine}/{scene}: recorded {st}", flush=True)
    elif cmd == "run":
        args = sys.argv[2:]
        only = set(args[args.index("--scene") + 1:]) if "--scene" in args else None
        versions = (args[:args.index("--scene")] if "--scene" in args else args) or list(CFG["versions"])
        for version in versions:
            v = CFG["versions"][version]
            d = os.path.join(OUT, "raw", version); os.makedirs(d, exist_ok=True)
            for scene, s in CFG["scenes"][v["engine"]].items():
                if only and scene not in only: continue
                ref = CFG["reference"][v["engine"]]
                ref_frame = os.path.join(OUT, "raw", ref, f"{scene}.png")
                if s.get("state") is not None:
                    # Cel numbers don't always mean the same pose across versions (EGA's Orat
                    # has its frames in another order), so a scene can pick the cel per version.
                    state = {k: list(v) for k, v in s["state"].items()}
                    for k, cel in s.get("cels", {}).get(version, {}).items(): state[k][2] = cel
                    # Recorded state: every version is set to exactly the same moment.
                    # stage_at: set the state earlier than it was recorded, before a message
                    # box opens over it (state doesn't include text windows).
                    capture_scene(version, scene, s["room"], [s.get("stage_at", s.get("wait", 4))], d, debug=s.get("debug", []), after_room=s.get("after_room"), timeline=[tuple(x) for x in s.get("keys", [])], state=state, setup=s.get("setup", []), dismiss=s.get("dismiss", False), ignore=s.get("ignore", []))
                elif s.get("align") and version != ref and os.path.exists(ref_frame):
                    # Moving things drift between versions, so take frames around the target
                    # time and keep the one whose sprites best match the reference version.
                    span, step = s["align"]
                    waits = [max(0.5, s["wait"] - span + i * step) for i in range(int(2 * span / step) + 1)]
                    tmpd = os.path.join(OUT, "tmp", f"align-{version}-{scene}"); os.makedirs(tmpd, exist_ok=True)
                    names = capture_scene(version, scene, s["room"], waits, tmpd, debug=s.get("debug", []), after_room=s.get("after_room"), timeline=[tuple(x) for x in s.get("keys", [])])
                    if names:
                        best = closest([os.path.join(tmpd, n) for n in names], ref_frame)
                        shutil.copy(best, os.path.join(d, f"{scene}.png"))
                        print(f"{version}/{scene}: aligned to {ref} using {os.path.basename(best)}", flush=True)
                    shutil.rmtree(tmpd, ignore_errors=True)
                else:
                    # One frame per fresh session at a fixed time after the room change.
                    capture_scene(version, scene, s["room"], [s.get("wait", 4)], d, debug=s.get("debug", []), after_room=s.get("after_room"), timeline=[tuple(x) for x in s.get("keys", [])])
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main()
