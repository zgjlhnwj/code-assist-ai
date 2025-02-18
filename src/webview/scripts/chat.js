// 检测是否在VSCode环境中运行
/**
 * 检查当前环境是否为VSCode环境。
 * 通过尝试调用acquireVsCodeApi函数来判断，该函数仅在VSCode的Webview环境中可用。
 * 
 * @returns {boolean} 如果当前环境是VSCode环境，则返回true；否则返回false。
 */
function isInVSCode() {
    try {
        // 尝试调用acquireVsCodeApi函数
        // 若调用成功，说明当前环境是VSCode环境
        acquireVsCodeApi();
        return true;
    } catch (e) {
        // 若调用失败，捕获异常并返回false，说明当前环境不是VSCode环境
        return false;
    }
}

// 如果不在VSCode中，设置默认样式变量
if (!isInVSCode()) {
    document.documentElement.style.setProperty('--vscode-editor-background', '#1e1e1e');
    document.documentElement.style.setProperty('--vscode-editor-foreground', '#d4d4d4');
    document.documentElement.style.setProperty('--vscode-button-background', '#0e639c');
    document.documentElement.style.setProperty('--vscode-button-foreground', '#ffffff');
    document.documentElement.style.setProperty('--vscode-button-hoverBackground', '#1177bb');
    document.documentElement.style.setProperty('--vscode-input-background', '#3c3c3c');
    document.documentElement.style.setProperty('--vscode-input-foreground', '#cccccc');
    document.documentElement.style.setProperty('--vscode-input-border', '#3c3c3c');
    document.documentElement.style.setProperty('--vscode-scrollbarSlider-background', 'rgba(121, 121, 121, 0.4)');
    document.documentElement.style.setProperty('--vscode-scrollbarSlider-hoverBackground', 'rgba(100, 100, 100, 0.7)');
    document.documentElement.style.setProperty('--vscode-scrollbarSlider-activeBackground', 'rgba(191, 191, 191, 0.4)');
    document.documentElement.style.setProperty('--vscode-widget-border', '#474747');
    document.documentElement.style.setProperty('--vscode-editor-inactiveSelectionBackground', '#3a3d41');
    document.documentElement.style.setProperty('--vscode-list-hoverBackground', '#2a2d2e');
    document.documentElement.style.setProperty('--vscode-list-activeSelectionBackground', '#094771');
    document.documentElement.style.setProperty('--vscode-list-activeSelectionForeground', '#ffffff');
    document.documentElement.style.setProperty('--vscode-sideBarTitle-foreground', '#bbbbbb');
    document.documentElement.style.setProperty('--vscode-descriptionForeground', '#cccccc88');
    document.documentElement.style.setProperty('--vscode-textLink-foreground', '#3794ff');
    document.documentElement.style.setProperty('--vscode-textLink-activeForeground', '#3794ff');
}

const vscode = isInVSCode() ? acquireVsCodeApi() : {
    postMessage: (msg) => {
        console.log('Browser mode, message:', msg);
    }
};

const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const previewContainer = document.getElementById('previewContainer');
const loadingElement = document.getElementById('loading');
const contextMenu = document.getElementById('imageContextMenu');
let currentImage = null;
let currentContextImage = null;

// 浏览器环境下的消息处理器
const browserMessageHandlers = {
    receiveMessage: (text, isAI = true, image = null) => {
        addMessage(text, isAI, image);
    },
    showLoading: () => {
        showLoading();
    },
    hideLoading: () => {
        hideLoading();
    },
    fileList: (files) => {
        window.currentFiles = files;
        renderFileList(files);
    },
    selectedFiles: (files) => {
        const searchBox = document.querySelector('.search-box');
        if (files && files.length > 0) {
            searchBox.value = files.map(f => f.name).join(', ');
            renderFileList(files);
        }
    }
};

function showLoading() {
    loadingElement.classList.add('active');
}

function hideLoading() {
    loadingElement.classList.remove('active');
}

function addMessage(text, isAI = false, image = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + (isAI ? 'ai-message' : 'user-message');
    
    if (image) {
        const imgContainer = document.createElement('div');
        imgContainer.className = 'image-container';
        
        const img = document.createElement('img');
        img.src = image;
        img.className = 'thumbnail';
        img.onclick = (e) => {
            if (img.classList.contains('expanded')) {
                img.classList.remove('expanded');
            } else {
                img.classList.add('expanded');
            }
        };
        imgContainer.appendChild(img);
        messageDiv.appendChild(imgContainer);
        
        if (!isAI) {
            const generateBtn = document.createElement('button');
            generateBtn.className = 'generate-code-btn';
            generateBtn.textContent = '生成代码';
            generateBtn.style.display = 'block';
            generateBtn.onclick = () => {
                vscode.postMessage({
                    command: 'generateCode',
                    image: image
                });
            };
            messageDiv.appendChild(generateBtn);
        }
    }
    
    if (text) {
        const textDiv = document.createElement('div');
        if (isAI) {
            marked.setOptions({
                highlight: function(code, lang) {
                    if (lang && hljs.getLanguage(lang)) {
                        return hljs.highlight(code, { language: lang }).value;
                    }
                    return hljs.highlightAuto(code).value;
                }
            });
            textDiv.innerHTML = marked.parse(text);
        } else {
            textDiv.textContent = text;
        }
        messageDiv.appendChild(textDiv);
    }
    
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function handlePaste(e) {
    const items = e.clipboardData.items;
    for (let item of items) {
        if (item.type.indexOf('image') !== -1) {
            const file = item.getAsFile();
            const reader = new FileReader();
            reader.onload = function(event) {
                currentImage = event.target.result;
                updatePreview();
            };
            reader.readAsDataURL(file);
            break;
        }
    }
}

function updatePreview() {
    previewContainer.innerHTML = '';
    if (currentImage) {
        const previewDiv = document.createElement('div');
        previewDiv.className = 'image-preview';
        previewDiv.innerHTML = `
            <img src="${currentImage}">
            <button class="remove" onclick="removeImage()">×</button>
        `;
        previewContainer.appendChild(previewDiv);
    }
}

function removeImage() {
    currentImage = null;
    updatePreview();
}

function handleImageUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                currentImage = event.target.result;
                updatePreview();
            };
            reader.readAsDataURL(file);
        }
        document.body.removeChild(input);
    };
    
    input.oncancel = () => {
        document.body.removeChild(input);
    };
    
    input.click();
}

function sendMessage() {
    const text = messageInput.value.trim();
    if (text || currentImage) {
        addMessage(text, false, currentImage);
        if (isInVSCode()) {
            vscode.postMessage({
                command: 'sendMessage',
                text: text,
                image: currentImage
            });
        } else {
            // 浏览器环境下的模拟响应
            setTimeout(() => {
                addMessage('这是浏览器环境下的模拟回复。', true);
            }, 500);
        }
        messageInput.value = '';
        currentImage = null;
        updatePreview();
    }
}

function handleAddContext() {
    const panel = document.getElementById('contextPanel');
    panel.classList.add('active');
    handleSearchClick(new Event('click'));
}

function handleSearchClick(event) {
    event.preventDefault();
    event.stopPropagation();
    
    if (isInVSCode()) {
        vscode.postMessage({
            command: 'getWorkspaceFiles'
        });
    } else {
        const input = document.createElement('input');
        input.type = 'file';
        input.webkitdirectory = true;
        input.directory = true;
        input.style.display = 'none';
        document.body.appendChild(input);
        
        input.onchange = (e) => {
            const files = [];
            const processedPaths = new Set();
            
            Array.from(e.target.files).forEach(file => {
                const fullPath = file.webkitRelativePath;
                const pathParts = fullPath.split('/');
                
                for (let i = 1; i <= pathParts.length; i++) {
                    const currentPath = pathParts.slice(0, i).join('/');
                    
                    if (!processedPaths.has(currentPath)) {
                        processedPaths.add(currentPath);
                        
                        if (i === pathParts.length) {
                            files.push({
                                name: pathParts[i - 1],
                                path: currentPath,
                                type: pathParts[i - 1].split('.').pop() || 'unknown',
                                selected: false
                            });
                        } else {
                            files.push({
                                name: pathParts[i - 1],
                                path: currentPath,
                                type: 'directory',
                                selected: false
                            });
                        }
                    }
                }
            });
            
            files.sort((a, b) => a.path.localeCompare(b.path));
            browserMessageHandlers.fileList(files);
            document.body.removeChild(input);
        };
        
        input.click();
    }
}

function createFileItem(file, isSelected) {
    const fileItem = document.createElement('div');
    fileItem.className = `file-item${isSelected ? ' selected' : ''}`;
    
    const iconPath = file.type === 'directory' 
        ? 'M1.5 14h13l.5-.5V3.707L13.293 2H8.5l-.354-.146L7.793 1H2.5l-.5.5v12l-.5.5z'
        : 'M13.5 3H7.5L6.5 2h-4l-.5.5v11l.5.5h11l.5-.5v-10L13.5 3zM13 13H3V3h3.5l1 1h5.5v9z';
    
    fileItem.innerHTML = `
        <div class="file-item-content">
            <svg class="file-icon" viewBox="0 0 16 16">
                <path d="${iconPath}"/>
            </svg>
            <span class="file-name">${file.name}</span>
            <span class="file-path">${file.path}</span>
        </div>
    `;
    
    if (!isSelected) {
        fileItem.onclick = () => selectFile(file);
    }
    
    return fileItem;
}

function selectFile(file) {
    file.selected = !file.selected;
    
    const allFiles = window.currentFiles || [];
    const fileIndex = allFiles.findIndex(f => f.path === file.path);
    if (fileIndex !== -1) {
        allFiles[fileIndex].selected = file.selected;
    }
    window.currentFiles = allFiles;
    
    renderFileList(allFiles);
    
    if (isInVSCode()) {
        vscode.postMessage({
            command: 'selectFile',
            files: allFiles.filter(f => f.selected)
        });
    }
}

function renderFileList(files = []) {
    const addedFiles = document.getElementById('addedFiles');
    const availableFiles = document.getElementById('availableFiles');
    
    addedFiles.innerHTML = '';
    availableFiles.innerHTML = '';
    
    if (!files || files.length === 0) {
        availableFiles.innerHTML = `
            <div class="file-item">
                <div class="file-item-content">
                    <svg class="file-icon" viewBox="0 0 16 16">
                        <path d="M1.5 14h13l.5-.5V3.707L13.293 2H8.5l-.354-.146L7.793 1H2.5l-.5.5v12l-.5.5z"/>
                    </svg>
                    <span class="file-name">选择文件夹...</span>
                </div>
            </div>
        `;
        return;
    }
    
    const selectedFiles = files.filter(f => f.selected);
    if (selectedFiles.length > 0) {
        selectedFiles.forEach(file => {
            const fileItem = createFileItem(file, true);
            fileItem.onclick = () => selectFile(file);
            addedFiles.appendChild(fileItem);
        });
    }
    
    const availableFilesList = files.filter(f => !f.selected);
    availableFilesList.forEach(file => {
        const fileItem = createFileItem(file, false);
        fileItem.onclick = () => selectFile(file);
        availableFiles.appendChild(fileItem);
    });
    
    updateSearchBoxDisplay(selectedFiles);
}

function updateSearchBoxDisplay(selectedFiles) {
    const searchBox = document.querySelector('.search-box');
    if (selectedFiles && selectedFiles.length > 0) {
        searchBox.value = selectedFiles.map(f => f.name).join(', ');
    } else {
        searchBox.value = '';
        searchBox.placeholder = 'Search files by name';
    }
}

function handleConfirmSearch() {
    const selectedFiles = document.querySelectorAll('#addedFiles .file-item.selected');
    const selectedFilesContainer = document.getElementById('selectedFiles');
    
    selectedFiles.forEach(file => {
        const fileName = file.querySelector('.file-name').textContent;
        const filePath = file.querySelector('.file-path').textContent;
        
        // 创建选中文件标签
        const fileTag = document.createElement('div');
        fileTag.className = 'selected-file-item';
        fileTag.innerHTML = `
            <span>${fileName}</span>
            <span class="remove-file" onclick="removeSelectedFile(this, '${filePath}')">×</span>
        `;
        fileTag.dataset.path = filePath;
        
        selectedFilesContainer.appendChild(fileTag);
    });
    
    // 关闭上下文面板
    document.getElementById('contextPanel').classList.remove('active');
}

function removeSelectedFile(element, filePath) {
    // 移除选中的文件标签
    element.parentElement.remove();
    
    // 如果需要，也可以更新addedFiles中的选中状态
    const fileItem = document.querySelector(`#addedFiles .file-item[data-path="${filePath}"]`);
    if (fileItem) {
        fileItem.classList.remove('selected');
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 初始化搜索框
    const searchBox = document.querySelector('.search-box');
    if (!isInVSCode()) {
        searchBox.removeAttribute('readonly');
    }
    
    // 监听消息
    window.addEventListener('message', event => {
        const message = event.data;
        if (isInVSCode()) {
            switch (message.command) {
                case 'receiveMessage':
                    addMessage(message.text, message.isAI, message.image);
                    break;
                case 'showLoading':
                    showLoading();
                    break;
                case 'hideLoading':
                    hideLoading();
                    break;
                case 'fileList':
                    window.currentFiles = message.files;
                    renderFileList(message.files);
                    break;
                case 'selectedFiles':
                    if (message.files && message.files.length > 0) {
                        const searchBox = document.querySelector('.search-box');
                        searchBox.value = message.files.map(f => f.name).join(', ');
                        renderFileList(message.files);
                    }
                    break;
            }
        } else {
            const handler = browserMessageHandlers[message.command];
            if (handler) {
                handler(message.text, message.isAI, message.image);
            }
        }
    });
    
    // 监听回车发送消息
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }); 
}); 