"use client";
import { useMemo, useState } from "react";

type Props = {
  authorName: string;
  avatarURL?: string;
  createdAt?: Date | null;
  text: string;
  /** chars to keep before showing “Show more” */
  previewChars?: number;
  /** visual line clamp when collapsed */
  previewLines?: number;
};

export default function CommentItem({
  authorName,
  avatarURL,
  createdAt,
  text,
  previewChars = 800,
  previewLines = 10,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const needsClamp = useMemo(
    () => (text?.length ?? 0) > previewChars,
    [text, previewChars]
  );

  return (
    <li className="comment-row">
      {/* avatar */}
      <div className="comment-avatar">
        {avatarURL ? (
          <img src={avatarURL} alt="" className="comment-avatar-img" />
        ) : (
          <div className="comment-avatar-ph">
            {(authorName?.[0] || "U").toUpperCase()}
          </div>
        )}
      </div>

      {/* text column */}
      <div className="comment-textcol">
        <div className="comment-meta">
          <span className="comment-author">{authorName}</span>
          {createdAt ? (
            <span className="comment-time">
              {createdAt.toLocaleDateString()}{" "}
              {createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          ) : null}
        </div>

        <div className="comment-bubble">
          <p
            className={[
              "comment-text",
              !expanded && needsClamp ? "comment-clamp" : "",
            ].join(" ")}
            style={
              !expanded && needsClamp
                ? { WebkitLineClamp: previewLines }
                : undefined
            }
          >
            {text}
          </p>

          {needsClamp && (
            <button
              className="comment-more"
              onClick={() => setExpanded((s) => !s)}
              type="button"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
