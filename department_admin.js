document.addEventListener('DOMContentLoaded', () => {
    // Helper function to escape HTML to prevent XSS
    function escapeHTML(str) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    // --- Fetch and Display Department Announcements ---
    async function fetchAndDisplayDepartmentAnnouncements() {
        const announcementsListElement = document.getElementById('departmentAnnouncementsList');
        if (!announcementsListElement) {
            console.warn('Department announcements list element not found.');
            return;
        }

        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            announcementsListElement.innerHTML = '<li>Please log in to view announcements.</li>';
            return;
        }

        try {
            const response = await fetch('/api/announcements/department', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();

            if (result.success && result.announcements) {
                announcementsListElement.innerHTML = ''; // Clear existing items
                if (result.announcements.length === 0) {
                    announcementsListElement.innerHTML = '<li>No announcements found for your department.</li>';
                } else {
                    result.announcements.forEach(announcement => {
                        const listItem = document.createElement('li');
                        // Added Edit link for announcements
                        listItem.innerHTML = `
                            <span>📢 <strong>${escapeHTML(announcement.title)}</strong> - ${escapeHTML(announcement.content)} <small>(${new Date(announcement.created_at).toLocaleDateString()})</small></span>
                            <div class="item-actions"> <!-- Use a generic class for actions -->
                                <a href="create_announcement.html?announcementIdToEdit=${announcement.announcement_id}" class="edit-item-link">Edit</a>
                            </div>
                        `;
                        announcementsListElement.appendChild(listItem);
                    });
                }
            } else {
                announcementsListElement.innerHTML = `<li>Error fetching announcements: ${escapeHTML(result.message || 'Unknown error')}</li>`;
            }
        } catch (error) {
            console.error('Error fetching department announcements:', error);
            announcementsListElement.innerHTML = '<li>Could not connect to server to fetch announcements.</li>';
        }
    }

    // --- Fetch and Display Department Events ---
    async function fetchAndDisplayDepartmentEvents() {
        const eventsListElement = document.getElementById('departmentEventsList');
        if (!eventsListElement) {
            console.warn('Department events list element not found.');
            return;
        }

        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            eventsListElement.innerHTML = '<li>Please log in to view events.</li>';
            // Optionally redirect to login
            // window.location.href = '/login-admin';
            return;
        }

        try {
            const response = await fetch('/api/events/department', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();

            if (result.success && result.events) {
                eventsListElement.innerHTML = ''; // Clear any existing items or placeholders
                if (result.events.length === 0) {
                    eventsListElement.innerHTML = '<li>No events found for your department.</li>';
                } else {
                    result.events.forEach(event => {
                        const listItem = document.createElement('li');
                        // Added an Edit link
                        // Added a View Registered link
                        listItem.innerHTML = `
                            <span>
                                🎉 <strong>${escapeHTML(event.title)}</strong>
                                <br>
                                <small>Date: ${escapeHTML(event.start_datetime_formatted)} ${event.location ? `| Location: ${escapeHTML(event.location)}` : ''}</small>
                            </span>
                            <div class="item-actions"> <!-- Use a generic class for actions -->
                                <a href="create_event.html?eventIdToEdit=${event.event_id}" class="edit-item-link">Edit</a>
                                <a href="view_event_registrations.html?eventId=${event.event_id}" class="view-registered-link">View Registered</a>
                            </div>
                        `;
                        eventsListElement.appendChild(listItem);
                    });
                }
            } else {
                eventsListElement.innerHTML = `<li>Error fetching events: ${escapeHTML(result.message || 'Unknown error')}</li>`;
            }
        } catch (error) {
            console.error('Error fetching department events:', error);
            eventsListElement.innerHTML = '<li>Could not connect to server to fetch events.</li>';
        }
    }

    // Smooth scrolling for navigation links
    document.querySelectorAll('.dashboard-nav a').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // Initial call to fetch events when the page loads
    fetchAndDisplayDepartmentAnnouncements(); // Fetch and display announcements
    fetchAndDisplayDepartmentEvents();
    // TODO: Add calls for Research Opportunities and Course Updates when backend is ready
});