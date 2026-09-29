export type Reflection = {
  affirmation: string;
  perspective: string;
  tomorrowAction: string;
  isDemo?: boolean;
};

export type JournalEntry = {
  date: string;
  detox: string;
  good: string;
  motto: string;
  reflection: Reflection;
  updatedAt: string;
};

export type JournalEntries = Record<string, JournalEntry>;

export type GrowthInsight = {
  title: string;
  evidence: string;
};

export type GrowthReport = {
  overview: string;
  strengths: GrowthInsight[];
  changes: GrowthInsight[];
  recurringTheme: string;
  nextStep: string;
  generatedAt: string;
  sourceEntryCount: number;
  sourceUpdatedAt: string;
  isDemo?: boolean;
};
