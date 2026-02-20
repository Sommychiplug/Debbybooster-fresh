const fetch = require('node-fetch');

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { amount, reference, customer, redirect_url } = JSON.parse(event.body);
    const koraSecretKey = process.env.KORA_SECRET_KEY;

    if (!koraSecretKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'KORA_SECRET_KEY not set' }) };
    }

    const response = await fetch('https://api.korapay.com/v1/merchant/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${koraSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        reference,
        customer,
        redirect_url,
        currency: 'NGN',
      }),
    });

    const data = await response.json();

    if (data.status === 'success') {
      return {
        statusCode: 200,
        body: JSON.stringify({ payment_url: data.data.checkout_url }),
      };
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: data.message || 'Payment initiation failed' }),
      };
    }
  } catch (err) {
    console.error('Kora initiation error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};