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

async function testVideosStorage() {
  console.log('🎬 اختبار Supabase Storage للفيديوهات...\n');

  try {
    // التحقق من وجود الـ bucket
    console.log('📦 التحقق من bucket "course-videos":');
    try {
      const { data: buckets, error } = await supabase.storage.listBuckets();

      if (error) {
        console.log('❌ خطأ في قراءة buckets:', error.message);
        console.log('💡 تأكد من تطبيق supabase-storage-videos-100mb.sql في SQL Editor');
        return;
      }

      const videosBucket = buckets.find(b => b.id === 'course-videos');
      if (videosBucket) {
        console.log('✅ bucket "course-videos" موجود');
        console.log(`   - حجم الفيديو الأقصى: ${(videosBucket.file_size_limit / 1024 / 1024).toFixed(0)}MB`);
        console.log(`   - عام: ${videosBucket.public ? 'نعم' : 'لا'}`);
      } else {
        console.log('❌ bucket "course-videos" غير موجود');
        console.log('💡 قم بتطبيق supabase-storage-videos-100mb.sql في SQL Editor أولاً');
        return;
      }
    } catch (error) {
      console.log('❌ خطأ في التحقق من storage:', error.message);
      return;
    }

    console.log('\n🎥 الفيديوهات الموجودة حالياً:');
    try {
      const { data: videos, error } = await supabase.storage
        .from('course-videos')
        .list('', {
          limit: 10,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) {
        console.log('❌ خطأ في قراءة الفيديوهات:', error.message);
      } else if (videos && videos.length > 0) {
        videos.forEach(video => {
          const sizeMB = (video.metadata?.size || 0) / 1024 / 1024;
          console.log(`  🎬 ${video.name} (${sizeMB.toFixed(2)}MB)`);
        });
      } else {
        console.log('  📭 لا توجد فيديوهات حالياً');
      }
    } catch (error) {
      console.log('❌ خطأ في قراءة الفيديوهات:', error.message);
    }

    console.log('\n🔗 مثال على Signed URL للفيديوهات:');
    console.log('لتشغيل فيديو آمن في HTML:');
    console.log(`
const { data } = await supabase.storage
  .from('course-videos')
  .createSignedUrl('course-id/video.mp4', 10800); // 3 ساعات

if (data?.signedUrl) {
  // في React:
  return (
    <video
      src={data.signedUrl}
      controls
      style={{ maxWidth: '100%', height: 'auto' }}
    />
  );
}
    `);

    console.log('\n⚠️ تحذيرات مهمة:');
    console.log('• حجم كل فيديو محدود بـ 100MB');
    console.log('• Supabase Free: 1GB تخزين إجمالي');
    console.log('• لفيديوهات أكبر: استخدم Telegram أو Google Drive');
    console.log('• هذا مثالي للـ Portfolio والتجربة');

    console.log('\n📊 إحصائيات التخزين:');
    try {
      const { data: storageStats, error } = await supabase
        .from('storage.objects')
        .select('bucket_id, metadata')
        .in('bucket_id', ['course-videos', 'course-files']);

      if (!error && storageStats) {
        const stats = {};
        storageStats.forEach(item => {
          const bucket = item.bucket_id;
          const size = item.metadata?.size || 0;
          if (!stats[bucket]) stats[bucket] = { count: 0, size: 0 };
          stats[bucket].count++;
          stats[bucket].size += size;
        });

        Object.entries(stats).forEach(([bucket, data]) => {
          const sizeMB = (data.size / 1024 / 1024).toFixed(2);
          console.log(`  ${bucket}: ${data.count} ملفات، ${sizeMB}MB`);
        });
      }
    } catch (error) {
      console.log('  ℹ️ لا يمكن حساب إحصائيات التخزين');
    }

    console.log('\n✅ تم الانتهاء من اختبار Videos Storage!');
    console.log('\n🎬 للاختبار الكامل:');
    console.log('1. ارفع فيديو تجريبي صغير (<100MB)');
    console.log('2. تحقق من ظهور Signed URL صحيح');
    console.log('3. جرب تشغيل الفيديو كطالب مسجل');

  } catch (error) {
    console.error('❌ خطأ عام:', error.message);
  }
}

// تشغيل الاختبار
testVideosStorage().then(() => {
  console.log('\n🎉 انتهى الاختبار!');
}).catch(error => {
  console.error('❌ خطأ:', error);
});