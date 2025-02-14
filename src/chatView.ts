import * as vscode from 'vscode';
import * as fs from 'fs';

export class ChatPanel {
    public static currentPanel: ChatPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        
        // 获取HTML文件的URI
        const htmlPath = vscode.Uri.joinPath(extensionUri, 'src', 'webview', 'chat.html');
        
        // 读取HTML文件内容
        this._panel.webview.html = fs.readFileSync(htmlPath.fsPath, 'utf-8');
        
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // 处理来自 Webview 的消息
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'sendMessage':
                        this._handleMessage(message.text, message.image);
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (ChatPanel.currentPanel) {
            ChatPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'chatView',
            '代码助手',
            column || vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );

        ChatPanel.currentPanel = new ChatPanel(panel, extensionUri);
    }

    private _handleMessage(text: string, imageDataUrl?: string) {
        // 处理消息和图片
        setTimeout(() => {
            let responseText = `收到消息: ${text}`;
            if (imageDataUrl) {
                responseText = '收到图片消息';
            }
            this._panel.webview.postMessage({
                command: 'receiveMessage',
                text: responseText,
                image: imageDataUrl,
                isAI: true
            });
        }, 1000);
    }

    public dispose() {
        ChatPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
} 