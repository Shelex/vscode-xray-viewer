import path from "node:path";
import * as vscode from "vscode";
import { JiraTestCase, ticketStorage } from "../jira/storage";
import { Coverage, getCoveredTestCases } from "../fs/covered";
import { config } from "../utils";

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
        this._panel.webview.html = this._getHtmlForWebview(
            webview,
            testCases,
            covered
        );
    }

    private _getHtmlForWebview(
        webview: vscode.Webview,
        testCases: JiraTestCase[],
        covered: Coverage[]
    ) {
        const cfg = config();
        const header = `<!DOCTYPE html>
   <html lang="en">
   <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Coverage</title>
                <style>
                    body {
                        font-size: 20px;
                    }

                    th, td {
                        border: 1px solid #7d7d7d;
                    }

                    .panel-header {
                        background-color: #ccc;
                        color: #444;
                        cursor: pointer;
                        padding: 18px;
                        width: 100%;
                        border: none;
                        text-align: left;
                        outline: none;
                        font-size: 15px;
                        transition: 0.4s;
                    }

                    .active, .panel-header:hover {
                        background-color: #7d7d7d; 
                    }

                    .panel {
                        margin: 2% 0;
                        padding: 0 18px;
                        width: 100%;
                        overflow: hidden;
                    }
                </style>
                <script>
                    function openFile(filePath, line) {
                        const vscode = acquireVsCodeApi();
                        vscode.postMessage({ command: 'openFile', filePath, line });
                    }
                </script>
                </head><body>`;
        const ending = `</body></html>`;

        const coveredTestCases = testCases.filter((tc) =>
            covered.some((c) => `${cfg.atlassian.project}-${c.id}` === tc.key)
        );
        const percentage = Math.round(
            (coveredTestCases.length / testCases.length) * 100
        );

        const tableHeader = `
        <h1>Overall Test Coverage ${percentage}%</h1>
        <table>
            <thead>
                <th>ID</th>
                <th>test case</th>
                <th>covered</th>
            </thead>
        <tbody>`;
        const allEpics = testCases
            .map(
                (testCase) => {
                    const matches = testCase.summary.match(/\[(.*?)\]/);
                    return matches?.at(1) ?? "";
                }
            )
            .filter(Boolean)
            .map((t) => t.trim());
        const epics = Array.from(new Set(allEpics));

        const coverage = (testCase: JiraTestCase) =>
            covered
                .filter(
                    (c) => `${cfg.atlassian.project}-${c.id}` === testCase.key
                )
                .map((t) => {
                    return `<li><a href="#" style="font-size:12px" onclick="openFile('${t.file}', ${t.line})">${t.file}#${t.line}</a></li>`;
                });

        const overallCoverage = `<h1>Overall Test Coverage ${percentage}%</h1>`;
        const withEpics = epics
            .map((epic) => {
                const tc = getTestsPerEpic(testCases, epic);
                const coveredTestCases = tc.filter((tc) =>
                    covered.find(
                        (c) => `${cfg.atlassian.project}-${c.id}` === tc.key
                    )
                );
                const epicPercentage = Math.round(
                    (coveredTestCases.length / tc.length) * 100
                );

                return `
            <button class="panel-header">${epic} [${epicPercentage}%]</button>
            <table class="panel" style="margin-bottom:5%">
            <thead>
                <th style="width:10%">ID</th>
                <th>Test Case</th>
                <th style="width:20%">Coverage</th>
            </thead>
            <tbody>
                ${tc
                    .map((testCase) => {
                        return `
                    <tr>
                        <td><a href=${cfg.atlassian.domain}/browse/${
                            testCase.key
                        }>${testCase.key}</a></td>
                        <td>${testCase.summary.split("]").pop()?.trim()}</td>
                        <td>${
                            coverage(testCase).length
                                ? `<ul>${coverage(testCase).join("")}</ul>`
                                : "-"
                        }</td>
                    </tr>`;
                    })
                    .join("")}
            </tbody>
            </table>
            `;
            })
            .join("");

        const rows = testCases
            .map(
                (testCase) => `
        <tr>
        <td><a href=${cfg.atlassian.domain}/browse/${testCase.key}>${
                    testCase.key
                }</a></td>
        <td>${testCase.summary}</td>
        <td>${
            coverage(testCase).length
                ? `<ul>${coverage(testCase).join("")}</ul>`
                : "-"
        }</td>
        </tr>`
            )
            .join("");

        const body = cfg.atlassian.shouldGroupByEpic
            ? `${overallCoverage}${withEpics}`
            : `${tableHeader}${rows}</tbody></table>`;

        return `${header}${body}${ending}`;
    }
}


const treatSpecialCharactersAsSymbols = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

//assuming test case name has `[epicName]` in title
const getTestsPerEpic = (testCases: JiraTestCase[], epicName: string) => {
  const escapedEpicName = treatSpecialCharactersAsSymbols(epicName);
  const pattern = new RegExp(`^\\s*\\[\\s*${escapedEpicName}\\s*\\]`);
  return testCases.filter(test => pattern.test(test.summary));
};