// Define functions first
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
    await supabase.from('profiles').insert({
      id: user.id,
      email: user.email,
      referral_code: refCode,
      referred_by: referredBy,
      role: 'user',
      balance: 0,
    });
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

async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

function generateReferralCode(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
}

async function isAdmin(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  return !error && data?.role === 'admin';
}

// Attach to window (after definitions)
window.signUp = signUp;
window.signIn = signIn;
window.signOut = signOut;
window.generateReferralCode = generateReferralCode;
window.getCurrentUser = getCurrentUser;
window.isAdmin = isAdmin;

console.log('Auth functions loaded');