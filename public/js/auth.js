document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const logoutBtn = document.getElementById('logout');
  const userRole = document.getElementById('userRole');

  // Inactivity logout timer (30 minutes)
  let inactivityTimer;
  function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      localStorage.removeItem('userId');
      window.location.href = 'index.html';
    }, 30 * 60 * 1000);
  }
  document.addEventListener('mousemove', resetInactivityTimer);
  document.addEventListener('keypress', resetInactivityTimer);
  resetInactivityTimer();

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role);
        localStorage.setItem('userId', data.id);
        window.location.href = 'dashboard.html';
      } else {
        alert(data.error);
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value;
      const name = document.getElementById('name').value;
      const password = document.getElementById('password').value;
      const collegeRole = document.getElementById('collegeRole').value;
      const response = await fetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role: 'staff', name, collegeRole })
      });
      const data = await response.json();
      if (response.ok) {
        window.location.href = 'index.html';
      } else {
        alert(data.error);
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      localStorage.removeItem('userId');
      window.location.href = 'index.html';
    });
  }

  if (userRole) {
    userRole.textContent = localStorage.getItem('role');
  }

  updateNavigation();
});

function updateNavigation() {
  const role = localStorage.getItem('role');
  const navLinks = document.getElementById('nav-links');
  if (!navLinks) return;

  let links = '';
  if (role === 'admin') {
    links = `
      <a href="dashboard.html" class="mr-4">Dashboard</a>
      <a href="staff.html" class="mr-4">Manage Staff</a>
      <a href="tasks.html" class="mr-4">Manage Tasks</a>
      <a href="reports.html" class="mr-4">Reports</a>
      <button id="logout" class="ml-4">Logout</button>
    `;
  } else if (role === 'staff') {
    links = `
      <a href="dashboard.html" class="mr-4">Dashboard</a>
      <a href="staff-tasks.html" class="mr-4">View My Tasks</a>
      <button id="logout" class="ml-4">Logout</button>
    `;
  } else {
    links = '<a href="index.html" class="mr-4">Login</a>';
  }

  navLinks.innerHTML = links;

  const logoutBtn = document.getElementById('logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      localStorage.removeItem('userId');
      window.location.href = 'index.html';
    });
  }
}