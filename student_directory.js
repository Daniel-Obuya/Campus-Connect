// student_directory.js
// Handles fetching and rendering students, and messaging button logic

// Dummy data for students
const students = [
  {
    id: 1,
    name: 'Alice Kimani',
    graduationYear: 2025,
    email: 'alice.kimani@example.com',
    isFollowed: false,
    major: 'Computer Science'
  },
  {
    id: 2,
    name: 'Brian Otieno',
    graduationYear: 2024,
    email: 'brian.otieno@example.com',
    isFollowed: true,
    major: 'Electrical Engineering'
  },
  {
    id: 3,
    name: 'Cynthia Mwangi',
    graduationYear: 2026,
    email: 'cynthia.mwangi@example.com',
    isFollowed: false,
    major: 'Mechanical Engineering'
  },
  {
    id: 4,
    name: 'David Njoroge',
    graduationYear: 2025,
    email: 'david.njoroge@example.com',
    isFollowed: true,
    major: 'Civil Engineering'
  }
];

function renderStudentDirectory(students) {
    const container = document.getElementById('student-directory-container');
    container.innerHTML = '';
    students.forEach(student => {
        const card = document.createElement('div');
        card.className = 'student-card';
        card.innerHTML = `
            <div class="student-name">${student.name}</div>
            <div class="student-meta">Major: ${student.major || 'N/A'}</div>
            <div class="student-meta">Graduation Year: ${student.graduationYear}</div>
            <div class="student-email">${student.email}</div>
            <div class="student-actions">
                <button class="follow-btn">${student.isFollowed ? 'Unfollow' : 'Follow'}</button>
                <button class="message-btn" ${student.isFollowed ? '' : 'disabled'}>Message</button>
            </div>
        `;
        const followBtn = card.querySelector('.follow-btn');
        const messageBtn = card.querySelector('.message-btn');
        followBtn.addEventListener('click', () => {
            student.isFollowed = !student.isFollowed;
            renderStudentDirectory(students);
        });
        messageBtn.addEventListener('click', () => {
            if (student.isFollowed) {
                alert(`Messaging ${student.name}`);
            }
        });
        container.appendChild(card);
    });
}

document.addEventListener('DOMContentLoaded', () => {
  renderStudentDirectory(students);
});
