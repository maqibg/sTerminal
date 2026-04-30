/// 字体相关命令：枚举系统已安装的等宽字体

use std::sync::OnceLock;
use font_kit::source::SystemSource;

/// 进程内缓存：首次枚举较慢（需要遍历并加载所有字体），结果缓存
static MONOSPACE_CACHE: OnceLock<Vec<String>> = OnceLock::new();

/// 枚举系统中所有已安装的等宽字体族名（按字母序去重）
#[tauri::command]
pub async fn list_monospace_fonts() -> Result<Vec<String>, String> {
    if let Some(cached) = MONOSPACE_CACHE.get() {
        return Ok(cached.clone());
    }

    // 枚举放到 blocking 线程，避免阻塞 Tauri async runtime
    let families = tokio::task::spawn_blocking(|| -> Result<Vec<String>, String> {
        let source = SystemSource::new();
        let all_families = source
            .all_families()
            .map_err(|e| format!("枚举字体族失败: {}", e))?;

        let mut monospace: Vec<String> = Vec::new();

        for family in all_families {
            // 逐族加载首个字体判断是否等宽。加载失败（损坏/权限问题）静默跳过。
            let handles = match source.select_family_by_name(&family) {
                Ok(h) => h,
                Err(_) => continue,
            };
            for handle in handles.fonts() {
                if let Ok(font) = handle.load() {
                    if font.is_monospace() {
                        monospace.push(family.clone());
                    }
                    break; // 一个族取首个样式判断即可
                }
            }
        }

        monospace.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
        monospace.dedup();
        Ok(monospace)
    })
    .await
    .map_err(|e| format!("font 枚举任务失败: {}", e))??;

    let _ = MONOSPACE_CACHE.set(families.clone());
    Ok(families)
}
