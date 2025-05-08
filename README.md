# Campus Clash Interactive Game

A Jeopardy-style game with interactive audience voting capabilities.

## Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Run the server:
```bash
python server.py
```

3. Open the game board in your browser:
```
http://localhost:5000
```

4. For audience voting, open:
```
http://localhost:5000/vote
```

## How to Use

1. The game board shows categories and point values
2. Click on a question to reveal it
3. For interactive questions:
   - A QR code will appear next to the question
   - Audience members can scan the QR code to vote
   - Contestants must guess which answer got the most votes
4. For regular questions:
   - Contestants must select the correct answer
   - Points are awarded for correct answers

## Adding Interactive Questions

To make a question interactive, add the `interactive: true` property to the question in `board.json`. Example:

```json
{
    "value": 20,
    "question": "What's the most popular programming language?",
    "interactive": true,
    "answers": [
        {
            "text": "Python",
            "correct": false
        },
        {
            "text": "JavaScript",
            "correct": false
        },
        {
            "text": "Java",
            "correct": false
        },
        {
            "text": "C++",
            "correct": false
        }
    ]
}
```
