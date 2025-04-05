import { config } from "../utils";
import { JiraClient } from "./client";

export interface JiraTestCase {
    key: string;
    summary: string;
    url: string;
}

class JiraStorage {
    public testCases: JiraTestCase[];
    public client: JiraClient;
    public project: string;
    private isLocked: boolean = false;

    constructor() {
        const cfg = config();
        this.testCases = [];
        this.project = cfg.atlassian.project;
        this.client = new JiraClient();
    }

    async get(): Promise<JiraTestCase[]> {
        if (this.testCases.length) {
            return this.testCases;
        }

        if (this.isLocked) {
            return [];
        }
        await this.updateCache();
        return this.get();
    }

    async updateCache() {
        this.isLocked = true;
        const cases = await this.client.getAllTestCases();
        this.isLocked = false;

        if (cases.length) {
            this.testCases = cases;
            return this.get();
        }

        return [];
    }
}

export const ticketStorage = new JiraStorage();
