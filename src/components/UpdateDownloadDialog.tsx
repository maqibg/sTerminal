import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { UpdateInfo } from "../utils/updateChecker";

interface UpdateDownloadDialogProps {
  updateInfo: UpdateInfo;
  onClose: () => void;
}

type DownloadState = "idle" | "downloading" | "success" | "error";

export const UpdateDownloadDialog: React.FC<UpdateDownloadDialogProps> = ({
  updateInfo,
  onClose,
}) => {
  const [state, setState] = useState<DownloadState>("idle");
  const [progress, setProgress] = useState({ downloaded: 0, total: 0 });
  const [error, setError] = useState("");
  const [filePath, setFilePath] = useState("");

  useEffect(() => {
    const unlisten = listen<{ downloaded: number; total: number }>(
      "download-progress",
      (event) => {
        setProgress(event.payload);
      }
    );
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleDownload = async () => {
    if (!updateInfo.downloadUrl) {
      setError("无可用下载链接");
      setState("error");
      return;
    }

    setState("downloading");
    setError("");

    try {
      const path = await invoke<string>("download_update", {
        url: updateInfo.downloadUrl,
        filename: updateInfo.fileName,
      });
      setFilePath(path);
      setState("success");
    } catch (err) {
      setError(String(err));
      setState("error");
    }
  };

  const handleOpenFile = async () => {
    try {
      await invoke("open_file", { path: filePath });
    } catch (err) {
      setError(`打开失败: ${err}`);
    }
  };

  const handleGoToGitHub = () => {
    openUrl(updateInfo.releaseUrl);
    onClose();
  };

  const progressPercent =
    progress.total > 0 ? (progress.downloaded / progress.total) * 100 : 0;

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={dialogStyle}>
        <h3 style={titleStyle}>发现新版本</h3>
        <p style={infoStyle}>
          当前版本：v{updateInfo.currentVersion}
          <br />
          最新版本：v{updateInfo.latestVersion}
        </p>

        {state === "idle" && (
          <>
            <p style={hintStyle}>
              {updateInfo.downloadUrl
                ? "点击下载按钮开始下载更新"
                : "无可用下载链接，请前往 GitHub"}
            </p>
            <div style={actionsStyle}>
              <button onClick={onClose} style={btnStyle}>
                取消
              </button>
              {updateInfo.downloadUrl ? (
                <button onClick={handleDownload} style={primaryBtnStyle}>
                  下载更新
                </button>
              ) : (
                <button onClick={handleGoToGitHub} style={primaryBtnStyle}>
                  前往 GitHub
                </button>
              )}
            </div>
          </>
        )}

        {state === "downloading" && (
          <>
            <div style={progressBarBgStyle}>
              <div
                style={{ ...progressBarFillStyle, width: `${progressPercent}%` }}
              />
            </div>
            <p style={progressTextStyle}>
              {(progress.downloaded / 1024 / 1024).toFixed(1)} MB /{" "}
              {(progress.total / 1024 / 1024).toFixed(1)} MB ({progressPercent.toFixed(0)}%)
            </p>
          </>
        )}

        {state === "success" && (
          <>
            <p style={successStyle}>✓ 下载完成</p>
            <p style={hintStyle}>文件已保存至：{filePath}</p>
            <div style={actionsStyle}>
              <button onClick={onClose} style={btnStyle}>
                关闭
              </button>
              <button onClick={handleOpenFile} style={primaryBtnStyle}>
                打开安装包
              </button>
            </div>
          </>
        )}

        {state === "error" && (
          <>
            <p style={errorStyle}>✗ 下载失败</p>
            <p style={hintStyle}>{error}</p>
            <div style={actionsStyle}>
              <button onClick={onClose} style={btnStyle}>
                关闭
              </button>
              <button onClick={handleGoToGitHub} style={primaryBtnStyle}>
                前往 GitHub 下载
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 20000,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const dialogStyle: React.CSSProperties = {
  background: "#252525",
  border: "1px solid #333",
  borderRadius: 8,
  padding: "20px 24px",
  minWidth: 400,
  maxWidth: 500,
};

const titleStyle: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: 14,
  fontWeight: 600,
  color: "#60a5fa",
};

const infoStyle: React.CSSProperties = {
  margin: "0 0 16px",
  fontSize: 13,
  color: "#ccc",
  lineHeight: 1.6,
};

const hintStyle: React.CSSProperties = {
  margin: "0 0 16px",
  fontSize: 12,
  color: "#999",
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
};

const btnStyle: React.CSSProperties = {
  padding: "6px 16px",
  fontSize: 12,
  borderRadius: 4,
  cursor: "pointer",
  background: "#333",
  color: "#e0e0e0",
  border: "1px solid #444",
};

const primaryBtnStyle: React.CSSProperties = {
  ...btnStyle,
  background: "#3b82f6",
  color: "#fff",
  border: "1px solid #3b82f6",
};

const progressBarBgStyle: React.CSSProperties = {
  width: "100%",
  height: 8,
  background: "#333",
  borderRadius: 4,
  overflow: "hidden",
  marginBottom: 8,
};

const progressBarFillStyle: React.CSSProperties = {
  height: "100%",
  background: "linear-gradient(90deg, #3b82f6, #60a5fa)",
  transition: "width 0.3s ease",
};

const progressTextStyle: React.CSSProperties = {
  margin: "0 0 16px",
  fontSize: 12,
  color: "#999",
  textAlign: "center",
};

const successStyle: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: 14,
  color: "#4ade80",
  fontWeight: 600,
};

const errorStyle: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: 14,
  color: "#f87171",
  fontWeight: 600,
};
