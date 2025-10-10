"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function BookWritingLoader({ variant = "flip" }: { variant?: "flip" | "pen" }) {
  const [mounted, setMounted] = useState(false);

  
  useEffect(() => {
    setMounted(true);
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = prevOverflow; };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      id="route-loader"
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading editor"
      className="screen"
    >
      {variant === "flip" ? (
        <div className="book2" aria-hidden="true">
          <div className="book2__pg-shadow" />
          <div className="book2__pg" />
          <div className="book2__pg book2__pg--2" />
          <div className="book2__pg book2__pg--3" />
          <div className="book2__pg book2__pg--4" />
          <div className="book2__pg book2__pg--5" />
        </div>
      ) : (
        <div className="wrap" aria-hidden="true">
          <div className="book"><div className="page" /><div className="pen" /></div>
          <p className="msg">Preparing…</p>
        </div>
      )}
      <p className="caption">Opening your recipe…</p>

      <style jsx>{`
        /* Full-screen overlay above any header/sidebar */
        .screen{
          position: fixed;
          inset: 0;
          /* use the max practical z-index to beat any site chrome */
          z-index: 2147483647;
          background: #0b1220;
          color: #e9eef8;
          display: grid;
          place-items: center;
          padding: 24px;
          text-align: center;
          pointer-events: all;
        }
        @media (prefers-color-scheme: light){
          .screen{ background:#f6f7fb; color:#111827 }
        }
        .caption{ margin-top:14px; opacity:.9; font-size:14px }

        /* Book flip loader (Uiverse-inspired) */
        .book2,.book2__pg-shadow,.book2__pg{animation:cover 5s ease-in-out infinite}
        .book2{background:hsl(268,90%,65%);border-radius:.25em;box-shadow:0 .25em .5em hsla(0,0%,0%,.3),0 0 0 .25em hsl(278,100%,57%) inset;
               padding:.25em;perspective:37.5em;position:relative;width:8em;height:6em;transform-style:preserve-3d}
        .book2__pg-shadow,.book2__pg{position:absolute;left:.25em;width:calc(50% - .25em)}
        .book2__pg-shadow{animation-name:shadow;background-image:linear-gradient(-45deg,hsla(0,0%,0%,0) 50%,hsla(0,0%,0%,.3) 50%);
                          filter:blur(.25em);top:calc(100% - .25em);height:3.75em;transform:scaleY(0);transform-origin:100% 0%}
        .book2__pg{animation-name:pg1;background:#fff;background-image:linear-gradient(90deg,hsla(223,10%,90%,0) 87.5%,hsl(223,10%,90%));
                   height:calc(100% - .5em);transform-origin:100% 50%}
        .book2__pg--2,.book2__pg--3,.book2__pg--4{
          background-image:
            repeating-linear-gradient(hsl(223,10%,10%) 0 .125em,hsla(223,10%,10%,0) .125em .5em),
            linear-gradient(90deg,hsla(223,10%,90%,0) 87.5%,hsl(223,10%,90%));
          background-repeat:no-repeat;background-position:center;background-size:2.5em 4.125em,100% 100%;
        }
        .book2__pg--2{animation-name:pg2}
        .book2__pg--3{animation-name:pg3}
        .book2__pg--4{animation-name:pg4}
        .book2__pg--5{animation-name:pg5}
        @keyframes cover{from,5%,45%,55%,95%,to{animation-timing-function:ease-out;background:hsl(278,84%,67%)}
                         10%,40%,60%,90%{animation-timing-function:ease-in;background:hsl(271,90%,45%)}}
        @keyframes shadow{from,10.01%,20.01%,30.01%,40.01%{animation-timing-function:ease-in;transform:scaleY(0) rotateY(0)}
                          5%,15%,25%,35%,45%,55%,65%,75%,85%,95%{animation-timing-function:ease-out;transform:scaleY(.2) rotateY(90deg)}
                          10%,20%,30%,40%,50%,to{animation-timing-function:ease-out;transform:scaleY(0) rotateY(180deg)}
                          50.01%,60.01%,70.01%,80.01%,90.01%{animation-timing-function:ease-in;transform:scaleY(0) rotateY(180deg)}
                          60%,70%,80%,90%,to{animation-timing-function:ease-out;transform:scaleY(0) rotateY(0)}}
        @keyframes pg1{from,to{animation-timing-function:ease-in-out;transform:rotateY(.4deg)}
                       10%,15%{animation-timing-function:ease-out;transform:rotateY(180deg)}
                       20%,80%{animation-timing-function:ease-in;transform:rotateY(180deg)}
                       85%,90%{animation-timing-function:ease-in-out;transform:rotateY(180deg)}}
        @keyframes pg2{from,to{animation-timing-function:ease-in;transform:rotateY(.3deg)}
                       20%,25%{animation-timing-function:ease-out;transform:rotateY(179.9deg)}
                       30%,70%{animation-timing-function:ease-in;transform:rotateY(179.9deg)}
                       90%,95%{animation-timing-function:ease-out;transform:rotateY(.3deg)}}
        @keyframes pg3{from,10%,90%,to{animation-timing-function:ease-in;transform:rotateY(.2deg)}
                       30%,35%{animation-timing-function:ease-out;transform:rotateY(179.8deg)}
                       40%,60%{animation-timing-function:ease-in;transform:rotateY(179.8deg)}
                       80%,85%{animation-timing-function:ease-out;transform:rotateY(.2deg)}}

        /* optional tiny pen variant */
        .wrap{display:grid;gap:10px;place-items:center}
        .book{position:relative;width:120px;height:90px;border-radius:14px;background:#fff;box-shadow:0 10px 40px rgba(0,0,0,.12)}
        .page{position:absolute;inset:10px;background:linear-gradient(90deg,#fafafa,#f1f1f1);border-radius:10px;overflow:hidden;animation:turn 1.2s infinite ease-in-out}
        .pen{position:absolute;right:-14px;bottom:-8px;width:70px;height:8px;background:#111;border-radius:6px;transform-origin:left center;animation:write 1.2s infinite ease-in-out;box-shadow:0 6px 18px rgba(0,0,0,.25)}
        .msg{font-size:13px;opacity:.85}
        @keyframes turn{0%,100%{clip-path:polygon(0 0,100% 0,100% 100%,0 100%)}50%{clip-path:polygon(0 0,60% 0,60% 100%,0 100%)}}
        @keyframes write{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(6deg)}}
      `}</style>
    </div>,
    document.body
  );
}
