# Vedalaya Fine-Tuning Starter (QLoRA)

This guide sets up your own trainable dataset and exports JSONL from your app database.

## 1) Build dataset inside app backend

The backend now includes:

- `POST /api/training/examples` (teacher): add manual Q/A
- `GET /api/training/examples` (teacher): list current examples
- `DELETE /api/training/examples/:id` (teacher): remove bad sample
- `POST /api/training/examples/from-doubt/:id` (teacher): promote a student doubt answer

Auth: teacher JWT required.

## 2) Export dataset to JSONL

From `backend/`:

```bash
npm run export:training
```

Default output:

`backend/training-data/vedalaya_train.jsonl`

Custom output:

```bash
node scripts/export-training-data.js --out=training-data/my_custom.jsonl
```

## 3) QLoRA training starter (Python)

Create a Python env and install:

```bash
pip install transformers datasets peft trl accelerate bitsandbytes
```

Use this structure in your trainer:

```json
{"instruction":"Explain photosynthesis","input":"","output":"..."}
```

Recommended base models to start:

- `meta-llama/Llama-3.1-8B-Instruct`
- `Qwen/Qwen2.5-7B-Instruct`

Recommended first run:

- epochs: `1-3`
- lr: `2e-4`
- max seq length: `1024`
- batch size: as GPU allows

## 4) Deploy fine-tuned model

After training, either:

- export to GGUF and serve with Ollama, or
- serve directly with vLLM/text-generation-inference.

Then point backend `.env`:

- `OLLAMA_MODEL=<your-finetuned-model>`

## 5) Data quality checklist

- Remove vague or wrong answers
- Keep answers short, step-by-step
- Add tags by subject (`math`, `physics`, `biology`)
- Prefer curated teacher responses over raw model outputs

