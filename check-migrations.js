import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// اقرأ متغيرات البيئة من .env يدوياً
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
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ خطأ: متغيرات البيئة مفقودة!');
  console.error('تأكد من وجود ملف .env مع:');
  console.error('  VITE_SUPABASE_URL=your_supabase_url');
  console.error('  VITE_SUPABASE_ANON_KEY=your_anon_key');
  console.error('أو SUPABASE_SERVICE_ROLE_KEY=your_service_key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkMigrations() {
  console.log('🔍 جاري التحقق من الـ migrations...\n');

  try {
    // قراءة ملفات الـ migrations المحلية
    const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    console.log('📁 ملفات الـ migrations المحلية:');
    migrationFiles.forEach(file => {
      console.log(`  - ${file}`);
    });
    console.log('');

    // التحقق من الجداول المطلوبة للمحتوى الجديد
    const tablesToCheck = [
      'course_summaries',
      'course_videos',
      'course_files'
    ];

    console.log('🗄️  التحقق من الجداول المطلوبة:');
    for (const table of tablesToCheck) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (error) {
          console.log(`  ❌ ${table} - غير موجود (${error.message})`);
        } else {
          console.log(`  ✅ ${table} - موجود (${data ? 'مع بيانات' : 'فارغ'})`);
        }
      } catch (error) {
        console.log(`  ❌ ${table} - خطأ في التحقق (${error.message})`);
      }
    }
    console.log('');

    // التحقق من storage bucket
    console.log('📦 التحقق من storage bucket:');
    try {
      const { data: buckets, error } = await supabase.storage.listBuckets();

      if (error) {
        console.log(`  ❌ خطأ في قراءة buckets: ${error.message}`);
      } else {
        const courseMaterialsBucket = buckets.find(b => b.id === 'course-materials');
        if (courseMaterialsBucket) {
          console.log('  ✅ course-materials bucket موجود');
        } else {
          console.log('  ❌ course-materials bucket غير موجود');
          console.log('  البuckets الموجودة:', buckets.map(b => b.id).join(', '));
        }
      }
    } catch (error) {
      console.log(`  ❌ خطأ في التحقق من storage: ${error.message}`);
    }
    console.log('');

    // التحقق من جدول supabase_migrations إذا كان موجوداً
    console.log('📋 التحقق من جدول supabase_migrations:');
    try {
      const { data: migrations, error } = await supabase
        .from('supabase_migrations')
        .select('*')
        .order('version', { ascending: false })
        .limit(5);

      if (error) {
        console.log('  ℹ️  جدول supabase_migrations غير موجود (عادي)');
      } else {
        console.log('  ✅ آخر 5 migrations مطبقة:');
        migrations.forEach(migration => {
          console.log(`    - ${migration.version} (${migration.created_at})`);
        });
      }
    } catch (error) {
      console.log('  ℹ️  لا يمكن قراءة جدول supabase_migrations');
    }

  } catch (error) {
    console.error('❌ خطأ عام:', error.message);
  }
}

// تشغيل التحقق
checkMigrations().then(() => {
  console.log('\n✨ انتهى التحقق!');
}).catch(error => {
  console.error('❌ خطأ:', error);
});