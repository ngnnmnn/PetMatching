import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const logPath = 'C:\\Users\\Tran Ngoc Duc\\.gemini\\antigravity-ide\\brain\\8d425211-539f-4165-beef-dbb746ebbb01\\.system_generated\\logs\\transcript_full.jsonl';
  if (!fs.existsSync(logPath)) {
    console.error('Log file not found:', logPath);
    return;
  }

  // Load the baseline file (which is currently the reset one)
  const filePath = path.join(__dirname, '../../client/app/manager/page.tsx');
  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  console.log(`Loaded baseline page.tsx. Length: ${content.length} chars.`);

  const lines = fs.readFileSync(logPath, 'utf8').split('\n');
  console.log(`Loaded ${lines.length} lines from log.`);

  let editCount = 0;
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.tool_calls) {
        for (const tc of obj.tool_calls) {
          if (tc.name === 'replace_file_content') {
            const args = tc.args || {};
            if (args.TargetFile && args.TargetFile.endsWith('page.tsx') && args.TargetFile.includes('manager')) {
              // Normalize newlines in both target and replacement
              const target = (args.TargetContent || '').replace(/\r\n/g, '\n');
              const replacement = (args.ReplacementContent || '').replace(/\r\n/g, '\n');
              
              if (!target || !replacement) continue;

              // Check if target exists in our current content
              if (content.includes(target)) {
                content = content.replace(target, replacement);
                editCount++;
                console.log(`Replayed edit ${editCount} at step ${obj.step_index}: ${args.Description || 'No description'}`);
              } else {
                console.warn(`WARNING: Target content not found for edit at step ${obj.step_index}!`);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('Error parsing line:', e.message);
    }
  }

  // Convert back to CRLF for Windows
  const finalContent = content.replace(/\n/g, '\r\n');
  fs.writeFileSync(filePath, finalContent, 'utf8');
  console.log(`Reconstructed page.tsx saved successfully! Length: ${finalContent.length} chars.`);
}

main().catch(console.error);
