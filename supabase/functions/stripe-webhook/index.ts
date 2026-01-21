import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Stripe with Deno-compatible settings
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
  // Disable Node.js compatibility features that cause issues in Deno
  maxNetworkRetries: 0,
});

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Log webhook received
  console.log('Webhook received, method:', req.method);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));

  try {
    // Get the webhook secret and signature
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      // Return 200 to Stripe even on config errors to avoid retries
      return new Response(
        JSON.stringify({ received: true, error: 'Webhook secret not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the Stripe signature from headers
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      console.error('Missing stripe-signature header');
      // Return 200 to avoid Stripe retries
      return new Response(
        JSON.stringify({ received: true, error: 'Missing stripe-signature header' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the raw body
    const body = await req.text();
    console.log('Webhook body length:', body.length);

    // Verify webhook signature (use async version for Deno)
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      console.log('Webhook signature verified, event type:', event.type);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      // Return 200 to avoid Stripe retries for invalid signatures
      return new Response(
        JSON.stringify({ received: true, error: `Webhook Error: ${err.message}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Processing checkout.session.completed for session:', session.id);
        
        // Get metadata from the checkout session
        const userId = session.metadata?.user_id || session.client_reference_id;
        const planId = session.metadata?.plan_id;
        const durationDays = parseInt(session.metadata?.duration_days || '30', 10);
        const amount = parseFloat(session.metadata?.amount || '0');

        console.log('Session metadata:', {
          user_id: userId,
          plan_id: planId,
          duration_days: durationDays,
          amount: amount,
          client_reference_id: session.client_reference_id,
        });

        if (!userId) {
          console.error('No user_id found in checkout session metadata or client_reference_id');
          // Return 200 but log error - don't want Stripe to retry
          console.error('Session details:', {
            metadata: session.metadata,
            client_reference_id: session.client_reference_id,
            payment_status: session.payment_status,
          });
          // Continue to return success to Stripe
          break;
        }

        console.log('Activating premium for user:', userId, 'Duration:', durationDays, 'days');
        console.log('Payment details:', {
          payment_intent: session.payment_intent,
          session_id: session.id,
          amount: amount,
        });

        try {
          // First, verify the user exists in the database
          const { data: userCheck, error: userCheckError } = await supabaseClient
            .from('user_profiles')
            .select('id, subscription_status')
            .eq('id', userId)
            .single();
          
          if (userCheckError || !userCheck) {
            console.error('User not found in database:', userId);
            console.error('User check error:', userCheckError);
            break;
          }
          
          console.log('User found, current subscription_status:', userCheck.subscription_status);

          // Activate premium subscription
          const { data, error: activateError } = await supabaseClient.rpc('activate_premium_subscription', {
            p_user_id: userId,
            p_duration_days: durationDays,
            p_payment_id: session.payment_intent as string || session.id,
            p_payment_method: 'card',
            p_amount_paid: amount,
          });

          if (activateError) {
            console.error('❌ ERROR activating premium:', activateError);
            console.error('Error code:', activateError.code);
            console.error('Error message:', activateError.message);
            console.error('Error details:', JSON.stringify(activateError, null, 2));
            console.error('Error hint:', activateError.hint);
            // Log error but return 200 to Stripe to avoid retries
            // You can manually activate premium later if needed
          } else {
            console.log('✅ Premium activated successfully for user:', userId);
            console.log('Activation result:', data);
            
            // Verify the activation worked
            const { data: verifyUser, error: verifyError } = await supabaseClient
              .from('user_profiles')
              .select('id, subscription_status, premium_until')
              .eq('id', userId)
              .single();
            
            if (verifyError) {
              console.error('Error verifying activation:', verifyError);
            } else {
              console.log('Verification - subscription_status:', verifyUser.subscription_status);
              console.log('Verification - premium_until:', verifyUser.premium_until);
              
              if (verifyUser.subscription_status !== 'premium') {
                console.error('⚠️ WARNING: Activation completed but subscription_status is still:', verifyUser.subscription_status);
              }
            }
          }
        } catch (rpcError: any) {
          console.error('❌ EXCEPTION activating premium:', rpcError);
          console.error('Exception message:', rpcError.message);
          console.error('Exception stack:', rpcError.stack);
          // Continue to return success to Stripe
        }
        break;
      }

      case 'payment_intent.succeeded': {
        // Payment succeeded - additional handling if needed
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment succeeded:', paymentIntent.id);
        break;
      }

      case 'payment_intent.payment_failed': {
        // Payment failed - log for debugging
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.error('Payment failed:', paymentIntent.id);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Always return success response to Stripe (200 status)
    // This prevents Stripe from retrying the webhook
    // Log errors separately if needed
    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Webhook error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    
    // Return 200 even on errors to prevent Stripe retries
    // Log the error for manual investigation
    return new Response(
      JSON.stringify({ 
        received: true,
        error: error.message || 'Webhook handler failed',
        details: error.toString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

