document.addEventListener('DOMContentLoaded', () => {
  const taskForm = document.getElementById('taskForm');
  const taskTable = document.getElementById('taskTable');
  const staffIdSelect = document.getElementById('staffId');
  const rejectionTable = document.getElementById('rejectionTable');
  const isAdmin = localStorage.getItem('role') === 'admin';
  let currentTaskId;

  async function loadStaff() {
    if (!staffIdSelect) return;
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');
      const response = await fetch('http://localhost:3000/api/tasks/staff', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error(await response.text());
      const staff = await response.json();
      staffIdSelect.innerHTML = '<option value="">Select Staff</option>';
      staff.forEach(s => {
        const option = document.createElement('option');
        option.value = s.id;
        option.textContent = `${s.name} (${s.role})`;
        staffIdSelect.appendChild(option);
      });
      console.log('Staff loaded:', staff);
    } catch (error) {
      console.error('Error loading staff:', error);
      showModal('Error', 'Failed to load staff');
    }
  }

  async function loadTasks() {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        showModal('Error', 'Please log in again');
        window.location.href = 'login.html';
        return;
      }
      const response = await fetch('http://localhost:3000/api/tasks', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error(await response.text());
      const tasks = await response.json();
      console.log('Loaded tasks:', tasks);
      if (taskTable) {
        taskTable.innerHTML = '';
        tasks.forEach(task => {
          const row = document.createElement('tr');
          if (isAdmin) {
            row.innerHTML = `
              <td class="p-2 border">${task.id}</td>
              <td class="p-2 border">${task.staff_name || 'N/A'}</td>
              <td class="p-2 border">${task.description}</td>
              <td class="p-2 border">${task.status}</td>
              <td class="p-2 border">${task.approved ? 'Yes' : 'No'}</td>
              <td class="p-2 border">${task.evidence || 'None'}</td>
              <td class="p-2 border">${task.rejection_reason || 'None'}</td>
              <td class="p-2 border">
                <button onclick="editTask(${task.id}, '${task.staff_id}', '${task.description}', '${task.status}')" class="bg-yellow-500 text-white p-1 rounded mr-2">Edit</button>
                <button onclick="deleteTask(${task.id})" class="bg-red-500 text-white p-1 rounded mr-2">Delete</button>
                ${task.status === 'completed' && !task.approved ? `
                  <button onclick="approveTask(${task.id})" class="bg-green-500 text-white p-1 rounded mr-2">Approve</button>
                  <button onclick="openRejectModal(${task.id})" class="bg-orange-500 text-white p-1 rounded">Reject</button>
                ` : ''}
              </td>
            `;
          } else {
            console.log(`Rendering task ${task.id}: status=${task.status}, rejection_request_id=${task.rejection_request_id}, rejection_request_status=${task.rejection_request_status}, rejection_reason=${task.rejection_reason}`);
            const showActions = task.status !== 'completed' && (!task.rejection_request_id || task.rejection_request_status !== 'pending');
            row.innerHTML = `
              <td class="p-2 border">${task.id}</td>
              <td class="p-2 border">${task.description}</td>
              <td class="p-2 border">${task.status}</td>
              <td class="p-2 border">${task.approved ? 'Yes' : 'No'}</td>
              <td class="p-2 border">${task.evidence || 'None'}</td>
              <td class="p-2 border">${task.rejection_reason || 'None'}</td>
              <td class="p-2 border">
                ${showActions ? `
                  <button onclick="openEvidenceModal(${task.id})" class="bg-yellow-500 text-white p-1 rounded mr-2">Mark Completed</button>
                  <button onclick="openRejectTaskModal(${task.id})" class="bg-orange-500 text-white p-1 rounded">Reject Task</button>
                ` : task.rejection_request_id && task.rejection_request_status === 'pending' ? `Rejection pending` : task.status === 'rejected' ? 'Rejected' : 'Completed'}
              </td>
            `;
          }
          taskTable.appendChild(row);
        });
      }
      if (isAdmin && rejectionTable) {
        rejectionTable.innerHTML = '';
        const pendingRequests = tasks.filter(t => t.rejection_request_id && t.rejection_request_status === 'pending');
        console.log('Pending rejection requests:', pendingRequests);
        pendingRequests.forEach(task => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td class="p-2 border">${task.rejection_request_id}</td>
            <td class="p-2 border">${task.id}</td>
            <td class="p-2 border">${task.staff_name}</td>
            <td class="p-2 border">${task.description}</td>
            <td class="p-2 border">${task.rejection_request_reason}</td>
            <td class="p-2 border">
              <button onclick="handleRejectionRequest(${task.rejection_request_id}, 'approve')" class="bg-green-500 text-white p-1 rounded mr-2">Approve</button>
              <button onclick="handleRejectionRequest(${task.rejection_request_id}, 'deny')" class="bg-red-500 text-white p-1 rounded">Deny</button>
            </td>
          `;
          rejectionTable.appendChild(row);
        });
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      showModal('Error', 'Failed to load tasks: ' + error.message);
    }
  }

  if (taskForm) {
    taskForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('taskId').value;
      const staff_id = document.getElementById('staffId').value;
      const description = document.getElementById('description').value;
      const status = document.getElementById('status').value;
      if (!staff_id || !description) {
        showModal('Error', 'Staff and description required');
        return;
      }
      try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `http://localhost:3000/api/tasks/${id}` : 'http://localhost:3000/api/tasks';
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ staff_id, description, status })
        });
        if (response.ok) {
          taskForm.reset();
          document.getElementById('taskId').value = '';
          loadTasks();
          showModal('Success', 'Task saved successfully');
        } else {
          throw new Error(await response.text());
        }
      } catch (error) {
        console.error('Error saving task:', error);
        showModal('Error', 'Failed to save task: ' + error.message);
      }
    });
  }

  window.editTask = (id, staff_id, description, status) => {
    document.getElementById('taskId').value = id;
    document.getElementById('staffId').value = staff_id;
    document.getElementById('description').value = description;
    document.getElementById('status').value = status;
  };

  window.deleteTask = async (id) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      const response = await fetch(`http://localhost:3000/api/tasks/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        loadTasks();
        showModal('Success', 'Task deleted');
      } else {
        throw new Error(await response.text());
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      showModal('Error', 'Failed to delete task: ' + error.message);
    }
  };

  window.approveTask = async (id) => {
    try {
      const response = await fetch(`http://localhost:3000/api/tasks/approve/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        loadTasks();
        showModal('Success', 'Task approved');
      } else {
        throw new Error(await response.text());
      }
    } catch (error) {
      console.error('Error approving task:', error);
      showModal('Error', 'Failed to approve task: ' + error.message);
    }
  };

  window.openRejectModal = (id) => {
    currentTaskId = id;
    const modal = document.getElementById('actionModal');
    const title = document.getElementById('modalTitle');
    const button = document.getElementById('submitButton');
    const input = document.getElementById('actionInput');
    if (!modal || !title || !button || !input) {
      console.error('Admin rejection modal elements missing');
      showModal('Error', 'Modal not found');
      return;
    }
    modal.classList.remove('hidden');
    title.textContent = 'Reject Task (Admin)';
    input.value = '';
    input.placeholder = 'Enter rejection reason (e.g., Staff was late)';
    button.textContent = 'Submit Rejection';
    button.onclick = submitRejection;
    console.log('Admin rejection modal opened for task:', id);
  };

  window.openEvidenceModal = (id) => {
    currentTaskId = id;
    const modal = document.getElementById('actionModal');
    const title = document.getElementById('modalTitle');
    const button = document.getElementById('submitButton');
    const input = document.getElementById('actionInput');
    if (!modal || !title || !button || !input) {
      console.error('Evidence modal missing');
      showModal('Error', 'Modal not found');
      return;
    }
    modal.classList.remove('hidden');
    title.textContent = 'Submit Evidence';
    input.value = '';
    input.placeholder = 'Enter evidence of completion';
    button.textContent = 'Submit Evidence';
    button.onclick = submitEvidence;
    console.log('Evidence modal opened for task:', id);
  };

  window.openRejectTaskModal = (id) => {
    console.log('Opening reject task modal for task:', id);
    currentTaskId = id;
    const modal = document.getElementById('actionModal');
    const title = document.getElementById('modalTitle');
    const button = document.getElementById('submitButton');
    const input = document.getElementById('actionInput');
    if (!modal || !title || !button || !input) {
      console.error('Reject task modal elements missing:', { modal, title, button, input });
      showModal('Error', 'Unable to open rejection modal');
      return;
    }
    modal.classList.remove('hidden');
    title.textContent = 'Reject Task';
    input.value = '';
    input.placeholder = 'Enter reason for rejection (e.g., I am sick)';
    button.textContent = 'Submit Rejection';
    button.onclick = submitTaskRejection;
    console.log('Reject task modal opened for task:', id);
  };

  window.closeActionModal = () => {
    const modal = document.getElementById('actionModal');
    const input = document.getElementById('actionInput');
    const button = document.getElementById('submitButton');
    if (modal) {
      modal.classList.add('hidden');
      if (input) input.value = '';
      if (button) button.onclick = null;
      console.log('Modal closed');
    }
  };

  window.submitEvidence = async () => {
    const input = document.getElementById('actionInput').value.trim();
    if (!input) {
      showModal('Error', 'Evidence is required');
      return;
    }
    console.log(`Submitting evidence for task ${currentTaskId}: ${input}`);
    try {
      const response = await fetch(`http://localhost:3000/api/tasks/${currentTaskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: 'completed', evidence: input })
      });
      if (!response.ok) throw new Error(await response.text());
      console.log(`Evidence submitted for task ${currentTaskId}`);
      showModal('Success', 'Evidence submitted');
      closeActionModal();
      loadTasks();
    } catch (error) {
      console.error('Error submitting evidence:', error);
      showModal('Error', 'Failed to submit evidence: ' + error.message);
    }
  };

  window.submitRejection = async () => {
    const input = document.getElementById('actionInput').value.trim();
    if (!input) {
      showModal('Error', 'Rejection reason is required');
      return;
    }
    console.log(`Submitting admin rejection for task ${currentTaskId}: ${input}`);
    try {
      const response = await fetch(`http://localhost:3000/api/tasks/reject/${currentTaskId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ rejection_reason: input })
      });
      if (!response.ok) throw new Error(await response.text());
      console.log(`Task ${currentTaskId} rejected by admin`);
      showModal('Success', 'Task rejected');
      closeActionModal();
      loadTasks();
    } catch (error) {
      console.error('Error submitting admin rejection:', error);
      showModal('Error', 'Failed to reject task: ' + error.message);
    }
  };

  window.submitTaskRejection = async () => {
    const input = document.getElementById('actionInput');
    if (!input) {
      console.error('Rejection input not found');
      showModal('Error', 'Input field missing');
      return;
    }
    const reason = input.value.trim();
    if (!reason) {
      showModal('Error', 'Please provide a reason for rejection');
      return;
    }
    console.log(`Submitting rejection for task ${currentTaskId}: ${reason}`);
    try {
      const response = await fetch(`http://localhost:3000/api/tasks/request-rejection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ task_id: currentTaskId, reason })
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Rejection failed:', errorText);
        throw new Error(errorText);
      }
      console.log(`Rejection submitted for task ${currentTaskId}`);
      showModal('Success', 'Rejection request sent to admin');
      closeActionModal();
      loadTasks();
    } catch (error) {
      console.error('Error submitting rejection:', error);
      showModal('Error', 'Failed to send rejection request: ' + error.message);
    }
  };

  window.handleRejectionRequest = async (id, action) => {
    if (!confirm('Are you sure you want to ' + action + ' this rejection request?')) return;
    try {
      const response = await fetch(`http://localhost:3000/api/tasks/rejection-request/${id}/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      console.log(`Rejection request ${action}d: ${id}`);
      showModal('Success', `Rejection request ${action}d`);
      loadTasks();
    } catch (error) {
      console.error(`Error ${action}ing rejection request:`, error);
      showModal('Error', `Failed to ${action} rejection request: ${error.message}`);
    }
  };

  function showModal(title, message) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center';
    modal.innerHTML = `
      <div class="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
        <h3 class="text-lg font-bold mb-4">${title}</h3>
        <p class="mb-4">${message}</p>
        <button onclick="this.parentElement.parentElement.remove()" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Close</button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  if (isAdmin && staffIdSelect) loadStaff();
  loadTasks();
});