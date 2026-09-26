; installer.nsh — custom NSIS hooks for Masar X (T019, implemented in spec 014 R036)
;
; Referenced by electron-builder.yml `nsis.include`. Registers the
; masarx:// URL protocol under HKCU so the OS hands OAuth deep links
; (masarx://auth/callback?code=...) back to the installed app — the PKCE
; code the renderer exchanges after Google consent completes in the
; system browser. The packaged main process also calls
; app.setAsDefaultProtocolClient at startup (spec 014 R031); this
; installer-time registration is the authoritative, elevated-less
; (HKCU) record that survives without a first app launch.
;
; ${APP_EXECUTABLE_FILENAME} is an electron-builder NSIS define for the
; packaged exe filename ("Masar X.exe").

!macro customInstall
  DetailPrint "Registering masarx:// URL protocol"
  WriteRegStr HKCU "Software\Classes\masarx" "" "URL:masarx"
  WriteRegStr HKCU "Software\Classes\masarx" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\masarx\DefaultIcon" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME},0"'
  WriteRegStr HKCU "Software\Classes\masarx\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
!macroend

!macro customUnInstall
  DetailPrint "Removing masarx:// URL protocol"
  DeleteRegKey HKCU "Software\Classes\masarx"
!macroend
