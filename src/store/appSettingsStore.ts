import { create } from "zustand";
import type {
  AppSettings,
  CommandGroup,
  TerminalSession,
} from "../types/layout";
import type {
  CustomTerminalProfile,
  ShellInfo,
  TerminalCursorStyle,
  TerminalOption,
} from "../types/terminal";

export const DEFAULT_TERMINAL_FONT_FAMILY =
  '"Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, "Courier New", monospace';

export const DEFAULT_TERMINAL_FONT_SIZE = 13;
export const DEFAULT_TERMINAL_CURSOR_STYLE: TerminalCursorStyle = "block";
export const DEFAULT_TERMINAL_CURSOR_COLOR = "";

const DEFAULT_SETTINGS: AppSettings = {
  defaultShell: "powershell",
  defaultTerminalId: "",
  defaultWorkingDirectory: "",
  terminalFontFamily: DEFAULT_TERMINAL_FONT_FAMILY,
  terminalFontSize: DEFAULT_TERMINAL_FONT_SIZE,
  terminalCursorStyle: DEFAULT_TERMINAL_CURSOR_STYLE,
  terminalCursorColor: DEFAULT_TERMINAL_CURSOR_COLOR,
  detectedTerminalFonts: [],
  customTerminals: [],
  detectedSystemTerminals: [],
  commandGroups: [],
  enableRightClickCommandPaste: false,
};

function makeSystemTerminalId(shell: ShellInfo): string {
  return `system:${shell.type}:${shell.path.toLowerCase()}`;
}

export function inferShellType(
  path: string,
  fallback = "custom",
  name = ""
): string {
  const lowerPath = path.toLowerCase();
  const lowerName = name.toLowerCase();

  if (lowerPath.includes("pwsh.exe") || lowerName.includes("powershell 7")) {
    return "pwsh";
  }
  if (lowerPath.includes("powershell") || lowerName.includes("powershell")) {
    return "powershell";
  }
  if (lowerPath.endsWith("\\cmd.exe") || lowerPath.endsWith("/cmd.exe")) {
    return "cmd";
  }
  if (lowerPath.includes("git\\bin\\bash.exe") || lowerPath.includes("git/bash")) {
    return "git-bash";
  }
  if (lowerPath.endsWith("/bash") || lowerPath.endsWith("\\bash.exe")) {
    return "bash";
  }
  if (lowerPath.endsWith("/zsh") || lowerName.includes("zsh")) {
    return "zsh";
  }
  if (lowerPath.endsWith("/fish") || lowerName.includes("fish")) {
    return "fish";
  }

  return fallback;
}

export function getTerminalOptions(
  settings: AppSettings,
  systemShells: ShellInfo[]
): TerminalOption[] {
  const systemOptions = systemShells.map((shell) => ({
    id: makeSystemTerminalId(shell),
    name: shell.displayName,
    path: shell.path,
    shellType: shell.type,
    startDirectory: settings.defaultWorkingDirectory,
    source: "system" as const,
    isDefault: shell.isDefault,
  }));

  const customOptions = settings.customTerminals.map((terminal) => ({
    id: terminal.id,
    name: terminal.name,
    path: terminal.path,
    shellType: terminal.shellType,
    startDirectory: terminal.startDirectory,
    source: "custom" as const,
    isDefault: false,
  }));

  return [...systemOptions, ...customOptions];
}

function getFallbackTerminalId(
  settings: AppSettings,
  systemShells: ShellInfo[]
): string {
  const matchByShell = systemShells.find((shell) => shell.type === settings.defaultShell);
  if (matchByShell) {
    return makeSystemTerminalId(matchByShell);
  }

  const systemDefault = systemShells.find((shell) => shell.isDefault);
  if (systemDefault) {
    return makeSystemTerminalId(systemDefault);
  }

  return settings.customTerminals[0]?.id ?? "";
}

export function getResolvedDefaultTerminal(
  settings: AppSettings,
  systemShells: ShellInfo[]
): TerminalOption | null {
  const options = getTerminalOptions(settings, systemShells);
  if (options.length === 0) return null;

  const defaultId = settings.defaultTerminalId || getFallbackTerminalId(settings, systemShells);
  return options.find((option) => option.id === defaultId) ?? options[0];
}

export function getDefaultTerminalSessionConfig(): Partial<
  Pick<TerminalSession, "shellType" | "shellPath" | "workingDirectory">
> {
  const { settings, systemShells } = useAppSettingsStore.getState();
  const terminal = getResolvedDefaultTerminal(settings, systemShells);
  if (!terminal) {
    return {
      shellType: settings.defaultShell || "default",
      shellPath: "",
      workingDirectory: settings.defaultWorkingDirectory,
    };
  }

  return {
    shellType: terminal.shellType,
    shellPath: terminal.path,
    workingDirectory: terminal.startDirectory,
  };
}

export function getTerminalAppearanceSettings() {
  const { settings } = useAppSettingsStore.getState();
  return {
    fontFamily: settings.terminalFontFamily,
    fontSize: settings.terminalFontSize,
    cursorStyle: settings.terminalCursorStyle,
    cursorColor: settings.terminalCursorColor,
  };
}

interface AppSettingsStoreState {
  settings: AppSettings;
  systemShells: ShellInfo[];
  hydrated: boolean;
  hydrate: (settings: AppSettings) => void;
  setSystemShells: (shells: ShellInfo[]) => void;
  updateSettings: (settings: AppSettings) => void;
}

export const useAppSettingsStore = create<AppSettingsStoreState>((set) => ({
  settings: DEFAULT_SETTINGS,
  systemShells: [],
  hydrated: false,

  hydrate(settings) {
    const nextSettings = {
      ...DEFAULT_SETTINGS,
      ...settings,
      detectedTerminalFonts: settings.detectedTerminalFonts ?? [],
      customTerminals: settings.customTerminals ?? [],
      detectedSystemTerminals: settings.detectedSystemTerminals ?? [],
      commandGroups: settings.commandGroups ?? [],
    };
    set({
      settings: nextSettings,
      systemShells: nextSettings.detectedSystemTerminals,
      hydrated: true,
    });
  },

  setSystemShells(shells) {
    set({ systemShells: shells });
  },

  updateSettings(settings) {
    const nextSettings = {
      ...DEFAULT_SETTINGS,
      ...settings,
      detectedTerminalFonts: settings.detectedTerminalFonts ?? [],
      customTerminals: settings.customTerminals ?? [],
      detectedSystemTerminals: settings.detectedSystemTerminals ?? [],
      commandGroups: settings.commandGroups ?? [],
    };
    set({
      settings: nextSettings,
      systemShells: nextSettings.detectedSystemTerminals,
      hydrated: true,
    });
  },
}));

export function createEmptyCustomTerminal(): CustomTerminalProfile {
  return {
    id: crypto.randomUUID(),
    name: "",
    shellType: "custom",
    path: "",
    startDirectory: "",
  };
}

export function createEmptyCommandGroup(): CommandGroup {
  return {
    id: crypto.randomUUID(),
    name: "新分组",
    commands: [],
  };
}
