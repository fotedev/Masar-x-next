import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testReviewDetails() {
    console.log('Testing review_details view...');
    const { data, error } = await supabase
        .from('review_details')
        .select('*')
        .limit(5);

    if (error) {
        console.error('❌ Query failed:');
        console.error(JSON.stringify(error, null, 2));
    } else {
        console.log('✅ Query succeeded!');
        console.log(`Fetched ${data?.length} reviews.`);
        if (data?.length > 0) {
            console.log('First review sample:', {
                id: data[0].id,
                content: data[0].content,
                rating: data[0].rating,
                username: data[0].username,
                full_name: data[0].full_name,
                course_id: data[0].course_id
            });
        }
    }
}

testReviewDetails();
