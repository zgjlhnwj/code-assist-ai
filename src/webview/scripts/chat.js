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

// 添加全局数组来存储多个图片数据
let imageDataArray = [];
// 添加全局数组存储选中的文件
let selectedContextFiles = [];
// 会话参数
let sessionParams = [];

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

function addMessage(text, isAI = false, images = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + (isAI ? 'ai-message' : 'user-message');
    
    // 如果有图片，先添加图片
    if (images) {
        const imagesContainer = document.createElement('div');
        imagesContainer.className = 'images-container';
        
        // 处理单张图片或多张图片
        const imageArray = Array.isArray(images) ? images : [images];
        
        imageArray.forEach(imgSrc => {
            const imgWrapper = document.createElement('div');
            imgWrapper.className = 'image-wrapper';
            
            const img = document.createElement('img');
            img.src = imgSrc;
            img.className = 'thumbnail';
            img.onclick = () => openModal(imgSrc);
            
            imgWrapper.appendChild(img);
            imagesContainer.appendChild(imgWrapper);
        });
        
        messageDiv.appendChild(imagesContainer);
    }
    
    // 如果有文本，添加文本
    if (text) {
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
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

function handlePaste(event) {
    const items = event.clipboardData.items;
    for (const item of items) {
        if (item.type.indexOf('image') === 0) {
            const blob = item.getAsFile();
            const reader = new FileReader();
            reader.onload = function(e) {
                addImagePreview(e.target.result);  // 直接传递 base64 字符串
            };
            reader.readAsDataURL(blob);
        }
    }
}

// 图片预览相关函数
function openModal(imgSrc) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    modal.classList.add('show');
    modalImg.src = imgSrc;
}

function closeModal() {
    const modal = document.getElementById('imageModal');
    modal.classList.remove('show');
}

// 修改添加预览图片函数以处理 File 对象和 base64 字符串
function addImagePreview(input) {
    if (input instanceof File) {
        // 如果输入是 File 对象
        const reader = new FileReader();
        reader.onload = function(e) {
            createImagePreview(e.target.result);
        };
        reader.readAsDataURL(input);
    } else if (typeof input === 'string') {
        // 如果输入是 base64 字符串
        createImagePreview(input);
    }
}

// 新增函数用于创建图片预览
function createImagePreview(imgSrc) {
    const img = document.createElement('img');
    img.src = imgSrc;
    img.onclick = () => openModal(imgSrc);
    
    // 将图片数据添加到数组中
    imageDataArray.push(imgSrc);
    
    const previewWrapper = document.createElement('div');
    previewWrapper.className = 'image-preview';
    
    const removeButton = document.createElement('button');
    removeButton.className = 'remove-image';
    removeButton.innerHTML = '×';
    removeButton.onclick = function(e) {
        e.stopPropagation(); // 防止触发图片的点击事件
        // 从数组中移除图片数据
        const index = imageDataArray.indexOf(imgSrc);
        if (index > -1) {
            imageDataArray.splice(index, 1);
        }
        previewWrapper.remove();
    };
    
    previewWrapper.appendChild(img);
    previewWrapper.appendChild(removeButton);
    document.getElementById('previewContainer').appendChild(previewWrapper);
}

function handleImageUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    
    input.onchange = function(e) {
        const files = e.target.files;
        for (const file of files) {
            addImagePreview(file);  // 传递 File 对象
        }
    };
    
    input.click();
}

async function sendMessage() {
    const text = messageInput.value.trim();
    const images = imageDataArray;

    // 如果既没有文本也没有图片，则不发送
    if (!text && images.length === 0) {
        return;
    }

    // 构建消息内容数组
    const content = [];
    
    // 如果有文本，添加文本内容
    if (text) {
        content.push({
            type: "text",
            text: text
        });
    }
    
    // 如果有图片，添加图片内容
    if (images && images.length > 0) {
        images.forEach(imgSrc => {
            content.push({
                type: "image_url",
                image_url: {
                    url: imgSrc
                }
            });
        });
    }

    // 构建完整的消息对象
    const messageData = {
        role: "user",
        content: content
    };

    sessionParams.push(messageData);

    // 添加用户消息到聊天界面
    addMessage(text, false, images);

    // 清空输入框和图片预览
    messageInput.value = '';
    const previewContainer = document.getElementById('previewContainer');
    previewContainer.innerHTML = '';
    imageDataArray = [];

    try {
        const response = await callAPI();
        currentChat.messages.push({
            role: 'assistant',
            content: response,
            timestamp: new Date().toISOString()
        });
        updateChatWindow();
    } catch (error) {
        console.error('发送消息错误:', error);
        currentChat.messages.push({
            role: 'assistant',
            content: '抱歉，发生了错误，请稍后重试。',
            timestamp: new Date().toISOString()
        });
        updateChatWindow();
    } finally {
        removeImage();
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
    const selectedFiles = window.currentFiles ? window.currentFiles.filter(f => f.selected) : [];
    const selectedFilesContainer = document.getElementById('selectedFiles');
    
    // 清空现有的显示
    selectedFilesContainer.innerHTML = '';
    
    // 更新全局存储
    selectedContextFiles = selectedFiles;
    
    selectedFiles.forEach(file => {
        // 创建选中文件标签
        const fileTag = document.createElement('div');
        fileTag.className = 'selected-file-item';
        fileTag.innerHTML = `
            <span>${file.name}</span>
            <span class="remove-file" onclick="removeSelectedFile(this, '${file.path}')">×</span>
        `;
        fileTag.dataset.path = file.path;
        
        selectedFilesContainer.appendChild(fileTag);
    });
    
    // 关闭上下文面板
    document.getElementById('contextPanel').classList.remove('active');
}

function removeSelectedFile(element, filePath) {
    // 从全局存储中移除文件
    const fileIndex = selectedContextFiles.findIndex(f => f.path === filePath);
    if (fileIndex > -1) {
        selectedContextFiles.splice(fileIndex, 1);
    }
    
    // 更新 currentFiles 中的选中状态
    const currentFileIndex = window.currentFiles.findIndex(f => f.path === filePath);
    if (currentFileIndex > -1) {
        window.currentFiles[currentFileIndex].selected = false;
    }
    
    // 移除选中的文件标签
    element.parentElement.remove();
    
    // 如果在 VSCode 环境中，通知更新
    if (isInVSCode()) {
        vscode.postMessage({
            command: 'selectFile',
            files: selectedContextFiles
        });
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

// 添加创建消息元素的辅助函数
function createMessageElement(role) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role === 'assistant' ? 'ai-message' : 'user-message'}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-text';
    messageDiv.appendChild(contentDiv);
    
    return messageDiv;
}

// 添加复制代码的函数
function copyCode(button) {
    const codeBlock = button.parentElement.querySelector('code');
    const text = codeBlock.textContent;
    
    navigator.clipboard.writeText(text).then(() => {
        // 更新复制按钮文本
        const originalText = button.textContent;
        button.textContent = '已复制!';
        button.classList.add('copied');
        
        // 2秒后恢复原始文本
        setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('复制失败:', err);
    });
}

// 修改代码高亮处理部分
function addCopyButtonToCodeBlock(codeBlock) {
    const pre = codeBlock.parentElement;
    if (!pre.querySelector('.copy-button')) {
        const button = document.createElement('button');
        button.className = 'copy-button';
        button.textContent = '复制';
        button.onclick = function() {
            copyCode(this);
        };
        pre.appendChild(button);
    }
}

async function callAPI() {
    try {
        const response = await fetch('https://demo-rtcai.ledupeiyou.com/proxyAIGCFetch/chat', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer 4044c019-018b-4973-8ec3-34295dc2b885',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "bot-20250213153935-2x2qt",
                stream: true,
                stream_options: { include_usage: true },
                messages: sessionParams
            })
        });

        if (!response.ok) {
            throw new Error('API 请求失败');
        }

        // 创建一个新的回复消息容器
        const messageDiv = createMessageElement('assistant');
        messagesDiv.appendChild(messageDiv);
        const contentDiv = messageDiv.querySelector('.message-text');
        
        // 使用 TextDecoder 来解码流
        const decoder = new TextDecoder();
        const reader = response.body.getReader();
        let buffer = ''; // 用于存储未完成的数据
        let fullResponse = '';
        
        while (true) {
            const {done, value} = await reader.read();
            if (done) break;
            
            // 解码新的数据块并添加到缓冲区
            buffer += decoder.decode(value, {stream: true});
            
            // 按行分割并处理每一行
            const lines = buffer.split('\n');
            // 保留最后一行（可能不完整）
            buffer = lines.pop() || '';
            
            for (const line of lines) {
                if (line.trim() === '') continue;
                
                try {
                    // 移除 'data:' 前缀
                    const jsonStr = line.replace(/^data:/, '').trim();
                    if (!jsonStr) continue;
                    
                    const jsonData = JSON.parse(jsonStr);
                    if (jsonData.choices && jsonData.choices[0].delta.content) {
                        const content = jsonData.choices[0].delta.content;
                        fullResponse += content;
                        
                        // 实时更新UI
                        contentDiv.innerHTML = marked.parse(fullResponse);
                        
                        // 如果有代码块，应用语法高亮
                        const codeBlocks = contentDiv.querySelectorAll('pre code');
                        if (codeBlocks.length > 0) {
                            codeBlocks.forEach(block => {
                                hljs.highlightElement(block);
                                addCopyButtonToCodeBlock(block);
                            });
                        }
                        
                        // 滚动到底部
                        messagesDiv.scrollTop = messagesDiv.scrollHeight;
                    }
                } catch (e) {
                    console.warn('解析数据块时出错:', e, line);
                }
            }
        }
        
        // 处理缓冲区中剩余的数据
        if (buffer.trim()) {
            try {
                const jsonStr = buffer.replace(/^data:/, '').trim();
                if (jsonStr) {
                    const jsonData = JSON.parse(jsonStr);
                    if (jsonData.choices && jsonData.choices[0].delta.content) {
                        const content = jsonData.choices[0].delta.content;
                        fullResponse += content;
                        contentDiv.innerHTML = marked.parse(fullResponse);
                        
                        // 处理最后一次的代码高亮
                        const codeBlocks = contentDiv.querySelectorAll('pre code');
                        if (codeBlocks.length > 0) {
                            codeBlocks.forEach(block => {
                                hljs.highlightElement(block);
                                addCopyButtonToCodeBlock(block);
                            });
                        }
                    }
                }
            } catch (e) {
                console.warn('处理最后的数据块时出错:', e);
            }
        }

        // 在获取完整响应后，将助理的回复添加到会话参数中
        sessionParams.push({
            role: 'assistant',
            content: fullResponse
        });

        return fullResponse;
    } catch (error) {
        console.error('API调用错误:', error);
        // 创建错误消息
        const messageDiv = createMessageElement('assistant');
        const contentDiv = messageDiv.querySelector('.message-text');
        contentDiv.textContent = '抱歉，发生了错误，请稍后重试。';
        messagesDiv.appendChild(messageDiv);
        return '抱歉，发生了错误，请稍后重试。';
    }
}

console.log('Chat webview loaded'); // 这会帮助你在开发者工具中找到你的代码 