# 🔍 أمثلة عملية للأخطاء والمشاكل

## مثال 1: الفيديو لا يظهر تحت المحاضرة الصحيحة

### السيناريو:
```
المادة: "الرياضيات"
المحاضرات:
  - lecture_key: "lec-1"
    lecture_label: "المقدمة"
    order_index: 1

الفيديو المضاف:
  - title: "شرح أساسيات الجبر"
  - lecture_key: "lec-1"  ✅ محفوظ بشكل صحيح
  - lecture_id: "uuid-123"  ✅ محفوظ بشكل صحيح
```

### المشكلة:
عند عرض صفحة المادة:
1. يتم اختيار المحاضرة `lec-1`
2. يتم جلب الفيديوهات من البيانات
3. **لكن في منطق التصفية (subjects/[subject]/page.tsx السطر 619):**

```typescript
return videos.filter((v) => getLectureInfoFromTitle(v.title).key === key);
```

4. بدلاً من التحقق من `v.lecture_key`، يتم محاولة استنتاج `lecture_key` من العنوان:
   - `getLectureInfoFromTitle("شرح أساسيات الجبر")` → قد يرجع `"other"` أو `"lec-1"`
   - إذا أرجع `"other"`، الفيديو لن يظهر ❌

### الحل:
```typescript
return videos.filter((v) => {
  if (v.lecture_key) {  // ✅ استخدم البيانات المخزنة
    return v.lecture_key === key;
  }
  return getLectureInfoFromTitle(v.title).key === key;
});
```

---

## مثال 2: الملفات لا تظهر إطلاقاً في ManageLecturesModal

### السيناريو:
```
المشرف يفتح ManageLecturesModal للمادة "الرياضيات"
ويختار المحاضرة "lec-1"
```

### ما يحدث:
1. يتم جلب الفيديوهات بنجاح (مع lecture_key) ✅
2. **يتم جلب الملفات بدون lecture_key** ❌

```typescript
// ManageLecturesModal.tsx السطر 545
const { data: filesRes } = await supabase
  .from("files")
  .select("id,title,subject,file_url,description,created_at")  // ❌ بدون lecture_key!
  .eq("subject", subject)
```

3. عند التصفية:
```typescript
const lectureMatch = (row: any) => {
  if (row.lecture_key && String(row.lecture_key).trim() === String(lectureKey).trim()) {
    return true;  // ❌ row.lecture_key === undefined
  }
  const inferredKey = inferLectureKeyFromTitle(row?.title || "", lecturesIndex);
  return inferredKey === lectureKey;  // قد تفشل أيضاً
};

const filteredFiles = (filesRes.data || []).filter(lectureMatch);
```

4. النتيجة: الملفات لا تظهر في المحاضرة الصحيحة ❌

### الحل:
```typescript
.select("id,title,subject,file_url,description,created_at,lecture_key,lecture_id")
```

---

## مثال 3: الـ Cache القديم

### السيناريو:
```
الوقت: 10:00 AM
المشرف يفتح صفحة المادة
- الفيديوهات تُجلب وتُخزن في الـ cache: {video1, video2, video3}

الوقت: 10:15 AM
المشرف يحذف video2 من ManageLecturesModal
- البيانات تُحدّث في قاعدة البيانات ✅
- الـ cache في ManageLecturesModal يُحدّث ✅
- **لكن الـ cache في صفحة المادة لا يُحدّث** ❌

الوقت: 10:20 AM
الطالب يفتح صفحة المادة
- يُسترجع الـ cache من الـ 10:00 AM
- يرى video2 الذي تم حذفه ❌
```

### الحل:
```typescript
// في ManageLecturesModal.tsx
const handleDeleteVideo = async (id: string) => {
  const { error } = await supabase.from("videos").delete().eq("id", id);
  if (!error) {
    setVideos((p) => p.filter((v) => v.id !== id));
    
    // 🔧 إضافة هذا:
    if (queryCache.invalidate && cacheKeys.videos) {
      queryCache.invalidate(cacheKeys.videos());
    }
  }
};
```

---

## مثال 4: استنتاج المحاضرة من العنوان غير موثوق

### السيناريو:
```
الفيديو:
  - title: "شرح الفصل الأول"
  - لا يحتوي على lecture_key في البيانات

المحاضرات:
  - lec-1: "الفصل الأول"
  - lec-2: "الفصل الثاني"
```

### ما يحدث في ManageLecturesModal:
```typescript
function inferLectureKeyFromTitle(title, lecturesIndex) {
  // 1. تحقق من التطابق الدقيق
  const exact = lecturesIndex.find(l =>
    clean(l.lecture_label) === "شرح الفصل الأول"  // ❌ لا يوجد
  );
  
  // 2. تحقق من البادئة
  const prefixMatch = lecturesIndex.find(l =>
    "شرح الفصل الأول".startsWith(clean(l.lecture_label))
    // "الفصل الأول".startsWith("الفصل الأول") → ✅ true
  );
  return prefixMatch.lecture_key;  // ✅ "lec-1"
}
```

✅ **هنا تعمل بشكل صحيح**

### ما يحدث في subjects/[subject]/page.tsx:
```typescript
const getLectureInfoFromTitle = (title) => {
  // منطق مختلف قليلاً
  const prefixMatch = savedLectures.find((l) =>
    "شرح الفصل الأول".toLowerCase().startsWith(
      clean(l.lecture_label).toLowerCase()
    )
    // "شرح الفصل الأول".startsWith("الفصل الأول") → ❌ false!
  );
  
  // قد يرجع "other" بدلاً من "lec-1" ❌
}
```

### المشكلة:
```
lecture_label: "الفصل الأول"
عنوان الفيديو: "شرح الفصل الأول"

في ManageLecturesModal:
"شرح الفصل الأول".startsWith("الفصل الأول") → false
"الفصل الأول".startsWith("الفصل الأول") → true ✅

في subjects/[subject]/page.tsx:
"شرح الفصل الأول".startsWith("الفصل الأول") → false ❌
```

### الحل:
توحيد الدالة واستخدام نفس المنطق في كل مكان

---

## مثال 5: الترتيب الافتراضي غير متسق

### السيناريو:
```
المشرف يضيف محاضرة جديدة بدون تحديد الترتيب
```

### في ManageLecturesModal.tsx (السطر 104):
```typescript
const order = newLecture.orderIndex ? parseInt(newLecture.orderIndex) : 999;
// الترتيب الافتراضي = 999
```

### في subjects/[subject]/page.tsx (السطر 306):
```typescript
const orderIndex = ... ? Math.floor(orderIndexNum) : 999999;
// الترتيب الافتراضي = 999999
```

### التأثير:
```
المحاضرات المرتبة:
1. lec-1: order_index = 1
2. lec-2: order_index = 2
3. lec-3-added-by-modal: order_index = 999  ← سيظهر قبل
4. lec-4-added-by-page: order_index = 999999  ← سيظهر بعد

الترتيب غير متسق! ❌
```

### الحل:
```typescript
// استخدم 999999 دائماً في كل مكان
const order = newLecture.orderIndex ? parseInt(newLecture.orderIndex) : 999999;
```

---

## مثال 6: البيانات القديمة بدون `lecture_id`

### السيناريو:
```
الفيديوهات القديمة (قبل إضافة lecture_id):
{
  id: "video-001",
  title: "محاضرة 1: مقدمة",
  lecture_key: "lec-1",
  lecture_id: null  ← بدون lecture_id
}
```

### ما يحدث:
```typescript
const lectureFilteredVideos = useMemo(() => {
  const key = selectedLectureKey || "other";  // key = "lec-1"

  if (selectedLectureId) {
    return videos.filter((v: any) => v.lecture_id === selectedLectureId);
    // ❌ video-001.lecture_id = null, لن يظهر
  }

  return videos.filter((v) =>
    getLectureInfoFromTitle(v.title).key === key
    // ✅ قد يعمل إذا كان استنتاج العنوان صحيحاً
  );
}, [selectedLectureId, selectedLectureKey, videos]);
```

### المشكلة:
- إذا كان الاستنتاج من العنوان صحيحاً، الفيديو سيظهر ✅
- إذا كان الاستنتاج خاطئاً، الفيديو لن يظهر ❌
- **يعتمد كلياً على دقة استنتاج العنوان**

### الحل:
إضافة migration script:
```sql
UPDATE videos v
SET lecture_id = sl.id
FROM subject_lectures sl
WHERE v.subject = sl.subject
AND v.lecture_key = sl.lecture_key
AND v.lecture_key IS NOT NULL
AND v.lecture_id IS NULL;
```

---

## ✅ الملخص:

| المشكلة | الأثر | الحل |
|--------|------|------|
| الملفات بدون lecture_key في الاستعلام | الملفات لا تظهر في المحاضرة الصحيحة | إضافة lecture_key في SELECT |
| عدم استخدام lecture_key المباشر | اعتماد على استنتاج غير موثوق | تحسين منطق التصفية |
| عدم تحديث الـ cache | بيانات قديمة تظهر للمستخدمين | تحديث الـ cache عند الحذف |
| استنتاج محاضرة مختلف في مكانين | فيديو قد يظهر في مكان خاطئ | توحيد الدالة |
| ترتيب افتراضي غير متسق | ترتيب عشوائي للمحاضرات الجديدة | استخدام 999999 في كل مكان |
| بيانات قديمة بدون lecture_id | اعتماد كامل على استنتاج العنوان | migration script |

---

**تاريخ الإنشاء:** 2 مارس 2026
