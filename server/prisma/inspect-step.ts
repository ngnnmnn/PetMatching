import * as fs from 'fs';

const logPath = 'C:\\Users\\Tran Ngoc Duc\\.gemini\\antigravity-ide\\brain\\8d425211-539f-4165-beef-dbb746ebbb01\\.system_generated\\logs\\transcript_full.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const obj = JSON.parse(line);
    if (obj.step_index === 489) {
      console.log('Step 489 Tool Calls:', JSON.stringify(obj.tool_calls, null, 2));
    }
  } catch (e) {}
}
