export type SubmissionStatus = "Accepted" | "Failed";

export interface SubmissionRecord {
    submissionId: string;
    status: SubmissionStatus;
    at: number;
}

const PREFIX = "submissions::";
export const MAX_SUBMISSIONS_PER_PROBLEM = 5;

function keyFor(slug: string) {
    return `${PREFIX}${slug}`;
}

export function saveSubmission(
    slug: string,
    rec: SubmissionRecord,
    max: number = MAX_SUBMISSIONS_PER_PROBLEM
) {
    const key = keyFor(slug);
    chrome.storage.local.get([key], (data) => {
        const current: SubmissionRecord[] = Array.isArray(data[key])
            ? data[key]
            : [];
        // de-dupe the submissionId and keep the newest at the front
        const next = [rec, ...current.filter(s => s.submissionId !== rec.submissionId)]
            .sort((a, b) => b.at - a.at)
            .slice(0, max);
        chrome.storage.local.set({ [key]: next }, () => void chrome.runtime.lastError);
    });
}

export function getRecentSubmissions(slug: string): Promise<SubmissionRecord[]> {
    const key = keyFor(slug);
    return new Promise(resolve => {
        chrome.storage.local.get([key], data => {
            resolve(Array.isArray(data[key]) ? data[key] : []);
        });
    });
}

export async function getAllRecentSubmissions(): Promise<Record<string, SubmissionRecord[]>> {
    return new Promise(resolve => {
        chrome.storage.local.get(null, items => {
            const out: Record<string, SubmissionRecord[]> = {};
            for (const [k, v] of Object.entries(items)) {
                if (k.startsWith(PREFIX) && Array.isArray(v)) {
                    const slug = k.slice(PREFIX.length);
                    out[slug] = v as SubmissionRecord[];
                }
            }
            resolve(out);
        });
    })
}

export function clearSubmissions(slug?: string) {
    if (!slug) {
        // clear all problem submissions
        chrome.storage.local.get(null, items => {
            const keys = Object.keys(items).filter(k => k.startsWith(PREFIX));
            if (keys.length) {
                chrome.storage.local.remove(keys, () => void chrome.runtime.lastError);
            }
        });
        return;
    }
    chrome.storage.local.remove([keyFor(slug)], () => void chrome.runtime.lastError);
}