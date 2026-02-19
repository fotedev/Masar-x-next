// Masar X Quiz Tester Extension - Popup Script

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('quizForm');
    const testTypeSelect = document.getElementById('testType');
    const bulkOptions = document.getElementById('bulkOptions');
    const startButton = document.getElementById('startTest');
    const pageInfoButton = document.getElementById('pageInfo');
    const checkStatusButton = document.getElementById('checkStatus');
    const statusDiv = document.getElementById('status');
    const progressBar = document.getElementById('progressBar');
    const logDiv = document.getElementById('log');

    // إظهار/إخفاء خيارات الاختبار الجماعي
    testTypeSelect.addEventListener('change', function() {
        if (this.value === 'bulk') {
            bulkOptions.classList.add('show');
        } else {
            bulkOptions.classList.remove('show');
        }
    });

    // بدء الاختبار
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const quizId = document.getElementById('quizId').value.trim();
        const testType = testTypeSelect.value;
        const mode = document.querySelector('input[name="mode"]:checked').value;
        const numAttempts = document.getElementById('numAttempts').value;

        if (!quizId) {
            showStatus('يرجى إدخال معرف الامتحان', 'error');
            return;
        }

        // تعطيل الزر
        startButton.disabled = true;
        startButton.textContent = 'جاري الاختبار...';

        try {
            showStatus('جاري التحضير...', 'info');
            log('🚀 بدء الاختبار...', 'info');

            // الحصول على التبويب النشط
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab) {
                throw new Error('لا يمكن العثور على التبويب النشط');
            }

            // التحقق من أن الصفحة مدعومة
            const supportedUrls = ['http://localhost:3000', 'https://masarx.vercel.app'];
            const isSupported = supportedUrls.some(url => tab.url && tab.url.startsWith(url));

            if (!isSupported) {
                throw new Error('هذه الصفحة غير مدعومة. يرجى الانتقال إلى صفحة امتحان في Masar X');
            }

            log(`📄 الصفحة الحالية: ${tab.url}`, 'info');

            // التحقق من وجود content script
            try {
                await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
                log('✅ الاتصال بالـ content script ناجح', 'success');
            } catch (pingError) {
                log('⚠️ محاولة إعادة تحميل الـ content script...', 'warning');

                // محاولة إعادة إدخال الـ content script
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content.js']
                    });
                    log('✅ تم إعادة تحميل الـ content script', 'success');

                    // انتظار قليل للتهيئة
                    await new Promise(resolve => setTimeout(resolve, 500));

                } catch (injectError) {
                    throw new Error('فشل في تحميل الـ content script. تأكد من أذونات الامتداد.');
                }
            }

            // إرسال رسالة إلى content script
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'startQuizTest',
                data: {
                    quizId,
                    testType,
                    mode,
                    numAttempts: parseInt(numAttempts)
                }
            });

            if (response.success) {
                showStatus('تم بدء الاختبار بنجاح!', 'success');
                log('✅ تم بدء الاختبار بنجاح', 'success');
            } else {
                throw new Error(response.error || 'فشل في بدء الاختبار');
            }

        } catch (error) {
            console.error('Error starting test:', error);
            showStatus('فشل في بدء الاختبار: ' + error.message, 'error');
            log('❌ فشل في بدء الاختبار: ' + error.message, 'error');
        } finally {
            startButton.disabled = false;
            startButton.textContent = '🚀 بدء الاختبار';
        }
    });

    // دوال مساعدة
    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        statusDiv.style.display = 'block';

        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }

    function log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString('ar-EG');
        const colors = {
            info: '#2196F3',
            success: '#4CAF50',
            warning: '#FF9800',
            error: '#F44336'
        };

        logDiv.innerHTML += `<div style="color: ${colors[type]}; margin: 2px 0;">
            [${timestamp}] ${message}
        </div>`;

        logDiv.classList.add('show');
        logDiv.scrollTop = logDiv.scrollHeight;
    }

    function updateProgress(percent) {
        progressBar.style.width = percent + '%';
    }

// الاستماع للرسائل من content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'testProgress') {
        updateProgress(message.progress);
        log(message.message, message.level);
    } else if (message.type === 'testComplete') {
        updateProgress(100);
        showStatus(message.message, message.success ? 'success' : 'error');
        log(message.message, message.success ? 'success' : 'error');
    }
});

// معالج زر معلومات الصفحة
pageInfoButton.addEventListener('click', async function() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
        showStatus('لا يمكن العثور على التبويب النشط', 'error');
        return;
    }

    try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getPageInfo' });

        if (response.success) {
            const info = response.data;
            let infoMessage = `📄 الصفحة: ${info.url.split('/').pop()}\n`;
            infoMessage += `🏷️ العنوان: ${info.title}\n`;
            infoMessage += `🔘 الأزرار: ${info.elementCount.buttons}\n`;
            infoMessage += `📝 المدخلات: ${info.elementCount.inputs}\n`;
            infoMessage += `🎯 الراديو: ${info.elementCount.radios}\n`;
            infoMessage += `📊 العناصر: ${info.elementCount.totalElements}\n`;

            if (info.quizIndicators.length > 0) {
                infoMessage += `🎓 مؤشرات الامتحان: ${info.quizIndicators.join(', ')}\n`;
            }

            infoMessage += `✅ عناصر الامتحان: ${info.hasQuizElements ? 'موجودة' : 'غير موجودة'}`;

            showStatus(infoMessage, 'info');
            log('معلومات الصفحة:', 'info');
            log(`URL: ${info.url}`, 'info');
            log(`العناصر: ${info.elementCount.totalElements}`, 'info');
            log(`الأزرار: ${info.elementCount.buttons}`, 'info');
        } else {
            showStatus('فشل في جلب معلومات الصفحة', 'error');
        }
    } catch (error) {
        showStatus('خطأ في الاتصال: ' + error.message, 'error');
        log('خطأ في جلب معلومات الصفحة: ' + error.message, 'error');
    }
});

    // تحقق من حالة الصفحة الحالية
    async function checkPageStatus() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab || !tab.url) {
                log('❌ لا يمكن الوصول للتبويب الحالي', 'error');
                return;
            }

            const supportedUrls = ['http://localhost:3000', 'https://masarx.vercel.app'];
            const isSupported = supportedUrls.some(url => tab.url.startsWith(url));

            if (!isSupported) {
                log('⚠️ هذه الصفحة غير مدعومة', 'warning');
                log('💡 انتقل إلى: localhost:3000 أو masarx.vercel.app', 'info');
                showStatus('هذه الصفحة غير مدعومة', 'error');
                return;
            }

            // محاولة الاتصال بالـ content script
            try {
                const response = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
                if (response) {
                    log('✅ جاهز للاختبار - الاتصال بالصفحة ناجح', 'success');
                    showStatus('الامتداد جاهز للاستخدام', 'success');
                }
            } catch (error) {
                log('⚠️ الـ content script غير متوفر - سيتم تحميله عند بدء الاختبار', 'warning');
                showStatus('الـ content script غير متوفر - سيتم تحميله تلقائياً', 'info');
            }

            log(`📍 الصفحة الحالية: ${tab.url.split('/').pop()}`, 'info');

        } catch (error) {
            log('❌ خطأ في فحص حالة الصفحة: ' + error.message, 'error');
            showStatus('خطأ في فحص حالة الصفحة', 'error');
        }
    }

    // فحص الحالة عند التحميل
    checkPageStatus();

    // event listener لزر فحص الحالة
    checkStatusButton.addEventListener('click', async function() {
        log('🔍 جاري فحص الحالة...', 'info');
        await checkPageStatus();
    });
});