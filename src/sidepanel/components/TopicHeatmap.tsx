import { COMPACT_CATEGORIES } from "@/shared/categoryMap";
import { Card } from "@/components/ui/card";
import { SubmissionRecord } from "@/shared/types/submitting";

export type ProficiencyLevel = 'none' | 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type PatternProficiency = {
    category: string;
    problemCount: number;
    avgTime: number;
    totalTime: number;
    score: number;
    level: ProficiencyLevel;
}

const levelColors: Record<string, string> = {
    "none": "bg-gray-100 text-gray-800",
    "beginner": "bg-green-100 text-green-800",
    "intermediate": "bg-blue-100 text-blue-800",
    "advanced": "bg-purple-100 text-purple-800",
    "expert": "bg-orange-100 text-orange-800",
}

export function computeProficiencyScore(
    submissions: Record<string, SubmissionRecord[]>
): PatternProficiency[] {
    return [{} as PatternProficiency]; // Placeholder
}

export function TopicHeatmap() {
    return (
        <div className="grid grid-cols-2 gap-2">
            {COMPACT_CATEGORIES.map(cat => (
                <Card key={cat} className="p-4">
                    <div className="font-semibold mb-2">{cat}</div>
                </Card>
            ))}
        </div>
    )
}