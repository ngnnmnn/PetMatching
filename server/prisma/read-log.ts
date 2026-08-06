import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const logPath = 'C:\\Users\\Tran Ngoc Duc\\.gemini\\antigravity-ide\\brain\\8d425211-539f-4165-beef-dbb746ebbb01\\.system_generated\\logs\\transcript_full.jsonl';
  if (!fs.existsSync(logPath)) {
    console.error('Log file not found:', logPath);
    return;
  }

  const lines = fs.readFileSync(logPath, 'utf8').split('\n');
  console.log(`Read ${lines.length} lines from log.`);

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.tool_calls) {
        for (const tc of obj.tool_calls) {
          if (tc.name === 'replace_file_content' || tc.name === 'write_to_file') {
            const args = tc.args || {};
            if (args.TargetFile && args.TargetFile.endsWith('page.tsx') && args.TargetFile.includes('manager')) {
              console.log('\n========================================');
              console.log(`Step ${obj.step_index} | Tool: ${tc.name}`);
              console.log('Description:', args.Description);
              console.log('StartLine:', args.StartLine, 'EndLine:', args.EndLine);
              console.log('----------------------------------------');
              console.log('TargetContent:\n', args.TargetContent);
              console.log('----------------------------------------');
              console.log('ReplacementContent:\n', args.ReplacementContent);
            }
          }
        }
      }
    } catch (e) {}
  }
}

main().catch(console.error);
