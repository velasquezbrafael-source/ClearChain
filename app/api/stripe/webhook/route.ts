import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';

// Service role client — bypasses RLS to update auth.users metadata
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as import('stripe').Stripe.Checkout.Session;
    const userId = session.metadata?.supabase_user_id;
    const customerId = session.customer as string;

    if (userId) {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
          is_pro: true,
          stripe_customer_id: customerId,
        },
      });
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as import('stripe').Stripe.Subscription;
    const customerId = subscription.customer as string;

    // Look up user by stripe_customer_id stored in metadata
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const user = users?.users?.find(
      (u) => u.user_metadata?.stripe_customer_id === customerId
    );

    if (user) {
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          is_pro: false,
        },
      });
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as import('stripe').Stripe.Subscription;
    const customerId = subscription.customer as string;
    const isActive = subscription.status === 'active';

    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const user = users?.users?.find(
      (u) => u.user_metadata?.stripe_customer_id === customerId
    );

    if (user) {
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          is_pro: isActive,
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}
