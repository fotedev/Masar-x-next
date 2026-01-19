import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing environment variables');
    process.exit(1);
}

console.log(`Supabase URL: ${supabaseUrl.substring(0, 20)}...`);
console.log(`Supabase Key: ${supabaseAnonKey.substring(0, 10)}...`);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testQuery() {
    console.log('Testing CoursesPage query...');
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
        console.error('❌ Query failed:');
        console.error(JSON.stringify(error, null, 2));
    } else {
        console.log('✅ Query succeeded!');
        console.log(`Fetched ${data?.length} courses.`);
        if (data?.length > 0) {
            console.log('First course:', JSON.stringify(data[0], null, 2));
        }
    }
}

testQuery();
