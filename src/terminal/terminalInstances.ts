/**
 * 终端实例缓存
 *
 * 将 xterm + PTY 生命周期从 React 组件中解耦。
 * 组件 mount/unmount 只做 DOM 挂载/卸载，不销毁终端实例。
 * 终端仅在 tab 关闭或显式 restart 时才销毁。
 */

import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { listen } from "@tauri-apps/api/event";
import "@xterm/xterm/css/xterm.css";
import {
  terminalCreate,
  terminalWrite,
  terminalResize,
  terminalKill,
} from "../ipc/terminalApi";
import { getTerminalAppearanceSettings } from "../store/appSettingsStore";
import type {
  TerminalOutputEvent,
  TerminalExitEvent,
} from "../types/terminal";

export interface ManagedTerminal {
  sessionId: string;
  /** 持久 DOM 容器，xterm 渲染在这里，会被 reparent 到不同的 host */
  container: HTMLDivElement;
  terminal: Terminal;
  fitAddon: FitAddon;
  terminalId: string | null;
  isAlive: boolean;
  exitCode: number | undefined;
  outputQueue: Uint8Array[];
  queuedOutputBytes: number;
  flushRafId: number | null;
  flushTimerId: ReturnType<typeof setTimeout> | null;
}

/** session ID → 实例 */
const cache = new Map<string, ManagedTerminal>();
/** terminal ID → 实例 */
const terminalsById = new Map<string, ManagedTerminal>();
/** session ID → 清理函数 */
const cleanupFns = new Map<string, () => void>();
/** session ID → 延迟销毁定时器 */
const pendingDestroy = new Map<string, ReturnType<typeof setTimeout>>();
/** session ID → 状态变更监听器 */
const stateListeners = new Map<string, Set<() => void>>();
/** terminal ID → 绑定实例前缓存的启动早期输出 */
const pendingOutput = new Map<string, Uint8Array[]>();
/** terminal ID → 绑定实例前收到的退出码 */
const pendingExit = new Map<string, number>();
/** 已关闭终端 ID，用来忽略 kill 之后迟到的事件 */
const closedTerminalIds = new Set<string>();

let eventBridgePromise: Promise<void> | null = null;

/** 组件 detach 后等待多久才真正销毁（ms） */
const DESTROY_DELAY = 5_000;
/** 正常情况下每帧最多 flush 一次；隐藏窗口时由 timeout 兜底 */
const OUTPUT_FLUSH_INTERVAL_MS = 16;
/** 防止前端输出队列在长文本洪峰时无限增长 */
const MAX_QUEUED_OUTPUT_BYTES = 256 * 1024;

function notifyListeners(sessionId: string) {
  stateListeners.get(sessionId)?.forEach((fn) => fn());
}

function mergeChunks(chunks: Uint8Array[], totalBytes: number): Uint8Array {
  if (chunks.length === 1) {
    return chunks[0];
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  chunks.forEach((chunk) => {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return merged;
}

function clearFlushHandles(managed: ManagedTerminal) {
  if (managed.flushRafId !== null) {
    cancelAnimationFrame(managed.flushRafId);
    managed.flushRafId = null;
  }
  if (managed.flushTimerId !== null) {
    clearTimeout(managed.flushTimerId);
    managed.flushTimerId = null;
  }
}

function flushTerminalOutput(managed: ManagedTerminal) {
  if (managed.outputQueue.length === 0) return;

  const chunks = managed.outputQueue;
  const totalBytes = managed.queuedOutputBytes;
  managed.outputQueue = [];
  managed.queuedOutputBytes = 0;
  managed.terminal.write(mergeChunks(chunks, totalBytes));
}

function runFlush(managed: ManagedTerminal) {
  clearFlushHandles(managed);
  flushTerminalOutput(managed);
}

function scheduleFlush(managed: ManagedTerminal) {
  if (managed.flushRafId === null) {
    managed.flushRafId = requestAnimationFrame(() => {
      runFlush(managed);
    });
  }
  if (managed.flushTimerId === null) {
    managed.flushTimerId = setTimeout(() => {
      runFlush(managed);
    }, OUTPUT_FLUSH_INTERVAL_MS);
  }
}

function enqueueTerminalOutput(managed: ManagedTerminal, data: Uint8Array) {
  if (data.byteLength === 0) return;

  managed.outputQueue.push(data);
  managed.queuedOutputBytes += data.byteLength;

  if (managed.queuedOutputBytes >= MAX_QUEUED_OUTPUT_BYTES) {
    clearFlushHandles(managed);
    flushTerminalOutput(managed);
    return;
  }

  scheduleFlush(managed);
}

function enqueuePendingOutput(terminalId: string, data: Uint8Array) {
  const queue = pendingOutput.get(terminalId);
  if (queue) {
    queue.push(data);
    return;
  }
  pendingOutput.set(terminalId, [data]);
}

function flushPendingOutput(managed: ManagedTerminal) {
  const terminalId = managed.terminalId;
  if (!terminalId) return;

  const queue = pendingOutput.get(terminalId);
  if (queue) {
    pendingOutput.delete(terminalId);
    queue.forEach((chunk) => enqueueTerminalOutput(managed, chunk));
  }

  const exitCode = pendingExit.get(terminalId);
  if (exitCode !== undefined) {
    pendingExit.delete(terminalId);
    clearFlushHandles(managed);
    flushTerminalOutput(managed);
    managed.isAlive = false;
    managed.exitCode = exitCode;
    notifyListeners(managed.sessionId);
  }
}

function bindTerminalId(managed: ManagedTerminal, terminalId: string) {
  if (managed.terminalId && managed.terminalId !== terminalId) {
    terminalsById.delete(managed.terminalId);
  }

  closedTerminalIds.delete(terminalId);
  managed.terminalId = terminalId;
  terminalsById.set(terminalId, managed);
  flushPendingOutput(managed);
}

function ensureEventBridge() {
  if (eventBridgePromise) return eventBridgePromise;

  eventBridgePromise = Promise.all([
    listen<TerminalOutputEvent>("terminal:output", (event) => {
      if (closedTerminalIds.has(event.payload.terminalId)) {
        return;
      }
      const data = new Uint8Array(event.payload.data);
      const managed = terminalsById.get(event.payload.terminalId);
      if (managed) {
        enqueueTerminalOutput(managed, data);
        return;
      }
      enqueuePendingOutput(event.payload.terminalId, data);
    }),
    listen<TerminalExitEvent>("terminal:exit", (event) => {
      if (closedTerminalIds.has(event.payload.terminalId)) {
        return;
      }
      const managed = terminalsById.get(event.payload.terminalId);
      if (managed) {
        clearFlushHandles(managed);
        flushTerminalOutput(managed);
        managed.isAlive = false;
        managed.exitCode = event.payload.exitCode;
        notifyListeners(managed.sessionId);
        return;
      }
      pendingExit.set(event.payload.terminalId, event.payload.exitCode);
    }),
  ])
    .then(() => undefined)
    .catch((error) => {
      eventBridgePromise = null;
      throw error;
    });

  return eventBridgePromise;
}

export function applyTerminalAppearance(fontFamily: string, fontSize: number) {
  cache.forEach((managed) => {
    managed.terminal.options.fontFamily = fontFamily;
    managed.terminal.options.fontSize = fontSize;
    try {
      managed.fitAddon.fit();
    } catch {
      // ignore fit errors on hidden terminals
    }
  });
}

// ── 公共 API ──

/** 订阅终端状态变更（isAlive / exitCode） */
export function subscribeTerminal(
  sessionId: string,
  cb: () => void
): () => void {
  if (!stateListeners.has(sessionId)) {
    stateListeners.set(sessionId, new Set());
  }
  stateListeners.get(sessionId)!.add(cb);
  return () => {
    stateListeners.get(sessionId)?.delete(cb);
  };
}

/** 读取已缓存的终端（不创建） */
export function getTerminal(
  sessionId: string
): ManagedTerminal | undefined {
  return cache.get(sessionId);
}

/**
 * 获取或创建终端实例。
 * 如有缓存直接返回（取消 pending destroy）；否则新建 xterm + PTY。
 */
export function acquireTerminal(
  sessionId: string,
  shellPath: string,
  workingDirectory: string,
  startupCommand?: string
): ManagedTerminal {
  // 取消待销毁定时器
  const timer = pendingDestroy.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    pendingDestroy.delete(sessionId);
  }

  const existing = cache.get(sessionId);
  if (existing) return existing;

  // ── 创建持久 DOM 容器 ──
  const container = document.createElement("div");
  container.className = "terminal-container";
  container.style.cssText = "flex:1;overflow:hidden;min-height:0;";

  // ── 创建 xterm ──
  const appearance = getTerminalAppearanceSettings();
  const term = new Terminal({
    theme: {
      background: "#0d0d0d",
      foreground: "#e0e0e0",
      cursor: "#e0e0e0",
      cursorAccent: "#0d0d0d",
      black: "#1a1a1a",
      red: "#f87171",
      green: "#4ade80",
      yellow: "#facc15",
      blue: "#60a5fa",
      magenta: "#c084fc",
      cyan: "#34d399",
      white: "#e0e0e0",
      brightBlack: "#555",
      brightRed: "#fca5a5",
      brightGreen: "#86efac",
      brightYellow: "#fde047",
      brightBlue: "#93c5fd",
      brightMagenta: "#d8b4fe",
      brightCyan: "#6ee7b7",
      brightWhite: "#f5f5f5",
    },
    fontFamily: appearance.fontFamily,
    fontSize: appearance.fontSize,
    lineHeight: 1.2,
    letterSpacing: 0,
    cursorBlink: true,
    cursorStyle: "block",
    allowProposedApi: true,
    scrollback: 5000,
  });

  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.open(container);

  // 复制粘贴拦截（与 Windows Terminal 行为一致）
  const doPaste = () => {
    navigator.clipboard
      .readText()
      .then((text) => {
        if (text && managed.terminalId) {
          terminalWrite(
            managed.terminalId,
            new TextEncoder().encode(text)
          ).catch(console.error);
        }
      })
      .catch(console.error);
  };

  term.attachCustomKeyEventHandler((event) => {
    if (event.type !== "keydown") return true;

    if (event.ctrlKey && event.shiftKey) {
      // Ctrl+Shift+C → 复制
      if (event.code === "KeyC") {
        const selection = term.getSelection();
        if (selection)
          navigator.clipboard.writeText(selection).catch(console.error);
        return false;
      }
      // Ctrl+Shift+V → 粘贴
      if (event.code === "KeyV") {
        event.preventDefault(); // 阻止浏览器默认 paste 事件，避免双重粘贴
        doPaste();
        return false;
      }
    }

    if (event.ctrlKey && !event.shiftKey && !event.altKey) {
      // Ctrl+C → 有选区时复制，否则发送 SIGINT（默认行为）
      if (event.code === "KeyC" && term.hasSelection()) {
        navigator.clipboard
          .writeText(term.getSelection())
          .catch(console.error);
        term.clearSelection();
        return false;
      }
      // Ctrl+V → 粘贴（CMD 等不支持 Ctrl+Shift+V 的 shell）
      if (event.code === "KeyV") {
        event.preventDefault(); // 阻止浏览器默认 paste 事件，避免双重粘贴
        doPaste();
        return false;
      }
    }

    return true;
  });

  // WebGL addon（降级安全）
  try {
    const webglAddon = new WebglAddon();
    webglAddon.onContextLoss(() => webglAddon.dispose());
    term.loadAddon(webglAddon);
  } catch {
    // Canvas fallback
  }

  const managed: ManagedTerminal = {
    sessionId,
    container,
    terminal: term,
    fitAddon,
    terminalId: null,
    isAlive: true,
    exitCode: undefined,
    outputQueue: [],
    queuedOutputBytes: 0,
    flushRafId: null,
    flushTimerId: null,
  };

  cache.set(sessionId, managed);

  // ── 创建 PTY ──
  let destroyed = false;

  const init = async () => {
    try {
      await ensureEventBridge();
      const { cols, rows } = term;
      const id = await terminalCreate(
        shellPath,
        workingDirectory,
        cols,
        rows
      );
      if (destroyed) {
        terminalKill(id).catch(console.error);
        return;
      }
      bindTerminalId(managed, id);

      // 执行启动命令
      if (startupCommand) {
        setTimeout(() => {
          terminalWrite(id, new TextEncoder().encode(startupCommand + "\r")).catch(console.error);
        }, 300);
      }
    } catch (err) {
      console.error(
        `[terminalInstances] Failed to create PTY for ${sessionId}:`,
        err
      );
    }
  };

  init();

  // xterm → PTY write
  const dataDisposable = term.onData((data) => {
    const id = managed.terminalId;
    if (!id) return;
    terminalWrite(id, new TextEncoder().encode(data)).catch(console.error);
  });

  // xterm resize → PTY resize
  const resizeDisposable = term.onResize(({ cols, rows }) => {
    const id = managed.terminalId;
    if (!id) return;
    terminalResize(id, cols, rows).catch(console.error);
  });

  // 保存清理函数
  cleanupFns.set(sessionId, () => {
    destroyed = true;
    dataDisposable.dispose();
    resizeDisposable.dispose();
    clearFlushHandles(managed);
    const id = managed.terminalId;
    if (id) {
      closedTerminalIds.add(id);
      terminalsById.delete(id);
      pendingOutput.delete(id);
      pendingExit.delete(id);
      terminalKill(id).catch(console.error);
    }
    managed.outputQueue = [];
    managed.queuedOutputBytes = 0;
    term.dispose();
  });

  return managed;
}

/**
 * 从 DOM 分离终端容器，并延迟销毁。
 * 如果在 DESTROY_DELAY 内被 acquireTerminal 重新获取，则取消销毁。
 */
export function detachTerminal(sessionId: string) {
  const entry = cache.get(sessionId);
  if (entry?.container.parentElement) {
    entry.container.parentElement.removeChild(entry.container);
  }

  // 延迟销毁：给 React reconciliation 留出时间完成 remount
  const timer = setTimeout(() => {
    pendingDestroy.delete(sessionId);
    destroyTerminal(sessionId);
  }, DESTROY_DELAY);
  pendingDestroy.set(sessionId, timer);
}

/**
 * 立即销毁终端实例（tab 关闭 / restart 时调用）
 */
export function destroyTerminal(sessionId: string) {
  // 取消待销毁定时器
  const timer = pendingDestroy.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    pendingDestroy.delete(sessionId);
  }

  const cleanup = cleanupFns.get(sessionId);
  if (cleanup) cleanup();

  cleanupFns.delete(sessionId);
  cache.delete(sessionId);
  stateListeners.delete(sessionId);
}
