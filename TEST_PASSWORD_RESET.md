# اختبار إعادة تعيين كلمة المرور

## ما تم تغييره:

### 1. ملف `/src/app/[locale]/login/page.tsx`
- ✅ تم استبدال `supabase.functions.invoke("request-password-reset")` 
- ✅ بـ `supabase.auth.resetPasswordForEmail()` 
- الآن يستخدم آلية Supabase المدمجة بدلاً من edge function مخصصة

### 2. ملف `/src/app/[locale]/reset-password/page.tsx`
- ✅ تم تغيير التحقق من التوكن من `token` إلى `code` و `type=recovery`
- ✅ تم استخدام `supabase.auth.exchangeCodeForSession(code)` 
- ✅ ثم `supabase.auth.updateUser({ password: newPassword })`

## لماذا تصل رسائل تأكيد الاشتراك ولا تصل رسائل إعادة التعيين؟

### رسائل تأكيد الاشتراك (✅ تعمل):
- يتم إرسالها من Supabase مباشرة عند التسجيل
- تستخدم قالب البريد المدمج في Supabase
- البريد المُرسِل معرّف في dashboard

### رسائل إعادة التعيين (❌ كانت مشكلة):
- **الكود القديم**: كان يحاول إرسالها من edge function مخصصة باستخدام Brevo API
- **المشكلة**: البريد المُرسِل كان `masarx.eg@gmail.com` وليس البريد المسجل في Brevo
- **الحل**: الآن يتم إرسالها من Supabase مباشرة (مثل رسائل تأكيد الاشتراك)

## خطوات الاختبار:

1. اذهب إلى https://masarx.vercel.app/login (أو url محلي)
2. انقر على "نسيت كلمة المرور؟"
3. أدخل بريدك الإلكتروني
4. تحقق من البريد الوارد - يجب أن تصل الرسالة من `masarx.eg@10456076.brevosend.com`
5. انقر على رابط إعادة التعيين في الرسالة
6. أدخل كلمة مرور جديدة
7. تم! ستُعاد التوجيه إلى صفحة تسجيل الدخول

## ملاحظات مهمة:

- لا تحتاج إلى edge function `request-password-reset` بعد الآن (اختياري: حذفها)
- الآن يعتمد كلياً على Supabase's built-in email system
- البريد سيكون موحداً (نفس البريد لتأكيد الاشتراك وإعادة التعيين)

## إذا لم تصل الرسالة بعد:

1. تحقق من إعدادات البريد في Supabase Dashboard:
   - اذهب إلى الإعدادات → Authentication → Email Templates
   - تحقق من البريد المسجل

2. تحقق من سجلات Supabase:
   - Dashboard → Logs → Edge Functions

3. تحقق من إعدادات Brevo:
   - هل هذا البريد معتمد في Brevo؟
   - هل لديه دخول صحيح؟
