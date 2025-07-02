document.addEventListener('DOMContentLoaded', () => {
    const conversationsList = document.getElementById('conversationsList');
    const chatPartnerName = document.getElementById('chatPartnerName');
    const chatMessages = document.getElementById('chatMessages');
    const messageForm = document.getElementById('messageForm');
    const messageInput = document.getElementById('messageInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const logoutButton = document.getElementById('logoutButton');

    let currentConversationId = null;
    let currentUser = JSON.parse(localStorage.getItem('currentUser'));
    let conversations = [];

    if (!currentUser) {
        window.location.href = '/login-student.html';
        return;
    }

    // --- Initialize Socket.IO ---
    const socket = io();

    socket.on('connect', () => {
        console.log('Connected to server via WebSocket.');
        // Register this client with the server using their user ID
        socket.emit('register', currentUser.user_id);
    });

    socket.on('newMessage', (message) => {
        console.log('New message received:', message);
        // If the message belongs to the currently active conversation, render it
        if (message.conversation_id === currentConversationId) {
            renderMessage(message);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        // TODO: Update the conversation list to show the new last message and move to top
    });

    socket.on('messageError', (error) => {
        console.error('Message could not be sent:', error.message);
        alert(`Error: ${error.message}`);
    });

    // --- Functions ---

    const fetchConversations = async () => {
        try {
            const response = await fetch('/api/conversations', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            });
            const data = await response.json();
            if (data.success) {
                conversations = data.conversations;
                renderConversations(conversations);
            } else {
                conversationsList.innerHTML = '<p>Could not load conversations.</p>';
            }
        } catch (error) {
            console.error('Error fetching conversations:', error);
            conversationsList.innerHTML = '<p>Error connecting to server.</p>';
        }
    };

    const renderConversations = (convos) => {
        conversationsList.innerHTML = '';
        if (convos.length === 0) {
            conversationsList.innerHTML = '<div class="loading-placeholder"><p>No conversations yet.</p></div>';
            return;
        }
        convos.forEach(convo => {
            const item = document.createElement('li');
            item.className = 'conversation-item';
            item.dataset.conversationId = convo.conversation_id;
            item.dataset.displayName = convo.display_name;
            
            const displayName = convo.display_name || 'Unknown';
            const initials = displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

            item.innerHTML = `
                <div class="avatar" style="${convo.avatar_url ? `background-image: url('${escapeHTML(convo.avatar_url)}')` : ''}">${!convo.avatar_url ? escapeHTML(initials) : ''}</div>
                <div class="conversation-details">
                    <p class="name">${escapeHTML(displayName)}</p>
                    <p class="last-message">
                        ${convo.last_message_sender ? `<strong>${escapeHTML(convo.last_message_sender)}:</strong> ` : ''}
                        ${escapeHTML(convo.last_message || 'No messages yet.')}
                    </p>
                </div>
            `;
            item.addEventListener('click', () => selectConversation(item));
            conversationsList.appendChild(item);
        });
    };

    const selectConversation = async (convoItem) => {
        // Remove active class from all other items
        document.querySelectorAll('.conversation-item.active').forEach(item => item.classList.remove('active'));
        convoItem.classList.add('active');

        currentConversationId = parseInt(convoItem.dataset.conversationId, 10);
        const receiverId = convoItem.dataset.receiverId;
        const receiverName = convoItem.dataset.receiverName;

        chatPartnerName.textContent = receiverName;
        chatMessages.innerHTML = '<div class="loading-placeholder"><p>Loading messages...</p></div>';
        messageInput.disabled = false;
        sendMessageBtn.disabled = false;

        try {
            const response = await fetch(`/api/conversations/${currentConversationId}/messages`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            });
            const data = await response.json();
            chatMessages.innerHTML = ''; // Clear loading placeholder
            if (data.success && data.messages.length > 0) {
                data.messages.forEach(renderMessage);
            } else if (data.success) {
                chatMessages.innerHTML = '<div class="empty-chat-placeholder"><p>No messages yet. Start the conversation!</p></div>';
            } else {
                chatMessages.innerHTML = `<p>Error: ${data.message}</p>`;
            }
            chatMessages.scrollTop = chatMessages.scrollHeight;
        } catch (error) {
            console.error('Error fetching messages:', error);
            chatMessages.innerHTML = '<p>Could not connect to server.</p>';
        }
    };

    const renderMessage = (message) => {
        // Remove empty chat placeholder if it exists
        const placeholder = chatMessages.querySelector('.empty-chat-placeholder');
        if (placeholder) placeholder.remove();

        const messageBubble = document.createElement('div');
        messageBubble.className = 'message-bubble';
        
        const isSent = message.sender_id === currentUser.id;
        messageBubble.classList.add(isSent ? 'sent' : 'received');
        
        messageBubble.textContent = message.content;
        chatMessages.appendChild(messageBubble);
    };

    // --- Event Listeners ---

    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const content = messageInput.value.trim();
        if (!content || !currentConversationId) return;

        const activeConvoItem = document.querySelector('.conversation-item.active');
        const receiverId = parseInt(activeConvoItem.dataset.receiverId, 10);

        const messageData = {
            conversationId: currentConversationId,
            senderId: currentUser.id,
            receiverId: receiverId,
            content: content
        };

        socket.emit('sendMessage', messageData);
        messageInput.value = '';
    });

    logoutButton.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        window.location.href = '/welcome.html';
    });

    // --- Initial Load ---
    fetchConversations();
});