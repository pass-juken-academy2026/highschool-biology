'use strict';
const fs = require('node:fs');

function extractArray(source, marker) {
  const at = source.indexOf(marker);
  if (at < 0) throw new Error('Missing marker: ' + marker);
  const open = source.indexOf('[', at + marker.length);
  if (open < 0) throw new Error('Missing array after marker: ' + marker);
  let depth = 0, quote = '', escaped = false;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"') { quote = ch; continue; }
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) return JSON.parse(source.slice(open, i + 1));
    }
  }
  throw new Error('Unclosed array after marker: ' + marker);
}

const files = [
  ['biology', 'practice.html'],
  ['chemistry', 'chemistry/practice.html'],
  ['physics', 'physics/practice.html'],
  ['earth science', 'earth-science/practice.html'],
];
const errors = [];
for (const [name, file] of files) {
  const source = fs.readFileSync(file, 'utf8');
  let questions;
  try { questions = extractArray(source, 'const COMMON_TEST='); }
  catch (e) { errors.push(name + ': ' + e.message); continue; }
  if (questions.length !== 25) errors.push(name + ': expected 25 questions, found ' + questions.length);
  const seenStimuli = new Set();
  const groupSizes = new Map();
  let previousStimulus = null;
  const seenPrompts = new Set();
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const label = name + ' question ' + (i + 1);
    if (!Array.isArray(q) || q.length < 6) { errors.push(label + ': expected [id, question, options, answer, explanation, stimulus]'); continue; }
    if (typeof q[1] !== 'string' || !q[1].trim()) errors.push(label + ': empty question');
    if (!Array.isArray(q[2]) || q[2].length !== 4 || q[2].some(x => typeof x !== 'string' || !x.trim())) errors.push(label + ': expected four non-empty options');
    if (!Number.isInteger(q[3]) || q[3] < 0 || q[3] > 3) errors.push(label + ': invalid answer index');
    if (typeof q[4] !== 'string' || !q[4].trim()) errors.push(label + ': missing explanation');
    if (typeof q[5] !== 'string' || !q[5].trim()) errors.push(label + ': missing shared stimulus');
    const prompt = String(q[1] || '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, '');
    if (prompt && seenPrompts.has(prompt)) errors.push(label + ': duplicate question prompt');
    seenPrompts.add(prompt);
    const stimulus = String(q[5] || '');
    if (stimulus !== previousStimulus) {
      if (seenStimuli.has(stimulus)) errors.push(label + ': questions for the same stimulus are split across separate groups');
      seenStimuli.add(stimulus);
      previousStimulus = stimulus;
    }
    groupSizes.set(stimulus, (groupSizes.get(stimulus) || 0) + 1);
  }
  if (groupSizes.size !== 5) errors.push(name + ': expected 5 connected large-question stimuli, found ' + groupSizes.size);
  for (const [stimulus, count] of groupSizes) {
    if (count < 4 || count > 6) errors.push(name + ': each large question should contain 4–6 linked subquestions; found ' + count + ' for ' + stimulus.split('\n')[0]);
  }
  console.log(name + ': ' + questions.length + ' questions, ' + groupSizes.size + ' connected large-question groups');
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('Common-test question structure checks passed.');
