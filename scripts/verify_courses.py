# -*- coding: utf-8 -*-
import json
ar = json.load(open(r'src\messages\ar\courses.json', encoding='utf-8'))
en = json.load(open(r'src\messages\en\courses.json', encoding='utf-8'))
print("courses.json AR:", len(ar), "keys")
print("courses.json EN:", len(en), "keys")
print("Parity:", set(ar.keys()) == set(en.keys()))
print()
print("--- New 15 keys verification ---")
new_keys = ["incompleteDataTitle", "incompleteDataDesc", "editCourseHeading", "createCourseHeading", "courseTitleLabel", "courseTitlePlaceholder", "courseDescriptionLabel", "courseDescriptionPlaceholder", "coursePriceLabel", "coursePricePlaceholder", "coursePriceHelper", "academicCourseLabel", "savingInProgress", "update", "create"]
for k in new_keys:
    ar_val = ar.get(k, "MISSING")
    en_val = en.get(k, "MISSING")
    print(k, "| AR:", ar_val, "| EN:", en_val)
