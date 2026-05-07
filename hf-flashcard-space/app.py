"""
Flashcard Generator - Hugging Face Space
Uses transformer models to generate educational flashcards from text
"""

import gradio as gr
from transformers import pipeline, AutoTokenizer, AutoModelForSeq2SeqLM
import json
import re
from typing import List, Dict

# Load models
print("Loading models...")
try:
    # Use T5 for question generation
    qg_tokenizer = AutoTokenizer.from_pretrained("valhalla/t5-base-qg-hl")
    qg_model = AutoModelForSeq2SeqLM.from_pretrained("valhalla/t5-base-qg-hl")
    qg_pipeline = pipeline("text2text-generation", model=qg_model, tokenizer=qg_tokenizer)
    print("✅ Question generation model loaded")
except Exception as e:
    print(f"⚠️ Could not load QG model: {e}")
    qg_pipeline = None

# Fallback: Use T5-small for general text generation
try:
    t5_pipeline = pipeline("text2text-generation", model="t5-small")
    print("✅ T5-small model loaded")
except Exception as e:
    print(f"⚠️ Could not load T5: {e}")
    t5_pipeline = None

def extract_key_sentences(text: str, max_sentences: int = 10) -> List[str]:
    """Extract key sentences from text"""
    # Split into sentences
    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 20]
    
    # Return up to max_sentences
    return sentences[:max_sentences]

def generate_question_from_sentence(sentence: str) -> str:
    """Generate a question from a sentence"""
    if qg_pipeline:
        try:
            # Highlight the entire sentence for question generation
            input_text = f"generate question: {sentence}"
            result = qg_pipeline(input_text, max_length=64, num_return_sequences=1)
            question = result[0]['generated_text']
            return question.strip()
        except Exception as e:
            print(f"QG error: {e}")
    
    # Fallback: Create simple questions
    # Check for "is" pattern
    match = re.search(r'(.+?)\s+is\s+(.+)', sentence, re.IGNORECASE)
    if match:
        subject = match.group(1).strip()
        return f"What is {subject}?"
    
    # Check for "are" pattern
    match = re.search(r'(.+?)\s+are\s+(.+)', sentence, re.IGNORECASE)
    if match:
        subject = match.group(1).strip()
        return f"What are {subject}?"
    
    # Generic question
    words = sentence.split()[:5]
    return f"What is the main point about {' '.join(words)}?"

def generate_flashcards(text: str, num_cards: int = 5) -> List[Dict[str, str]]:
    """Generate flashcards from text"""
    if not text or len(text.strip()) < 20:
        return [{"error": "Please provide at least 20 characters of text"}]
    
    # Extract key sentences
    sentences = extract_key_sentences(text, num_cards * 2)
    
    if not sentences:
        return [{"error": "Could not extract meaningful content from text"}]
    
    flashcards = []
    
    for sentence in sentences[:num_cards]:
        try:
            # Generate question
            question = generate_question_from_sentence(sentence)
            
            # Use sentence as answer
            answer = sentence.strip()
            
            # Create flashcard
            flashcards.append({
                "front": question,
                "back": answer
            })
            
        except Exception as e:
            print(f"Error generating card: {e}")
            continue
    
    # If we couldn't generate enough cards, add simple ones
    if len(flashcards) < num_cards:
        for i, sentence in enumerate(sentences[len(flashcards):num_cards]):
            flashcards.append({
                "front": f"Key Point {len(flashcards) + 1}",
                "back": sentence
            })
    
    return flashcards

def format_flashcards_for_display(flashcards: List[Dict[str, str]]) -> str:
    """Format flashcards for display in Gradio"""
    if not flashcards:
        return "No flashcards generated"
    
    if "error" in flashcards[0]:
        return f"Error: {flashcards[0]['error']}"
    
    output = []
    for i, card in enumerate(flashcards, 1):
        output.append(f"### Card {i}")
        output.append(f"**Q:** {card['front']}")
        output.append(f"**A:** {card['back']}")
        output.append("")
    
    return "\n".join(output)

def generate_flashcards_api(text: str, num_cards: int = 5) -> Dict:
    """API endpoint for flashcard generation"""
    flashcards = generate_flashcards(text, num_cards)
    return {
        "cards": flashcards,
        "count": len(flashcards),
        "source": "huggingface-space"
    }

# Gradio Interface
with gr.Blocks(title="Flashcard Generator", theme=gr.themes.Soft()) as demo:
    gr.Markdown("""
    # 🎴 AI Flashcard Generator
    
    Generate educational flashcards from any text using AI. Perfect for studying!
    
    **How to use:**
    1. Paste your educational content below
    2. Choose how many flashcards you want
    3. Click "Generate Flashcards"
    4. Use the API endpoint for integration with your app
    """)
    
    with gr.Row():
        with gr.Column():
            text_input = gr.Textbox(
                label="Educational Text",
                placeholder="Paste your study material here...\n\nExample: Photosynthesis is the process by which plants convert sunlight into energy. Plants use chlorophyll to capture light energy from the sun.",
                lines=10
            )
            num_cards = gr.Slider(
                minimum=1,
                maximum=20,
                value=5,
                step=1,
                label="Number of Flashcards"
            )
            generate_btn = gr.Button("Generate Flashcards", variant="primary")
        
        with gr.Column():
            output_display = gr.Markdown(label="Generated Flashcards")
            output_json = gr.JSON(label="JSON Output (for API)")
    
    # Examples
    gr.Examples(
        examples=[
            ["Photosynthesis is the process by which plants convert sunlight into energy. Plants use chlorophyll to capture light energy. The process occurs in chloroplasts and produces glucose and oxygen.", 3],
            ["The mitochondria is the powerhouse of the cell. It produces ATP through cellular respiration. Mitochondria have their own DNA and are thought to have originated from bacteria.", 3],
            ["Python is a high-level programming language. It was created by Guido van Rossum in 1991. Python emphasizes code readability and uses significant indentation.", 3],
        ],
        inputs=[text_input, num_cards],
    )
    
    # Event handlers
    def on_generate(text, num):
        flashcards = generate_flashcards(text, num)
        display = format_flashcards_for_display(flashcards)
        json_output = generate_flashcards_api(text, num)
        return display, json_output
    
    generate_btn.click(
        fn=on_generate,
        inputs=[text_input, num_cards],
        outputs=[output_display, output_json]
    )
    
    gr.Markdown("""
    ---
    ## 🔌 API Usage
    
    Use this Space as an API endpoint in your application:
    
    ```python
    import requests
    
    API_URL = "https://YOUR-USERNAME-flashcard-generator.hf.space/api/predict"
    
    response = requests.post(API_URL, json={
        "data": ["Your educational text here", 5]
    })
    
    flashcards = response.json()["data"][1]["cards"]
    ```
    
    ```javascript
    // Node.js / JavaScript
    const response = await fetch('https://YOUR-USERNAME-flashcard-generator.hf.space/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            data: ["Your educational text here", 5]
        })
    });
    
    const result = await response.json();
    const flashcards = result.data[1].cards;
    ```
    
    **Response Format:**
    ```json
    {
        "cards": [
            {
                "front": "What is photosynthesis?",
                "back": "The process by which plants convert sunlight into energy"
            }
        ],
        "count": 5,
        "source": "huggingface-space"
    }
    ```
    """)

# Launch
if __name__ == "__main__":
    demo.launch()
