#!/usr/bin/env node

/**
 * اختبار سريع للامتداد - معلومات أساسية وتعليمات
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Masar X Quiz Tester Extension - اختبار سريع\n');

// فحص الملفات المطلوبة
const requiredFiles = [
    'manifest.json',
    'popup.html',
    'popup.js',
    'content.js',
    'icons/icon.svg'
];

console.log('📁 فحص الملفات المطلوبة:');
let allFilesExist = true;

requiredFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    const exists = fs.existsSync(filePath);
    console.log(`${exists ? '✅' : '❌'} ${file}`);
    if (!exists) allFilesExist = false;
});

console.log('\n🔍 تحليل الامتداد:');

// قراءة manifest.json
try {
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
    console.log('✅ manifest.json صالح');
    console.log(`   الإصدار: ${manifest.version}`);
    console.log(`   الأذونات: ${manifest.permissions.join(', ')}`);
    console.log(`   المجالات: ${manifest.host_permissions.join(', ')}`);
} catch (error) {
    console.log('❌ manifest.json غير صالح');
    allFilesExist = false;
}

console.log('\n🎯 كيفية البحث عن العناصر (بناءً على QuizPlayer.tsx):');
console.log('1. أزرار الخيارات: button.w-full.text-start');
console.log('2. زر التأكيد: button.bg-blue-600 + "تأكيد الإجابة"');
console.log('3. زر التالي: button.bg-gray-900 + "السؤال التالي"');
console.log('4. زر السابق: button.bg-gray-100 + "السابق"');

console.log('\n📋 التوصيات:');
console.log('1. تأكد من تشغيل npm run dev أولاً');
console.log('2. اذهب لصفحة امتحان حقيقية');
console.log('3. استخدم زر "معلومات الصفحة" للتشخيص');
console.log('4. تحقق من Console للرسائل التفصيلية');
console.log('5. أعد تحميل الامتداد بعد أي تغيير');

console.log('\n🚀 خطوات الاختبار:');
console.log('1. npm run dev');
console.log('2. افتح: http://localhost:3000/quiz/[quiz-id]');
console.log('3. chrome://extensions/ → Load unpacked → test_quiz');
console.log('4. انقر أيقونة الامتداد وجرب الاختبار');

if (allFilesExist) {
    console.log('\n✅ الامتداد جاهز للاختبار!');
} else {
    console.log('\n❌ يرجى إصلاح الملفات المفقودة أولاً');
}