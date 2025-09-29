
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
        .ov{position:fixed;inset:0;background:rgba(2,6,23,.55);display:grid;place-items:center;padding:16px}
        .box{width:100%;max-width:420px;background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:16px}
        .t{margin:0 0 8px;font-size:18px;font-weight:800;color:#0f172a}
        .m{margin:0 0 14px;color:#475569}
        .row{display:flex;gap:10px;justify-content:flex-end}
        .cancel{border:1px solid #e5e7eb;background:#fff;border-radius:10px;padding:8px 12px;cursor:pointer}
        .danger{border:1px solid #fecaca;background:#fee2e2;color:#991b1b;border-radius:10px;padding:8px 12px;cursor:pointer}
      `}</style>
    </div>
  );
}
