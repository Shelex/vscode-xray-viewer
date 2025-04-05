import * as vscode from "vscode";
import { JiraTestCase, ticketStorage } from "../jira/storage";
import { Coverage, getCoveredTestCases } from "../fs/covered";
import { config } from "../utils";

export function getWebviewOptions(
    extensionUri: vscode.Uri
): vscode.WebviewOptions {
    return {
        enableScripts: true,
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
            (message) => {
                switch (message.command) {
                    case "alert":
                        vscode.window.showErrorMessage(message.text);
                        return;
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
                </style>
			</head><body>`;
        const ending = `</body></html>`;

        const coveredTestCases = testCases.filter((tc) =>
            covered.find((c) => `${cfg.atlassian.project}-${c.id}` === tc.key)
        );
        const percentage = Math.round(
            (coveredTestCases.length / testCases.length) * 100
        );
        const tableHeader = `<h1>Test Coverage ${percentage}%</h1><table><thead>
        <th>ID</th>
        <th>test case</th>
        <th>covered</th>
        </thead><tbody>`;

        const coverage = (testCase: JiraTestCase) =>
            covered
                .filter(
                    (c) => `${cfg.atlassian.project}-${c.id}` === testCase.key
                )
                .map(() => `&#127774;`);

        const rows = testCases
            .map(
                (testCase) => `
        <tr>
        <td><a href=${cfg.atlassian.domain}/browse/${testCase.key}>${
                    testCase.key
                }</a></td>
        <td>${testCase.summary}</td>
        <td>${coverage(testCase).length ? coverage(testCase) : "-"}</td>
        </tr>`
            )
            .join("");

        const body = `${tableHeader}${rows}</tbody></table>`;

        return `${header}${body}${ending}`;
    }
}
