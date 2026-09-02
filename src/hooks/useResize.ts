import {
  useCallback,
  useRef,
  useState,
  useEffect,
  type RefObject,
  type MouseEvent as ReactMouseEvent,
} from "react";

/** 拖拽中的预览比例；null 表示未在拖拽 */
export type PreviewRatio = number | null;

/**
 * 分割线拖拽 hook（预览线模式）。
 *
 * 拖拽过程中【不】更新布局树，只返回一个 previewRatio 供调用方画预览线，
 * 松开鼠标才提交最终比例。这样一次拖拽只触发一次终端 resize，而不是每帧一次。
 *
 * 之所以这么做：每帧提交会导致每帧都走
 * 布局树更新 → 容器尺寸变化 → fitAddon.fit() → xterm onResize
 * → clearTextureAtlas + PTY resize IPC，
 * 拖两秒就是上百次图集重建和上百个 IPC 往返。既卡顿，也让纹理图集长时间
 * 停留在"刚清空、尚未重建"的脆弱窗口里，容易看到字形错乱。
 *
 * @param direction 分割方向：horizontal（左右分割，拖拽调整水平比例）
 *                           vertical（上下分割，拖拽调整垂直比例）
 * @param currentRatio 当前比例（[0.1, 0.9]）
 * @param onRatioChange 比例提交回调，仅在 mouseup 时触发一次
 * @param containerRef 父容器 ref，用于计算相对位置
 */
export function useResize(
  direction: "horizontal" | "vertical",
  currentRatio: number,
  onRatioChange: (newRatio: number) => void,
  containerRef: RefObject<HTMLElement | null>
): {
  handleMouseDown: (e: ReactMouseEvent) => void;
  /** 拖拽中的预览比例，null 表示未拖拽 */
  previewRatio: PreviewRatio;
} {
  const [previewRatio, setPreviewRatio] = useState<PreviewRatio>(null);

  const isDragging = useRef(false);
  const startPos = useRef(0);
  const startRatio = useRef(currentRatio);
  const rafId = useRef<number | null>(null);
  const pendingRatio = useRef<number | null>(null);
  /** 最近一次计算出的比例，mouseup 时提交它 */
  const latestRatio = useRef<number | null>(null);

  // 事件监听函数存 ref：mousedown 时注册、mouseup 时注销，
  // 必须是同一个引用，否则 removeEventListener 摘不掉。
  const moveHandlerRef = useRef<((e: MouseEvent) => void) | null>(null);
  const upHandlerRef = useRef<((e: MouseEvent) => void) | null>(null);

  const clamp = (value: number) => Math.min(0.9, Math.max(0.1, value));

  /** 把鼠标位置换算成比例 */
  const ratioFromEvent = useCallback(
    (e: MouseEvent): number | null => {
      const container = containerRef.current;
      if (!container) return null;

      const rect = container.getBoundingClientRect();
      const containerSize =
        direction === "horizontal" ? rect.width : rect.height;
      if (containerSize === 0) return null;

      const currentPos = direction === "horizontal" ? e.clientX : e.clientY;
      const delta = currentPos - startPos.current;
      return clamp(startRatio.current + delta / containerSize);
    },
    [direction, containerRef]
  );

  /** 结束拖拽：清理监听与全局样式 */
  const stopDragging = useCallback(() => {
    isDragging.current = false;

    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
    pendingRatio.current = null;

    if (moveHandlerRef.current) {
      document.removeEventListener("mousemove", moveHandlerRef.current);
      moveHandlerRef.current = null;
    }
    if (upHandlerRef.current) {
      document.removeEventListener("mouseup", upHandlerRef.current);
      upHandlerRef.current = null;
    }

    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    setPreviewRatio(null);
  }, []);

  const handleMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();

      isDragging.current = true;
      startPos.current = direction === "horizontal" ? e.clientX : e.clientY;
      startRatio.current = currentRatio;
      pendingRatio.current = null;
      latestRatio.current = null;
      setPreviewRatio(currentRatio);

      // 拖拽时禁止文本选中，设置全局 cursor
      document.body.style.cursor =
        direction === "horizontal" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";

      // rAF 节流：预览线位置每帧最多更新一次
      const flushPreview = () => {
        rafId.current = null;
        if (pendingRatio.current === null) return;
        setPreviewRatio(pendingRatio.current);
        pendingRatio.current = null;
      };

      const onMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const next = ratioFromEvent(ev);
        if (next === null) return;

        latestRatio.current = next;
        pendingRatio.current = next;
        if (rafId.current === null) {
          rafId.current = requestAnimationFrame(flushPreview);
        }
      };

      const onUp = (ev: MouseEvent) => {
        if (!isDragging.current) return;

        // 优先用 mouseup 自身的位置，失败则回退到最近一次 move 的结果
        const final = ratioFromEvent(ev) ?? latestRatio.current;

        stopDragging();

        // 提交放在 stopDragging 之后：先撤掉预览线再让布局树更新，
        // 避免同一帧里预览线和真实分割线同时可见造成闪烁。
        if (final !== null && final !== startRatio.current) {
          onRatioChange(final);
        }
      };

      moveHandlerRef.current = onMove;
      upHandlerRef.current = onUp;
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [direction, currentRatio, ratioFromEvent, stopDragging, onRatioChange]
  );

  // 组件卸载时兜底清理（拖拽中面板被关闭 / 布局被切换）
  useEffect(() => stopDragging, [stopDragging]);

  return { handleMouseDown, previewRatio };
}
