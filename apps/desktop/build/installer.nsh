; installer.nsh — custom NSIS hooks for Masar X (T019)
;
; This file is referenced by electron-builder.yml `nsis.include`. The
; intended contents are documented in T019 (custom URL protocol
; registration so the OAuth deep link from the system browser can
; return to the desktop app). The implementation was deferred; the
; file exists as a placeholder so the NSIS build does not fail.
;
; The protocol to register: `masarx:` — used by the OAuth callback
; flow documented in `apps/desktop/electron-builder.yml` and the
; `src/navigation.ts` deep-link handler in the web app.
;
; T019.1 follow-up: implement the URL protocol registration here
; (WriteRegStr HKCU "Software\Classes\masarx" "URL Protocol" ""
;  + WriteRegStr HKCU "Software\Classes\masarx\shell\open\command"
;  '"$INSTDIR\${PRODUCT_FILENAME}.exe" "%1"') and remove this
; placeholder comment.
