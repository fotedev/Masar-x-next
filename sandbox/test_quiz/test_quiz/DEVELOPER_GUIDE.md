# دليل المطور - Masar X Quiz Tester Extension

## 🎯 نظرة عامة

هذا الامتداد مصمم خصيصاً لاختبار نظام الامتحانات في مشروع Masar X. يعتمد على فهم هيكل الكود الحقيقي للـ QuizPlayer component.

## 🔍 كيفية عمل البحث عن العناصر

### عناصر الامتحان المستهدفة

بناءً على `src/components/QuizPlayer.tsx`، يبحث الامتداد عن:

#### 1. أزرار الخيارات
```javascript
// البحث عن الأزرار التي تحتوي على الخيارات
button.w-full.text-start  // الأساسي
button[class*="rounded-2xl"]  // احتياطي
```

**الميزات المميزة:**
- كل زر له `onClick={() => handleOptionSelect(index)}`
- classes: `w-full text-start p-5 rounded-2xl border-2 transition-all`
- تحتوي على `String.fromCharCode(65 + index)` للأحرف A, B, C, D

#### 2. زر التأكيد
```javascript
// زر تأكيد الإجابة
button.bg-blue-600.text-white  // الأساسي
"تأكيد الإجابة"  // النص
```

#### 3. زر التالي
```javascript
// زر الانتقال للسؤال التالي
button.bg-gray-900.dark\\:bg-white  // الأساسي
"السؤال التالي" أو "عرض النتائج"  // النص
```

#### 4. زر السابق
```javascript
// زر العودة للسؤال السابق
button.bg-gray-100.dark\\:bg-gray-700  // الأساسي
"السابق"  // النص
```

## 🐛 استكشاف الأخطاء الشائعة

### "لم يتم العثور على خيارات الإجابة"

**الأسباب المحتملة:**
1. الصفحة لم تحمل بالكامل
2. لست في صفحة امتحان
3. الـ classes تغيرت في الكود
4. JavaScript لم ينفذ بعد

**الحلول:**
1. انتظر تحميل الصفحة بالكامل
2. تأكد من أنك في `/quiz/[id]` route
3. استخدم زر "معلومات الصفحة" للتشخيص
4. تحقق من console للأخطاء

### الامتداد يعمل لسؤال واحد فقط
- ✅ **تم إصلاح هذا السلوك** في الإصدار الحالي
- الامتداد الآن يكمل الامتحان كاملاً وليس سؤال واحد
- يعيد البحث عن الأزرار بعد كل إجابة
- يدعم النصوص المتغيرة لزر "السؤال التالي"
- يعمل بسرعة فائقة مع أوقات انتظار محسنة

**الميزات الجديدة:**
- إكمال تلقائي للامتحان كاملاً
- سرعة فائقة (~1.5 ثانية لكل سؤال)
- كشف ذكي لنهاية الامتحان
- معالجة أخطاء محسنة

**كيف يعمل الآن:**
1. يختار إجابة وينقر "تأكيد الإجابة"
2. ينتظر عرض النتيجة
3. **يعيد البحث عن الأزرار** (قد تكون ظهرت أزرار جديدة)
4. ينقر على "السؤال التالي" أو "عرض النتائج"

### Could not establish connection. Receiving end does not exist
- ✅ **تم إصلاح هذا الخطأ** في الإصدار الحالي
- الامتداد الآن يتحقق من دعم الصفحة قبل بدء الاختبار
- يحمل الـ content script تلقائياً إذا لم يكن متوفراً
- يعرض رسائل واضحة عن حالة الاتصال

**كيف يعمل الآن:**
1. يتحقق من دعم الصفحة الحالية (localhost:3000 أو masarx.vercel.app)
2. يحاول الاتصال بالـ content script عبر ping
3. إذا فشل الاتصال، يحمل الـ content script يدوياً
4. ينتظر تهيئة الـ script ثم يبدأ الاختبار
5. يعرض حالة الاتصال في الواجهة

**زر "فحص الحالة":**
- يتحقق من دعم الصفحة
- يختبر الاتصال بالـ content script
- يعرض معلومات مفيدة للتشخيص

### الامتداد لا يعمل

**التحقق:**
```javascript
// في Developer Tools Console
// تأكد من وجود هذه العناصر
document.querySelectorAll('button.w-full.text-start')
document.querySelector('button.bg-blue-600')
document.querySelector('button.bg-gray-900')
```

### رسائل التشخيص

الامتداد يطبع معلومات مفصلة في console:

```
🔍 جاري البحث عن عناصر الامتحان...
📄 الصفحة الحالية: http://localhost:3000/quiz/123
🎯 تم العثور على 4 أزرار خيارات امتحان
📊 ملخص البحث:
   - الأسئلة: ✅
   - الخيارات: 4 عنصر
   - زر التأكيد: ✅
   - زر التالي: ✅
```

## 🔧 تخصيص البحث

### إضافة selectors جديدة

إذا تغير الكود، يمكن تحديث `content.js`:

```javascript
// أضف selectors جديدة في findQuizElements()
const newOptions = Array.from(document.querySelectorAll('YOUR_NEW_SELECTOR'));
```

### تخصيص النصوص

```javascript
// أضف نصوص جديدة في findButtonByText()
findButtonByText(['نص جديد', 'New Text'])
```

## 📱 اختبار الامتداد

### 1. الاختبار المحلي
```bash
# شغل الخادم
npm run dev

# اذهب لصفحة امتحان
http://localhost:3000/quiz/[quiz-id]
```

### 2. تثبيت الامتداد
```bash
# في Chrome/Edge
chrome://extensions/ → Load unpacked → اختر test_quiz
```

### 3. تشغيل الاختبارات
1. انقر أيقونة الامتداد
2. أدخل معرف امتحان
3. اختر نوع الاختبار
4. اضغط "بدء الاختبار"

## 🎨 فهم تصميم الامتحان

### هيكل الـ QuizPlayer

```jsx
<div className="quiz-container">
  {/* Progress Bar */}
  <div className="progress-bar">...</div>

  {/* Question */}
  <h3>{currentQuestion.question}</h3>

  {/* Options */}
  <div className="space-y-4">
    {currentQuestion.options.map((option, index) => (
      <button
        key={index}
        onClick={() => handleOptionSelect(index)}
        className="w-full text-start p-5 rounded-2xl border-2"
      >
        {/* Option content */}
      </button>
    ))}
  </div>

  {/* Action Buttons */}
  <div className="flex justify-between">
    <button onClick={handlePreviousQuestion}>
      السابق
    </button>

    {!isAnswered ? (
      <button onClick={handleSubmitAnswer}>
        تأكيد الإجابة
      </button>
    ) : (
      <button onClick={handleNextQuestion}>
        {currentQuestionIndex === questions.length - 1
          ? "عرض النتائج"
          : "السؤال التالي"}
      </button>
    )}
  </div>
</div>
```

## 🚀 نصائح التطوير

### 1. استخدم معلومات الصفحة
زر "معلومات الصفحة" يعطي نظرة شاملة على العناصر المتاحة.

### 2. راقب Console
جميع عمليات البحث والتشخيص تظهر في Developer Tools Console.

### 3. اختبر على بيانات حقيقية
استخدم امتحانات موجودة فعلاً في قاعدة البيانات.

### 4. تحديث منتظم
أعد تحميل الامتداد بعد أي تغيير في الكود.

## 🔄 التحديثات المستقبلية

- دعم أنواع أسئلة جديدة
- تحسين دقة البحث
- إضافة اختبارات أداء
- واجهة أكثر تفاعلية
- تقارير مفصلة