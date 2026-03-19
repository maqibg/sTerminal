import React, { useState, useCallback, useRef } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";

interface ConfirmOptions {
  message: string;
  title?: string;
  confirmText?: string;
  cancelText?: string;
  kind?: "info" | "warning" | "danger";
}

type ResolveFn = (value: boolean) => void;

/**
 * 命令式确认弹窗 hook。
 *
 * 用法：
 * ```
 * const [confirm, ConfirmPortal] = useConfirm();
 * const ok = await confirm({ message: "确认删除？", title: "删除", kind: "danger" });
 * // 在 JSX 中渲染 <ConfirmPortal />
 * ```
 */
export function useConfirm(): [
  (options: ConfirmOptions) => Promise<boolean>,
  React.FC,
] {
  const [state, setState] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<ResolveFn | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState(options);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    resolveRef.current?.(true);
    resolveRef.current = null;
    setState(null);
  }, []);

  const handleCancel = useCallback(() => {
    resolveRef.current?.(false);
    resolveRef.current = null;
    setState(null);
  }, []);

  const Portal: React.FC = useCallback(
    () =>
      state ? (
        <ConfirmDialog
          message={state.message}
          title={state.title}
          confirmText={state.confirmText}
          cancelText={state.cancelText}
          kind={state.kind}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      ) : null,
    [state, handleConfirm, handleCancel]
  );

  return [confirm, Portal];
}
