import * as vscode from "vscode";
import fs from "node:fs/promises";
import { getCoveredTestCases } from "../fs/covered";
import { ticketStorage } from "../jira/storage";
import { generateTestCoverageHtmlReport } from "../report";
import path from "node:path";

export const saveCoverageReport = async () => {
    const testCases = await ticketStorage.get();
    const covered = await getCoveredTestCases();
    const report = generateTestCoverageHtmlReport(testCases, covered);

    const root = vscode.workspace.workspaceFolders?.at(0)?.uri.path;

    if (!root) {
        vscode.window.showErrorMessage("No workspace folder found to save the report.");
        return;
    }

    const filePath = path.join(root, "test-coverage-report.html");

    try {
        await fs.writeFile(filePath, report, {
            encoding: "utf-8",
        });
    } catch (err) {
        console.error("Error writing coverage report:", err);
        vscode.window.showErrorMessage(
            `Failed to save coverage report to ${filePath}`
        );
    }
};
