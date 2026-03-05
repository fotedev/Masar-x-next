# 🐛 تقرير الأخطاء في منطق إضافة وعرض المحاضرات والمحتوى

## ملخص الأخطاء المكتشفة

تم اكتشاف عدة أخطاء وتناقضات في منطق إضافة المحاضرات والمحتوى (فيديوهات، ملفات، اختبارات) وكيفية عرضها.

---

## 🔴 **الخطأ 1: عدم حفظ `lecture_key` في جدول الفيديوهات والملفات**

### المشكلة:
في ملف [AddVideoForm.tsx](src/app/[locale]/add-video/AddVideoForm.tsx) (السطور 100-140):
```typescript
const videoData = {
  title: formData.title,
  subject: formData.subject,
  url: formData.url,
  language: formData.language,
  user_id: user?.id,
  lecture_key: lectureKey || null,  // ✅ يتم حفظه
  lecture_id: lectureId,
};
```

**لكن المشكلة:**
- يتم حفظ `lecture_key` عند إضافة الفيديو
- **ولكن** في `ManageLecturesModal` عند جلب الفيديوهات (السطور 533-545)، يتم البحث عنها بدون تصفية صريحة بـ `lecture_key`

### الحل المقترح:
تعديل استعلام جلب الفيديوهات في `ManageLecturesModal` (السطور 495-545):
```typescript
// قبل التصفية:
const filteredVideos = (videosRes.data || []).filter(lectureMatch);

// بعد التصفية - يجب أن تكون الدالة lectureMatch تتحقق من lecture_key أولاً
const lectureMatch = (row: any) => {
  // 1. تحقق من lecture_key المخزن بشكل صريح
  if (row.lecture_key && String(row.lecture_key).trim() === String(lectureKey).trim()) {
    return true;
  }
  // ...
};
```

---

## ✅ **الخطأ 2: حفظ `lecture_key` في الملفات (FIXED)**

### الحالة:
✅ **تم إصلاحه بالفعل** - في [AddFileForm.tsx](src/app/[locale]/add-file/AddFileForm.tsx) (السطور 130-145):
```typescript
const fileData = {
  title: formData.title,
  subject: formData.subject,
  file_url: finalFileUrl,
  description: formData.description,
  user_id: user?.id,
  lecture_key: lectureKey || null,  // ✅ يتم حفظه
  lecture_id: lectureId,  // ✅ يتم حفظه
};
```

**لكن** المشكلة تبقى في [ManageLecturesModal.tsx](src/components/ManageLecturesModal.tsx) (السطور 545-560)، حيث لا يتم جلب `lecture_key` و `lecture_id`:
```typescript
supabase
  .from("files")
  .select("id,title,subject,file_url,description,created_at")
  // ❌ لا يوجد lecture_key و lecture_id في SELECT
  .eq("subject", subject)
```

### الحل المقترح:
عدّل استعلام `ManageLecturesModal` ليشمل `lecture_key` و `lecture_id`:
```typescript
.select("id,title,subject,file_url,description,created_at,lecture_key,lecture_id")
```

---

## 🔴 **الخطأ 3: عدم توافق منطق التطابق بين الفيديوهات والملفات والملخصات**

### المشكلة:
في [ManageLecturesModal.tsx](src/components/ManageLecturesModal.tsx) (السطور 568-596)، دالة `inferLectureKeyFromTitle` تحاول استنتاج `lecture_key` من العنوان، **لكن هذا المنطق مختلف تماماً** عن منطق `getLectureInfoFromTitle` في [subjects/[subject]/page.tsx](src/app/[locale]/subjects/[subject]/page.tsx) (السطور 342-475)

### مثال على عدم التوافق:
**في ManageLecturesModal:**
```typescript
const inferLectureKeyFromTitle = (title: string, ...) => {
  // منطق مختلف
  const exact = lecturesIndex.find((l) => {
    const key = (l.lecture_key || "").trim().toLowerCase();
    const label = clean(l.lecture_label || "");
    return key === normalizedTitle || label === normalizedTitle;
  });
```

**في subjects/[subject]/page.tsx:**
```typescript
const getLectureInfoFromTitle = (title: string) => {
  // منطق مختلف
  const exactMatch = savedLectures.find(
    (l) =>
      l.lecture_label.trim().toLowerCase() === t.toLowerCase() ||
      l.lecture_key.trim().toLowerCase() === t.toLowerCase(),
  );
```

### التأثير:
- الفيديو قد يحفظ بـ `lecture_key: "lec-1"` 
- لكن عند عرضه قد لا يُرتبط بالمحاضرة الصحيحة بسبب اختلاف المنطق

---

## 🔴 **الخطأ 4: نقص في معالجة `lecture_id` مقابل `lecture_key`**

### المشكلة:
في جدول قاعدة البيانات، كل من الفيديوهات والملخصات والملفات و الاختبارات تحتوي على:
- `lecture_key` (مثل "lec-1")
- `lecture_id` (معرّف unique للمحاضرة من جدول subject_lectures)

**المشكلة:** عند جلب المحتوى، يتم استخدام أحياناً `lecture_key` فقط وأحياناً `lecture_id`:

من [subjects/[subject]/page.tsx](src/app/[locale]/subjects/[subject]/page.tsx) (السطور 599-618):
```typescript
const lectureFilteredVideos = useMemo(() => {
  const key = selectedLectureKey || "other";

  if (selectedLectureId) {
    return videos.filter((v: any) => v.lecture_id === selectedLectureId);
  }

  return videos.filter((v) => getLectureInfoFromTitle(v.title).key === key);
}, [selectedLectureId, selectedLectureKey, videos]);
```

### المشكلة:
- إذا كان `lecture_id` موجوداً في البيانات، سيتم استخدامه
- **لكن** إذا لم يكن موجوداً أو كان `null`، سيتم الاعتماد على استنتاج `key` من العنوان
- **هذا قد يؤدي إلى عدم ظهور المحتوى إذا كان العنوان لا يتطابق مع المنطق**

---

## 🔴 **الخطأ 5: عدم تحديث `lecture_id` عند جلب الفيديوهات والملفات من قاعدة البيانات**

### المشكلة:
في [useVideos.ts](src/hooks/useVideos.ts) و [useFiles.ts](src/hooks/useFiles.ts)، عند جلب البيانات:
```typescript
const { data, error } = await supabase
  .from("videos")
  .select("*")  // يتم جلب كل شيء بما فيه lecture_key و lecture_id
  .eq("subject", subject)
  .order("created_at", { ascending: false });
```

**المشكلة:**
- `lecture_id` قد يكون null أو undefined للفيديوهات القديمة
- لا توجد آلية لتحديث `lecture_id` بناءً على `lecture_key`

### الحل المقترح:
إضافة migration script لملء `lecture_id` للبيانات القديمة:
```sql
-- تحديث الفيديوهات بـ lecture_id بناءً على lecture_key
UPDATE videos v
SET lecture_id = sl.id
FROM subject_lectures sl
WHERE v.subject = sl.subject
AND v.lecture_key = sl.lecture_key
AND v.lecture_id IS NULL;

-- تحديث الملفات بـ lecture_id بناءً على lecture_key
UPDATE files f
SET lecture_id = sl.id
FROM subject_lectures sl
WHERE f.subject = sl.subject
AND f.lecture_key = sl.lecture_key
AND f.lecture_id IS NULL;
```

---

## 🟡 **الخطأ 6: منطق الترتيب غير واضح**

### المشكلة:
في [ManageLecturesModal.tsx](src/components/ManageLecturesModal.tsx) (السطور 83-110)، عند إضافة محاضرة جديدة:
```typescript
const order = newLecture.orderIndex
  ? parseInt(newLecture.orderIndex)
  : 999;
```

**لكن** في [subjects/[subject]/page.tsx](src/app/[locale]/subjects/[subject]/page.tsx) (السطور 306-312):
```typescript
const orderIndex =
  typeof orderIndexNum === "number" &&
  Number.isFinite(orderIndexNum) &&
  orderIndexNum >= 0
    ? Math.floor(orderIndexNum)
    : 999999;  // ← رقم مختلف!
```

### المشكلة:
- الترتيب الافتراضي في `ManageLecturesModal` هو `999`
- الترتيب الافتراضي في `subjects/[subject]/page.tsx` هو `999999`
- هذا قد يسبب مشاكل في الترتيب النهائي

---

## 🟡 **الخطأ 7: عدم تحديث الـ cache عند إضافة محتوى جديد**

### المشكلة:
في [ManageLecturesModal.tsx](src/components/ManageLecturesModal.tsx)، بعد حذف فيديو أو ملف:
```typescript
const handleDeleteVideo = async (id: string) => {
  const confirmed = await confirmToast("...");
  if (!confirmed) return;
  const { error } = await supabase.from("videos").delete().eq("id", id);
  if (!error) setVideos((p) => p.filter((v) => v.id !== id));
};
```

**المشكلة:**
- لا يتم تحديث الـ cache في `queryCache`
- الصفحة الرئيسية قد تظهر بيانات قديمة من الـ cache

### الحل المقترح:
```typescript
const handleDeleteVideo = async (id: string) => {
  const confirmed = await confirmToast("...");
  if (!confirmed) return;
  const { error } = await supabase.from("videos").delete().eq("id", id);
  if (!error) {
    setVideos((p) => p.filter((v) => v.id !== id));
    // تحديث الـ cache
    queryCache.invalidate(cacheKeys.videos?.() || "videos");
  }
};
```

---

## 🔴 **الخطأ 8: منطق التصفية يفتقد الـ `lecture_key` عند جلب البيانات مباشرة**

### المشكلة:
في [ManageLecturesModal.tsx](src/components/ManageLecturesModal.tsx) (السطور 533-546)، عند جلب الفيديوهات والملفات:

```typescript
const [summariesRes, videosRes, filesRes, quizzesRes] =
  await Promise.all([
    // ... summaries
    supabase
      .from("videos")
      .select("id,title,subject,url,language,created_at,lecture_key")  // ✅ يحتوي على lecture_key
      .eq("subject", subject),
    supabase
      .from("files")
      .select("id,title,subject,file_url,description,created_at")  // ❌ بدون lecture_key!
      .eq("subject", subject),
    // ... quizzes
  ]);
```

### التأثير:
- الفيديوهات تُرتبط بالمحاضرات بشكل صحيح عبر `lecture_key`
- **الملفات لا تحتوي على `lecture_key` في الاستعلام، لذا يتم عرضها بشكل خاطئ**

### الحل:
```typescript
supabase
  .from("files")
  .select("id,title,subject,file_url,description,created_at,lecture_key,lecture_id")
  .eq("subject", subject)
```

---

## 🔴 **الخطأ 9: عدم توافق منطق التصفية عند استخدام البيانات المباشرة vs الاستنتاج من العنوان**

### المشكلة:
في [subjects/[subject]/page.tsx](src/app/[locale]/subjects/[subject]/page.tsx) (السطور 595-630)، منطق التصفية يحتوي على:

```typescript
const lectureFilteredVideos = useMemo(() => {
  const key = selectedLectureKey || "other";

  if (selectedLectureId) {
    return videos.filter((v: any) => v.lecture_id === selectedLectureId);
  }

  return videos.filter((v) => getLectureInfoFromTitle(v.title).key === key);
}, [selectedLectureId, selectedLectureKey, videos]);
```

### المشكلة:
- إذا كان `selectedLectureId` موجوداً، يتم استخدامه للتصفية ✅
- **لكن** إذا كان `null` أو undefined، يتم الاعتماد على استنتاج `key` من العنوان
- **المشكلة الكبرى:** الفيديو قد يحتوي على `lecture_key` مخزن في قاعدة البيانات، **لكن لا يتم استخدامه!**

### مثال على المشكلة:
```
الفيديو:
- title: "شرح المحاضرة"
- lecture_key: "lec-1" (محفوظ في DB)
- lecture_id: "uuid-1234"

التصفية:
1. إذا كان selectedLectureId = "uuid-1234" → ✅ يتم عرضه بشكل صحيح
2. إذا كان selectedLectureId = null → يتم البحث عن "lec-1" في العنوان
   - getLectureInfoFromTitle("شرح المحاضرة") → قد يرجع "other" أو "lec-X"
   - النتيجة: الفيديو لا يظهر أو يظهر تحت محاضرة خاطئة ❌
```

### الحل المقترح:
عدّل منطق التصفية لاستخدام `lecture_key` من البيانات إذا كان موجوداً:
```typescript
const lectureFilteredVideos = useMemo(() => {
  const key = selectedLectureKey || "other";

  if (selectedLectureId) {
    return videos.filter((v: any) => v.lecture_id === selectedLectureId);
  }

  // تحسين: تحقق من lecture_key المخزن أولاً قبل الاستنتاج من العنوان
  return videos.filter((v) => {
    // إذا كان lecture_key موجوداً في البيانات، استخدمه
    if (v.lecture_key) {
      return v.lecture_key === key;
    }
    // وإلا استنتج من العنوان
    return getLectureInfoFromTitle(v.title).key === key;
  });
}, [selectedLectureId, selectedLectureKey, videos]);
```

**الشيء نفسه ينطبق على:**
- `lectureFilteredSummaries` (السطور 588-595)
- `lectureFilteredFiles` (السطور 617-625)
- `lectureFilteredQuizzes` (السطور 627-640)

---

## 🔴 **الخطأ 10: عدم وجود آلية لملء `lecture_id` للبيانات القديمة**

### المشكلة:
الفيديوهات والملفات القديمة قد لا تحتوي على `lecture_id`:
```typescript
// فيديو قديم
{
  id: "video-001",
  lecture_key: "lec-1",
  lecture_id: null  // ❌ بدون lecture_id
}
```

### التأثير:
- سيتم الاعتماد دائماً على الاستنتاج من العنوان
- الفيديو قد لا يظهر في المحاضرة الصحيحة إذا كان العنوان غير واضح

### الحل:
إضافة migration script:
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

## 🔴 **الخطأ 11: عدم تحديث الـ cache عند حذف المحتوى في ManageLecturesModal**

### المشكلة:
عند حذف فيديو أو ملف في [ManageLecturesModal.tsx](src/components/ManageLecturesModal.tsx) (السطور 660-680):

```typescript
const handleDeleteVideo = async (id: string) => {
  const confirmed = await confirmToast("هل أنت متأكد من حذف هذا الفيديو؟", {
    confirmLabel: "حذف",
    cancelLabel: "إلغاء",
  });
  if (!confirmed) return;
  const { error } = await supabase.from("videos").delete().eq("id", id);
  if (!error) setVideos((p) => p.filter((v) => v.id !== id));
  // ❌ لا يوجد تحديث للـ cache!
};
```

### التأثير:
- الفيديو يتم حذفه من قائمة ManageLecturesModal بنجاح
- **لكن** صفحة المادة (subjects/[subject]/page.tsx) قد تظل تُظهر الفيديو المحذوف من الـ cache

### الحل:
```typescript
const handleDeleteVideo = async (id: string) => {
  const confirmed = await confirmToast("...");
  if (!confirmed) return;
  try {
    const { error } = await supabase.from("videos").delete().eq("id", id);
    if (!error) {
      setVideos((p) => p.filter((v) => v.id !== id));
      // تحديث الـ cache
      if (cacheKeys.videos) {
        queryCache.invalidate(cacheKeys.videos());
      }
    }
  } catch (error) {
    console.error("Error deleting video:", error);
  }
};
```

---

## 🟡 **الخطأ 12: عدم توافق منطق استنتاج المحاضرة بين الملفين**

### المشكلة:
هناك دالتان مختلفتان لاستنتاج المحاضرة:

**في ManageLecturesModal (السطور 578-631):**
```typescript
function inferLectureKeyFromTitle(title, lecturesIndex) {
  // منطق معقد مع delimiter matching و substring matching
  const titleParts = t.split(/[:\-\|]/).map((p) => clean(p));
  // ...
}
```

**في subjects/[subject]/page.tsx (السطور 342-475):**
```typescript
const getLectureInfoFromTitle = (title, quizDescription?) => {
  // منطق مختلف قليلاً
  const prefixMatch = savedLectures.find((l) =>
    t.toLowerCase().startsWith(l.lecture_label.trim().toLowerCase()),
  );
  // ...
}
```

### التأثير:
- الفيديو المضاف عبر add-video قد يُحفظ بـ `lecture_key: "lec-1"`
- لكن عند عرضه، قد يتم استنتاج `lecture_key` مختلف من العنوان

### الحل:
- **توحيد الدالة:** نقل `getLectureInfoFromTitle` إلى utility file مشترك
- استخدام نفس الدالة في كل مكان

---

## 🟡 **الخطأ 13: عدم استخدام `lecture_key` المباشر عند جلب المحتوى**

### المشكلة:
في [ManageLecturesModal.tsx](src/components/ManageLecturesModal.tsx) (السطور 595-620)، بعد جلب الفيديوهات:

```typescript
const lectureMatch = (row: any) => {
  // 1. تحقق من lecture_key المخزن
  if (
    row.lecture_key &&
    String(row.lecture_key).trim() === String(lectureKey).trim()
  )
    return true;

  // 2. وإلا استنتج من العنوان
  const inferredKey = inferLectureKeyFromTitle(
    row?.title || "",
    lecturesIndex,
  );
  return inferredKey === lectureKey;
};
```

**المشكلة:** الترتيب صحيح، لكن `lectureKey` يُستخدم من المكون الأب.

**المشكلة الحقيقية:** في الملفات لا يوجد `lecture_key` في SELECT (الخطأ 8)!

---

## ✅ **الحل الشامل النهائي:**

### 1️⃣ تصحيح استعلامات قاعدة البيانات:
```typescript
// في ManageLecturesModal.tsx - السطور 541
.select("id,title,subject,file_url,description,created_at,lecture_key,lecture_id")  // أضف lecture_key و lecture_id
```

### 2️⃣ توحيد منطق استنتاج المحاضرة:
- نقل `getLectureInfoFromTitle` إلى `src/utils/lecture-inference.ts`
- استخدامها في كل مكان

### 3️⃣ تحسين منطق التصفية:
```typescript
// استخدم lecture_key المباشر إن وُجد
return videos.filter((v) => {
  if (v.lecture_key) return v.lecture_key === key;
  return getLectureInfoFromTitle(v.title).key === key;
});
```

### 4️⃣ إضافة migration script:
```sql
-- ملء lecture_id للبيانات القديمة بناءً على lecture_key
UPDATE videos v SET lecture_id = sl.id
FROM subject_lectures sl
WHERE v.subject = sl.subject AND v.lecture_key = sl.lecture_key
AND v.lecture_key IS NOT NULL AND v.lecture_id IS NULL;
-- نفس الشيء للملفات والملخصات
```

### 5️⃣ تحديث الـ cache بشكل صحيح:
```typescript
if (!error) {
  setVideos((p) => p.filter((v) => v.id !== id));
  queryCache.invalidate(cacheKeys.videos?.() || "videos");
}
```

### 6️⃣ الترتيب الافتراضي:
```typescript
// استخدم 999999 دائماً للترتيب الافتراضي (بدلاً من 999 في بعض الأماكن)
const order = newLecture.orderIndex ? parseInt(newLecture.orderIndex) : 999999;
```

---

## 📍 الملفات المتأثرة:
1. [src/components/ManageLecturesModal.tsx](src/components/ManageLecturesModal.tsx)
2. [src/app/[locale]/add-video/AddVideoForm.tsx](src/app/[locale]/add-video/AddVideoForm.tsx)
3. [src/app/[locale]/subjects/[subject]/page.tsx](src/app/[locale]/subjects/[subject]/page.tsx)
4. [src/hooks/useVideos.ts](src/hooks/useVideos.ts)
5. [src/hooks/useFiles.ts](src/hooks/useFiles.ts)
6. قاعدة البيانات (migrations)

---

**التاريخ:** 2 مارس 2026
