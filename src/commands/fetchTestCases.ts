import { ticketStorage } from "../jira/storage";

export const fetchTestCases = async () => {
    await ticketStorage.updateCache();
};
