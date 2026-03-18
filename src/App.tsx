import { useState, useCallback, useEffect } from "react";
import "./styles/global.css";
import "./styles/terminal.css";
import "./styles/tabbar.css";
import { TitleBar } from "./components/titlebar/TitleBar";
import { LayoutRenderer } from "./components/layout/LayoutRenderer";
import { SaveLayoutDialog } from "./components/layout-manager/SaveLayoutDialog";
import { LayoutManagerDrawer } from "./components/layout-manager/LayoutManagerDrawer";
import { GlobalSettingsDialog } from "./components/settings/GlobalSettingsDialog";
import { Toast } from "./components/Toast";
import { useLayoutStore } from "./store/layoutStore";
import {
  getResolvedDefaultTerminal,
  useAppSettingsStore,
} from "./store/appSettingsStore";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { layoutUpdate, settingsGet, settingsSave } from "./ipc/layoutApi";
import { shellListAvailable } from "./ipc/terminalApi";
import { collectLeaves } from "./utils/layoutTree";
import type { AppSettings, LayoutNode } from "./types/layout";

interface ToastState {
  id: number;
  message: string;
  type: "success" | "warning" | "error" | "info";
}

let toastCounter = 0;

export function App() {
  const layoutTree = useLayoutStore((s) => s.layoutTree);
  const setLayoutTree = useLayoutStore((s) => s.setLayoutTree);
  const splitPanel = useLayoutStore((s) => s.splitPanel);
  const closePanel = useLayoutStore((s) => s.closePanel);
  const duplicatePanel = useLayoutStore((s) => s.duplicatePanel);
  const focusPanelId = useLayoutStore((s) => s.focusedPanelId);
  const setFocusPanel = useLayoutStore((s) => s.setFocusedPanel);
  const activeLayoutId = useLayoutStore((s) => s.activeLayoutId);
  const activeLayoutName = useLayoutStore((s) => s.activeLayoutName);
  const setActiveLayout = useLayoutStore((s) => s.setActiveLayout);
  const layoutDirty = useLayoutStore((s) => s.layoutDirty);
  const markLayoutClean = useLayoutStore((s) => s.markLayoutClean);
  const updateTabConfig = useLayoutStore((s) => s.updateTabConfig);
  const appSettings = useAppSettingsStore((s) => s.settings);
  const systemShells = useAppSettingsStore((s) => s.systemShells);
  const settingsHydrated = useAppSettingsStore((s) => s.hydrated);
  const hydrateAppSettings = useAppSettingsStore((s) => s.hydrate);
  const setSystemShells = useAppSettingsStore((s) => s.setSystemShells);
  const updateAppSettings = useAppSettingsStore((s) => s.updateSettings);

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLayoutManager, setShowLayoutManager] = useState(false);
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [toasts, setToasts] = useState<ToastState[]>([]);

  // 布局名称递增计数
  const [layoutNameCounter, setLayoutNameCounter] = useState(1);
  // 布局列表刷新触发器
  const [layoutRefreshKey, setLayoutRefreshKey] = useState(0);

  const addToast = useCallback(
    (message: string, type: ToastState["type"] = "info") => {
      const id = ++toastCounter;
      setToasts((prev) => [...prev, { id, message, type }]);
    },
    []
  );

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    settingsGet()
      .then((settings) => {
        const initialTree = useLayoutStore.getState().layoutTree;
        const leaves = collectLeaves(initialTree);
        const firstLeaf = leaves[0];
        const firstSession = firstLeaf?.tabs[0];

        if (
          leaves.length === 1 &&
          firstLeaf &&
          firstSession &&
          !firstSession.shellPath &&
          !firstSession.workingDirectory
        ) {
          const terminal = getResolvedDefaultTerminal(
            settings,
            settings.detectedSystemTerminals ?? []
          );
          if (terminal) {
            updateTabConfig(firstLeaf.id, firstSession.id, {
              shellType: terminal.shellType,
              shellPath: terminal.path,
              workingDirectory: terminal.startDirectory,
            });
          }
        }

        hydrateAppSettings(settings);
      })
      .catch((err) => {
        addToast("加载全局设置失败：" + String(err), "error");
        hydrateAppSettings(useAppSettingsStore.getState().settings);
      });
  }, [addToast, hydrateAppSettings, updateTabConfig]);

  const handleSaveLayout = useCallback(async () => {
    if (activeLayoutId) {
      try {
        await layoutUpdate(activeLayoutId, layoutTree);
        markLayoutClean();
        addToast("布局已保存", "success");
      } catch (e) {
        addToast("保存失败：" + String(e), "error");
      }
    } else {
      setShowSaveDialog(true);
    }
  }, [activeLayoutId, layoutTree, addToast, markLayoutClean]);

  const handleSaveSuccess = (layoutId: string, name: string) => {
    setShowSaveDialog(false);
    setLayoutNameCounter((n) => n + 1);
    setActiveLayout(layoutId, name);
    markLayoutClean();
    setLayoutRefreshKey((n) => n + 1);
    addToast(`布局已保存：${name}`, "success");
  };

  const handleLayoutLoad = (tree: LayoutNode, layoutId: string, layoutName: string) => {
    setLayoutTree(tree);
    setActiveLayout(layoutId, layoutName);
    addToast("布局已加载", "success");
  };

  const handleWorkdirWarning = (message: string) => {
    addToast(message, "warning");
  };

  const handleSaveGlobalSettings = useCallback(
    async (settings: AppSettings) => {
      await settingsSave(settings);
      updateAppSettings(settings);
      setShowGlobalSettings(false);
      addToast("全局设置已保存", "success");
    },
    [addToast, updateAppSettings]
  );

  const handleDetectSystemShells = useCallback(async () => {
    try {
      const shells = await shellListAvailable();
      setSystemShells(shells);
      addToast(`已检测到 ${shells.length} 个系统终端`, "success");
      return shells;
    } catch (err) {
      const message = "检测系统终端失败：" + String(err);
      addToast(message, "error");
      throw err;
    }
  }, [addToast, setSystemShells]);

  // 快捷键：操作当前焦点面板
  useKeyboardShortcuts({
    onSplitHorizontal: () => {
      if (focusPanelId) splitPanel(focusPanelId, "horizontal");
    },
    onSplitVertical: () => {
      if (focusPanelId) splitPanel(focusPanelId, "vertical");
    },
    onDuplicate: () => {
      if (focusPanelId) duplicatePanel(focusPanelId, "horizontal");
    },
    onClose: () => {
      if (focusPanelId) closePanel(focusPanelId);
    },
    onSaveLayout: handleSaveLayout,
    onOpenLayoutManager: () => setShowLayoutManager(true),
    onFocusNext: () => {
      const leafIds = collectLeaves(layoutTree).map((l) => l.id);
      if (leafIds.length === 0) return;
      const idx = focusPanelId ? leafIds.indexOf(focusPanelId) : -1;
      setFocusPanel(leafIds[(idx + 1) % leafIds.length]);
    },
    onFocusPrev: () => {
      const leafIds = collectLeaves(layoutTree).map((l) => l.id);
      if (leafIds.length === 0) return;
      const idx = focusPanelId ? leafIds.indexOf(focusPanelId) : 0;
      setFocusPanel(leafIds[(idx - 1 + leafIds.length) % leafIds.length]);
    },
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        background: "var(--bg-app)",
      }}
    >
      <TitleBar
        onOpenLayoutManager={() => setShowLayoutManager(true)}
        onOpenSettings={() => setShowGlobalSettings(true)}
        activeLayoutName={activeLayoutName}
      />

      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {settingsHydrated ? <LayoutRenderer node={layoutTree} /> : null}
      </div>

      {/* 保存布局弹窗 */}
      {showSaveDialog && (
        <SaveLayoutDialog
          defaultName={`布局 ${layoutNameCounter}`}
          tree={layoutTree}
          onSuccess={handleSaveSuccess}
          onCancel={() => setShowSaveDialog(false)}
        />
      )}

      {showGlobalSettings && (
        <GlobalSettingsDialog
          settings={appSettings}
          systemShells={systemShells}
          onDetectSystemShells={handleDetectSystemShells}
          onCancel={() => setShowGlobalSettings(false)}
          onSave={handleSaveGlobalSettings}
        />
      )}

      {/* 布局管理抽屉 */}
      <LayoutManagerDrawer
        open={showLayoutManager}
        onClose={() => setShowLayoutManager(false)}
        onLayoutLoad={handleLayoutLoad}
        onWorkdirWarning={handleWorkdirWarning}
        activeLayoutId={activeLayoutId}
        layoutDirty={layoutDirty}
        onSaveLayout={handleSaveLayout}
        onNewLayout={() => setShowSaveDialog(true)}
        refreshTrigger={layoutRefreshKey}
      />

      {/* Toast 通知 */}
      {toasts.map((t) => (
        <Toast
          key={t.id}
          message={t.message}
          type={t.type}
          onDismiss={() => removeToast(t.id)}
        />
      ))}
    </div>
  );
}

export default App;
