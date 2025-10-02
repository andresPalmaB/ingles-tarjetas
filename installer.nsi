; ========= Ingles Tarjetas Installer v1.0.10 =========
Unicode true
RequestExecutionLevel admin
SetCompressor /SOLID lzma
ShowInstDetails show
ShowUninstDetails show

!include "MUI2.nsh"
!include "x64.nsh"

!define APP_NAME      "Ingles Tarjetas"
!define COMPANY_NAME  "InglesTarjetas"
!define VERSION       "1.0.10"
!define PORT          "5173"
!define SRCDIR        "dist"

Name "${APP_NAME}"
OutFile "Ingles-Tarjetas-Setup-v${VERSION}.exe"

; Instalar en Program Files (x64 o x86)
InstallDir "$PROGRAMFILES64\${APP_NAME}"

Function .onInit
  ${If} ${RunningX64}
    SetRegView 64
  ${Else}
    SetRegView 32
    StrCpy $INSTDIR "$PROGRAMFILES\${APP_NAME}"
  ${EndIf}
FunctionEnd

; Páginas
!insertmacro MUI_PAGE_WELCOME
!define MUI_PAGE_HEADER_TEXT "Información importante"
!define MUI_PAGE_HEADER_SUBTEXT "Acerca de las advertencias de seguridad de Windows"
!define MUI_LICENSEPAGE_TEXT_TOP "Windows puede mostrar advertencias de seguridad durante la instalación. Esto es normal para aplicaciones no firmadas digitalmente. Es seguro continuar con 'Ejecutar de todos modos'."
!define MUI_LICENSEPAGE_TEXT_BOTTOM "Presiona 'Acepto' para continuar con la instalación."
!insertmacro MUI_PAGE_LICENSE "license.txt"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH
!insertmacro MUI_LANGUAGE "Spanish"

Section "Instalar ${APP_NAME}" SEC01
  SetShellVarContext all
  SetOverwrite on

  DetailPrint "========================================="
  DetailPrint ">>> INICIANDO INSTALACIÓN <<<"
  DetailPrint ">>> Instalando en: $INSTDIR"
  DetailPrint ">>> Archivos empaquetados en instalador"
  DetailPrint "========================================="

  ; === INSTALACIÓN DE CARPETA OUT ===
  DetailPrint "-----------------------------------------"
  DetailPrint ">>> Procesando carpeta out/"
  IfFileExists "${SRCDIR}\out\*.*" 0 skip_out
    CreateDirectory "$INSTDIR\out"
    SetOutPath "$INSTDIR\out"
    File /r "${SRCDIR}\out\*.*"
    DetailPrint ">>> ✓ Carpeta out/ copiada exitosamente"
    Goto continue_node
  skip_out:
    DetailPrint ">>> ❌ ADVERTENCIA: No se encontró ${SRCDIR}\out\"

  continue_node:
  ; === INSTALACIÓN DE CARPETA NODE ===
  DetailPrint "-----------------------------------------"
  DetailPrint ">>> Procesando carpeta node/"
  IfFileExists "${SRCDIR}\node\*.*" 0 skip_node
    CreateDirectory "$INSTDIR\node"
    SetOutPath "$INSTDIR\node"
    File /r "${SRCDIR}\node\*.*"
    DetailPrint ">>> ✓ Carpeta node/ copiada exitosamente"
    Goto continue_root
  skip_node:
    DetailPrint ">>> ❌ ADVERTENCIA: No se encontró ${SRCDIR}\node\"

  continue_root:
  ; === INSTALACIÓN DE ARCHIVOS RAÍZ ===
  DetailPrint "-----------------------------------------"
  DetailPrint ">>> Procesando archivos raíz"
  SetOutPath "$INSTDIR"

  ; server.cjs
  IfFileExists "${SRCDIR}\server.cjs" 0 +4
    File "${SRCDIR}\server.cjs"
    DetailPrint ">>> ✓ server.cjs copiado"
    Goto check_bat
  DetailPrint ">>> ❌ ADVERTENCIA: No se encontró server.cjs"

  check_bat:
  ; start_app.bat
  IfFileExists "${SRCDIR}\start_app.bat" 0 +4
    File "${SRCDIR}\start_app.bat"
    DetailPrint ">>> ✓ start_app.bat copiado"
    Goto check_ico
  DetailPrint ">>> ❌ ADVERTENCIA: No se encontró start_app.bat"

  check_ico:
  ; app.ico (opcional)
  IfFileExists "${SRCDIR}\app.ico" 0 +4
    File "${SRCDIR}\app.ico"
    DetailPrint ">>> ✓ app.ico copiado"
    Goto create_port
  DetailPrint ">>> ⚠️ app.ico no encontrado (opcional)"

  create_port:
  ; === CREACIÓN DE ARCHIVOS ADICIONALES ===
  DetailPrint "-----------------------------------------"
  DetailPrint ">>> Creando archivos de configuración"

  ; PORT.txt
  FileOpen $0 "$INSTDIR\PORT.txt" w
  FileWrite $0 "${PORT}"
  FileClose $0
  DetailPrint ">>> ✓ PORT.txt creado con valor: ${PORT}"

  ; Marcador de instalación
  FileOpen $1 "$INSTDIR\_installed_ok.txt" w
  FileWrite $1 "Instalado en: $INSTDIR$\r$\nVersion: ${VERSION}$\r$\nFecha: $\r$\n"
  FileClose $1
  DetailPrint ">>> ✓ Marcador de instalación creado"

  ; === CREACIÓN DE ACCESOS DIRECTOS ===
  DetailPrint "-----------------------------------------"
  DetailPrint ">>> Creando accesos directos"
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"

  ; Acceso directo en escritorio
  IfFileExists "$INSTDIR\app.ico" 0 +4
    CreateShortcut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\start_app.bat" "" "$INSTDIR\app.ico" 0 SW_SHOWNORMAL
    DetailPrint ">>> ✓ Acceso directo en escritorio (con icono)"
    Goto menu_shortcut
  CreateShortcut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\start_app.bat"
  DetailPrint ">>> ✓ Acceso directo en escritorio (sin icono)"

  menu_shortcut:
  ; Acceso directo en menú inicio
  IfFileExists "$INSTDIR\app.ico" 0 +4
    CreateShortcut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\start_app.bat" "" "$INSTDIR\app.ico" 0 SW_SHOWNORMAL
    DetailPrint ">>> ✓ Acceso directo en menú inicio (con icono)"
    Goto create_uninstaller
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\start_app.bat"
  DetailPrint ">>> ✓ Acceso directo en menú inicio (sin icono)"

  create_uninstaller:
  ; === REGISTRO Y DESINSTALADOR ===
  DetailPrint "-----------------------------------------"
  DetailPrint ">>> Configurando desinstalador y registro"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr   HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "DisplayName"     "${APP_NAME}"
  WriteRegStr   HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "Publisher"       "${COMPANY_NAME}"
  WriteRegStr   HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "DisplayVersion"  "${VERSION}"
  WriteRegStr   HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "InstallLocation" "$INSTDIR"
  WriteRegStr   HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "NoRepair" 1
  DetailPrint ">>> ✓ Desinstalador y registro configurados"

  ; === VERIFICACIÓN FINAL ===
  DetailPrint "========================================="
  DetailPrint ">>> VERIFICACIÓN POST-INSTALACIÓN <<<"

  IfFileExists "$INSTDIR\server.cjs" 0 +3
    DetailPrint ">>> ✓ server.cjs verificado en destino"
    Goto verify_bat
  DetailPrint ">>> ❌ ERROR: server.cjs NO se encuentra en destino"

  verify_bat:
  IfFileExists "$INSTDIR\start_app.bat" 0 +3
    DetailPrint ">>> ✓ start_app.bat verificado en destino"
    Goto verify_out
  DetailPrint ">>> ❌ ERROR: start_app.bat NO se encuentra en destino"

  verify_out:
  IfFileExists "$INSTDIR\out\index.html" 0 +3
    DetailPrint ">>> ✓ Carpeta out/ verificada (index.html encontrado)"
    Goto verify_node
  DetailPrint ">>> ❌ ERROR: Carpeta out/ NO se encuentra o está vacía"

  verify_node:
  IfFileExists "$INSTDIR\node\node.exe" 0 +3
    DetailPrint ">>> ✓ Carpeta node/ verificada (node.exe encontrado)"
    Goto verify_port
  DetailPrint ">>> ❌ ERROR: Carpeta node/ NO se encuentra o node.exe falta"

  verify_port:
  IfFileExists "$INSTDIR\PORT.txt" 0 +3
    DetailPrint ">>> ✓ PORT.txt verificado"
    Goto installation_complete
  DetailPrint ">>> ❌ ERROR: PORT.txt NO se creó"

  installation_complete:
  DetailPrint "========================================="
  DetailPrint ">>> INSTALACIÓN COMPLETADA <<<"
  DetailPrint ">>> Ubicación: $INSTDIR"
  DetailPrint "========================================="
SectionEnd

Section "Desinstalar"
  SetShellVarContext all

  DetailPrint ">>> Iniciando desinstalación..."

  Delete "$DESKTOP\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"
  RMDir  "$SMPROGRAMS\${APP_NAME}"

  RMDir /r "$INSTDIR\out"
  RMDir /r "$INSTDIR\node"
  Delete "$INSTDIR\server.cjs"
  Delete "$INSTDIR\start_app.bat"
  Delete "$INSTDIR\app.ico"
  Delete "$INSTDIR\PORT.txt"
  Delete "$INSTDIR\_installed_ok.txt"

  Delete "$INSTDIR\Uninstall.exe"
  RMDir  "$INSTDIR"

  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}"

  DetailPrint ">>> Desinstalación completada"
SectionEnd