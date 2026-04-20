
"use client";

type Props = {
  open: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  zIndex?: number;
};

export default function ConfirmDialog({
  open,
  title = "Are you sure?",
  message = "This action cannot be undone.",
  confirmText = "Delete",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  zIndex = 2200,
}: Props) {
  if (!open) return null;

  return (
    <div className="ov" style={{ zIndex }} role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="box" onClick={(e) => e.stopPropagation()}>
        <h3 className="t">{title}</h3>
        <p className="m">{message}</p>
        <div className="row">
          <button className="cancel" onClick={onCancel}>{cancelText}</button>
          <button className="danger" onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>

      <style jsx>{`
        .ov{position:fixed;inset:0;background:rgba(2,6,23,.6);display:grid;place-items:center;padding:16px}
        .box{width:100%;max-width:420px;background:var(--card-bg);border:1px solid var(--card-border);border-radius:var(--radius);padding:20px;box-shadow:var(--shadow)}
        .t{margin:0 0 8px;font-size:18px;font-weight:800;color:var(--text)}
        .m{margin:0 0 16px;color:var(--muted);font-size:14px}
        .row{display:flex;gap:10px;justify-content:flex-end}
        .cancel{border:1px solid var(--border);background:transparent;color:var(--text);border-radius:var(--radius-sm);padding:8px 14px;cursor:pointer;font-size:14px}
        .cancel:hover{background:var(--border)}
        .danger{border:1px solid #ef444440;background:#ef444420;color:#ef4444;border-radius:var(--radius-sm);padding:8px 14px;cursor:pointer;font-size:14px;font-weight:600}
        .danger:hover{background:#ef444430}
      `}</style>
    </div>
  );
}
