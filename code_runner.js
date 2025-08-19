const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const languageConfig = require('./language_config');

let isRunning = false;
let currentProcess = null;

function runCode(code = null, filePath = null) {
    if (isRunning) {
        addOutput('A process is already running. Please wait or stop the current process.', 'warning');
        return;
    }

    const codeToRun = code || getEditorContent();
    
    if (!codeToRun.trim()) {
        addOutput('No code to run.', 'warning');
        return;
    }

    const extension = path.extname(filePath || '');
    const language = Object.keys(languageConfig).find(lang => languageConfig[lang].extensions.includes(extension));

    if (!language) {
        addOutput(`Unsupported file type: ${extension}`, 'error');
        return;
    }

    const config = languageConfig[language];

    switchToTab('output');
    
    addOutput(`Running ${language} code...`, 'info');
    addOutput('─'.repeat(50), 'info');
    
    updateStatus('Running...', true);
    
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `code_runner_temp_${Date.now()}${config.extensions[0]}`);
    
    try {
        fs.writeFileSync(tempFile, codeToRun);
        
        currentProcess = spawn(config.command, [tempFile], {
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: process.platform === 'win32'
        });
        
        isRunning = true;
        
        currentProcess.stdout.on('data', (data) => {
            addOutput(data.toString(), 'success');
        });
        
        currentProcess.stderr.on('data', (data) => {
            addOutput(data.toString(), 'error');
        });
        
        currentProcess.on('close', (code) => {
            isRunning = false;
            currentProcess = null;
            
            try {
                fs.unlinkSync(tempFile);
            } catch (e) {
                console.log('Failed to clean up temp file:', e);
            }
            
            addOutput('─'.repeat(50), 'info');
            
            if (code === 0) {
                addOutput(`Process finished with exit code ${code}`, 'success');
                updateStatus('Execution completed successfully');
            } else {
                addOutput(`Process finished with exit code ${code}`, 'error');
                updateStatus('Execution failed');
            }
        });
        
        currentProcess.on('error', (error) => {
            isRunning = false;
            currentProcess = null;
            
            try {
                fs.unlinkSync(tempFile);
            } catch (e) {
                console.log('Failed to clean up temp file:', e);
            }
            
            addOutput(`Failed to start process: ${error.message}`, 'error');
            
            if (error.code === 'ENOENT') {
                addOutput(`${config.command} is not installed or not in PATH.`, 'error');
                addOutput(`Please install ${config.command} and make sure it\'s in your system PATH.`, 'error');
            }
            
            updateStatus('Execution failed');
        });
        
        setTimeout(() => {
            if (isRunning && currentProcess) {
                addOutput('Process is taking too long. You can stop it manually if needed.', 'warning');
            }
        }, 30000);
        
    } catch (error) {
        addOutput(`Failed to create temporary file: ${error.message}`, 'error');
        updateStatus('Execution failed');
        isRunning = false;
    }
}

function stopCode() {
    if (isRunning && currentProcess) {
        currentProcess.kill('SIGTERM');
        addOutput('Process stopped by user.', 'warning');
        updateStatus('Process stopped');
        isRunning = false;
        currentProcess = null;
    }
}

function getPythonCommand() {
    const commands = process.platform === 'win32' 
        ? ['python', 'python3', 'py'] 
        : ['python3', 'python'];
    
    return commands[0];
}

function runInteractiveCode(code) {
    if (isRunning) {
        addOutput('A process is already running. Please wait or stop the current process.', 'warning');
        return;
    }

    switchToTab('output');
    
    updateStatus('Starting interactive Python...', true);
    
    try {
        const pythonCmd = getPythonCommand();
        currentProcess = spawn(pythonCmd, ['-i'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: process.platform === 'win32'
        });
        
        isRunning = true;
        
        currentProcess.stdin.write(code + '\n');
        
        currentProcess.stdout.on('data', (data) => {
            addOutput(data.toString(), 'success');
        });
        
        currentProcess.stderr.on('data', (data) => {
            addOutput(data.toString(), 'error');
        });
        
        currentProcess.on('close', (code) => {
            isRunning = false;
            currentProcess = null;
            addOutput(`Interactive session ended with code ${code}`, 'info');
            updateStatus('Interactive session ended');
        });
        
        currentProcess.on('error', (error) => {
            isRunning = false;
            currentProcess = null;
            addOutput(`Failed to start interactive Python: ${error.message}`, 'error');
            updateStatus('Failed to start interactive session');
        });
        
    } catch (error) {
        addOutput(`Failed to start interactive Python: ${error.message}`, 'error');
        updateStatus('Failed to start interactive session');
        isRunning = false;
    }
}

function sendInput(input) {
    if (isRunning && currentProcess) {
        currentProcess.stdin.write(input + '\n');
    }
}

function addOutput(text, type = 'info') {
    const outputElement = document.getElementById('panel-output');
    if (outputElement) {
        const lines = text.split('\n');
        lines.forEach(line => {
            if (line.trim() || lines.length === 1) {
                const div = document.createElement('div');
                div.className = `output-line ${type}`;
                div.textContent = line;
                outputElement.appendChild(div);
            }
        });
        
        outputElement.scrollTop = outputElement.scrollHeight;
    }
}

function clearOutput() {
    const outputElement = document.getElementById('panel-output');
    if (outputElement) {
        outputElement.innerHTML = '<div class="output-line info">Output cleared.</div>';
    }
}

function updateStatus(message, loading = false) {
    const statusElement = document.getElementById('status-text');
    if (statusElement) {
        statusElement.textContent = message;
    }
    
    const container = document.querySelector('.container');
    if (container) {
        if (loading) {
            container.classList.add('loading');
        } else {
            container.classList.remove('loading');
        }
    }
}

function switchToTab(tabName) {
    document.querySelectorAll('.panel-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.panel-content').forEach(panel => {
        panel.classList.add('hidden');
    });
    
    const selectedTab = document.getElementById(`tab-${tabName}`);
    const selectedPanel = document.getElementById(`panel-${tabName}`);
    
    if (selectedTab && selectedPanel) {
        selectedTab.classList.add('active');
        selectedPanel.classList.remove('hidden');
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runCode,
        stopCode,
        runInteractiveCode,
        sendInput,
        addOutput,
        clearOutput,
        updateStatus,
        switchToTab
    };
}