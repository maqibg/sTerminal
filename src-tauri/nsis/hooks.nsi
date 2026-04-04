; sTerminal NSIS installer hooks
; 1. WebView2Loader.dll 修复
; 2. 创建 st.cmd 快捷命令
; 3. 注册 Windows 资源管理器右键菜单
; 4. 将安装目录加入用户 PATH

!macro NSIS_HOOK_POSTINSTALL
  ; ── WebView2Loader.dll 修复（GNU 工具链需要） ──
  CopyFiles /SILENT "$INSTDIR\resources\WebView2Loader.dll" "$INSTDIR\WebView2Loader.dll"

  ; ── 创建 st.cmd 快捷命令 ──
  FileOpen $9 "$INSTDIR\st.cmd" w
  FileWrite $9 '@echo off$\r$\n'
  FileWrite $9 '"%~dp0s-terminal.exe" %*$\r$\n'
  FileClose $9

  ; ── 右键菜单 ──
  WriteRegStr HKCU "Software\Classes\Directory\shell\sTerminal" "" "在 sTerminal 中打开"
  WriteRegStr HKCU "Software\Classes\Directory\shell\sTerminal" "Icon" '"$INSTDIR\s-terminal.exe"'
  WriteRegStr HKCU "Software\Classes\Directory\shell\sTerminal\command" "" '"$INSTDIR\s-terminal.exe" "%V"'

  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\sTerminal" "" "在 sTerminal 中打开"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\sTerminal" "Icon" '"$INSTDIR\s-terminal.exe"'
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\sTerminal\command" "" '"$INSTDIR\s-terminal.exe" "%V"'

  ; ── 加入用户 PATH ──
  ReadRegStr $0 HKCU "Environment" "Path"
  StrCmp $0 "" 0 _path_append
    WriteRegExpandStr HKCU "Environment" "Path" "$INSTDIR"
    Goto _path_done
  _path_append:
    WriteRegExpandStr HKCU "Environment" "Path" "$0;$INSTDIR"
  _path_done:
  SendMessage 0xFFFF 0x001A 0 "STR:Environment" /TIMEOUT=500
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ; ── 清理 ──
  DeleteRegKey HKCU "Software\Classes\Directory\shell\sTerminal"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\sTerminal"
  Delete "$INSTDIR\WebView2Loader.dll"
  Delete "$INSTDIR\st.cmd"
!macroend
