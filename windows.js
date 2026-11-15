// Draggable windows: any .win.free is placed by data-pos="left%,top%" and moved by its title.
let top = 10;

export function initWindows(root = document) {
  root.querySelectorAll(".win.free").forEach(win => {
    const [x, y] = (win.dataset.pos || "10,10").split(",").map(Number);
    win.style.left = `${x}%`; win.style.top = `${y}%`;
    win.addEventListener("pointerdown", () => { win.style.zIndex = ++top; });
    const grip = win.querySelector(".tbar");
    grip.addEventListener("pointerdown", e => {
      if (e.button !== 0) return;
      e.preventDefault();
      grip.setPointerCapture(e.pointerId);
      const desk = win.offsetParent.getBoundingClientRect(), r = win.getBoundingClientRect();
      const dx = e.clientX - r.left, dy = e.clientY - r.top;
      document.body.classList.add("moving");
      grip.onpointermove = ev => {
        // Keep the title bar on the desk so a window can't be lost off-screen.
        const nx = Math.min(Math.max(ev.clientX - dx - desk.left, -r.width + 60), desk.width - 60);
        const ny = Math.min(Math.max(ev.clientY - dy - desk.top, 0), desk.height - 30);
        win.style.left = `${(nx / desk.width) * 100}%`;
        win.style.top = `${(ny / desk.height) * 100}%`;
      };
      grip.onpointerup = () => { grip.onpointermove = null; document.body.classList.remove("moving"); };
    });
    win.querySelector(".close")?.addEventListener("click", () => { win.hidden = true; });
  });
}

export function showAll(root) { root.querySelectorAll(".win.free").forEach(w => { w.hidden = false; }); }
