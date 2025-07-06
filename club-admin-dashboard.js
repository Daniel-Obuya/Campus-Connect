document.addEventListener('DOMContentLoaded', () => {
    const authToken = localStorage.getItem('authToken');
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));

    // Only handle authentication and logout here. All dashboard population is handled in the HTML's <script>.
    if (!authToken) {
        window.location.href = '/login-admin';
        return;
    }

    // Logout functionality
    const logoutBtn = document.getElementById('logoutButton');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            window.location.href = '/welcome';
        });
    }
});