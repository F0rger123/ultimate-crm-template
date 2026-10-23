// auto-extracted from CRM Starter monolith
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  LayoutDashboard, Users, FileText, Briefcase, Bot, BarChart3,
  Settings, Bell, Menu, X, Plus, Search, Edit, Trash2, Send,
  DollarSign, TrendingUp, CheckCircle, Clock, MapPin, Phone, Mail,
  Calendar, AlertTriangle, Truck, Receipt, FlaskConical, MessageSquare,
  Sun, Moon, Download, Undo2, Redo2, Volume2, Play, Cloud, Star,
  Award, Target, Shield, Key, Eye, EyeOff, Save, ChevronRight,
  ChevronLeft, GripVertical, Tag, Copy, Ban, RefreshCw, Percent,
  CreditCard, Repeat, XCircle, Activity, Zap, UserCheck, AlertCircle,
  Clipboard, Heart, Dumbbell, Droplet, Smile, Flame, Wind, Snowflake,
  Globe, Share2, Trophy, ExternalLink, Workflow, ToggleLeft, ToggleRight,
  Navigation, TrendingDown, PieChart as PieIcon, Package, Wrench,
  CheckSquare, Route, Users2, Layers, ArrowRight, BarChart2, Filter,
  Paperclip, ImageIcon, FileImage, MoreVertical, Mic, Upload, Link, Lock, User
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart, LineChart, Line,
  ComposedChart, Legend
} from "recharts";
import { fmt, uid, today, daysFromNow, daysSince, filterByTimeframe, TIMEFRAMES, pipelineStages, priorityLevels, cancelReasons, recurringFreqs, equipmentList, jobTagOptions, expenseCats, personalities, normalizeAutomation, IRS_RATE } from "../../lib/utils";
import type { Customer, Estimate, Job, Employee, Vehicle, MaintenanceRecord, Expense, Chemical, Service, Campaign, Automation, Review, SocialPost, AccountabilityEntry, Goal, Win, Reminder, RewardTier, Referral, MileageLog, PersonalTransaction, AppSettings, InboxThread, InboxMessage, AlfredConversation, AlfredMemory, AlfredMessage, Timeline, TimelineEntry, ModelStatus, LineItem, ChecklistItem, Photo, ChemicalUsed, CommLogEntry, AutomationStep, CustomField } from "../../types";
import { twilioSend, sendEmail } from "../../lib/messaging";
import { seedWeather } from "../../lib/weather";
import { seedCustomers, seedEstimates, seedJobs, seedEmployees, seedVehicles, seedExpenses, seedChemicals, seedServices, seedAutomations, seedEmailTemplates, seedSmsTemplates, seedRewardTiers, seedReferrals, seedMaintenance, campaignTemplates, seedSocialPosts, seedTimeline, seedGoals, seedReminders, seedAccountabilityEntries, seedMileage, seedLeadSrc, STEP_TYPES, AUTOMATION_TEMPLATES } from "../../lib/seed";
import { callModel, MODELS } from "../../lib/api";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, fetchDriveFiles, MOCK_GOOGLE_DATA, fmtSize, fmtDate, fileIcon } from "../../lib/google";
import { usePersistent } from "../../hooks/usePersistent";
import { usePersistentRaw } from "../../hooks/usePersistentRaw";
import { Glass } from "./Glass";
import { GBtn } from "./GBtn";
import { GInput } from "./GInput";
import { GDate } from "./GDate";
import { GSel } from "./GSel";
import { GTxt } from "./GTxt";
import { Modal } from "./Modal";
import { Badge } from "./Badge";
import { Stat } from "./Stat";
import { PBar } from "./PBar";
import { PageFade } from "./PageFade";
import { TimeframeSelector } from "./TimeframeSelector";

export function ReviewLandingPage({ review, customer, settings = {} as any, onClose, onSubmit }) {
  const [step, setStep] = useState("rate"); // rate | happy | unhappy | done
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [name, setName] = useState(customer?.firstName + " " + customer?.lastName || "");
  const [submitting, setSubmitting] = useState(false);

  const companyName = settings?.companyName || "CRM Starter";
  const googlePlaceId = settings?.googlePlaceId || "";
  // FIX 22 — this fell back to a hardcoded "g.page/r/your-business
  // washing/review" whenever no Place ID was set — sending every OTHER
  // deployment's customers (in this owner-facing preview, but the same
  // pattern already existed on the real public page before it was fixed —
  // see CustomerReviewPage.tsx) to a specific, different business's review
  // page. Prefers the directly-pasted review link (Settings → Company →
  // "Google Maps Review Link"), falls back to the Place-ID-constructed URL,
  // and is empty (button hidden below) if genuinely neither is configured —
  // better than sending customers somewhere wrong.
  const googleReviewUrl = settings?.googleReviewLink || (googlePlaceId ? `https://search.google.com/local/writereview?placeid=${googlePlaceId}` : "");

  const handleRating = r => {
    setRating(r);
    setTimeout(() => { setStep(r >= 4 ? "happy" : "unhappy"); }, 350);
  };

  const handleSubmit = () => {
    setSubmitting(true);
    setTimeout(() => {
      onSubmit?.(rating, feedback);
      setStep("done");
      setSubmitting(false);
    }, 800);
  };

  if (!review || !customer) return null;

  return (
    <Modal open={true} onClose={onClose} title="" maxW="max-w-md">
      <div className="-mx-5 -mt-5">
        {/* Branded header */}
        <div className="bg-brand-600 px-6 py-5 text-center text-brand-fg">
          <div className="w-14 h-14 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center mx-auto mb-2">
            <span className="text-2xl">🚿</span>
          </div>
          <div className="font-bold text-lg text-brand-fg">{companyName}</div>
          <div className="text-brand-fg/60 text-xs">your area · {settings?.companyPhone || "(555) 555-0100"}</div>
        </div>

        <div className="p-6">
          {step === "rate" && (
            <div className="text-center space-y-5">
              <div>
                <div className="text-xl font-bold">Hi {customer.firstName}! 👋</div>
                <div className="text-white/60 text-sm mt-1">How was your recent service?</div>
              </div>
              <div className="flex justify-center gap-3 py-2">
                {[1,2,3,4,5].map(s => (
                  <button
                    key={s}
                    onMouseEnter={() => setHoverRating(s)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => handleRating(s)}
                    className="transition-all duration-150 hover:scale-125 active:scale-95"
                  >
                    <Star
                      size={44}
                      className={"transition-colors " + (s <= (hoverRating || rating) ? "text-yellow-400 fill-yellow-400" : "text-white/20")}
                    />
                  </button>
                ))}
              </div>
              <div className="text-xs text-white/40">
                {hoverRating === 1 ? "Terrible" : hoverRating === 2 ? "Poor" : hoverRating === 3 ? "Okay" : hoverRating === 4 ? "Good" : hoverRating === 5 ? "Excellent!" : "Tap a star to rate"}
              </div>
            </div>
          )}

          {step === "happy" && (
            <div className="text-center space-y-4">
              <div className="text-4xl">🎉</div>
              <div>
                <div className="text-xl font-bold text-yellow-400">Awesome — thank you!</div>
                <div className="text-white/60 text-sm mt-1">{googleReviewUrl ? `Your ${rating}-star review means the world to us. Would you mind sharing it on Google?` : `Your ${rating}-star review means the world to us — thank you!`}</div>
              </div>
              <div className="flex justify-center gap-1">
                {[1,2,3,4,5].map(s => <Star key={s} size={20} className={s <= rating ? "text-yellow-400 fill-yellow-400" : "text-white/20"} />)}
              </div>
              {googleReviewUrl && (
                <a
                  href={googleReviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => { onSubmit?.(rating, ""); setTimeout(() => setStep("done"), 500); }}
                  className="flex items-center justify-center gap-2 w-full py-3.5 bg-white text-gray-900 font-bold rounded-xl hover:bg-gray-50 transition"
                >
                  <img src="https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png" alt="G" className="w-5 h-5" />
                  Leave a Google Review
                </a>
              )}
              <button onClick={() => { onSubmit?.(rating, googleReviewUrl ? "declined" : ""); setStep("done"); }} className="text-xs text-white/40 hover:text-white/60 transition">{googleReviewUrl ? "No thanks, maybe later" : "Done"}</button>
            </div>
          )}

          {step === "unhappy" && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-3xl">😔</div>
                <div className="text-lg font-bold mt-2">We're sorry to hear that</div>
                <div className="text-white/60 text-sm mt-1">Please tell us what went wrong so we can make it right.</div>
              </div>
              <div className="flex justify-center gap-1">
                {[1,2,3,4,5].map(s => <Star key={s} size={18} className={s <= rating ? "text-yellow-400 fill-yellow-400" : "text-white/20"} />)}
              </div>
              <div>
                <label className="text-xs text-white/60 mb-1 block">Your feedback (private — only we see this)</label>
                <GTxt rows={4} value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Tell us what happened and how we can improve..." />
              </div>
              <div>
                <label className="text-xs text-white/60 mb-1 block">Your name</label>
                <GInput value={name} onChange={e => setName(e.target.value)} />
              </div>
              <GBtn onClick={handleSubmit} disabled={!feedback.trim() || submitting} className="w-full !py-3">
                {submitting ? <div className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Submitting…</div> : "Send Private Feedback"}
              </GBtn>
              <button onClick={() => setStep("rate")} className="text-xs text-white/40 hover:text-white/60 w-full text-center transition">← Change my rating</button>
            </div>
          )}

          {step === "done" && (
            <div className="text-center py-4 space-y-3">
              <div className="text-5xl">{rating >= 4 ? "⭐" : "🙏"}</div>
              <div className="text-xl font-bold">{rating >= 4 ? "Thank you!" : "We appreciate your honesty"}</div>
              <div className="text-white/60 text-sm">
                {rating >= 4 ? "Your review helps other homeowners find us." : "We'll reach out soon to make things right."}
              </div>
              <GBtn onClick={onClose} variant="ghost" className="w-full mt-4">Close</GBtn>
              {onSubmit && <button onClick={() => onSubmit({ unsubscribe: true })} className="text-[10px] text-white/30 hover:text-white/50 underline mt-2 block w-full">Don't send me review requests — unsubscribe</button>}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

