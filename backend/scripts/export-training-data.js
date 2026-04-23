import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import { TrainingExample } from '../src/models/TrainingExample.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function toJsonlLine(example) {
  return JSON.stringify({
    instruction: example.prompt,
    input: '',
    output: example.response,
    meta: {
      source: example.source,
      tags: example.tags || [],
      createdAt: example.createdAt,
    },
  });
}

async function main() {
  const outArg = process.argv.find((a) => a.startsWith('--out='));
  const outPath = outArg ? outArg.slice('--out='.length) : 'training-data/vedalaya_train.jsonl';
  const fullOut = path.resolve(process.cwd(), outPath);

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI missing in environment');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const examples = await TrainingExample.find({ approved: true }).sort({ createdAt: 1 }).lean();
  const lines = examples.map(toJsonlLine).join('\n');

  fs.mkdirSync(path.dirname(fullOut), { recursive: true });
  fs.writeFileSync(fullOut, lines, 'utf8');

  // eslint-disable-next-line no-console
  console.log(`Exported ${examples.length} examples -> ${fullOut}`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});

