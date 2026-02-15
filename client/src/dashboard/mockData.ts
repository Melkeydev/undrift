export interface TimeTrackingEntry {
  date: string;
  domain: string;
  seconds: number;
}

export interface Session {
  id: string;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number;
  blockedSites: string[];
  endReason: 'timer' | 'manual' | 'browser_closed';
  completed: boolean;
  interruptions: Interruption[];
}

export interface Interruption {
  timestamp: string;
  domain: string;
  outcome: 'stayed' | 'broke';
}

export interface OverviewStats {
  todayScreenTime: number;
  sessionsToday: number;
  interruptionsResisted: number;
  weeklyTrend: { date: string; seconds: number }[];
  totalSessions: number;
  avgSessionMinutes: number;
  completionRate: number;
  mostResistedSite: string;
}

export interface Settings {
  personalReason: string;
  notificationPrefs: {
    timeLimit: boolean;
    dailySummary: boolean;
  };
}

export interface SiteBreakdown {
  domain: string;
  todaySeconds: number;
  weekAvgSeconds: number;
  monthTotalSeconds: number;
  trendPercent: number;
}
