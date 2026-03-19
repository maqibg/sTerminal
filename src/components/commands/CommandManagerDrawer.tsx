import React, { useMemo, useState } from "react";
import { settingsSave } from "../../ipc/layoutApi";
import { useAppSettingsStore } from "../../store/appSettingsStore";
import type { CommandGroup } from "../../types/layout";
import { useConfirm } from "../../hooks/useConfirm";

interface CommandManagerDrawerProps {
  open: boolean;
  onClose: () => void;
}

function newGroup(): CommandGroup {
  return { id: crypto.randomUUID(), name: "新分组", commands: [] };
}

export function CommandManagerDrawer({ open, onClose }: CommandManagerDrawerProps) {
  const settings = useAppSettingsStore((s) => s.settings);
  const updateSettings = useAppSettingsStore((s) => s.updateSettings);
  const [confirm, ConfirmPortal] = useConfirm();
  const [editing, setEditing] = useState<{ groupId?: string; commandId?: string } | null>(null);
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const groups = settings.commandGroups ?? [];

  const title = useMemo(() => {
    if (!editing) return "";
    return editing.commandId ? "编辑命令" : editing.groupId ? "编辑分组" : "新建分组";
  }, [editing]);

  async function persist(commandGroups: CommandGroup[]) {
    const next = { ...settings, commandGroups };
    await settingsSave(next);
    updateSettings(next);
  }

  function startNewGroup() {
    setEditing({});
    setName("");
    setCommand("");
  }

  function startEditGroup(group: CommandGroup) {
    setEditing({ groupId: group.id });
    setName(group.name);
    setCommand("");
  }

  function startNewCommand(groupId: string) {
    setEditing({ groupId, commandId: "" });
    setName("");
    setCommand("");
  }

  function startEditCommand(groupId: string, commandId: string, nextName: string, nextCommand: string) {
    setEditing({ groupId, commandId });
    setName(nextName);
    setCommand(nextCommand);
  }

  async function saveEditing() {
    if (!editing) return;
    if (!name.trim()) return;

    if (!editing.groupId) {
      await persist([...groups, { ...newGroup(), name: name.trim() }]);
      setEditing(null);
      return;
    }

    if (editing.commandId === undefined) {
      await persist(groups.map((group) => (
        group.id === editing.groupId ? { ...group, name: name.trim() } : group
      )));
      setEditing(null);
      return;
    }

    if (!command.trim()) return;
    if (!editing.commandId) {
      await persist(groups.map((group) => (
        group.id === editing.groupId
          ? { ...group, commands: [...group.commands, { id: crypto.randomUUID(), name: name.trim(), command: command.trim() }] }
          : group
      )));
      setEditing(null);
      return;
    }

    await persist(groups.map((group) => (
      group.id === editing.groupId
        ? {
            ...group,
            commands: group.commands.map((item) => (
              item.id === editing.commandId
                ? { ...item, name: name.trim(), command: command.trim() }
                : item
            )),
          }
        : group
    )));
    setEditing(null);
  }

  async function removeGroup(groupId: string, groupName: string) {
    const ok = await confirm({ title: "删除分组", message: `确认删除分组「${groupName}」及其命令？`, kind: "danger" });
    if (!ok) return;
    await persist(groups.filter((group) => group.id !== groupId));
  }

  async function removeCommand(groupId: string, commandId: string, commandName: string) {
    const ok = await confirm({ title: "删除命令", message: `确认删除命令「${commandName}」？`, kind: "danger" });
    if (!ok) return;
    await persist(groups.map((group) => (
      group.id === groupId
        ? { ...group, commands: group.commands.filter((item) => item.id !== commandId) }
        : group
    )));
  }

  if (!open) return null;

  return (
    <>
      <div style={overlayStyle} onClick={onClose} />
      <div style={drawerStyle}>
        <div style={headerStyle}>
          <div style={titleStyle}>常用命令</div>
          <div style={headerActionsStyle}>
            <button style={secondaryBtnStyle} onClick={startNewGroup}>+ 分组</button>
            <button style={closeBtnStyle} onClick={onClose}>✕</button>
          </div>
        </div>

        {editing && (
          <div style={editorStyle}>
            <div style={editorTitleStyle}>{title}</div>
            <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder={editing.commandId !== undefined ? "命令名称" : "分组名称"} />
            {editing.groupId && editing.commandId !== undefined && (
              <textarea style={textareaStyle} value={command} onChange={(e) => setCommand(e.target.value)} placeholder="命令内容" rows={3} />
            )}
            <div style={editorActionsStyle}>
              <button style={secondaryBtnStyle} onClick={() => setEditing(null)}>取消</button>
              <button style={primaryBtnStyle} onClick={saveEditing}>保存</button>
            </div>
          </div>
        )}

        <div style={bodyStyle}>
          {groups.length === 0 ? <div style={emptyStyle}>暂无常用命令分组</div> : null}
          {groups.map((group) => (
            <div key={group.id} style={groupStyle}>
              <div style={groupHeaderStyle}>
                <div style={groupNameStyle}>{group.name}</div>
                <div style={groupActionWrapStyle}>
                  <button style={tinyBtnStyle} onClick={() => startNewCommand(group.id)}>+ 命令</button>
                  <button style={tinyBtnStyle} onClick={() => startEditGroup(group)}>编辑</button>
                  <button style={dangerTinyBtnStyle} onClick={() => void removeGroup(group.id, group.name)}>删除</button>
                </div>
              </div>
              {group.commands.length === 0 ? <div style={emptyGroupStyle}>暂无命令</div> : null}
              {group.commands.map((item) => (
                <div key={item.id} style={commandRowStyle}>
                  <div style={commandInfoStyle}>
                    <div style={commandNameStyle}>{item.name}</div>
                    <div style={commandTextStyle}>{item.command}</div>
                  </div>
                  <div style={groupActionWrapStyle}>
                    <button style={tinyBtnStyle} onClick={() => startEditCommand(group.id, item.id, item.name, item.command)}>编辑</button>
                    <button style={dangerTinyBtnStyle} onClick={() => void removeCommand(group.id, item.id, item.name)}>删除</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <ConfirmPortal />
    </>
  );
}

const overlayStyle: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 9000, background: "transparent" };
const drawerStyle: React.CSSProperties = { position: "fixed", top: 0, right: 0, bottom: 0, width: 360, zIndex: 9001, background: "#1e1e1e", borderLeft: "1px solid #333", display: "flex", flexDirection: "column", boxShadow: "-4px 0 20px rgba(0,0,0,0.5)" };
const headerStyle: React.CSSProperties = { height: 48, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #333" };
const titleStyle: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: "#f3f4f6" };
const headerActionsStyle: React.CSSProperties = { display: "flex", gap: 6 };
const closeBtnStyle: React.CSSProperties = { background: "transparent", color: "#9ca3af", padding: "2px 6px" };
const editorStyle: React.CSSProperties = { borderBottom: "1px solid #333", padding: 16, display: "flex", flexDirection: "column", gap: 8 };
const editorTitleStyle: React.CSSProperties = { fontSize: 12, color: "#9ca3af" };
const inputStyle: React.CSSProperties = { background: "#2a2a2a", border: "1px solid #444", borderRadius: 4, padding: "6px 10px", color: "#e5e7eb", fontSize: 13 };
const textareaStyle: React.CSSProperties = { ...inputStyle, resize: "vertical", fontFamily: "monospace" };
const editorActionsStyle: React.CSSProperties = { display: "flex", justifyContent: "flex-end", gap: 8 };
const bodyStyle: React.CSSProperties = { flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 };
const emptyStyle: React.CSSProperties = { color: "#6b7280", fontSize: 13, textAlign: "center", paddingTop: 32 };
const groupStyle: React.CSSProperties = { background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, padding: 10 };
const groupHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" };
const groupNameStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#f3f4f6" };
const groupActionWrapStyle: React.CSSProperties = { display: "flex", gap: 6, flexShrink: 0 };
const tinyBtnStyle: React.CSSProperties = { padding: "2px 8px", background: "#2f2f2f", color: "#d1d5db", borderRadius: 4, fontSize: 12 };
const dangerTinyBtnStyle: React.CSSProperties = { ...tinyBtnStyle, color: "#fca5a5" };
const emptyGroupStyle: React.CSSProperties = { color: "#6b7280", fontSize: 12, paddingTop: 8 };
const commandRowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 8, paddingTop: 10, borderTop: "1px solid #2b2b2b", marginTop: 10 };
const commandInfoStyle: React.CSSProperties = { minWidth: 0, flex: 1 };
const commandNameStyle: React.CSSProperties = { color: "#e5e7eb", fontSize: 13 };
const commandTextStyle: React.CSSProperties = { color: "#9ca3af", fontSize: 11, marginTop: 2, fontFamily: "monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const primaryBtnStyle: React.CSSProperties = { padding: "6px 14px", background: "#2563eb", color: "#fff", borderRadius: 4 };
const secondaryBtnStyle: React.CSSProperties = { padding: "6px 14px", background: "#333", color: "#f3f4f6", borderRadius: 4 };

export default CommandManagerDrawer;
