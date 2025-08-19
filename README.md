# Element-IDE: A Lightweight, Cross-Platform Code Editor
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
Element-IDE is a lightweight, cross-platform code editor built from the ground up with Electron. It's designed for developers who need a simple but effective tool for writing, running, and linting Python code without the overhead of a full-scale IDE. It bundles a file explorer, the powerful Monaco editor, live code output, and an integrated terminal into a single, cohesive application.

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

<img width="1624" height="974" alt="testimage4" src="https://github.com/user-attachments/assets/fb0adc58-15c8-437c-aa41-f61f79a7a25f" />
<img width="1312" height="912" alt="testimage3" src="https://github.com/user-attachments/assets/2f8e91df-8c1e-470a-9aa4-8c46793c5612" />
<img width="1312" height="912" alt="testimage2" src="https://github.com/user-attachments/assets/e49a54c3-d756-4136-8449-404054b58d47" />
<img width="1312" height="912" alt="testimage" src="https://github.com/user-attachments/assets/7b976580-a44f-475c-8263-5e0702446dd6" />

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

## Development

To set up the development environment and run the application in development mode, follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Fatcatcreate/IDE.git
    cd IDE
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run in development mode:**
    ```bash
    npm run dev
    ```
    This will start the application with the Chromium developer tools enabled.

---

## Usage
### Running the Application
To launch the IDE in development mode:

```bash
npm run dev
```
This starts the application with access to the Chromium developer tools, available under the "View" menu.

### Basic Workflow
1.  **Open a Folder:** Use the "Open Folder" icon to load your project directory into the file explorer.
2.  **Edit Code:** Select a file to open it in the Monaco editor.
3.  **Run Code:** Press the "Run" button or `F5` to execute the current file. Output appears in the "Output" panel.
4.  **Lint Code:** With a Python file open, click "Lint" to analyze the code for issues.
5.  **Use the Terminal:** The "Terminal" tab provides a shell session that starts in your project's root directory.

---

## How It Works: An Architectural Deep-Dive

This IDE is built on Electron, which allows us to create a cross-platform desktop application using web technologies. The application is split into two main processes, a security best practice that ensures our application is robust and secure.

### The Main Process (`main.js`)

The Main process is the backbone of the application. It runs in a Node.js environment, which means it has full access to the operating system's resources. This is where all the "heavy lifting" happens:

*   **Window Management:** The Main process is responsible for creating and managing the application's windows using Electron's `BrowserWindow` module.
*   **File System Operations:** All interactions with the file system, such as reading, writing, and deleting files, are handled by the Main process using the `fs-extra` module. This is a critical security measure that prevents the user-facing part of the application from having direct access to the file system.
*   **Code Execution and Terminal:** The Main process spawns child processes to run user code and to create the integrated terminal. This is done using the `child_process` and `node-pty` modules.

### The Renderer Process (`renderer.js`, `editor.js`, etc.)

The Renderer process is the user-facing part of the application. It's essentially a sandboxed web page that runs in a Chromium browser environment. This is where all the UI is rendered and where user interactions are handled.

For security reasons, the Renderer process does not have direct access to Node.js or the file system. This is a key security feature of Electron that prevents malicious code from accessing the user's system.

### The Preload Script (`preload.js`)

So, how do the Main and Renderer processes communicate? That's where the Preload script comes in. The Preload script is a special script that runs in a privileged environment before the Renderer process is loaded. It has access to both the `window` object of the Renderer process and the Node.js environment of the Main process.

We use the `contextBridge` module to securely expose a well-defined API from the Main process to the Renderer process. This API, which we call `electronAPI`, acts as a secure bridge between the two processes, allowing the Renderer to request services from the Main process without gaining arbitrary access to it.

### Feature Implementation Details

Here's a closer look at how some of the key features are implemented:

*   **Code Execution Engine:**
    1.  When you click the "Run" button, the Renderer process gets the code from the Monaco editor.
    2.  It then uses the `electronAPI` to send the code to the Main process.
    3.  The Main process writes the code to a temporary file and then spawns a child process to execute it.
    4.  The output of the child process is then piped back to the Renderer process and displayed in the output panel.

*   **Integrated Pseudo-Terminal:**
    1.  The terminal is implemented using the `node-pty` library, which provides a pseudo-terminal interface.
    2.  When you open a new terminal, the Renderer process sends a request to the Main process.
    3.  The Main process then spawns a new `pty` process, which in turn launches your default shell (e.g., `bash`, `zsh`, `powershell`).
    4.  A two-way communication channel is then established between the Renderer and the `pty` process, allowing you to interact with the shell as if you were using a native terminal.

*   **Live HTML Preview:**
    1.  When you open an HTML file, the editor listens for changes to the content.
    2.  On each change, the Renderer process injects a `<base>` tag into the HTML, which is a neat trick that forces the browser to resolve relative paths for CSS and JavaScript files correctly.
    3.  The modified HTML is then rendered in an `<iframe>` in the live preview panel.

---

## Building for Distribution

You can build a distributable version of the application for macOS, Windows, or Linux using `electron-builder`.

### macOS

To create a build for macOS, run:

```bash
npm run build -- --mac
```

This will generate a `.dmg` file in the `dist` directory.

### Linux

To create a build for Linux, run:

```bash
npm run build -- --linux
```

This will generate an `AppImage` file in the `dist` directory.

### Windows

To create a build for Windows, run:

```bash
npm run build -- --win --x64
```

This will generate an `.exe` installer in the `dist` directory.

**Note for Windows users:** The integrated terminal feature is currently not working in the Windows version of the application due to a known issue with the `node-pty` package. All other features are functional.



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

---

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue.

### Known Issues

*   **Windows Terminal:** The integrated terminal feature is currently not working on Windows due to a known issue with the `node-pty` package. Any help in resolving this issue would be greatly appreciated.
