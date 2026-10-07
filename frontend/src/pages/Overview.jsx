import React from "react";
import { Link } from "react-router-dom";
import {
  CarFront,
  House,
  Boxes,
  ListTodo,
  ArrowUpRight,
  Check,
  CalendarDays,
  Plus,
  ArrowRight,
  Activity,
  ShieldCheck,
  Database,
  FileClock,
  Wrench,
  MapPin,
  FileText,
  CheckCheck,
} from "lucide-react";
import { useI18n } from "../lib/i18n";
import { useApp } from "../lib/context";
import {
  useData,
  Loading,
  ErrorBox,
  SectionHeader,
  Btn,
  Badge,
} from "../components/common";
import { ActivityFeed } from "./Records";

const summaries = [
  {
    key: "garage",
    icon: CarFront,
    path: "/vehicles",
    count: "vehicles",
    unit: "vehicles",
    accent: "blue",
  },
  {
    key: "home",
    icon: House,
    path: "/home",
    count: "assets",
    unit: "assets",
    accent: "sage",
  },
  {
    key: "inventory",
    icon: Boxes,
    path: "/inventory",
    count: "inventory",
    unit: "stock",
    accent: "amber",
  },
  {
    key: "tasks",
    icon: ListTodo,
    path: "/tasks",
    count: "tasks",
    unit: "tasksCount",
    accent: "mauve",
  },
];
const quick = [
  ["vehicle", CarFront],
  ["asset", House],
  ["inventory", Boxes],
  ["task", ListTodo],
  ["location", MapPin],
  ["document", FileText],
];
export default function Overview() {
  const { t, date, number } = useI18n();
  const { user, setQuickAdd, canWrite, refresh } = useApp();
  const { data, loading, error } = useData("/overview");
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={refresh} />;
  const hour = new Date().getHours(),
    greeting = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const empty =
    data.counts.vehicles +
      data.counts.assets +
      data.counts.inventory +
      data.counts.locations ===
    0;
  return (
    <div className="overview-page entrance">
      <div className="overview-heading">
        <div>
          <span className="eyebrow" data-testid="overview-eyebrow">
            {t("overview.eyebrow")}
          </span>
          <h1 data-testid="overview-greeting">
            {t(`overview.${greeting}`, { name: user.name.split(" ")[0] })}
            <span className="greeting-period">.</span>
          </h1>
          <p data-testid="overview-subtitle">{t("overview.subtitle")}</p>
        </div>
        <div className="overview-date">
          <span data-testid="overview-date">
            {date(new Date(), { weekday: "long" })}
          </span>
          <div className="system-pill" data-testid="system-status">
            <span />
            {t("server.connected")}
          </div>
        </div>
      </div>
      <div className="summary-grid">
        {summaries.map(({ key, icon: Icon, path, count, unit, accent }) => (
          <Link
            to={path}
            key={key}
            data-testid={`summary-${key}`}
            className="summary-card"
          >
            <div className="summary-label">
              <span className={`summary-icon ${accent}`}>
                <Icon size={18} strokeWidth={1.6} />
              </span>
              <span>{t(`overview.${key}`)}</span>
              <ArrowUpRight size={15} />
            </div>
            <div
              className="summary-number"
              data-testid={`summary-${key}-count`}
            >
              {number(data.counts[count])}
              <span>{t(`overview.${unit}`)}</span>
            </div>
            <div className="summary-foot">
              <span className={`subtle-dot ${accent}`} />
              {key === "home"
                ? `${number(data.counts.rooms)} ${t("overview.rooms")}`
                : key === "tasks"
                  ? t("tasks.open")
                  : t("common.active")}
              <ChevronArrow />
            </div>
          </Link>
        ))}
      </div>
      <div className="attention-grid">
        <section className="overview-section attention-section">
          <SectionHeader
            title={t("overview.attention")}
            meta={data.attention.length}
          >
            <span
              className={`quiet-badge ${data.attention.length ? "warning" : "success"}`}
            >
              {!data.attention.length && <Check size={12} />}{" "}
              {t(
                data.attention.length
                  ? "overview.attentionCount"
                  : "overview.allClear",
                { count: data.attention.length },
              )}
            </span>
          </SectionHeader>
          {data.attention.length ? (
            <div className="attention-list">
              {data.attention.slice(0, 4).map((item) => (
                <Link
                  to={item.path}
                  className="attention-item"
                  data-testid={`attention-${item.id}`}
                  key={item.id}
                >
                  <span className="attention-indicator" />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.context}</small>
                  </span>
                  <Badge
                    status={item.status}
                    testId={`attention-status-${item.id}`}
                  />
                  <ArrowUpRight size={14} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="clear-state">
              <div className="clear-graphic">
                <span />
                <div>
                  <Check size={25} strokeWidth={1.5} />
                </div>
                <span />
              </div>
              <strong data-testid="attention-empty-title">
                {t("overview.clear")}
              </strong>
              <p data-testid="attention-empty-description">
                {t("overview.clear.detail")}
              </p>
            </div>
          )}
        </section>
        <section className="overview-section upcoming-section">
          <SectionHeader title={t("overview.upcoming")}>
            <span className="tiny-label">{t("overview.next30")}</span>
          </SectionHeader>
          {data.upcoming.length ? (
            <div className="attention-list">
              {data.upcoming.slice(0, 4).map((item) => (
                <Link
                  className="attention-item"
                  to={item.path}
                  key={item.id}
                  data-testid={`upcoming-${item.id}`}
                >
                  <CalendarDays size={17} />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.context}</small>
                  </span>
                  <span className="muted small">
                    {item.date ? date(item.date) : t("enum.DUE_SOON")}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="upcoming-empty">
              <CalendarDays size={30} strokeWidth={1} />
              <strong data-testid="upcoming-empty-title">
                {t("overview.upcoming.empty")}
              </strong>
              <p>{t("overview.upcoming.detail")}</p>
            </div>
          )}
        </section>
      </div>
      {empty && canWrite && (
        <section className="getting-started">
          <div className="getting-started-icon">
            <House size={25} strokeWidth={1.3} />
          </div>
          <div>
            <h2 data-testid="getting-started-title">
              {t("overview.begin.title")}
            </h2>
            <p data-testid="getting-started-description">
              {t("overview.begin.subtitle")}
            </p>
          </div>
          <Btn
            data-testid="first-record-button"
            icon={Plus}
            onClick={() => setQuickAdd("choose")}
          >
            {t("overview.begin.action")}
            <ArrowRight size={14} />
          </Btn>
          <div className="blueprint-lines" aria-hidden="true" />
        </section>
      )}
      <div className="bottom-grid">
        <section className="overview-section recent-section">
          <SectionHeader title={t("overview.recent")} to="/activity" />
          <ActivityFeed items={data.activity} compact />
        </section>
        <section className="overview-section quick-section">
          <SectionHeader title={t("overview.quick")} />
          <div className="quick-add-grid">
            {quick.map(([kind, Icon]) => (
              <button
                key={kind}
                data-testid={`quick-add-${kind}`}
                disabled={!canWrite}
                onClick={() => setQuickAdd(kind)}
              >
                <Icon size={18} strokeWidth={1.5} />
                <span>{t(`add.${kind}`)}</span>
                <Plus size={12} />
              </button>
            ))}
          </div>
        </section>
      </div>
      <div className="workspace-health">
        <span className="tiny-label">{t("overview.system")}</span>
        <span>
          <ShieldCheck size={14} />
          {t("overview.private")}
        </span>
        <span>
          <Database size={14} />
          {t("server.database")}
        </span>
        <span>
          <FileClock size={14} />
          {t("overview.history")}
        </span>
        <span className="health-online">
          <i />
          {t("server.operational")}
        </span>
      </div>
    </div>
  );
}
const ChevronArrow = () => <ArrowRight size={12} />;
