use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use crate::pty::manager::PtyManager;

// ============================================================
// 数据结构定义（对应前端 ShellInfo / TerminalOutputEvent / TerminalExitEvent）
// ============================================================

/// Shell 信息，对应前端 ShellInfo
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellInfo {
    /// Shell 类型标识符，小写，如 "powershell" | "cmd" | "bash" | "zsh"
    #[serde(rename = "type")]
    pub shell_type: String,
    /// 用户可见的显示名称，如 "PowerShell 7"
    #[serde(rename = "displayName")]
    pub display_name: String,
    /// Shell 可执行文件完整绝对路径
    pub path: String,
    /// 是否为系统默认 Shell
    #[serde(rename = "isDefault")]
    pub is_default: bool,
}

/// terminal:output 事件 Payload，对应前端 TerminalOutputEvent
#[derive(Debug, Clone, Serialize)]
pub struct TerminalOutputEvent {
    /// 产生输出的终端 ID
    #[serde(rename = "terminalId")]
    pub terminal_id: String,
    /// PTY 输出字节数组（JSON 序列化为 number[]）
    pub data: Vec<u8>,
}

/// terminal:exit 事件 Payload，对应前端 TerminalExitEvent
#[derive(Debug, Clone, Serialize)]
pub struct TerminalExitEvent {
    /// 退出的终端 ID
    #[serde(rename = "terminalId")]
    pub terminal_id: String,
    /// 进程退出码；0 表示正常退出
    #[serde(rename = "exitCode")]
    pub exit_code: i32,
}

/// Windows 下 xterm 需要的 PTY 兼容信息
#[derive(Debug, Clone, Serialize)]
pub struct WindowsPtyInfo {
    pub backend: String,
    #[serde(rename = "buildNumber")]
    pub build_number: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ClipboardPastePayload {
    pub text: String,
    #[serde(rename = "contentType")]
    pub content_type: String,
}

// ============================================================
// Tauri Commands（DEV-A 负责 terminal_create / terminal_kill）
// ============================================================

/// 创建一个新的 PTY 进程，返回分配的终端 ID
///
/// # 参数
/// - `shell_path`: Shell 可执行文件的完整路径
/// - `working_directory`: 初始工作目录的绝对路径；若目录不存在则回退到用户 Home 目录
/// - `cols`: 终端列数，最小 10，最大 512
/// - `rows`: 终端行数，最小 5，最大 256
///
/// # 返回
/// - `Ok(String)`: 新建终端的唯一 ID（UUID v4 格式）
/// - `Err(String)`: 错误原因描述（如 shell 不存在、PTY 创建失败）
#[tauri::command]
pub async fn terminal_create(
    shell_path: String,
    working_directory: String,
    cols: u16,
    rows: u16,
    app: AppHandle,
    state: State<'_, PtyManager>,
) -> Result<String, String> {
    state.create(shell_path, working_directory, cols, rows, app).await
}

/// 向指定终端的 PTY 进程写入数据（用户键盘输入）
/// DEV-B 实现：补全 PtyManager::write 调用
#[tauri::command]
pub async fn terminal_write(
    terminal_id: String,
    data: Vec<u8>,
    state: State<'_, PtyManager>,
) -> Result<(), String> {
    state.write(&terminal_id, data).await
}

/// 调整指定终端的 PTY 窗口大小，同步发送 SIGWINCH 信号
/// DEV-B 实现：补全 PtyManager::resize 调用
#[tauri::command]
pub async fn terminal_resize(
    terminal_id: String,
    cols: u16,
    rows: u16,
    state: State<'_, PtyManager>,
) -> Result<(), String> {
    state.resize(&terminal_id, cols, rows).await
}

/// 终止指定终端的 PTY 进程并从注册表中移除
#[tauri::command]
pub async fn terminal_kill(
    terminal_id: String,
    state: State<'_, PtyManager>,
) -> Result<(), String> {
    state.kill(&terminal_id).await
}

/// 获取指定终端进程的当前工作目录
/// DEV-B 实现：补全 PtyManager::get_cwd 调用
#[tauri::command]
pub async fn terminal_get_cwd(
    terminal_id: String,
    state: State<'_, PtyManager>,
) -> Result<String, String> {
    state.get_cwd(&terminal_id).await
}

/// 列出当前系统上可用的 Shell 可执行路径列表
/// DEV-B 实现：调用 shell::detector::detect_available_shells
#[tauri::command]
pub async fn shell_list_available() -> Result<Vec<ShellInfo>, String> {
    let shells = crate::shell::detector::detect_available_shells()?;
    Ok(shells
        .into_iter()
        .map(|s| ShellInfo {
            shell_type: s.shell_type,
            display_name: s.display_name,
            path: s.path,
            is_default: s.is_default,
        })
        .collect())
}

/// 选择终端可执行文件
#[tauri::command]
pub async fn terminal_pick_executable() -> Result<Option<String>, String> {
    Ok(rfd::FileDialog::new()
        .set_title("选择终端可执行文件")
        .add_filter("Executables", &["exe", "cmd", "bat", "com", "ps1", "sh"])
        .pick_file()
        .map(|path| path.to_string_lossy().to_string()))
}

/// 选择终端启动目录
#[tauri::command]
pub async fn terminal_pick_directory() -> Result<Option<String>, String> {
    Ok(rfd::FileDialog::new()
        .set_title("选择终端启动目录")
        .pick_folder()
        .map(|path| path.to_string_lossy().to_string()))
}

/// 列出当前系统可用字体名称
#[tauri::command]
pub async fn terminal_list_fonts() -> Result<Vec<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::collections::BTreeSet;
        use winreg::enums::HKEY_LOCAL_MACHINE;
        use winreg::RegKey;

        let key = RegKey::predef(HKEY_LOCAL_MACHINE)
            .open_subkey("SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts")
            .map_err(|e| format!("Failed to open Windows fonts registry: {}", e))?;

        let mut fonts = BTreeSet::new();
        for item in key.enum_values() {
            let Ok((name, _)) = item else {
                continue;
            };
            let normalized = name
                .replace(" (TrueType)", "")
                .replace(" (OpenType)", "")
                .replace(" (All res)", "")
                .replace(" (Variable TrueType)", "")
                .trim()
                .to_string();
            if !normalized.is_empty() {
                fonts.insert(normalized);
            }
        }

        return Ok(fonts.into_iter().collect());
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(Vec::new())
    }
}

/// 获取当前系统的 Windows PTY 兼容信息
#[tauri::command]
pub async fn terminal_get_windows_pty_info() -> Result<Option<WindowsPtyInfo>, String> {
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::HKEY_LOCAL_MACHINE;
        use winreg::RegKey;

        let key = RegKey::predef(HKEY_LOCAL_MACHINE)
            .open_subkey("SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion")
            .map_err(|e| format!("Failed to open Windows version registry: {}", e))?;

        let build_number = key
            .get_value::<String, _>("CurrentBuildNumber")
            .ok()
            .and_then(|value| value.parse::<u32>().ok())
            .or_else(|| {
                key.get_value::<String, _>("CurrentBuild")
                    .ok()
                    .and_then(|value| value.parse::<u32>().ok())
            });

        return Ok(Some(WindowsPtyInfo {
            backend: "conpty".to_string(),
            build_number,
        }));
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(None)
    }
}

/// 准备一份适合写入终端的剪贴板内容
#[tauri::command]
pub async fn terminal_prepare_clipboard_paste() -> Result<Option<ClipboardPastePayload>, String> {
    let mut clipboard =
        arboard::Clipboard::new().map_err(|e| format!("Clipboard unavailable: {}", e))?;

    if let Ok(files) = clipboard.get().file_list() {
        if !files.is_empty() {
            let text = files
                .into_iter()
                .map(|path| quote_shell_argument(&path))
                .collect::<Vec<_>>()
                .join(" ");

            return Ok(Some(ClipboardPastePayload {
                text,
                content_type: "files".to_string(),
            }));
        }
    }

    if let Ok(image) = clipboard.get_image() {
        let data_dir = resolve_clipboard_data_dir()?;
        std::fs::create_dir_all(&data_dir)
            .map_err(|e| format!("Failed to create clipboard data directory: {}", e))?;
        let file_path = data_dir.join(format!("clipboard-{}.png", uuid::Uuid::new_v4()));

        let rgba = image::RgbaImage::from_raw(
            image.width as u32,
            image.height as u32,
            image.bytes.into_owned(),
        )
        .ok_or_else(|| "Clipboard image data is invalid".to_string())?;

        image::DynamicImage::ImageRgba8(rgba)
            .save_with_format(&file_path, image::ImageFormat::Png)
            .map_err(|e| format!("Failed to encode clipboard image: {}", e))?;

        return Ok(Some(ClipboardPastePayload {
            text: quote_shell_argument(&file_path),
            content_type: "image".to_string(),
        }));
    }

    match clipboard.get_text() {
        Ok(text) if !text.is_empty() => Ok(Some(ClipboardPastePayload {
            text,
            content_type: "text".to_string(),
        })),
        Ok(_) => Ok(None),
        Err(err) => Err(format!("Clipboard text unavailable: {}", err)),
    }
}

fn resolve_clipboard_data_dir() -> Result<std::path::PathBuf, String> {
    let exe_path =
        std::env::current_exe().map_err(|e| format!("Failed to resolve current exe: {}", e))?;
    let exe_dir = exe_path
        .parent()
        .ok_or_else(|| format!("Executable has no parent directory: {}", exe_path.display()))?;
    Ok(exe_dir.join("data").join("clipboard"))
}

fn quote_shell_argument(path: &std::path::Path) -> String {
    let text = path.to_string_lossy();
    if text.contains([' ', '\t', '"']) {
        format!("\"{}\"", text.replace('"', "\\\""))
    } else {
        text.to_string()
    }
}
