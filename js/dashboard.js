// js/dashboard.js
document.addEventListener('DOMContentLoaded', async () => {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = '/index.html';
    return;
  }

  if (await isAdmin(user.id)) {
    window.location.href = '/admin.html';
    return;
  }

  // Load user profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    console.error('Profile error:', profileError);
    document.getElementById('user-info').innerHTML = '<p class="text-red-500">Error loading profile</p>';
    return;
  }

  document.getElementById('user-info').innerHTML = `
    <p>Welcome, ${profile.email}</p>
    <p>Balance: ₦${profile.balance}</p>
  `;
  document.getElementById('balance').innerText = profile.balance;
  document.getElementById('referral-code').innerText = profile.referral_code;

  await loadStats(user.id);

  // Load services dropdown
  const { data: services, error: servicesError } = await supabase
    .from('services')
    .select('*');
  if (servicesError) {
    console.error('Services error:', servicesError);
    return;
  }

  const serviceSelect = document.getElementById('service');
  services.forEach(s => {
    const option = document.createElement('option');
    option.value = s.id;
    option.textContent = `${s.name} (₦${s.price_per_unit}/unit)`;
    serviceSelect.appendChild(option);
  });

  const quantityInput = document.getElementById('quantity');
  const totalSpan = document.getElementById('total-price');

  function updateTotal() {
    const serviceId = serviceSelect.value;
    const quantity = parseInt(quantityInput.value) || 0;
    if (serviceId && quantity) {
      const service = services.find(s => s.id == serviceId);
      if (service) {
        if (quantity < service.min_quantity || quantity > service.max_quantity) {
          totalSpan.innerText = 'Invalid quantity';
        } else {
          totalSpan.innerText = (quantity * service.price_per_unit).toFixed(2);
        }
      }
    }
  }
  serviceSelect.addEventListener('change', updateTotal);
  quantityInput.addEventListener('input', updateTotal);

  document.getElementById('order-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const serviceId = serviceSelect.value;
    const quantity = parseInt(quantityInput.value);
    const link = document.getElementById('link').value;
    const service = services.find(s => s.id == serviceId);
    if (!service) return;
    if (quantity < service.min_quantity || quantity > service.max_quantity) {
      alert('Quantity out of range');
      return;
    }
    const total = quantity * service.price_per_unit;

    const response = await fetch('/.netlify/functions/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, service_id: serviceId, quantity, link, total })
    });
    const result = await response.json();
    if (response.ok) {
      alert('Order placed successfully!');
      location.reload();
    } else {
      alert('Error: ' + result.error);
    }
  });

  // Load orders
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('*, services(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const ordersDiv = document.getElementById('orders-list');
  if (ordersError || !orders.length) {
    ordersDiv.innerHTML = 'No orders yet.';
  } else {
    ordersDiv.innerHTML = orders.map(o => `
      <div class="border-b py-2">
        <p><strong>${o.services?.name || 'Unknown'}</strong> x${o.quantity} - ₦${o.total_price}</p>
        <p>Status: ${o.status} | ${new Date(o.created_at).toLocaleString()}</p>
      </div>
    `).join('');
  }

  // Withdraw button toggle
  const withdrawBtn = document.getElementById('withdraw-btn');
  const withdrawForm = document.getElementById('withdraw-form');
  if (withdrawBtn) {
    withdrawBtn.addEventListener('click', () => {
      withdrawForm.classList.toggle('hidden');
    });
  }

  const submitWithdraw = document.getElementById('submit-withdraw');
  if (submitWithdraw) {
    submitWithdraw.addEventListener('click', async () => {
      const amount = parseFloat(document.getElementById('withdraw-amount').value);
      const accountName = document.getElementById('withdraw-account-name').value;
      const accountNumber = document.getElementById('withdraw-account-number').value;
      const bank = document.getElementById('withdraw-bank').value;
      const errorDiv = document.getElementById('withdraw-error');
      errorDiv.innerText = '';

      if (!amount || !accountName || !accountNumber || !bank) {
        errorDiv.innerText = 'All fields are required';
        return;
      }
      if (amount < 1000) {
        errorDiv.innerText = 'Minimum withdrawal is ₦1000';
        return;
      }

      const response = await fetch('/.netlify/functions/withdraw-bonus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, amount, accountName, accountNumber, bank })
      });
      const result = await response.json();
      if (response.ok) {
        alert('Withdrawal request submitted!');
        withdrawForm.classList.add('hidden');
        location.reload();
      } else {
        errorDiv.innerText = result.error || 'Error submitting withdrawal';
      }
    });
  }

  // Deposit toggle
  const showDeposit = document.getElementById('show-deposit-form');
  const depositForm = document.getElementById('deposit-form-container');
  if (showDeposit) {
    showDeposit.addEventListener('click', () => {
      depositForm.classList.toggle('hidden');
    });
  }

  const submitDeposit = document.getElementById('submit-deposit');
  if (submitDeposit) {
    submitDeposit.addEventListener('click', async () => {
      const amount = parseFloat(document.getElementById('deposit-amount').value);
      const errorDiv = document.getElementById('deposit-error');
      errorDiv.innerText = '';

      if (!amount || amount < 100) {
        errorDiv.innerText = 'Minimum deposit is ₦100';
        return;
      }

      const reference = 'DEP_' + Date.now() + '_' + Math.random().toString(36).substring(7);

      const { error: insertError } = await supabase.from('deposits').insert({
        user_id: user.id,
        amount,
        reference,
        status: 'pending',
        payment_method: 'kora'
      });
      if (insertError) {
        errorDiv.innerText = insertError.message;
        return;
      }

      const paymentData = {
        amount: amount * 100,
        reference,
        customer: {
          email: profile.email,
          name: profile.email.split('@')[0]
        },
        redirect_url: window.location.origin + '/payment-callback.html'
      };

      try {
        const response = await fetch('/.netlify/functions/initiate-kora-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(paymentData)
        });
        const result = await response.json();
        if (response.ok && result.payment_url) {
          window.location.href = result.payment_url;
        } else {
          errorDiv.innerText = result.error || 'Payment initiation failed';
        }
      } catch (err) {
        errorDiv.innerText = 'Network error. Please try again.';
        console.error(err);
      }
    });
  }

  const logoutBtn = document.getElementById('logout');
  if (logoutBtn) {
   logoutBtn.addEventListener('click', async () => {
  await window.signOut();
  window.location.href = '/index.html';
});
  }
});

async function loadStats(userId) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('balance')
    .eq('id', userId)
    .single();
  if (profile) {
    document.getElementById('stats-balance').innerText = '₦' + profile.balance;
  }

  const { data: deposits } = await supabase
    .from('deposits')
    .select('amount')
    .eq('user_id', userId)
    .eq('status', 'successful');
  const totalDeposits = deposits ? deposits.reduce((sum, d) => sum + d.amount, 0) : 0;
  document.getElementById('stats-total-deposits').innerText = '₦' + totalDeposits;

  const { data: orders } = await supabase
    .from('orders')
    .select('status')
    .eq('user_id', userId);

  const counts = {
    pending: 0,
    processing: 0,
    completed: 0,
    cancelled: 0,
    total: orders ? orders.length : 0
  };
  if (orders) {
    orders.forEach(o => {
      if (counts.hasOwnProperty(o.status)) counts[o.status] += 1;
    });
  }
  document.getElementById('stats-pending-orders').innerText = counts.pending;
  document.getElementById('stats-processing').innerText = counts.processing;
  document.getElementById('stats-completed-orders').innerText = counts.completed;
  document.getElementById('stats-cancelled').innerText = counts.cancelled;
  document.getElementById('stats-total-orders').innerText = counts.total;
}