import { cn } from '@/lib/utils';

interface TabNavigationProps {
  activeTab: 'chat' | 'review';
  onChangeTab: (tab: 'chat' | 'review') => void;
}

export function TabNavigation({ activeTab, onChangeTab }: TabNavigationProps) {
  const tabs = [
    { id: 'chat' as const, label: 'Chat' },
    { id: 'review' as const, label: 'Review' },
  ];

  return (
    <div className="flex-shrink-0 flex border-b border-border px-4">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChangeTab(tab.id)}
          className={cn(
            'relative px-3 py-2 text-xs font-medium tracking-wide uppercase transition-colors',
            activeTab === tab.id
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {tab.label}
          {activeTab === tab.id && (
            <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-primary rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
}
