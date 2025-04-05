import * as vscode from "vscode";
import { config } from "../utils";
import { ticketStorage } from "../jira/storage";

export class JiraCompletionProvider implements vscode.CompletionItemProvider {
    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ) {
        const cfg = config();
        if (
            !cfg.xrayTestCaseAutocompletion.enable ||
            !cfg.xrayTestCaseAutocompletion.customMethod
        ) {
            return;
        }

        const start = new vscode.Position(position.line, 0);
        const range = new vscode.Range(start, position);
        const text = document.getText(range)?.trim() ?? "";

        const shouldCheck = text.startsWith(
            cfg.xrayTestCaseAutocompletion.customMethod
        );

        if (!shouldCheck) {
            return;
        }

        const testCases = await ticketStorage.get();

        if (!testCases?.length) {
            return;
        }

        return {
            items: testCases.map((testCase, index) => ({
                label: `${testCase.key} | ${testCase.summary}`,
                insertText: cfg.xrayTestCaseAutocompletion.provideIdOnly
                    ? testCase.key.split("-").pop()
                    : `${cfg.atlassian.domain}/browse/${testCase.key}`,
                preselect: index === 0,
                kind: 12,
            })),
        };
    }
}
