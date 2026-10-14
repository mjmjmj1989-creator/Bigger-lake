import React from 'react';
import { Beer, Wine, DollarSign, Archive, History } from 'lucide-react';

export type ActiveTab = 'taps' | 'spirits' | 'deposits' | 'cooler' | 'logs';

interface TabNavigationProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  pendingDepositsCount: number;
  lowStockCount: number;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  onTabChange,
  pendingDepositsCount,
  lowStockCount,
}) => {
  const tabs = [
    {
      id: 'taps' as ActiveTab,
      label: 'Tap Manager',
      shortLabel: 'Taps',
      icon: Beer,
      badge: '30 Taps',
      badgeColor: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
    },
    {
      id: 'spirits' as ActiveTab,
      label: 'Fast Spirit Pulls',
      shortLabel: 'Spirits',
      icon: Wine,
    },
    {
      id: 'deposits' as ActiveTab,
      label: '$30 Keg Deposits',
      shortLabel: 'Deposits',
      icon: DollarSign,
      badge: pendingDepositsCount > 0 ? `${pendingDepositsCount} Active` : undefined,
      badgeColor: 'bg-emerald-500/20 text-emerald-300',
    },
    {
      id: 'cooler' as ActiveTab,
      label: 'Cooler & Stock',
      shortLabel: 'Cooler',
      icon: Archive,
      badge: lowStockCount > 0 ? `${lowStockCount} Low` : undefined,
      badgeColor: 'bg-rose-500/20 text-rose-300',
    },
    {
      id: 'logs' as ActiveTab,
      label: 'Logs & History',
      shortLabel: 'Logs',
      icon: History,
    },
  ];

  return (
    <div className="bg-slate-900/90 border-b border-slate-800 px-3 py-2 sticky top-[57px] z-20 backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm whitespace-nowrap transition-all touch-manipulation cursor-pointer select-none flex-1 sm:flex-initial justify-center ${
                isActive
                  ? 'bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-600/30 ring-2 ring-blue-400/50'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80 active:bg-slate-750'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white stroke-[2.5]' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>

              {tab.badge && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                    isActive ? 'bg-slate-950/20 text-slate-950' : tab.badgeColor
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
