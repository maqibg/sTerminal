import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

interface TabContextMenuProps {
  position: { x: number; y: number };
  onDuplicate: () => void;
  onClose: () => void;
  onOpenInNewWindow: () => void;
  onDismiss: () => void;
}

export const TabContextMenu: React.FC<TabContextMenuProps> = ({
  position,
  onDuplicate,
  onClose,
  onOpenInNewWindow,
  onDismiss,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjusted, setAdjusted] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [onDismiss]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onDismiss]);

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const x = position.x + rect.width > vw ? vw - rect.width - 4 : position.x;
    const y = position.y + rect.height > vh ? vh - rect.height - 4 : position.y;
    if (x !== position.x || y !== position.y) {
      setAdjusted({ x: Math.max(0, x), y: Math.max(0, y) });
    }
  }, [position]);

  const handleAction = (action: () => void) => {
    action();
    onDismiss();
  };

  const pos = adjusted ?? position;

  return (
    <div
      ref={menuRef}
      className="terminal-context-menu"
      style={{ left: pos.x, top: pos.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        className="terminal-context-menu__item"
        onClick={() => handleAction(onDuplicate)}
      >
        ⎘ 复制标签页
      </button>
      <button
        className="terminal-context-menu__item"
        onClick={() => handleAction(onOpenInNewWindow)}
      >
        ⧉ 新窗口打开
      </button>
      <div className="terminal-context-menu__separator" />
      <button
        className="terminal-context-menu__item terminal-context-menu__item--danger"
        onClick={() => handleAction(onClose)}
      >
        ✕ 关闭
      </button>
    </div>
  );
};

export default TabContextMenu;
