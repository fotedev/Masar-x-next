#!/bin/bash

echo "========================================"
echo "  Masar X Quiz Tester Extension"
echo "  أداة اختبار امتحانات Masar X"
echo "========================================"
echo
echo "لتثبيت الامتداد على Chrome/Chromium:"
echo "1. افتح Chrome/Chromium"
echo "2. اذهب إلى: chrome://extensions/"
echo "3. فعل 'Developer mode' في أعلى اليمين"
echo "4. انقر 'Load unpacked'"
echo "5. اختر مجلد test_quiz"
echo
echo "لتثبيت الامتداد على Firefox:"
echo "1. افتح Firefox"
echo "2. اذهب إلى: about:debugging"
echo "3. انقر 'This Firefox' في الشريط الجانبي"
echo "4. انقر 'Load Temporary Add-on'"
echo "5. اختر ملف manifest.json من مجلد test_quiz"
echo
echo "الامتداد سيعمل مع:"
echo "- http://localhost:3000 (التطوير)"
echo "- https://masarx.vercel.app (الإنتاج)"
echo
echo "========================================"
read -p "اضغط Enter للمتابعة..."