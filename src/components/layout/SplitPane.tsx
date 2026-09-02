import React, { useRef, useCallback, useMemo } from "react";
import type { SplitNode } from "../../types/layout";
import type { SplitPath } from "../../utils/layoutTree";
import { SplitHandle } from "./SplitHandle";
import { SplitPreviewLine } from "./SplitPreviewLine";
import { useResize } from "../../hooks/useResize";
import { useLayoutStore } from "../../store/layoutStore";
import { LayoutRenderer } from "./LayoutRenderer";

interface SplitPaneProps {
  node: SplitNode;
  /** 本节点在布局树中的路径（根节点为空数组） */
  path: SplitPath;
}

/**
 * 分割节点渲染组件。
 * - horizontal：flex-row，first 在左，second 在右
 * - vertical：flex-column，first 在上，second 在下
 * 根据 ratio 计算两个子节点的 flex-basis 百分比。
 */
export function SplitPane({ node, path }: SplitPaneProps) {
  const { direction, ratio, first, second } = node;
  const containerRef = useRef<HTMLDivElement>(null);
  const updateSplitRatio = useLayoutStore((s) => s.updateSplitRatio);

  // 子节点路径：本节点路径 + 走向
  const firstPath = useMemo<SplitPath>(() => [...path, "first"], [path]);
  const secondPath = useMemo<SplitPath>(() => [...path, "second"], [path]);

  // 用路径定位本 split 节点。不能用"first 子树最左叶子 id"——嵌套 split
  // 时父子会算出同一个 id，导致拖父分割线实际改了子分割线的 ratio。
  const handleRatioChange = useCallback(
    (newRatio: number) => {
      updateSplitRatio(path, newRatio);
    },
    [updateSplitRatio, path]
  );

  const { handleMouseDown, previewRatio } = useResize(
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
    // 预览线绝对定位的参照
    position: "relative",
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
        <LayoutRenderer node={first} path={firstPath} />
      </div>
      <SplitHandle direction={direction} onMouseDown={handleMouseDown} />
      <div style={secondStyle}>
        <LayoutRenderer node={second} path={secondPath} />
      </div>
      {previewRatio !== null && (
        <>
          {/* 拖拽期间覆盖终端 canvas，避免 xterm 抢走鼠标（起始选区等） */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 15,
              cursor: isHorizontal ? "col-resize" : "row-resize",
            }}
          />
          <SplitPreviewLine direction={direction} ratio={previewRatio} />
        </>
      )}
    </div>
  );
}
