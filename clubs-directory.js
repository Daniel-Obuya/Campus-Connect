const categories = ["All", "Technology", "Outdoor", "Environment", "Arts", "Academic"];
let selectedCategory = "All";
let clubs = [];
let selectedClub = null;

// DOM elements
const categoryFilter = document.getElementById('categoryFilter');
const clubsGrid = document.getElementById('clubsGrid');
const modalOverlay = document.getElementById('modalOverlay');
const modalContent = document.getElementById('modalContent');
const modalBody = document.getElementById('modalBody');
const modalClose = document.getElementById('modalClose');

// Fetch clubs from backend
async function fetchClubs() {
    clubsGrid.innerHTML = '<div class="loading">Loading clubs...</div>';
    try {
        const response = await fetch('/api/clubs');
        if (!response.ok) throw new Error('Failed to fetch clubs');
        const data = await response.json();
        if (!data.success && !Array.isArray(data.clubs)) throw new Error(data.message || 'No clubs found');
        clubs = data.clubs || data; // Support both { clubs: [...] } and [...]
        renderCategoryFilter();
        renderClubs();
        updateStats();
    } catch (err) {
        clubsGrid.innerHTML = `<div class="error">Error loading clubs: ${err.message}</div>`;
    }
}

// Initialize the application
function init() {
    setupEventListeners();
    fetchClubs();
}

// Render category filter buttons
function renderCategoryFilter() {
    categoryFilter.innerHTML = categories.map(category => `
        <button class="category-btn ${category === selectedCategory ? 'active' : ''}" 
                data-category="${category}">
            ${category}
        </button>
    `).join('');
}

// Render club cards
function renderClubs() {
    if (!clubs || clubs.length === 0) {
        clubsGrid.innerHTML = '<div class="no-clubs">No clubs found.</div>';
        return;
    }
    const filteredClubs = selectedCategory === "All" 
        ? clubs 
        : clubs.filter(club => club.category === selectedCategory);
    clubsGrid.innerHTML = filteredClubs.map(club => `
        <div class="club-card" data-club-id="${club.id}">
            <div class="club-category-badge">${club.category || ''}</div>
            <div class="club-logo">
                <img src="${club.logo_url || 'https://via.placeholder.com/60/deb887/FFFFFF?text=Logo'}" alt="${club.name} Logo">
            </div>
            <div class="club-info">
                <h3 class="club-name">${club.name}</h3>
                <p class="club-description">${club.description || 'No description available.'}</p>
                <div class="club-actions">
                    <button class="club-btn club-btn-primary join-club-btn" data-club-id="${club.id}">Join</button>
                    <button class="club-btn club-btn-secondary view-details-btn" data-club-id="${club.id}">View Details</button>
                    <button class="club-btn club-btn-message message-btn" onclick="alert('Messaging club: ${club.name}')">Message</button>
                </div>
            </div>
        </div>
    `).join('');
}

// Update statistics
function updateStats() {
    if (!clubs || clubs.length === 0) {
        document.getElementById('totalClubs').textContent = '0';
        document.getElementById('totalMembers').textContent = '0';
        return;
    }
    const totalMembers = clubs.reduce((sum, club) => sum + (club.member_count || 0), 0);
    document.getElementById('totalClubs').textContent = clubs.length + '+';
    document.getElementById('totalMembers').textContent = totalMembers + '+';
}

// Setup event listeners
function setupEventListeners() {
    // Category filter buttons
    categoryFilter.addEventListener('click', (e) => {
        if (e.target.classList.contains('category-btn')) {
            selectedCategory = e.target.dataset.category;
            renderCategoryFilter();
            renderClubs();
        }
    });

    // Modal close events
    modalClose.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });

    // Prevent modal content clicks from closing modal
    modalContent.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Escape key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalOverlay.style.display === 'flex') {
            closeModal();
        }
    });
}

// Open modal with club details
function openModal(clubId) {
    selectedClub = clubs.find(club => club.id === clubId);
    if (!selectedClub) return;

    modalBody.innerHTML = `
        <div class="modal-logo">
            <img src="${selectedClub.logo_url || 'images/logo 1.png'}" alt="${selectedClub.name} Logo" style="width:64px;height:64px;object-fit:cover;border-radius:50%;background:#f4f4f4;">
        </div>
        <h3 class="modal-title">${selectedClub.name}</h3>
        <div class="modal-category">${selectedClub.category || ''}</div>
        <p class="modal-description">${selectedClub.description || ''}</p>
        <div class="modal-stats">
            <div class="modal-stat">
                <div class="modal-stat-number">${selectedClub.member_count || 0}</div>
                <div class="modal-stat-label">Members</div>
            </div>
            <div class="modal-stat">
                <div class="modal-stat-day">${selectedClub.meeting_schedule || 'TBA'}</div>
                <div class="modal-stat-label">Meetings</div>
            </div>
        </div>
        <button class="modal-join-btn" onclick="joinClub()">
            🎉 Join ${selectedClub.name}
        </button>
    `;

    modalOverlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// Close modal
function closeModal() {
    modalOverlay.style.display = 'none';
    document.body.style.overflow = 'auto';
    selectedClub = null;
}

// Join club function
function joinClub() {
    if (selectedClub) {
        alert(`Welcome to "${selectedClub.name}"! You've successfully joined the club.`);
        closeModal();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
document.addEventListener('DOMContentLoaded', init);
