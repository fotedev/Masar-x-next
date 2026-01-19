import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testQuery() {
    console.log('Testing join with "comments" instead of "reviews"...');
    const { data, error } = await supabase
        .from('courses')
        .select(`
      *,
      comments (
        rating
      )
    `)
        .limit(1);

    if (error) {
        console.error('❌ Query with "comments" failed:');
        console.error(JSON.stringify(error, null, 2));

        console.log('\nTesting join with "reviews"...');
        const { data: data2, error: error2 } = await supabase
            .from('courses')
            .select(`
        *,
        reviews (
          rating
        )
      `)
            .limit(1);

        if (error2) {
            console.error('❌ Query with "reviews" failed:');
            console.error(JSON.stringify(error2, null, 2));
        } else {
            console.log('✅ Query with "reviews" succeeded!');
        }
    } else {
        console.log('✅ Query with "comments" succeeded!');
    }
}

testQuery();
