// GoalsPage.tsx — lives under the Growth nav group. Owners set revenue/job/
// client/lead targets with an optional deadline + reward here directly (this
// used to be read-only, pointing owners at Accountability's Goals tab to
// actually add one — moved here in full per owner request, along with
// business-metric goals that auto-track from real jobs/customers data
// instead of needing a manual number typed in every time).
import React, { useState } from "react";
import { Target, Clock, Gift, CheckCircle2, AlertTriangle, Plus, Trash2, TrendingUp, Briefcase, Users, Repeat, UserPlus, Sparkles, Settings as SettingsIcon } from "lucide-react";
import { Glass } from "../ui/Glass";
import { GBtn } from "../ui/GBtn";
import { GInput } from "../ui/GInput";
import { GDate } from "../ui/GDate";
import { GSel } from "../ui/GSel";
import { Badge } from "../ui/Badge";
import { PBar } from "../ui/PBar";
import { PageFade } from "../ui/PageFade";
import { today, uid, fmt, computeGoalProgress, localDateKey } from "../../lib/utils";

const METRICS = [
  { id: "revenue",         label: "Revenue",          icon: TrendingUp, unit: "$",  auto: true  },
  { id: "jobs",             label: "Jobs Completed",   icon: Briefcase,  unit: "",   auto: true  },
  { id: "clients",          label: "New Clients",      icon: Users,      unit: "",   auto: true  },
  { id: "recurringClients", label: "Recurring Clients",icon: Repeat,     unit: "",   auto: true  },
  { id: "leads",            label: "Leads",            icon: UserPlus,   unit: "",   auto: true  },
  { id: "custom",           label: "Custom (manual)",  icon: Target,     unit: "",   auto: false },
] as const;

const metricMeta = (id: string) => METRICS.find(m => m.id === id) || METRICS[METRICS.length - 1];

export function GoalsPage({ goals = [], setGoals = (() => {}) as any, jobs = [], customers = [], estimates = [], toast, settings = {} as any, onOpenSettings }: { goals?: any[]; setGoals?: any; jobs?: any[]; customers?: any[]; estimates?: any[]; toast?: any; settings?: any; onOpenSettings?: () => void }) {
  const tKey = today();

  // FEATURE — "make sure the goals section inside Settings matches the
  // goals section here and that they sync." These are structurally two
  // different systems (this page's `goals` array is a custom, ad-hoc list
  // with deadlines/rewards; Settings' "Goals & Tax" panel is a handful of
  // simple recurring monthly/quarterly/annual scalar targets, the same ones
  // Dashboard.tsx's own Goals widget reads via `settings.monthlyRevenueGoal`/
  // `monthlyJobsGoal`) — merging them into one data model would be a much
  // bigger, riskier change than what was actually reported. This card reads
  // the SAME settings fields Dashboard uses (never a locally-duplicated
  // copy), so the number shown here can never drift from what Settings has
  // or what the Dashboard widget shows — that's the actual sync.
  const now = new Date();
  const monthStartStr = localDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
  const revMonthActual = estimates.filter((e: any) => !!e.paidAt && e.paidAt >= monthStartStr).reduce((s: number, e: any) => s + (Number(e.total) || 0), 0);
  const jobsMonthActual = jobs.filter((j: any) => j.status === "completed" && j.scheduledDate >= monthStartStr).length;
  const monthlyRevenueGoal = Number(settings.monthlyRevenueGoal) || 0;
  const monthlyJobsGoal = Number(settings.monthlyJobsGoal) || 0;
  const revGoalPct = monthlyRevenueGoal > 0 ? Math.round((revMonthActual / monthlyRevenueGoal) * 100) : 0;
  const jobsGoalPct = monthlyJobsGoal > 0 ? Math.round((jobsMonthActual / monthlyJobsGoal) * 100) : 0;
  const [formOpen, setFormOpen] = useState(false);
  const [fText, setFText] = useState("");
  const [fMetric, setFMetric] = useState<string>("revenue");
  const [fTarget, setFTarget] = useState("");
  const [fDeadline, setFDeadline] = useState("");
  const [fRewardAmount, setFRewardAmount] = useState("");
  const [fRewardDesc, setFRewardDesc] = useState("");

  const withMeta = goals.map((g: any) => {
    const { current, target, pct } = computeGoalProgress(g, { jobs, customers });
    const daysLeft = g.deadline ? Math.ceil((new Date(g.deadline + "T00:00:00").getTime() - new Date(tKey + "T00:00:00").getTime()) / 86400000) : null;
    const hoursLeft = g.deadline ? Math.max(0, Math.ceil(((new Date(g.deadline + "T23:59:59").getTime()) - Date.now()) / 3600000)) : null;
    const overdue = !g.done && daysLeft !== null && daysLeft < 0;
    const hasReward = !!(g.rewardAmount || g.rewardDescription);
    return { ...g, current, target, pct, daysLeft, hoursLeft, overdue, hasReward };
  });

  const activeGoals = withMeta.filter((g: any) => !g.done);
  const doneGoals = withMeta.filter((g: any) => g.done);
  const overdueCount = withMeta.filter((g: any) => g.overdue).length;
  const rewardsEarned = doneGoals.filter((g: any) => g.hasReward && g.metByDeadline).length;

  const resetForm = () => { setFText(""); setFMetric("revenue"); setFTarget(""); setFDeadline(""); setFRewardAmount(""); setFRewardDesc(""); };

  const addGoal = () => {
    const target = Number(fTarget);
    if (!fText.trim() || !target || target <= 0) { toast?.("Give the goal a name and a target greater than 0", "red"); return; }
    setGoals([...goals, {
      id: uid(), text: fText.trim(), category: "revenue", done: false, createdAt: tKey,
      metric: fMetric, target, current: 0,
      deadline: fDeadline || undefined,
      rewardAmount: fRewardAmount ? Number(fRewardAmount) : undefined,
      rewardDescription: fRewardDesc.trim() || undefined,
      remindedAt: null, celebratedAt: null,
    }]);
    resetForm();
    setFormOpen(false);
    toast?.("Goal added 🎯", "green");
  };

  const deleteGoal = (id: string) => setGoals(goals.filter((g: any) => g.id !== id));

  const adjustCustom = (g: any, delta: number) => {
    setGoals(goals.map((x: any) => {
      if (x.id !== g.id) return x;
      const nextCurrent = Math.max(0, (Number(x.current) || 0) + delta);
      const nowDone = nextCurrent >= (Number(x.target) || 0);
      const metByDeadline = nowDone && !x.done ? (x.deadline ? tKey <= x.deadline : true) : x.metByDeadline;
      return { ...x, current: nextCurrent, done: nowDone, completedAt: nowDone ? (x.completedAt || tKey) : null, metByDeadline };
    }));
  };

  const toggleDone = (g: any) => {
    setGoals(goals.map((x: any) => {
      if (x.id !== g.id) return x;
      const nowDone = !x.done;
      const metByDeadline = nowDone ? (x.deadline ? tKey <= x.deadline : true) : x.metByDeadline;
      if (nowDone && metByDeadline && (x.rewardAmount || x.rewardDescription)) {
        toast?.(`🎉 Goal met by deadline — reward unlocked: ${x.rewardDescription || ("$" + x.rewardAmount)}`, "green");
      }
      return { ...x, done: nowDone, completedAt: nowDone ? tKey : null, metByDeadline: nowDone ? metByDeadline : x.metByDeadline };
    }));
  };

  const fmtCountdown = (g: any) => {
    if (!g.deadline) return null;
    if (g.overdue) return `Overdue — was due ${g.deadline}`;
    if (g.daysLeft === 0) return `Due today — ${g.hoursLeft}h left`;
    if (g.daysLeft === 1) return "1 day left";
    return `${g.daysLeft} days left`;
  };

  const GoalCard = ({ g }: { g: any }) => {
    const meta = metricMeta(g.metric);
    const Icon = meta.icon;
    return (
      <Glass className={"p-4 " + (g.done ? "opacity-80" : g.overdue ? "border-danger-800/50" : "")}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Icon size={16} className="text-brand-400 flex-shrink-0" />
            <div className="min-w-0">
              <div className={"font-semibold text-sm truncate " + (g.done ? "line-through text-white/50" : "")}>{g.text}</div>
              <div className="text-[10px] text-white/40">{meta.label}{meta.auto ? " · auto-tracked" : ""}</div>
            </div>
          </div>
          {g.done
            ? <Badge tone="green"><CheckCircle2 size={11} className="inline mr-1" />Done</Badge>
            : g.overdue
              ? <Badge tone="red"><AlertTriangle size={11} className="inline mr-1" />Overdue</Badge>
              : g.deadline
                ? <Badge tone="blue"><Clock size={11} className="inline mr-1" />{g.daysLeft}d left</Badge>
                : null}
        </div>
        <div className="flex items-center justify-between text-[11px] text-white/50 mb-1">
          <span>{meta.unit === "$" ? fmt(g.current) : g.current} / {meta.unit === "$" ? fmt(g.target) : g.target}</span>
          <span className="font-semibold">{g.pct}%</span>
        </div>
        <PBar value={g.current} max={g.target || 1} />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/40 mt-2">
          {g.deadline && <span className={g.overdue ? "text-danger-400" : ""}>{fmtCountdown(g)}</span>}
          {g.done && g.deadline && <span className={g.metByDeadline ? "text-green-400" : "text-amber-400"}>{g.metByDeadline ? "Hit deadline ✓" : "Completed late"}</span>}
          {g.hasReward && (
            <span className={"flex items-center gap-1 " + (g.done && !g.metByDeadline ? "text-white/30 line-through" : "text-yellow-400")}>
              <Gift size={11} />{g.rewardDescription || ("$" + g.rewardAmount)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-3">
          {meta.auto ? (
            <button onClick={() => toggleDone(g)} className="text-[11px] px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white">
              {g.done ? "Reopen" : "Mark done manually"}
            </button>
          ) : (
            <>
              <button onClick={() => adjustCustom(g, -1)} className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white text-xs">−</button>
              <button onClick={() => adjustCustom(g, 1)} className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white text-xs">+</button>
              <span className="text-[10px] text-white/30">update progress</span>
            </>
          )}
          <button onClick={() => deleteGoal(g.id)} className="ml-auto p-1 text-white/40 hover:text-danger-400"><Trash2 size={13} /></button>
        </div>
      </Glass>
    );
  };

  return (
    <PageFade>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xl font-black flex items-center gap-2"><Target size={20} className="text-brand-500" />Goals</div>
            <div className="text-sm text-white/40">Set revenue, job, and client targets — Alfred nudges you as you close in and celebrates when you hit them</div>
          </div>
          <GBtn onClick={() => setFormOpen(o => !o)}><Plus size={14} className="inline mr-1" />{formOpen ? "Cancel" : "New Goal"}</GBtn>
        </div>

        {/* Synced monthly targets — same numbers as Settings → Goals & Tax
            and the Dashboard Goals widget, always. Edit them in Settings;
            this page's own "New Goal" below is for one-off/custom goals. */}
        <Glass className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-semibold text-white/70 uppercase tracking-wider">This Month — from Settings</div>
            {onOpenSettings && <button onClick={onOpenSettings} className="text-[11px] text-brand-400 hover:text-brand-300 flex items-center gap-1"><SettingsIcon size={11} />Edit in Settings</button>}
          </div>
          {monthlyRevenueGoal <= 0 && monthlyJobsGoal <= 0 ? (
            <div className="text-xs text-white/40">No monthly goals set yet — add them in Settings → Goals & Tax.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {monthlyRevenueGoal > 0 && (
                <div>
                  <div className="flex justify-between text-xs mb-1"><span className="text-white/70">Revenue</span><span className={revGoalPct >= 75 ? "text-green-400 font-bold" : "text-white/60"}>{fmt(revMonthActual)} / {fmt(monthlyRevenueGoal)} ({revGoalPct}%)</span></div>
                  <PBar value={revMonthActual} max={monthlyRevenueGoal} />
                </div>
              )}
              {monthlyJobsGoal > 0 && (
                <div>
                  <div className="flex justify-between text-xs mb-1"><span className="text-white/70">Jobs Done</span><span className={jobsGoalPct >= 75 ? "text-green-400 font-bold" : "text-white/60"}>{jobsMonthActual} / {monthlyJobsGoal} ({jobsGoalPct}%)</span></div>
                  <PBar value={jobsMonthActual} max={monthlyJobsGoal} />
                </div>
              )}
            </div>
          )}
        </Glass>

        {formOpen && (
          <Glass className="p-5 space-y-3">
            <GInput placeholder="Goal name, e.g. Hit $20k in a month" value={fText} onChange={(e: any) => setFText(e.target.value)} className="w-full" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="col-span-2 md:col-span-1">
                <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Metric</label>
                <GSel value={fMetric} onChange={(e: any) => setFMetric(e.target.value)}>
                  {METRICS.map(m => <option key={m.id} value={m.id} className="bg-black">{m.label}</option>)}
                </GSel>
              </div>
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Target{metricMeta(fMetric).unit === "$" ? " ($)" : ""}</label>
                <GInput type="number" placeholder="0" value={fTarget} onChange={(e: any) => setFTarget(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Deadline (optional)</label>
                <GDate value={fDeadline} onChange={(e: any) => setFDeadline(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Reward $ (optional)</label>
                <GInput type="number" placeholder="0" value={fRewardAmount} onChange={(e: any) => setFRewardAmount(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Reward if met by deadline (optional)</label>
              <GInput placeholder="e.g. $200 bonus, extra day off" value={fRewardDesc} onChange={(e: any) => setFRewardDesc(e.target.value)} className="w-full" />
            </div>
            <div className="text-[11px] text-white/40 flex items-center gap-1.5">
              <Sparkles size={12} className="text-brand-400" />
              {metricMeta(fMetric).auto ? "This tracks itself from your real jobs/customers data — no manual updates needed." : "Custom goals: update progress yourself with the +/− buttons on the card."}
            </div>
            <GBtn onClick={addGoal} className="w-full">Save Goal</GBtn>
          </Glass>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Glass className="p-4 text-center">
            <div className="text-2xl font-black">{goals.length}</div>
            <div className="text-[11px] text-white/40 uppercase tracking-wider">Total Goals</div>
          </Glass>
          <Glass className="p-4 text-center">
            <div className="text-2xl font-black text-green-400">{doneGoals.length}</div>
            <div className="text-[11px] text-white/40 uppercase tracking-wider">Completed</div>
          </Glass>
          <Glass className={"p-4 text-center " + (overdueCount > 0 ? "border-danger-800/50" : "")}>
            <div className={"text-2xl font-black " + (overdueCount > 0 ? "text-danger-400" : "")}>{overdueCount}</div>
            <div className="text-[11px] text-white/40 uppercase tracking-wider">Overdue</div>
          </Glass>
          <Glass className="p-4 text-center">
            <div className="text-2xl font-black text-yellow-400">{rewardsEarned}</div>
            <div className="text-[11px] text-white/40 uppercase tracking-wider">Rewards Earned</div>
          </Glass>
        </div>

        {activeGoals.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">In Progress</div>
            <div className="grid md:grid-cols-2 gap-3">
              {activeGoals.map((g: any) => <GoalCard key={g.id} g={g} />)}
            </div>
          </div>
        )}

        {doneGoals.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Completed</div>
            <div className="grid md:grid-cols-2 gap-3">
              {doneGoals.map((g: any) => <GoalCard key={g.id} g={g} />)}
            </div>
          </div>
        )}

        {goals.length === 0 && !formOpen && (
          <Glass className="p-8 text-center">
            <Target size={32} className="mx-auto text-white/20 mb-3" />
            <div className="text-white/60 font-semibold mb-1">No goals yet</div>
            <div className="text-sm text-white/40 mb-4">Set a revenue, job, or client target — with an optional deadline and reward.</div>
            <GBtn onClick={() => setFormOpen(true)}>Add Your First Goal</GBtn>
          </Glass>
        )}
      </div>
    </PageFade>
  );
}
