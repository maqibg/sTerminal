import { getVersion } from "@tauri-apps/api/app";

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  releaseNotes: string;
  downloadUrl: string; // 当前平台的安装包下载链接
  fileName: string;    // 安装包文件名
}

/** semver 版本比较：a < b 返回 -1，a == b 返回 0，a > b 返回 1 */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map(Number);
  const pb = b.replace(/^v/, "").split(".").map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na < nb) return -1;
    if (na > nb) return 1;
  }
  return 0;
}

/** 根据平台选择合适的安装包 */
function selectAssetForPlatform(assets: any[]): { url: string; name: string } | null {
  const platform = navigator.platform.toLowerCase();
  const isWindows = platform.includes("win");
  const isMac = platform.includes("mac");
  const isLinux = platform.includes("linux");

  for (const asset of assets) {
    const name: string = asset.name || "";
    const url: string = asset.browser_download_url || "";
    if (!name || !url) continue;

    // Windows: 优先 .exe 安装包
    if (isWindows && name.endsWith("_x64-setup.exe")) {
      return { url, name };
    }
    // macOS: 优先 .dmg
    if (isMac && name.endsWith("_universal.dmg")) {
      return { url, name };
    }
    // Linux: 优先 .AppImage
    if (isLinux && name.endsWith("_amd64.AppImage")) {
      return { url, name };
    }
  }
  return null;
}

/** 检查 GitHub Release 是否有新版本，返回 null 表示无更新或失败 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const currentVersion = await getVersion();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const resp = await fetch(
      "https://api.github.com/repos/zss823158062/sTerminal/releases/latest",
      {
        signal: controller.signal,
        headers: { Accept: "application/vnd.github.v3+json" },
      }
    );
    if (!resp.ok) return null;

    const data = await resp.json();
    const latestVersion: string = data.tag_name ?? "";
    if (!latestVersion) return null;

    if (compareVersions(currentVersion, latestVersion) >= 0) return null;

    const asset = selectAssetForPlatform(data.assets ?? []);

    return {
      currentVersion,
      latestVersion: latestVersion.replace(/^v/, ""),
      releaseUrl: data.html_url ?? `https://github.com/zss823158062/sTerminal/releases/latest`,
      releaseNotes: data.body ?? "",
      downloadUrl: asset?.url ?? "",
      fileName: asset?.name ?? "",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
