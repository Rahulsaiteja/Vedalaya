"""
Flashcard Generator - Hugging Face Space
Generates educational flashcards from text using rule-based NLP.
No heavy ML dependencies - fast startup, always available.
"""

import gradio as gr
import re
from typing import List, Dict


# ── Text processing ────────────────────────────────────────────────────────────

def extract_sentences(text: str, max_count: int = 20) -> List[str]:
    """Split text into clean sentences."""
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    result = []
    for s in sentences:
        s = s.strip()
        if len(s) > 25:
            result.append(s)
    return result[:max_count]


def make_question(sentence: str) -> str:
    """Convert a statement into a question."""
    s = sentence.strip().rstrip('.')

    # Pattern: X is/are/was/were Y
    for verb in ['is', 'are', 'was', 'were']:
        pattern = rf'^(.+?)\s+{verb}\s+(.+)$'
        m = re.match(pattern, s, re.IGNORECASE)
        if m:
            subject = m.group(1).strip()
            # Avoid trivial subjects
            if len(subject.split()) <= 8:
                return f"What {verb} {subject}?"

    # Pattern: X consists of / contains / includes
    for verb in ['consists of', 'contains', 'includes', 'involves', 'requires', 'produces', 'causes']:
        pattern = rf'^(.+?)\s+{verb}\s+(.+)$'
        m = re.match(pattern, s, re.IGNORECASE)
        if m:
            subject = m.group(1).strip()
            return f"What does {subject} {verb}?"

    # Pattern: starts with "The" or "A/An"
    m = re.match(r'^(The|A|An)\s+(\w+)', s, re.IGNORECASE)
    if m:
        noun = m.group(2)
        return f"What is the {noun} described in this context?"

    # Fallback: use first few words as topic
    words = s.split()
    topic = ' '.join(words[:min(5, len(words))])
    return f"What do you know about: {topic}?"


def make_answer(sentence: str) -> str:
    """Clean up a sentence to use as an answer."""
    answer = sentence.strip()
    if not answer.endswith(('.', '!', '?')):
        answer += '.'
    return answer


def generate_flashcards(text: str, num_cards: int) -> List[Dict[str, str]]:
    """Generate flashcards from input text."""
    num_cards = int(num_cards)

    if not text or len(text.strip()) < 20:
        return [{"front": "Error", "back": "Please provide at least 20 characters of text."}]

    sentences = extract_sentences(text, num_cards * 3)

    if not sentences:
        return [{"front": "Error", "back": "Could not extract sentences from the provided text."}]

    cards = []
    seen_questions = set()

    for sentence in sentences:
        if len(cards) >= num_cards:
            break
        question = make_question(sentence)
        answer = make_answer(sentence)
        # Deduplicate
        if question not in seen_questions:
            seen_questions.add(question)
            cards.append({"front": question, "back": answer})

    # Pad with key-point cards if needed
    extra_sentences = [s for s in sentences if make_answer(s) not in [c['back'] for c in cards]]
    for i, sentence in enumerate(extra_sentences):
        if len(cards) >= num_cards:
            break
        cards.append({
            "front": f"Key Point {len(cards) + 1}",
            "back": make_answer(sentence)
        })

    return cards if cards else [{"front": "No content", "back": "Could not generate flashcards from the provided text."}]


# ── Gradio handlers ────────────────────────────────────────────────────────────

def on_generate(text: str, num: int):
    cards = generate_flashcards(text, num)
    # Markdown display
    lines = []
    for i, card in enumerate(cards, 1):
        lines.append(f"### Card {i}")
        lines.append(f"**Q:** {card['front']}")
        lines.append(f"**A:** {card['back']}")
        lines.append("")
    display = "\n".join(lines)
    json_out = {"cards": cards, "count": len(cards), "source": "huggingface-space"}
    return display, json_out


# ── UI ─────────────────────────────────────────────────────────────────────────

with gr.Blocks(title="Flashcard Generator", theme=gr.themes.Soft()) as demo:
    gr.Markdown("""
    # 🎴 AI Flashcard Generator
    Generate educational flashcards from any text instantly.

    Paste your study material, choose how many cards you want, and click **Generate**.
    """)

    with gr.Row():
        with gr.Column(scale=1):
            text_input = gr.Textbox(
                label="Educational Text",
                placeholder="Paste your study material here...\n\nExample:\nPhotosynthesis is the process by which plants convert sunlight into energy. Plants use chlorophyll to capture light. The process occurs in chloroplasts and produces glucose and oxygen.",
                lines=12
            )
            num_cards = gr.Slider(minimum=1, maximum=20, value=5, step=1, label="Number of Flashcards")
            generate_btn = gr.Button("⚡ Generate Flashcards", variant="primary", size="lg")

        with gr.Column(scale=1):
            output_display = gr.Markdown(label="Generated Flashcards", value="*Your flashcards will appear here...*")
            output_json = gr.JSON(label="JSON Output (for API integration)")

    gr.Examples(
        examples=[
            [
                "Photosynthesis is the process by which plants convert sunlight into energy. Plants use chlorophyll to capture light energy from the sun. The process occurs in chloroplasts. It produces glucose and oxygen as byproducts.",
                4
            ],
            [
                "The mitochondria is the powerhouse of the cell. It produces ATP through cellular respiration. Mitochondria contain their own DNA. They are thought to have originated from ancient bacteria through endosymbiosis.",
                4
            ],
            [
                "Python is a high-level programming language. It was created by Guido van Rossum in 1991. Python emphasizes code readability. It uses significant indentation to define code blocks. Python supports multiple programming paradigms.",
                4
            ],
        ],
        inputs=[text_input, num_cards],
        label="Try these examples"
    )

    generate_btn.click(
        fn=on_generate,
        inputs=[text_input, num_cards],
        outputs=[output_display, output_json]
    )

    gr.Markdown("""
    ---
    ## 🔌 API Integration

    Use this Space as a backend API from your Node.js app:

    ```javascript
    const response = await fetch('https://sr0n-flashcard-generator.hf.space/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: ["Your educational text here", 5] })
    });
    const result = await response.json();
    const flashcards = result.data[1].cards;
    // flashcards = [{ front: "Question?", back: "Answer." }, ...]
    ```

    **Response format:**
    ```json
    {
        "cards": [
            { "front": "What is photosynthesis?", "back": "The process by which plants convert sunlight into energy." }
        ],
        "count": 5,
        "source": "huggingface-space"
    }
    ```
    """)

if __name__ == "__main__":
    demo.launch()
