import { ExternalLink, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function EmptyState() {
  const handleRandomProblem = () => {
    // Open a random LeetCode problem in a new tab
    window.open('https://leetcode.com/problemset/', '_blank');
  };

  return (
    <div className="flex items-center justify-center h-full p-6">
      <Card className="max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Lightbulb className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">Ready to Practice?</CardTitle>
          <CardDescription className="text-base mt-2">
            Navigate to a LeetCode problem page to get started with your AI
            coding interview assistant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>LeetBuddy will help you by:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Asking guiding questions</li>
              <li>Providing strategic hints</li>
              <li>Tracking your solving time</li>
              <li>Reviewing your progress</li>
            </ul>
          </div>
          <Button
            className="w-full"
            onClick={handleRandomProblem}
            variant="default"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Browse LeetCode Problems
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
