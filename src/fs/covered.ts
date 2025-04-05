import * as vscode from "vscode";
import fs from "node:fs/promises";
import { config, getCustomMethodArgument } from "../utils";
import { glob } from "fast-glob";
import path from "node:path";

export interface Coverage {
    id: string;
    line: number;
    file: string;
}

export const getCoveredTestCases = async () => {
    const cfg = config();

    if (!cfg.xrayTestCaseAutocompletion.customMethod) {
        await vscode.window.showWarningMessage(
            "custom method name is not available in the settings"
        );
        return [];
    }
    const cwd = vscode.workspace.workspaceFolders?.at(0)?.uri.fsPath ?? "";
    const testFiles = await glob(cfg.testFiles, { cwd });

    const contents = await Promise.all(
        testFiles.map(async (file) => ({
            name: file,
            content: await fs.readFile(path.join(cwd, file), "utf-8"),
        }))
    );

    const testCaseCoverage = contents.reduce((testCases, file) => {
        const lines = file.content.split("\n");

        const fileTestCases = lines.reduce((fileTestCases, line, index) => {
            if (
                !line
                    ?.trim()
                    .startsWith(cfg.xrayTestCaseAutocompletion.customMethod)
            ) {
                return fileTestCases;
            }

            const customMethodArg = getCustomMethodArgument(
                line.trim(),
                cfg.xrayTestCaseAutocompletion.customMethod
            );

            const testCaseId = cfg.xrayTestCaseAutocompletion.provideIdOnly
                ? customMethodArg
                : customMethodArg.split("-").pop() ?? "";
            fileTestCases.push({
                id: testCaseId,
                line: index + 1,
                file: file.name,
            });
            return fileTestCases;
        }, [] as Coverage[]);

        testCases.push(...fileTestCases);
        return testCases;
    }, [] as Coverage[]);

    return testCaseCoverage.filter((testCase) => !!testCase.id);
};
