import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Activity,
  Check,
  Plus,
  FileText,
  ListTodo,
  Wrench,
  ClipboardList,
  ArrowUpRight,
  ArrowRight,
  ChevronRight,
  Download,
  UploadCloud,
  Link2,
  Archive,
  Pause,
  Play,
  CheckCircle2,
  Circle,
  Clock,
  Wallet,
  Search,
} from "lucide-react";
import { useI18n } from "../lib/i18n";
import { useApp } from "../lib/context";
import { api, errorKey } from "../lib/api";
import { toast } from "../components/ui/sonner";
import { PdfPreview } from '../components/PdfPreview';
import {
  PageHeader,
  AddButton,
  Empty,
  Loading,
  ErrorBox,
  Badge,
  Tabs,
  Btn,
  IconBtn,
  Modal,
  SectionHeader,
  useData,
  Select,
  Field,
  TextInput,
} from "../components/common";

export function ActivityFeed({ items, compact = false }) {
  const { t, date } = useI18n();
  const [selected, setSelected] = useState(null);
  return (
    <>
      {items.length ? (
        <div className={`activity-feed ${compact ? "compact" : ""}`}>
          {items.map((item) => (
            <button
              key={item.id}
              className="activity-item"
              data-testid={`activity-${item.id}`}
              onClick={() => setSelected(item)}
            >
              <span
                className={`activity-symbol ${item.action.includes("CREATED") ? "blue" : ""}`}
              >
                {item.action.includes("COMPLETED") ? (
                  <Check size={13} />
                ) : item.action.includes("CREATED") ? (
                  <Plus size={13} />
                ) : (
                  <Activity size={13} />
                )}
              </span>
              <div>
                <strong>{t(`activity.${item.action}`)}</strong>
                {item.object_name && (
                  <span className="activity-object">{item.object_name}</span>
                )}
                <small>{t("activity.by", { name: item.actor_name })}</small>
              </div>
              <time>
                {date(
                  item.created_at,
                  compact
                    ? { year: undefined }
                    : { hour: "2-digit", minute: "2-digit" },
                )}
              </time>
            </button>
          ))}
        </div>
      ) : (
        <Empty
          icon={Activity}
          small={compact}
          title={t("activity.empty")}
          description={t("activity.empty.detail")}
        />
      )}{" "}
      {selected && (
        <Modal
          title={t(`activity.${selected.action}`)}
          onClose={() => setSelected(null)}
          testId="activity-detail-modal"
        >
          <p className="muted">
            {selected.object_name} ·{" "}
            {t("activity.by", { name: selected.actor_name })}
          </p>
          <div className="audit-states">
            {["before", "after"].map((key) => (
              <div key={key}>
                <h3>{t(`activity.${key}`)}</h3>
                <pre data-testid={`audit-${key}`}>
                  {selected[key] ? JSON.stringify(selected[key], null, 2) : "—"}
                </pre>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}

export default function Records({
  module,
  entityId,
  locationId,
  serviceId,
  embedded = false,
}) {
  const { t, date, number } = useI18n();
  const { refresh, canWrite, canAdmin, setQuickAdd, user } = useApp();
  const [tab, setTab] = useState("all"),
    [selected, setSelected] = useState(null),
    [page, setPage] = useState(1);
  const [params] = useSearchParams();
  const query = new URLSearchParams();
  if (entityId) query.set("entity_id", entityId);
  if (locationId) query.set("location_id", locationId);
  if (serviceId) query.set("service_event_id", serviceId);
  if (module === "activity") query.set("page", page);
  const { data, loading, error } = useData(`/${module}?${query}`);
  const list = module === "activity" ? data?.items : data || [];
  useEffect(() => {
    const id = params.get("record");
    if (id && Array.isArray(data)) {
      const record = data.find((v) => v.id === id);
      if (record) setSelected(record);
    }
  }, [params, data]);
  useEffect(() => {
    if (Array.isArray(data)) {
      setSelected(current => current ? data.find(item => item.id === current.id) || current : null);
    }
  }, [data]);
  const kind =
    module === "tasks"
      ? "task"
      : module === "documents"
        ? "document"
        : module === "expenses"
          ? "expense"
          : module;
  const icons = {
    tasks: ListTodo,
    maintenance: Wrench,
    documents: FileText,
    service: ClipboardList,
    activity: Activity,
    expenses: Wallet,
  };
  const Icon = icons[module];
  const mutate = async (path, body, method = "post") => {
    try {
      await api[method](path, body);
      toast.success(t("common.saved"));
      refresh();
      setSelected(null);
    } catch (e) {
      toast.error(t(errorKey(e)));
    }
  };
  const add = () =>
    setQuickAdd({
      kind,
      entity_id: entityId,
      location_id: locationId,
      service_event_id: serviceId,
    });
  const filtered =
    list?.filter(
      (item) =>
        tab === "all" ||
        (module === "tasks"
          ? tab === "completed"
            ? ["COMPLETED", "CANCELLED"].includes(item.status)
            : !["COMPLETED", "CANCELLED"].includes(item.status)
          : module === "documents"
            ? tab === "archived"
              ? item.status === "ARCHIVED"
              : item.status !== "ARCHIVED"
            : item.status === tab),
    ) || [];
  return (
    <div className="entrance">
      {!embedded && (
        <PageHeader
          title={t(`${module}.title`)}
          subtitle={t(`${module}.subtitle`)}
          action={
            module !== "activity" &&
            canWrite && (
              <Btn
                variant="primary"
                icon={module === "documents" ? UploadCloud : Plus}
                onClick={add}
                data-testid={`add-${kind}-button`}
              >
                {t(`${module}.add`)}
              </Btn>
            )
          }
        />
      )}
      {embedded && (
        <SectionHeader title={t(`${module}.title`)}>
          {canWrite && module !== "activity" && (
            <Btn icon={Plus} onClick={add} data-testid={`embedded-add-${kind}`}>
              {t("common.add")}
            </Btn>
          )}
        </SectionHeader>
      )}
      {!embedded &&
        module !== "activity" &&
        module !== "expenses" &&
        module !== "service" && (
          <Tabs
            value={tab}
            onChange={setTab}
            items={
              module === "tasks"
                ? [
                    { value: "all", label: t("tasks.all") },
                    { value: "open", label: t("tasks.open") },
                    { value: "completed", label: t("tasks.completed") },
                  ]
                : module === "maintenance"
                  ? [
                      { value: "all", label: t("common.all") },
                      ...["OVERDUE", "DUE_SOON", "OK", "PAUSED"].map((v) => ({
                        value: v,
                        label: t(`enum.${v}`),
                      })),
                    ]
                  : [
                      { value: "all", label: t("common.all") },
                      { value: "active", label: t("common.active") },
                      { value: "archived", label: t("common.archived") },
                    ]
            }
          />
        )}
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorBox error={error} onRetry={refresh} />
      ) : module === "activity" ? (
        <>
          <ActivityFeed items={data.items} />
          <div className="pagination">
            <Btn
              data-testid="activity-prev"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              {t("common.previous")}
            </Btn>
            <span data-testid="activity-page">
              {t("common.page", { page })}
            </span>
            <Btn
              data-testid="activity-next"
              disabled={page * 50 >= data.total}
              onClick={() => setPage(page + 1)}
            >
              {t("common.next")}
            </Btn>
          </div>
        </>
      ) : filtered.length ? (
        <div
          className={`records-table ${module === "documents" ? "documents-grid" : ""}`}
        >
          {filtered.map((item) =>
            module === "tasks" ? (
              <div
                key={item.id}
                className="table-row task-row"
                data-testid={`task-${item.id}`}
              >
                <button
                  className={`task-check ${item.status === "COMPLETED" ? "checked" : ""}`}
                  data-testid={`task-complete-${item.id}`}
                  disabled={!canWrite}
                  aria-label={t(
                    item.status === "COMPLETED"
                      ? "tasks.reopen"
                      : "tasks.complete",
                  )}
                  onClick={() =>
                    mutate(
                      `/tasks/${item.id}`,
                      {
                        status:
                          item.status === "COMPLETED" ? "OPEN" : "COMPLETED",
                      },
                      "patch",
                    )
                  }
                >
                  {item.status === "COMPLETED" && <Check size={13} />}
                </button>
                <button
                  className="task-title"
                  data-testid={`task-detail-${item.id}`}
                  onClick={() => setSelected(item)}
                >
                  <strong
                    className={
                      item.status === "COMPLETED" ? "completed-text" : ""
                    }
                  >
                    {item.title}
                  </strong>
                  <small>
                    {[item.entity_name, item.location_name]
                      .filter(Boolean)
                      .join(" · ") || t("common.none")}
                  </small>
                </button>
                <Badge
                  status={item.priority}
                  testId={`task-priority-${item.id}`}
                />
                <span className="muted small task-due">
                  {item.due_date ? date(item.due_date) : t("common.noDate")}
                </span>
                <Badge status={item.status} testId={`task-status-${item.id}`} />
              </div>
            ) : module === "maintenance" ? (
              <button
                key={item.id}
                className="table-row maintenance-row"
                data-testid={`maintenance-${item.id}`}
                onClick={() => setSelected(item)}
              >
                <span className={`maintenance-dot status-${item.status}`}>
                  <Wrench size={16} />
                </span>
                <span className="row-title">
                  <strong>{item.title}</strong>
                  <small>
                    {item.entity_name}
                    {item.component_name
                      ? " · " +
                        (item.component_generated
                          ? t(`enum.${item.component_name}`)
                          : item.component_name)
                      : ""}
                  </small>
                </span>
                <span className="maintenance-due">
                  <strong>
                    {item.next_date
                      ? date(item.next_date)
                      : item.next_mileage != null
                        ? `${number(item.next_mileage)} ${t("common.km")}`
                        : t("maintenance.noFixed")}
                  </strong>
                  {item.next_date && item.next_mileage != null && (
                    <small>
                      {number(item.next_mileage)} {t("common.km")}
                    </small>
                  )}
                </span>
                <Badge
                  status={item.status}
                  testId={`maintenance-status-${item.id}`}
                />
                <ChevronRight size={16} />
              </button>
            ) : module === "documents" ? (
              <button
                className="document-card"
                key={item.id}
                data-testid={`document-${item.id}`}
                onClick={() => setSelected(item)}
              >
                <div className="document-preview">
                  <FileText size={37} strokeWidth={1} />
                  <span>
                    {item.content_type === "application/pdf"
                      ? "PDF"
                      : item.content_type.split("/")[1].toUpperCase()}
                  </span>
                </div>
                <div className="document-body">
                  <h3>{item.title}</h3>
                  <p>
                    {t(`enum.${item.type}`)} ·{" "}
                    {number(Math.ceil(item.size / 1024))} KB
                  </p>
                  <div>
                    <time>{date(item.created_at)}</time>
                    {item.status === "ARCHIVED" && (
                      <Badge
                        status="ARCHIVED"
                        testId={`doc-status-${item.id}`}
                      />
                    )}
                    <ArrowUpRight size={14} />
                  </div>
                </div>
              </button>
            ) : module === "service" ? (
              <button
                className="table-row service-row"
                data-testid={`service-${item.id}`}
                key={item.id}
                onClick={() => setSelected(item)}
              >
                <span className="service-date">
                  <strong>{new Date(item.date).getDate()}</strong>
                  <small>
                    {date(item.date, { day: undefined, year: undefined })}
                  </small>
                </span>
                <span className="row-title">
                  <strong>{item.title}</strong>
                  <small>
                    {item.entity_name} · {item.workshop || "—"}
                  </small>
                </span>
                <span className="muted small">
                  {item.mileage != null
                    ? `${number(item.mileage)} ${t("common.km")}`
                    : "—"}
                </span>
                <span>{number(item.cost)} CZK</span>
                <ChevronRight size={16} />
              </button>
            ) : (
              <div
                className="table-row expense-row"
                key={item.id}
                data-testid={`expense-${item.id}`}
              >
                <Wallet size={17} />
                <span>
                  <strong>
                    {item.category === "SERVICE"
                      ? t("nav.service")
                      : item.category}
                  </strong>
                  <small>{item.supplier}</small>
                </span>
                <span className="muted">{date(item.date)}</span>
                <strong>
                  {number(item.amount)} {item.currency}
                </strong>
              </div>
            ),
          )}
        </div>
      ) : (
        <Empty
          icon={Icon}
          title={t(`${module}.empty`)}
          description={
            module === "expenses" ? null : t(`${module}.empty.detail`)
          }
          small={embedded}
          action={
            canWrite && (
              <Btn
                icon={Plus}
                variant="primary"
                onClick={add}
                data-testid={`empty-add-${kind}`}
              >
                {t(`${module}.add`)}
              </Btn>
            )
          }
        />
      )}
      {selected && module === "tasks" && (
        <Modal
          title={selected.title}
          onClose={() => setSelected(null)}
          testId="task-detail-modal"
        >
          <p className="muted preserve-text">{selected.description}</p>
          <div className="detail-facts">
            <Fact label={t("common.entity")} value={selected.entity_name} />
            <Fact label={t("common.location")} value={selected.location_name} />
            <Fact label={t("tasks.assigned")} value={selected.assigned_name} />
            <Fact label={t("tasks.due")} value={date(selected.due_date)} />
          </div>
          <Field id="task-detail-status" label={t("common.status")}>
            <Select
              id="task-detail-status"
              disabled={!canWrite}
              value={selected.status}
              options={[
                "OPEN",
                "IN_PROGRESS",
                "BLOCKED",
                "COMPLETED",
                "CANCELLED",
              ].map((v) => ({ value: v, label: t(`enum.${v}`) }))}
              onChange={(e) =>
                mutate(
                  `/tasks/${selected.id}`,
                  { status: e.target.value },
                  "patch",
                )
              }
            />
          </Field>
        </Modal>
      )}
      {selected && module === "maintenance" && (
        <Modal
          title={selected.title}
          onClose={() => setSelected(null)}
          testId="maintenance-detail-modal"
        >
          <div className="detail-modal-top">
            <span>{selected.entity_name}</span>
            <Badge
              status={selected.status}
              testId="maintenance-detail-status"
            />
          </div>
          <div className="detail-facts">
            <Fact
              label={t("maintenance.strategy")}
              value={t(`enum.${selected.strategy}`)}
            />
            <Fact
              label={t("maintenance.source")}
              value={t(`enum.${selected.source}`)}
            />
            <Fact
              label={t("maintenance.nextDue")}
              value={selected.next_date ? date(selected.next_date) : "—"}
            />
            <Fact
              label={t("maintenance.remaining")}
              value={[
                selected.remaining_days != null
                  ? t("maintenance.days", { count: selected.remaining_days })
                  : null,
                selected.remaining_km != null
                  ? number(selected.remaining_km) + " " + t("common.km")
                  : null,
              ]
                .filter(Boolean)
                .join(" / ")}
            />
          </div>
          {selected.source_reference && (
            <p className="muted">{selected.source_reference}</p>
          )}
          {selected.records?.length > 0 && (
            <div className="mini-history">
              {selected.records.map((r) => (
                <div key={r.id} data-testid={`maintenance-record-${r.id}`}>
                  <CheckCircle2 size={15} />
                  <span>{date(r.date)}</span>
                  <span>
                    {r.mileage != null
                      ? number(r.mileage) + " " + t("common.km")
                      : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
          {canWrite && selected.status !== "NOT_APPLICABLE" && (
            <div className="modal-actions">
              <Btn
                icon={selected.paused ? Play : Pause}
                data-testid="maintenance-pause"
                onClick={() =>
                  mutate(
                    `/maintenance/${selected.id}`,
                    { paused: !selected.paused },
                    "patch",
                  )
                }
              >
                {t(
                  selected.paused ? "maintenance.resume" : "maintenance.pause",
                )}
              </Btn>
              <Btn
                variant="primary"
                icon={Check}
                data-testid="maintenance-complete"
                onClick={() => {
                  setSelected(null);
                  setQuickAdd({ kind: "completion", record: selected });
                }}
              >
                {t("maintenance.complete")}
              </Btn>
            </div>
          )}
        </Modal>
      )}
      {selected && module === "documents" && (
        <DocumentDetail document={selected} onClose={() => setSelected(null)} />
      )}
      {selected && module === "service" && (
        <Modal
          title={selected.title}
          onClose={() => setSelected(null)}
          className="wide-modal"
          testId="service-detail-modal"
        >
          <div className="detail-facts">
            <Fact label={t("common.entity")} value={selected.entity_name} />
            <Fact label={t("common.date")} value={date(selected.date)} />
            <Fact
              label={t("vehicles.mileage")}
              value={
                selected.mileage != null
                  ? number(selected.mileage) + " " + t("common.km")
                  : "—"
              }
            />
            <Fact label={t("service.workshop")} value={selected.workshop} />
          </div>
          <h3>{t("service.maintenanceItems")}</h3>
          {selected.records.map((r) => (
            <div
              className="mini-row"
              key={r.id}
              data-testid={`service-record-${r.id}`}
            >
              <Check size={14} />
              {r.title}
            </div>
          ))}
          {selected.materials.length > 0 && (
            <>
              <h3>{t("service.materials")}</h3>
              {selected.materials.map((m) => (
                <div
                  className="mini-row"
                  key={m.id}
                  data-testid={`service-material-${m.id}`}
                >
                  {m.name}
                  <span>{number(-m.delta)}</span>
                </div>
              ))}
            </>
          )}
          <div className="service-total">
            <span>{t("common.total")}</span>
            <strong>{number(selected.cost)} CZK</strong>
          </div>
          <p className="muted preserve-text">{selected.notes}</p>
          <Records module="documents" embedded serviceId={selected.id} />
        </Modal>
      )}
    </div>
  );
}
export const Fact = ({ label, value }) => (
  <div className="fact">
    <span>{label}</span>
    <strong data-testid={`fact-${label.replace(/\s/g, "-")}`}>
      {value || "—"}
    </strong>
  </div>
);

function DocumentDetail({ document: doc, onClose }) {
  const { t } = useI18n();
  const { canWrite, canAdmin, refresh } = useApp();
  const { data: entities } = useData("/entities?archived=true");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const url = `${process.env.REACT_APP_BACKEND_URL}/api/documents/${doc.id}/file`;
  const link = async () => {
    setBusy(true);
    try {
      await api.post(`/documents/${doc.id}/links`, { entity_id: target });
      toast.success(t("common.saved"));
      refresh();
      setTarget("");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const archive = async () => {
    if (!window.confirm(t("common.archiveWarning"))) return;
    try {
      await api.post(`/documents/${doc.id}/archive`);
      refresh();
      onClose();
    } catch (e) {
      setError(e);
    }
  };
  return (
    <Modal
      title={doc.title}
      onClose={onClose}
      className="document-modal"
      testId="document-preview-modal"
    >
      <div className="document-viewer">
        {doc.content_type === "application/pdf" ? (
          <PdfPreview url={url} />
        ) : (
          <img src={url} alt={doc.title} data-testid="image-preview" />
        )}
      </div>
      {error && <ErrorBox error={error} />}
      <div className="document-links">
        {doc.links
          .filter((l) => l.entity_id)
          .map((l) => (
            <Link
              key={l.id}
              to={`/entities/${l.entity_id}`}
              onClick={onClose}
              data-testid={`document-link-${l.id}`}
            >
              <Link2 size={12} />
              {entities?.find((e) => e.id === l.entity_id)?.name || l.entity_id}
            </Link>
          ))}
      </div>
      {canWrite && (
        <div className="document-link-form">
          <Select
            id="document-link-entity"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={t("common.entity")}
            options={(entities || []).map((e) => ({
              value: e.id,
              label: e.name,
            }))}
          />
          <Btn
            icon={Link2}
            loading={busy}
            disabled={!target}
            data-testid="document-link-submit"
            onClick={link}
          >
            {t("common.link")}
          </Btn>
        </div>
      )}
      <div className="modal-actions">
        {canAdmin && doc.status !== "ARCHIVED" && (
          <Btn icon={Archive} data-testid="document-archive" onClick={archive}>
            {t("common.archive")}
          </Btn>
        )}
        <a
          className="hl-button primary inline-flex"
          href={url + "?download=true"}
          download
          data-testid="document-download"
        >
          <Download size={15} />
          {t("documents.download")}
        </a>
      </div>
    </Modal>
  );
}
