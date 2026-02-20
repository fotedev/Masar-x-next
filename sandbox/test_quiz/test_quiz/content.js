// Masar X Quiz Tester Extension - Content Script

console.log('🧪 Masar X Quiz Tester Extension Loaded');

// متغيرات عامة
let isTesting = false;
let testConfig = null;

// التحقق من صحة البيئة
function checkEnvironment() {
    if (typeof chrome === 'undefined' || !chrome.runtime) {
        log('❌ الامتداد غير مثبت أو لا يعمل بشكل صحيح', 'error');
        return false;
    }

    if (typeof document === 'undefined') {
        log('❌ document غير متوفر', 'error');
        return false;
    }

    return true;
}

// دوال مساعدة
function log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString('ar-EG');
    const colors = {
        info: '#2196F3',
        success: '#4CAF50',
        warning: '#FF9800',
        error: '#F44336'
    };

    console.log(`%c[${timestamp}] Masar X Tester: ${message}`, `color: ${colors[type]}`);
}

function sendMessageToPopup(type, data) {
    chrome.runtime.sendMessage({
        type: type,
        ...data
    });
}

// محاكاة التأخير
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// البحث عن عناصر الامتحان في الصفحة
function findQuizElements() {
    log('🔍 جاري البحث عن عناصر الامتحان...', 'info');

    // طباعة معلومات الصفحة الحالية للتشخيص
    log(`📄 الصفحة الحالية: ${window.location.href}`, 'info');
    log(`🎯 عنوان الصفحة: ${document.title}`, 'info');

    // البحث الشامل عن الأسئلة
    const questionContainer = document.querySelector('[data-testid="question-container"]') ||
                             document.querySelector('.question-container') ||
                             document.querySelector('[class*="question"]') ||
                             document.querySelector('h3, .question-text, [class*="question"]') ||
                             document.querySelector('.quiz-question, .question-content, .question-text');

    // البحث عن الخيارات بناءً على الكود الحقيقي - buttons بـ classes محددة
    let options = [];

    // البحث عن أزرار الخيارات من الكود الحقيقي (QuizPlayer.tsx)
    const quizOptionButtons = Array.from(document.querySelectorAll('button.w-full.text-start'));
    if (quizOptionButtons.length > 0) {
        log(`🎯 تم العثور على ${quizOptionButtons.length} أزرار خيارات امتحان`, 'success');
        options = quizOptionButtons;
    }

    // البحث عن أزرار الخيارات بـ classes أخرى محتملة
    if (options.length === 0) {
        const buttonOptions = Array.from(document.querySelectorAll('button[class*="rounded-2xl"]'));
        // استبعاد أزرار التحكم (التأكيد، التالي، السابق)
        const filteredOptions = buttonOptions.filter(btn => {
            const text = btn.textContent?.trim() || '';
            return !text.includes('تأكيد') && !text.includes('التالي') &&
                   !text.includes('السابق') && !text.includes('عرض النتائج') &&
                   !text.includes('Submit') && !text.includes('Next') &&
                   !text.includes('Previous') && !text.includes('Show Results');
        });

        if (filteredOptions.length > 0) {
            log(`🔘 تم العثور على ${filteredOptions.length} أزرار خيارات محتملة`, 'info');
            options = filteredOptions;
        }
    }

    // البحث عن أزرار بـ classes من نظام Tailwind المستخدم
    if (options.length === 0) {
        const tailwindButtons = Array.from(document.querySelectorAll('button[class*="border-2"], button[class*="transition-all"]'));
        const filteredTailwind = tailwindButtons.filter(btn => {
            const text = btn.textContent?.trim() || '';
            return !text.includes('تأكيد') && !text.includes('التالي') &&
                   !text.includes('السابق') && !text.includes('عرض النتائج');
        });

        if (filteredTailwind.length > 0) {
            log(`🎨 تم العثور على ${filteredTailwind.length} أزرار Tailwind محتملة`, 'info');
            options = filteredTailwind;
        }
    }

    // البحث عن أزرار التحكم بناءً على الكود الحقيقي
    const submitButton = findButtonByText(['تأكيد الإجابة']) ||
                        document.querySelector('button.bg-blue-600') ||
                        document.querySelector('button[class*="bg-blue-600"]') ||
                        document.querySelector('button[class*="hover:bg-blue-700"]');

    const nextButton = findButtonByText(['السؤال التالي', 'عرض النتائج', 'Continue', 'Show Results']) ||
                      document.querySelector('button.bg-gray-900') ||
                      document.querySelector('button[class*="bg-gray-900"]') ||
                      document.querySelector('button.dark\\:bg-white') ||
                      document.querySelector('button[class*="hover:bg-black"]') ||
                      document.querySelector('button[class*="bg-white"][class*="text-gray-900"]');

    const prevButton = findButtonByText(['السابق']) ||
                      document.querySelector('button.bg-gray-100') ||
                      document.querySelector('button[class*="bg-gray-100"]') ||
                      document.querySelector('button.dark\\:bg-gray-700');

    // طباعة ملخص النتائج
    log(`📊 ملخص البحث:`, 'info');
    log(`   - الأسئلة: ${questionContainer ? '✅' : '❌'}`, questionContainer ? 'success' : 'warning');
    log(`   - الخيارات: ${options.length} عنصر`, options.length > 0 ? 'success' : 'error');
    log(`   - زر التأكيد: ${submitButton ? '✅ ("' + (submitButton.textContent?.trim() || 'غير معروف') + '")' : '❌'}`, submitButton ? 'success' : 'warning');
    log(`   - زر التالي: ${nextButton ? '✅ ("' + (nextButton.textContent?.trim() || 'غير معروف') + '")' : '❌'}`, nextButton ? 'success' : 'warning');
    log(`   - زر السابق: ${prevButton ? '✅ ("' + (prevButton.textContent?.trim() || 'غير معروف') + '")' : '❌'}`, prevButton ? 'success' : 'warning');

    // طباعة معلومات إضافية للتشخيص
    if (options.length === 0) {
        log('🔍 لم يتم العثور على خيارات. جاري فحص DOM...', 'warning');

        // فحص عناصر button في الصفحة
        const allButtons = document.querySelectorAll('button');
        log(`🔘 إجمالي الأزرار في الصفحة: ${allButtons.length}`, 'info');

        // فحص عناصر input
        const allInputs = document.querySelectorAll('input');
        log(`📝 إجمالي عناصر input: ${allInputs.length}`, 'info');

        // طباعة أول 5 أزرار للتشخيص
        allButtons.forEach((btn, index) => {
            if (index < 5) {
                log(`   Button ${index + 1}: "${btn.textContent?.trim()}" (class: ${btn.className})`, 'info');
            }
        });
    }

    return {
        questionContainer,
        options,
        submitButton,
        nextButton,
        prevButton
    };
}

// دالة للبحث عن الأزرار بالنص
function findButtonByText(texts) {
    const buttons = document.querySelectorAll('button');
    for (const button of buttons) {
        const buttonText = button.textContent?.trim() || '';
        for (const text of texts) {
            if (buttonText.includes(text) || buttonText.toLowerCase().includes(text.toLowerCase())) {
                return button;
            }
        }
    }
    return null;
}

// دالة آمنة للنقر على العناصر
function safeClick(element, description = 'العنصر') {
    try {
        if (!element) {
            throw new Error(`${description} غير موجود`);
        }

        // التحقق من أن العنصر مرئي
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            throw new Error(`${description} غير مرئي`);
        }

        // التحقق من أن العنصر غير معطل
        if (element.disabled || element.getAttribute('aria-disabled') === 'true') {
            throw new Error(`${description} معطل`);
        }

        element.click();
        log(`✅ تم النقر على ${description}`, 'success');
        return true;
    } catch (error) {
        log(`❌ فشل في النقر على ${description}: ${error.message}`, 'error');
        return false;
    }
}

// دالة للبحث عن أي عنصر بالنص
function findElementByText(selector, texts) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
        const elementText = element.textContent?.trim() || '';
        for (const text of texts) {
            if (elementText.includes(text) || elementText.toLowerCase().includes(text.toLowerCase())) {
                return element;
            }
        }
    }
    return null;
}

// اختبار الإجابة التلقائية - يكمل الامتحان كاملاً بسرعة
async function runAutoAnswerTest(quizId) {
    log('🚀 بدء اختبار الإجابة التلقائية (الامتحان الكامل السريع)', 'info');

    try {
        // انتظار تحميل الصفحة
        log('⏳ انتظار تحميل الصفحة...', 'info');
        await sleep(1500); // تسريع من 3000ms إلى 1500ms

        let questionCount = 0;
        const maxQuestions = 100; // زيادة الحد الأقصى
        let consecutiveFailures = 0;

        while (questionCount < maxQuestions) {
            questionCount++;
            log(`\n⚡ السؤال ${questionCount} - البدء السريع`, 'info');

            const elements = findQuizElements();

            // إذا لم نجد خيارات، ربما انتهى الامتحان
            if (elements.options.length === 0) {
                consecutiveFailures++;
                if (consecutiveFailures >= 3) {
                    log('🏁 لم يتم العثور على خيارات لـ 3 مرات متتالية - انتهى الامتحان', 'success');
                    break;
                }
                log('⚠️ لم يتم العثور على خيارات - محاولة أخرى', 'warning');
                await sleep(500);
                continue;
            }

            consecutiveFailures = 0; // إعادة تعيين عداد الفشل
            log(`✅ وُجد ${elements.options.length} خيار`, 'success');

            // اختيار إجابة عشوائية بسرعة (80% نسبة نجاح لتكون أسرع)
            const randomIndex = Math.floor(Math.random() * elements.options.length);
            const selectedOption = Math.random() > 0.2 ? elements.options[0] : elements.options[randomIndex];

            // النقر على الخيار فوراً
            if (!safeClick(selectedOption, `خيار السؤال ${questionCount}`)) {
                log('❌ فشل في النقر على الخيار - التوقف', 'error');
                break;
            }

            // انتظار سريع جداً ثم التأكيد
            await sleep(300); // تسريع كبير من 1000ms إلى 300ms

            if (!safeClick(elements.submitButton, 'زر التأكيد')) {
                log('❌ لم يتم العثور على زر التأكيد - التوقف', 'error');
                break;
            }

            // انتظار أسرع للنتيجة
            await sleep(800); // تسريع من 2500ms إلى 800ms

            // إعادة البحث عن الأزرار
            const updatedElements = findQuizElements();

            // محاولة الانتقال بسرعة
            let movedNext = false;

            if (updatedElements.nextButton) {
                if (safeClick(updatedElements.nextButton, 'زر التالي')) {
                    movedNext = true;
                }
            }

            // البحث عن بدائل إذا لزم الأمر
            if (!movedNext) {
                const allButtons = document.querySelectorAll('button');
                const nextTexts = ['التالي', 'Next', 'Continue', 'عرض', 'Show Results', 'Finish'];
                const nextButton = Array.from(allButtons).find(btn => {
                    const text = btn.textContent?.trim() || '';
                    return nextTexts.some(t => text.includes(t));
                });

                if (nextButton && safeClick(nextButton, 'زر بديل للتالي')) {
                    movedNext = true;
                }
            }

            if (!movedNext) {
                log('⚠️ لم نتمكن من الانتقال - ربما انتهى الامتحان', 'warning');
                break;
            }

            // انتظار قصير جداً قبل السؤال التالي
            await sleep(400); // تسريع من 800ms إلى 400ms
        }

        log(`\n🎉 تم إنهاء الاختبار السريع! تم حل ${questionCount} سؤال في وقت قياسي!`, 'success');

    } catch (error) {
        log('❌ فشل في الاختبار السريع: ' + error.message, 'error');
        throw error;
    }
}

// اختبار التنقل
async function runNavigationTest(quizId) {
    log('🧭 بدء اختبار التنقل', 'info');

    try {
        const elements = findQuizElements();

        // محاكاة التنقل بين الأسئلة
        for (let i = 0; i < Math.min(5, 10); i++) {
            log(`📍 في السؤال ${i + 1}`, 'info');

            if (elements.options.length > 0) {
                // اختيار خيار عشوائي
                const randomIndex = Math.floor(Math.random() * elements.options.length);
                elements.options[randomIndex].click();
                log(`🎯 تم اختيار الخيار ${randomIndex + 1}`, 'info');
            }

            // حفظ الإجابة
            if (elements.submitButton) {
                elements.submitButton.click();
                log('💾 تم حفظ الإجابة', 'success');
            }

            await sleep(800); // تسريع من 2000ms إلى 800ms

            // إعادة البحث عن الأزرار بعد حفظ الإجابة
            const currentElements = findQuizElements();

            // الانتقال للسؤال التالي
            if (currentElements.nextButton) {
                safeClick(currentElements.nextButton, 'زر التالي');
            } else {
                log('⚠️ لم يتم العثور على زر التالي', 'warning');
                break;
            }

            await sleep(600); // تسريع من 1500ms إلى 600ms
        }

        log('✅ انتهى اختبار التنقل بنجاح', 'success');

    } catch (error) {
        log('❌ فشل في اختبار التنقل: ' + error.message, 'error');
        throw error;
    }
}

// اختبار المؤقت
async function runTimerTest(quizId) {
    log('⏰ بدء اختبار المؤقت', 'info');

    try {
        // انتظار 15 ثانية فقط لتسريع الاختبار
        log('⏳ انتظار انتهاء الوقت (نسخة سريعة)...', 'warning');

        for (let i = 15; i > 0; i--) {
            sendMessageToPopup('testProgress', {
                progress: ((15 - i) / 15) * 100,
                message: `الوقت المتبقي: ${i} ثانية`,
                level: 'info'
            });

            await sleep(500); // تسريع من 1000ms إلى 500ms
        }

        log('⏰ انتهى الوقت!', 'warning');

    // محاولة العثور على زر إنهاء أو نتائج
    const finishButton = findButtonByText(['إنهاء', 'Finish', 'انتهاء', 'Complete']) ||
                        document.querySelector('button[class*="finish"]');

    if (finishButton) {
        safeClick(finishButton, 'زر الإنهاء');
    }

    } catch (error) {
        log('❌ فشل في اختبار المؤقت: ' + error.message, 'error');
        throw error;
    }
}

// اختبار جماعي
async function runBulkTest(quizId, numAttempts) {
    log(`👥 بدء الاختبار الجماعي: ${numAttempts} محاولة`, 'info');

    try {
        for (let i = 0; i < numAttempts; i++) {
            const progress = ((i + 1) / numAttempts) * 100;

            sendMessageToPopup('testProgress', {
                progress: progress,
                message: `المحاولة ${i + 1}/${numAttempts}`,
                level: 'info'
            });

            log(`🎯 المحاولة ${i + 1}/${numAttempts}`, 'info');

            // تشغيل اختبار سريع
            await runAutoAnswerTest(quizId);
            await sleep(2000);
        }

        log('✅ انتهى الاختبار الجماعي بنجاح', 'success');

    } catch (error) {
        log('❌ فشل في الاختبار الجماعي: ' + error.message, 'error');
        throw error;
    }
}

// الحصول على معلومات الصفحة الحالية
function getPageInfo() {
    const info = {
        url: window.location.href,
        title: document.title,
        hasQuizElements: false,
        elementCount: {
            buttons: document.querySelectorAll('button').length,
            inputs: document.querySelectorAll('input').length,
            radios: document.querySelectorAll('input[type="radio"]').length,
            totalElements: document.querySelectorAll('*').length
        },
        quizIndicators: []
    };

    // البحث عن مؤشرات امتحان
    const quizKeywords = ['quiz', 'exam', 'test', 'question', 'answer', 'اختبار', 'امتحان', 'سؤال', 'إجابة'];
    quizKeywords.forEach(keyword => {
        const elements = document.querySelectorAll(`[class*="${keyword}"], [id*="${keyword}"]`);
        if (elements.length > 0) {
            info.quizIndicators.push(`${keyword}: ${elements.length}`);
        }
    });

    // فحص وجود عناصر امتحان أساسية
    const elements = findQuizElements();
    info.hasQuizElements = elements.options.length > 0 || elements.submitButton !== null;

    return info;
}

// الاستماع للرسائل من popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'startQuizTest') {
        if (isTesting) {
            log('⚠️ اختبار آخر قيد التشغيل', 'warning');
            sendResponse({ success: false, error: 'اختبار آخر قيد التشغيل' });
            return;
        }

        isTesting = true;
        testConfig = message.data;

        (async () => {
            try {
                log(`🎯 بدء اختبار: ${message.data.testType}`, 'info');

                switch (message.data.testType) {
                    case 'answers':
                        await runAutoAnswerTest(message.data.quizId);
                        break;
                    case 'navigation':
                        await runNavigationTest(message.data.quizId);
                        break;
                    case 'timer':
                        await runTimerTest(message.data.quizId);
                        break;
                    case 'bulk':
                        await runBulkTest(message.data.quizId, message.data.numAttempts);
                        break;
                    default:
                        throw new Error('نوع اختبار غير معروف: ' + message.data.testType);
                }

                log('✅ تم إنهاء الاختبار بنجاح!', 'success');
                sendMessageToPopup('testComplete', {
                    success: true,
                    message: 'تم إنهاء الاختبار بنجاح!'
                });

                sendResponse({ success: true });

            } catch (error) {
                log(`❌ فشل في الاختبار: ${error.message}`, 'error');
                sendMessageToPopup('testComplete', {
                    success: false,
                    message: 'فشل في الاختبار: ' + error.message
                });

                sendResponse({ success: false, error: error.message });
            } finally {
                isTesting = false;
            }
        })();

        return true; // سيتم الرد لاحقاً
    }

    if (message.action === 'getPageInfo') {
        const pageInfo = getPageInfo();
        sendResponse({ success: true, data: pageInfo });
    }

    if (message.action === 'ping') {
        sendResponse({ success: true });
    }
});

// التحقق من البيئة عند التحميل
if (checkEnvironment()) {
    log('✅ Masar X Quiz Tester Extension Ready', 'success');
} else {
    log('❌ فشل في تهيئة الامتداد', 'error');
}