import React, { useCallback, useRef, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";

interface ConfirmOptions {
  message: string;
  title?: string;
  kind?: "info" | "warning" | "danger";
  confirmText?: string;
  cancelText?: string;
}

export function useConfirm(): [
  (options: ConfirmOptions) => Promise<boolean>,
  React.FC,
] {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((nextOptions: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOptions(nextOptions);
    });
  }, []);

  const close = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  const Portal: React.FC = useCallback(
    () =>
      options ? (
        <ConfirmDialog
          {...options}
          onConfirm={() => close(true)}
          onCancel={() => close(false)}
        />
      ) : null,
    [close, options]
  );

  return [confirm, Portal];
}
