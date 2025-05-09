// Initialize sound effects
const sounds = {
    click: new Audio('/static/sounds/click.wav'),
    correct: new Audio('/static/sounds/correct.wav'),
    wrong: new Audio('/static/sounds/wrong.wav'),
    countdown: new Audio('/static/sounds/countdown.wav')
};

// Initialize socket connection
const socket = io();

// Global variables for animation tracking
let currentTypingTimeout = null;
let currentAnswerTypingTimeout = null;

// Function to play sounds
function playSound(soundName) {
    if (sounds[soundName]) {
        sounds[soundName].currentTime = 0;
        sounds[soundName].play().catch(e => {
            console.log('Error playing sound:', e);
            console.log('Attempted to play:', soundName);
            console.log('Sound file path:', sounds[soundName].src);
        });
    } else {
        console.log('Sound not found:', soundName);
    }
}

$(function(){
    $.ajax({
        'async': false,
        'global': false,
        type:'GET',
        dataType:'json',
        url:'/api/board',
        success:function(data){
            map = data;
            console.log("Loaded board data:", map);
            loadBoard();
            // Get initial board state
            updateBoardState();
        },
        error: function(xhr, status, error) {
            console.error('Error loading board data:', error);
            alert('Error loading game board. Please refresh the page.');
        }
    });

    // Add logo click handler
    $('.img-responsive').click(function() {
        if (confirm('Are you sure you want to reset the game?')) {
            // Add reset animation
            const logo = $(this);
            logo.addClass('logo-reset');
            
            // Remove animation class after it completes
            setTimeout(() => {
                logo.removeClass('logo-reset');
            }, 500);

            $.ajax({
                url: '/api/reset',
                type: 'POST',
                success: function(response) {
                    console.log('Game reset successfully');
                    // Force page refresh after a short delay to show the animation
                    setTimeout(() => {
                        window.location.reload();
                    }, 600);
                },
                error: function(xhr, status, error) {
                    console.error('Error resetting game:', error);
                    alert('Error resetting game. Please try again.');
                }
            });
        }
    });

    $('.unanswered').click(function(){
        // Clear any existing animations
        if (currentTypingTimeout) {
            clearTimeout(currentTypingTimeout);
            currentTypingTimeout = null;
        }
        if (currentAnswerTypingTimeout) {
            clearTimeout(currentAnswerTypingTimeout);
            currentAnswerTypingTimeout = null;
        }

        playSound('click');
        var category = $(this).parent().data('category');
        var question = $(this).data('question');
        console.log("Category:", category, "Question:", question);
        console.log("Question data:", map[category].questions[question]);
        var value = map[category].questions[question].value;
        var answers = $('#answers');
        resizeClass = " more-text"
        $('.modal-title').empty().text(map[category].name);
        
        // Get question types
        const types = map[category].questions[question].types || [];
        console.log("Types from question:", types);
        const questionText = map[category].questions[question].question;
        
        // Clear answers container before any question type
        answers.empty();
        
        if (types.includes('ai')) {
            // Create AI question element
            const questionElement = $('<p>')
                .attr('id', 'question')
                .addClass('ai-question');
            
            // Clear and add the question element
            $('#question').replaceWith(questionElement);
            
            // Add cursor element
            const cursor = $('<span>').addClass('cursor');
            questionElement.append(cursor);
            
            // Start typing animation
            let currentText = '';
            const text = questionText;
            const typingSpeed = 50; // milliseconds per character
            
            function typeNextChar() {
                if (currentText.length < text.length) {
                    currentText += text[currentText.length];
                    questionElement.text(currentText);
                    questionElement.append(cursor);
                    currentTypingTimeout = setTimeout(typeNextChar, typingSpeed);
                } else {
                    // Remove cursor when done
                    cursor.remove();
                    // Start typing answers after question is done
                    typeAnswers();
                }
            }
            
            // Start typing after a short delay
            currentTypingTimeout = setTimeout(typeNextChar, 100);

            // Function to type out answers
            function typeAnswers() {
                let currentAnswerIndex = 0;
                let currentAnswerText = '';
                
                function typeNextAnswer() {
                    if (currentAnswerIndex < map[category].questions[question].answers.length) {
                        const answer = map[category].questions[question].answers[currentAnswerIndex];
                        const choiceLetter = String.fromCharCode(65 + currentAnswerIndex);
                        const answerText = answer.text.replace(/^[A-D][.)]\s*/, '');
                        
                        // Create answer button
                        const answerButton = $('<button>')
                            .addClass('answer-button answer' + resizeClass)
                            .attr({
                                'data-category': category,
                                'data-question': question,
                                'data-value': value,
                                'data-correct': answer.correct,
                                'data-index': currentAnswerIndex
                            })
                            .append(
                                $('<div>').addClass('answer-choice').text(choiceLetter),
                                $('<div>').addClass('answer-text').text(''),
                                $('<div>').addClass('vote-gradient').css('width', '0%'),
                                $('<div>').addClass('vote-distribution')
                            );
                        
                        answers.append(answerButton);
                        
                        function typeAnswerText() {
                            const answerElement = answerButton.find('.answer-text');
                            if (currentAnswerText.length < answerText.length) {
                                currentAnswerText += answerText[currentAnswerText.length];
                                answerElement.text(currentAnswerText);
                                currentAnswerTypingTimeout = setTimeout(typeAnswerText, typingSpeed);
                            } else {
                                currentAnswerIndex++;
                                currentAnswerText = '';
                                currentAnswerTypingTimeout = setTimeout(typeNextAnswer, 500); // Delay between answers
                            }
                        }
                        
                        currentAnswerTypingTimeout = setTimeout(typeAnswerText, 100);
                    }
                }
                
                typeNextAnswer();
            }

            // Clean up animation when modal is closed
            $('#question-modal').on('hidden.bs.modal', function() {
                if (currentTypingTimeout) {
                    clearTimeout(currentTypingTimeout);
                    currentTypingTimeout = null;
                }
                if (currentAnswerTypingTimeout) {
                    clearTimeout(currentAnswerTypingTimeout);
                    currentAnswerTypingTimeout = null;
                }
                // Remove the event listener to prevent memory leaks
                $(this).off('hidden.bs.modal');
            });
        } else {
            // Regular question
            $('#question').empty().text(questionText);
            // Add answers immediately for non-AI questions
            $.each(map[category].questions[question].answers, function(i, answer){
                const choiceLetter = String.fromCharCode(65 + i);
                const answerText = answer.text.replace(/^[A-D][.)]\s*/, '');
                answers.append(
                    '<button class="answer-button answer' + resizeClass + '" ' +
                        'data-category="'+category+'"' +
                        'data-question="'+question+'"' +
                        'data-value="'+value+'"' +
                        'data-correct="'+answer.correct+'"' +
                        'data-index="'+i+'"' +
                        '>' +
                        '<div class="answer-choice">' + choiceLetter + '</div>' +
                        '<div class="answer-text">' + answerText + '</div>' +
                        '<div class="vote-gradient" style="width: 0%"></div>' +
                        '<div class="vote-distribution"></div>' +
                        '</button>'
                )
            });
        }
        
        // Clear previous QR code
        $('#qrcode').empty();

        // Check if this is an interactive question
        if (types.includes('interactive')) {
            // Show QR code
            $('#qr-container').show();
            const voteUrl = `${window.location.origin}/vote`;
            const qrcode = new QRCode(document.getElementById('qrcode'), {
                text: voteUrl,
                width: 128,
                height: 128,
                colorDark : "#1a297c",
                colorLight : "#ffffff",
                errorCorrectionLevel : 'H'
            });

            // Notify server about the current question
            $.ajax({
                url: '/api/set_question',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    types: types,
                    question: questionText,
                    answers: map[category].questions[question].answers
                }),
                success: function(response) {
                    console.log('Question set successfully:', response);
                },
                error: function(xhr, status, error) {
                    console.error('Error setting question:', {
                        status: status,
                        error: error,
                        response: xhr.responseText
                    });
                    alert('Error setting question. Please try again.');
                }
            });
        } else {
            $('#qr-container').hide();
            $.ajax({
                url: '/api/set_question',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ types: [] }),
                success: function(response) {
                    console.log('Question cleared successfully');
                },
                error: function(xhr, status, error) {
                    console.error('Error clearing question:', error);
                }
            });
        }
        
        $('#question-modal').modal('show');
        console.log(category, question);
        console.log(map[category].questions[question]);
        handleAnswer();
    });

});

var score = [{name: "Team 🏛️", score: 0},
                {name: "Team 🪩", score: 0},
                {name: "Team 🎓", score: 0}]
var round = 0;
var map;

function loadBoard(){
    var board = $('#main-board');
    var columns = map.length;
    var column_width = parseInt(12/columns);
    console.log(columns);
    $.each(map, function(i,category){
        //load category name
        var header_class = 'text-center col-md-' + column_width;
        if (i === 0 && columns % 2 != 0){
            header_class += ' col-md-offset-1';
        }
        $('.panel-heading').append(
            '<div class="'+header_class+'"><h4>'+category.name+'</h4></div>'
        );
        //add column
        var div_class = 'category col-md-' + column_width;
        if (i === 0 && columns % 2 != 0){
            div_class += ' col-md-offset-1';
        }
        board.append('<div class="'+div_class+'" id="cat-'+i+'" data-category="'+i+'"></div>');
        var column = $('#cat-'+i);
        $.each(category.questions, function(n,question){
            //add questions with points wrapped in a span
            column.append('<div class="well question unanswered" data-question="'+n+'"><span class="points">'+question.value+'</span></div>')
        });
    });
    $('.panel-heading').append('<div class="clearfix"></div>')
}

function updateScore(){
    const scoreElement = $('#score');
    scoreElement.empty();
    
    for (let i = 0; i < score.length; i++) {
        const isActive = round % 3 === i;
        const teamScore = $('<div>')
            .addClass('team-score')
            .toggleClass('active', isActive)
            .append(
                $('<span>')
                    .addClass('team-name')
                    .text(score[i].name),
                $('<span>')
                    .addClass('team-points')
                    .text(score[i].score)
            );
        scoreElement.append(teamScore);
    }
    
    scoreElement.addClass('score-update');
    setTimeout(() => {
        scoreElement.removeClass('score-update');
    }, 500);
}

var actionInProgress = false;

function updateBoardState() {
    $.ajax({
        type: 'GET',
        url: '/api/board_state',
        success: function(data) {
            // Update team scores
            data.team_scores.forEach((score, index) => {
                $(`.team-score:nth-child(${index + 1}) .team-points`).text(score);
            });
            
            // Update active team
            $('.team-score').removeClass('active');
            $(`.team-score:nth-child(${data.active_team + 1})`).addClass('active');
            
            // Update answered questions
            data.answered_questions.forEach(questionId => {
                const [categoryIdx, questionIdx] = questionId.split('_');
                $(`#cat-${categoryIdx} [data-question="${questionIdx}"]`)
                    .removeClass('unanswered')
                    .empty()
                    .css('cursor', 'not-allowed');
            });
        },
        error: function(xhr, status, error) {
            console.error('Error loading board state:', error);
        }
    });
}

// Listen for board state updates
socket.on('board_state_update', function(data) {
    updateBoardState();
});

function handleAnswer(){
    $('.answer').click(function(){
        if (!actionInProgress) {
            actionInProgress = true;
            playSound('click');
            var category = $(this).data('category');
            var question = $(this).data('question');
            var questionId = map[category].questions[question].id;
            var tile = $(`#cat-${category} [data-question="${question}"]`)[0];
            $(tile).empty().removeClass('unanswered').unbind().css('cursor','not-allowed');

            var myelement = $(this);
            $(this).addClass('selected');
           
            setTimeout(function(){
                // Get question types
                const types = map[category].questions[question].types || [];
                const isInteractive = types.includes('interactive');
                console.log(types);
                
                if (isInteractive) {
                    // Get vote distribution through WebSocket
                    console.log('Getting vote distribution for interactive question...');
                    socket.emit('get_vote_distribution', function(data) {
                        console.log('Received vote distribution:', data);
                        if (data.status === 'success') {
                            // Show distribution
                            Object.entries(data.distribution).forEach(([index, percentage]) => {
                                const button = $(`.answer-button[data-index="${index}"]`);
                                button.find('.vote-gradient')
                                    .css('width', `${percentage}%`);
                                button.find('.vote-distribution')
                                    .text(`${percentage.toFixed(1)}% voted for this`)
                                    .removeClass('visible');
                            });
                            
                            // Add visible class after gradient animation
                            setTimeout(() => {
                                $('.vote-distribution').addClass('visible');
                            }, 4500);
                            
                            // Check if the answer matches any of the most voted options
                            const selectedIndex = parseInt(myelement.data('index'));
                            const isCorrect = data.correct_answers.includes(selectedIndex);
                            
                            console.log('Correct answer indices:', data.correct_answers);
                            console.log('Selected answer index:', selectedIndex);
                            
                            // Wait for gradient animation to complete before showing correct/incorrect
                            setTimeout(() => {
                                if (isCorrect) {
                                    console.log('Answer is correct! Adding points...');
                                    playSound('correct');
                                    data.correct_answers.forEach(index => {
                                        $(`.answer-button[data-index="${index}"]`).addClass('correct');
                                    });
                                    score[round % score.length].score += parseInt(myelement.data('value'));
                                    console.log('New score:', score);
                                } else {
                                    console.log('Answer is incorrect');
                                    playSound('wrong');
                                    myelement.addClass('incorrect');
                                    // Highlight all correct answers
                                    data.correct_answers.forEach(index => {
                                        $(`.answer-button[data-index="${index}"]`).addClass('correct');
                                    });
                                }
                                
                                // Update score and increment round
                                round += 1;
                                updateScore();
                                
                                // Send answer to server
                                socket.emit('answer_question', {
                                    question_id: questionId,
                                    is_correct: isCorrect,
                                    points: parseInt(myelement.data('value'))
                                });
                                
                                // Close modal after showing results
                                setTimeout(() => {
                                    $('#question-modal').modal('hide');
                                    // Clear QR code when modal is closed
                                    $('#qrcode').empty();
                                    actionInProgress = false;
                                }, 3000);
                            }, 4000);
                        } else {
                            console.log('Failed to get vote distribution:', data);
                            // Handle error case
                            round += 1;
                            updateScore();
                            setTimeout(() => {
                                $('#question-modal').modal('hide');
                                $('#qrcode').empty();
                                actionInProgress = false;
                            }, 3000);
                        }
                    });
                } else {
                    // Regular question handling
                    const isCorrect = myelement.data('correct');
                    if (!isCorrect) {
                        playSound('wrong');
                        myelement.addClass('incorrect');
                        var correct = myelement.siblings('[data-correct="true"]');
                        correct.addClass('correct').css('cursor','not-allowed');
                    }
                    if (isCorrect) {
                        playSound('correct');
                        myelement.addClass('correct');
                    }
                    
                    // Send answer to server
                    socket.emit('answer_question', {
                        question_id: questionId,
                        is_correct: isCorrect,
                        points: parseInt(myelement.data('value'))
                    });
                    
                    // Close modal after showing results
                    setTimeout(() => {
                        $('#question-modal').modal('hide');
                        actionInProgress = false;
                    }, 3000);
                }
            }, 1500);
        }
    });
}

function sleep(milliseconds) {
    const date = Date.now();
    let currentDate = null;
    do {
      currentDate = Date.now();
    } while (currentDate - date < milliseconds);
}

// Add styles for vote distribution and animations
const style = document.createElement('style');
style.textContent = `
    .answer-button {
        position: relative;
        overflow: hidden;
    }
    .vote-gradient {
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        background: linear-gradient(90deg, rgba(183, 214, 236, 0.7) 0%, rgba(141, 195, 240, 0.7) 100%);
        transition: width 4s ease-out;
        z-index: 1;
    }
    .answer-content {
        position: relative;
        z-index: 2;
        background: transparent;
    }
    .vote-distribution {
        font-size: 12px;
        color: #666;
        margin-top: 5px;
        opacity: 0;
        transition: opacity 0.5s ease-in;
    }
    .vote-distribution.visible {
        opacity: 1;
    }
    .correct .vote-gradient {
        background: linear-gradient(90deg, rgba(206, 253, 161, 0.8) 0%, rgba(206, 253, 161, 0.9) 100%);
        z-index: 1;
    }
    .incorrect .vote-gradient {
        background: linear-gradient(90deg, rgba(255, 131, 131, 0.8) 0%, rgba(255, 131, 131, 0.9) 100%);
        z-index: 1;
    }
    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.4);
        transform: scale(0);
        animation: ripple 0.6s linear;
        pointer-events: none;
    }
    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
    .score-update {
        animation: scoreUpdate 0.5s var(--transition-timing);
    }
    @keyframes scoreUpdate {
        0% { transform: scale(1); }
        50% { transform: scale(1.2); }
        100% { transform: scale(1); }
    }
`;
document.head.appendChild(style);

// Add animation classes when elements are added to the DOM
document.addEventListener('DOMContentLoaded', function() {
    // Add fade-in animation to the gameboard
    const gameboard = document.querySelector('.gameboard');
    if (gameboard) {
        gameboard.classList.add('fade-in');
    }

    // Add slide-in animation to questions
    const questions = document.querySelectorAll('.question');
    questions.forEach((question, index) => {
        question.style.animationDelay = `${index * 0.1}s`;
        question.classList.add('slide-in');
    });
});

// Handle question clicks
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('question')) {
        const modal = document.getElementById('question-modal');
        if (modal) {
            modal.classList.add('fade-in');
        }
    }
});

// Handle answer selection
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('answer-button')) {
        const button = e.target;
        button.classList.add('selected');
        
        // Add ripple effect
        const ripple = document.createElement('div');
        ripple.classList.add('ripple');
        button.appendChild(ripple);
        
        // Remove ripple after animation
        setTimeout(() => {
            ripple.remove();
        }, 600);
    }
});

// Listen for emoji broadcasts from server
socket.on('emote_broadcast', (data) => {
    console.log('Gameboard received emoji:', data.emoji);
    // Create floating emoji animation
    createFloatingEmoji(data.emoji);
});

// Create floating emoji animation
function createFloatingEmoji(emoji) {
    const emojiElement = document.createElement('div');
    emojiElement.className = 'floating-emoji';
    emojiElement.textContent = emoji;
    
    // Random position across the screen
    const x = Math.random() * (window.innerWidth - 100);
    const y = Math.random() * (window.innerHeight - 100);
    
    emojiElement.style.left = `${x}px`;
    emojiElement.style.top = `${y}px`;
    
    document.body.appendChild(emojiElement);
    
    // Remove element after animation
    setTimeout(() => {
        emojiElement.remove();
    }, 1500);
}
  