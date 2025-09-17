// components/comments/CommentItem.tsx
"use client";

import { useMemo, useState } from "react";

export default function CommentItem({
  text,
  previewChars = 800,
  previewLines = 10,
}: {
  text: string;
  previewChars?: number;
  previewLines?: number;
}) {
  const needsClamp = (text?.length || 0) > previewChars;
  const [expanded, setExpanded] = useState(false);

  const shown = useMemo(() => {
    if (expanded) return text;
    if (!needsClamp) return text;
    return text.slice(0, previewChars);
  }, [text, expanded, needsClamp, previewChars]);

  return (
    <div className="comment">
      <p className={`cmtText ${expanded ? "" : "clamped"}`}>{shown}</p>
      {needsClamp && (
        <button className="show" onClick={() => setExpanded((s) => !s)}>
          {expanded ? "Show less" : "Show more"}
        </button>
      )}

      <style jsx>{`
        .comment { display:grid; gap:6px; }
        .cmtText {
          margin:4px 0 0;
          color:#0f172a;
          white-space:pre-wrap;
          /* keep text inside box, even with long tokens/urls */
          overflow-wrap:anywhere;
          word-break:break-word;
        }
        .cmtText.clamped {
          display:-webkit-box;
          -webkit-line-clamp:${previewLines};
          -webkit-box-orient:vertical;
          overflow:hidden;
        }
        .show {
          align-self:start;
          border:none;
          background:transparent;
          color:#0f172a;
          text-decoration:underline;
          cursor:pointer;
          padding:0;
          font-size:13px;
        }
      `}</style>
    </div>
  );
}
