document.addEventListener('DOMContentLoaded', function() {
    const livePreviewBtn = document.getElementById('live-preview-btn');
    const exportBtn = document.getElementById('export-btn');
    const previewContainer = document.getElementById('preview-container');
    const previewFrame = document.getElementById('preview-frame');
    let currentHtmlFile = null;

    livePreviewBtn.addEventListener('click', function() {
        if (previewContainer.style.display === 'none' || !previewContainer.style.display) {
            previewContainer.style.display = 'flex';
            livePreviewBtn.textContent = 'Hide Preview';
            updatePreview();
        } else {
            previewContainer.style.display = 'none';
            livePreviewBtn.textContent = 'Live Preview';
        }
    });

    function updatePreview() {
        const filePath = window.getCurrentFilePath();
        if (currentHtmlFile && filePath && previewContainer.style.display === 'flex') {
            const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
            let htmlContent = getEditorContent();
            const baseTag = `<base href="file://${dirPath}/">`;

            if (htmlContent.includes('<head>')) {
                htmlContent = htmlContent.replace('<head>', `<head>\n    ${baseTag}`);
            } else {
                htmlContent = `<head>\n    ${baseTag}\n</head>\n` + htmlContent;
            }

            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            previewFrame.src = url;
            
            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 1000);
        }
    }

    exportBtn.addEventListener('click', function() {
        if (currentHtmlFile) {
            const htmlContent = getEditorContent();
            const filePath = window.getCurrentFilePath();
            window.electronAPI.exportToBrowser(htmlContent, filePath);
        }
    });

    function updateLivePreviewButton(filename) {
        currentHtmlFile = filename;
        if (filename && filename.endsWith('.html')) {
            livePreviewBtn.style.display = 'block';
        }
        else {
            livePreviewBtn.style.display = 'none';
            previewContainer.style.display = 'none';
            livePreviewBtn.textContent = 'Live Preview';
        }
    }

    let isResizingPreview = false;
    const resizeHandle = previewContainer.previousElementSibling;

    resizeHandle.addEventListener('mousedown', function(e) {
        isResizingPreview = true;
        e.preventDefault();
    });

    document.addEventListener('mousemove', function(e) {
        if (!isResizingPreview) return;
        const containerRect = document.querySelector('.horizontal-split').getBoundingClientRect();
        const newWidth = containerRect.right - e.clientX;
        if (newWidth > 200 && newWidth < window.innerWidth - 400) {
            previewContainer.style.width = `${newWidth}px`;
        }
    });

    document.addEventListener('mouseup', function(e) {
        if (isResizingPreview) {
            isResizingPreview = false;
        }
    });

    window.livePreviewAPI = {
        updateLivePreviewButton,
        updatePreview
    };
});
