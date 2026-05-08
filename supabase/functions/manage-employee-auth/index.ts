import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Verify the caller is an authenticated admin by checking x-admin-token
    const adminToken = req.headers.get('x-admin-token');
    if (!adminToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use service role to verify the admin token and perform user management
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Validate admin token against employees table
    const { data: tokenCheck } = await serviceClient
      .from('employees')
      .select('id, role, is_active')
      .not('session_token_hash', 'is', null)
      .eq('is_active', true)
      .limit(20);

    // Find employee whose bcrypt hash matches the provided token
    // We do this via RPC to avoid exposing the logic client-side
    const { data: validAdmin } = await serviceClient.rpc('verify_admin_token', {
      p_token: adminToken,
    });

    if (!validAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { action, email, password, auth_user_id, full_name } = body;

    if (action === 'create') {
      // Check email doesn't already exist
      const { data: existing } = await serviceClient.auth.admin.listUsers();
      const alreadyExists = existing?.users?.some(
        (u) => u.email?.toLowerCase() === email?.toLowerCase()
      );
      if (alreadyExists) {
        return new Response(
          JSON.stringify({ error: 'An account with this email already exists.' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await serviceClient.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: { full_name: full_name ?? '' },
      });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ auth_user_id: data.user.id }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'update_password') {
      if (!auth_user_id || !password) {
        return new Response(JSON.stringify({ error: 'auth_user_id and password required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error } = await serviceClient.auth.admin.updateUserById(auth_user_id, {
        password,
      });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'delete') {
      if (!auth_user_id) {
        return new Response(JSON.stringify({ error: 'auth_user_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error } = await serviceClient.auth.admin.deleteUser(auth_user_id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
