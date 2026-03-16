import { create } from "zustand";
import type { PanelState } from "../types/terminal";

interface PanelStoreState {
  /** key 是 panelId（与 TerminalLeaf.id 对应） */
  panels: Map<string, PanelState>;
}

interface PanelStoreActions {
  /** 注册新面板 */
  addPanel: (panelState: PanelState) => void;
  /** 更新面板实时工作目录 */
  updateCwd: (panelId: string, cwd: string) => void;
  /** 标记面板进程已退出 */
  setDead: (panelId: string, exitCode: number) => void;
  /** 移除面板（面板关闭时调用） */
  removePanel: (panelId: string) => void;
  /** 清空所有面板（布局加载时使用） */
  clearAll: () => void;
  /** 获取面板状态（返回 undefined 表示不存在） */
  getPanel: (panelId: string) => PanelState | undefined;
}

export type PanelStore = PanelStoreState & PanelStoreActions;

export const usePanelStore = create<PanelStore>((set, get) => ({
  panels: new Map(),

  addPanel(panelState) {
    set((state) => {
      const next = new Map(state.panels);
      next.set(panelState.id, panelState);
      return { panels: next };
    });
  },

  updateCwd(panelId, cwd) {
    set((state) => {
      const existing = state.panels.get(panelId);
      if (!existing) return state;
      const next = new Map(state.panels);
      next.set(panelId, { ...existing, currentWorkingDirectory: cwd });
      return { panels: next };
    });
  },

  setDead(panelId, exitCode) {
    set((state) => {
      const existing = state.panels.get(panelId);
      if (!existing) return state;
      const next = new Map(state.panels);
      next.set(panelId, { ...existing, isAlive: false, exitCode });
      return { panels: next };
    });
  },

  removePanel(panelId) {
    set((state) => {
      if (!state.panels.has(panelId)) return state;
      const next = new Map(state.panels);
      next.delete(panelId);
      return { panels: next };
    });
  },

  clearAll() {
    set({ panels: new Map() });
  },

  getPanel(panelId) {
    return get().panels.get(panelId);
  },
}));
