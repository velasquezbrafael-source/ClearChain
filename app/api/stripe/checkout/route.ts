import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { stripe } from '@/lib/stripe';

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

  // Reuse existing Stripe customer if stored, otherwise create new
  const existingCustomerId = user.user_metadata?.stripe_customer_id as string | undefined;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer: existingCustomerId,
    customer_email: existingCustomerId ? undefined : user.email,
    line_items: [
      {
        price: process.env.STRIPE_PRO_PRICE_ID!,
        quantity: 1,
      },
    ],
    success_url: `${req.nextUrl.origin}/dashboard/settings?upgraded=true`,
    cancel_url: `${req.nextUrl.origin}/pricing?cancelled=true`,
    metadata: {
      supabase_user_id: user.id,
    },
  });

  return NextResponse.json({ url: session.url });
}
