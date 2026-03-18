/// 可探测到的 Shell 信息
#[derive(Debug, Clone)]
pub struct DetectedShell {
    /// Shell 类型标识符，小写，如 "powershell" | "cmd" | "bash" | "zsh"
    pub shell_type: String,
    /// 用户可见显示名称
    pub display_name: String,
    /// Shell 可执行文件完整绝对路径
    pub path: String,
    /// 是否为系统默认 Shell
    pub is_default: bool,
}

/// 按平台探测当前系统可用的 Shell 列表
///
/// - Windows：探测 PowerShell 5.1 / PowerShell 7 / CMD / Git Bash
/// - macOS / Linux：探测 Bash / Zsh / Fish
///
/// # 返回
/// - `Ok(Vec<DetectedShell>)`: 实际存在的 Shell 列表
/// - `Err(String)`: 探测完全失败（极少见）
pub fn detect_available_shells() -> Result<Vec<DetectedShell>, String> {
    let mut shells = Vec::new();

    #[cfg(target_os = "windows")]
    detect_windows_shells(&mut shells);

    #[cfg(not(target_os = "windows"))]
    detect_unix_shells(&mut shells);

    // 至少保证返回一个 Shell；若列表为空尝试 fallback
    if shells.is_empty() {
        return Err("No available shells detected on this system".to_string());
    }

    Ok(shells)
}

/// Windows 平台 Shell 探测
#[cfg(target_os = "windows")]
fn detect_windows_shells(shells: &mut Vec<DetectedShell>) {
    let fixed_candidates: &[(&str, &str, &str, bool)] = &[
        ("powershell", "PowerShell 5.1", r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe", true),
        ("pwsh", "PowerShell 7", r"C:\Program Files\PowerShell\7\pwsh.exe", false),
        ("cmd", "Command Prompt", r"C:\Windows\System32\cmd.exe", false),
        ("git-bash", "Git Bash", r"C:\Program Files\Git\bin\bash.exe", false),
        ("wsl", "WSL", r"C:\Windows\System32\wsl.exe", false),
    ];

    for (shell_type, display_name, path, is_default) in fixed_candidates {
        push_shell_if_exists(shells, shell_type, display_name, path, *is_default);
    }

    let path_candidates: &[(&str, &str, &str, bool)] = &[
        ("powershell", "PowerShell", "powershell.exe", true),
        ("pwsh", "PowerShell 7", "pwsh.exe", false),
        ("cmd", "Command Prompt", "cmd.exe", false),
        ("git-bash", "Git Bash", "bash.exe", false),
        ("wsl", "WSL", "wsl.exe", false),
        ("nu", "Nushell", "nu.exe", false),
    ];

    for (shell_type, display_name, executable, is_default) in path_candidates {
        for path in find_windows_executable_paths(executable) {
            let resolved_type = if *shell_type == "git-bash" {
                classify_bash_on_windows(&path)
            } else {
                (*shell_type).to_string()
            };
            let resolved_name = if resolved_type == "bash" {
                "Bash".to_string()
            } else {
                display_name.to_string()
            };
            push_shell(shells, &resolved_type, &resolved_name, &path, *is_default);
        }
    }

    // 若 PowerShell 5.1 不存在（极罕见），则将第一个探测到的设为默认
    if !shells.is_empty() && !shells.iter().any(|s| s.is_default) {
        shells[0].is_default = true;
    }
}

#[cfg(target_os = "windows")]
fn push_shell_if_exists(
    shells: &mut Vec<DetectedShell>,
    shell_type: &str,
    display_name: &str,
    path: &str,
    is_default: bool,
) {
    if std::path::Path::new(path).exists() {
        push_shell(shells, shell_type, display_name, path, is_default);
    }
}

fn push_shell(
    shells: &mut Vec<DetectedShell>,
    shell_type: &str,
    display_name: &str,
    path: &str,
    is_default: bool,
) {
    if shells
        .iter()
        .any(|shell| shell.path.eq_ignore_ascii_case(path))
    {
        return;
    }

    shells.push(DetectedShell {
        shell_type: shell_type.to_string(),
        display_name: display_name.to_string(),
        path: path.to_string(),
        is_default,
    });
}

#[cfg(target_os = "windows")]
fn find_windows_executable_paths(executable: &str) -> Vec<String> {
    let output = std::process::Command::new("where")
        .arg(executable)
        .output();

    let Ok(output) = output else {
        return Vec::new();
    };
    if !output.status.success() {
        return Vec::new();
    }

    String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(|line| line.to_string())
        .collect()
}

#[cfg(target_os = "windows")]
fn classify_bash_on_windows(path: &str) -> String {
    let lower = path.to_lowercase();
    if lower.contains(r"\git\") {
        "git-bash".to_string()
    } else {
        "bash".to_string()
    }
}

/// Unix 平台（Linux/macOS）Shell 探测
#[cfg(not(target_os = "windows"))]
fn detect_unix_shells(shells: &mut Vec<DetectedShell>) {
    let candidates: &[(&str, &str, &str)] = &[
        ("bash", "Bash", "/bin/bash"),
        ("zsh", "Zsh", "/bin/zsh"),
        ("fish", "Fish", "/usr/bin/fish"),
        ("bash", "Bash", "/usr/bin/bash"),
        ("zsh", "Zsh", "/usr/bin/zsh"),
    ];

    for (shell_type, display_name, path) in candidates {
        // 避免重复添加同类型 Shell
        if std::path::Path::new(path).exists()
            && !shells.iter().any(|s: &DetectedShell| s.shell_type == *shell_type)
        {
            shells.push(DetectedShell {
                shell_type: shell_type.to_string(),
                display_name: display_name.to_string(),
                path: path.to_string(),
                is_default: false,
            });
        }
    }

    // 按优先级设置默认 Shell：zsh > bash > fish
    let default_priority = ["zsh", "bash", "fish"];
    let mut default_set = false;
    for preferred in &default_priority {
        if let Some(s) = shells.iter_mut().find(|s| s.shell_type == *preferred) {
            s.is_default = true;
            default_set = true;
            break;
        }
    }
    // 回退：将第一个设为默认
    if !default_set && !shells.is_empty() {
        shells[0].is_default = true;
    }
}
