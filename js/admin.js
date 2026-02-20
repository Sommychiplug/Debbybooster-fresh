// js/admin.js

document.addEventListener('DOMContentLoaded', async () => {
  const user = await getCurrentUser();
  if (!user || !(await isAdmin(user.id))) {
    window.location.href = '/index.html';
    return;
  }

  // Tab switching
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-button').forEach(b => {
        b.classList.remove('active', 'border-purple-500', 'text-purple-600');
        b.classList.add('border-transparent', 'text-gray-500');
      });
      btn.classList.add('active', 'border-purple-500', 'text-purple-600');
      btn.classList.remove('border-transparent', 'text-gray-500');
      
      const tabId = btn.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(tc => tc.classList.add('hidden'));
      document.getElementById(`${tabId}-tab`).classList.remove('hidden');
      
      // Load data for the selected tab
      if (tabId === 'users') loadUsers();
      else if (tabId === 'orders') loadOrders();
      else if (tabId === 'deposits') loadDeposits();
      else if (tabId === 'services') loadServices();
      else if (tabId === 'referrals') loadReferrals();
      else if (tabId === 'withdrawals') loadWithdrawals();
    });
  });

  // Load initial tab (users)
  loadUsers();

  // Logout
  document.getElementById('logout').addEventListener('click', async () => {
    await signOut();
    window.location.href = '/index.html';
  });

  // Post announcement
  document.getElementById('post-announcement').addEventListener('click', async () => {
    const msg = document.getElementById('announcement-msg').value;
    if (!msg) return;
    const { error } = await supabase.from('announcements').insert({ message: msg });
    if (error) alert('Error: ' + error.message);
    else {
      alert('Announcement posted!');
      document.getElementById('announcement-msg').value = '';
    }
  });

  // Service modal buttons
  document.getElementById('add-service-btn').addEventListener('click', () => {
    document.getElementById('service-id').value = '';
    document.getElementById('service-name').value = '';
    document.getElementById('service-min').value = '';
    document.getElementById('service-max').value = '';
    document.getElementById('service-price').value = '';
    document.getElementById('service-api').value = '';
    document.getElementById('service-modal').classList.remove('hidden');
  });

  document.getElementById('cancel-service').addEventListener('click', () => {
    document.getElementById('service-modal').classList.add('hidden');
  });

  document.getElementById('save-service').addEventListener('click', async () => {
    const id = document.getElementById('service-id').value;
    const name = document.getElementById('service-name').value;
    const min = parseInt(document.getElementById('service-min').value);
    const max = parseInt(document.getElementById('service-max').value);
    const price = parseFloat(document.getElementById('service-price').value);
    const apiId = document.getElementById('service-api').value;

    if (!name || !min || !max || !price) {
      alert('All fields required');
      return;
    }

    const serviceData = {
      name,
      min_quantity: min,
      max_quantity: max,
      price_per_unit: price,
      api_service_id: apiId
    };

    let error;
    if (id) {
      ({ error } = await supabase.from('services').update(serviceData).eq('id', id));
    } else {
      ({ error } = await supabase.from('services').insert(serviceData));
    }
    if (error) alert(error.message);
    else {
      document.getElementById('service-modal').classList.add('hidden');
      loadServices();
    }
  });
});

// --- User Management ---
async function loadUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    document.getElementById('users-table').innerHTML = 'Error loading users';
    return;
  }
  let html = '<table class="w-full border"><thead><tr><th>Email</th><th>Balance</th><th>Role</th><th>Referral Code</th><th>Actions</th></tr></thead><tbody>';
  data.forEach(u => {
    html += `<tr>
      <td class="border p-2">${u.email}</td>
      <td class="border p-2">₦${u.balance}</td>
      <td class="border p-2"><select class="role-select" data-id="${u.id}"><option value="user" ${u.role==='user'?'selected':''}>User</option><option value="admin" ${u.role==='admin'?'selected':''}>Admin</option></select></td>
      <td class="border p-2">${u.referral_code}</td>
      <td class="border p-2"><button class="bg-blue-500 text-white px-2 py-1 rounded" onclick="updateUserRole('${u.id}')">Save</button></td>
    </tr>`;
  });
  html += '</tbody></table>';
  document.getElementById('users-table').innerHTML = html;
}
window.updateUserRole = async (userId) => {
  const select = document.querySelector(`.role-select[data-id="${userId}"]`);
  const role = select.value;
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
  if (error) alert(error.message);
  else alert('Role updated');
};

// --- Order Management ---
async function loadOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*, profiles(email), services(name)')
    .order('created_at', { ascending: false });
  if (error) {
    document.getElementById('orders-table').innerHTML = 'Error loading orders';
    return;
  }
  let html = '<table class="w-full border"><thead><tr><th>User</th><th>Service</th><th>Quantity</th><th>Total</th><th>Status</th><th>Link</th><th>Actions</th></tr></thead><tbody>';
  data.forEach(o => {
    html += `<tr>
      <td class="border p-2">${o.profiles?.email || 'N/A'}</td>
      <td class="border p-2">${o.services?.name || 'N/A'}</td>
      <td class="border p-2">${o.quantity}</td>
      <td class="border p-2">₦${o.total_price}</td>
      <td class="border p-2">
        <select class="order-status" data-id="${o.id}">
          <option value="pending" ${o.status==='pending'?'selected':''}>Pending</option>
          <option value="processing" ${o.status==='processing'?'selected':''}>Processing</option>
          <option value="completed" ${o.status==='completed'?'selected':''}>Completed</option>
          <option value="cancelled" ${o.status==='cancelled'?'selected':''}>Cancelled</option>
        </select>
      </td>
      <td class="border p-2"><a href="${o.target_link}" target="_blank" class="text-blue-600">Link</a></td>
      <td class="border p-2"><button class="bg-blue-500 text-white px-2 py-1 rounded" onclick="updateOrderStatus('${o.id}')">Save</button></td>
    </tr>`;
  });
  html += '</tbody></table>';
  document.getElementById('orders-table').innerHTML = html;
}
window.updateOrderStatus = async (orderId) => {
  const select = document.querySelector(`.order-status[data-id="${orderId}"]`);
  const status = select.value;
  const { error } = await supabase.from('orders').update({ status, updated_at: new Date() }).eq('id', orderId);
  if (error) alert(error.message);
  else alert('Status updated');
};

// --- Deposit Management ---
async function loadDeposits() {
  const { data, error } = await supabase
    .from('deposits')
    .select('*, profiles(email)')
    .order('created_at', { ascending: false });
  if (error) {
    document.getElementById('deposits-table').innerHTML = 'Error loading deposits';
    return;
  }
  let html = '<table class="w-full border"><thead><tr><th>User</th><th>Amount</th><th>Reference</th><th>Status</th><th>Method</th><th>Created</th><th>Actions</th></tr></thead><tbody>';
  data.forEach(d => {
    html += `<tr>
      <td class="border p-2">${d.profiles?.email || 'N/A'}</td>
      <td class="border p-2">₦${d.amount}</td>
      <td class="border p-2">${d.reference}</td>
      <td class="border p-2">
        <select class="deposit-status" data-id="${d.id}">
          <option value="pending" ${d.status==='pending'?'selected':''}>Pending</option>
          <option value="successful" ${d.status==='successful'?'selected':''}>Successful</option>
          <option value="failed" ${d.status==='failed'?'selected':''}>Failed</option>
        </select>
      </td>
      <td class="border p-2">${d.payment_method || 'N/A'}</td>
      <td class="border p-2">${new Date(d.created_at).toLocaleDateString()}</td>
      <td class="border p-2"><button class="bg-blue-500 text-white px-2 py-1 rounded" onclick="updateDepositStatus('${d.id}')">Save</button></td>
    </tr>`;
  });
  html += '</tbody></table>';
  document.getElementById('deposits-table').innerHTML = html;
}
window.updateDepositStatus = async (depositId) => {
  const select = document.querySelector(`.deposit-status[data-id="${depositId}"]`);
  const status = select.value;
  const { data, error } = await supabase.from('deposits').update({ status }).eq('id', depositId).select().single();
  if (error) alert(error.message);
  else {
    if (status === 'successful') {
      await supabase.rpc('add_to_balance', { user_id: data.user_id, inc: data.amount });
    }
    alert('Deposit updated');
  }
};

// --- Service Management (CRUD) ---
async function loadServices() {
  const { data, error } = await supabase.from('services').select('*').order('id');
  if (error) {
    document.getElementById('services-table').innerHTML = 'Error loading services';
    return;
  }
  let html = '<table class="w-full border"><thead><tr><th>ID</th><th>Name</th><th>Min</th><th>Max</th><th>Price/unit</th><th>API ID</th><th>Actions</th></tr></thead><tbody>';
  data.forEach(s => {
    html += `<tr>
      <td class="border p-2">${s.id}</td>
      <td class="border p-2">${s.name}</td>
      <td class="border p-2">${s.min_quantity}</td>
      <td class="border p-2">${s.max_quantity}</td>
      <td class="border p-2">₦${s.price_per_unit}</td>
      <td class="border p-2">${s.api_service_id || ''}</td>
      <td class="border p-2">
        <button class="bg-yellow-500 text-white px-2 py-1 rounded mr-1" onclick="editService(${s.id})">Edit</button>
        <button class="bg-red-500 text-white px-2 py-1 rounded" onclick="deleteService(${s.id})">Delete</button>
      </td>
    </tr>`;
  });
  html += '</tbody></table>';
  document.getElementById('services-table').innerHTML = html;
}
window.editService = async (id) => {
  const { data, error } = await supabase.from('services').select('*').eq('id', id).single();
  if (error) {
    alert('Error loading service');
    return;
  }
  document.getElementById('service-id').value = data.id;
  document.getElementById('service-name').value = data.name;
  document.getElementById('service-min').value = data.min_quantity;
  document.getElementById('service-max').value = data.max_quantity;
  document.getElementById('service-price').value = data.price_per_unit;
  document.getElementById('service-api').value = data.api_service_id || '';
  document.getElementById('service-modal').classList.remove('hidden');
};
window.deleteService = async (id) => {
  if (confirm('Are you sure?')) {
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (error) alert(error.message);
    else loadServices();
  }
};

// --- Referral Management ---
async function loadReferrals() {
  const { data, error } = await supabase
    .from('referrals')
    .select('*, referrer:profiles!referrer_id(email), referred:profiles!referred_id(email)')
    .order('created_at', { ascending: false });
  if (error) {
    document.getElementById('referrals-table').innerHTML = 'Error loading referrals';
    return;
  }
  let html = '<table class="w-full border"><thead><tr><th>Referrer</th><th>Referred</th><th>Bonus Paid</th><th>Date</th></tr></thead><tbody>';
  data.forEach(r => {
    html += `<tr>
      <td class="border p-2">${r.referrer?.email || 'N/A'}</td>
      <td class="border p-2">${r.referred?.email || 'N/A'}</td>
      <td class="border p-2">${r.bonus_paid ? 'Yes' : 'No'}</td>
      <td class="border p-2">${new Date(r.created_at).toLocaleDateString()}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  document.getElementById('referrals-table').innerHTML = html;
}

// --- Withdrawal Management ---
async function loadWithdrawals() {
  const { data, error } = await supabase
    .from('withdrawals')
    .select('*, profiles(email)')
    .order('created_at', { ascending: false });
  if (error) {
    document.getElementById('withdrawals-table').innerHTML = 'Error loading withdrawals';
    return;
  }
  let html = '<table class="w-full border"><thead><tr><th>User</th><th>Amount</th><th>Account</th><th>Bank</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
  data.forEach(w => {
    html += `<tr>
      <td class="border p-2">${w.profiles?.email || 'N/A'}</td>
      <td class="border p-2">₦${w.amount}</td>
      <td class="border p-2">${w.account_name} - ${w.account_number}</td>
      <td class="border p-2">${w.bank}</td>
      <td class="border p-2">
        <select class="withdrawal-status" data-id="${w.id}">
          <option value="pending" ${w.status==='pending'?'selected':''}>Pending</option>
          <option value="approved" ${w.status==='approved'?'selected':''}>Approved</option>
          <option value="completed" ${w.status==='completed'?'selected':''}>Completed</option>
          <option value="rejected" ${w.status==='rejected'?'selected':''}>Rejected</option>
        </select>
      </td>
      <td class="border p-2"><button class="bg-blue-500 text-white px-2 py-1 rounded" onclick="updateWithdrawalStatus('${w.id}')">Save</button></td>
    </tr>`;
  });
  html += '</tbody></table>';
  document.getElementById('withdrawals-table').innerHTML = html;
}
window.updateWithdrawalStatus = async (withdrawalId) => {
  const select = document.querySelector(`.withdrawal-status[data-id="${withdrawalId}"]`);
  const status = select.value;
  const { error } = await supabase.from('withdrawals').update({ status }).eq('id', withdrawalId);
  if (error) alert(error.message);
  else alert('Status updated');
};