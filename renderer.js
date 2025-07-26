let currentProject = null;
let currentExplorerPath = null;
let fileExplorerData = [];
let currentTerminalId = null;
// Add these variables at the top of renderer.js

let contextMenu = null;
let contextMenuTarget = null;


// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    contextMenu = document.getElementById('context-menu');
    setupEventListeners();
    setupMenuEventListeners();
    initializeResizablePanels();
    setupTabSwitching();
    initializeTheme();
    console.log('Python IDE initialized');


    // Hide context menu on click outside
    window.addEventListener('click', () => {
        hideContextMenu();
    });
});

function setupEventListeners() {
    // Toolbar buttons
    document.getElementById('new-file').addEventListener('click', newFile);
    document.getElementById('save-file').addEventListener('click', saveFile);
    document.getElementById('run-code').addEventListener('click', () => runCode());
    document.getElementById('lint-code').addEventListener('click', () => lintCode());
    document.getElementById('clear-output').addEventListener('click', clearOutput);
    document.getElementById('open-folder').addEventListener('click', openFolder);
    document.getElementById('back-button').addEventListener('click', goBack);
    document.getElementById('new-terminal').addEventListener('click', createNewTerminal);
    document.getElementById('terminal-input').addEventListener('keydown', handleTerminalInput);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Window events
    window.addEventListener('beforeunload', handleBeforeUnload);
}

function setupMenuEventListeners() {
    // Menu event listeners from main process (only if electronAPI exists)
    if (window.electronAPI) {
        window.electronAPI.onNewFile(() => newFile());
        window.electronAPI.onSaveFile(() => saveFile());
        window.electronAPI.onSaveAs(() => saveAs());
        window.electronAPI.onRunCode(() => runCode());
        window.electronAPI.onLintCode(() => lintCode());
        window.electronAPI.onFileOpened((event, data) => {
            openFileFromPath(data.path, data.content);
        });
        
        // ADD THIS NEW LISTENER FOR FILE SAVED EVENT
        window.electronAPI.onFileSaved((event, data) => {
            handleFileSaved(data.filePath, data.dirPath);
        });

        window.electronAPI.onTerminalOutput((event, data) => {
            if (data.id === currentTerminalId) {
                appendToTerminal(data.data, 'output');
            }
        });
        
        window.electronAPI.onTerminalError((event, data) => {
            if (data.id === currentTerminalId) {
                appendToTerminal(data.data, 'error');
            }
        });
        
        window.electronAPI.onTerminalClosed((event, data) => {
            if (data.id === currentTerminalId) {
                appendToTerminal(`Terminal closed (exit code: ${data.code})\n`, 'info');
                currentTerminalId = null;
            }
        });
    }
}

// ADD THIS NEW FUNCTION to handle file saved event
async function handleFileSaved(filePath, dirPath) {
    // Only refresh if the saved file is in the current project directory
    if (currentProject && dirPath.startsWith(currentProject)) {
        // Refresh the file explorer to show the new/updated file
        await refreshFileExplorer();
        updateStatus(`File saved: ${getBasename(filePath)}`);
    }
}

// ADD THIS NEW FUNCTION to refresh the file explorer
async function refreshFileExplorer() {
    if (currentProject) {
        await loadFileExplorer(currentProject);
    }
}

function setupTabSwitching() {
    document.getElementById('tab-output').addEventListener('click', () => switchToTab('output'));
    document.getElementById('tab-problems').addEventListener('click', () => switchToTab('problems'));
    document.getElementById('tab-terminal').addEventListener('click', () => switchToTab('terminal'));
}

function handleKeyboardShortcuts(event) {
    // Handle keyboard shortcuts that aren't handled by Monaco
    if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
            case 'n':
                event.preventDefault();
                newFile();
                break;
            case 'o':
                event.preventDefault();
                // File opening is handled by main process
                break;
            case '`':
              if (event.ctrlKey) {
                event.preventDefault();
                switchToTab('terminal');
              }
              break;
        }
    }
    
    if (event.key === 'F5') {
        event.preventDefault();
        runCode();
    }
}

function handleBeforeUnload(event) {
    if (isModified()) {
        event.preventDefault();
        event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return event.returnValue;
    }
}

// File operations
function newFile() {
    if (isModified()) {
        const save = confirm('You have unsaved changes. Do you want to save first?');
        if (save) {
            saveFile();
        }
    }
    
    setEditorContent(`# New Python file\n# Write your code here\n# When you save this you can save this as any file type you want by changing the file extension on Save As\n# For example, you can save this as a .py file \n\ndef main():\n    print("Hello, World!")\n\nif __name__ == "__main__":\n    main()\n`);
    
    setCurrentFilePath(null);
    updateStatus('New file created');
    focusEditor();
}

async function saveFile() {
    const currentPath = getCurrentFilePath();
    const content = getEditorContent();
    
    if (!window.electronAPI) {
        // Fallback for non-electron environment
        updateStatus('Save functionality requires Electron environment');
        return;
    }
    
    if (currentPath) {
        // Save to existing file
        const result = await window.electronAPI.saveFile(currentPath, content);
        if (result.success) {
            markAsSaved();
            updateStatus('File saved successfully');
            // File explorer will be refreshed via the 'file-saved' event from main process
        } else {
            updateStatus('Failed to save file: ' + result.error);
        }
    } else {
        // Save as new file
        saveAs();
    }
}

async function saveAs() {
    const content = getEditorContent();
    
    if (!window.electronAPI) {
        // Fallback for non-electron environment
        updateStatus('Save functionality requires Electron environment');
        return;
    }
    
    const result = await window.electronAPI.saveFileAs(content);
    
    if (result.success && !result.canceled) {
        setCurrentFilePath(result.path);
        markAsSaved();
        updateStatus('File saved successfully');
        // File explorer will be refreshed via the 'file-saved' event from main process
    } else if (result.error) {
        updateStatus('Failed to save file: ' + result.error);
    }
}
async function openFolder() {
    if (!window.electronAPI) {
        // Fallback for non-electron environment
        updateStatus('File system access requires Electron environment');
        return;
    }
    
    const result = await window.electronAPI.selectFolder();
    if (result.success) {
        currentProject = result.path;
        await loadFileExplorer(result.path);
        updateStatus(`Opened folder: ${result.path}`);
    }
}

async function loadFileExplorer(folderPath) {
    currentExplorerPath = folderPath;
    const backButton = document.getElementById('back-button');
    if (folderPath !== currentProject) {
        backButton.style.display = 'inline-block';
    } else {
        backButton.style.display = 'none';
    }

    const explorerElement = document.getElementById('file-explorer');
    explorerElement.innerHTML = '<div class="file-item"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
    
    try {
        const items = await window.electronAPI.readDirectory(folderPath);
        fileExplorerData = items;
        renderFileExplorer(items);
    } catch (error) {
        explorerElement.innerHTML = '<div class="file-item"><i class="fas fa-exclamation-triangle"></i> Failed to load folder</div>';
    }
}

function renderFileExplorer(items) {
    const explorerElement = document.getElementById('file-explorer');
    explorerElement.innerHTML = '';

    if (items.length === 0) {
        explorerElement.innerHTML = '<div class="file-item"><i class="fas fa-folder-open"></i> Empty folder</div>';
        return;
    }

    // Sort items: directories first, then files
    const sortedItems = items.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
    });

    sortedItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.setAttribute('data-path', item.path);

        const iconClass = item.isDirectory ? 'fas fa-folder' : (item.name.endsWith('.py') ? 'fab fa-python' : 'fas fa-file');
        const icon = `<i class="${iconClass}"></i>`;
        const name = `<span>${item.name}</span>`;
        const menuBtn = `<button class="file-item-menu-btn"><i class="fas fa-ellipsis-v"></i></button>`;

        div.innerHTML = `${icon} ${name} ${menuBtn}`;

        if (item.isDirectory) {
            div.classList.add('folder');
            div.addEventListener('click', () => loadFileExplorer(item.path));
        } else {
            if (item.name.endsWith('.py')) {
                div.classList.add('python');
            }
            div.addEventListener('click', () => openFileFromExplorer(item.path));
        }

        div.querySelector('.file-item-menu-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            showContextMenu(e.target, item.path);
        });

        explorerElement.appendChild(div);
    });
}

function showContextMenu(target, filePath) {
    contextMenuTarget = filePath;
    const rect = target.getBoundingClientRect();
    contextMenu.style.display = 'block';
    contextMenu.style.left = `${rect.right}px`;
    contextMenu.style.top = `${rect.top}px`;

    document.getElementById('rename-file-btn').onclick = () => {
        hideContextMenu();
        renameFile(contextMenuTarget);
    };

    document.getElementById('delete-file-btn').onclick = () => {
        hideContextMenu();
        deleteFile(contextMenuTarget);
    };
}

function hideContextMenu() {
    if (contextMenu) {
        contextMenu.style.display = 'none';
    }
}

function getBasename(path) {
    if (!path) return '';
    return path.split(/[\\/]/).pop();
}

function getParentPath(path) {
    if (!path) return null;
    const parts = path.split(/[\\/]/);
    if (parts.length > 1) {
        parts.pop();
        return parts.join('/');
    }
    return null;
}

function goBack() {
    if (currentExplorerPath && currentProject && currentExplorerPath !== currentProject) {
        const parentDir = getParentPath(currentExplorerPath);
        if (parentDir && parentDir.length >= currentProject.length) {
            loadFileExplorer(parentDir);
        } else {
            loadFileExplorer(currentProject);
        }
    }
}

async function renameFile(filePath) {

    const fileItem = document.querySelector(`[data-path="${filePath}"]`);
    if (!fileItem) return;

    const currentName = getBasename(filePath);
    const nameSpan = fileItem.querySelector('span');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.style.width = '100%';

    nameSpan.replaceWith(input);
    input.focus();
    input.select();

    const handleRename = async () => {
        const newName = input.value.trim();
        input.replaceWith(nameSpan); // Restore original span

        if (newName && newName !== currentName) {
            const result = await window.electronAPI.renameFile(filePath, newName);
            if (result.success) {
                updateStatus(`File renamed to ${newName}`);
                refreshFileExplorer();
            } else {
                updateStatus(`Error renaming file: ${result.error}`);
            }
        } else {
            refreshFileExplorer(); // Restore if name is unchanged or empty
        }
    };

    input.addEventListener('blur', handleRename);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            handleRename();
        } else if (e.key === 'Escape') {
            input.replaceWith(nameSpan);
            refreshFileExplorer(); // Restore on escape
        }
    });
}

async function deleteFile(filePath) {
    if (confirm(`Are you sure you want to delete ${getBasename(filePath)}?`)) {
        const result = await window.electronAPI.deleteFile(filePath);
        if (result.success) {
            updateStatus('File deleted');
            refreshFileExplorer();
        } else {
            updateStatus(`Error deleting file: ${result.error}`);
        }
    }
}

async function openFileFromExplorer(filePath) {
    try {
        const result = await window.electronAPI.readFile(filePath);
        if (result.success) {
            openFileFromPath(filePath, result.content);
        } else {
            updateStatus('Failed to open file: ' + result.error);
        }
    } catch (error) {
        updateStatus('Failed to open file: ' + error.message);
    }
}

function openFileFromPath(filePath, content) {
    if (isModified()) {
        const save = confirm('You have unsaved changes. Do you want to save first?');
        if (save) {
            saveFile();
        }
    }
    
    setEditorContent(content, getBasename(filePath));
    setCurrentFilePath(filePath);
    markAsSaved();
    updateStatus(`Opened: ${filePath}`);
    focusEditor();

    // Show/hide lint button based on file type
    const lintButton = document.getElementById('lint-code');
    if (filePath.endsWith('.py')) {
        lintButton.style.display = 'inline-block';
    } else {
        lintButton.style.display = 'none';
    }

    if (window.livePreviewAPI) {
        window.livePreviewAPI.updateLivePreviewButton(getBasename(filePath));
    }

    if (filePath.endsWith('.html')) {
        window.editorAPI.onContentDidChange(() => {
            if (window.livePreviewAPI) {
                window.livePreviewAPI.updatePreview();
            }
        });
    }
}

// Code execution and linting
async function runCode(code = null) {
    const codeToRun = code || getEditorContent();
    const currentPath = getCurrentFilePath();

    if (!currentPath) {
        switchToTab('output');
        clearOutput();
        appendToOutput('Error: Cannot determine the file type. Please save the file before running.', 'error');
        updateStatus('Error: File path not found');
        return;
    }
    
    if (!codeToRun.trim()) {
        updateStatus('No code to run');
        return;
    }
    
    if (!window.electronAPI) {
        // Fallback for non-electron environment
        appendToOutput('Code execution requires Electron environment\n', 'error');
        updateStatus('Code execution requires Electron environment');
        return;
    }
    
    // Clear previous output
    clearOutput();
    switchToTab('output');
    
    // Show running status
    updateStatus('Running code...');
    appendToOutput('Running code...\n', 'info');
    
    try {
        const result = await window.electronAPI.runCode(codeToRun, currentPath);
        
        if (result.stdout) {
            appendToOutput(result.stdout, 'success');
        }
        
        if (result.stderr) {
            appendToOutput(result.stderr, 'error');
        }
        
        if (result.error) {
            appendToOutput(`Error: ${result.error}\n`, 'error');
            updateStatus('Code execution failed');
        } else {
            updateStatus('Code executed successfully');
        }
        
        // Show exit code
        appendToOutput(`\nProcess exited with code: ${result.exitCode}\n`, 'info');
        
    } catch (error) {
        appendToOutput(`Execution error: ${error.message}\n`, 'error');
        updateStatus('Code execution failed');
    }
}

async function lintCode() {
    const code = getEditorContent();
    const currentPath = getCurrentFilePath();
    
    if (!code.trim()) {
        updateStatus('No code to lint');
        return;
    }
    
    if (!window.electronAPI) {
        // Fallback for non-electron environment
        appendToProblems('Linting requires Electron environment\n', 'error');
        updateStatus('Linting requires Electron environment');
        return;
    }
    
    // Clear previous problems
    clearProblems();
    switchToTab('problems');
    
    // Show linting status
    updateStatus('Linting Python code...');
    appendToProblems('Linting Python code...\n', 'info');
    
    try {
        const result = await window.electronAPI.lintPython(code, currentPath);
        
        if (result.success) {
            if (result.issues && result.issues.length > 0) {
                result.issues.forEach(issue => {
                    appendToProblems(`${issue.type}: Line ${issue.line}, Column ${issue.column}: ${issue.message}\n`, issue.severity);
                });
                updateStatus(`Found ${result.issues.length} linting issues`);
            } else {
                appendToProblems('No linting issues found.\n', 'success');
                updateStatus('No linting issues found');
            }
        }
        else {
            appendToProblems(`Linting error: ${result.error}\n`, 'error');
            updateStatus('Linting failed');
        }
        
    } catch (error) {
        appendToProblems(`Linting error: ${error.message}\n`, 'error');
        updateStatus('Linting failed');
    }
}

// Output and problems management
function clearOutput() {
    const outputElement = document.getElementById('panel-output');
    if (outputElement) {
        outputElement.innerHTML = '<div class="output-line info">Output cleared.</div>';
    }
}

function clearProblems() {
    const problemsElement = document.getElementById('panel-problems');
    if (problemsElement) {
        problemsElement.innerHTML = '<div class="output-line info">No problems detected.</div>';
    }
}

function appendToOutput(text, type = 'info') {
    const outputElement = document.getElementById('panel-output');
    if (outputElement) {
        const line = document.createElement('div');
        line.className = `output-line ${type}`;
        line.textContent = text;
        outputElement.appendChild(line);
        outputElement.scrollTop = outputElement.scrollHeight;
    }
}

function appendToProblems(text, type = 'info') {
    const problemsElement = document.getElementById('panel-problems');
    if (problemsElement) {
        const line = document.createElement('div');
        line.className = `output-line ${type}`;
        line.textContent = text;
        problemsElement.appendChild(line);
        problemsElement.scrollTop = problemsElement.scrollHeight;
    }
}

function switchToTab(tabName) {
    // Hide all panels
    document.getElementById('panel-output').classList.add('hidden');
    document.getElementById('panel-problems').classList.add('hidden');
    document.getElementById('panel-terminal').classList.add('hidden');

    // Remove active class from all tabs
    document.querySelectorAll('.panel-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // Show selected panel and activate tab
    document.getElementById(`panel-${tabName}`).classList.remove('hidden');
    document.getElementById(`tab-${tabName}`).classList.add('active');
}




async function createNewTerminal() {
    console.log('createNewTerminal called');
    const cwd = currentProject || '.';
    console.log('Using cwd:', cwd);

    try {
        const result = await window.electronAPI.spawnTerminal({ cwd });
        console.log('spawnTerminal result:', result);
        if (result.success) {
            currentTerminalId = result.terminalId;
            console.log('Terminal created with ID:', currentTerminalId);
            switchToTab('terminal');
            document.getElementById('terminal-output').innerHTML = '';
            appendToTerminal(`Terminal started (ID: ${currentTerminalId})\n`);
            updateStatus('Terminal started');
        } else {
            console.error('Failed to create terminal:', result);
        }
    } catch (error) {
        console.error('Error creating terminal:', error);
    }
}





async function handleTerminalInput(event) {
    console.log('handleTerminalInput called');
    if (event.key === 'Enter' && currentTerminalId) {
        console.log('Processing Enter key with terminal ID:', currentTerminalId);
        const input = event.target.value + '\n';
        console.log('Sending input:', input);
        const result = await window.electronAPI.terminalInput({ terminalId: currentTerminalId, input });
        console.log('Terminal input result:', result);
        event.target.value = '';
    } else {
        console.log('Not processing - key:', event.key, 'terminalId:', currentTerminalId);
    }
}

function appendToTerminal(data) {
    const terminalElement = document.getElementById('terminal-output');
    if (terminalElement) {
        terminalElement.innerText += data;
        terminalElement.scrollTop = terminalElement.scrollHeight;
    }
}

// Editor interface functions
window.getEditorContent = function() {
    return window.editorAPI ? window.editorAPI.getContent() : '';
}

window.setEditorContent = function(content, filename) {
    if (window.editorAPI) {
        window.editorAPI.setContent(content, filename);
    }
}

window.getCurrentFilePath = function() {
    return window.editorAPI ? window.editorAPI.getCurrentPath() : null;
}

window.setCurrentFilePath = function(path) {
    if (window.editorAPI) {
        window.editorAPI.setCurrentPath(path);
    }
}

window.isModified = function() {
    return window.editorAPI ? window.editorAPI.isModified() : false;
}

window.markAsSaved = function() {
    if (window.editorAPI) {
        window.editorAPI.markAsSaved();
    }
}

window.focusEditor = function() {
    if (window.editorAPI) {
        window.editorAPI.focus();
    }
}



function initializeResizablePanels() {
    let isResizing = false;
    let currentHandle = null;
    let startPos = 0;
    let startSize = 0;
    let targetElement = null;

    document.querySelectorAll('.resize-handle').forEach(handle => {
        handle.addEventListener('mousedown', initResize);
    });

    function initResize(e) {
        isResizing = true;
        currentHandle = e.target;
        console.log('Resize started', currentHandle.className);
        
        if (currentHandle.classList.contains('vertical-handle')) {
            startPos = e.clientX;
            targetElement = currentHandle.previousElementSibling;
            startSize = targetElement.offsetWidth;
        } else {
            startPos = e.clientY;
            targetElement = currentHandle.previousElementSibling;
            startSize = targetElement.offsetHeight;
        }
        
        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', stopResize);
        e.preventDefault();
    }

    function resize(e) {
        if (!isResizing) return;
        console.log('Resizing', targetElement.style.width, targetElement.style.height);
        
        if (currentHandle.classList.contains('vertical-handle')) {
            const newWidth = startSize + (e.clientX - startPos);
            const clampedWidth = Math.max(200, Math.min(newWidth, window.innerWidth * 0.6));
            targetElement.style.width = clampedWidth + 'px';
            targetElement.style.flexBasis = clampedWidth + 'px';
        } else {
            const newHeight = startSize + (e.clientY - startPos);
            const containerHeight = targetElement.parentElement.offsetHeight;
            const clampedHeight = Math.max(100, Math.min(newHeight, containerHeight * 0.7));
            targetElement.style.height = clampedHeight + 'px';
            targetElement.style.flexBasis = clampedHeight + 'px';
        }


    }

    function stopResize() {
        isResizing = false;
        currentHandle = null;
        targetElement = null;
        document.removeEventListener('mousemove', resize);
        document.removeEventListener('mouseup', stopResize);
    }
}





// Export functions for use in other modules
window.rendererAPI = {
    newFile,
    saveFile,
    saveAs,
    runCode,
    lintCode,
    clearOutput,
    clearProblems,
    switchToTab,
    openFolder
};

// Status bar management
function updateStatus(message) {
    const statusText = document.getElementById('status-text');
    if (statusText) {
        statusText.textContent = message;
    }
}

function initializeTheme() {
    // Example: Set a default theme
    const theme = 'dark'; // or 'light'
    document.body.className = theme === 'dark' ? 'dark-theme' : 'light-theme';
    if (window.editorAPI) {
        window.editorAPI.setTheme(theme);
    }
}
