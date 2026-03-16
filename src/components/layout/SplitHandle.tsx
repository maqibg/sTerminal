import React, { useState } from "react";

interface SplitHandleProps {
  direction: "horizontal" | "vertical";
  onMouseDown: (e: React.MouseEvent) => void;
}

/**
 * 可拖拽分割线组件。
 * - horizontal：4px 宽的竖线（左右分割）
 * - vertical：4px 高的横线（上下分割）
 */
export function SplitHandle({ direction, onMouseDown }: SplitHandleProps) {
  const [isHovered, setIsHovered] = useState(false);

  const isHorizontal = direction === "horizontal";

  const style: React.CSSProperties = {
    flexShrink: 0,
    width: isHorizontal ? "4px" : "100%",
    height: isHorizontal ? "100%" : "4px",
    backgroundColor: isHovered
      ? "var(--split-handle-hover)"
      : "var(--split-handle)",
    cursor: isHorizontal ? "col-resize" : "row-resize",
    transition: "background-color var(--transition-fast)",
    zIndex: 10,
    position: "relative",
  };

  return (
    <div
      style={style}
      onMouseDown={onMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    />
  );
}
