
"use client";

import Link from "next/link";

type Post = {
  id: string;
  uid: string;
  text?: string | null;
  imageURL?: string | null;
  createdAt?: { seconds: number; nanoseconds: number } | null;
};

export default function PostCard({ post }: { post: Post }) {
  const ts = post.createdAt?.seconds ? new Date(post.createdAt.seconds * 1000) : null;

  return (
    <Link href={`/posts/${post.id}`} className="cardLink" aria-label="Open post">
      <article className="postCard">
        {post.imageURL ? <img className="img" src={post.imageURL} alt="" /> : null}
        {post.text ? <p className="text">{post.text}</p> : null}
        <div className="meta">
          <span className="muted">{ts ? ts.toLocaleString() : ""}</span>
          <span className="chev">View →</span>
        </div>
      </article>

      <style jsx>{`
        .cardLink { text-decoration: none; color: inherit; display:block; }

        .postCard {
          border: 1px solid var(--border);
          background: var(--card-bg);
          border-radius: 12px;
          padding: 12px;
          display: grid;
          gap: 8px;
          transition: transform .08s ease, box-shadow .12s ease, background .12s ease, border-color .12s ease;
        }
        .postCard:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 24px rgba(0,0,0,.12);
        }

        .img {
          width: 100%;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--bg2);
          object-fit: cover;
          display:block;
        }

        .text {
          font-size: 15px;
          color: var(--text);
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          word-break: break-word;
          margin: 0;
        }

        .meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .muted { color: var(--muted); font-size: 12px; }
        .chev { color: var(--primary); font-weight: 600; font-size: 12px; }
      `}</style>
    </Link>
  );
}
