use serde::{Deserialize, Serialize};

use crate::commands::terminal::ShellInfo;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomTerminalProfile {
    pub id: String,
    pub name: String,
    #[serde(rename = "shellType")]
    pub shell_type: String,
    pub path: String,
    #[serde(rename = "startDirectory", default)]
    pub start_directory: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommonCommand {
    pub id: String,
    pub name: String,
    pub command: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandGroup {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub commands: Vec<CommonCommand>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    #[serde(rename = "defaultShell", default = "default_shell")]
    pub default_shell: String,
    #[serde(rename = "defaultTerminalId", default)]
    pub default_terminal_id: String,
    #[serde(rename = "defaultWorkingDirectory", default)]
    pub default_working_directory: String,
    #[serde(rename = "terminalFontFamily", default = "default_terminal_font_family")]
    pub terminal_font_family: String,
    #[serde(rename = "terminalFontSize", default = "default_terminal_font_size")]
    pub terminal_font_size: u16,
    #[serde(rename = "detectedTerminalFonts", default)]
    pub detected_terminal_fonts: Vec<String>,
    #[serde(rename = "customTerminals", default)]
    pub custom_terminals: Vec<CustomTerminalProfile>,
    #[serde(rename = "detectedSystemTerminals", default)]
    pub detected_system_terminals: Vec<ShellInfo>,
    #[serde(rename = "commandGroups", default)]
    pub command_groups: Vec<CommandGroup>,
    #[serde(rename = "enableRightClickCommandPaste", default)]
    pub enable_right_click_command_paste: bool,
}

fn default_shell() -> String {
    "powershell".to_string()
}

fn default_terminal_font_family() -> String {
    "\"Cascadia Code\", \"Fira Code\", \"JetBrains Mono\", Consolas, \"Courier New\", monospace"
        .to_string()
}

fn default_terminal_font_size() -> u16 {
    13
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            default_shell: default_shell(),
            default_terminal_id: String::new(),
            default_working_directory: String::new(),
            terminal_font_family: default_terminal_font_family(),
            terminal_font_size: default_terminal_font_size(),
            detected_terminal_fonts: Vec::new(),
            custom_terminals: Vec::new(),
            detected_system_terminals: Vec::new(),
            command_groups: Vec::new(),
            enable_right_click_command_paste: false,
        }
    }
}
