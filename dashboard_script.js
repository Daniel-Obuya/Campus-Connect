document.addEventListener('DOMContentLoaded', () => {
    // Set current year in footer
    const currentYearSpan = document.getElementById('current-year');
    if (currentYearSpan) {
        currentYearSpan.textContent = new Date().getFullYear();
    }

    // Add staggered entrance animations to widgets
    const widgets = document.querySelectorAll('.dashboard-widget');
    widgets.forEach((widget, index) => {
        widget.style.opacity = '0';
        widget.style.transform = 'translateY(30px)';
        setTimeout(() => {
            widget.style.transition = 'all 0.6s ease';
            widget.style.opacity = '1';
            widget.style.transform = 'translateY(0)';
        }, 200 + (index * 100));
    });

    // Profile Completion Widget with enhanced animation
    const profileProgress = document.getElementById('profile-progress');
    if (profileProgress) {
        const completionPercentage = 75;
        
        setTimeout(() => {
            profileProgress.style.width = `${completionPercentage}%`;
            profileProgress.querySelector('.progress-text').textContent = `${completionPercentage}%`;
            
            // Add celebration effect for high completion
            if (completionPercentage >= 70) {
                profileProgress.classList.add('high-completion');
            }
        }, 800);
    }

    // Enhanced Personalized Feed
    const feedSection = document.getElementById('personalized-feed');
    if (feedSection) {
        setTimeout(() => {
            feedSection.innerHTML = `
                <div class="widget-header">
                    <h2>
                        <span class="widget-icon">📰</span>
                        Your Feed
                    </h2>
                </div>
                <ul class="feed-list">
                    <li class="feed-item">
                        <span class="feed-icon">📢</span>
                        <div class="feed-content">
                            <strong>Workshop on AI this Friday</strong>
                            <span class="feed-meta">CS Department</span>
                        </div>
                    </li>
                    <li class="feed-item">
                        <span class="feed-icon">📸</span>
                        <div class="feed-content">
                            <strong>Photography Club: New Exhibition Uploaded</strong>
                            <span class="feed-meta">2 hours ago</span>
                        </div>
                    </li>
                    <li class="feed-item">
                        <span class="feed-icon">🎯</span>
                        <div class="feed-content">
                            <strong>Career Fair Registration Open</strong>
                            <span class="feed-meta">Career Services</span>
                        </div>
                    </li>
                    <li class="feed-item">
                        <span class="feed-icon">🏆</span>
                        <div class="feed-content">
                            <strong>Hackathon Winners Announced</strong>
                            <span class="feed-meta">Tech Club</span>
                        </div>
                    </li>
                </ul>
            `;
            
            // Animate feed items
            const feedItems = feedSection.querySelectorAll('.feed-item');
            feedItems.forEach((item, index) => {
                item.style.opacity = '0';
                item.style.transform = 'translateX(-20px)';
                setTimeout(() => {
                    item.style.transition = 'all 0.4s ease';
                    item.style.opacity = '1';
                    item.style.transform = 'translateX(0)';
                }, index * 100);
            });
        }, 1000);
    }

    // Enhanced Upcoming Events Calendar
    const calendarPlaceholder = document.getElementById('calendar-placeholder');
    if (calendarPlaceholder) {
        setTimeout(() => {
            calendarPlaceholder.innerHTML = `
                <ul class="calendar-list">
                    <li class="calendar-item">
                        <span class="event-icon">🧠</span>
                        <div class="event-details">
                            <strong>AI Study Group</strong>
                            <span class="event-date">Oct 26</span>
                        </div>
                    </li>
                    <li class="calendar-item">
                        <span class="event-icon">💻</span>
                        <div class="event-details">
                            <strong>Hackathon Prep</strong>
                            <span class="event-date">Nov 5</span>
                        </div>
                    </li>
                    <li class="calendar-item">
                        <span class="event-icon">💼</span>
                        <div class="event-details">
                            <strong>Career Workshop</strong>
                            <span class="event-date">Nov 12</span>
                        </div>
                    </li>
                    <li class="calendar-item">
                        <span class="event-icon">🎤</span>
                        <div class="event-details">
                            <strong>Tech Talk</strong>
                            <span class="event-date">Nov 18</span>
                        </div>
                    </li>
                </ul>
            `;
        }, 1000);
    }

    // Enhanced Recent Announcements
    const announcementsSection = document.getElementById('recent-announcements');
    if (announcementsSection) {
        setTimeout(() => {
            announcementsSection.innerHTML = `
                <div class="widget-header">
                    <h2>
                        <span class="widget-icon">📢</span>
                        Announcements
                    </h2>
                </div>
                <ul class="announcement-list">
                    <li class="announcement-item">
                        <span class="announcement-icon">📚</span>
                        <span>Library hours extended till 10 PM</span>
                    </li>
                    <li class="announcement-item">
                        <span class="announcement-icon">🥗</span>
                        <span>New cafeteria menu available!</span>
                    </li>
                    <li class="announcement-item">
                        <span class="announcement-icon">🚗</span>
                        <span>Parking permits now available online</span>
                    </li>
                    <li class="announcement-item">
                        <span class="announcement-icon">📱</span>
                        <span>New campus app features released</span>
                    </li>
                </ul>
            `;
        }, 1100);
    }

    // Enhanced Notification Center
    const notificationIcon = document.getElementById('notification-icon');
    const notificationPanel = document.getElementById('notification-center-panel');
    const notificationCount = document.getElementById('notification-count');
    const closeNotifications = document.querySelector('.close-notifications');

    if (notificationIcon && notificationPanel) {
        const unreadNotifications = 3;
        if (notificationCount) {
            notificationCount.textContent = unreadNotifications;
            if (unreadNotifications === 0) {
                notificationCount.style.display = 'none';
            } else {
                notificationCount.classList.add('pulse');
            }
        }

        notificationIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            notificationPanel.classList.toggle('is-visible');
            if (notificationPanel.classList.contains('is-visible')) {
                const notificationList = document.getElementById('notification-list');
                notificationList.innerHTML = `
                    <li class="notification-item">
                        <span class="notification-icon">🎓</span>
                        <div class="notification-content">
                            <strong>New event posted by CS Department</strong>
                            <span class="notification-time">5 minutes ago</span>
                        </div>
                    </li>
                    <li class="notification-item">
                        <span class="notification-icon">🎭</span>
                        <div class="notification-content">
                            <strong>Your club has accepted your request</strong>
                            <span class="notification-time">1 hour ago</span>
                        </div>
                    </li>
                    <li class="notification-item">
                        <span class="notification-icon">👤</span>
                        <div class="notification-content">
                            <strong>Profile 80% completed - Update Now</strong>
                            <span class="notification-time">2 hours ago</span>
                        </div>
                    </li>
                `;
            }
        });

        if (closeNotifications) {
            closeNotifications.addEventListener('click', () => {
                notificationPanel.classList.remove('is-visible');
            });
        }

        // Close notifications when clicking outside
        document.addEventListener('click', (e) => {
            if (!notificationPanel.contains(e.target) && !notificationIcon.contains(e.target)) {
                notificationPanel.classList.remove('is-visible');
            }
        });
    }

    // Add hover effects to action buttons
    const actionButtons = document.querySelectorAll('.action-button');
    actionButtons.forEach(button => {
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'translateY(-2px)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'translateY(0)';
        });
    });

    console.log('Enhanced Student Dashboard script loaded.');
});