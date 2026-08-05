# -*- coding: utf-8 -*-
import json
ar = json.load(open(r'src\messages\ar\aiAssistant.json', encoding='utf-8'))
en = json.load(open(r'src\messages\en\aiAssistant.json', encoding='utf-8'))

hardcoded = {
    "summarizeSubject":     "لخص لي مادة",
    "summarizeSubjectDesc": "احصل على ملخص شامل لأي مادة أكاديمية",
    "explainCode":          "اشرح لي كود",
    "explainCodeDesc":      "فهم المنطق البرمجي وحل المشكلات التقنية",
    "studyPlan":            "خطة دراسية",
    "studyPlanDesc":        "تنظيم وقتك ومسارك التعليمي بذكاء",
    "whatsappChat":         "محادثات الواتساب",
    "whatsappChatDesc":     "تحليل وتلخيص ملفات الدردشة الجماعية",
}

print("=== Side-by-side comparison ===")
all_match = True
for k, hc_ar in hardcoded.items():
    ar_val = ar.get(k, 'MISSING')
    en_val = en.get(k, 'MISSING')
    match_ar = (hc_ar == ar_val)
    if not match_ar:
        all_match = False
    status_ar = "OK" if match_ar else "MISMATCH"
    print(f"{k}:")
    print(f"  hardcoded (AR): {hc_ar!r}")
    print(f"  aiAssistant AR: {ar_val!r}  [{status_ar}]")
    print(f"  aiAssistant EN: {en_val!r}")
    print()

print(f"All AR values match: {all_match}")
print()

print("=== Reuse check: puterSettings (line 316 ternary) ===")
print(f"hardcoded (AR): 'إعدادات Puter'")
print(f"aiAssistant AR: {ar.get('puterSettings', 'MISSING')!r}")
print(f"aiAssistant EN: {en.get('puterSettings', 'MISSING')!r}")
