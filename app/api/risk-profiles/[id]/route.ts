import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (s) => { try { s.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {} },
      },
    }
  );
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, signal_weights, risk_thresholds } = body;

  // Validate weights sum to 100
  if (signal_weights) {
    const total = Object.values(signal_weights as Record<string, number>).reduce((a, b) => a + b, 0);
    if (Math.round(total) !== 100) {
      return NextResponse.json({ error: `Signal weights must sum to 100 (got ${total})` }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from('risk_profiles')
    .update({ name, signal_weights, risk_thresholds, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Deactivate all profiles for this user, then activate the target
  await supabase
    .from('risk_profiles')
    .update({ is_active: false })
    .eq('user_id', user.id);

  const { data, error } = await supabase
    .from('risk_profiles')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check if this profile is active
  const { data: profile } = await supabase
    .from('risk_profiles')
    .select('is_active')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  const { error } = await supabase
    .from('risk_profiles')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If deleted profile was active, auto-activate the most recent remaining one
  if (profile?.is_active) {
    const { data: remaining } = await supabase
      .from('risk_profiles')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (remaining && remaining.length > 0) {
      await supabase
        .from('risk_profiles')
        .update({ is_active: true })
        .eq('id', remaining[0].id);
    }
  }

  return NextResponse.json({ ok: true });
}
