const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  
  try {
    const { user_id, amount, accountName, accountNumber, bank } = JSON.parse(event.body);

    // Validate amount
    if (amount < 1000) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Minimum withdrawal is ₦1000' }) };
    }

    // Check user balance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', user_id)
      .single();
    if (profileError || !profile) {
      return { statusCode: 400, body: JSON.stringify({ error: 'User not found' }) };
    }
    if (profile.balance < amount) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Insufficient balance' }) };
    }

    // Create withdrawal request with account details
    const { error: withdrawError } = await supabase
      .from('withdrawals')
      .insert({
        user_id,
        amount,
        account_name: accountName,
        account_number: accountNumber,
        bank,
        status: 'pending'
      });

    if (withdrawError) throw withdrawError;

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    console.error('Withdrawal error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};