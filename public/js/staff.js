document.addEventListener('DOMContentLoaded', () => {
  const staffForm = document.getElementById('staffForm');
  const staffTable = document.getElementById('staffTable');

  const loadStaff = async () => {
    const response = await fetch('https://college-7zfr.onrender.com/api/staff', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const staff = await response.json();
    staffTable.innerHTML = '';
    staff.forEach(s => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="p-2">${s.id}</td>
        <td class="p-2">${s.name}</td>
        <td class="p-2">${s.role}</td>
        <td class="p-2">
          <button onclick="editStaff(${s.id}, '${s.name}', '${s.role}', ${s.user_id})" class="bg-yellow-500 text-white p-1 rounded">Edit</button>
          <button onclick="deleteStaff(${s.id})" class="bg-red-500 text-white p-1 rounded">Delete</button>
        </td>
      `;
      staffTable.appendChild(row);
    });
  };

  staffForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('staffId').value;
    const userId = document.getElementById('userId').value;
    const name = document.getElementById('name').value;
    const role = document.getElementById('role').value;
    const method = id ? 'PUT' : 'POST';
    const url = id ? `https://college-7zfr.onrender.com/api/staff/${id}` : 'https://college-7zfr.onrender.com/api/staff';
    await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ user_id: userId, name, role })
    });
    staffForm.reset();
    document.getElementById('staffId').value = '';
    loadStaff();
  });

  window.editStaff = (id, name, role, userId) => {
    document.getElementById('staffId').value = id;
    document.getElementById('userId').value = userId;
    document.getElementById('name').value = name;
    document.getElementById('role').value = role;
  };

  window.deleteStaff = async (id) => {
    await fetch(`https://college-7zfr.onrender.com/api/staff/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    loadStaff();
  };

  loadStaff();
});