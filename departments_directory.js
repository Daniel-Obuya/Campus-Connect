// departments_directory.js
// Handles follow/unfollow for departments directory page, including dynamic content

async function fetchAndRenderFollowedDepartments() {
    const followedList = document.getElementById('followedDepartmentsList');
    if (!followedList) return;
    const token = localStorage.getItem('token');
    if (!token) {
        followedList.innerHTML = '<li>Please log in to view followed departments.</li>';
        return;
    }
    try {
        const res = await fetch('/api/user/followed-departments', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();
        if (res.ok && data.success && Array.isArray(data.departments)) {
            if (data.departments.length === 0) {
                followedList.innerHTML = '<li class="no-followed-message" style="text-align: center; color: var(--color-text-muted);">You are not following any departments yet.</li>';
            } else {
                followedList.innerHTML = '';
                data.departments.forEach(dept => {
                    const li = document.createElement('li');
                    li.className = 'followed-department-item';
                    li.innerHTML = `<span><i class="fas fa-university department-icon"></i> ${dept.name}</span>
                        <button class="action-button action-button-danger" data-department-id="${dept.department_id}">Unfollow</button>`;
                    li.querySelector('button').addEventListener('click', function () {
                        // Find the main button and trigger click
                        const mainBtn = document.querySelector(`.follow-department-btn[data-department-id='${dept.department_id}']`);
                        if (mainBtn) mainBtn.click();
                    });
                    followedList.appendChild(li);
                });
            }
        } else {
            followedList.innerHTML = '<li>Error loading followed departments.</li>';
        }
    } catch (err) {
        followedList.innerHTML = '<li>Network error loading followed departments.</li>';
    }
}

function attachFollowButtonListeners() {
    document.querySelectorAll('.follow-department-btn').forEach(function (btn) {
        // Prevent duplicate listeners
        if (btn.dataset.listenerAttached) return;
        btn.dataset.listenerAttached = 'true';
        btn.addEventListener('click', async function (e) {
            e.preventDefault();
            const departmentId = btn.dataset.departmentId;
            if (!departmentId) return;
            const token = localStorage.getItem('token');
            if (!token) {
                alert('You must be logged in as a student to follow departments.');
                return;
            }
            btn.disabled = true;
            const originalText = btn.textContent;
            const isFollow = !btn.classList.contains('following');
            btn.textContent = isFollow ? 'Unfollow' : 'Follow';
            btn.classList.toggle('following', isFollow);
            try {
                const res = await fetch(`/api/departments/${departmentId}/follow`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    }
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    if (data.following) {
                        btn.textContent = 'Unfollow';
                        btn.classList.add('following');
                    } else {
                        btn.textContent = 'Follow';
                        btn.classList.remove('following');
                    }
                    fetchAndRenderFollowedDepartments();
                } else {
                    alert(data.message || 'Error updating follow status.');
                    btn.textContent = originalText;
                    btn.classList.toggle('following', !isFollow);
                }
            } catch (err) {
                alert('Network error. Please try again.');
                btn.textContent = originalText;
                btn.classList.toggle('following', !isFollow);
            } finally {
                btn.disabled = false;
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', function () {
    attachFollowButtonListeners();
    fetchAndRenderFollowedDepartments();
    // If you use a "Load More" button or dynamic content, re-attach listeners after loading
    const moreBtn = document.getElementById('load-more-btn');
    if (moreBtn) {
        moreBtn.addEventListener('click', function () {
            setTimeout(() => {
                attachFollowButtonListeners();
                fetchAndRenderFollowedDepartments();
            }, 500);
        });
    }
    // If you use AJAX or other dynamic loading, call attachFollowButtonListeners() and fetchAndRenderFollowedDepartments() after updating the DOM
});
