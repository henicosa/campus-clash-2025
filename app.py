from flask import Flask, request, jsonify, send_from_directory, url_for
import json
from collections import defaultdict
import os
import signal
import sys
from flask_socketio import SocketIO, emit

# Get the absolute path to the static directory
STATIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), 'static'))
SOUNDS_DIR = os.path.join(STATIC_DIR, 'sounds')

app = Flask(__name__, 
            static_folder=STATIC_DIR,
            static_url_path='')
socketio = SocketIO(app, cors_allowed_origins="*")

# Store the current active question and votes
current_question = None
votes = defaultdict(int)
answered_questions = set()  # Store answered question IDs
active_team = 0  # 0: students, 1: university, 2: forum
team_scores = [0, 0, 0]  # Scores for each team

def reset_game_state():
    global current_question, votes, answered_questions, active_team, team_scores
    current_question = None
    votes = defaultdict(int)
    answered_questions = set()
    active_team = 0
    team_scores = [0, 0, 0]

# Load the board data on startup
def load_board_data():
    board_path = os.path.join(STATIC_DIR, 'board.json')
    try:
        with open(board_path, 'r', encoding='utf-8') as f:
            board = json.load(f)
            # Add IDs to questions
            for category_idx, category in enumerate(board):
                for question_idx, question in enumerate(category['questions']):
                    question['id'] = f"{category_idx}_{question_idx}"
            return board
    except Exception as e:
        print(f"Error loading board.json: {e}")
        return []

board_data = load_board_data()

@app.route('/control-panel-2025')
def serve_gameboard():
    return send_from_directory(STATIC_DIR, 'gameboard.html')


@app.route('/')
@app.route('/vote')
def serve_vote():
    return send_from_directory(STATIC_DIR, 'vote.html')

@app.route('/api/board', methods=['GET'])
def get_board():
    return jsonify(board_data)

@app.route('/api/board_state', methods=['GET'])
def get_board_state():
    return jsonify({
        'active_team': active_team,
        'team_scores': team_scores,
        'answered_questions': list(answered_questions)
    })

@app.route('/api/current_question', methods=['GET'])
def get_current_question():
    if current_question is None:
        return jsonify({"status": "waiting"})
    return jsonify(current_question)

@app.route('/static/sounds/<path:filename>')
def serve_sound(filename):
    return send_from_directory(SOUNDS_DIR, filename)

@socketio.on('submit_vote')
def handle_vote(data):
    global votes
    answer_index = data.get('answer_index')
    print(f"Received vote for answer index: {answer_index}")
    if current_question and answer_index is not None:
        votes[answer_index] += 1
        print(f"Current votes: {dict(votes)}")
        # Broadcast updated vote distribution
        total_votes = sum(votes.values())
        distribution = {
            i: (votes[i] / total_votes * 100) if total_votes > 0 else 0
            for i in range(len(current_question['answers']))
        }
        print(f"Broadcasting distribution: {distribution}")
        emit('vote_distribution', {
            "status": "success",
            "distribution": distribution,
            "total_votes": total_votes
        }, broadcast=True)
    return {"status": "success" if current_question and answer_index is not None else "error"}

@socketio.on('get_question')
def handle_get_question():
    if current_question is None:
        emit('question_update', {"status": "waiting"})
    else:
        emit('question_update', current_question)

@socketio.on('get_vote_distribution')
def handle_get_vote_distribution():
    if current_question is None:
        print("No current question for vote distribution")
        return {"status": "no_question"}
    
    total_votes = sum(votes.values())
    distribution = {
        i: (votes[i] / total_votes * 100) if total_votes > 0 else 0
        for i in range(len(current_question['answers']))
    }
    
    # Find the maximum vote percentage
    max_percentage = max(distribution.values())
    
    # Find all answers that have the maximum percentage (handles ties)
    correct_answers = [
        i for i, percentage in distribution.items()
        if percentage == max_percentage and percentage > 0
    ]
    
    print(f"Sending vote distribution: {distribution}")
    print(f"Correct answers (indices): {correct_answers}")
    
    return {
        "status": "success",
        "distribution": distribution,
        "total_votes": total_votes,
        "correct_answers": correct_answers
    }

@app.route('/api/set_question', methods=['POST'])
def set_question():
    global current_question, votes
    data = request.json
    if data.get('types') and 'interactive' in data.get('types'):
        current_question = data
        votes = defaultdict(int)
        # Broadcast new question to all clients
        socketio.emit('question_update', current_question)
        return jsonify({"status": "success"})
    current_question = None
    # Broadcast that there's no question
    socketio.emit('question_update', {"status": "waiting"})
    return jsonify({"status": "success"})

@socketio.on('emote')
def handle_emote(data):
    print(f"Received emoji: {data['emoji']}")
    # Broadcast the emoji to all clients
    socketio.emit('emote_broadcast', data)

@socketio.on('answer_question')
def handle_answer(data):
    global active_team, team_scores, answered_questions
    question_id = data.get('question_id')
    is_correct = data.get('is_correct')
    points = data.get('points', 0)
    
    if question_id not in answered_questions:
        answered_questions.add(question_id)
        if is_correct:
            team_scores[active_team] += points
        active_team = (active_team + 1) % 3
        socketio.emit('board_state_update', {
            'active_team': active_team,
            'team_scores': team_scores,
            'answered_questions': list(answered_questions)
        })

@app.route('/api/reset', methods=['POST'])
def reset_game():
    reset_game_state()
    socketio.emit('board_state_update', {
        'active_team': active_team,
        'team_scores': team_scores,
        'answered_questions': list(answered_questions)
    })
    return jsonify({"status": "success"})

def signal_handler(sig, frame):
    print('Shutting down gracefully...')
    sys.exit(0)

if __name__ == '__main__':
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Run the server
    socketio.run(app, host='0.0.0.0', port=5000, debug=True) 