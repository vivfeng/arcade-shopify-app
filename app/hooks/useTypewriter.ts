import { useCallback, useEffect, useRef, useState } from "react";

const TYPING_SPEED_MS = 60;
const PAUSE_AFTER_TYPED_MS = 2000;
const ERASING_SPEED_MS = 30;
const PAUSE_AFTER_ERASED_MS = 400;

/**
 * Cycles through strings with a typewriter effect. Pauses when the user has
 * started typing (mirrors Arcade Lab / marketplace PromptBox behavior).
 */
export function useTypewriter(strings: string[], paused: boolean) {
  const [display, setDisplay] = useState("");
  const indexRef = useRef(0);
  const phaseRef = useRef<"typing" | "pausing" | "erasing" | "waiting">("typing");
  const charRef = useRef(0);

  const tick = useCallback(() => {
    const current = strings[indexRef.current] ?? "";

    switch (phaseRef.current) {
      case "typing": {
        charRef.current += 1;
        setDisplay(current.slice(0, charRef.current));
        if (charRef.current >= current.length) {
          phaseRef.current = "pausing";
        }
        return phaseRef.current === "pausing" ? PAUSE_AFTER_TYPED_MS : TYPING_SPEED_MS;
      }
      case "pausing": {
        phaseRef.current = "erasing";
        return ERASING_SPEED_MS;
      }
      case "erasing": {
        charRef.current -= 1;
        setDisplay(current.slice(0, charRef.current));
        if (charRef.current <= 0) {
          phaseRef.current = "waiting";
        }
        return phaseRef.current === "waiting" ? PAUSE_AFTER_ERASED_MS : ERASING_SPEED_MS;
      }
      case "waiting": {
        indexRef.current = (indexRef.current + 1) % Math.max(strings.length, 1);
        charRef.current = 0;
        phaseRef.current = "typing";
        return TYPING_SPEED_MS;
      }
    }
  }, [strings]);

  useEffect(() => {
    if (paused) return;

    let timer: ReturnType<typeof setTimeout>;

    function schedule() {
      const delay = tick();
      timer = setTimeout(schedule, delay);
    }

    schedule();
    return () => clearTimeout(timer);
  }, [paused, tick]);

  return display;
}
