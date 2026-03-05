# 📋 خطة التصحيحات المقترحة

## الأولويات:

### 1️⃣ **عالية (Critical)** - يجب إصلاحها فوراً

#### تصحيح #1: إضافة `lecture_key` و `lecture_id` في استعلام الملفات في ManageLecturesModal

**الملف:** [src/components/ManageLecturesModal.tsx](src/components/ManageLecturesModal.tsx)
**السطر:** ~545

**التغيير:**
```typescript
// من:
supabase
  .from("files")
  .select("id,title,subject,file_url,description,created_at")
  .eq("subject", subject)

// إلى:
supabase
  .from("files")
  .select("id,title,subject,file_url,description,created_at,lecture_key,lecture_id")
  .eq("subject", subject)
```

---

#### تصحيح #2: تحسين منطق التصفية لاستخدام `lecture_key` المباشر

**الملف:** [src/app/[locale]/subjects/[subject]/page.tsx](src/app/[locale]/subjects/[subject]/page.tsx)
**السطور:** 595-630

**التغيير:**
```typescript
const lectureFilteredVideos = useMemo(() => {
  const key = selectedLectureKey || "other";

  if (selectedLectureId) {
    return videos.filter((v: any) => v.lecture_id === selectedLectureId);
  }

  // تحسين: استخدم lecture_key المباشر إن وُجد
  return videos.filter((v) => {
    if (v.lecture_key) {
      return v.lecture_key === key;
    }
    return getLectureInfoFromTitle(v.title).key === key;
  });
}, [selectedLectureId, selectedLectureKey, videos]);

const lectureFilteredFiles = useMemo(() => {
  const key = selectedLectureKey || "other";

  if (selectedLectureId) {
    return files.filter((f: any) => f.lecture_id === selectedLectureId);
  }

  // تحسين: استخدم lecture_key المباشر إن وُجد
  return files.filter((f) => {
    if (f.lecture_key) {
      return f.lecture_key === key;
    }
    return getLectureInfoFromTitle(f.title).key === key;
  });
}, [files, selectedLectureId, selectedLectureKey]);

// نفس الشيء لـ lectureFilteredSummaries و lectureFilteredQuizzes
```

---

#### تصحيح #3: تحديث الـ cache عند حذف المحتوى

**الملف:** [src/components/ManageLecturesModal.tsx](src/components/ManageLecturesModal.tsx)
**السطور:** 660-680

**التغيير:**
```typescript
const handleDeleteVideo = async (id: string) => {
  const confirmed = await confirmToast("هل أنت متأكد من حذف هذا الفيديو؟", {
    confirmLabel: "حذف",
    cancelLabel: "إلغاء",
  });
  if (!confirmed) return;
  try {
    const { error } = await supabase.from("videos").delete().eq("id", id);
    if (!error) {
      setVideos((p) => p.filter((v) => v.id !== id));
      // تحديث الـ cache
      const cacheKey = cacheKeys.videos?.() || "videos";
      if (queryCache.invalidate) {
        queryCache.invalidate(cacheKey);
      }
    }
  } catch (error) {
    console.error("Error deleting video:", error);
  }
};

// نفس التغيير لـ handleDeleteFile و handleDeleteQuiz
```

---

### 2️⃣ **متوسطة (Medium)** - يجب إصلاحها لاحقاً

#### تصحيح #4: توحيد الترتيب الافتراضي

**الملفات:**
- [src/components/ManageLecturesModal.tsx](src/components/ManageLecturesModal.tsx) - السطر 104
- [src/app/[locale]/subjects/[subject]/page.tsx](src/app/[locale]/subjects/[subject]/page.tsx) - السطر 306

**التغيير:**
```typescript
// استخدم 999999 دائماً بدلاً من 999
const order = newLecture.orderIndex
  ? parseInt(newLecture.orderIndex)
  : 999999;  // بدلاً من 999
```

---

#### تصحيح #5: نقل منطق استنتاج المحاضرة إلى utility file مشترك

**إنشاء ملف جديد:** [src/utils/lecture-inference.ts](src/utils/lecture-inference.ts)

```typescript
import { Subject } from "@/types/database";

interface LectureInfo {
  key: string;
  label: string;
  order: number;
}

/**
 * استنتج معلومات المحاضرة من العنوان
 * يتم استخدام هذه الدالة في كل مكان بدلاً من نسخ الكود
 */
export function getLectureInfoFromTitle(
  title: string,
  quizDescription?: string,
  savedLectures: Array<{
    id: string;
    lecture_key: string;
    lecture_label: string;
    order_index: number;
  }> = []
): LectureInfo {
  // نقل كل الكود من subjects/[subject]/page.tsx (السطور 342-475)
  // ...
}

/**
 * هذه دالة مساعدة لتنظيف وتطبيع النصوص
 */
export function normalizeText(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
```

---

#### تصحيح #6: إضافة migration script لملء `lecture_id`

**ملف migration جديد:** `supabase/migrations/[timestamp]_fill_lecture_ids.sql`

```sql
-- ملء lecture_id للفيديوهات بناءً على lecture_key
UPDATE videos v
SET lecture_id = sl.id
FROM subject_lectures sl
WHERE v.subject = sl.subject
AND v.lecture_key = sl.lecture_key
AND v.lecture_key IS NOT NULL
AND v.lecture_id IS NULL;

-- ملء lecture_id للملفات
UPDATE files f
SET lecture_id = sl.id
FROM subject_lectures sl
WHERE f.subject = sl.subject
AND f.lecture_key = sl.lecture_key
AND f.lecture_key IS NOT NULL
AND f.lecture_id IS NULL;

-- ملء lecture_id للملخصات
UPDATE summaries s
SET lecture_id = sl.id
FROM subject_lectures sl
WHERE s.subject = sl.subject
AND s.lecture_key = sl.lecture_key
AND s.lecture_key IS NOT NULL
AND s.lecture_id IS NULL;
```

---

### 3️⃣ **منخفضة (Low)** - تحسينات مستقبلية

#### تحسين #1: إضافة اختبارات للمنطق
- اختبار استنتاج المحاضرة من عناوين مختلفة
- اختبار التصفية بـ lecture_key و lecture_id
- اختبار تحديث الـ cache

#### تحسين #2: تسجيل أفضل (Logging)
```typescript
if (v.lecture_key) {
  console.debug(`Filtering video by lecture_key: ${v.lecture_key}`);
  return v.lecture_key === key;
}
console.debug(`Filtering video by inferred title: ${v.title}`);
```

#### تحسين #3: معالجة الأخطاء الأفضل
- إضافة error boundaries حول جلب البيانات
- إظهار رسائل خطأ واضحة للمستخدم

---

## ✅ خطة الاختبار:

### الحالة 1: إضافة محاضرة وفيديو جديد
```
1. انتقل إلى صفحة المادة
2. اضغط على إضافة محاضرة
3. أضف "محاضرة 1: المقدمة"
4. الذهاب إلى صفحة إضافة فيديو
5. اختر المحاضرة من query parameter
6. أضف فيديو بعنوان بسيط
7. تحقق من ظهور الفيديو تحت المحاضرة الصحيحة
```

### الحالة 2: إضافة فيديو بدون ربطه بمحاضرة
```
1. أضف فيديو بدون lecture parameter
2. تحقق من ظهوره تحت "غير مصنف"
3. تغيير اسم الفيديو ليتضمن رقم محاضرة
4. تحقق من انتقاله للمحاضرة الصحيحة
```

### الحالة 3: حذف محتوى
```
1. احذف فيديو من ManageLecturesModal
2. تحقق من اختفاؤه من قائمة الفيديوهات فوراً
3. انتقل إلى صفحة المادة وتحقق من عدم ظهوره
```

---

## 📊 مدة التصحيح المتوقعة:

| التصحيح | المدة | الأولوية |
|--------|------|---------|
| #1: إضافة lecture_key في الملفات | 5 دقائق | عالية |
| #2: تحسين منطق التصفية | 30 دقيقة | عالية |
| #3: تحديث cache | 15 دقيقة | عالية |
| #4: توحيد الترتيب | 10 دقائق | متوسطة |
| #5: utility file مشترك | 45 دقيقة | متوسطة |
| #6: migration script | 20 دقيقة | متوسطة |
| **المجموع** | **2 ساعة** | |

---

## 🎯 النقاط الرئيسية:

1. ✅ **الفيديوهات والملفات تحفظ بـ `lecture_key` و `lecture_id` بشكل صحيح**
2. ❌ **المشاكل الرئيسية في الاستعلامات والتصفية وليس في الحفظ**
3. ⚠️ **الاعتماد على استنتاج المحاضرة من العنوان قد يكون غير موثوق**
4. 🔄 **عدم تحديث الـ cache بشكل صحيح يسبب بيانات قديمة**

---

**تاريخ الإنشاء:** 2 مارس 2026
**آخر تحديث:** 2 مارس 2026
