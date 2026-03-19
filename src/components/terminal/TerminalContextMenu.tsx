import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAppSettingsStore } from "../../store/appSettingsStore";

interface ContextMenuPosition {
  x: number;
  y: number;
}

interface TerminalContextMenuProps {
  position: ContextMenuPosition;
  isLastPanel: boolean;
  onCopy: () => void;
  onPaste: () => void;
  onSplitHorizontal: () => void;
  onSplitVertical: () => void;
  onDuplicate: () => void;
  onSettings: () => void;
  onClose: () => void;
  onDismiss: () => void;
  onConfirm?: (message: string) => Promise<boolean>;
  onPasteCommand?: (command: string) => void;
}

export const TerminalContextMenu: React.FC<TerminalContextMenuProps> = ({
  position,
  isLastPanel,
  onCopy,
  onPaste,
  onSplitHorizontal,
  onSplitVertical,
  onDuplicate,
  onSettings,
  onClose,
  onDismiss,
  onConfirm,
  onPasteCommand,
}) => {
  const commandGroups = useAppSettingsStore((s) => s.settings.commandGroups ?? []);
  const enableRightClickCommandPaste = useAppSettingsStore(
    (s) => s.settings.enableRightClickCommandPaste
  );
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
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

  // 按 Escape 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onDismiss]);

  const handleAction = (action: () => void) => {
    action();
    onDismiss();
  };

  const [adjusted, setAdjusted] = useState<ContextMenuPosition | null>(null);

  useLayoutEffect(() => {
    const element = menuRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const x = position.x + rect.width > viewportWidth ? viewportWidth - rect.width - 4 : position.x;
    const y = position.y + rect.height > viewportHeight ? viewportHeight - rect.height - 4 : position.y;
    if (x !== position.x || y !== position.y) {
      setAdjusted({ x: Math.max(0, x), y: Math.max(0, y) });
    }
  }, [position]);

  // 确保菜单不超出视口
  const style: React.CSSProperties = {
    left: (adjusted ?? position).x,
    top: (adjusted ?? position).y,
  };

  return (
    <div
      ref={menuRef}
      className="terminal-context-menu"
      style={style}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button
        className="terminal-context-menu__item"
        onClick={() => handleAction(onCopy)}
      >
        <span>复制</span>
        <span className="terminal-context-menu__shortcut">Ctrl+Shift+C</span>
      </button>
      <button
        className="terminal-context-menu__item"
        onClick={() => handleAction(onPaste)}
      >
        <span>粘贴</span>
        <span className="terminal-context-menu__shortcut">Ctrl+Shift+V</span>
      </button>
      <div className="terminal-context-menu__separator" />
      <button
        className="terminal-context-menu__item"
        onClick={() => handleAction(onSplitHorizontal)}
      >
        ⬌ 水平分割
      </button>
      <button
        className="terminal-context-menu__item"
        onClick={() => handleAction(onSplitVertical)}
      >
        ⬍ 垂直分割
      </button>
      <button
        className="terminal-context-menu__item"
        onClick={() => handleAction(onDuplicate)}
      >
        ⎘ 复制此面板
      </button>
      <div className="terminal-context-menu__separator" />
      <button
        className="terminal-context-menu__item"
        onClick={() => handleAction(onSettings)}
      >
        ⚙ 当前控制台设置
      </button>
      {enableRightClickCommandPaste && onPasteCommand ? (
        <>
          <div className="terminal-context-menu__separator" />
          {commandGroups.length === 0 ? (
            <div className="terminal-context-menu__item terminal-context-menu__item--disabled">
              暂无常用命令
            </div>
          ) : (
            commandGroups.map((group) => (
              <React.Fragment key={group.id}>
                {group.commands.length > 0 ? (
                  <>
                    <div className="terminal-context-menu__group-label">{group.name}</div>
                    {group.commands.map((command) => (
                      <button
                        key={command.id}
                        className="terminal-context-menu__item"
                        onClick={() => handleAction(() => onPasteCommand(command.command))}
                        title={command.command}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          ⌘ {command.name}
                        </span>
                      </button>
                    ))}
                  </>
                ) : null}
              </React.Fragment>
            ))
          )}
        </>
      ) : null}
      <div className="terminal-context-menu__separator" />
      <button
        className="terminal-context-menu__item terminal-context-menu__item--danger"
        onClick={async () => {
          if (isLastPanel && onConfirm) {
            const ok = await onConfirm("这是最后一个面板，确认关闭将退出应用，继续？");
            if (!ok) {
              onDismiss();
              return;
            }
          }
          handleAction(onClose);
        }}
      >
        ✕ 关闭面板
      </button>
    </div>
  );
};

export default TerminalContextMenu;
