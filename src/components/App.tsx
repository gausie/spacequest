import { type ReactNode, useEffect, useRef, useState } from "react";
import { SCENES, VERSIONS, type Version } from "../data.ts";
import { useAgiFont } from "../hooks/useAgiFont.ts";
import { crtSupported } from "../hooks/useCrt.ts";
import { useGlobalKeys } from "../hooks/useGlobalKeys.ts";
import { useView, ZOOMS } from "../hooks/useView.ts";
import { type Actions, parse } from "../parser.ts";
import { AboutText } from "./AboutText.tsx";
import styles from "./App.module.css";
import { HelpText } from "./HelpText.tsx";
import type { Menu } from "./MenuBar.tsx";
import { MessageBox } from "./MessageBox.tsx";
import { ParserLine } from "./ParserLine.tsx";
import { SierraLogo } from "./SierraLogo.tsx";
import { StatusLine } from "./StatusLine.tsx";
import { Viewer } from "./Viewer.tsx";
import { ZoomView } from "./ZoomView.tsx";

// closeButton: something to read or look at, which clicks inside shouldn't close.
interface Message {
  holdsPicture?: boolean;
  persistent?: boolean;
  content: ReactNode;
}

export function App() {
  const { view, set } = useView();
  const [agiFont, toggleAgiFont] = useAgiFont();
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const parser = useRef<HTMLInputElement>(null);

  useEffect(() => {
    parser.current?.focus();
  }, []);

  const zoomInto = (side: "a" | "b") => {
    const v = VERSIONS[side === "a" ? view.a : view.b];
    setMessage({ holdsPicture: true, persistent: true, content: <ZoomView version={v} scene={SCENES[view.scene]} /> });
  };
  const say = (...lines: string[]) => setMessage({ content: lines.map((l) => <p key={l}>{l}</p>) });
  const closeMessage = () => {
    setMessage(null);
    parser.current?.focus();
  };

  const actions: Actions = {
    scene: set.scene,
    version: set.version,
    toggleCompare: set.toggleCompare,
    compareWith: set.compareWith,
    swap: set.swap,
    toggleCrt: () => (crtSupported ? set.toggleCrt() : say("This browser has no WebGL2, so no CRT.")),
    zoom: set.zoom,
    cycleZoom: set.cycleZoom,
    link: async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        say("The link to this view has been copied.");
      } catch {
        say("Couldn't copy the link. Here it is:", location.href);
      }
    },
    look: () => zoomInto("a"),
    about: () => setMessage({ persistent: true, content: <AboutText /> }),
    help: () => setMessage({ persistent: true, content: <HelpText /> }),
    toggleAgiFont,
  };

  useGlobalKeys({
    messageOpen: message !== null,
    closeMessage,
    actions,
    set,
    parser,
    toggleMenu: () => setOpenMenu((open) => (open === null ? 0 : null)),
  });

  const menus: Menu[] = [
    {
      title: "Sierra",
      icon: <SierraLogo />,
      items: [
        { label: "About these versions", run: actions.about },
        { label: "Help", keys: "<F1>", run: actions.help },
      ],
    },
    {
      title: "Special",
      items: [
        { label: "Compare", keys: "<F2>", checked: view.comparing, run: actions.toggleCompare },
        { label: "Swap A and B", keys: "<F3>", disabled: !view.comparing, run: actions.swap },
        "-",
        { label: "Copy link", keys: "<F9>", run: actions.link },
      ],
    },
    {
      title: "Display",
      items: [
        ...ZOOMS.map((z) => ({ label: `Zoom ${z}x`, selected: view.zoom === z, run: () => actions.zoom(z) })),
        { label: "CRT", keys: "<F4>", checked: view.crt, disabled: !crtSupported, run: actions.toggleCrt },
        "-",
        { label: "Use AGI font", checked: agiFont, run: actions.toggleAgiFont },
      ],
    },
  ];

  const scene = SCENES[view.scene],
    A = VERSIONS[view.a],
    B = VERSIONS[view.b];
  const name = (v: Version) => `${v.engine} ${v.name}`;
  const versionText = view.comparing
    ? `${name(A)} │ ${name(B)}`
    : `${name(A)}, ${A.year}, ${A.native.join("x")}${A.standInNote ? " *" : ""}`;

  return (
    <>
      <StatusLine
        sceneName={scene.name}
        versionText={versionText}
        menus={menus}
        openMenu={openMenu}
        setOpenMenu={setOpenMenu}
      />
      <main className={styles.desk}>
        <Viewer view={view} set={set} onZoom={zoomInto} />
      </main>
      <ParserLine
        ref={parser}
        onCommand={(text) => {
          const r = parse(text, view);
          if ("error" in r) say(r.error);
          else r.run(actions);
        }}
      />
      {message && (
        <MessageBox holdsPicture={message.holdsPicture} persistent={message.persistent} onClose={closeMessage}>
          {message.content}
        </MessageBox>
      )}
    </>
  );
}
