import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testQuery() {
    console.log('Testing full query from CoursesPage.tsx...');
    const { data, error } = await supabase
        .from('courses')
        .select(`
      *,
      profiles:instructor_id (
        display_name
      ),
      enrollments (
        status
      ),
      reviews (
        rating
      )
    `);

    if (error) {
        console.error('❌ Full query failed:');
        console.error(JSON.stringify(error, null, 2));
    } else {
        console.log('✅ Full query succeeded!');
        console.log(`Fetched ${data?.length} courses.`);
    }
}

testQuery();
