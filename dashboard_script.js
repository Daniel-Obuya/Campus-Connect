document.addEventListener('DOMContentLoaded', () => {
    // Set current year in footer
    const currentYearSpan = document.getElementById('current-year');
    if (currentYearSpan) {
        currentYearSpan.textContent = new Date().getFullYear();
    }

    // --- Mock Data & Placeholder Functions ---
    // In a real application, this data would come from a backend API

    // Profile Completion
    const profileProgress = document.getElementById('profile-progress');
    if (profileProgress) {
        const completionPercentage = 60; // Example: 60%
        profileProgress.style.width = `${completionPercentage}%`;
        profileProgress.textContent = `${completionPercentage}%`;
    }

    // Personalized Feed (Placeholder)
    const feedSection = document.getElementById('personalized-feed');
    if (feedSection) {
        // Simulate fetching feed items
        setTimeout(() => {
            feedSection.innerHTML = '<h2>Your Feed</h2><p>No new items in your feed right now. Follow some departments or clubs!</p>';
            // Example: feedSection.innerHTML = '<h2>Your Feed</h2><div>Item 1</div><div>Item 2</div>';
        }, 1500);
    }

    // Upcoming Events (Placeholder)
    const calendarPlaceholder = document.getElementById('calendar-placeholder');
    if (calendarPlaceholder) {
        // Simulate fetching events
        setTimeout(() => {
            calendarPlaceholder.innerHTML = '<p>Event 1: Oct 26 - Midterm Study Group</p><p>Event 2: Nov 5 - Coding Club Meetup</p>';
            // In a real app, you'd integrate a calendar library here
        }, 1000);
    }

    // Recent Announcements (Placeholder)
    const announcementsSection = document.getElementById('recent-announcements');
    if (announcementsSection) {
        // Simulate fetching announcements
        setTimeout(() => {
            announcementsSection.innerHTML = '<h2>Announcements</h2><p>Library hours extended for exams.</p><p>New cafeteria menu next week.</p>';
        }, 1200);
    }

    // Notification Center (Basic Toggle Example)
    const notificationIcon = document.getElementById('notification-icon');
    const notificationPanel = document.getElementById('notification-center-panel');
    const notificationCount = document.getElementById('notification-count');

    if (notificationIcon && notificationPanel) {
        // Simulate some notifications
        const unreadNotifications = 3;
        if (notificationCount) {
            notificationCount.textContent = unreadNotifications > 0 ? unreadNotifications : '0';
            if (unreadNotifications === 0) {
                notificationCount.style.display = 'none';
            }
        }

        notificationIcon.addEventListener('click', () => {
            notificationPanel.classList.toggle('is-visible');
            // Potentially mark notifications as read here or fetch detailed notifications
        });
    }

    console.log('Student Dashboard script loaded.');
    // Add more dynamic functionalities here:
    // - Fetching data from APIs
    // - Handling user interactions
    // - Updating the DOM dynamically
});
