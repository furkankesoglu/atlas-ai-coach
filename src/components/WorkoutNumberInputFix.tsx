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
      const input = event.target;
      if (!isWorkoutNumberInput(input)) return;

      window.requestAnimationFrame(() => {
        input.select();
      });
    }

    function handleKeyDown(event: KeyboardEvent) {
      const input = event.target;
      if (!isWorkoutNumberInput(input)) return;

      const allSelected = input.selectionStart === 0 && input.selectionEnd === input.value.length;
      const clearingZero = (event.key === "Backspace" || event.key === "Delete") &&
        (input.value === "0" || allSelected);

      if (!clearingZero) return;

      event.preventDefault();
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
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
