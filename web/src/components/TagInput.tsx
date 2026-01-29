"use client";

import { useState } from "react";

type TagInputProps = {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
};

export default function TagInput({
  label,
  value,
  onChange,
  placeholder,
}: TagInputProps) {
  const [text, setText] = useState("");

  const addTag = (raw: string) => {
    const cleaned = raw.trim();
    if (!cleaned) return;
    if (value.includes(cleaned)) {
      setText("");
      return;
    }
    onChange([...value, cleaned]);
    setText("");
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((item) => item !== tag));
  };

  return (
    <label className="flex flex-col gap-2 text-sm">
      {label}
      <div className="ink-border flex flex-wrap items-center gap-2 px-2 py-2">
        {value.map((tag) => (
          <span key={tag} className="chip chip-button">
            {tag}
            <button
              className="ml-2 text-xs"
              onClick={() => removeTag(tag)}
              type="button"
            >
              ×
            </button>
          </span>
        ))}
        <input
          className="min-w-[140px] flex-1 bg-transparent px-2 py-1 text-sm outline-none"
          placeholder={placeholder}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              addTag(text.replace(",", ""));
            }
            if (event.key === "Backspace" && text.length === 0 && value.length) {
              removeTag(value[value.length - 1]);
            }
          }}
          onBlur={() => addTag(text)}
        />
      </div>
      <p className="text-xs text-[var(--ink-700)]">
        Press Enter or comma to add.
      </p>
    </label>
  );
}
