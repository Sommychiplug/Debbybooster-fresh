// js/auth.js (complete)
async function signUp(email, password, referralCode = '') {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;

  const user = data.user;
  if (user) {
    const refCode = generateReferralCode();
    let referredBy = null;
    if (referralCode) {
      const { data: referrer } = await supabase
        .from('profiles')
        .select('id')
        .eq('referral_code', referralCode)
        .single();
      if (referrer) referredBy = referrer.id;
    }

    // Insert profile
    const { error: profileError } = await supabase.from('profiles').insert({
      id: user.id,
      email: user.email,
      referral_code: refCode,
      referred_by: referredBy,
      role: 'user',
      balance: 0,
    });
    if (profileError) throw profileError;

    // If referred, create referral record
    if (referredBy) {
      await supabase.from('referrals').insert({
        referrer_id: referredBy,
        referred_id: user.id,
        bonus_paid: false,
      });
    }
  }
  return user;
}

// ... (rest of auth functions remain the same)