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
  wide?: boolean;
  closeButton?: boolean;
  content: ReactNode;
}

export function App() {
  const { view, set } = useView();
  const [agiFont, toggleAgiFont] = useAgiFont();
  const [openMenu, setOpenMenu] = useState(-1);
  const [message, setMessage] = useState<Message | null>(null);
  const parser = useRef<HTMLInputElement>(null);

  useEffect(() => {
    parser.current?.focus();
  }, []);

  const zoomInto = (side: "a" | "b") => {
    const v = VERSIONS[side === "a" ? view.a : view.b];
    setMessage({ wide: true, closeButton: true, content: <ZoomView version={v} scene={SCENES[view.scene]} /> });
  };
  const say = (...lines: string[]) => setMessage({ content: lines.map((l) => <p key={l}>{l}</p>) });
  const closeMessage = () => {
    setMessage(null);
    parser.current?.focus();
  };

  // Menus, keys and the parser all go through these.
  const actions: Actions = {
    scene: set.scene,
    version: set.version,
    compare: set.compare,
    swap: set.swap,
    crt: () => (crtSupported ? set.crt() : say("This browser has no WebGL2, so no CRT.")),
    zoom: set.zoom,
    link: async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        say("The link to this view has been copied.");
      } catch {
        say("Couldn't copy the link. Here it is:", location.href);
      }
    },
    look: () => zoomInto("a"),
    about: () => setMessage({ closeButton: true, content: <AboutText /> }),
    help: () => setMessage({ closeButton: true, content: <HelpText /> }),
    font: toggleAgiFont,
  };

  useGlobalKeys({
    messageOpen: message !== null,
    closeMessage,
    actions,
    set,
    parser,
    toggleMenu: () => setOpenMenu((open) => (open >= 0 ? -1 : 0)),
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
        { label: "Compare", keys: "<F2>", check: view.compare, run: () => actions.compare() },
        { label: "Swap A and B", keys: "<F3>", disabled: !view.compare, run: actions.swap },
        "-",
        { label: "Copy link", keys: "<F9>", run: actions.link },
      ],
    },
    {
      title: "Display",
      items: [
        ...ZOOMS.map((z) => ({ label: `Zoom ${z}x`, radio: view.zoom === z, run: () => actions.zoom(z) })),
        { label: "CRT", keys: "<F4>", check: view.crt, disabled: !crtSupported, run: actions.crt },
        "-",
        { label: "Use AGI font", check: agiFont, run: actions.font },
      ],
    },
  ];

  const scene = SCENES[view.scene],
    A = VERSIONS[view.a],
    B = VERSIONS[view.b];
  const name = (v: Version) => `${v.engine} ${v.name}`;
  const right = view.compare
    ? `${name(A)} │ ${name(B)}`
    : `${name(A)}, ${A.year}, ${A.native.join("x")}${A.approx ? " *" : ""}`;

  return (
    <>
      <StatusLine left={scene.name} right={right} menus={menus} openMenu={openMenu} setOpenMenu={setOpenMenu} />
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
        <MessageBox wide={message.wide} closeButton={message.closeButton} onClose={closeMessage}>
          {message.content}
        </MessageBox>
      )}
    </>
  );
}
