import { Button } from '@/components/ui/button';

interface TabNavigationProps {
  activeTab: 'chat' | 'review';
  onChangeTab: (tab: 'chat' | 'review') => void;
}

export function TabNavigation({ activeTab, onChangeTab }: TabNavigationProps) {
  return (
    <div className="flex border-b bg-background border-border">
      <Button
        className={`flex-1 justify-center bg-background rounded-none ${
          activeTab === 'chat'
            ? 'text-primary border-primary border-b hover:text-foreground '
            : 'text-foreground border-transparent'
        }`}
        onClick={() => onChangeTab('chat')}
      >
        Chat
      </Button>
      <Button
        className={`flex-1 justify-center bg-background rounded-none ${
          activeTab === 'review'
            ? 'text-primary border-primary border-b hover:text-foreground '
            : 'text-foreground border-transparent'
        }`}
        onClick={() => onChangeTab('review')}
      >
        Review
      </Button>
    </div>
  );
}
