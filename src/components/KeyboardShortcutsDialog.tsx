import React, { useEffect } from "react";

const SHORTCUT_GROUPS = [
  {
    label: "面板操作",
    items: [
      { keys: "Ctrl + Shift + H", desc: "水平分割当前面板" },
      { keys: "Ctrl + Shift + V", desc: "垂直分割当前面板" },
      { keys: "Ctrl + Shift + D", desc: "复制当前面板" },
      { keys: "Ctrl + Shift + W", desc: "关闭当前面板" },
      { keys: "Ctrl + Tab", desc: "聚焦下一面板" },
      { keys: "Ctrl + Shift + Tab", desc: "聚焦上一面板" },
    ],
  },
  {
    label: "布局与设置",
    items: [
      { keys: "Ctrl + Shift + S", desc: "保存当前布局" },
      { keys: "Ctrl + Shift + L", desc: "打开布局管理" },
      { keys: "Ctrl + Shift + P", desc: "打开常用命令" },
      { keys: "Ctrl + ,", desc: "打开设置" },
    ],
  },
];

interface KeyboardShortcutsDialogProps {
  onClose: () => void;
}

export const KeyboardShortcutsDialog: React.FC<KeyboardShortcutsDialogProps> = ({
  onClose,
}) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={dialogStyle}>
        <div style={headerStyle}>
          <h3 style={titleStyle}>快捷键</h3>
          <button style={closeBtnStyle} onClick={onClose} title="关闭">✕</button>
        </div>

        {SHORTCUT_GROUPS.map((group) => (
          <div key={group.label} style={groupStyle}>
            <div style={groupLabelStyle}>{group.label}</div>
            {group.items.map((item) => (
              <div key={item.keys} style={rowStyle}>
                <span style={descStyle}>{item.desc}</span>
                <kbd style={kbdStyle}>{item.keys}</kbd>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 10000,
  background: "rgba(0,0,0,0.7)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const dialogStyle: React.CSSProperties = {
  background: "#252525",
  border: "1px solid #333",
  borderRadius: 8,
  padding: "20px 24px 16px",
  minWidth: 380,
  maxWidth: 460,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 12,
};

const titleStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#e0e0e0",
  fontWeight: 600,
  margin: 0,
};

const closeBtnStyle: React.CSSProperties = {
  background: "transparent",
  color: "#666",
  fontSize: 14,
  cursor: "pointer",
  padding: "2px 6px",
  borderRadius: 4,
};

const groupStyle: React.CSSProperties = {
  marginBottom: 12,
};

const groupLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#666",
  fontWeight: 600,
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "5px 0",
};

const descStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#ccc",
};

const kbdStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#aaa",
  background: "#1a1a1a",
  border: "1px solid #444",
  borderRadius: 4,
  padding: "2px 8px",
  fontFamily: "var(--font-mono, monospace)",
  whiteSpace: "nowrap",
};
