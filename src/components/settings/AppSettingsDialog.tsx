import React, { useState, useEffect, useRef } from "react";
import { getVersion } from "@tauri-apps/api/app";
import type { AppSettings } from "../../types/layout";
import type { ShellInfo } from "../../types/terminal";
import { shellListAvailable } from "../../ipc/terminalApi";
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  DEFAULT_LINE_HEIGHT,
} from "../../terminal/terminalInstances";

interface AppSettingsDialogProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onCancel: () => void;
}

/** 预设等宽字体，label 仅作展示，value 为实际 font-family 字符串 */
const FONT_PRESETS: { label: string; value: string }[] = [
  { label: "默认 (JetBrains Mono Nerd Font)", value: "" },
  {
    label: "JetBrains Mono",
    value: '"JetBrains Mono", Consolas, monospace',
  },
  {
    label: "Cascadia Code",
    value: '"Cascadia Code", Consolas, monospace',
  },
  {
    label: "Cascadia Mono",
    value: '"Cascadia Mono", Consolas, monospace',
  },
  {
    label: "Fira Code",
    value: '"Fira Code", Consolas, monospace',
  },
  {
    label: "Source Code Pro",
    value: '"Source Code Pro", Consolas, monospace',
  },
  {
    label: "Hack",
    value: '"Hack", Consolas, monospace',
  },
  {
    label: "Consolas",
    value: "Consolas, monospace",
  },
  {
    label: "Courier New",
    value: '"Courier New", monospace',
  },
  {
    label: "Menlo",
    value: "Menlo, Consolas, monospace",
  },
  {
    label: "Monaco",
    value: "Monaco, Consolas, monospace",
  },
];

const CUSTOM_FONT_VALUE = "__custom__";

export const AppSettingsDialog: React.FC<AppSettingsDialogProps> = ({
  settings,
  onSave,
  onCancel,
}) => {
  const [shells, setShells] = useState<ShellInfo[]>([]);
  const [version, setVersion] = useState("");
  const [defaultShell, setDefaultShell] = useState(settings.defaultShell);
  const [defaultWorkingDirectory, setDefaultWorkingDirectory] = useState(
    settings.defaultWorkingDirectory
  );
  const [fontFamily, setFontFamily] = useState(settings.fontFamily ?? "");
  const [fontSelectValue, setFontSelectValue] = useState(() => {
    const saved = settings.fontFamily ?? "";
    if (FONT_PRESETS.some((p) => p.value === saved)) return saved;
    return CUSTOM_FONT_VALUE;
  });
  const [fontSize, setFontSize] = useState(
    settings.fontSize != null ? String(settings.fontSize) : ""
  );
  const [lineHeight, setLineHeight] = useState(
    settings.lineHeight != null ? String(settings.lineHeight) : ""
  );
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
  }, []);

  useEffect(() => {
    shellListAvailable()
      .then((list) => {
        setShells(list);
        // 如果当前设置的 shell 不在列表中，选中第一个默认 shell
        if (defaultShell === "" || !list.some((s) => s.type === defaultShell)) {
          const defaultOne = list.find((s) => s.isDefault);
          if (defaultOne) setDefaultShell(defaultOne.type);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  useEffect(() => {
    selectRef.current?.focus();
  }, [shells]);

  const handleSave = () => {
    const selectedShell = shells.find((s) => s.type === defaultShell);
    const parsedFontSize = parseFloat(fontSize);
    const parsedLineHeight = parseFloat(lineHeight);
    onSave({
      ...settings,
      defaultShell,
      defaultShellPath: selectedShell?.path ?? "",
      defaultWorkingDirectory,
      fontFamily: fontFamily.trim() || undefined,
      fontSize:
        Number.isFinite(parsedFontSize) && parsedFontSize > 0
          ? parsedFontSize
          : undefined,
      lineHeight:
        Number.isFinite(parsedLineHeight) && parsedLineHeight > 0
          ? parsedLineHeight
          : undefined,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
  };

  return (
    <div
      style={overlayStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div style={dialogStyle} onKeyDown={handleKeyDown}>
        <h3 style={titleStyle}>设置</h3>

        <label style={labelStyle}>默认 Shell</label>
        <select
          ref={selectRef}
          value={defaultShell}
          onChange={(e) => setDefaultShell(e.target.value)}
          style={selectStyle}
        >
          {shells.map((s) => (
            <option key={s.path} value={s.type}>
              {s.displayName}
              {s.isDefault ? " (系统默认)" : ""}
            </option>
          ))}
        </select>

        <label style={labelStyle}>默认工作目录</label>
        <input
          type="text"
          value={defaultWorkingDirectory}
          onChange={(e) => setDefaultWorkingDirectory(e.target.value)}
          placeholder="留空使用用户主目录"
          style={inputStyle}
        />

        <label style={labelStyle}>字体</label>
        <select
          value={fontSelectValue}
          onChange={(e) => {
            const v = e.target.value;
            setFontSelectValue(v);
            if (v !== CUSTOM_FONT_VALUE) setFontFamily(v);
          }}
          style={selectStyle}
        >
          {FONT_PRESETS.map((p) => (
            <option key={p.label} value={p.value}>
              {p.label}
            </option>
          ))}
          <option value={CUSTOM_FONT_VALUE}>自定义…</option>
        </select>
        {fontSelectValue === CUSTOM_FONT_VALUE && (
          <input
            type="text"
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            placeholder={`例如: ${DEFAULT_FONT_FAMILY.split(",")[0]}`}
            style={inputStyle}
          />
        )}

        <div style={rowStyle}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>字号</label>
            <input
              type="number"
              min={6}
              max={72}
              step={1}
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value)}
              placeholder={String(DEFAULT_FONT_SIZE)}
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>行高</label>
            <input
              type="number"
              min={0.8}
              max={3}
              step={0.1}
              value={lineHeight}
              onChange={(e) => setLineHeight(e.target.value)}
              placeholder={String(DEFAULT_LINE_HEIGHT)}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={hintStyle}>字体设置仅对新建终端生效</div>

        {version && (
          <div style={versionInfoStyle}>sTerminal v{version}</div>
        )}

        <div style={actionsStyle}>
          <button onClick={onCancel} style={btnStyle}>
            取消
          </button>
          <button onClick={handleSave} style={primaryBtnStyle}>
            保存
          </button>
        </div>
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
  padding: "20px 24px",
  minWidth: 340,
  maxWidth: 420,
};

const titleStyle: React.CSSProperties = {
  marginBottom: 16,
  fontSize: 14,
  color: "#e0e0e0",
  fontWeight: 600,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "#999",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  marginBottom: 12,
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  marginBottom: 12,
  padding: "6px 8px",
  background: "#1a1a1a",
  color: "#e0e0e0",
  border: "1px solid #444",
  borderRadius: 4,
  fontSize: 13,
  outline: "none",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
};

const hintStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#777",
  marginBottom: 12,
};

const versionInfoStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#666",
  textAlign: "center",
  marginBottom: 16,
  paddingTop: 8,
  borderTop: "1px solid #333",
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
};

const btnStyle: React.CSSProperties = {};

const primaryBtnStyle: React.CSSProperties = {
  background: "#3b82f6",
  color: "#fff",
};

export default AppSettingsDialog;
