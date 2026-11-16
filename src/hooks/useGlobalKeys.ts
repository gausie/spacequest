import { type RefObject, useEffect, useEffectEvent } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import type { Actions } from "../parser.ts";
import type { ViewSetters } from "./useView.ts";

interface Options {
  messageOpen: boolean;
  closeMessage: () => void;
  actions: Actions;
  set: ViewSetters;
  toggleMenu: () => void;
  parser: RefObject<HTMLInputElement | null>;
}

// The keyboard, as in the game: letters go to the parser, arrows browse, function keys do what
// the menus say, Esc opens the menu bar. An open message box takes only Enter and Esc, to close.
// Open menus handle their own keys (Dropdown stops them reaching here).
export function useGlobalKeys({ messageOpen, closeMessage, actions, set, toggleMenu, parser }: Options) {
  const inMenu = (e: KeyboardEvent) => !!(e.target as Element).closest("#dropdown");
  const typing = () => (parser.current?.value ?? "") !== "";
  // The parser input has focus most of the time, so keys work from it too.
  const keys = {
    enabled: !messageOpen,
    enableOnFormTags: ["input"] as const,
    preventDefault: true,
    ignoreEventWhen: inMenu,
  };

  useHotkeys("enter, escape", closeMessage, {
    enabled: messageOpen,
    enableOnFormTags: true,
    preventDefault: true,
    // Enter on a link or button in the box does that instead.
    ignoreEventWhen: (e) => !!(e.target as Element).closest("a, button:not([aria-label=Close])"),
  });
  useHotkeys("escape", toggleMenu, keys);
  useHotkeys("f1", actions.help, keys);
  useHotkeys("f2", () => actions.compare(), keys);
  useHotkeys("f3", actions.swap, keys);
  useHotkeys("f4", actions.crt, keys);
  useHotkeys("f9", actions.link, keys);
  useHotkeys("up", () => set.sceneStep(-1), keys);
  useHotkeys("down", () => set.sceneStep(1), keys);
  // Left and right move the cursor in a half-typed command instead.
  useHotkeys("left", () => set.versionStep(-1), { ...keys, ignoreEventWhen: (e) => inMenu(e) || typing() });
  useHotkeys("right", () => set.versionStep(1), { ...keys, ignoreEventWhen: (e) => inMenu(e) || typing() });

  // Not a hotkey: any letter typed, wherever the focus was, lands in the parser.
  const toParser = useEffectEvent((e: KeyboardEvent) => {
    if (messageOpen || e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1 || inMenu(e)) return;
    if (document.activeElement !== parser.current) parser.current?.focus();
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => toParser(e);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);
}
