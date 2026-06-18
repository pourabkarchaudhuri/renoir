// CLI agent detection. Looks up known agent binaries on PATH and returns a
// structured catalog. The renderer can pick one to delegate a chat turn to;
// when an agent is selected the user message is forwarded to its CLI in a
// child process and stdout is streamed back as if it came from BYOK LLM.
//
// We support the major coding agents that already speak from the terminal.
// The list is intentionally inclusive — if it's on PATH and matches a known
// id, it shows up in the picker.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { BrowserWindow } from 'electron';
/**
 * Known agent definitions. `bin` is the executable name we resolve on PATH.
 * The list is broad on purpose — Renoir does not bundle anything; if you have
 * the binary, you get the picker entry.
 */
const KNOWN = [
    // ALL agents use stdin for prompt delivery. The `args` array contains only
    // mode flags that tell the CLI to read from stdin / run non-interactively.
    // This avoids: (1) command-line length limits, (2) content parsed as flags,
    // (3) shell special character issues.
    // Claude Code: `claude -p` reads prompt from stdin in print mode
    { id: 'claude-code', name: 'Claude Code', bin: 'claude', blurb: 'Anthropic Claude Code CLI', invoke: 'stdin', available: false, args: ['-p'] },
    // Codex: `codex -q` reads from stdin in quiet mode
    { id: 'codex', name: 'Codex', bin: 'codex', blurb: 'OpenAI Codex / coding agent CLI', invoke: 'stdin', available: false, args: ['-q'] },
    { id: 'devin', name: 'Devin', bin: 'devin', blurb: 'Cognition Devin CLI', invoke: 'stdin', available: false },
    // Cursor CLI: `cursor-agent --print` — reads from stdin when piped
    { id: 'cursor', name: 'Cursor Agent', bin: 'cursor-agent', blurb: 'Cursor terminal agent', invoke: 'stdin', available: false, args: ['--print'] },
    // Gemini: `gemini` reads from stdin
    { id: 'gemini', name: 'Gemini', bin: 'gemini', blurb: 'Google Gemini CLI', invoke: 'stdin', available: false },
    { id: 'opencode', name: 'OpenCode', bin: 'opencode', blurb: 'OpenCode terminal agent', invoke: 'stdin', available: false },
    { id: 'qwen', name: 'Qwen', bin: 'qwen', blurb: 'Qwen Code / Tongyi CLI', invoke: 'stdin', available: false },
    // Copilot: `gh copilot suggest -t shell` reads from stdin
    { id: 'copilot', name: 'Copilot', bin: 'gh', blurb: 'GitHub Copilot via gh-copilot extension', invoke: 'stdin', available: false, args: ['copilot', 'suggest', '-t', 'shell'] },
    { id: 'hermes', name: 'Hermes', bin: 'hermes', blurb: 'Nous Research Hermes CLI', invoke: 'stdin', available: false },
    { id: 'kimi', name: 'Kimi', bin: 'kimi', blurb: 'Moonshot Kimi CLI', invoke: 'stdin', available: false },
    { id: 'pi', name: 'Pi', bin: 'pi', blurb: 'Inflection Pi CLI', invoke: 'stdin', available: false },
    // Kiro CLI: `kiro chat -` — the trailing `-` means read prompt from stdin
    // Works with both `kiro` (if command router is set to CLI) and `kiro-cli`
    { id: 'kiro', name: 'Kiro', bin: 'kiro-cli', blurb: 'Kiro coding agent CLI', invoke: 'stdin', available: false, args: ['chat', '-'] },
];
function whichSync(bin) {
    const isWin = process.platform === 'win32';
    const exts = isWin ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';') : [''];
    const sep = isWin ? ';' : ':';
    const dirs = (process.env.PATH || '').split(sep).filter(Boolean);
    // On Windows, also check well-known install locations for CLI agents
    if (isWin) {
        const localAppData = process.env.LOCALAPPDATA || '';
        if (localAppData) {
            // Cursor Agent installs to %LOCALAPPDATA%\cursor-agent\versions\dist-package\
            dirs.push(path.join(localAppData, 'cursor-agent', 'versions', 'dist-package'));
            // Kiro CLI may be in %LOCALAPPDATA%\Kiro-Cli\ or %LOCALAPPDATA%\kiro-cli\
            dirs.push(path.join(localAppData, 'Kiro-Cli'));
            dirs.push(path.join(localAppData, 'Programs', 'kiro-cli'));
        }
        const userProfile = process.env.USERPROFILE || '';
        if (userProfile) {
            // ~/.local/bin is common for CLI tools installed via curl scripts
            dirs.push(path.join(userProfile, '.local', 'bin'));
        }
        // Kiro CLI installs to C:\Program Files\Kiro-Cli\
        const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
        dirs.push(path.join(programFiles, 'Kiro-Cli'));
        dirs.push(path.join(programFiles, 'Kiro-Cli', 'bin'));
    }
    for (const dir of dirs) {
        for (const ext of exts) {
            const candidate = path.join(dir, bin + ext.toLowerCase());
            if (existsSync(candidate))
                return candidate;
            if (isWin) {
                const candidateUp = path.join(dir, bin + ext.toUpperCase());
                if (existsSync(candidateUp))
                    return candidateUp;
            }
        }
    }
    return null;
}
let cache = null;
export function detectAgents(force = false) {
    if (cache && !force)
        return cache;
    cache = KNOWN.map((rec) => {
        const found = whichSync(rec.bin);
        if (found)
            return { ...rec, available: true, resolvedPath: found };
        return { ...rec, available: false };
    });
    return cache;
}
const live = new Map();
const CHAT_EVENT = 'renoir:chat:event';
function broadcast(payload) {
    for (const w of BrowserWindow.getAllWindows()) {
        if (!w.isDestroyed())
            w.webContents.send(CHAT_EVENT, payload);
    }
}
export function invokeAgent(req) {
    const list = detectAgents();
    const rec = list.find((r) => r.id === req.agentId);
    if (!rec || !rec.available || !rec.resolvedPath) {
        return { ok: false, error: `Agent "${req.agentId}" not on PATH` };
    }
    const args = [...(rec.args || [])];
    if (rec.invoke === 'arg') {
        // Prompt is appended as the final positional argument
        args.push(req.prompt);
    }
    else if (rec.invoke === 'flag') {
        args.push('--prompt', req.prompt);
    }
    // For 'stdin' mode, prompt is written to stdin below
    // On Windows, .cmd/.bat scripts need shell mode to execute. Direct .exe
    // binaries must NOT use shell mode because paths with spaces (e.g.
    // "C:\Program Files\...") get split by cmd.exe.
    const needsShell = process.platform === 'win32'
        && /\.(cmd|bat)$/i.test(rec.resolvedPath);
    // When using shell mode, quote the executable path to handle spaces.
    // When NOT using shell mode, spawn handles paths with spaces natively.
    const executable = needsShell ? `"${rec.resolvedPath}"` : rec.resolvedPath;
    // Build a clean env: suppress colors/interactive prompts from CLI agents.
    // Remove FORCE_COLOR if present (conflicts with NO_COLOR).
    const childEnv = { ...process.env, NO_COLOR: '1', TERM: 'dumb' };
    delete childEnv.FORCE_COLOR;
    const child = spawn(executable, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: childEnv,
        shell: needsShell,
        // windowsVerbatimArguments prevents Node from mangling quotes on Windows
        // when shell mode is off.
        windowsVerbatimArguments: !needsShell && process.platform === 'win32',
    });
    live.set(req.conversationId, child);
    if (rec.invoke === 'stdin') {
        try {
            child.stdin.write(req.prompt + '\n');
        }
        catch { /* swallow */ }
        try {
            child.stdin.end();
        }
        catch { /* swallow */ }
    }
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
        broadcast({ type: 'delta', conversationId: req.conversationId, text: chunk });
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
        // Forward stderr as a delta — most CLI agents use it for status lines.
        broadcast({ type: 'delta', conversationId: req.conversationId, text: chunk });
    });
    child.on('error', (err) => {
        broadcast({ type: 'error', conversationId: req.conversationId, message: err.message });
        live.delete(req.conversationId);
    });
    child.on('close', (code) => {
        broadcast({
            type: 'done',
            conversationId: req.conversationId,
            finishReason: code === 0 ? 'stop' : `exit ${code}`,
        });
        live.delete(req.conversationId);
    });
    return { ok: true };
}
export function cancelAgent(conversationId) {
    const child = live.get(conversationId);
    if (!child)
        return false;
    try {
        child.kill();
    }
    catch { /* swallow */ }
    live.delete(conversationId);
    return true;
}
