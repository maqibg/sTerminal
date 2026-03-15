import { create } from "zustand";
import type { LayoutNode, TerminalLeaf } from "../types/layout";
import {
  insertNode,
  removeNode,
  updateRatio,
  duplicateNode,
  generateId,
  countLeaves,
} from "../utils/layoutTree";

/**
 * 创建初始单面板叶子节点（应用启动时的默认布局）
 */
function createInitialLeaf(): TerminalLeaf {
  return {
    type: "terminal",
    id: generateId(),
    shellType: "default",
    shellPath: "",
    workingDirectory: "",
  };
}

interface LayoutState {
  /** 当前布局树 */
  layoutTree: LayoutNode;
  /** 当前获得焦点的面板 ID */
  focusedPanelId: string | null;
}

interface LayoutActions {
  /**
   * 在指定面板位置分割，创建新的 TerminalLeaf 插入树中。
   * 新面板自动获得焦点。
   */
  splitPanel: (
    panelId: string,
    direction: "horizontal" | "vertical",
    config?: Partial<Pick<TerminalLeaf, "shellType" | "shellPath" | "workingDirectory">>
  ) => string;

  /**
   * 关闭指定面板（仅当面板数 > 1 时才关闭）。
   * 如果焦点在被关闭的面板上，焦点清空。
   */
  closePanel: (panelId: string) => void;

  /**
   * 更新分割比例（拖拽分割线时调用）。
   * targetSplitFirstLeafId: 目标 SplitNode 下 first 子叶子的 id（用于定位 split 节点）
   */
  updateSplitRatio: (targetSplitFirstLeafId: string, newRatio: number) => void;

  /**
   * 复制面板：在指定面板旁按 direction 插入一个新面板，继承 config 配置。
   * 返回新面板 ID。
   */
  duplicatePanel: (
    panelId: string,
    direction: "horizontal" | "vertical",
    config?: Partial<Pick<TerminalLeaf, "shellType" | "shellPath" | "workingDirectory">>
  ) => string;

  /**
   * 直接设置整棵布局树（布局加载时使用）
   */
  setLayoutTree: (tree: LayoutNode) => void;

  /**
   * 设置焦点面板
   */
  setFocusedPanel: (panelId: string | null) => void;
}

export type LayoutStore = LayoutState & LayoutActions;

export const useLayoutStore = create<LayoutStore>((set, get) => {
  const initialLeaf = createInitialLeaf();

  return {
    layoutTree: initialLeaf,
    focusedPanelId: initialLeaf.id,

    splitPanel(panelId, direction, config) {
      const newLeaf: TerminalLeaf = {
        type: "terminal",
        id: generateId(),
        shellType: config?.shellType ?? "default",
        shellPath: config?.shellPath ?? "",
        workingDirectory: config?.workingDirectory ?? "",
      };
      set((state) => ({
        layoutTree: insertNode(state.layoutTree, panelId, direction, newLeaf),
        focusedPanelId: newLeaf.id,
      }));
      return newLeaf.id;
    },

    closePanel(panelId) {
      const { layoutTree, focusedPanelId } = get();
      if (countLeaves(layoutTree) <= 1) return;

      const newTree = removeNode(layoutTree, panelId);
      if (newTree === null) return;

      set({
        layoutTree: newTree,
        focusedPanelId: focusedPanelId === panelId ? null : focusedPanelId,
      });
    },

    updateSplitRatio(targetSplitFirstLeafId, newRatio) {
      set((state) => ({
        layoutTree: updateRatio(
          state.layoutTree,
          targetSplitFirstLeafId,
          newRatio
        ),
      }));
    },

    duplicatePanel(panelId, direction, config) {
      const newLeaf: TerminalLeaf = {
        type: "terminal",
        id: generateId(),
        shellType: config?.shellType ?? "default",
        shellPath: config?.shellPath ?? "",
        workingDirectory: config?.workingDirectory ?? "",
      };
      set((state) => ({
        layoutTree: duplicateNode(
          state.layoutTree,
          panelId,
          direction,
          newLeaf
        ),
        focusedPanelId: newLeaf.id,
      }));
      return newLeaf.id;
    },

    setLayoutTree(tree) {
      set({ layoutTree: tree, focusedPanelId: null });
    },

    setFocusedPanel(panelId) {
      set({ focusedPanelId: panelId });
    },
  };
});
