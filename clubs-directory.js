// Club data
const clubs = [
    {
        id: 1,
        name: "The Coding Crew",
        category: "Technology",
        description: "A place for aspiring developers to learn, share, and build cool projects together.",
        fullDescription: "Join our vibrant community of developers, designers, and tech enthusiasts! We organize coding workshops, hackathons, and collaborative projects. Whether you're a beginner or an experienced programmer, you'll find your place here.",
        logo: "💻",
        memberCount: 156,
        meetingDay: "Wednesdays"
    },
    {
        id: 2,
        name: "Adventure Seekers",
        category: "Outdoor",
        description: "Join us for outdoor activities, trips, and making new friends in nature.",
        fullDescription: "Experience the great outdoors with fellow adventure enthusiasts! We organize hiking trips, camping expeditions, rock climbing sessions, and nature photography walks. Connect with nature and make lifelong friendships.",
        logo: "🏔️",
        memberCount: 89,
        meetingDay: "Saturdays"
    },
    {
        id: 3,
        name: "Green Earth Society",
        category: "Environment",
        description: "Passionate about sustainability and protecting our planet's future.",
        fullDescription: "Make a difference in environmental conservation! We focus on campus sustainability projects, organize clean-up drives, promote eco-friendly practices, and raise awareness about climate change through educational events.",
        logo: "🌱",
        memberCount: 203,
        meetingDay: "Fridays"
    },
    {
        id: 4,
        name: "Drama Club",
        category: "Arts",
        description: "Explore your acting and stage skills through performances and improv nights.",
        fullDescription: "Step into the spotlight and unleash your creativity! Our drama club produces original plays, hosts improv nights, conducts acting workshops, and provides a platform for theatrical expression and artistic growth.",
        logo: "🎭",
        memberCount: 78,
        meetingDay: "Thursdays"
    },
    {
        id: 5,
        name: "Photography Society",
        category: "Arts",
        description: "Capture moments and express creativity through the lens of photography.",
        fullDescription: "Develop your photography skills with fellow enthusiasts! We organize photo walks, portrait sessions, landscape photography trips, and workshops on editing techniques. Share your vision and learn from others.",
        logo: "📸",
        memberCount: 124,
        meetingDay: "Sundays"
    },
    {
        id: 6,
        name: "Debate Forum",
        category: "Academic",
        description: "Sharpen your public speaking and critical thinking skills through debates.",
        fullDescription: "Enhance your oratory skills and engage in intellectual discussions! We host weekly debates, public speaking workshops, and inter-college competitions. Build confidence and learn to articulate your thoughts effectively.",
        logo: "🗣️",
        memberCount: 67,
        meetingDay: "Tuesdays"
    }
];

const categories = ["All", "Technology", "Outdoor", "Environment", "Arts", "Academic"];
let selectedCategory = "All";
let selectedClub = null;

// DOM elements
const categoryFilter = document.getElementById('categoryFilter');
const clubsGrid = document.getElementById('clubsGrid');
const modalOverlay = document.getElementById('modalOverlay');
const modalContent = document.getElementById('modalContent');
const modalBody = document.getElementById('modalBody');
const modalClose = document.getElementById('modalClose');

// Initialize the application
function init() {
    renderCategoryFilter();
    renderClubs();
    setupEventListeners();
    updateStats();
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
    const filteredClubs = selectedCategory === "All" 
        ? clubs 
        : clubs.filter(club => club.category === selectedCategory);

    clubsGrid.innerHTML = filteredClubs.map(club => `
        <div class="club-card" data-club-id="${club.id}">
            <div class="club-category-badge">${club.category}</div>
            <div class="club-logo">${club.logo}</div>
            <h3 class="club-name">${club.name}</h3>
            <p class="club-description">${club.description}</p>
            <div class="club-stats">
                <div class="club-stat">
                    <div class="club-stat-number">${club.memberCount}</div>
                    <div class="club-stat-label">Members</div>
                </div>
                <div class="club-stat">
                    <div class="club-meeting-day">${club.meetingDay}</div>
                    <div class="club-stat-label">Meetings</div>
                </div>
            </div>
            <div class="club-actions">
                <button class="club-btn club-btn-primary" onclick="openModal(${club.id})">
                    Learn More
                </button>
                <button class="club-btn club-btn-secondary" onclick="openModal(${club.id})">
                    Quick Join
                </button>
            </div>
        </div>
    `).join('');
}

// Update statistics
function updateStats() {
    const totalMembers = clubs.reduce((sum, club) => sum + club.memberCount, 0);
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
        <div class="modal-logo">${selectedClub.logo}</div>
        <h3 class="modal-title">${selectedClub.name}</h3>
        <div class="modal-category">${selectedClub.category}</div>
        <p class="modal-description">${selectedClub.fullDescription}</p>
        <div class="modal-stats">
            <div class="modal-stat">
                <div class="modal-stat-number">${selectedClub.memberCount}</div>
                <div class="modal-stat-label">Members</div>
            </div>
            <div class="modal-stat">
                <div class="modal-stat-day">${selectedClub.meetingDay}</div>
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
