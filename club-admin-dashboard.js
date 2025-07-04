document.addEventListener('DOMContentLoaded', () => {
    const authToken = localStorage.getItem('authToken');
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));

    const welcomeMessage = document.getElementById('welcomeMessage');
    const dashboardTitle = document.getElementById('dashboardTitle');
    if (currentUser && currentUser.firstName) {
        welcomeMessage.textContent = `Welcome, ${currentUser.firstName}!`;
    }

    if (!authToken) {
        // Redirect to login if not authenticated
        window.location.href = '/login-admin';
        return;
    }

    // Helper function to prevent XSS
    function escapeHTML(str) {
        if (str === null || str === undefined) return '';
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    }

    async function fetchDashboardData() {
        try {
            const response = await fetch('/api/club/dashboard', {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('currentUser');
                    window.location.href = '/login-admin';
                }
                const errorResult = await response.json();
                throw new Error(errorResult.message || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                populateDashboard(result);
            } else {
                console.error('Failed to load dashboard data:', result.message);
                document.querySelector('.dashboard-content').innerHTML = `<p class="error-message">Error: ${escapeHTML(result.message)}</p>`;
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            document.querySelector('.dashboard-content').innerHTML = `<p class="error-message">Could not connect to the server to fetch dashboard data. ${error.message}</p>`;
        }
    }

    function populateDashboard(data) {
        // Populate Welcome Message with Club Name
        if (data.clubName) {
            welcomeMessage.textContent = `Welcome, ${currentUser.firstName} (${escapeHTML(data.clubName)})`;
            dashboardTitle.textContent = `${escapeHTML(data.clubName)} Admin Dashboard`;
        }

        // Populate Overview Stats
        if (data.overview) {
            document.getElementById('overviewActiveMembers').textContent = escapeHTML(data.overview.activeMembers);
            document.getElementById('overviewPendingRequests').textContent = escapeHTML(data.overview.pendingRequests);
            document.getElementById('overviewUpcomingEvents').textContent = escapeHTML(data.overview.upcomingEvents);
            document.getElementById('overviewEngagementRate').textContent = escapeHTML(data.overview.engagementRate);
        } else {
            // Fallback if overview data is missing
            document.getElementById('overviewActiveMembers').textContent = 'N/A';
            document.getElementById('overviewPendingRequests').textContent = 'N/A';
            document.getElementById('overviewUpcomingEvents').textContent = 'N/A';
            document.getElementById('overviewEngagementRate').textContent = 'N/A';
        }

        // Populate Pending Members
        const pendingMembersList = document.getElementById('pendingMembersList');
        if (data.members && data.members.pending && pendingMembersList) {
            if (data.members.pending.length > 0) { // Check if there are pending members
                pendingMembersList.innerHTML = data.members.pending.map(member => `
                    <li class="member-card">
                        <div class="member-info"><h4>${escapeHTML(member.name)}</h4><div class="member-role">${escapeHTML(member.role)}</div></div>
                        <div class="member-actions">
                            <button class="action-button action-button-primary btn-small" onclick="approveMember(${member.id})">Approve</button>
                            <button class="action-button action-button-danger btn-small" onclick="rejectMember(${member.id})">Reject</button>
                        </div>
                    </li>
                `).join('');
            } else {
                pendingMembersList.innerHTML = '<li>No pending join requests.</li>';
            }
        }

        // Populate Current Members
        const currentMembersList = document.getElementById('currentMembersList');
        if (data.members && data.members.current && currentMembersList) {
             if (data.members.current.length > 0) { // Check if there are current members
                currentMembersList.innerHTML = data.members.current.map(member => `                    
                    <li class="member-card">
                        <span>${escapeHTML(member.name)} - <strong>${escapeHTML(member.role)}</strong></span>
                    </li>
                `).join('');
            } else {
                currentMembersList.innerHTML = '<li>No current members.</li>';
            }
        }

        // Populate Events
        const clubEventsList = document.getElementById('clubEventsList');
        if (data.events && clubEventsList) {
            if (data.events.length > 0) { // Check if there are events
                clubEventsList.innerHTML = data.events.map(event => `                    
                    <li class="event-card">
                        <div class="event-header"><h3>${escapeHTML(event.title)}</h3><div class="event-date">${new Date(event.start_datetime).toLocaleDateString()}</div></div>
                        <div class="event-actions">
                            <a href="create_event.html?eventIdToEdit=${event.event_id}" class="edit-item-link">Edit</a>
                        </div>
                    </li>
                `).join('');
            } else {
                clubEventsList.innerHTML = '<li>No upcoming events.</li>';
            }
        }

        // Populate Announcements
        const clubAnnouncementsList = document.getElementById('clubAnnouncementsList');
        if (data.announcements && clubAnnouncementsList) {
            if (data.announcements.length > 0) { // Check if there are announcements
                clubAnnouncementsList.innerHTML = data.announcements.map(announcement => `                    
                    <li class="announcement-card">
                        <div class="announcement-header"><h3>${escapeHTML(announcement.title)}</h3><div class="announcement-time">${new Date(announcement.created_at).toLocaleDateString()}</div></div>
                        <div class="announcement-actions">
                            <a href="create_announcement.html?announcementIdToEdit=${announcement.announcement_id}" class="edit-item-link">Edit</a>
                        </div>
                    </li>
                `).join('');
            } else {
                clubAnnouncementsList.innerHTML = '<li>No recent announcements.</li>';
            }
        }
    }

    // Placeholder functions for member actions (these will be implemented in a future step)
    window.approveMember = (membershipId) => alert(`Approving member: ${membershipId}. Implement API call.`);
    window.rejectMember = (membershipId) => alert(`Rejecting member: ${membershipId}. Implement API call.`);
    
    // Logout functionality
    document.getElementById('logoutButton').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        window.location.href = '/welcome';
    });

    fetchDashboardData(); // Call to fetch and populate dashboard data on load
});