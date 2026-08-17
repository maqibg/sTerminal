use futures_util::StreamExt;
use std::io::Write;
use tauri::{AppHandle, Emitter};

#[derive(Clone, serde::Serialize)]
struct DownloadProgress {
    downloaded: u64,
    total: u64,
}

#[tauri::command]
pub async fn download_update(
    app: AppHandle,
    url: String,
    filename: String,
) -> Result<String, String> {
    let download_dir =
        dirs::download_dir().ok_or_else(|| "无法获取下载目录".to_string())?;
    let file_path = download_dir.join(&filename);

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    let total = response.content_length().unwrap_or(0);
    let mut file =
        std::fs::File::create(&file_path).map_err(|e| format!("创建文件失败: {}", e))?;

    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();
    let mut last_emit: u64 = 0;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("下载中断: {}", e))?;
        file.write_all(&chunk)
            .map_err(|e| format!("写入失败: {}", e))?;
        downloaded += chunk.len() as u64;

        // 每 100KB 发送一次进度事件
        if downloaded - last_emit > 102_400 || downloaded == total {
            last_emit = downloaded;
            let _ = app.emit("download-progress", DownloadProgress { downloaded, total });
        }
    }

    Ok(file_path.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn open_file(path: String) -> Result<(), String> {
    open::that(&path).map_err(|e| format!("打开失败: {}", e))
}
