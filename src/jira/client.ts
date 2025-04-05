import * as vscode from "vscode";
//@ts-expect-error no types provided by that lib
import got from "got";
import { config } from "../utils";
import { JiraTestCase } from "./storage";

interface JiraDescription {
    content?: {
        content?: {
            text: string;
        }[];
    }[];
}

interface JiraIssue {
    key: string;
    self: string;
    fields: {
        summary: string;
        description?: JiraDescription;
        issueLinks?: {
            outwardIssue?: {
                fields: {
                    issuetype: {
                        name: string;
                    };
                };
            };
            key: string;
            self: string;
            fields: {
                summary: string;
                description: JiraDescription;
            };
        }[];
    };
}

export class JiraClient {
    domain: string;
    username: string;
    apiKey: string;
    project: string;
    query: string;
    shouldGroupByEpic: boolean;
    sanitizeTitles: string[];

    constructor() {
        const cfg = config();
        this.domain = cfg.atlassian.domain;
        this.username = cfg.atlassian.username;
        this.apiKey = cfg.atlassian.apiKey;
        this.project = cfg.atlassian.project;
        this.query = cfg.atlassian.query;
        this.shouldGroupByEpic = cfg.atlassian.shouldGroupByEpic;
        this.sanitizeTitles = cfg.atlassian.sanitizeTitles;
    }

    private jiraQuery(offset = 0) {
        const query = this.query ?? `project = ${this.project} AND type=test`;
        return `${this.domain}/rest/api/3/search?jql=${query}&startAt=${offset}`;
    }

    async getTestCases(offset: number) {
        const requiredFields = [
            this.domain,
            this.username,
            this.apiKey,
            this.project,
        ];

        if (requiredFields.some((field) => !field)) {
            vscode.window.showErrorMessage(
                "Please provide all required fields in the configuration for atlassian - domain, username, apiKey, project"
            );
            return;
        }

        const query = this.jiraQuery(offset);

        const token = Buffer.from(`${this.username}:${this.apiKey}`).toString(
            "base64"
        );

        const response = await got
            .get(query, {
                headers: {
                    Authorization: `Basic ${token}`,
                },
            })
            .json();

        return response as {
            total: number;
            maxResults: number;
            issues: JiraIssue[];
        };
    }

    async getAllTestCases() {
        const testCases: JiraTestCase[] = [];
        let offset = 0;
        let total = 0;

        const getTestCases = async (offset: number) =>
            this.getTestCases(offset);
        const sanitizeTitles = this.sanitizeTitles;

        return vscode.window
            .withProgress(
                {
                    location: 15, // notification
                    title: `Reading XRay test cases for project "${this.project}"\n`,
                    cancellable: true,
                },
                async function (progress, token) {
                    token.onCancellationRequested(() => {
                        console.log("User canceled test cases downloading");
                    });

                    progress.report({ increment: 0 });

                    while (offset < total || total === 0) {
                        const cases = await getTestCases(offset);

                        const getIssueParents = (issue: JiraIssue) => {
                            const parents = issue.fields.issueLinks?.filter(
                                (link) =>
                                    link.outwardIssue?.fields.issuetype.name ===
                                    "Epic"
                            );
                            if (!parents?.length) {
                                return;
                            }
                            return parents.map((parent) => ({
                                title: parent.fields.summary,
                                key: parent.key,
                                url: parent.self,
                            }));
                        };

                        if (!cases || !cases.issues?.length) {
                            return;
                        }

                        const sanitized = (title: string) => {
                            if (!sanitizeTitles?.length) {
                                return title;
                            }
                            const sanitizedTitle = sanitizeTitles.reduce(
                                (acc, regex) => acc.replace(regex, ""),
                                title
                            );
                            return sanitizedTitle;
                        };

                        const currentPage = cases?.issues.map((issue) => {
                            const target = {
                                key: issue.key,
                                url: issue.self,
                                summary: sanitized(issue.fields.summary),
                                description:
                                    issue.fields.description?.content
                                        ?.map((p) =>
                                            p?.content
                                                ?.map((line) => line.text)
                                                .join("\n")
                                        )
                                        .join("\n") ?? "",
                                parents: getIssueParents(issue),
                            };
                            return target;
                        });

                        total = cases.total;
                        offset += cases.maxResults;
                        testCases.push(
                            ...currentPage.map((issue) => ({
                                key: issue.key,
                                summary: issue.summary,
                                url: issue.url,
                            }))
                        );

                        progress.report({
                            increment:
                                total >= cases.maxResults
                                    ? (cases.maxResults / total) * 100
                                    : 100,
                            message: `${testCases.length}/${total}`,
                        });
                    }
                }
            )
            .then(() => {
                return testCases;
            });
    }
}
