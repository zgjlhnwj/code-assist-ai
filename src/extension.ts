import * as vscode from 'vscode';
import { ChatViewProvider } from './chatViewProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('恭喜，您的扩展已激活！');

    const provider = new ChatViewProvider(context.extensionUri);
    
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('code-assist-ai.chatView', provider)
    );

    let disposable = vscode.commands.registerCommand('my-vscode-extension.code-assist-ai', () => {
        vscode.commands.executeCommand('code-assist-ai.chatView.focus');
    });

    let hoverProvider = vscode.languages.registerHoverProvider({ pattern: '**/*.json' }, {
        provideHover(document, position, token) {
            const range = document.getWordRangeAtPosition(position);
            if (range) {
                const word = document.getText(range);
                return new vscode.Hover(`当前值: ${word}`);
            }
            return null;
        }
    });

    context.subscriptions.push(disposable, hoverProvider);
}

export function deactivate() {} 