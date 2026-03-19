import React, { useEffect, useMemo, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import type { AppSettings } from "../../types/layout";
import type {
  CustomTerminalProfile,
  ShellInfo,
} from "../../types/terminal";
import {
  createEmptyCustomTerminal,
  DEFAULT_TERMINAL_FONT_FAMILY,
  getTerminalOptions,
  inferShellType,
} from "../../store/appSettingsStore";
import {
  terminalPickDirectory,
  terminalPickExecutable,
  terminalListFonts,
} from "../../ipc/terminalApi";

declare const __APP_VERSION__: string;

interface GlobalSettingsDialogProps {
  settings: AppSettings;
  systemShells: ShellInfo[];
  onDetectSystemShells: () => Promise<ShellInfo[]>;
  onCancel: () => void;
  onSave: (settings: AppSettings) => Promise<void>;
}

function systemTerminalId(shell: ShellInfo): string {
  return `system:${shell.type}:${shell.path.toLowerCase()}`;
}

export function GlobalSettingsDialog({
  settings,
  systemShells,
  onDetectSystemShells,
  onCancel,
  onSave,
}: GlobalSettingsDialogProps) {
  const [defaultTerminalId, setDefaultTerminalId] = useState(
    settings.defaultTerminalId
  );
  const [defaultWorkingDirectory, setDefaultWorkingDirectory] = useState(
    settings.defaultWorkingDirectory
  );
  const [terminalFontFamily, setTerminalFontFamily] = useState(
    settings.terminalFontFamily
  );
  const [availableFonts, setAvailableFonts] = useState<string[]>(
    settings.detectedTerminalFonts
  );
  const [fontQuery, setFontQuery] = useState("");
  const [fontDropdownOpen, setFontDropdownOpen] = useState(false);
  const [terminalFontSize, setTerminalFontSize] = useState(
    String(settings.terminalFontSize)
  );
  const [enableRightClickCommandPaste, setEnableRightClickCommandPaste] = useState(
    settings.enableRightClickCommandPaste
  );
  const [appVersion, setAppVersion] = useState(__APP_VERSION__);
  const [customTerminals, setCustomTerminals] = useState<CustomTerminalProfile[]>(
    settings.customTerminals
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectingFonts, setDetectingFonts] = useState(false);

  useEffect(() => {
    setDefaultTerminalId(settings.defaultTerminalId);
    setDefaultWorkingDirectory(settings.defaultWorkingDirectory);
    setTerminalFontFamily(settings.terminalFontFamily);
    setAvailableFonts(settings.detectedTerminalFonts);
    setFontQuery("");
    setFontDropdownOpen(false);
    setTerminalFontSize(String(settings.terminalFontSize));
    setEnableRightClickCommandPaste(settings.enableRightClickCommandPaste);
    setCustomTerminals(settings.customTerminals);
    setError("");
  }, [settings]);

  useEffect(() => {
    let active = true;
    getVersion()
      .then((version) => {
        if (active && version) {
          setAppVersion(version);
        }
      })
      .catch(() => {
        if (active) {
          setAppVersion(__APP_VERSION__);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const terminalOptions = useMemo(
    () => getTerminalOptions({ ...settings, customTerminals, defaultTerminalId, defaultWorkingDirectory }, systemShells),
    [settings, customTerminals, defaultTerminalId, defaultWorkingDirectory, systemShells]
  );

  const filteredFonts = useMemo(() => {
    const keyword = fontQuery.trim().toLowerCase();
    if (!keyword) return availableFonts;
    return availableFonts.filter((font) => font.toLowerCase().includes(keyword));
  }, [availableFonts, fontQuery]);

  const displayFontLabel =
    terminalFontFamily === DEFAULT_TERMINAL_FONT_FAMILY
      ? "默认字体（Cascadia Code 优先）"
      : terminalFontFamily;

  async function handleSave() {
    const normalizedCustom = customTerminals.map((terminal) => ({
      ...terminal,
      name: terminal.name.trim(),
      path: terminal.path.trim(),
      startDirectory: terminal.startDirectory.trim(),
      shellType: inferShellType(terminal.path, terminal.shellType, terminal.name),
    }));

    const invalidTerminal = normalizedCustom.find(
      (terminal) => !terminal.name || !terminal.path
    );
    if (invalidTerminal) {
      setError("自定义终端必须填写名称和执行文件路径。");
      return;
    }

    const duplicatePath = normalizedCustom.find(
      (terminal, index) =>
        normalizedCustom.findIndex(
          (candidate) => candidate.path.toLowerCase() === terminal.path.toLowerCase()
        ) !== index
    );
    if (duplicatePath) {
      setError("自定义终端的执行文件路径不能重复。");
      return;
    }

    const parsedFontSize = Number(terminalFontSize.trim());
    if (!Number.isFinite(parsedFontSize) || parsedFontSize < 8 || parsedFontSize > 32) {
      setError("终端字号必须是 8 到 32 之间的数字。");
      return;
    }

    if (!terminalFontFamily) {
      setError("请选择终端字体。");
      return;
    }

    const fallbackSystemId = systemShells[0] ? systemTerminalId(systemShells[0]) : "";
    const nextDefaultId =
      defaultTerminalId || normalizedCustom[0]?.id || fallbackSystemId;

    const selectedOption = terminalOptions.find(
      (option) => option.id === nextDefaultId
    );
    if (!selectedOption && !nextDefaultId) {
      setError("请至少保留一个可用终端。");
      return;
    }

    const nextSettings: AppSettings = {
      defaultShell: selectedOption?.shellType ?? settings.defaultShell,
      defaultTerminalId: nextDefaultId,
      defaultWorkingDirectory: defaultWorkingDirectory.trim(),
      terminalFontFamily: terminalFontFamily.trim(),
      terminalFontSize: parsedFontSize,
      detectedTerminalFonts: availableFonts,
      customTerminals: normalizedCustom,
      detectedSystemTerminals: systemShells,
      commandGroups: settings.commandGroups,
      enableRightClickCommandPaste,
    };

    try {
      setSaving(true);
      setError("");
      await onSave(nextSettings);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  function updateCustomTerminal(
    id: string,
    updates: Partial<CustomTerminalProfile>
  ) {
    setCustomTerminals((prev) =>
      prev.map((terminal) =>
        terminal.id === id ? { ...terminal, ...updates } : terminal
      )
    );
  }

  function removeCustomTerminal(id: string) {
    setCustomTerminals((prev) => prev.filter((terminal) => terminal.id !== id));
    if (defaultTerminalId === id) {
      setDefaultTerminalId("");
    }
  }

  async function browseExecutable(id: string) {
    const selected = await terminalPickExecutable();
    if (!selected) return;

    const terminal = customTerminals.find((item) => item.id === id);
    updateCustomTerminal(id, {
      path: selected,
      shellType: inferShellType(selected, terminal?.shellType, terminal?.name),
    });
  }

  async function browseDirectory(
    id?: string,
    updateGlobal = false
  ) {
    const selected = await terminalPickDirectory();
    if (!selected) return;
    if (updateGlobal) {
      setDefaultWorkingDirectory(selected);
      return;
    }
    if (id) {
      updateCustomTerminal(id, { startDirectory: selected });
    }
  }

  async function handleDetectSystemShells() {
    try {
      setDetecting(true);
      setError("");
      const shells = await onDetectSystemShells();
      const currentDefaultId = defaultTerminalId;
      if (!currentDefaultId && shells.length > 0) {
        const systemDefault = shells.find((shell) => shell.isDefault) ?? shells[0];
        setDefaultTerminalId(systemTerminalId(systemDefault));
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setDetecting(false);
    }
  }

  async function handleDetectFonts() {
    try {
      setDetectingFonts(true);
      setError("");
      const fonts = await terminalListFonts();
      setAvailableFonts(fonts);
      if (
        terminalFontFamily !== DEFAULT_TERMINAL_FONT_FAMILY &&
        !fonts.includes(terminalFontFamily)
      ) {
        setTerminalFontFamily(DEFAULT_TERMINAL_FONT_FAMILY);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setDetectingFonts(false);
    }
  }

  return (
    <div
      style={overlayStyle}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div style={dialogStyle}>
        <div style={headerStyle}>
          <div>
            <h3 style={titleStyle}>全局设置</h3>
            <p style={subtitleStyle}>
              自动识别系统终端，可新增自定义终端，并设置默认终端。
            </p>
            <div style={versionStyle}>当前版本 v{appVersion}</div>
          </div>
        </div>

        <div style={bodyStyle}>
          <label style={labelStyle}>默认终端</label>
          <select
            value={defaultTerminalId}
            onChange={(event) => setDefaultTerminalId(event.target.value)}
            style={selectStyle}
          >
            <option value="">跟随系统默认</option>
            {terminalOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name} {option.source === "system" ? "(系统)" : "(自定义)"}
              </option>
            ))}
          </select>

          <label style={labelStyle}>系统终端默认启动目录</label>
          <div style={inlineRowStyle}>
            <input
              type="text"
              value={defaultWorkingDirectory}
              onChange={(event) => setDefaultWorkingDirectory(event.target.value)}
              placeholder="留空使用用户主目录"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button style={browseBtnStyle} onClick={() => browseDirectory(undefined, true)}>
              浏览
            </button>
          </div>

          <label style={labelStyle}>终端字体</label>
          <div style={sectionHeaderStyle}>
            <div style={fontHintStyle}>
              {availableFonts.length > 0
                ? `已获取 ${availableFonts.length} 个系统字体`
                : "尚未获取系统字体"}
            </div>
            <div style={fontActionRowStyle}>
              <button
                style={secondaryActionBtnStyle}
                onClick={() => {
                  setTerminalFontFamily(DEFAULT_TERMINAL_FONT_FAMILY);
                  setFontQuery("");
                  setFontDropdownOpen(false);
                }}
              >
                恢复默认
              </button>
              <button
                style={primaryActionBtnStyle}
                onClick={handleDetectFonts}
                disabled={detectingFonts}
              >
                {detectingFonts ? "获取中..." : "获取系统字体"}
              </button>
            </div>
          </div>
          <div style={fontPickerWrapStyle}>
            <input
              type="text"
              value={fontDropdownOpen ? fontQuery : displayFontLabel}
              onFocus={() => {
                if (availableFonts.length > 0) {
                  setFontDropdownOpen(true);
                  setFontQuery("");
                }
              }}
              onChange={(event) => {
                setFontDropdownOpen(true);
                setFontQuery(event.target.value);
              }}
              onBlur={() => {
                setTimeout(() => {
                  setFontDropdownOpen(false);
                  setFontQuery("");
                }, 120);
              }}
              placeholder={
                availableFonts.length > 0 ? "搜索并选择字体" : "请先获取系统字体"
              }
              style={inputStyle}
              readOnly={availableFonts.length === 0}
            />
            {fontDropdownOpen && availableFonts.length > 0 && (
              <div style={fontDropdownStyle}>
                <button
                  style={fontOptionStyle(
                    terminalFontFamily === DEFAULT_TERMINAL_FONT_FAMILY
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    setTerminalFontFamily(DEFAULT_TERMINAL_FONT_FAMILY);
                    setFontDropdownOpen(false);
                    setFontQuery("");
                  }}
                >
                  默认字体（Cascadia Code 优先）
                </button>
                {filteredFonts.length === 0 ? (
                  <div style={fontEmptyStyle}>没有匹配的字体</div>
                ) : (
                  filteredFonts.map((font) => (
                    <button
                      key={font}
                      style={fontOptionStyle(terminalFontFamily === font)}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        setTerminalFontFamily(font);
                        setFontDropdownOpen(false);
                        setFontQuery("");
                      }}
                    >
                      {font}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <label style={labelStyle}>终端字号</label>
          <input
            type="number"
            min={8}
            max={32}
            step={1}
            value={terminalFontSize}
            onChange={(event) => setTerminalFontSize(event.target.value)}
            placeholder="13"
            style={inputStyle}
          />

          <label style={checkboxRowStyle}>
            <input
              type="checkbox"
              checked={enableRightClickCommandPaste}
              onChange={(event) => setEnableRightClickCommandPaste(event.target.checked)}
            />
            <span>启用右键一键粘贴常用命令</span>
          </label>

          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <h4 style={sectionTitleStyle}>系统终端</h4>
              <button
                style={primaryActionBtnStyle}
                onClick={handleDetectSystemShells}
                disabled={detecting}
              >
                {detecting ? "检测中..." : "检测系统终端"}
              </button>
            </div>
            {systemShells.length === 0 ? (
              <div style={emptyStyle}>
                尚未检测系统终端。点击右侧“检测系统终端”后才会列出。
              </div>
            ) : (
              <div style={listStyle}>
                {systemShells.map((shell) => {
                  const isSelected = defaultTerminalId === systemTerminalId(shell);
                  return (
                    <div key={shell.path} style={itemCardStyle}>
                      <div style={itemTopStyle}>
                        <span style={itemNameStyle}>{shell.displayName}</span>
                        <div style={badgeGroupStyle}>
                          {shell.isDefault && <span style={badgeStyle}>系统默认</span>}
                          {isSelected && <span style={primaryBadgeStyle}>当前默认</span>}
                        </div>
                      </div>
                      <div style={pathTextStyle}>{shell.path}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <h4 style={sectionTitleStyle}>自定义终端</h4>
              <button
                style={primaryActionBtnStyle}
                onClick={() =>
                  setCustomTerminals((prev) => [...prev, createEmptyCustomTerminal()])
                }
              >
                新增终端
              </button>
            </div>

            {customTerminals.length === 0 ? (
              <div style={emptyStyle}>暂无自定义终端</div>
            ) : (
              <div style={listStyle}>
                {customTerminals.map((terminal) => {
                  const isDefault = defaultTerminalId === terminal.id;
                  return (
                    <div key={terminal.id} style={itemCardStyle}>
                      <div style={itemTopStyle}>
                        <span style={itemNameStyle}>
                          自定义终端
                          {isDefault && <span style={primaryBadgeStyle}>当前默认</span>}
                        </span>
                        <button
                          style={removeBtnStyle}
                          onClick={() => removeCustomTerminal(terminal.id)}
                        >
                          删除
                        </button>
                      </div>

                      <label style={labelStyle}>名称</label>
                      <input
                        type="text"
                        value={terminal.name}
                        onChange={(event) =>
                          updateCustomTerminal(terminal.id, {
                            name: event.target.value,
                            shellType: inferShellType(
                              terminal.path,
                              terminal.shellType,
                              event.target.value
                            ),
                          })
                        }
                        placeholder="例如：Claude Code"
                        style={inputStyle}
                      />

                      <label style={labelStyle}>执行文件路径</label>
                      <div style={inlineRowStyle}>
                        <input
                          type="text"
                          value={terminal.path}
                          onChange={(event) =>
                            updateCustomTerminal(terminal.id, {
                              path: event.target.value,
                              shellType: inferShellType(
                                event.target.value,
                                terminal.shellType,
                                terminal.name
                              ),
                            })
                          }
                          placeholder="选择终端可执行文件"
                          style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                        />
                        <button
                          style={browseBtnStyle}
                          onClick={() => browseExecutable(terminal.id)}
                        >
                          浏览
                        </button>
                      </div>

                      <label style={labelStyle}>启动目录</label>
                      <div style={inlineRowStyle}>
                        <input
                          type="text"
                          value={terminal.startDirectory}
                          onChange={(event) =>
                            updateCustomTerminal(terminal.id, {
                              startDirectory: event.target.value,
                            })
                          }
                          placeholder="留空使用系统终端默认启动目录"
                          style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                        />
                        <button
                          style={browseBtnStyle}
                          onClick={() => browseDirectory(terminal.id)}
                        >
                          浏览
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {error && <div style={errorStyle}>{error}</div>}
        </div>

        <div style={actionsStyle}>
          <button style={btnStyle} onClick={onCancel} disabled={saving}>
            取消
          </button>
          <button style={primaryBtnStyle} onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 11000,
  background: "rgba(0,0,0,0.72)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const dialogStyle: React.CSSProperties = {
  width: 880,
  maxWidth: "calc(100vw - 48px)",
  maxHeight: "calc(100vh - 48px)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  background: "#252525",
  border: "1px solid #333",
  borderRadius: 10,
};

const headerStyle: React.CSSProperties = {
  padding: "20px 24px 12px",
  borderBottom: "1px solid #333",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
  color: "#f0f0f0",
};

const subtitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  fontSize: 12,
  color: "#9ca3af",
};

const versionStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  marginTop: 10,
  padding: "4px 10px",
  borderRadius: 999,
  background: "#1f2937",
  color: "#bfdbfe",
  fontSize: 12,
  fontWeight: 600,
};

const bodyStyle: React.CSSProperties = {
  padding: 24,
  overflowY: "auto",
};

const sectionStyle: React.CSSProperties = {
  marginTop: 24,
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 12,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  color: "#f0f0f0",
};

const fontHintStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#9ca3af",
};

const fontActionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
};

const fontPickerWrapStyle: React.CSSProperties = {
  position: "relative",
  marginBottom: 12,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "#9ca3af",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  marginBottom: 12,
  padding: "8px 10px",
  background: "#1a1a1a",
  color: "#e0e0e0",
  border: "1px solid #444",
  borderRadius: 4,
  fontSize: 13,
  outline: "none",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
};

const fontDropdownStyle: React.CSSProperties = {
  position: "absolute",
  top: 40,
  left: 0,
  right: 0,
  maxHeight: 260,
  overflowY: "auto",
  border: "1px solid #444",
  borderRadius: 6,
  background: "#151515",
  zIndex: 2,
  padding: 6,
  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
};

const fontOptionStyle = (active: boolean): React.CSSProperties => ({
  width: "100%",
  textAlign: "left",
  padding: "8px 10px",
  borderRadius: 4,
  background: active ? "#2563eb" : "transparent",
  color: active ? "#fff" : "#e5e7eb",
  fontSize: 13,
});

const fontEmptyStyle: React.CSSProperties = {
  padding: "8px 10px",
  color: "#9ca3af",
  fontSize: 12,
};

const inlineRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  marginBottom: 12,
};

const checkboxRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 16,
  fontSize: 13,
  color: "#e5e7eb",
};

const browseBtnStyle: React.CSSProperties = {
  height: 34,
  padding: "0 12px",
  borderRadius: 4,
  background: "#333",
  color: "#f0f0f0",
};

const listStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const itemCardStyle: React.CSSProperties = {
  padding: 14,
  background: "#1c1c1c",
  border: "1px solid #333",
  borderRadius: 8,
};

const itemTopStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 10,
};

const itemNameStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#f3f4f6",
};

const badgeGroupStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
};

const badgeStyle: React.CSSProperties = {
  padding: "2px 8px",
  borderRadius: 999,
  background: "#303030",
  color: "#d1d5db",
  fontSize: 11,
};

const primaryBadgeStyle: React.CSSProperties = {
  ...badgeStyle,
  background: "#1d4ed8",
  color: "#fff",
  marginLeft: 6,
};

const pathTextStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#9ca3af",
  wordBreak: "break-all",
};

const removeBtnStyle: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: 4,
  background: "#4b1d1d",
  color: "#fecaca",
  fontSize: 12,
};

const primaryActionBtnStyle: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 4,
  background: "#2563eb",
  color: "#fff",
  fontSize: 12,
};

const secondaryActionBtnStyle: React.CSSProperties = {
  ...primaryActionBtnStyle,
  background: "#333",
};

const emptyStyle: React.CSSProperties = {
  padding: 16,
  border: "1px dashed #444",
  borderRadius: 8,
  color: "#9ca3af",
  fontSize: 12,
};

const errorStyle: React.CSSProperties = {
  marginTop: 16,
  padding: "10px 12px",
  borderRadius: 6,
  background: "#4c1d1d",
  color: "#fecaca",
  fontSize: 12,
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  padding: "16px 24px 20px",
  borderTop: "1px solid #333",
};

const btnStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 4,
  background: "#333",
  color: "#f0f0f0",
};

const primaryBtnStyle: React.CSSProperties = {
  ...btnStyle,
  background: "#2563eb",
  color: "#fff",
};

export default GlobalSettingsDialog;
