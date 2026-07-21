"use client";

import { useEffect } from "react";

export default function WorkoutNumberInputFix() {
  useEffect(() => {
    function isWorkoutNumberInput(target: EventTarget | null): target is HTMLInputElement {
      return target instanceof HTMLInputElement &&
        target.type === "number" &&
        Boolean(target.closest(".set-row"));
    }

    function handleFocus(event: FocusEvent) {
      if (!isWorkoutNumberInput(event.target)) return;
      window.requestAnimationFrame(() => event.target.select());
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (!isWorkoutNumberInput(event.target)) return;

      const input = event.target;
      const allSelected = input.selectionStart === 0 && input.selectionEnd === input.value.length;
      const clearingZero = (event.key === "Backspace" || event.key === "Delete") &&
        (input.value === "0" || allSelected);

      if (!clearingZero) return;

      event.preventDefault();
      input.value = "";
    }

    document.addEventListener("focusin", handleFocus);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("focusin", handleFocus);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return null;
}
