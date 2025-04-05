# vscode-xray-viewer README

Just some random extension to calculate some coverage stuff for pw and xray and make it 1% more fun.

Will not work for you if:

-   you do not have xray (so lucky!)
-   you have some other ways of linking tests with xray id rather than `someMethod("id")` or `someMethod("url")`
-   you do not have atlassian credentials (username and api key)

## Configuration

Example of `.vscode/settings.json`:

```json
"vscode-xray-viewer.atlassian": {
        "domain": "https://digital.atlassian.net",
        "username": "oleksandr@hello.com",
        "apiKey": "ATATATATATATATATATATATATATATATATA",
        "project": "ATA",
        "sanitizeTitles": ["ATA|DIGITAL|"],
        "query": "project = \"ATA\" AND type = Test AND status = Closed AND textfields ~ \"ATA|DIGITAL\" ORDER BY created DESC",
    },
    "vscode-xray-viewer.testFiles": "**/tests/**/*.spec.{js,ts}",
    "vscode-xray-viewer.xrayTestCaseAutocompletion": {
        "enable": true,
        "customMethod": "coversTestCase",
        "provideIdOnly": true
    }
```

And the method to attach test cases to playwright tests:

```typescript
const domain = process.env.ATLASSIAN_DOMAIN;
const project = process.env.ATLASSIAN_PROJECT;

export const coversTestCase = (id?: string) => {
    if (!id) {
        return;
    }

    test.info().annotations.push(
        {
            type: "xray test case id",
            description: id,
        },
        {
            type: "xray test case url",
            description: `${domain}/browse/${project}-${id}`,
        }
    );
};
```
