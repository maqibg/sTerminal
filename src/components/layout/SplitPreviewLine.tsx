import React from "react";

interface SplitPreviewLineProps {
  direction: "horizontal" | "vertical";
  /** 预览线位置占容器的比例 [0, 1] */
  ratio: number;
}

/**
 * 拖拽分割线时显示的位置预览线。
 *
 * 拖拽过程中只移动这条线，不动真实布局——松开鼠标才提交比例。
 * 绝对定位在 SplitPane 容器内，不参与 flex 布局，因此移动它不会
 * 引起子面板尺寸变化，也就不会触发终端 resize。
 */
export function SplitPreviewLine({ direction, ratio }: SplitPreviewLineProps) {
  const isHorizontal = direction === "horizontal";
  const percent = `${ratio * 100}%`;

  const style: React.CSSProperties = {
    position: "absolute",
    backgroundColor: "var(--split-preview)",
    // 盖在终端 canvas 之上（SplitHandle 是 10）
    zIndex: 20,
    pointerEvents: "none",
    ...(isHorizontal
      ? { top: 0, bottom: 0, left: percent, width: "2px", transform: "translateX(-1px)" }
      : { left: 0, right: 0, top: percent, height: "2px", transform: "translateY(-1px)" }),
  };

  return <div style={style} />;
}
