"use client";

import { useEffect } from "react";

export default function WorkoutNumberInputFix() {
  useEffect(() => {
    function isNumberInput(target: EventTarget | null): target is HTMLInputElement {
      return target instanceof HTMLInputElement && target.type === "number";
    }

    function isFullySelected(input: HTMLInputElement) {
      return input.selectionStart === 0 && input.selectionEnd === input.value.length;
    }

    function clearWithoutReactReset(input: HTMLInputElement) {
      // Do not dispatch an input event here. Most controlled fields convert
      // Number("") back to 0 immediately, which is the bug we are avoiding.
      input.value = "";
    }

    function handleFocus(event: FocusEvent) {
      const input = event.target;
      if (!isNumberInput(input) || input.value !== "0") return;

      window.requestAnimationFrame(() => input.select());
    }

    function handleKeyDown(event: KeyboardEvent) {
      const input = event.target;
      if (!isNumberInput(input)) return;

      const deleting = event.key === "Backspace" || event.key === "Delete";
      if (!deleting) return;

      const shouldClear = input.value === "0" || isFullySelected(input);
      if (!shouldClear) return;

      event.preventDefault();
      clearWithoutReactReset(input);
    }

    function handleBeforeInput(event: InputEvent) {
      const input = event.target;
      if (!isNumberInput(input)) return;

      const deleting = event.inputType === "deleteContentBackward" ||
        event.inputType === "deleteContentForward" ||
        event.inputType === "deleteByCut";
      if (!deleting) return;

      const shouldClear = input.value === "0" || isFullySelected(input);
      if (!shouldClear) return;

      event.preventDefault();
      clearWithoutReactReset(input);
    }

    function handleBlur(event: FocusEvent) {
      const input = event.target;
      if (!isNumberInput(input) || input.value !== "") return;

      // Empty is allowed while editing. On leaving the field, normalize it
      // back to zero so existing numeric state and calculations stay valid.
      input.value = "0";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    document.addEventListener("focusin", handleFocus);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("beforeinput", handleBeforeInput as EventListener);
    document.addEventListener("focusout", handleBlur);

    return () => {
      document.removeEventListener("focusin", handleFocus);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("beforeinput", handleBeforeInput as EventListener);
      document.removeEventListener("focusout", handleBlur);
    };
  }, []);

  return null;
}
