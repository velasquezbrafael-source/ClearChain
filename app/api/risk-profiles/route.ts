import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (s) => { try { s.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {} },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('risk_profiles')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (s) => { try { s.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {} },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, signal_weights, risk_thresholds } = body;

  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  // Check if user has any existing profiles (to auto-activate first one)
  const { count } = await supabase
    .from('risk_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const isFirst = count === 0;

  const { data, error } = await supabase
    .from('risk_profiles')
    .insert({
      user_id: user.id,
      name: name.trim(),
      signal_weights: signal_weights ?? {
        ofac_match: 40,
        mixer_interaction: 25,
        rapid_fund_movement: 15,
        high_risk_counterparty: 10,
        volume_anomaly: 5,
        community_red_flags: 5,
      },
      risk_thresholds: risk_thresholds ?? { medium: 25, high: 50, critical: 75 },
      is_active: isFirst,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
