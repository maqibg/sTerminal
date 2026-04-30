/// 窗口相关命令：弹出 Windows 原生系统菜单

#[cfg(windows)]
#[tauri::command]
pub async fn show_system_menu(
    window: tauri::WebviewWindow,
    x: i32,
    y: i32,
) -> Result<(), String> {
    // DPI 缩放：x/y 是逻辑像素，需要转换为物理像素
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let px = (x as f64 * scale) as i32;
    let py = (y as f64 * scale) as i32;

    // 将窗口坐标转换为屏幕坐标
    let outer_pos = window.outer_position().map_err(|e| e.to_string())?;
    let screen_x = outer_pos.x + px;
    let screen_y = outer_pos.y + py;

    let is_maximized = window.is_maximized().unwrap_or(false);
    let is_minimized = window.is_minimized().unwrap_or(false);
    let is_resizable = window.is_resizable().unwrap_or(true);

    let hwnd_raw = window.hwnd().map_err(|e| e.to_string())?;
    let hwnd_ptr = hwnd_raw.0 as isize;

    // TrackPopupMenu 必须在窗口的 UI 线程上调用，投递到主线程执行
    let win_clone = window.clone();
    win_clone
        .run_on_main_thread(move || {
            use windows::Win32::Foundation::{HWND, LPARAM, WPARAM};
            use windows::Win32::UI::WindowsAndMessaging::{
                EnableMenuItem, GetSystemMenu, PostMessageW, SetForegroundWindow, TrackPopupMenu,
                MF_BYCOMMAND, MF_ENABLED, MF_GRAYED, SC_CLOSE, SC_MAXIMIZE, SC_MINIMIZE, SC_MOVE,
                SC_RESTORE, SC_SIZE, TPM_LEFTALIGN, TPM_RETURNCMD, TPM_TOPALIGN, WM_SYSCOMMAND,
            };

            let hwnd = HWND(hwnd_ptr as *mut _);

            unsafe {
                let hmenu = GetSystemMenu(hwnd, false);
                if hmenu.is_invalid() {
                    return;
                }

                let en = |flag: bool| if flag { MF_ENABLED } else { MF_GRAYED };

                let _ = EnableMenuItem(hmenu, SC_RESTORE, MF_BYCOMMAND | en(is_maximized || is_minimized));
                let _ = EnableMenuItem(hmenu, SC_MOVE, MF_BYCOMMAND | en(!is_maximized && !is_minimized));
                let _ = EnableMenuItem(hmenu, SC_SIZE, MF_BYCOMMAND | en(!is_maximized && !is_minimized && is_resizable));
                let _ = EnableMenuItem(hmenu, SC_MINIMIZE, MF_BYCOMMAND | en(!is_minimized));
                let _ = EnableMenuItem(hmenu, SC_MAXIMIZE, MF_BYCOMMAND | en(!is_maximized && is_resizable));
                let _ = EnableMenuItem(hmenu, SC_CLOSE, MF_BYCOMMAND | MF_ENABLED);

                let _ = SetForegroundWindow(hwnd);

                let cmd = TrackPopupMenu(
                    hmenu,
                    TPM_LEFTALIGN | TPM_TOPALIGN | TPM_RETURNCMD,
                    screen_x,
                    screen_y,
                    None,
                    hwnd,
                    None,
                );

                if cmd.0 != 0 {
                    let _ = PostMessageW(
                        Some(hwnd),
                        WM_SYSCOMMAND,
                        WPARAM(cmd.0 as usize),
                        LPARAM(0),
                    );
                }
            }
        })
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg(not(windows))]
#[tauri::command]
pub async fn show_system_menu(
    _window: tauri::WebviewWindow,
    _x: i32,
    _y: i32,
) -> Result<(), String> {
    Ok(())
}

/// 启动新的应用进程（独立窗口）
#[tauri::command]
pub async fn spawn_new_window(cwd: Option<String>) -> Result<(), String> {
    use std::process::Command;

    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let mut cmd = Command::new(&exe);

    if let Some(dir) = cwd.as_ref().filter(|s| !s.is_empty()) {
        cmd.arg("--dir").arg(dir);
    }

    // Windows：以独立进程组启动，避免随主进程退出
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NEW_PROCESS_GROUP(0x00000200) | DETACHED_PROCESS(0x00000008)
        cmd.creation_flags(0x00000200 | 0x00000008);
    }

    cmd.spawn().map_err(|e| e.to_string())?;
    Ok(())
}
