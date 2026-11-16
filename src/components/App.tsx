import { type ReactNode, useEffect, useRef, useState } from "react";
import { SCENES, VERSIONS, versionLabel } from "../data.ts";
import { useAgiFont } from "../hooks/useAgiFont.ts";
import { crtSupported } from "../hooks/useCrt.ts";
import { useGlobalKeys } from "../hooks/useGlobalKeys.ts";
import { useView, ZOOMS } from "../hooks/useView.ts";
import { type Actions, parse } from "../parser.ts";
import { AboutText } from "./AboutText.tsx";
import styles from "./App.module.css";
import { HelpText } from "./HelpText.tsx";
import type { Menu } from "./MenuBar.tsx";
import { MessageBox, type MessageKind } from "./MessageBox.tsx";
import { ParserLine } from "./ParserLine.tsx";
import { SierraLogo } from "./SierraLogo.tsx";
import { StatusLine } from "./StatusLine.tsx";
import { Viewer } from "./Viewer.tsx";
import { ZoomView } from "./ZoomView.tsx";

interface Message {
  kind: MessageKind;
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
    setMessage({ kind: "picture", content: <ZoomView version={v} scene={SCENES[view.scene]} /> });
  };
  const say = (...lines: string[]) => setMessage({ kind: "reply", content: lines.map((l) => <p key={l}>{l}</p>) });
  const closeMessage = () => {
    setMessage(null);
    parser.current?.focus();
  };

  const copyLink = async (copied: string) => {
    try {
      await navigator.clipboard.writeText(location.href);
      say(copied);
    } catch {
      say("Couldn't copy the link. Here it is:", location.href);
    }
  };

  const actions: Actions = {
    ...set,
    toggleCrt: () => {
      if (crtSupported) set.toggleCrt();
      else say("This browser has no WebGL2, so no CRT.");
    },
    link: () => copyLink("The link to this view has been copied."),
    // The link is the saved game: open it to come back to this view.
    save: () => copyLink("Game saved (link copied)."),
    restart: () => location.reload(),
    look: () => zoomInto("a"),
    about: () => setMessage({ kind: "text", content: <AboutText /> }),
    help: () => setMessage({ kind: "text", content: <HelpText /> }),
    toggleAgiFont,
  };

  useGlobalKeys({
    messageOpen: message !== null,
    closeMessage,
    actions,
    parser,
    toggleMenu: () => setOpenMenu((open) => (open === null ? 0 : null)),
  });

  const menus: Menu[] = [
    {
      title: "Sierra",
      icon: <SierraLogo />,
      groups: [
        [
          { label: "About these versions", run: actions.about },
          { label: "Help", keys: "<F1>", run: actions.help },
        ],
      ],
    },
    {
      title: "Special",
      groups: [
        [
          { label: "Compare", keys: "<F2>", checked: view.comparing, run: actions.toggleCompare },
          { label: "Swap A and B", keys: "<F3>", disabled: !view.comparing, run: actions.swap },
        ],
        [{ label: "Copy link", keys: "<F9>", run: actions.link }],
      ],
    },
    {
      title: "Display",
      groups: [
        [
          ...ZOOMS.map((z) => ({ label: `Zoom ${z}x`, selected: view.zoom === z, run: () => actions.zoom(z) })),
          { label: "CRT", keys: "<F4>", checked: view.crt, disabled: !crtSupported, run: actions.toggleCrt },
        ],
        [{ label: "Use AGI font", checked: agiFont, run: actions.toggleAgiFont }],
      ],
    },
  ];

  const scene = SCENES[view.scene],
    A = VERSIONS[view.a],
    B = VERSIONS[view.b];
  const versionText = view.comparing
    ? `${versionLabel(A)} │ ${versionLabel(B)}`
    : `${versionLabel(A)}, ${A.year}, ${A.native.join("x")}`;

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
          if ("reply" in r) say(r.reply);
          else r.run(actions);
        }}
      />
      {message && (
        <MessageBox kind={message.kind} onClose={closeMessage}>
          {message.content}
        </MessageBox>
      )}
    </>
  );
}
