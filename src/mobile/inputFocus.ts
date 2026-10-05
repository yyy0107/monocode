/** Keep an active input's keyboard open when pressing a non-editable control. */
export function preserveInputFocus(
  event: { target: EventTarget | null; preventDefault: () => void },
  input: HTMLElement | null | undefined,
) {
  if (
    input &&
    document.activeElement === input &&
    event.target instanceof Element &&
    !event.target.closest("input, textarea, select, [contenteditable]")
  )
    event.preventDefault();
}
