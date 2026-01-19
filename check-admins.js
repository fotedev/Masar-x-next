import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://jcufigozkhxazjbwhjjm.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.log('Required: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkAdmins() {
  try {
    console.log('🔍 Checking all admins...\n');

    // First, get all admins from the admins table
    const { data: admins, error: adminsError } = await supabase
      .from('admins')
      .select('*');

    if (adminsError) {
      console.error('❌ Error fetching admins from table:', adminsError);
      return;
    }

    if (!admins || admins.length === 0) {
      console.log('📋 No admins found in the admins table.');
    } else {
      console.log(`📊 Found ${admins.length} admin(s) in admins table:\n`);

      for (const admin of admins) {
        try {
          // Get user info from Auth
          const { data: userData, error: userError } = await supabase.auth.admin.getUserById(admin.user_id);

          if (userError) {
            console.log(`❌ Error fetching auth user ${admin.user_id}:`, userError.message);
            continue;
          }

          const user = userData.user;
          const metadata = user?.raw_user_meta_data || {};
          const displayName = metadata.display_name || user?.email?.split('@')[0] || 'Unknown';

          console.log(`👤 Admin: ${displayName}`);
          console.log(`   📧 Email: ${user?.email || 'N/A'}`);
          console.log(`   🆔 User ID: ${user?.id || 'N/A'}`);
          console.log(`   🛡️ Database Role: ${admin.role || 'not set'}`);

          const authRole = metadata.role;
          const authRoleDisplay = Array.isArray(authRole) ? authRole.join(', ') : (authRole || 'none');
          console.log(`   🎭 Auth Metadata Role: ${authRoleDisplay}`);

          const appRole = user?.app_metadata?.role;
          if (appRole) {
            console.log(`   📱 App Metadata Role: ${appRole}`);
          }

          console.log(`   📅 Joined: ${user?.created_at ? new Date(user.created_at).toLocaleDateString('ar-EG') : 'N/A'}`);
          console.log(`   ✅ Email Confirmed: ${user?.email_confirmed_at ? 'نعم' : 'لا'}`);

          // Check profiles table
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, username')
            .eq('id', admin.user_id)
            .maybeSingle();

          if (profile) {
            console.log(`   👤 Profile Name: ${profile.full_name || 'N/A'}`);
          }

          console.log(`   📝 Notes: ${admin.notes || 'No notes'}\n`);
        } catch (err) {
          console.error(`Error processing admin ${admin.user_id}:`, err);
        }
      }
    }

    // Check auth.users for metadata role
    console.log('🔍 Checking for users with "admin" role in metadata...\n');
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('❌ Error listing auth users:', authError);
    } else {
      const metadataAdmins = authUsers.users.filter(u => {
        const role = u.raw_user_meta_data?.role;
        if (Array.isArray(role)) return role.includes('admin');
        return role === 'admin';
      });
      console.log(`📊 Found ${metadataAdmins.length} user(s) with "admin" role in metadata:`);

      metadataAdmins.forEach(u => {
        console.log(`   - ${u.email} (${u.id})`);
      });
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkAdmins();