const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

exports.handler = async () => {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

  // Fetch pending orders (limit 10 per run)
  const { data: orders, error: fetchError } = await supabase
    .from('orders')
    .select('*, services(api_service_id)')
    .eq('status', 'pending')
    .limit(10);

  if (fetchError) {
    console.error('Error fetching pending orders:', fetchError);
    return { statusCode: 500, body: 'Error fetching orders' };
  }

  for (const order of orders) {
    try {
      // Call external SMM API (replace with your actual provider)
      const apiResponse = await fetch('https://exosupplier.com/api/v2/order', {
        method: 'POST',
        headers: { 
          'API-Key': process.env.SMM_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          service: order.services.api_service_id,
          quantity: order.quantity,
          link: order.target_link
        })
      });

      if (apiResponse.ok) {
        const result = await apiResponse.json();
        // Assume API returns { order_id: '12345' }
        await supabase
          .from('orders')
          .update({ status: 'processing', api_order_id: result.order_id })
          .eq('id', order.id);
      } else {
        // Mark as failed if API returns error
        await supabase
          .from('orders')
          .update({ status: 'failed' })
          .eq('id', order.id);
      }
    } catch (err) {
      console.error(`Error processing order ${order.id}:`, err);
      // Optionally mark as failed
      await supabase
        .from('orders')
        .update({ status: 'failed' })
        .eq('id', order.id);
    }
  }

  return { statusCode: 200, body: 'Processed' };
};