import path from "node:path";
import * as vscode from "vscode";
import { JiraTestCase, ticketStorage } from "../jira/storage";
import { Coverage, getCoveredTestCases } from "../fs/covered";
import { generateTestCoverageHtmlReport } from "../report";

export function getWebviewOptions(
    extensionUri: vscode.Uri
): vscode.WebviewOptions {
    return {
        enableScripts: true,
        enableCommandUris: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
    };
}

export class CoverageReportPanel {
    public static currentPanel: CoverageReportPanel | undefined;

    public static readonly viewType = "CoverageReport";

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (CoverageReportPanel.currentPanel) {
            CoverageReportPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            CoverageReportPanel.viewType,
            "Test Coverage",
            column || vscode.ViewColumn.One,
            getWebviewOptions(extensionUri)
        );

        CoverageReportPanel.currentPanel = new CoverageReportPanel(
            panel,
            extensionUri
        );
    }

    public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        CoverageReportPanel.currentPanel = new CoverageReportPanel(
            panel,
            extensionUri
        );
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.onDidChangeViewState(
            () => {
                if (this._panel.visible) {
                    this._update();
                }
            },
            null,
            this._disposables
        );

        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                if (message.command === "alert") {
                    vscode.window.showErrorMessage(message.text);
                    return;
                }

                if (message.command === "openFile") {
                    const cwd =
                        vscode.workspace.workspaceFolders?.at(0)?.uri.fsPath ??
                        "";
                    const uri = vscode.Uri.parse(
                        path.join(cwd, message.filePath)
                    );
                    const document = await vscode.workspace.openTextDocument(
                        uri
                    );
                    const editor = await vscode.window.showTextDocument(
                        document,
                        {
                            preview: false,
                        }
                    );
                    const position = new vscode.Position(message.line - 1, 0);
                    const selection = new vscode.Selection(position, position);
                    editor.selection = selection;
                    editor.revealRange(
                        new vscode.Range(position, position),
                        vscode.TextEditorRevealType.InCenter
                    );
                }
            },
            null,
            this._disposables
        );
    }

    public dispose() {
        CoverageReportPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private async _update() {
        const webview = this._panel.webview;
        const testCases = await ticketStorage.get();
        const covered = await getCoveredTestCases();
        this._updateStats(webview, testCases, covered);
    }

    private _updateStats(
        webview: vscode.Webview,
        testCases: JiraTestCase[],
        covered: Coverage[]
    ) {
        this._panel.title = "Test Coverage";
        this._panel.webview.html = generateTestCoverageHtmlReport(
            testCases,
            covered
        );
    }
}
