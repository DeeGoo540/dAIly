"use client";

import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CloudSun,
  Feather,
  Leaf,
  LockKeyhole,
  Sparkles,
  Target,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { JournalEntries, Reflection } from "@/lib/types";
import { GrowthDashboard } from "@/components/growth-dashboard";

const STORAGE_KEY = "daily-journal-entries-v1";
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const MONTH_NAMES = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
];

type FormValues = {
  detox: string;
  good: string;
  motto: string;
};

const EMPTY_FORM: FormValues = { detox: "", good: "", motto: "" };

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sameDate(a: Date, b: Date) {
  return toDateKey(a) === toDateKey(b);
}

function getCalendarDays(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const lastDate = new Date(year, monthIndex + 1, 0).getDate();
  const previousLastDate = new Date(year, monthIndex, 0).getDate();

  return Array.from({ length: 42 }, (_, index) => {
    const dayOffset = index - firstWeekday + 1;
    if (dayOffset < 1) {
      return {
        date: new Date(year, monthIndex - 1, previousLastDate + dayOffset),
        inCurrentMonth: false,
      };
    }
    if (dayOffset > lastDate) {
      return {
        date: new Date(year, monthIndex + 1, dayOffset - lastDate),
        inCurrentMonth: false,
      };
    }
    return { date: new Date(year, monthIndex, dayOffset), inCurrentMonth: true };
  });
}

function formatSelectedDate(date: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

function InputCard({
  id,
  eyebrow,
  title,
  description,
  placeholder,
  value,
  onChange,
  tone,
  icon,
}: {
  id: keyof FormValues;
  eyebrow: string;
  title: string;
  description: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  tone: "detox" | "good" | "motto";
  icon: React.ReactNode;
}) {
  return (
    <section className={`input-card input-card--${tone}`}>
      <div className="input-card__icon" aria-hidden="true">
        {icon}
      </div>
      <div className="input-card__body">
        <div className="input-card__heading">
          <div>
            <span className="input-card__eyebrow">{eyebrow}</span>
            <h3>{title}</h3>
          </div>
          <span className="char-count">{value.length}/800</span>
        </div>
        <p>{description}</p>
        <label className="sr-only" htmlFor={id}>
          {title}
        </label>
        <textarea
          id={id}
          name={id}
          value={value}
          maxLength={800}
          rows={4}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </section>
  );
}

export function JournalApp() {
  const [view, setView] = useState<"journal" | "growth">("journal");
  const [today] = useState(() => startOfDay(new Date()));
  const [selectedDate, setSelectedDate] = useState(today);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [entries, setEntries] = useState<JournalEntries>({});
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [reflection, setReflection] = useState<Reflection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedKey = toDateKey(selectedDate);
  const calendarDays = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);
  const isFuture = selectedDate.getTime() > today.getTime();
  const isComplete = Boolean(form.detox.trim() && form.good.trim() && form.motto.trim());

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const storedEntries = JSON.parse(stored) as JournalEntries;
        const currentEntry = storedEntries[toDateKey(today)];
        // Local Storage is an external system, so it is hydrated after mount.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setEntries(storedEntries);
        if (currentEntry) {
          setForm({
            detox: currentEntry.detox,
            good: currentEntry.good,
            motto: currentEntry.motto,
          });
          setReflection(currentEntry.reflection);
        }
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [today]);

  function selectDate(date: Date) {
    if (date.getTime() > today.getTime()) return;
    const entry = entries[toDateKey(date)];
    setSelectedDate(date);
    setForm(entry ? { detox: entry.detox, good: entry.good, motto: entry.motto } : EMPTY_FORM);
    setReflection(entry?.reflection ?? null);
    setError("");
    if (date.getMonth() !== visibleMonth.getMonth() || date.getFullYear() !== visibleMonth.getFullYear()) {
      setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  }

  function updateField(field: keyof FormValues, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    if (error) setError("");
  }

  async function submitJournal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isComplete || isFuture || loading) return;

    setLoading(true);
    setError("");
    const startedAt = Date.now();

    try {
      const response = await fetch("/api/reflection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedKey, ...form }),
      });
      const data = (await response.json()) as Reflection & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "AIからの返事を受け取れませんでした。");

      const minimumWait = 1200 - (Date.now() - startedAt);
      if (minimumWait > 0) await new Promise((resolve) => window.setTimeout(resolve, minimumWait));

      const nextEntries: JournalEntries = {
        ...entries,
        [selectedKey]: {
          date: selectedKey,
          ...form,
          reflection: data,
          updatedAt: new Date().toISOString(),
        },
      };
      setEntries(nextEntries);
      setReflection(data);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEntries));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "予期しないエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient--one" />
      <div className="ambient ambient--two" />

      <header className="topbar">
        <a className="brand" href="#top" aria-label="dAIly ホーム">
          <span className="brand__mark"><Leaf size={18} strokeWidth={1.8} /></span>
          <span className="brand__name">d<span>AI</span>ly</span>
        </a>
        <nav className="view-switch" aria-label="表示を切り替える">
          <button
            type="button"
            className={view === "journal" ? "is-active" : ""}
            aria-pressed={view === "journal"}
            onClick={() => setView("journal")}
          ><BookOpen size={14} /> 日記</button>
          <button
            type="button"
            className={view === "growth" ? "is-active" : ""}
            aria-pressed={view === "growth"}
            onClick={() => setView("growth")}
          ><BarChart3 size={14} /> 成長</button>
        </nav>
        <div className="privacy-pill"><LockKeyhole size={14} /> この端末に保存</div>
      </header>

      <section className="hero" id="top">
        <div>
          <p className="hero__kicker"><Sparkles size={14} /> {view === "journal" ? "A quiet moment for you" : "Your small steps, remembered"}</p>
          {view === "journal" ? (
            <h1>今日をほどいて、<br /><em>明日を少し好きになる。</em></h1>
          ) : (
            <h1>歩いてきた日々に、<br /><em>小さな変化を見つける。</em></h1>
          )}
        </div>
        <p className="hero__copy">
          {view === "journal" ? (
            <>うまく言葉にできなくても大丈夫。<br />3つの問いから、今日のあなたを一緒に見つめます。</>
          ) : (
            <>過去の言葉を比べると、昨日までは<br />気づけなかったあなたの歩みが見えてきます。</>
          )}
        </p>
      </section>

      {view === "journal" && (
      <div className="workspace">
        <aside className="calendar-panel" aria-label="日付を選ぶ">
          <div className="section-label"><CalendarDays size={15} /> YOUR DAYS</div>
          <div className="calendar-heading">
            <div>
              <strong>{visibleMonth.getFullYear()}</strong>
              <h2>{MONTH_NAMES[visibleMonth.getMonth()]}</h2>
            </div>
            <div className="calendar-nav">
              <button
                type="button"
                aria-label="前の月"
                onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              ><ChevronLeft size={18} /></button>
              <button
                type="button"
                aria-label="次の月"
                onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              ><ChevronRight size={18} /></button>
            </div>
          </div>

          <div className="calendar-grid calendar-grid--weekdays" aria-hidden="true">
            {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
          </div>
          <div className="calendar-grid" role="grid" aria-label={`${visibleMonth.getFullYear()}年${visibleMonth.getMonth() + 1}月`}>
            {calendarDays.map(({ date, inCurrentMonth }) => {
              const key = toDateKey(date);
              const future = date.getTime() > today.getTime();
              const selected = sameDate(date, selectedDate);
              const hasEntry = Boolean(entries[key]);
              return (
                <button
                  type="button"
                  role="gridcell"
                  key={key}
                  aria-label={`${date.getMonth() + 1}月${date.getDate()}日${hasEntry ? "、記録あり" : ""}`}
                  aria-selected={selected}
                  disabled={future}
                  className={[
                    "calendar-day",
                    !inCurrentMonth ? "calendar-day--muted" : "",
                    selected ? "calendar-day--selected" : "",
                    sameDate(date, today) ? "calendar-day--today" : "",
                    hasEntry ? "calendar-day--written" : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => selectDate(date)}
                >
                  <span>{date.getDate()}</span>
                  {hasEntry && <i aria-hidden="true" />}
                </button>
              );
            })}
          </div>

          <div className="calendar-legend">
            <span><i className="legend-dot legend-dot--filled" />記録した日</span>
            <span><i className="legend-dot legend-dot--today" />今日</span>
          </div>
          <button
            className="today-button"
            type="button"
            onClick={() => {
              selectDate(today);
              setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
            }}
          >今日に戻る <ArrowRight size={14} /></button>
        </aside>

        <section className="journal-panel">
          <div className="journal-heading">
            <div>
              <span className="journal-heading__date">{formatSelectedDate(selectedDate)}</span>
              <h2>{sameDate(selectedDate, today) ? "今日の心を、置いていこう。" : "この日の記録を、振り返る。"}</h2>
            </div>
            {entries[selectedKey] && <span className="saved-badge"><Check size={13} /> 保存済み</span>}
          </div>

          <form onSubmit={submitJournal}>
            <div className="input-stack">
              <InputCard
                id="detox"
                eyebrow="01 / LET IT GO"
                title="DETOX"
                description="頭の中のモヤモヤを、ここに置いていきましょう。"
                placeholder="今日ひっかかったこと、言えなかったこと…"
                value={form.detox}
                onChange={(value) => updateField("detox", value)}
                tone="detox"
                icon={<CloudSun size={21} />}
              />
              <InputCard
                id="good"
                eyebrow="02 / NOTICE YOURSELF"
                title="GOOD"
                description="どんなに小さくても、今日のあなたの良かったところ。"
                placeholder="起きられた、誰かに優しくできた、頑張った…"
                value={form.good}
                onChange={(value) => updateField("good", value)}
                tone="good"
                icon={<Feather size={21} />}
              />
              <InputCard
                id="motto"
                eyebrow="03 / ONE STEP"
                title="MOTTO"
                description="明日を少し良くするために、できそうなことは？"
                placeholder="明日は5分早く寝る、ひとこと声をかける…"
                value={form.motto}
                onChange={(value) => updateField("motto", value)}
                tone="motto"
                icon={<Target size={21} />}
              />
            </div>

            {error && <p className="error-message" role="alert">{error}</p>}

            <div className="submit-row">
              <p><Brain size={15} /> 3つの言葉をAIが大切に読み解きます</p>
              <button className="submit-button" type="submit" disabled={!isComplete || isFuture || loading}>
                <span>{reflection ? "もう一度、言葉をもらう" : "今日を振り返る"}</span>
                <Sparkles size={18} />
              </button>
            </div>
          </form>

          {reflection && (
            <article className="reflection-card" aria-live="polite">
              <div className="reflection-card__topline">
                <span><Sparkles size={15} /> A LETTER FOR YOU</span>
                {reflection.isDemo && <small>DEMO RESPONSE</small>}
              </div>
              <h2>今日のあなたへ</h2>
              <p className="reflection-lead">{reflection.affirmation}</p>
              <div className="reflection-divider"><span>✦</span></div>
              <div className="reflection-grid">
                <section>
                  <span className="reflection-number">01</span>
                  <h3>心に置いておきたいこと</h3>
                  <p>{reflection.perspective}</p>
                </section>
                <section>
                  <span className="reflection-number">02</span>
                  <h3>明日への小さな一歩</h3>
                  <p>{reflection.tomorrowAction}</p>
                </section>
              </div>
              <footer>あなたのペースで、大丈夫。 <Leaf size={15} /></footer>
            </article>
          )}
        </section>
      </div>
      )}

      {view === "growth" && (
        <GrowthDashboard entries={entries} onWriteJournal={() => setView("journal")} />
      )}

      <footer className="site-footer">
        <span>dAIly</span>
        <p>Small reflections, meaningful days.</p>
      </footer>

      {loading && (
        <div className="loading-screen" role="status" aria-live="assertive">
          <div className="loading-orbit">
            <span /><span /><span />
            <Sparkles size={27} />
          </div>
          <p>AIがあなたの言葉を<br /><strong>大切に読んでいます...</strong></p>
          <small>少しだけ、深呼吸してお待ちください</small>
        </div>
      )}
    </main>
  );
}
