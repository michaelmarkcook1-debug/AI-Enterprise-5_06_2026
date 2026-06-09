export interface AlertRules {
  rankChangeThreshold: number;   // alert if rank moves by this many positions
  scoreChangeThreshold: number;  // alert if overallScore changes by this many points
}

export interface WatchlistWithAlerts {
  id: string;
  vendors: string[];
  email: string | null;
  alertRules: AlertRules;
}
