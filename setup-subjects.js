// setup-subjects.js
// Setup script to populate subjects from config file
// Usage: node setup-subjects.js

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupSubjects() {
  try {
    console.log('🚀 Starting subject setup...');

    // Load subjects from config file
    const configPath = path.join(__dirname, 'src/config/subjects.config.ts');
    const configContent = fs.readFileSync(configPath, 'utf8');

    // Simple parsing to extract subjects (basic implementation)
    const extractSubjects = (configStr, arrayName) => {
      const regex = new RegExp(`${arrayName}: Subject\\[\\] = (\\[([\\s\\S]*?)\\]);`, 'm');
      const match = configStr.match(regex);
      if (!match) return [];

      const arrayContent = match[1];
      const subjects = [];

      // Parse each subject object
      const subjectRegex = /{[^}]+}/g;
      const subjectMatches = arrayContent.match(subjectRegex) || [];

      subjectMatches.forEach(subjectStr => {
        const idMatch = subjectStr.match(/id:\s*"([^"]+)"/);
        const nameMatch = subjectStr.match(/name:\s*"([^"]+)"/);
        const semesterMatch = subjectStr.match(/semester:\s*(\d)/);

        if (idMatch && nameMatch) {
          subjects.push({
            id: idMatch[1],
            name: nameMatch[1],
            semester: semesterMatch ? parseInt(semesterMatch[1]) : 1
          });
        }
      });

      return subjects;
    };

    const semester1Subjects = extractSubjects(configContent, 'SEMESTER_1_SUBJECTS');
    const semester2Subjects = extractSubjects(configContent, 'SEMESTER_2_SUBJECTS');
    const allSubjects = [...semester1Subjects, ...semester2Subjects];

    console.log(`📚 Found ${allSubjects.length} subjects to setup:`);
    console.log(`   Semester 1: ${semester1Subjects.length} subjects`);
    console.log(`   Semester 2: ${semester2Subjects.length} subjects`);

    // Clear existing subjects (optional)
    console.log('🧹 Clearing existing subjects...');
    const { error: deleteError } = await supabase
      .from('subjects')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Keep placeholder if exists

    if (deleteError) {
      console.warn('⚠️  Could not clear existing subjects:', deleteError.message);
    }

    // Insert subjects
    console.log('📝 Inserting subjects...');
    const { data, error } = await supabase
      .from('subjects')
      .insert(allSubjects.map(subject => ({
        id: subject.id,
        name: subject.name,
        semester: subject.semester,
        show_on_home: true
      })))
      .select();

    if (error) {
      throw error;
    }

    console.log('✅ Successfully inserted subjects:');
    data.forEach(subject => {
      console.log(`   - ${subject.name} (Semester ${subject.semester})`);
    });

    // Set active semester to 1 by default
    console.log('🔧 Setting default active semester...');
    const { error: settingsError } = await supabase
      .from('platform_settings')
      .upsert({
        setting_key: 'active_semester',
        setting_value: { value: 1 }
      });

    if (settingsError) {
      console.warn('⚠️  Could not set active semester:', settingsError.message);
    }

    console.log('🎉 Subject setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Start your development server: npm run dev');
    console.log('   2. Visit /admin to manage subjects and settings');
    console.log('   3. Customize subjects anytime by editing src/config/subjects.config.ts and re-running this script');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

setupSubjects();
