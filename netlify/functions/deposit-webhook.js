const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

exports.handler = async (event) => {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const koraSecret = process.env.KORA_SECRET_KEY;

  // Verify signature (Kora sends a signature in headers)
  const signature = event.headers['x-kora-signature'];
  const hash = crypto.createHmac('sha256', koraSecret).update(event.body).digest('hex');
  if (signature !== hash) {
    return { statusCode: 401, body: 'Invalid signature' };
  }

  const payload = JSON.parse(event.body);
  // Kora sends event like 'charge.success'
  if (payload.event === 'charge.success') {
    const { reference, amount } = payload.data; // amount in kobo
    const amountInNaira = amount / 100;

    // Find deposit by reference
    const { data: deposit } = await supabase
      .from('deposits')
      .select('user_id')
      .eq('reference', reference)
      .single();

    if (deposit) {
      // Mark deposit as successful
      await supabase
        .from('deposits')
        .update({ status: 'successful' })
        .eq('reference', reference);

      // Add balance to user
      await supabase.rpc('add_to_balance', { user_id: deposit.user_id, inc: amountInNaira });

      // Check for referral bonus (if deposit >= 500 and referred)
      const { data: profile } = await supabase
        .from('profiles')
        .select('referred_by')
        .eq('id', deposit.user_id)
        .single();
      if (profile?.referred_by && amountInNaira >= 500) {
        await supabase.rpc('add_to_balance', { user_id: profile.referred_by, inc: 100 });
        await supabase
          .from('referrals')
          .update({ bonus_paid: true })
          .eq('referred_id', deposit.user_id);
      }
    }
  }

  return { statusCode: 200, body: 'OK' };
};