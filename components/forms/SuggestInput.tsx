"use client";

// SuggestInput — an accessible, free-text-FIRST editable combobox.
// ─────────────────────────────────────────────────────────────────────────────
// Research-backed pattern (WAI-ARIA APG "editable combobox", aria-autocomplete
// ="none"): the user can ALWAYS type freely; the suggestion list is additive and
// unfiltered, never a constraint. We deliberately do NOT use "automatic selection"
// (which would commit a suggestion as the value on blur) or a select-only combobox
// (no freeform input) — both would violate "free text is never a constraint".
//   • First option is ALWAYS "✎ Type your own answer" — selecting it just dismisses
//     the list and keeps whatever's typed.
//   • Suggestions are illustrative answer-SHAPES, never facts/claims.
//   • Keyboard: ↓/↑ open+move, Enter selects the active option, Esc closes; typing
//     goes straight to the input and does NOT filter the list (aria-autocomplete=none).
// Zero new dependencies — native <input> + <ul role="listbox">.

import { useId, useRef, useState } from "react";

const FREE_TEXT_LABEL = "✎ Type your own answer";

export default function SuggestInput({
  value,
  onChange,
  suggestions,
  placeholder,
  ariaLabel,
  inputClassName,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Illustrative answer-shapes shown below the always-present free-text row. */
  suggestions: string[];
  placeholder?: string;
  ariaLabel?: string;
  /** Match the host form's field styling; the wrapper adds the chevron + popup. */
  inputClassName?: string;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  // active index over the option list: 0 = the free-text row, 1..N = suggestions[i-1].
  const [active, setActive] = useState(-1);

  const optionCount = suggestions.length + 1; // +1 for the free-text-first row
  const optId = (i: number) => `${listId}-opt-${i}`;

  function close() {
    setOpen(false);
    setActive(-1);
  }

  function commit(i: number) {
    // i === 0 → the free-text row: keep whatever is typed, just dismiss.
    if (i > 0) onChange(suggestions[i - 1]);
    close();
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(0);
      } else {
        setActive((a) => (a + 1) % optionCount);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(optionCount - 1);
      } else {
        setActive((a) => (a - 1 + optionCount) % optionCount);
      }
    } else if (e.key === "Enter") {
      if (open && active >= 0) {
        e.preventDefault();
        commit(active);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        close();
      }
    }
    // Printable characters fall through to the input untouched — the list is
    // NOT filtered by what's typed (aria-autocomplete="none").
  }

  const OPT_BASE =
    "cursor-pointer px-2 py-1.5 text-xs leading-snug text-[#123d2c] dark:text-[#eef3f8]";
  const OPT_ACTIVE = "bg-[#f3ead0] dark:bg-[#153a5c]";

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="none"
        aria-activedescendant={open && active >= 0 ? optId(active) : undefined}
        aria-label={ariaLabel}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={close}
        className={inputClassName}
      />
      {/* Chevron toggle — preventDefault keeps input focus (so onBlur doesn't fire). */}
      <button
        type="button"
        tabIndex={-1}
        aria-label={open ? "Hide suggestions" : "Show suggestions"}
        onMouseDown={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
          setActive(-1);
          inputRef.current?.focus();
        }}
        className="absolute inset-y-0 right-0 flex w-7 items-center justify-center text-[#9aa7b8] hover:text-[#4c5d75] dark:hover:text-[#c2d1e0]"
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden className={open ? "rotate-180" : ""}>
          <path d="M2.5 4.5 6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          id={listId}
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-[#d6c9a8] bg-white py-1 shadow-lg dark:border-[#2a4a6b] dark:bg-[#0d1f17]"
        >
          <li
            role="option"
            id={optId(0)}
            aria-selected={active === 0}
            onMouseDown={(e) => {
              e.preventDefault();
              commit(0);
            }}
            className={`${OPT_BASE} font-medium text-[#8a6d1f] dark:text-[#d4af37] ${active === 0 ? OPT_ACTIVE : ""}`}
          >
            {FREE_TEXT_LABEL}
          </li>
          {suggestions.length > 0 && (
            <li role="presentation" className="my-1 border-t border-[#ece4d0] dark:border-[#223a2e]" aria-hidden />
          )}
          {suggestions.map((s, i) => (
            <li
              key={s}
              role="option"
              id={optId(i + 1)}
              aria-selected={active === i + 1}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(i + 1);
              }}
              className={`${OPT_BASE} ${active === i + 1 ? OPT_ACTIVE : "hover:bg-[#f7f1e2] dark:hover:bg-[#0f2b44]"}`}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
