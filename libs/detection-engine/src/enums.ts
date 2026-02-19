export enum Severity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum AlertStatus {
  OPEN = 'open',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

export enum RuleName {
  PUSH_TIME_ANOMALY = 'push-time-anomaly',
  HACKER_TEAM = 'hacker-team',
  RAPID_REPO_DELETE = 'rapid-repo-delete',
}
