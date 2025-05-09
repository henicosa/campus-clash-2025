// Initialize socket connection
const socket = io();

// Global variables
let hasVoted = false;

// Question handling functions
function updateQuestion(data) {
    if (data.status === 'waiting') {
        $('#waiting-screen').show();
        $('#question-screen').hide();
        hasVoted = false;
        // Reset vote distributions when waiting
        resetVoteDistributions();
    } else {
        $('#waiting-screen').hide();
        $('#question-screen').show();
        $('#question-text').text(data.question);
        
        const answers = $('#answers');
        answers.empty();
        data.answers.forEach((answer, index) => {
            answers.append(`
                <button class="answer-button" data-index="${index}">
                    <div class="vote-gradient" style="width: 0%"></div>
                    <div class="answer-content">
                        ${answer.text}
                        <div class="vote-count"></div>
                    </div>
                </button>
            `);
        });
        // Reset vote distributions for new question
        resetVoteDistributions();
    }
}

function resetVoteDistributions() {
    $('.answer-button').each(function() {
        $(this).find('.vote-gradient').css('width', '0%');
        $(this).find('.vote-count').text('');
        $(this).removeClass('selected');
        $(this).prop('disabled', false);
    });
    hasVoted = false;
}

function updateVoteDistribution(data) {
    if (data.status === 'success') {
        Object.entries(data.distribution).forEach(([index, percentage]) => {
            const voteCount = Math.round((percentage / 100) * data.total_votes);
            const button = $(`.answer-button[data-index="${index}"]`);
            button.find('.vote-count')
                .text(`${voteCount} votes (${percentage.toFixed(1)}%)`);
            button.find('.vote-gradient')
                .css('width', `${percentage}%`);
        });
    }
}

function showVotedConfirmation() {
    const confirmation = $('#voted-confirmation');
    confirmation.css('display', 'block');
    confirmation.css('opacity', '1');
    setTimeout(() => {
        confirmation.css('display', 'none');
    }, 3000);
}

// Emoji handling functions
function createFloatingEmoji(emoji, sourceButton) {
    const rect = sourceButton.getBoundingClientRect();
    const emojiElement = document.createElement('div');
    emojiElement.className = 'floating-emoji';
    emojiElement.textContent = emoji;
    
    // Position at button center
    emojiElement.style.left = `${rect.left + rect.width / 2}px`;
    emojiElement.style.top = `${rect.top + rect.height / 2}px`;
    
    document.body.appendChild(emojiElement);
    
    // Remove element after animation
    setTimeout(() => {
        emojiElement.remove();
    }, 1500);
}

function handleEmojiClick(emoji) {
    const button = document.querySelector(`.emoji-button[data-emoji="${emoji}"]`);
    if (button.classList.contains('cooldown')) return;

    // Add cooldown class
    button.classList.add('cooldown');
    
    // Send emoji
    socket.emit('emote', { emoji: emoji });
    
    // Create floating emoji animation
    createFloatingEmoji(emoji, button);
    
    // Remove cooldown class after animation
    setTimeout(() => {
        button.classList.remove('cooldown');
    }, 1500);
}

// Event handlers
$(document).ready(function() {
    // Request initial question
    socket.emit('get_question');
    
    // Listen for question updates
    socket.on('question_update', updateQuestion);
    
    // Listen for vote distribution updates
    socket.on('vote_distribution', updateVoteDistribution);

    // Handle vote submission
    $(document).on('click', '.answer-button', function() {
        if (hasVoted) return;
        
        const button = $(this);
        const index = button.data('index');
        
        // Disable all buttons
        $('.answer-button').prop('disabled', true);
        
        // Highlight selected answer
        button.addClass('selected');
        
        // Send vote through WebSocket
        socket.emit('submit_vote', { answer_index: index }, function(response) {
            if (response.status === 'success') {
                hasVoted = true;
                showVotedConfirmation();
            } else {
                // Re-enable buttons if vote failed
                $('.answer-button').prop('disabled', false);
                button.removeClass('selected');
                alert('Failed to submit vote. Please try again.');
            }
        });
    });

    // Handle emoji button clicks
    document.querySelectorAll('.emoji-button').forEach(button => {
        button.addEventListener('click', () => {
            const emoji = button.dataset.emoji;
            handleEmojiClick(emoji);
        });
    });
});

// Listen for emoji broadcasts from server
socket.on('emote_broadcast', (data) => {
    // Find the emoji button that matches the emoji
    const button = document.querySelector(`.emoji-button[data-emoji="${data.emoji}"]`);
    if (button) {
        createFloatingEmoji(data.emoji, button);
    }
}); 