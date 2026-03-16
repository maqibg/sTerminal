import React, { useRef } from "react";
import type { SplitNode } from "../../types/layout";
import { SplitHandle } from "./SplitHandle";
import { useResize } from "../../hooks/useResize";
import { useLayoutStore } from "../../store/layoutStore";
import { LayoutRenderer } from "./LayoutRenderer";

interface SplitPaneProps {
  node: SplitNode;
}

/**
 * 分割节点渲染组件。
 * - horizontal：flex-row，first 在左，second 在右
 * - vertical：flex-column，first 在上，second 在下
 * 根据 ratio 计算两个子节点的 flex-basis 百分比。
 */
export function SplitPane({ node }: SplitPaneProps) {
  const { direction, ratio, first, second } = node;
  const containerRef = useRef<HTMLDivElement>(null);
  const updateSplitRatio = useLayoutStore((s) => s.updateSplitRatio);

  // 定位 split 节点用 first 子叶子的 id
  // 若 first 是叶子直接用其 id；若是 split 则递归取最左叶子 id
  const getFirstLeafId = (n: typeof first): string => {
    if (n.type === "terminal") return n.id;
    return getFirstLeafId(n.first);
  };
  const splitAnchorId = getFirstLeafId(first);

  const handleRatioChange = (newRatio: number) => {
    updateSplitRatio(splitAnchorId, newRatio);
  };

  const { handleMouseDown } = useResize(
    direction,
    ratio,
    handleRatioChange,
    containerRef
  );

  const isHorizontal = direction === "horizontal";

  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: isHorizontal ? "row" : "column",
    width: "100%",
    height: "100%",
    overflow: "hidden",
  };

  const firstStyle: React.CSSProperties = {
    flex: `0 0 calc(${ratio * 100}% - 2px)`,
    overflow: "hidden",
    minWidth: isHorizontal ? "80px" : undefined,
    minHeight: isHorizontal ? undefined : "80px",
  };

  const secondStyle: React.CSSProperties = {
    flex: `1 1 0`,
    overflow: "hidden",
    minWidth: isHorizontal ? "80px" : undefined,
    minHeight: isHorizontal ? undefined : "80px",
  };

  return (
    <div ref={containerRef} style={containerStyle}>
      <div style={firstStyle}>
        <LayoutRenderer node={first} />
      </div>
      <SplitHandle direction={direction} onMouseDown={handleMouseDown} />
      <div style={secondStyle}>
        <LayoutRenderer node={second} />
      </div>
    </div>
  );
}
