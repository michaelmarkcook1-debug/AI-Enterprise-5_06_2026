export interface AlertRules {
  rankChangeThreshold: number;   // alert if rank moves by this many positions
  scoreChangeThreshold: number;  // alert if overallScore changes by this many points
  // Index signature makes AlertRules structurally compatible with Prisma's
  // InputJsonObject (all values are JSON-safe numbers), so it can be written
  // directly to the `alertRules` Json column without an `as` cast.
  [key: string]: number;
}

export interface WatchlistWithAlerts {
  id: string;
  vendors: string[];
  email: string | null;
  alertRules: AlertRules;
}
