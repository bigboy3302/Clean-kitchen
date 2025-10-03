
"use client";

import { useState, useMemo } from "react";

type Props = {
  text: string;
  previewChars?: number; 
  className?: string;
};

export default function ExpandableText({ text, previewChars = 300, className }: Props) {
  const [expanded, setExpanded] = useState(false);

  const needsClamp = text?.length > previewChars;
  const shown = useMemo(
    () => (expanded || !needsClamp ? text : text.slice(0, previewChars) + "…"),
    [expanded, needsClamp, text, previewChars]
  );

  return (
    <div className={className}>
      <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{shown}</p>
      {needsClamp && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            marginTop: 6,
            border: "1px solid #e5e7eb",
            background: "#fff",
            borderRadius: 8,
            padding: "4px 8px",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
