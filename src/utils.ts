import * as vscode from "vscode";

export function config() {
    const workSpaceConfig =
        vscode.workspace.getConfiguration("vscode-xray-viewer");
    return {
        atlassian: {
            domain: workSpaceConfig.get<string>("atlassian.domain") ?? "",
            username: workSpaceConfig.get<string>("atlassian.username") ?? "",
            apiKey: workSpaceConfig.get<string>("atlassian.apiKey") ?? "",
            project: workSpaceConfig.get<string>("atlassian.project") ?? "",
            query: workSpaceConfig.get<string>("atlassian.query") ?? "",
            shouldGroupByEpic:
                workSpaceConfig.get<boolean>("atlassian.shouldGroupByEpic") ??
                false,
            sanitizeTitles:
                workSpaceConfig.get<string[]>("atlassian.sanitizeTitles") ?? [],
        },
        testFiles:
            workSpaceConfig.get<string>("testFiles") ?? "**/*.spec.{js,ts}",
        xrayTestCaseAutocompletion: {
            enable:
                workSpaceConfig.get<boolean>(
                    "xrayTestCaseAutocompletion.enable"
                ) ?? false,
            customMethod:
                workSpaceConfig.get<string>(
                    "xrayTestCaseAutocompletion.customMethod"
                ) ?? "",
            provideIdOnly:
                workSpaceConfig.get<boolean>(
                    "xrayTestCaseAutocompletion.provideIdOnly"
                ) ?? false,
        },
    };
}

export async function promptToReloadWindow(
    event: vscode.ConfigurationChangeEvent
) {
    console.log(
        "Configuration changed:",
        event.affectsConfiguration("vscode-xray-viewer")
    );
    const shouldReload = event.affectsConfiguration("vscode-xray-viewer");

    if (!shouldReload) {
        return;
    }

    const action = "Reload";
    const selected = await vscode.window.showInformationMessage(
        'Please reload window in order for changes in extension "vscode-xray-viewer" configuration to take effect.',
        { modal: true },
        action
    );

    if (selected === action) {
        vscode.commands.executeCommand("workbench.action.reloadWindow");
    }
}

export const getCustomMethodArgument = (text: string, method: string) => {
    const pattern = new RegExp(`${method}\\("([^"]+)"\\)`);
    const matches = text.trim().match(pattern);
    const customMethodArg = matches?.at(1)?.replace(/['"]/g, "") ?? "";
    return customMethodArg;
};
