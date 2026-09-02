import type { LayoutNode } from "../../types/layout";
import type { SplitPath } from "../../utils/layoutTree";
import { SplitPane } from "./SplitPane";
import { PanelContainer } from "./PanelContainer";
import { TerminalPane } from "../terminal/TerminalPane";

interface LayoutRendererProps {
  node: LayoutNode;
  /** 本节点在布局树中的路径，根节点省略（等价于空数组） */
  path?: SplitPath;
}

const ROOT_PATH: SplitPath = [];

/**
 * 递归渲染 LayoutNode 二叉树的入口组件。
 * - SplitNode → SplitPane（递归渲染两个子节点）
 * - TerminalLeaf → PanelContainer（叶子面板容器，内含 TerminalPane）
 */
export function LayoutRenderer({ node, path = ROOT_PATH }: LayoutRendererProps) {
  if (node.type === "split") {
    return <SplitPane node={node} path={path} />;
  }

  return (
    <PanelContainer node={node}>
      <TerminalPane leaf={node} />
    </PanelContainer>
  );
}
