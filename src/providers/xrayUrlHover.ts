import * as vscode from "vscode";
import { config, getCustomMethodArgument } from "../utils";

export const provideXrayUrlHover = (
    document: vscode.TextDocument,
    position: vscode.Position
) => {
    const cfg = config();
    const enabled = cfg.xrayTestCaseAutocompletion.enable ?? false;

    if (!enabled) {
        return;
    }

    const line = document.lineAt(position.line).text;

    if (!line.trim().startsWith(cfg.xrayTestCaseAutocompletion.customMethod)) {
        return;
    }

    const customMethodArg = getCustomMethodArgument(
        line,
        cfg.xrayTestCaseAutocompletion.customMethod
    );

    if (!customMethodArg) {
        return;
    }

    const url = cfg.xrayTestCaseAutocompletion.provideIdOnly
        ? `${cfg.atlassian.domain}/browse/${cfg.atlassian.project}-${customMethodArg}`
        : customMethodArg;

    if (!url) {
        return;
    }

    return new vscode.Hover(url ?? "");
};
