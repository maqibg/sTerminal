import { useCallback, useRef, type RefObject, type MouseEvent as ReactMouseEvent } from "react";

/**
 * 分割线拖拽 hook。
 *
 * @param direction 分割方向：horizontal（左右分割，拖拽调整水平比例）
 *                           vertical（上下分割，拖拽调整垂直比例）
 * @param currentRatio 当前比例（[0.1, 0.9]）
 * @param onRatioChange 比例变化回调，由 mouseup 和 rAF 节流 mousemove 触发
 * @param containerRef 父容器 ref，用于计算相对位置
 */
export function useResize(
  direction: "horizontal" | "vertical",
  currentRatio: number,
  onRatioChange: (newRatio: number) => void,
  containerRef: RefObject<HTMLElement | null>
): { handleMouseDown: (e: ReactMouseEvent) => void } {
  const isDragging = useRef(false);
  const startPos = useRef(0);
  const startRatio = useRef(currentRatio);
  const rafId = useRef<number | null>(null);
  const pendingRatio = useRef<number | null>(null);

  const clamp = (value: number) => Math.min(0.9, Math.max(0.1, value));

  const applyRatio = useCallback(() => {
    if (pendingRatio.current !== null) {
      onRatioChange(pendingRatio.current);
      pendingRatio.current = null;
    }
    rafId.current = null;
  }, [onRatioChange]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const containerSize =
        direction === "horizontal" ? rect.width : rect.height;

      if (containerSize === 0) return;

      const currentPos =
        direction === "horizontal" ? e.clientX : e.clientY;
      const delta = currentPos - startPos.current;
      const deltaRatio = delta / containerSize;
      const newRatio = clamp(startRatio.current + deltaRatio);

      // rAF 节流：只在下一帧执行状态更新
      pendingRatio.current = newRatio;
      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(applyRatio);
      }
    },
    [direction, containerRef, applyRatio]
  );

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;

      // 取消未执行的 rAF
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }

      // 触发最终的 ratio 更新
      if (containerRef.current) {
        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        const containerSize =
          direction === "horizontal" ? rect.width : rect.height;

        if (containerSize > 0) {
          const currentPos =
            direction === "horizontal" ? e.clientX : e.clientY;
          const delta = currentPos - startPos.current;
          const deltaRatio = delta / containerSize;
          const finalRatio = clamp(startRatio.current + deltaRatio);
          onRatioChange(finalRatio);
        }
      }

      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    },
    [direction, containerRef, onRatioChange, handleMouseMove]
  );

  const handleMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      startPos.current = direction === "horizontal" ? e.clientX : e.clientY;
      startRatio.current = currentRatio;
      pendingRatio.current = null;

      // 拖拽时禁止文本选中，设置全局 cursor
      document.body.style.cursor =
        direction === "horizontal" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [direction, currentRatio, handleMouseMove, handleMouseUp]
  );

  return { handleMouseDown };
}
