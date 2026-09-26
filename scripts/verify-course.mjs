import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const original = fs.readFileSync(path.join(root, 'content', 'technology-changes-original.txt'), 'utf8').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
const data = JSON.parse(fs.readFileSync(path.join(root, 'content', 'technology-changes.json'), 'utf8'));
const hash = crypto.createHash('sha256').update(original).digest('hex');
if (hash !== data.source_sha256) throw new Error(`Source hash mismatch: ${hash} != ${data.source_sha256}`);
if (data.steps.length !== 91) throw new Error(`Expected 91 steps, got ${data.steps.length}`);
for (let i=0;i<91;i++) if (data.steps[i].step_number !== i+1) throw new Error(`Step sequence error at ${i+1}`);
const reconstructed = [data.intro_text, ...data.steps.map(s=>s.content)].join('\n---\n');
if (reconstructed !== original) throw new Error('Structured course text differs from the original source.');
console.log('OK: 91 steps; structured text exactly matches the original course file.');
console.log(`SHA-256: ${hash}`);
