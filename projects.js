// Sample projects data
const projectsData = [
    {
        id: 1,
        title: "EcoTracker Mobile App",
        description: "A mobile application that helps users track their carbon footprint and provides personalized sustainability recommendations. Features include activity logging, impact visualization, and community challenges.",
        owner: "Sarah Chen",
        department: "Environmental Science",
        category: "academic",
        status: "seeking-collaborators",
        technologies: ["React Native", "Node.js", "MongoDB", "Chart.js"],
        skills: ["Mobile Development", "UI/UX Design", "Data Visualization"],
        collaborators: 3,
        likes: 24,
        views: 156,
        icon: "🌱"
    },
    {
        id: 2,
        title: "AI-Powered Study Assistant",
        description: "An intelligent tutoring system that uses machine learning to personalize study plans and provide adaptive learning experiences for students across various subjects.",
        owner: "Alex Rodriguez",
        department: "Computer Science",
        category: "startup",
        status: "in-progress",
        technologies: ["Python", "TensorFlow", "React", "PostgreSQL"],
        skills: ["Machine Learning", "Web Development", "Data Science"],
        collaborators: 5,
        likes: 42,
        views: 289,
        icon: "🤖"
    },
    {
        id: 3,
        title: "Campus Food Waste Reduction",
        description: "Research project analyzing food waste patterns in university dining halls and developing strategies to reduce waste through predictive analytics and student behavior modification.",
        owner: "Dr. Maria Garcia",
        department: "Sustainability Studies",
        category: "research",
        status: "in-progress",
        technologies: ["R", "Python", "Tableau", "IoT Sensors"],
        skills: ["Data Analysis", "Research Methods", "Statistical Modeling"],
        collaborators: 8,
        likes: 18,
        views: 134,
        icon: "🥗"
    },
    {
        id: 4,
        title: "VR Campus Tour Platform",
        description: "Virtual reality application providing immersive campus tours for prospective students, including interactive building exploration and virtual information sessions.",
        owner: "Jake Thompson",
        department: "Digital Media",
        category: "competition",
        status: "completed",
        technologies: ["Unity", "C#", "Oculus SDK", "Blender"],
        skills: ["VR Development", "3D Modeling", "Game Design"],
        collaborators: 4,
        likes: 67,
        views: 445,
        icon: "🥽"
    },
    {
        id: 5,
        title: "Open Source LMS",
        description: "Community-driven learning management system designed specifically for small educational institutions, featuring modern UI, collaborative tools, and extensive customization options.",
        owner: "Emma Wilson",
        department: "Information Systems",
        category: "open-source",
        status: "seeking-collaborators",
        technologies: ["Vue.js", "Laravel", "MySQL", "Docker"],
        skills: ["Full-Stack Development", "System Design", "Open Source"],
        collaborators: 12,
        likes: 89,
        views: 567,
        icon: "📚"
    },
    {
        id: 6,
        title: "Blockchain Voting System",
        description: "Secure and transparent voting platform using blockchain technology for student government elections, ensuring privacy, immutability, and verifiable results.",
        owner: "David Kim",
        department: "Cybersecurity",
        category: "academic",
        status: "planning",
        technologies: ["Solidity", "Ethereum", "Web3.js", "React"],
        skills: ["Blockchain Development", "Smart Contracts", "Security"],
        collaborators: 2,
        likes: 31,
        views: 198,
        icon: "🗳️"
    },
    {
        id: 7,
        title: "Mental Health Support Bot",
        description: "AI-powered chatbot providing 24/7 mental health support and resources for students, featuring mood tracking, crisis intervention, and professional resource connections.",
        owner: "Lisa Park",
        department: "Psychology",
        category: "startup",
        status: "in-progress",
        technologies: ["Python", "Natural Language Processing", "Flask", "PostgreSQL"],
        skills: ["AI/ML", "Psychology", "Healthcare Tech"],
        collaborators: 6,
        likes: 55,
        views: 334,
        icon: "💚"
    },
    {
        id: 8,
        title: "Smart Campus Energy Monitor",
        description: "IoT-based system for monitoring and optimizing energy consumption across campus buildings, providing real-time analytics and automated efficiency recommendations.",
        owner: "Prof. Robert Chen",
        department: "Engineering",
        category: "research",
        status: "seeking-collaborators",
        technologies: ["Arduino", "Python", "InfluxDB", "Grafana"],
        skills: ["IoT Development", "Data Engineering", "Energy Systems"],
        collaborators: 3,
        likes: 28,
        views: 167,
        icon: "⚡"
    }
];

let filteredProjects = [...projectsData];
let currentFilter = 'all';
let currentStatus = 'all';

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    renderProjects();
    setupEventListeners();
});

// Render projects grid
function renderProjects() {
    const projectsGrid = document.getElementById('projectsGrid');
    projectsGrid.innerHTML = '';

    filteredProjects.forEach(project => {
        const projectCard = createProjectCard(project);
        projectsGrid.appendChild(projectCard);
    });
}

// Create individual project card
function createProjectCard(project) {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.onclick = () => openProjectModal(project);

    const statusClass = `status-${project.status.replace(' ', '-')}`;
    const statusText = project.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());

    card.innerHTML = `
        <div class="project-category-badge">${project.category.replace('-', ' ').toUpperCase()}</div>
        <div class="project-status-badge ${statusClass}">${statusText}</div>
        <div class="project-icon">${project.icon}</div>
        <h3 class="project-title">${project.title}</h3>
        <div class="project-owner">by ${project.owner} • ${project.department}</div>
        <p class="project-description">${project.description}</p>
        <div class="project-technologies">
            ${project.technologies.map(tech => `<span class="tech-tag">${tech}</span>`).join('')}
        </div>
        <div class="project-stats">
            <div class="project-stat">
                <div class="project-stat-number">${project.collaborators}</div>
                <div class="project-stat-label">Contributors</div>
            </div>
            <div class="project-stat">
                <div class="project-stat-number">${project.likes}</div>
                <div class="project-stat-label">Likes</div>
            </div>
            <div class="project-stat">
                <div class="project-stat-number">${project.views}</div>
                <div class="project-stat-label">Views</div>
            </div>
        </div>
        <div class="project-actions">
            <button class="project-btn project-btn-primary" onclick="event.stopPropagation(); joinProject(${project.id})">
                ${project.status === 'seeking-collaborators' ? 'Join Project' : 'View Details'}
            </button>
            <button class="project-btn project-btn-secondary" onclick="event.stopPropagation(); likeProject(${project.id})">❤️ Like</button>
        </div>
    `;

    return card;
}

// Filter projects by category
function filterByCategory(category) {
    currentFilter = category;
    applyFilters();
    
    // Update active button
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-category="${category}"]`).classList.add('active');
}

// Filter projects by status
function filterByStatus() {
    const statusFilter = document.getElementById('statusFilter');
    currentStatus = statusFilter.value;
    applyFilters();
}

// Apply all filters
function applyFilters() {
    filteredProjects = projectsData.filter(project => {
        const categoryMatch = currentFilter === 'all' || project.category === currentFilter;
        const statusMatch = currentStatus === 'all' || project.status === currentStatus;
        return categoryMatch && statusMatch;
    });
    renderProjects();
}

// Search projects
function searchProjects() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput.value.toLowerCase();
    
    if (searchTerm === '') {
        applyFilters();
        return;
    }

    filteredProjects = projectsData.filter(project => {
        const categoryMatch = currentFilter === 'all' || project.category === currentFilter;
        const statusMatch = currentStatus === 'all' || project.status === currentStatus;
        
        if (!categoryMatch || !statusMatch) return false;

        return (
            project.title.toLowerCase().includes(searchTerm) ||
            project.description.toLowerCase().includes(searchTerm) ||
            project.technologies.some(tech => tech.toLowerCase().includes(searchTerm)) ||
            project.skills.some(skill => skill.toLowerCase().includes(searchTerm)) ||
            project.owner.toLowerCase().includes(searchTerm) ||
            project.department.toLowerCase().includes(searchTerm)
        );
    });
    
    renderProjects();
}

// Setup event listeners
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchProjects();
        }
    });

    // Close modal when clicking outside
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal-overlay')) {
            closeModal();
            closeCreateProjectModal();
        }
    });
}

// Open project detail modal
function openProjectModal(project) {
    const modal = document.getElementById('projectModal');
    const modalContent = document.getElementById('modalContent');
    
    const statusClass = `status-${project.status.replace(' ', '-')}`;
    const statusText = project.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());

    modalContent.innerHTML = `
        <div style="font-size: 60px; margin-bottom: 20px;">${project.icon}</div>
        <div class="modal-title">${project.title}</div>
        <div style="display: inline-block; background: linear-gradient(135deg, #ffc107, #ff9800); color: #333; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; margin-bottom: 10px;">
            ${project.category.replace('-', ' ').toUpperCase()}
        </div>
        <div style="display: inline-block; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; margin-bottom: 20px;" class="${statusClass}">
            ${statusText}
        </div>
        <div style="color: #555; line-height: 1.7; margin-bottom: 20px; font-size: 16px; text-align: left;">
            ${project.description}
        </div>
        <div style="margin-bottom: 20px;">
            <strong>Project Owner:</strong> ${project.owner} (${project.department})
        </div>
        <div style="margin-bottom: 20px;">
            <strong>Technologies:</strong><br>
            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; justify-content: center;">
                ${project.technologies.map(tech => `<span class="tech-tag">${tech}</span>`).join('')}
            </div>
        </div>
        <div style="margin-bottom: 30px;">
            <strong>Skills Required:</strong><br>
            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; justify-content: center;">
                ${project.skills.map(skill => `<span class="tech-tag">${skill}</span>`).join('')}
            </div>
        </div>
        <div style="display: flex; justify-content: space-around; margin-bottom: 30px; padding: 20px; background: rgba(255,255,255,0.3); border-radius: 15px;">
            <div style="text-align: center;">
                <div style="font-size: 24px; font-weight: bold; color: #cd853f;">${project.collaborators}</div>
                <div style="font-size: 14px; color: #777;">Contributors</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 24px; font-weight: bold; color: #cd853f;">${project.likes}</div>
                <div style="font-size: 14px; color: #777;">Likes</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 24px; font-weight: bold; color: #cd853f;">${project.views}</div>
                <div style="font-size: 14px; color: #777;">Views</div>
            </div>
        </div>
        <button class="modal-join-btn" onclick="joinProject(${project.id})">
            ${project.status === 'seeking-collaborators' ? '🤝 Join Project' : '👁️ Follow Project'}
        </button>
    `;
    
    modal.style.display = 'flex';
}

// Close project modal
function closeModal() {
    document.getElementById('projectModal').style.display = 'none';
}

// Open create project modal
function openCreateProjectModal() {
    document.getElementById('createProjectModal').style.display = 'flex';
}

// Close create project modal
function closeCreateProjectModal() {
    document.getElementById('createProjectModal').style.display = 'none';
}

// Handle create project form submission
document.getElementById('createProjectForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const newProject = {
        id: projectsData.length + 1,
        title: document.getElementById('projectTitle').value,
        description: document.getElementById('projectDescription').value,
        owner: "You", // In a real app, this would be the current user
        department: "Your Department",
        category: document.getElementById('projectCategory').value,
        status: document.getElementById('projectStatus').value,
        technologies: document.getElementById('projectTechnologies').value.split(',').map(t => t.trim()),
        skills: document.getElementById('projectSkills').value.split(',').map(s => s.trim()),
        collaborators: 1,
        likes: 0,
        views: 0,
        icon: "🚀" // Default icon, in a real app this could be customizable
    };
    
    projectsData.unshift(newProject);
    applyFilters();
    closeCreateProjectModal();
    e.target.reset();
    
    alert('Project created successfully! 🎉');
});

// Join project function
function joinProject(projectId) {
    const project = projectsData.find(p => p.id === projectId);
    if (project) {
        if (project.status === 'seeking-collaborators') {
            project.collaborators++;
            alert(`Successfully joined "${project.title}"! 🎉\n\nYou'll receive project updates and collaboration invitations.`);
        } else {
            alert(`You're now following "${project.title}"! 👁️\n\nYou'll receive updates about this project.`);
        }
        renderProjects();
    }
}

// Like project function
function likeProject(projectId) {
    const project = projectsData.find(p => p.id === projectId);
    if (project) {
        project.likes++;
        renderProjects();
        
        // Show brief feedback
        const button = event.target;
        const originalText = button.innerHTML;
        button.innerHTML = '❤️ Liked!';
        button.style.background = 'linear-gradient(135deg, #28a745, #1e7e34)';
        
        setTimeout(() => {
            button.innerHTML = originalText;
            button.style.background = '';
        }, 1000);
    }
}