import React, { useEffect, useRef } from "react";

interface ConfirmDialogProps {
  message: string;
  title?: string;
  kind?: "info" | "warning" | "danger";
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  message,
  title,
  kind = "warning",
  confirmText = "确认",
  cancelText = "取消",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const accent = kind === "danger" ? "#ef4444" : kind === "info" ? "#60a5fa" : "#f59e0b";

  return (
    <div
      style={overlayStyle}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div style={dialogStyle}>
        {title ? <h3 style={{ ...titleStyle, color: accent }}>{title}</h3> : null}
        <div style={messageStyle}>{message}</div>
        <div style={actionsStyle}>
          <button style={secondaryBtnStyle} onClick={onCancel}>
            {cancelText}
          </button>
          <button ref={confirmRef} style={primaryBtnStyle(kind)} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 12000 };
const dialogStyle: React.CSSProperties = { width: 360, maxWidth: "calc(100vw - 32px)", background: "#252525", border: "1px solid #333", borderRadius: 8, padding: 20 };
const titleStyle: React.CSSProperties = { margin: 0, fontSize: 14, fontWeight: 600 };
const messageStyle: React.CSSProperties = { marginTop: 10, color: "#d1d5db", fontSize: 13, lineHeight: 1.5 };
const actionsStyle: React.CSSProperties = { marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 8 };
const secondaryBtnStyle: React.CSSProperties = { padding: "6px 14px", borderRadius: 4, background: "#333", color: "#f3f4f6", border: "1px solid #444" };
const primaryBtnStyle = (kind: "info" | "warning" | "danger"): React.CSSProperties => ({
  padding: "6px 14px",
  borderRadius: 4,
  background: kind === "danger" ? "#dc2626" : "#2563eb",
  color: "#fff",
});

export default ConfirmDialog;
