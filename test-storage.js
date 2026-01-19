import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// قراءة متغيرات البيئة
function loadEnv() {
  try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const envVars = {};

      envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          envVars[key.trim()] = valueParts.join('=').trim().replace(/['"]/g, '');
        }
      });

      return envVars;
    }
  } catch (error) {
    console.error('خطأ في قراءة .env:', error.message);
  }
  return {};
}

const envVars = loadEnv();

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ خطأ: متغيرات البيئة مفقودة!');
  console.error('تأكد من وجود .env مع VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testStorage() {
  console.log('🧪 اختبار Supabase Storage...\n');

  try {
    // التحقق من وجود الـ bucket
    console.log('📦 التحقق من bucket "course-files":');
    try {
      const { data: buckets, error } = await supabase.storage.listBuckets();

      if (error) {
        console.log('❌ خطأ في قراءة buckets:', error.message);
        return;
      }

      const courseFilesBucket = buckets.find(b => b.id === 'course-files');
      if (courseFilesBucket) {
        console.log('✅ bucket "course-files" موجود');
        console.log(`   - حجم الملف الأقصى: ${courseFilesBucket.file_size_limit / 1024 / 1024}MB`);
        console.log(`   - عام: ${courseFilesBucket.public ? 'نعم' : 'لا'}`);
      } else {
        console.log('❌ bucket "course-files" غير موجود');
        console.log('💡 قم بتطبيق supabase-storage-setup.sql في SQL Editor أولاً');
        return;
      }
    } catch (error) {
      console.log('❌ خطأ في التحقق من storage:', error.message);
      return;
    }

    console.log('\n📋 الملفات الموجودة حالياً:');
    try {
      const { data: files, error } = await supabase.storage
        .from('course-files')
        .list('', {
          limit: 10,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) {
        console.log('❌ خطأ في قراءة الملفات:', error.message);
      } else if (files && files.length > 0) {
        files.forEach(file => {
          const sizeMB = (file.metadata?.size || 0) / 1024 / 1024;
          console.log(`  📄 ${file.name} (${sizeMB.toFixed(2)}MB)`);
        });
      } else {
        console.log('  📭 لا توجد ملفات حالياً');
      }
    } catch (error) {
      console.log('❌ خطأ في قراءة الملفات:', error.message);
    }

    console.log('\n🔗 مثال على Signed URL:');
    console.log('للحصول على Signed URL لملف، استخدم هذا الكود في التطبيق:');
    console.log(`
const { data } = await supabase.storage
  .from('course-files')
  .createSignedUrl('course-id/file-name.pdf', 3600); // ساعة واحدة

if (data?.signedUrl) {
  window.open(data.signedUrl, '_blank');
}
    `);

    console.log('\n✅ تم الانتهاء من اختبار Storage!');
    console.log('\n📝 للاختبار الكامل:');
    console.log('1. أضف ملف تجريبي في المنصة');
    console.log('2. تحقق من ظهور الرابط الصحيح');
    console.log('3. جرب تحميل الملف كطالب مسجل');

  } catch (error) {
    console.error('❌ خطأ عام:', error.message);
  }
}

// تشغيل الاختبار
testStorage().then(() => {
  console.log('\n🎉 انتهى الاختبار!');
}).catch(error => {
  console.error('❌ خطأ:', error);
});