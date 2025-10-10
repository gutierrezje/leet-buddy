import { COMPACT_CATEGORIES } from "@/shared/categoryMap";
import { Card } from "@/components/ui/card";

export function PatternHeatmap() {
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