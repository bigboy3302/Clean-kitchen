 "use client";

type Props = {
  message?: string;
  caption?: string;
};

export default function RouteLoader({
  message = "Loading",
  caption = "Please wait",
}: Props) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={message}
      className="routeLoader"
    >
      <div className="book" aria-hidden="true">
        <div className="book__shadow" />
        <div className="book__page" />
        <div className="book__page book__page--2" />
        <div className="book__page book__page--3" />
        <div className="book__page book__page--4" />
        <div className="book__page book__page--5" />
      </div>
      <p className="caption">{caption}</p>

      <style jsx>{`
        .routeLoader {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          background: #0b1220;
          color: #e9eef8;
          display: grid;
          place-items: center;
          padding: 24px;
          text-align: center;
        }
        @media (prefers-color-scheme: light) {
          .routeLoader {
            background: #f6f7fb;
            color: #111827;
          }
        }
        .caption {
          margin-top: 14px;
          opacity: 0.9;
          font-size: 14px;
        }
        .book,
        .book__shadow,
        .book__page {
          animation: cover 5s ease-in-out infinite;
        }
        .book {
          background: hsl(268 90% 65%);
          border-radius: 0.25em;
          box-shadow: 0 0.25em 0.5em rgba(0, 0, 0, 0.3),
            0 0 0 0.25em hsl(278 100% 57%) inset;
          padding: 0.25em;
          perspective: 37.5em;
          position: relative;
          width: 8em;
          height: 6em;
          transform-style: preserve-3d;
        }
        .book__shadow,
        .book__page {
          position: absolute;
          left: 0.25em;
          width: calc(50% - 0.25em);
        }
        .book__shadow {
          animation-name: shadow;
          background-image: linear-gradient(
            -45deg,
            rgba(0, 0, 0, 0) 50%,
            rgba(0, 0, 0, 0.3) 50%
          );
          filter: blur(0.25em);
          top: calc(100% - 0.25em);
          height: 3.75em;
          transform: scaleY(0);
          transform-origin: 100% 0;
        }
        .book__page {
          animation-name: page1;
          background: #fff;
          background-image: linear-gradient(
            90deg,
            rgba(223, 229, 248, 0) 87.5%,
            hsl(223 10% 90%)
          );
          height: calc(100% - 0.5em);
          transform-origin: 100% 50%;
        }
        .book__page--2,
        .book__page--3,
        .book__page--4 {
          background-image:
            repeating-linear-gradient(
              hsl(223 10% 10%) 0 0.125em,
              rgba(29, 35, 44, 0) 0.125em 0.5em
            ),
            linear-gradient(
              90deg,
              rgba(223, 229, 248, 0) 87.5%,
              hsl(223 10% 90%)
            );
          background-repeat: no-repeat;
          background-position: center;
          background-size: 2.5em 4.125em, 100% 100%;
        }
        .book__page--2 {
          animation-name: page2;
        }
        .book__page--3 {
          animation-name: page3;
        }
        .book__page--4 {
          animation-name: page4;
        }
        .book__page--5 {
          animation-name: page5;
        }
        @keyframes cover {
          from,
          5%,
          45%,
          55%,
          95%,
          to {
            animation-timing-function: ease-out;
            background: hsl(278 84% 67%);
          }
          10%,
          40%,
          60%,
          90% {
            animation-timing-function: ease-in;
            background: hsl(271 90% 45%);
          }
        }
        @keyframes shadow {
          from,
          10.01%,
          20.01%,
          30.01%,
          40.01% {
            animation-timing-function: ease-in;
            transform: scaleY(0) rotateY(0deg);
          }
          5%,
          15%,
          25%,
          35%,
          45%,
          55%,
          65%,
          75%,
          85%,
          95% {
            animation-timing-function: ease-out;
            transform: scaleY(0.2) rotateY(90deg);
          }
          10%,
          20%,
          30%,
          40%,
          50%,
          to {
            animation-timing-function: ease-out;
            transform: scaleY(0) rotateY(180deg);
          }
          50.01%,
          60.01%,
          70.01%,
          80.01%,
          90.01% {
            animation-timing-function: ease-in;
            transform: scaleY(0) rotateY(180deg);
          }
          60%,
          70%,
          80%,
          90%,
          to {
            animation-timing-function: ease-out;
            transform: scaleY(0) rotateY(0deg);
          }
        }
        @keyframes page1 {
          from,
          to {
            animation-timing-function: ease-in-out;
            transform: rotateY(0.4deg);
          }
          10%,
          15% {
            animation-timing-function: ease-out;
            transform: rotateY(180deg);
          }
          20%,
          80% {
            animation-timing-function: ease-in;
            transform: rotateY(180deg);
          }
          85%,
          90% {
            animation-timing-function: ease-in-out;
            transform: rotateY(180deg);
          }
        }
        @keyframes page2 {
          from,
          to {
            animation-timing-function: ease-in;
            transform: rotateY(0.3deg);
          }
          20%,
          25% {
            animation-timing-function: ease-out;
            transform: rotateY(179.9deg);
          }
          30%,
          70% {
            animation-timing-function: ease-in;
            transform: rotateY(179.9deg);
          }
          90%,
          95% {
            animation-timing-function: ease-out;
            transform: rotateY(0.3deg);
          }
        }
        @keyframes page3 {
          from,
          10%,
          90%,
          to {
            animation-timing-function: ease-in;
            transform: rotateY(0.2deg);
          }
          30%,
          35% {
            animation-timing-function: ease-out;
            transform: rotateY(179.8deg);
          }
          40%,
          60% {
            animation-timing-function: ease-in;
            transform: rotateY(179.8deg);
          }
          80%,
          85% {
            animation-timing-function: ease-out;
            transform: rotateY(0.2deg);
          }
        }
        @keyframes page4 {
          from,
          20%,
          80%,
          to {
            animation-timing-function: ease-in;
            transform: rotateY(0.1deg);
          }
          40%,
          45% {
            animation-timing-function: ease-out;
            transform: rotateY(179.7deg);
          }
          70%,
          75% {
            animation-timing-function: ease-out;
            transform: rotateY(0.1deg);
          }
        }
        @keyframes page5 {
          from,
          30%,
          70%,
          to {
            animation-timing-function: ease-in;
            transform: rotateY(0deg);
          }
          50% {
            animation-timing-function: ease-in-out;
            transform: rotateY(179.6deg);
          }
          60%,
          65% {
            animation-timing-function: ease-out;
            transform: rotateY(0deg);
          }
        }
      `}</style>
    </div>
  );
}
