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
///
/// Windows 关键背景：
/// - 新窗口进程内的每个终端由 ConPTY 创建伪控制台，其 Ctrl+C(CTRL_C_EVENT)
///   信号投递依赖进程拥有一个真实的控制台环境。
/// - DETACHED_PROCESS / 不带控制台标志 都会导致新进程缺少可用控制台，
///   ConPTY 无法投递中断信号 → 「派生窗口里 Ctrl+C 无反应」。
/// - CREATE_NEW_CONSOLE 能修复信号，但默认会弹出可见的黑色控制台窗口。
/// 因此 Windows 下用 CreateProcessW 手动构造进程，通过 STARTUPINFO 的
/// STARTF_USESHOWWINDOW + SW_HIDE 让新控制台创建即隐藏——既保留可投递信号的
/// 真实控制台，又不弹黑窗。
#[cfg(windows)]
#[tauri::command]
pub async fn spawn_new_window(cwd: Option<String>) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows::core::PWSTR;
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Threading::{
        CreateProcessW, CREATE_NEW_CONSOLE, CREATE_NEW_PROCESS_GROUP, CREATE_UNICODE_ENVIRONMENT,
        PROCESS_INFORMATION, STARTF_USESHOWWINDOW, STARTUPINFOW,
    };
    use windows::Win32::UI::WindowsAndMessaging::SW_HIDE;

    let exe = std::env::current_exe().map_err(|e| e.to_string())?;

    // 构造命令行：exe 路径需加引号（可能含空格），再追加 --dir 参数
    let mut cmdline = format!("\"{}\"", exe.to_string_lossy());
    if let Some(dir) = cwd.as_ref().filter(|s| !s.is_empty()) {
        cmdline.push_str(" --dir \"");
        cmdline.push_str(dir);
        cmdline.push('"');
    }

    // 转成以 NUL 结尾的 UTF-16（CreateProcessW 会就地修改此缓冲区，故必须可变）
    let mut cmdline_w: Vec<u16> = std::ffi::OsStr::new(&cmdline)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let mut si = STARTUPINFOW::default();
    si.cb = std::mem::size_of::<STARTUPINFOW>() as u32;
    // 启用 wShowWindow，并设为 SW_HIDE，令 CREATE_NEW_CONSOLE 建立的控制台不可见
    si.dwFlags = STARTF_USESHOWWINDOW;
    si.wShowWindow = SW_HIDE.0 as u16;

    let mut pi = PROCESS_INFORMATION::default();

    let flags = CREATE_NEW_CONSOLE | CREATE_NEW_PROCESS_GROUP | CREATE_UNICODE_ENVIRONMENT;

    let result = unsafe {
        CreateProcessW(
            None,                                  // lpApplicationName（用命令行首段）
            Some(PWSTR(cmdline_w.as_mut_ptr())),   // lpCommandLine（可变缓冲）
            None,                                  // lpProcessAttributes
            None,                                  // lpThreadAttributes
            false,                                 // bInheritHandles：不继承句柄，避免污染新控制台
            flags,
            None,                                  // lpEnvironment：继承父进程环境
            None,                                  // lpCurrentDirectory
            &si,
            &mut pi,
        )
    };

    result.map_err(|e| format!("CreateProcessW failed: {}", e))?;

    // 立即关闭进程/线程句柄，新进程独立运行、不随本进程退出
    unsafe {
        let _ = CloseHandle(pi.hProcess);
        let _ = CloseHandle(pi.hThread);
    }

    Ok(())
}

/// 启动新的应用进程（独立窗口）——非 Windows 平台
#[cfg(not(windows))]
#[tauri::command]
pub async fn spawn_new_window(cwd: Option<String>) -> Result<(), String> {
    use std::process::Command;

    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let mut cmd = Command::new(&exe);

    if let Some(dir) = cwd.as_ref().filter(|s| !s.is_empty()) {
        cmd.arg("--dir").arg(dir);
    }

    cmd.spawn().map_err(|e| e.to_string())?;
    Ok(())
}
