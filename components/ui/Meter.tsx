
"use client";

type Props = {
  status: "good" | "caution" | "notRecommended";
  label: string;
  message?: string;
};

export default function Meter({ status, label, message }: Props) {
  const colors = {
    good:   { bar: "#22c55e", bg: "#dcfce7", text: "#14532d" },
    caution:{ bar: "#f59e0b", bg: "#fef3c7", text: "#7c2d12" },
    notRecommended: { bar: "#ef4444", bg: "#fee2e2", text: "#7f1d1d" },
  }[status];

  const pct = status === "good" ? 100 : status === "caution" ? 55 : 20;

  return (
    <div className="card">
      <div className="top">
        <span className="lbl">{label}</span>
        <span className="tag">{status === "good" ? "Good" : status === "caution" ? "Caution" : "Not recommended"}</span>
      </div>
      <div className="bar" aria-hidden="true">
        <div className="fill" style={{ width: `${pct}%`, background: colors.bar }} />
      </div>
      {message ? <p className="msg">{message}</p> : null}

      <style jsx>{`
        .card{border:1px solid #e5e7eb;background:${colors.bg};border-radius:14px;padding:12px}
        .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
        .lbl{font-weight:700;color:#0f172a}
        .tag{font-size:12px;border:1px solid #e5e7eb;background:#fff;border-radius:999px;padding:2px 8px;color:${colors.text}}
        .bar{height:10px;background:#f1f5f9;border-radius:999px;overflow:hidden}
        .fill{height:100%}
        .msg{margin:8px 0 0;color:${colors.text};font-size:13px}
      `}</style>
    </div>
  );
}
