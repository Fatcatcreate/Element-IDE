# Electron Python IDE: A Lightweight, Cross-Platform Code Editor
*Edit, Run, and Lint Python Code in a Modern Environment*

---

## Table of Contents
- [Introduction](#introduction)
- [Key Features](#key-features)
- [Screenshots](#screenshots)
- [Installation](#installation)
- [Usage](#usage)
- [Architectural Deep Dive: How It Works](#architectural-deep-dive-how-it-works)
- [Building for Distribution](#building-for-distribution)
- [Technologies Used](#technologies-used)
- [Future Improvements](#future-improvements)

---

## Introduction
Electron Python IDE is a lightweight, cross-platform code editor built from the ground up with Electron. It's designed for developers who need a simple but effective tool for writing, running, and linting Python code without the overhead of a full-scale IDE. It bundles a file explorer, the powerful Monaco editor, live code output, and an integrated terminal into a single, cohesive application.

The project's motivation was to create a self-contained development environment that streamlines the workflow for quick scripts and smaller projects, removing the need to juggle a separate editor, terminal, and file manager.

---

## Key Features
- **File Explorer:** Browse and manage your project's file system with support for creating, renaming, and deleting files and directories.
- **Powerful Code Editor:** At its core is the Monaco Editor—the same engine that powers VS Code—providing excellent syntax highlighting, automatic layout, and a fluid editing experience for Python, JavaScript, HTML, and CSS.
- **Code Execution:** Instantly run Python and JavaScript files and see live results in the output panel.
- **Live HTML Preview:** Get immediate feedback on web projects with a live preview panel that renders changes to HTML, CSS, and JavaScript as you type.
- **Integrated Terminal:** A fully-functional pseudo-terminal is built-in, giving you shell access to manage packages, run commands, and interact with your system directly within the IDE.
- **Python Linting:** On-demand code analysis for Python files helps catch errors and enforce style consistency, with problems clearly listed in a dedicated panel.
- **Resizable Interface:** A flexible UI with draggable panels lets you customize your workspace to fit your needs.

---

## Screenshots
![Screenshot 1](testimage.png)
![Screenshot 2](testimage2.png)
![Screenshot 3](testimage3.png)
![Screenshot 4](testimage4.png)

---

## Installation
To get the project running locally, follow these steps:

```bash
# Clone the repository
git clone https://github.com/Fatcatcreate/IDE.git
cd IDE

# Install all dependencies
npm install
```
Running `npm install` also executes the `postinstall` script (`electron-builder install-app-deps`). This step is vital because it rebuilds native Node.js modules, like `node-pty` for the terminal, against the specific Node.js version bundled with Electron. This ensures that all components, especially the terminal, function correctly in the packaged application.

---

## Usage
### Running the Application
To launch the IDE in development mode:

```bash
npm start
```
This starts the application with access to the Chromium developer tools, available under the "View" menu.

### Basic Workflow
1.  **Open a Folder:** Use the "Open Folder" icon to load your project directory into the file explorer.
2.  **Edit Code:** Select a file to open it in the Monaco editor.
3.  **Run Code:** Press the "Run" button or `F5` to execute the current file. Output appears in the "Output" panel.
4.  **Lint Code:** With a Python file open, click "Lint" to analyze the code for issues.
5.  **Use the Terminal:** The "Terminal" tab provides a shell session that starts in your project's root directory.

---

## Architectural Deep Dive: How It Works
The IDE's design leverages Electron's core multi-process architecture to ensure security and a responsive UI. The application is split into a backend (Main Process) and a frontend (Renderer Process), which communicate securely.

-   **Main Process (`main.js`):** This is the application's Node.js backend. It has full OS access and is responsible for all privileged operations: creating and managing windows (`BrowserWindow`), handling all file system I/O using `fs-extra`, and spawning child processes for code execution and the terminal. Keeping this logic out of the frontend is a key security measure.

-   **Renderer Process (`renderer.js`, `editor.js`):** This is the sandboxed frontend, handling all aspects of the user interface. It runs in a standard Chromium browser environment with no direct access to Node.js or the file system, preventing security risks.

-   **Preload Script (`preload.js`):** This script is the secure bridge between the two processes. It uses Electron's `contextBridge` to expose a well-defined API from the main process to the renderer. This prevents the renderer from gaining arbitrary access to the main process, enforcing the principle of least privilege.

### Feature Implementation Details

-   **Code Execution Engine:**
    1.  When a user triggers a run, the renderer grabs the current code from Monaco.
    2.  It uses the `electronAPI` (exposed by the preload script) to send the code to the main process.
    3.  The main process writes the code to a temporary file in the system's temp directory (`os.tmpdir()`). This avoids needing to save the file to run it and keeps the execution self-contained.
    4.  A child process is spawned using `child_process.spawn`, with the command (`python` or `node`) chosen based on the file's extension.
    5.  The `cwd` (current working directory) of the new process is explicitly set to the directory of the file being edited. This is critical for ensuring that any relative paths in the user's code (e.g., `open('data.txt')`) resolve as expected.
    6.  The `stdout` and `stderr` streams from the child process are piped back to the renderer via IPC and displayed with distinct styling.
    7.  After execution, the temporary file is deleted to ensure no artifacts are left behind.

-   **Integrated Pseudo-Terminal:**
    1.  The terminal is implemented with `node-pty`, a library that emulates a native terminal, allowing for a fully interactive shell.
    2.  When a new terminal is requested, the renderer sends an IPC message with the current working directory.
    3.  The main process then spawns a `pty` process, launching the user's default shell (`bash`, `zsh`, `powershell`, etc.).
    4.  A two-way communication channel is established:
        -   **Output:** The `pty` process's data stream is captured in the main process and relayed to the renderer to be written to the terminal UI.
        -   **Input:** User input from the terminal UI is sent to the main process, which writes it directly to the `pty` process's input stream.
    5.  This architecture creates a true, stateful shell, not just a simple command-and-response executor.

-   **Live HTML Preview:**
    1.  When an HTML file is active, the editor listens for content changes via `editor.onDidChangeModelContent`.
    2.  On each change, the renderer's JavaScript dynamically injects a `<base>` tag into the HTML content. The `href` of this tag is set to the local file path of the document (e.g., `file:///path/to/your/project/`). This is a key step that forces the browser to resolve relative links for CSS, JS, or images from the correct directory.
    3.  The modified HTML is then converted into a `Blob`, and a temporary `Blob URL` is generated via `URL.createObjectURL`.
    4.  This URL is set as the `src` for an `<iframe>`, which securely renders the content in a sandboxed context, isolated from the rest of the application.

---

## Building for Distribution
You can build a distributable version of the application for macOS, Windows, or Linux using `electron-builder`.

To create a build for your current operating system, run:
```bash
npm run build
```
The packaged application will be available in the `dist` directory.

---

## Technologies Used
- **Electron:** The core framework for building the cross-platform desktop application.
- **Node.js:** Provides the backend environment for file system operations and process management.
- **Monaco Editor:** The code editor that powers the IDE, providing a rich, VS Code-like editing experience.
- **`node-pty`:** Enables the creation of a pseudo-terminal for the integrated terminal feature.
- **`fs-extra`:** Used for robust file system operations.
- **`electron-builder`:** The tool used for packaging and distributing the application.

---

## Future Improvements
- **Debugger Integration:** Add a step-by-step debugger for Python code.
- **Git Integration:** Include a source control panel to manage Git repositories directly within the IDE.
- **Themes and Customization:** Allow users to customize the editor theme and overall appearance.
- **Plugin System:** Develop a plugin architecture to allow for community-developed extensions and features.
- **Enhanced Language Support:** Improve support for other languages with features like IntelliSense and code completion.
