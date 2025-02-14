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

    private async _handleGenerateCode(imageData: string) {
        if (!this._view) return;

        try {
            // 显示加载状态
            this._view.webview.postMessage({ command: 'showLoading' });
            
            const imageBuffer = Buffer.from(imageData.split(',')[1], 'base64');
            
            const response = await axios.post('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
                model: "ep-20250213181329-6bk52",
                messages: [
                    {
                        "role": "system",
                        "content": "你是一个专业的前端开发工程师，擅长将设计稿转换为精确的HTML和CSS代码。请你：\n" +
                                  "1. 仔细分析图片中的设计，包括布局、颜色、间距等细节\n" +
                                  "2. 生成符合现代前端开发标准的代码\n" +
                                  "3. 使用语义化的HTML标签\n" +
                                  "4. 添加适当的注释说明\n" +
                                  "5. 确保代码具有良好的响应式特性\n" +
                                  "6. 使用Markdown格式输出，将代码放在正确的代码块中"
                    },
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
                                "text": "这是一个界面设计图，请：\n" +
                                        "1. 分析这个设计的布局结构\n" +
                                        "2. 生成对应的HTML和CSS代码\n" +
                                        "3. 确保代码结构清晰，并添加必要的注释\n" +
                                        "4. 使用Markdown格式回复，将HTML和CSS代码分别放在对应的代码块中"
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
            console.log('请求服务端数据 3', error);
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