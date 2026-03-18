/**
 * Shell 类型 → 图标/颜色映射
 */
export interface ShellIconInfo {
  icon: string;
  color: string;
}

const SHELL_ICON_MAP: Record<string, ShellIconInfo> = {
  powershell: { icon: "PS", color: "#012456" },
  pwsh: { icon: "PS", color: "#012456" },
  cmd: { icon: ">_", color: "#333" },
  bash: { icon: "$", color: "#4EAA25" },
  zsh: { icon: "Z", color: "#F15A24" },
  fish: { icon: "><>", color: "#34CCEE" },
  "git-bash": { icon: "$", color: "#F05033" },
  wsl: { icon: "WSL", color: "#0078d4" },
  nu: { icon: "NU", color: "#4f46e5" },
};

const DEFAULT_ICON: ShellIconInfo = { icon: "T", color: "#888" };

/**
 * 根据 shellType 返回图标信息
 */
export function getShellIcon(shellType: string): ShellIconInfo {
  const key = shellType.toLowerCase();
  return SHELL_ICON_MAP[key] ?? DEFAULT_ICON;
}
