// Initialize sound effects
const sounds = {
    click: new Audio('/static/sounds/click.wav'),
    correct: new Audio('/static/sounds/correct.wav'),
    wrong: new Audio('/static/sounds/wrong.wav'),
    countdown: new Audio('/static/sounds/countdown.wav')
};

// Initialize socket connection
const socket = io();

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
            loadBoard();
        },
        error: function(xhr, status, error) {
            console.error('Error loading board data:', error);
            alert('Error loading game board. Please refresh the page.');
        }
    });
    $('.unanswered').click(function(){
        playSound('click');
        var category = $(this).parent().data('category');
        var question = $(this).data('question');
        var value = map[category].questions[question].value;
        var answers = $('#answers');
        resizeClass = " more-text"
        $('.modal-title').empty().text(map[category].name);
        $('#question').empty().text(map[category].questions[question].question);
        answers.empty();

        // Clear previous QR code
        $('#qrcode').empty();

        // Check if this is an interactive question
        const isInteractive = map[category].questions[question].interactive;
        if (isInteractive) {
            // Show QR code
            $('#qr-container').show();
            const voteUrl = `${window.location.origin}/vote`;
            const qrcode = new QRCode(document.getElementById('qrcode'), {
                text: voteUrl,
                width: 128,
                height: 128,
                colorDark : "#000000",
                colorLight : "#ffffff",
                errorCorrectionLevel : 'H'
            });

            // Notify server about the current question
            $.ajax({
                url: '/api/set_question',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    interactive: true,
                    question: map[category].questions[question].question,
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
                data: JSON.stringify({ interactive: false }),
                success: function(response) {
                    console.log('Question cleared successfully');
                },
                error: function(xhr, status, error) {
                    console.error('Error clearing question:', error);
                }
            });
        }

        $.each(map[category].questions[question].answers, function(i, answer){
            answers.append(
                '<button class="answer-button answer' + resizeClass + '" ' +
                    'data-category="'+category+'"' +
                    'data-question="'+question+'"' +
                    'data-value="'+value+'"' +
                    'data-correct="'+answer.correct+'"' +
                    'data-index="'+i+'"' +
                    '>' +
                    '<div class="vote-gradient" style="width: 0%"></div>' +
                    '<div class="answer-content">' +
                    answer.text +
                    '<div class="vote-distribution"></div>' +
                    '</div>' +
                    '</button>'
            )
        });
        
        $('#question-modal').modal('show');
        console.log(category, question);
        console.log(map[category].questions[question]);
        handleAnswer();
    });

});

var score = [{name: "Team A", score: 0},
                {name: "Team B", score: 0},
                {name: "Team C", score: 0}]
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
            //add questions
            column.append('<div class="well question unanswered" data-question="'+n+'">'+question.value+'</div>')
        });
    });
    $('.panel-heading').append('<div class="clearfix"></div>')
}

function updateScore(){
    var msg = ""
    for (var i = 0; i < score.length; i+=1) {
        if (round % 3 == i)
            msg += "<b>" + score[i].name + "</b>"
        else
            msg += score[i].name
        msg += ": " + score[i].score + "  "
    }

    $('#score').empty().append(msg);
}

var actionInProgress = false;

function handleAnswer(){
    $('.answer').click(function(){
        if (!actionInProgress) {
            actionInProgress = true;
            playSound('click');
            var tile= $('div[data-category="'+$(this).data('category')+'"]>[data-question="'+$(this).data('question')+'"]')[0];
            $(tile).empty().removeClass('unanswered').unbind().css('cursor','not-allowed');

            var myelement = $(this);
            $(this).addClass('selected');
           
            setTimeout(function(){
                // Check if this is an interactive question
                const category = myelement.data('category');
                const question = myelement.data('question');
                const isInteractive = map[category].questions[question].interactive;

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
                            }, 4000); // Wait for gradient animation to complete
                        } else {
                            console.log('Failed to get vote distribution:', data);
                        }
                    });
                } else {
                    // Regular question handling
                    if (myelement.data('correct') == false){
                        playSound('wrong');
                        myelement.addClass('incorrect');
                        var correct = myelement.siblings('[data-correct="true"]');
                        correct.addClass('correct').css('cursor','not-allowed');
                    }
                    if (myelement.data('correct')){
                        playSound('correct');
                        myelement.addClass('correct');
                        score[round % score.length].score += parseInt(myelement.data('value'));
                    }
                }
            }, 1500);
            
            // wait before closing modal
            setTimeout(function(){
                round += 1;
                updateScore();
                actionInProgress = false;
            }, 4000);

            if (isInteractive) {
                setTimeout(function(){
                    $('#question-modal').modal('hide');
                    // Clear QR code when modal is closed
                    $('#qrcode').empty();
                }, 14000);
            } else {
                setTimeout(function(){
                    $('#question-modal').modal('hide');
                    // Clear QR code when modal is closed
                    $('#qrcode').empty();
                }, 7000);
            }
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

// Add styles for vote distribution
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
        background: linear-gradient(90deg, rgba(76, 175, 80, 0.5) 0%, rgba(76, 175, 80, 0.7) 100%);
    }
    .incorrect .vote-gradient {
        background: linear-gradient(90deg, rgba(244, 67, 54, 0.5) 0%, rgba(244, 67, 54, 0.7) 100%);
    }
`;
document.head.appendChild(style);
  