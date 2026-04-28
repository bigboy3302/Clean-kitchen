"use client";

import Image from "next/image";
import type { Goal } from "@/lib/fitness/calc";
import { getDirectWorkoutVideoUrl, getYouTubeEmbedUrl, getYouTubeThumbnailUrl } from "@/lib/workouts/media";

type Exercise = {
  id: string | number;
  name: string;
  bodyPart: string;
  target?: string | null;
  equipment: string;
  gifUrl?: string | null;
  imageUrl?: string | null;
  imageThumbnailUrl?: string | null;
  descriptionHtml?: string | null;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  equipmentList?: string[];
  videoUrl?: string | null;
};

type Props = {
  exercise: Exercise;
  goal?: Goal;
  onClose: () => void;
};

export default function WorkoutModal({ exercise, goal, onClose }: Props) {
  function cap(value: string) {
    return value.length ? value.charAt(0).toUpperCase() + value.slice(1) : value;
  }

  function toGifProxySrc(value?: string | null) {
    const src = (value || "").trim();
    if (!src) return null;
    if (src.startsWith("/api/workouts/gif")) return src;
    if (src.startsWith("/")) return src;
    return `/api/workouts/gif?src=${encodeURIComponent(src)}`;
  }

  const tutorialUrl = getDirectWorkoutVideoUrl(exercise.name, exercise.videoUrl);
  const ytEmbedUrl = getYouTubeEmbedUrl(tutorialUrl);
  const heroSrc =
    toGifProxySrc(exercise.gifUrl) ||
    toGifProxySrc(exercise.imageThumbnailUrl) ||
    toGifProxySrc(exercise.imageUrl) ||
    getYouTubeThumbnailUrl(tutorialUrl) ||
    "/placeholder.png";

  const tags = [
    exercise.bodyPart,
    exercise.target && exercise.target !== exercise.bodyPart ? exercise.target : null,
    exercise.equipment,
    ...(exercise.primaryMuscles ?? []).slice(0, 1),
  ].filter(Boolean) as string[];

  return (
    <div className="ov" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="sheet" onClick={(event) => event.stopPropagation()}>
        <button className="closeBtn" onClick={onClose} aria-label="Close">✕</button>

        <div className="media">
          <Image
            src={heroSrc}
            alt={exercise.name}
            fill
            unoptimized
            onError={({ currentTarget }) => {
              currentTarget.src = "/placeholder.png";
            }}
          />
        </div>

        <div className="body">
          <div className="titleRow">
            <h3>{cap(exercise.name)}</h3>
            {goal ? <span className={`goalBadge ${goal}`}>{goal.toUpperCase()}</span> : null}
          </div>

          {tags.length ? (
            <div className="tags">
              {tags.map((tag) => (
                <span key={tag}>{cap(tag)}</span>
              ))}
            </div>
          ) : null}

          {exercise.descriptionHtml ? (
            <div
              className="prose"
              dangerouslySetInnerHTML={{
                __html: exercise.descriptionHtml.replace(/<[^>]+>/g, (tag: string) =>
                  /^(<br\s*\/?>|<p>|<\/p>|<ul>|<\/ul>|<ol>|<\/ol>|<li>|<\/li>)$/i.test(tag) ? tag : ""
                ),
              }}
            />
          ) : (
            <p className="muted">No description available.</p>
          )}

          <div className="ytSection">
            <p className="ytLabel">Tutorial</p>
            {ytEmbedUrl ? (
              <div className="ytEmbed">
                <iframe
                  src={ytEmbedUrl}
                  title={`${exercise.name} tutorial`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : tutorialUrl ? (
              <a href={tutorialUrl} target="_blank" rel="noopener noreferrer" className="ytSearch">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="ytIcon">
                  <path fill="#fff" d="M22.54 6.42a2.78 2.78 0 0 0-1.94-1.96C18.88 4 12 4 12 4s-6.88 0-8.6.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.94 1.97C5.12 20 12 20 12 20s6.88 0 8.6-.45a2.78 2.78 0 0 0 1.94-1.97A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
                  <polygon fill="#ff0000" points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" />
                </svg>
                Watch on YouTube
                <span className="ytQuery">Open the full tutorial video</span>
              </a>
            ) : (
              <p className="muted">Tutorial video unavailable.</p>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .ov {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.7);
          display: grid;
          place-items: center;
          padding: 16px;
          z-index: 3000;
        }
        .sheet {
          width: min(640px, 100%);
          max-height: 92vh;
          overflow-y: auto;
          background: var(--bg2);
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          border-radius: 24px;
          box-shadow: 0 40px 120px rgba(15, 23, 42, 0.4);
          position: relative;
          display: grid;
        }
        .closeBtn {
          position: absolute;
          top: 14px;
          right: 14px;
          z-index: 10;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          background: color-mix(in oklab, var(--bg2) 92%, transparent);
          color: var(--text);
          font-size: 1rem;
          display: grid;
          place-items: center;
          cursor: pointer;
          backdrop-filter: blur(8px);
          transition: background 0.15s ease;
        }
        .closeBtn:hover {
          background: color-mix(in oklab, var(--bg) 80%, transparent);
        }
        .media {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          overflow: hidden;
          border-radius: 24px 24px 0 0;
          background: color-mix(in oklab, var(--bg) 80%, transparent);
        }
        .media :global(img) {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .body {
          padding: 20px 24px 24px;
          display: grid;
          gap: 14px;
        }
        .titleRow {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        h3 {
          margin: 0;
          font-size: 1.3rem;
          font-weight: 800;
          color: var(--text);
          letter-spacing: -0.01em;
          flex: 1;
        }
        .goalBadge {
          border-radius: 999px;
          padding: 3px 10px;
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .goalBadge.bulk {
          background: color-mix(in oklab, var(--primary) 20%, transparent);
          color: color-mix(in oklab, var(--primary) 70%, var(--text));
        }
        .goalBadge.cut {
          background: color-mix(in oklab, #ef4444 15%, transparent);
          color: #b91c1c;
        }
        .goalBadge.maintain {
          background: color-mix(in oklab, #10b981 15%, transparent);
          color: #065f46;
        }
        .tags {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .tags span {
          background: color-mix(in oklab, var(--primary) 10%, transparent);
          border: 1px solid color-mix(in oklab, var(--primary) 28%, var(--border));
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 0.75rem;
          font-weight: 600;
          color: color-mix(in oklab, var(--primary) 45%, var(--text));
        }
        .prose {
          color: var(--text);
          line-height: 1.65;
          font-size: 0.95rem;
        }
        .prose :global(p) {
          margin: 0 0 8px;
        }
        .prose :global(p:last-child) {
          margin-bottom: 0;
        }
        .muted {
          color: var(--muted);
          margin: 0;
          font-size: 0.9rem;
        }
        .ytSection {
          border-top: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          padding-top: 14px;
          display: grid;
          gap: 10px;
        }
        .ytLabel {
          margin: 0;
          font-size: 0.7rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 700;
        }
        .ytEmbed {
          position: relative;
          width: 100%;
          padding-bottom: 56.25%;
          border-radius: 14px;
          overflow: hidden;
        }
        .ytEmbed iframe {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border: 0;
        }
        .ytSearch {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 13px 20px;
          border-radius: 14px;
          border: 0;
          background: #ff0000;
          color: #fff;
          text-decoration: none;
          font-weight: 700;
          font-size: 0.95rem;
          box-shadow: 0 8px 24px rgba(255, 0, 0, 0.28);
          transition: filter 0.15s ease, box-shadow 0.15s ease;
          width: 100%;
        }
        .ytSearch:hover {
          filter: brightness(1.1);
          box-shadow: 0 12px 32px rgba(255, 0, 0, 0.36);
        }
        .ytIcon {
          width: 26px;
          height: 26px;
          flex-shrink: 0;
        }
        .ytQuery {
          font-size: 0.82rem;
          font-weight: 400;
          opacity: 0.85;
        }
        @media (max-width: 560px) {
          .sheet {
            border-radius: 20px;
          }
          .media {
            border-radius: 20px 20px 0 0;
          }
          .body {
            padding: 16px 18px 20px;
          }
          h3 {
            font-size: 1.1rem;
          }
        }
      `}</style>
    </div>
  );
}
