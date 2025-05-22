import * as vscode from "vscode";
import { promptToReloadWindow } from "./utils";
import { fetchTestCases, saveCoverageReport } from "./commands/index";
import { JiraCompletionProvider } from "./providers/JiraCompletionProvider";
import { provideXrayUrlHover } from "./providers/xrayUrlHover";
import {
    CoverageReportPanel,
    getWebviewOptions,
} from "./providers/ReportViewPanel";

const JsAndTsActivationSchema = [
    { scheme: "file", language: "javascript" },
    { scheme: "file", language: "typescript" },
];

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "vscode-xray-viewer.generateCoverageReport",
            () => CoverageReportPanel.createOrShow(context.extensionUri)
        ),
        vscode.commands.registerCommand(
            "vscode-xray-viewer.fetchTestCases",
            fetchTestCases
        ),
        vscode.commands.registerCommand(
            "vscode-xray-viewer.saveHtmlReport",
            saveCoverageReport
        ),
        vscode.languages.registerCompletionItemProvider(
            JsAndTsActivationSchema,
            new JiraCompletionProvider(),
            "'",
            '"'
        ),
        vscode.languages.registerHoverProvider(JsAndTsActivationSchema, {
            provideHover(document, position) {
                return provideXrayUrlHover(document, position);
            },
        }),
        vscode.workspace.onDidChangeConfiguration((event) =>
            promptToReloadWindow(event)
        )
    );

    if (vscode.window.registerWebviewPanelSerializer) {
        vscode.window.registerWebviewPanelSerializer(
            CoverageReportPanel.viewType,
            {
                async deserializeWebviewPanel(
                    webviewPanel: vscode.WebviewPanel,
                    state: unknown
                ) {
                    webviewPanel.webview.options = getWebviewOptions(
                        context.extensionUri
                    );
                    CoverageReportPanel.revive(
                        webviewPanel,
                        context.extensionUri
                    );
                },
            }
        );
    }
}

export function deactivate() {}
