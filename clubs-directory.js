// Clubs data will be loaded from backend
let clubs = [];

const categories = ["All", "Social"];
let selectedCategory = "All";
let selectedClub = null;

// DOM elements
const categoryFilter = document.getElementById('categoryFilter');
const clubsGrid = document.getElementById('clubsGrid');
const modalOverlay = document.getElementById('modalOverlay');
const modalContent = document.getElementById('modalContent');
const modalBody = document.getElementById('modalBody');
const modalClose = document.getElementById('modalClose');

// Render club cards
function renderClubs() {
    const filteredClubs = selectedCategory === "All" 
        ? clubs 
        : clubs.filter(club => club.category && club.category.toLowerCase() === selectedCategory.toLowerCase());

    if (!filteredClubs.length) {
        clubsGrid.innerHTML = '<div class="error">No clubs found for this category.</div>';
        return;
    }

    clubsGrid.innerHTML = filteredClubs.map(club => {
        // Use logo_url or fallback to default image
        const logoUrl = club.logo_url && club.logo_url.trim() !== '' ? club.logo_url : 'images/default-club.jpeg';
        return `
        <div class="club-card" data-club-id="${club.id}">
            <div class="club-header">
                <img class="club-logo" src="${logoUrl}" alt="${club.name} logo" onerror="this.onerror=null;this.src='images/default-club.jpeg';">
                <div class="club-title-section">
                    <div class="club-name">${club.name}</div>
                    <div class="club-category">${club.category}</div>
                </div>
            </div>
            <div class="club-body">
                <div class="club-description">${club.description}</div>
            </div>
            <div class="club-stats">
                <div class="stat">
                    <div class="stat-value">${club.memberCount}</div>
                    <div class="stat-label">Members</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${club.meetingDay}</div>
                    <div class="stat-label">Meetings</div>
                </div>
            </div>
            <div class="club-footer">
                <button class="club-btn club-btn-primary" data-learnmore-id="${club.id}">Learn More</button>
                <button class="club-btn club-btn-secondary" data-quickjoin-id="${club.id}">Quick Join</button>
            </div>
        </div>
        `;
    }).join('');

    // Attach event listeners for Learn More and Quick Join
    clubsGrid.querySelectorAll('[data-learnmore-id]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(btn.getAttribute('data-learnmore-id'));
            openModal(id);
        });
    });
    clubsGrid.querySelectorAll('[data-quickjoin-id]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(btn.getAttribute('data-quickjoin-id'));
            openModal(id);
        });
    });
}

// Update statistics
function updateStats() {
    const totalMembers = clubs.reduce((sum, club) => sum + (club.memberCount || 0), 0);
    const totalClubsElem = document.getElementById('totalClubs');
    const totalMembersElem = document.getElementById('totalMembers');
    if (totalClubsElem) totalClubsElem.textContent = clubs.length + '+';
    if (totalMembersElem) totalMembersElem.textContent = totalMembers + '+';
}

// Setup event listeners
function setupEventListeners() {
    // Category filter dropdown
    categoryFilter.addEventListener('change', (e) => {
        selectedCategory = categoryFilter.value.charAt(0).toUpperCase() + categoryFilter.value.slice(1).toLowerCase();
        renderClubs();
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
    const logoUrl = selectedClub.logo_url && selectedClub.logo_url.trim() !== '' ? selectedClub.logo_url : 'images/default-club.jpeg';
    modalBody.innerHTML = `
        <div class="modal-logo">
            <img class="club-logo" src="${logoUrl}" alt="${selectedClub.name} logo" onerror="this.onerror=null;this.src='images/default-club.jpeg';">
        </div>
        <div class="modal-title">${selectedClub.name}</div>
        <div class="modal-category">${selectedClub.category}</div>
        <div class="modal-description">${selectedClub.fullDescription}</div>
        <div class="modal-stats">
            <div class="modal-stat">
                <div class="modal-stat-number">${selectedClub.memberCount}</div>
                <div class="modal-stat-label">Members</div>
            </div>
            <div class="modal-stat">
                <div class="modal-stat-number">${selectedClub.meetingDay}</div>
                <div class="modal-stat-label">Meetings</div>
            </div>
        </div>
        <button class="modal-join-btn" id="modalJoinBtn" onclick="window.joinClub()">
            🎉 Join ${selectedClub.name}
        </button>
    `;
    modalOverlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}
window.openModal = openModal; // Make openModal globally accessible

// Close modal
function closeModal() {
    modalOverlay.style.display = 'none';
    document.body.style.overflow = 'auto';
    selectedClub = null;
}

// Join club function
async function joinClub() {
    if (!selectedClub) return;
    const joinBtn = document.getElementById('modalJoinBtn');
    if (joinBtn) {
        joinBtn.disabled = true;
        joinBtn.textContent = 'Joining...';
    }
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            alert('You must be logged in as a student to join a club.');
            if (joinBtn) { joinBtn.disabled = false; joinBtn.textContent = `🎉 Join ${selectedClub.name}`; }
            return;
        }
        const res = await fetch('/api/club/join-request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ clubId: selectedClub.id })
        });
        const data = await res.json();
        if (data.success) {
            selectedClub.memberCount += 1;
            renderClubs();
            if (joinBtn) {
                joinBtn.textContent = 'Request Sent! Pending Approval';
                joinBtn.style.background = 'linear-gradient(90deg,#b2ffb2 0%,#a5d6a7 100%)';
                joinBtn.style.color = '#2e7d32';
                joinBtn.disabled = true;
            }
            setTimeout(closeModal, 1600);
        } else {
            alert(data.message || 'Could not join club.');
            if (joinBtn) { joinBtn.disabled = false; joinBtn.textContent = `🎉 Join ${selectedClub.name}`; }
        }
    } catch (err) {
        alert('Error joining club.');
        console.error(err);
        if (joinBtn) { joinBtn.disabled = false; joinBtn.textContent = `🎉 Join ${selectedClub.name}`; }
    }
}
window.joinClub = joinClub; // Make joinClub globally accessible

// Fetch clubs from backend and render
async function fetchAndRenderClubs() {
    clubsGrid.innerHTML = '<div class="info-state">Loading clubs...</div>';
    try {
        const res = await fetch('/api/club');
        if (!res.ok) throw new Error('Failed to fetch clubs');
        const data = await res.json();
        // Expecting data.clubs to be an array of clubs from DB
        clubs = data.clubs.map(club => ({
            id: club.club_id,
            name: club.name,
            category: club.category,
            description: club.description || '',
            fullDescription: club.description || '',
            logo_url: club.logo_url || '',
            memberCount: club.member_count || 0,
            meetingDay: club.meeting_schedule || ''
        }));
        renderClubs();
        updateStats();
    } catch (err) {
        console.error('Error loading clubs directory:', err);
        clubsGrid.innerHTML = '<div class="error">Could not load clubs directory.</div>';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    fetchAndRenderClubs();
    setupEventListeners();
});
