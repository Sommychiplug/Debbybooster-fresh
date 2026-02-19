const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  
  try {
    const { user_id, service_id, quantity, link, total } = JSON.parse(event.body);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', user_id)
      .single();
    if (profileError || !profile) {
      return { statusCode: 400, body: JSON.stringify({ error: 'User not found' }) };
    }
    if (profile.balance < total) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Insufficient balance' }) };
    }

    const { error: orderError } = await supabase.rpc('place_order', {
      p_user_id: user_id,
      p_service_id: service_id,
      p_quantity: quantity,
      p_total_price: total,
      p_target_link: link
    });

    if (orderError) throw orderError;

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};