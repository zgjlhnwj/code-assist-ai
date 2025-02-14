import * as vscode from 'vscode';

export class ChatViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.command) {
                case 'sendMessage':
                    this._handleMessage(data.text, data.image);
                    break;
            }
        });
    }

    private _handleMessage(text: string, imageDataUrl?: string) {
        if (!this._view) return;

        // 处理消息和图片
        setTimeout(() => {
            let responseText = `收到消息: ${text}`;
            if (imageDataUrl) {
                responseText = '收到图片消息';
            }
            this._view?.webview.postMessage({
                command: 'receiveMessage',
                text: responseText,
                image: imageDataUrl,
                isAI: true
            });
        }, 1000);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        margin: 0;
                        padding: 10px;
                        background: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                        font-family: var(--vscode-font-family);
                    }
                    .chat-container {
                        display: flex;
                        flex-direction: column;
                        height: 100vh;
                    }
                    .messages {
                        flex: 1;
                        overflow-y: auto;
                        margin-bottom: 10px;
                    }
                    .message {
                        margin: 8px 0;
                        padding: 8px 12px;
                        border-radius: 6px;
                        max-width: 100%;
                        word-wrap: break-word;
                    }
                    .user-message {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        margin-left: auto;
                    }
                    .ai-message {
                        background: var(--vscode-editor-inactiveSelectionBackground);
                        margin-right: auto;
                    }
                    .message img {
                        max-width: 100%;
                        border-radius: 4px;
                        margin: 5px 0;
                    }
                    .input-container {
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                        padding: 10px;
                        background: var(--vscode-editor-background);
                        border-top: 1px solid var(--vscode-widget-border);
                    }
                    .input-area {
                        display: flex;
                        gap: 8px;
                    }
                    #messageInput {
                        flex: 1;
                        min-height: 60px;
                        max-height: 120px;
                        resize: vertical;
                        padding: 8px;
                        border: 1px solid var(--vscode-input-border);
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border-radius: 4px;
                        font-family: inherit;
                        font-size: inherit;
                    }
                    .preview-container {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 8px;
                    }
                    .image-preview {
                        position: relative;
                        width: 80px;
                        height: 80px;
                        border-radius: 4px;
                        overflow: hidden;
                    }
                    .image-preview img {
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                    }
                    .image-preview .remove {
                        position: absolute;
                        top: 2px;
                        right: 2px;
                        background: rgba(0,0,0,0.5);
                        color: white;
                        border: none;
                        border-radius: 50%;
                        width: 20px;
                        height: 20px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    button {
                        padding: 6px 12px;
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        white-space: nowrap;
                    }
                    button:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                </style>
            </head>
            <body>
                <div class="chat-container">
                    <div class="messages" id="messages">
                        <div class="message ai-message">你好！我是你的代码助手，有什么可以帮你的吗？</div>
                    </div>
                    <div class="input-container">
                        <div class="preview-container" id="previewContainer"></div>
                        <div class="input-area">
                            <textarea
                                id="messageInput"
                                placeholder="输入消息... (可以粘贴图片)"
                                onpaste="handlePaste(event)"
                            ></textarea>
                            <button onclick="sendMessage()">发送</button>
                        </div>
                    </div>
                </div>
                <script>
                    const vscode = acquireVsCodeApi();
                    const messagesDiv = document.getElementById('messages');
                    const messageInput = document.getElementById('messageInput');
                    const previewContainer = document.getElementById('previewContainer');
                    let currentImage = null;

                    function addMessage(text, isAI = false, image = null) {
                        const messageDiv = document.createElement('div');
                        messageDiv.className = 'message ' + (isAI ? 'ai-message' : 'user-message');
                        
                        if (image) {
                            const img = document.createElement('img');
                            img.src = image;
                            messageDiv.appendChild(img);
                        }
                        
                        if (text) {
                            const textDiv = document.createElement('div');
                            textDiv.textContent = text;
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
                            previewDiv.innerHTML = \`
                                <img src="\${currentImage}">
                                <button class="remove" onclick="removeImage()">×</button>
                            \`;
                            previewContainer.appendChild(previewDiv);
                        }
                    }

                    function removeImage() {
                        currentImage = null;
                        updatePreview();
                    }

                    function sendMessage() {
                        const text = messageInput.value.trim();
                        if (text || currentImage) {
                            addMessage(text, false, currentImage);
                            vscode.postMessage({
                                command: 'sendMessage',
                                text: text,
                                image: currentImage
                            });
                            messageInput.value = '';
                            currentImage = null;
                            updatePreview();
                        }
                    }

                    messageInput.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                        }
                    });

                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.command) {
                            case 'receiveMessage':
                                addMessage(message.text, message.isAI, message.image);
                                break;
                        }
                    });
                </script>
            </body>
            </html>
        `;
    }
} 