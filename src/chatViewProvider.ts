import * as vscode from 'vscode';
import axios from 'axios';
import * as fs from 'fs';

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
                case 'generateCode':
                    await this._handleGenerateCode(data.image);
                    break;
            }
        });
    }

    private _handleMessage(text: string, imageDataUrl?: string) {
        if (!this._view) return;

        // 如果只有图片没有文本，则不显示AI回复
        if (imageDataUrl && !text) {
            return;
        }

        setTimeout(() => {
            let responseText = `收到消息: ${text}`;
            this._view?.webview.postMessage({
                command: 'receiveMessage',
                text: responseText,
                isAI: true
            });
        }, 1000);
    }

    private async _handleGenerateCode(imageData: string) {
        if (!this._view) return;

        console.log('请求服务端数据 2', imageData);

        try {
            // 显示加载状态
            this._view.webview.postMessage({ command: 'showLoading' });
            
            const imageBuffer = Buffer.from(imageData.split(',')[1], 'base64');
            
            const response = await axios.post('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
                model: "ep-20250213181329-6bk52",
                messages: [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": `data:image/png;base64,${imageBuffer.toString('base64')}`
                                }
                            },
                            {
                                "type": "text",
                                "text": "请根据这个画板绘制的图生成对应的HTML和CSS代码"
                            }
                        ]
                    }
                ],
            }, {
                headers: {
                    'Authorization': 'Bearer 121c96f4-fede-424c-a915-a5c86b17996d',
                    'Content-Type': 'application/json'
                }
            });

            console.log('请求服务端数据 3', response.data);

            if (response.data && response.data.choices && response.data.choices[0].message.content) {
                const generatedCode = response.data.choices[0].message.content;
                
                // 发送成功消息到聊天窗口
                this._view.webview.postMessage({
                    command: 'receiveMessage',
                    text: generatedCode,
                    isAI: true
                });
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`生成代码失败: ${error.message}`);
            this._view.webview.postMessage({
                command: 'receiveMessage',
                text: `生成代码失败: ${error.message}`,
                isAI: true
            });
        } finally {
            // 隐藏加载状态
            this._view.webview.postMessage({ command: 'hideLoading' });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // 获取 webview 的内容
        const chatHtmlPath = vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'chat.html');
        let chatHtmlContent = fs.readFileSync(chatHtmlPath.fsPath, 'utf8');
        
        // 替换 vscode-resource 路径
        chatHtmlContent = chatHtmlContent.replace(
            /#{webview.cspSource}/g,
            webview.cspSource
        );
        
        return chatHtmlContent;
    }
} 