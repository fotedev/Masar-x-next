# 🗺️ خريطة الأخطاء والملفات

## 📊 مخطط العلاقات

```
┌─────────────────────────────────────────────────────────────────┐
│                    المشروع الكامل                              │
│                  masarx_next App                                 │
└─────────────────────────────────────────────────────────────────┘
                                 │
                ┌────────────────┼────────────────┐
                │                │                │
       ┌────────▼────────┐  ┌────▼─────┐  ┌─────▼─────────┐
       │  إضافة المحتوى │  │  إدارة   │  │  عرض المحتوى  │
       │   (Add Pages)   │  │ المحاضرات│  │ (Subject Page)│
       └────────┬────────┘  └────┬─────┘  └────────┬──────┘
                │                │                │
     ┌──────────┴──────────┐     │      ┌─────────┴─────────┐
     │                     │     │      │                   │
┌────▼──────┐  ┌──────────▼──┐   │   ┌──▼────────┐  ┌──────▼──────┐
│AddVideoForm│  │AddFileForm  │   │   │ useVideos│  │  useFiles   │
│    ✅      │  │    ✅       │   │   │    ⚠️    │  │     ⚠️      │
└────────────┘  └─────────────┘   │   └──────────┘  └─────────────┘
    Errors: 0      Errors: 0       │   Errors: 1       Errors: 1
                                   │
                        ┌──────────▼──────────┐
                        │ManageLecturesModal  │
                        │        ❌           │
                        └─────────┬───────────┘
                                  │
                         Errors: 3
                   - Missing lecture_key in files query
                   - Cache not updated on delete
                   - Different inference logic


┌─────────────────────────────────────────────────────────────────┐
│            subjects/[subject]/page.tsx                            │
│                      ❌❌❌                                        │
│         (الملف الأكثر مشاكل)                                    │
└─────────────────────────────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
            Errors: 4                  Multiple Issues:
                    │                         │
    - Different inference logic      - Not using lecture_key
    - Not using lecture_key          - Filter logic flawed
    - Order default mismatch         - Cache handling
```

---

## 🔗 تتبع الأخطاء عبر الملفات

### الخطأ #1: عدم حفظ `lecture_key`
```
AddVideoForm.tsx ───────────► يحفظ ✅
AddFileForm.tsx ────────────► يحفظ ✅
ManageLecturesModal ────────► لا يجلب ❌
subjects/[subject] ─────────► لا يستخدم ❌
```

### الخطأ #2: استعلام الملفات
```
AddFileForm.tsx ──────────► يحفظ lecture_key ✅
ManageLecturesModal ──────► لا يجلب lecture_key ❌
```

### الخطأ #3: منطق استنتاج مختلف
```
ManageLecturesModal ──────► inferLectureKeyFromTitle()
subjects/[subject] ───────► getLectureInfoFromTitle()
                          (مختلف!)
```

### الخطأ #6: الترتيب الافتراضي
```
ManageLecturesModal ──────► order_index: 999
subjects/[subject] ───────► order_index: 999999
                          (غير متسق!)
```

### الخطأ #8: الملفات بدون lecture_key
```
قاعدة البيانات ───────────► files table
                          ├── lecture_key ✅
                          ├── lecture_id ✅
                          
ManageLecturesModal ──────► .select("... ,created_at")
                          └── بدون lecture_key ❌
```

### الخطأ #9: عدم استخدام lecture_key
```
قاعدة البيانات ───────────► video.lecture_key = "lec-1" ✅
subjects/[subject] ───────► filter((v) => getLectureInfoFromTitle(v.title).key)
                          └── يستنتج من العنوان بدلاً من lecture_key ❌
```

### الخطأ #11: الـ Cache
```
ManageLecturesModal ──────► handleDeleteVideo()
                          └── setVideos() فقط ✅
                             └── لا يحدّث queryCache ❌
subjects/[subject] ───────► استعلام من queryCache
                          └── يظهر البيانات القديمة ❌
```

---

## 📍 خريطة الملفات والأسطر

```
src/
├── components/
│   └── ManageLecturesModal.tsx
│       ├── Line 83-110:    إضافة محاضرة (✅ صحيح)
│       ├── Line 542-560:   ❌ استعلام الملفات بدون lecture_key
│       ├── Line 578-631:   ❌ منطق استنتاج مختلف
│       ├── Line 660-680:   ❌ حذف بدون تحديث cache
│       └── Line 595-620:   منطق التصفية
│
├── app/[locale]/
│   ├── add-video/
│   │   └── AddVideoForm.tsx
│   │       └── Line 100-140: ✅ حفظ صحيح
│   │
│   ├── add-file/
│   │   └── AddFileForm.tsx
│   │       └── Line 130-145: ✅ حفظ صحيح
│   │
│   └── subjects/[subject]/
│       └── page.tsx
│           ├── Line 342-475: ❌ منطق استنتاج مختلف
│           ├── Line 306-312: ❌ ترتيب افتراضي 999999
│           ├── Line 588-640: ❌ منطق تصفية معتمد على استنتاج
│           └── Line 595-630: ❌ عدم استخدام lecture_key
│
└── hooks/
    ├── useVideos.ts
    │   └── Line 40-50: ⚠️ جلب lecture_key (صحيح)
    │
    └── useFiles.ts
        └── Line 40-50: ⚠️ جلب lecture_key (صحيح)
```

---

## 🎯 تسلسل البيانات

### المسار الصحيح:
```
المستخدم يضيف فيديو
    ↓
AddVideoForm.tsx (Form submission)
    ↓
استعلام قاعدة البيانات:
  - منح lecture_id من subject_lectures
  - حفظ: title, subject, url, lecture_key, lecture_id ✅
    ↓
قاعدة البيانات:
  - videos table
  - lecture_key: "lec-1" ✅
  - lecture_id: "uuid-123" ✅
    ↓
subjects/[subject]/page.tsx
    ↓
جلب الفيديوهات:
  - useVideos() → يجلب كل الحقول بما فيه lecture_key ✅
    ↓
لكن التصفية:
  - يستنتج من العنوان بدلاً من lecture_key ❌
    ↓
النتيجة: الفيديو قد لا يظهر في المحاضرة الصحيحة ❌
```

### المسار الصحيح (بعد التصحيح):
```
المستخدم يضيف فيديو
    ↓
AddVideoForm.tsx (Form submission)
    ↓
استعلام قاعدة البيانات:
  - منح lecture_id من subject_lectures
  - حفظ: title, subject, url, lecture_key, lecture_id ✅
    ↓
قاعدة البيانات:
  - videos table
  - lecture_key: "lec-1" ✅
  - lecture_id: "uuid-123" ✅
    ↓
subjects/[subject]/page.tsx
    ↓
جلب الفيديوهات:
  - useVideos() → يجلب كل الحقول بما فيه lecture_key ✅
    ↓
التصفية (محسّنة):
  - إذا كان v.lecture_key موجود → استخدمه ✅
  - وإلا → استنتج من العنوان ✅
    ↓
النتيجة: الفيديو يظهر في المحاضرة الصحيحة ✅
```

---

## 🔄 تدفق الأخطاء

```
الخطأ في استعلام الملفات (❌ #8)
    ↓
الملفات لا تحتوي على lecture_key
    ↓
منطق التصفية في ManageLecturesModal (❌ #13)
    ↓
الملفات لا تُرتبط بالمحاضرات الصحيحة
    ↓
عدم تحديث cache (❌ #11)
    ↓
بيانات قديمة تظهر في الصفحة الرئيسية
    ↓
النتيجة: مستخدم محتبس ❌


منطق استنتاج مختلف (❌ #3 & #12)
    ↓
ManageLecturesModal يستنتج "lec-1"
    ↓
subjects/[subject] يستنتج "other"
    ↓
نفس الفيديو يظهر في مكانين مختلفين
    ↓
النتيجة: بيانات غير متسقة ❌


عدم استخدام lecture_key المباشر (❌ #9)
    ↓
الاعتماد كلياً على استنتاج من العنوان
    ↓
فيديو بعنوان غامض لا يظهر
    ↓
النتيجة: محتوى مفقود ❌
```

---

## 📈 شدة الأخطاء

```
🔴 حرجة (Critical) - تؤثر على الوظائف الأساسية:
   - الملفات لا تظهر (#8)
   - Cache القديم يظهر (#11)
   - Lecture_key غير مستخدم (#9)

🟡 متوسطة (Medium) - تؤثر على الاستقرار:
   - منطق استنتاج مختلف (#3, #12)
   - ترتيب غير متسق (#6)
   - بيانات قديمة بدون lecture_id (#10)

🟢 خفيفة (Minor) - تحسينات:
   - عدم توثيق الأخطاء
   - عدم وجود اختبارات
   - معالجة أخطاء ضعيفة
```

---

## ✅ التأثير على الوظائف

```
إضافة محاضرة:        ✅ يعمل بشكل صحيح
إضافة فيديو:         ✅ يعمل بشكل صحيح (يحفظ lecture_key)
إضافة ملف:          ✅ يعمل بشكل صحيح (يحفظ lecture_key)
عرض المحاضرات:       ❌ قد لا تظهر بشكل صحيح
  - الفيديوهات:      ⚠️ قد تظهر في مكان خاطئ
  - الملفات:        ❌ لن تظهر
  - الاختبارات:      ⚠️ قد تظهر في مكان خاطئ
حذف محتوى:          ❌ لا يحدّث الـ cache
البحث:              ⚠️ قد يجد بيانات قديمة
التصفية:            ❌ تعتمد على استنتاج غير موثوق
الترتيب:            ⚠️ غير متسق للمحاضرات الجديدة
```

---

**تاريخ الخريطة:** 2 مارس 2026
