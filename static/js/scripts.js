// Initialize sound effects
const sounds = {
    click: new Audio('/static/sounds/click.wav'),
    correct: new Audio('/static/sounds/correct.wav'),
    wrong: new Audio('/static/sounds/wrong.wav'),
    countdown: new Audio('/static/sounds/countdown.wav')
};

// Function to play sounds
function playSound(soundName) {
    if (sounds[soundName]) {
        sounds[soundName].currentTime = 0;
        sounds[soundName].play().catch(e => {
            console.log('Error playing sound:', e);
            console.log('Attempted to play:', soundName);
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
        url:'board.json',
        success:function(data){
            map = data;
            loadBoard();
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
        $.each(map[category].questions[question].answers, function(i, answer){
            answers.append(
                '<button class="answer-button answer' + resizeClass + '" ' +
                    'data-category="'+category+'"' +
                    'data-question="'+question+'"' +
                    'data-value="'+value+'"' +
                    'data-correct="'+answer.correct+'"' +
                    '>'+ answer.text+'</button>'
            )
        });
        // add answer button to submit answer
        //$('.modal-footer').append('<button class="btn btn-primary center submit-answer">Submit</button>');
        
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
function loadBoard(){answers
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
                // set background color to red if incorrect
                if (myelement.data('correct') == false){
                    playSound('wrong');
                    myelement.addClass('incorrect');
                    // get question with correct answer which is one of the siblings
                    var correct = myelement.siblings('[data-correct="true"]');
                    correct.addClass('correct').css('cursor','not-allowed');
                }
                if (myelement.data('correct')){
                    playSound('correct');
                    myelement.addClass('correct');
                    console.log(score.length)
                    score[round % score.length].score += parseInt(myelement.data('value'));
                }
            }, 1500);
            
            // wait before closing modal
            setTimeout(function(){
                round += 1;
                updateScore();
                actionInProgress = false;
            }, 4000);

            setTimeout(function(){
                $('#question-modal').modal('hide');
            }, 7000);
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
  