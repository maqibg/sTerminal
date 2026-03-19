import React, { useEffect, useRef } from "react";

interface ConfirmDialogProps {
  message: string;
  title?: string;
  confirmText?: string;
  cancelText?: string;
  kind?: "info" | "warning" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  message,
  title,
  confirmText = "确认",
  cancelText = "取消",
  kind = "warning",
  onConfirm,
  onCancel,
}) => {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  const accentColor =
    kind === "danger" ? "#f87171" : kind === "warning" ? "#facc15" : "#60a5fa";

  return (
    <div
      style={overlayStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div style={dialogStyle}>
        {title && <h3 style={{ ...titleStyle, color: accentColor }}>{title}</h3>}
        <p style={messageStyle}>{message}</p>
        <div style={actionsStyle}>
          <button onClick={onCancel} style={btnStyle}>
            {cancelText}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            style={{
              ...btnStyle,
              background: kind === "danger" ? "#dc2626" : "#3b82f6",
              color: "#fff",
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 20000,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const dialogStyle: React.CSSProperties = {
  background: "#252525",
  border: "1px solid #333",
  borderRadius: 8,
  padding: "20px 24px",
  minWidth: 300,
  maxWidth: 400,
};

const titleStyle: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: 14,
  fontWeight: 600,
};

const messageStyle: React.CSSProperties = {
  margin: "0 0 20px",
  fontSize: 13,
  color: "#ccc",
  lineHeight: 1.5,
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
};

const btnStyle: React.CSSProperties = {
  padding: "6px 16px",
  fontSize: 12,
  borderRadius: 4,
  cursor: "pointer",
  background: "#333",
  color: "#e0e0e0",
  border: "1px solid #444",
};
