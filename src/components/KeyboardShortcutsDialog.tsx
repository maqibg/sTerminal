import React, { useEffect } from "react";

const GROUPS = [
  ["布局与窗口", [["Ctrl+Shift+S", "保存布局"], ["Ctrl+Shift+L", "布局管理"], ["Ctrl+Shift+P", "常用命令"], ["Ctrl+,", "全局设置"]]],
  ["面板操作", [["Ctrl+Shift+H", "水平分割"], ["Ctrl+Shift+V", "垂直分割"], ["Ctrl+Shift+D", "复制面板"], ["Ctrl+Shift+W", "关闭面板"], ["Ctrl+Tab", "下一个面板"], ["Ctrl+Shift+Tab", "上一个面板"]]],
] as const;

export function KeyboardShortcutsDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div style={overlayStyle} onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div style={dialogStyle}>
        <div style={headerStyle}>
          <div style={titleStyle}>快捷键</div>
          <button style={closeBtnStyle} onClick={onClose}>✕</button>
        </div>
        {GROUPS.map(([title, items]) => (
          <div key={title} style={groupStyle}>
            <div style={groupTitleStyle}>{title}</div>
            {items.map(([keys, desc]) => (
              <div key={keys} style={rowStyle}>
                <span>{desc}</span>
                <kbd style={kbdStyle}>{keys}</kbd>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 12000 };
const dialogStyle: React.CSSProperties = { width: 420, maxWidth: "calc(100vw - 32px)", background: "#252525", border: "1px solid #333", borderRadius: 8, padding: 20 };
const headerStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 };
const titleStyle: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: "#f3f4f6" };
const closeBtnStyle: React.CSSProperties = { background: "transparent", color: "#9ca3af", padding: "2px 6px" };
const groupStyle: React.CSSProperties = { marginTop: 14 };
const groupTitleStyle: React.CSSProperties = { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", color: "#9ca3af", marginBottom: 6 };
const rowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", color: "#d1d5db", fontSize: 13 };
const kbdStyle: React.CSSProperties = { padding: "2px 8px", borderRadius: 4, background: "#1a1a1a", border: "1px solid #444", color: "#d1d5db", fontSize: 11 };
