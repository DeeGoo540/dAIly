"use client";

import {
  ArrowRight,
  BookHeart,
  CalendarCheck,
  CheckCircle2,
  Compass,
  RefreshCw,
  Sparkles,
  Sprout,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { GrowthReport, JournalEntries, JournalEntry } from "@/lib/types";

const GROWTH_STORAGE_KEY = "daily-growth-report-v1";
const MINIMUM_ENTRIES = 3;

function formatShortDate(dateKey?: string) {
  if (!dateKey) return "—";
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(year, month - 1, day));
}

function calculateStreak(entries: JournalEntry[]) {
  if (!entries.length) return 0;
  const descending = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 1;
  for (let index = 1; index < descending.length; index += 1) {
    const current = new Date(`${descending[index - 1].date}T00:00:00`);
    const previous = new Date(`${descending[index].date}T00:00:00`);
    const difference = Math.round((current.getTime() - previous.getTime()) / 86_400_000);
    if (difference !== 1) break;
    streak += 1;
  }
  return streak;
}

export function GrowthDashboard({
  entries,
  onWriteJournal,
}: {
  entries: JournalEntries;
  onWriteJournal: () => void;
}) {
  const [report, setReport] = useState<GrowthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const entryList = useMemo(
    () => Object.values(entries).sort((a, b) => a.date.localeCompare(b.date)),
    [entries],
  );
  const analysisEntries = entryList.slice(-30);
  const entryCount = entryList.length;
  const remaining = Math.max(MINIMUM_ENTRIES - entryCount, 0);
  const progress = Math.min((entryCount / MINIMUM_ENTRIES) * 100, 100);
  const streak = calculateStreak(entryList);
  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const thisMonthCount = entryList.filter((entry) => entry.date.startsWith(currentMonthPrefix)).length;
  const latestEntryUpdate = entryList.reduce(
    (latest, entry) => (entry.updatedAt > latest ? entry.updatedAt : latest),
    "",
  );
  const reportIsStale = Boolean(
    report && (report.sourceEntryCount !== entryCount || report.sourceUpdatedAt !== latestEntryUpdate),
  );

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(GROWTH_STORAGE_KEY);
      if (stored) {
        // Local Storage is an external system, so it is hydrated after mount.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setReport(JSON.parse(stored) as GrowthReport);
      }
    } catch {
      window.localStorage.removeItem(GROWTH_STORAGE_KEY);
    }
  }, []);

  async function generateReport() {
    if (entryCount < MINIMUM_ENTRIES || loading) return;
    setLoading(true);
    setError("");
    const startedAt = Date.now();

    try {
      const response = await fetch("/api/growth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: analysisEntries.map(({ date, detox, good, motto }) => ({ date, detox, good, motto })),
        }),
      });
      const data = (await response.json()) as Omit<GrowthReport, "generatedAt" | "sourceEntryCount" | "sourceUpdatedAt"> & {
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "成長レポートを作成できませんでした。");

      const minimumWait = 1200 - (Date.now() - startedAt);
      if (minimumWait > 0) await new Promise((resolve) => window.setTimeout(resolve, minimumWait));

      const nextReport: GrowthReport = {
        ...data,
        generatedAt: new Date().toISOString(),
        sourceEntryCount: entryCount,
        sourceUpdatedAt: latestEntryUpdate,
      };
      setReport(nextReport);
      window.localStorage.setItem(GROWTH_STORAGE_KEY, JSON.stringify(nextReport));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "予期しないエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="growth-workspace">
      <aside className="growth-stats">
        <div className="section-label"><TrendingUp size={15} /> YOUR JOURNEY</div>
        <div className="growth-ring" style={{ "--progress": `${progress}%` } as React.CSSProperties}>
          <div>
            <strong>{entryCount}</strong>
            <span>DAYS</span>
          </div>
        </div>
        <h2>{remaining > 0 ? `あと${remaining}日で振り返れます` : "振り返る準備ができました"}</h2>
        <p>日々の小さな言葉が、少しずつあなたの歩みになります。</p>

        <div className="growth-stat-grid">
          <div><CalendarCheck size={17} /><strong>{thisMonthCount}</strong><span>今月の記録</span></div>
          <div><Sprout size={17} /><strong>{streak}</strong><span>連続した記録</span></div>
        </div>

        <div className="growth-period">
          <span>記録の期間</span>
          <strong>{formatShortDate(entryList[0]?.date)} — {formatShortDate(entryList.at(-1)?.date)}</strong>
        </div>
        <button type="button" className="today-button" onClick={onWriteJournal}>
          今日の日記を書く <ArrowRight size={14} />
        </button>
      </aside>

      <section className="growth-report-panel">
        <div className="growth-report-heading">
          <div>
            <span className="journal-heading__date">GROWTH REFLECTION</span>
            <h2>言葉の中にある、あなたの変化。</h2>
            <p>直近最大30件の記録を比べ、書かれている事実をもとに振り返ります。</p>
          </div>
          <button
            type="button"
            className="growth-generate-button"
            disabled={entryCount < MINIMUM_ENTRIES || loading}
            onClick={generateReport}
          >
            {loading ? <RefreshCw className="spin" size={17} /> : <Sparkles size={17} />}
            {report ? "レポートを更新" : "成長を振り返る"}
          </button>
        </div>

        {error && <p className="error-message" role="alert">{error}</p>}

        {!report && (
          <div className="growth-empty">
            <div className="growth-empty__illustration">
              <span><Sprout size={29} /></span>
              <i /><i /><i />
            </div>
            <h3>{remaining > 0 ? "まずは3日分、言葉を重ねてみましょう。" : "最初の成長レポートを作りましょう。"}</h3>
            <p>
              {remaining > 0
                ? "比較できる記録が集まると、繰り返し現れる強みや小さな変化を見つけられます。"
                : "AIが過去の記録を読み、あなたが積み重ねてきたものを丁寧に言葉にします。"}
            </p>
          </div>
        )}

        {report && (
          <article className="growth-report" aria-live="polite">
            <div className="growth-report__meta">
              <span><BookHeart size={14} /> {Math.min(report.sourceEntryCount, 30)}日分から見つけたこと</span>
              <span>{new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(new Date(report.generatedAt))}</span>
            </div>
            {reportIsStale && <p className="report-update-note"><Sprout size={14} /> 新しい日記があります。更新すると、最新の変化を反映できます。</p>}
            <div className="growth-overview">
              <span><Sparkles size={15} /> OVERVIEW</span>
              <p>{report.overview}</p>
              {report.isDemo && <small>APIキー未設定のため、現在はデモ分析です</small>}
            </div>

            <div className="growth-columns">
              <section>
                <div className="growth-section-title"><CheckCircle2 size={18} /><div><span>STRENGTHS</span><h3>積み重なっている強み</h3></div></div>
                <div className="insight-list">
                  {report.strengths.map((insight) => (
                    <div className="insight-item" key={`${insight.title}-${insight.evidence}`}>
                      <i />
                      <div><strong>{insight.title}</strong><p>{insight.evidence}</p></div>
                    </div>
                  ))}
                </div>
              </section>
              <section>
                <div className="growth-section-title"><TrendingUp size={18} /><div><span>CHANGES</span><h3>見えてきた小さな変化</h3></div></div>
                <div className="insight-list">
                  {report.changes.map((insight) => (
                    <div className="insight-item" key={`${insight.title}-${insight.evidence}`}>
                      <i />
                      <div><strong>{insight.title}</strong><p>{insight.evidence}</p></div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="growth-bottom-grid">
              <section><span>RECURRING THEME</span><h3>何度も心に現れていること</h3><p>{report.recurringTheme}</p></section>
              <section><Compass size={20} /><span>NEXT FOCUS</span><h3>これからの小さな焦点</h3><p>{report.nextStep}</p></section>
            </div>
          </article>
        )}
      </section>
    </div>
  );
}
