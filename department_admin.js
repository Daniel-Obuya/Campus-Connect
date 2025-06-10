document.addEventListener('DOMContentLoaded', () => {
    // --- Announcement Form ---
    const announcementForm = document.getElementById('announcementForm');
    const announcementsList = document.getElementById('announcementsList');

    if (announcementForm) {
        announcementForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const title = this.announcementTitle.value;
            const content = this.announcementContent.value;

            if (title && content) {
                addListItem(announcementsList, `<h4>${escapeHTML(title)}</h4><p>${escapeHTML(content)}</p><small>Posted: ${new Date().toLocaleString()}</small>`);
                this.reset();
                // TODO: Add AJAX call to send data to the server
                console.log('Announcement posted:', { title, content });
            }
        });
    }

    // --- Research Opportunity Form ---
    const researchForm = document.getElementById('researchForm');
    const researchList = document.getElementById('researchList');

    if (researchForm) {
        researchForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const title = this.researchTitle.value;
            const description = this.researchDescription.value;
            const faculty = this.researchFaculty.value;
            const contact = this.researchContact.value;

            if (title && description) {
                addListItem(researchList, `<h4>${escapeHTML(title)}</h4><p><strong>Description:</strong> ${escapeHTML(description)}</p><p><strong>Faculty/PI:</strong> ${escapeHTML(faculty)}</p><p><strong>Contact:</strong> ${escapeHTML(contact)}</p><small>Listed: ${new Date().toLocaleString()}</small>`);
                this.reset();
                // TODO: Add AJAX call to send data to the server
                console.log('Research opportunity listed:', { title, description, faculty, contact });
            }
        });
    }

    // --- Course Update Form ---
    const courseUpdateForm = document.getElementById('courseUpdateForm');
    const courseUpdatesList = document.getElementById('courseUpdatesList');

    if (courseUpdateForm) {
        courseUpdateForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const courseName = this.courseName.value;
            const message = this.courseUpdateMessage.value;

            if (courseName && message) {
                addListItem(courseUpdatesList, `<h4>Update for ${escapeHTML(courseName)}</h4><p>${escapeHTML(message)}</p><small>Posted: ${new Date().toLocaleString()}</small>`);
                this.reset();
                // TODO: Add AJAX call to send data to the server
                console.log('Course update posted:', { courseName, message });
            }
        });
    }

    // --- Event Management Form ---
    const eventForm = document.getElementById('eventForm');
    const eventsList = document.getElementById('eventsList');

    if (eventForm) {
        eventForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const title = this.eventTitle.value;
            const date = this.eventDate.value;
            const time = this.eventTime.value;
            const location = this.eventLocation.value;
            const description = this.eventDescription.value;

            if (title && date && location) {
                addListItem(eventsList, `<h4>${escapeHTML(title)}</h4><p><strong>Date:</strong> ${escapeHTML(date)} at ${escapeHTML(time)}</p><p><strong>Location:</strong> ${escapeHTML(location)}</p><p><strong>Description:</strong> ${escapeHTML(description)}</p><small>Created: ${new Date().toLocaleString()}</small>`);
                this.reset();
                // TODO: Add AJAX call to send data to the server
                console.log('Event created:', { title, date, time, location, description });
            }
        });
    }

    // Helper function to add items to a list
    function addListItem(listElement, content) {
        const listItem = document.createElement('li');
        listItem.innerHTML = content;
        listElement.prepend(listItem); // Add to the top of the list
    }

    // Helper function to escape HTML to prevent XSS
    function escapeHTML(str) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
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
});