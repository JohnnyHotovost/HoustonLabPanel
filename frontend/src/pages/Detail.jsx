import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  CarFront,
  House,
  Boxes,
  MapPin,
  ArrowUpRight,
  Gauge,
  Plus,
  FileClock,
  Wrench,
  Archive,
  RotateCcw,
  Pencil,
  MoveRight,
  Package,
  Settings2,
} from "lucide-react";
import { useI18n } from "../lib/i18n";
import { useApp } from "../lib/context";
import { api, errorKey } from "../lib/api";
import { toast } from "../components/ui/sonner";
import {
  PageHeader,
  Btn,
  Badge,
  Tabs,
  SectionHeader,
  Empty,
  Loading,
  ErrorBox,
  useData,
} from "../components/common";
import Records, { Fact, ActivityFeed } from "./Records";
import { Movements } from "./Collections";

export default function EntityDetail() {
  const { id } = useParams();
  const { t, date, number } = useI18n();
  const { canWrite, canAdmin, setQuickAdd, refresh, user } = useApp();
  const { data: e, loading, error } = useData(`/entities/${id}`);
  const [tab, setTab] = useState("overview");
  const { data: history } = useData(`/activity?object_id=${id}`);
  if (loading && !e) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={refresh} />;
  const vehicle = e.entity_type === "VEHICLE",
    inventory = e.entity_type === "INVENTORY",
    Icon = vehicle ? CarFront : inventory ? Boxes : House;
  const inactive =
    e.archived_at ||
    ["SOLD", "WRITTEN_OFF", "DISPOSED", "REPLACED"].includes(e.status);
  const open = (kind) => setQuickAdd({ kind, record: e, entity_id: e.id });
  const archive = async () => {
    if (!e.archived_at && !window.confirm(t("common.archiveWarning"))) return;
    try {
      await api.post(
        `/entities/${id}/${e.archived_at ? "restore" : "archive"}`,
      );
      refresh();
      toast.success(t("common.saved"));
    } catch (err) {
      toast.error(t(errorKey(err)));
    }
  };
  const retire = async (c) => {
    if (!window.confirm(t("common.archiveWarning"))) return;
    try {
      await api.post(`/components/${c.id}/retire`);
      refresh();
    } catch (err) {
      toast.error(t(errorKey(err)));
    }
  };
  const tabs = [
    { value: "overview", label: t("nav.overview") },
    ...(!inventory
      ? [
          { value: "maintenance", label: t("nav.maintenance") },
          { value: "service", label: t("nav.service") },
          { value: "components", label: t("vehicles.components") },
        ]
      : [{ value: "movements", label: t("inventory.movements") }]),
    { value: "tasks", label: t("nav.tasks") },
    { value: "documents", label: t("nav.documents") },
    { value: "expenses", label: t("expenses.title") },
    { value: "activity", label: t("nav.activity") },
  ];
  return (
    <div className="entrance">
      <PageHeader
        back={vehicle ? "/vehicles" : inventory ? "/inventory" : "/home"}
        title={e.name}
        subtitle={[
          e.profile.manufacturer,
          e.profile.model,
          vehicle ? e.profile.plate : e.location_path,
        ]
          .filter(Boolean)
          .join(" · ")}
        action={
          <div className="header-actions">
            {canWrite && !inactive && (
              <Btn
                icon={vehicle ? Gauge : inventory ? Plus : Pencil}
                onClick={() =>
                  open(vehicle ? "mileage" : inventory ? "stock" : "edit")
                }
                data-testid="entity-primary-action"
              >
                {t(
                  vehicle
                    ? "vehicles.updateMileage"
                    : inventory
                      ? "inventory.adjust"
                      : "common.edit",
                )}
              </Btn>
            )}
            {canWrite && !inactive && !inventory && (
              <Btn
                variant="primary"
                icon={Plus}
                onClick={() => open("service")}
                data-testid="entity-record-service"
              >
                {t("service.add")}
              </Btn>
            )}
          </div>
        }
      />
      <div className="entity-banner">
        <div className="entity-large-icon">
          <Icon size={45} strokeWidth={1.1} />
        </div>
        <div>
          <span className="eyebrow">{t(`enum.${e.entity_type}`)}</span>
          <Badge status={e.status} testId="entity-lifecycle-status" />
        </div>
        <div className="entity-banner-facts">
          {vehicle ? (
            <>
              <Fact
                label={t("vehicles.mileage")}
                value={`${number(user.preferences?.distance === "mi" ? e.profile.mileage / 1.609344 : e.profile.mileage)} ${t(user.preferences?.distance === "mi" ? "common.miles" : "common.km")}`}
              />
              <Fact label={t("vehicles.engine")} value={e.profile.engine} />
              <Fact
                label={t("vehicles.transmission")}
                value={t(`enum.${e.profile.transmission}`)}
              />
            </>
          ) : inventory ? (
            <>
              <Fact
                label={t("inventory.stock")}
                value={`${number(e.profile.quantity)} ${e.profile.unit}`}
              />
              <Fact
                label={t("inventory.minimum")}
                value={`${number(e.profile.min_stock)} ${e.profile.unit}`}
              />
              <Fact label={t("common.location")} value={e.location_path} />
            </>
          ) : (
            <>
              <Fact label={t("common.location")} value={e.location_path} />
              <Fact
                label={t("common.category")}
                value={t(`enum.${e.profile.category}`)}
              />
              <Fact
                label={t("home.warranty")}
                value={date(e.profile.warranty_end)}
              />
            </>
          )}
        </div>
      </div>
      <Tabs value={tab} onChange={setTab} items={tabs} />
      {tab === "overview" && (
        <div className="entity-overview-grid">
          <section>
            <SectionHeader
              title={t(vehicle ? "vehicles.configuration" : "common.details")}
            />
            <div className="detail-facts">
              {vehicle ? (
                <>
                  <Fact
                    label={t("vehicles.manufacturer")}
                    value={e.profile.manufacturer}
                  />
                  <Fact label={t("vehicles.model")} value={e.profile.model} />
                  <Fact label={t("vehicles.year")} value={e.profile.year} />
                  <Fact label={t("vehicles.vin")} value={e.profile.vin} />
                  <Fact
                    label={t("vehicles.drivetrain")}
                    value={t(`enum.${e.profile.drivetrain}`)}
                  />
                  <Fact
                    label={t("vehicles.differential")}
                    value={t(`enum.${e.profile.differential}`)}
                  />
                </>
              ) : inventory ? (
                <>
                  <Fact label={t("inventory.sku")} value={e.profile.sku} />
                  <Fact label={t("common.unit")} value={e.profile.unit} />
                </>
              ) : (
                <>
                  <Fact
                    label={t("home.manufacturer")}
                    value={e.profile.manufacturer}
                  />
                  <Fact label={t("home.model")} value={e.profile.model} />
                  <Fact
                    label={t("home.serial")}
                    value={e.profile.serial_number}
                  />
                  <Fact
                    label={t("home.purchase")}
                    value={date(e.profile.purchase_date)}
                  />
                </>
              )}
            </div>
            <SectionHeader title={t("common.notes")} />
            <p className="muted preserve-text" data-testid="entity-notes">
              {e.description || "—"}
            </p>
            {e.status === "SOLD" && (
              <>
                <SectionHeader title={t("enum.SOLD")} />
                <div className="detail-facts">
                  <Fact
                    label={t("vehicles.saleDate")}
                    value={date(e.profile.sale_date)}
                  />
                  <Fact
                    label={t("vehicles.salePrice")}
                    value={
                      e.profile.sale_price != null
                        ? number(e.profile.sale_price) + " CZK"
                        : null
                    }
                  />
                  <Fact
                    label={t("vehicles.saleNote")}
                    value={e.profile.sale_note}
                  />
                </div>
              </>
            )}
            <div className="entity-secondary-actions">
              {canWrite && !inactive && (
                <Btn
                  icon={Pencil}
                  data-testid="entity-edit"
                  onClick={() => open("edit")}
                >
                  {t("common.edit")}
                </Btn>
              )}
              {canAdmin && vehicle && !inactive && (
                <Btn
                  data-testid="entity-sell"
                  icon={MoveRight}
                  onClick={() => open("sale")}
                >
                  {t("vehicles.markSold")}
                </Btn>
              )}
              {canAdmin && (
                <Btn
                  icon={e.archived_at ? RotateCcw : Archive}
                  data-testid="entity-archive"
                  onClick={archive}
                >
                  {t(e.archived_at ? "common.restore" : "common.archive")}
                </Btn>
              )}
            </div>
          </section>
          <section>
            {vehicle ? (
              <>
                <SectionHeader title={t("vehicles.history")} />
                <div className="mileage-history">
                  {e.mileage_history.map((m, i) => (
                    <div key={m.id} data-testid={`mileage-${m.id}`}>
                      <span className="history-dot" />
                      <div>
                        <strong>
                          {number(m.mileage)} {t("common.km")}
                        </strong>
                        <small>{date(m.recorded_at)}</small>
                      </div>
                      {i === 0 && (
                        <Badge
                          status="ACTIVE"
                          testId="current-mileage-marker"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <SectionHeader title={t("nav.activity")} />
                <ActivityFeed
                  items={history?.items?.slice(0, 5) || []}
                  compact
                />
              </>
            )}
          </section>
        </div>
      )}
      {tab === "components" && (
        <>
          <SectionHeader title={t("vehicles.components")}>
            {canWrite && !inactive && (
              <Btn
                icon={Plus}
                data-testid="component-add"
                onClick={() => open("component")}
              >
                {t("vehicles.addComponent")}
              </Btn>
            )}
          </SectionHeader>
          <div className="component-grid">
            {e.components.map((c) => (
              <div
                className="component-item"
                key={c.id}
                data-testid={`component-${c.id}`}
              >
                <span className="row-icon">
                  <Settings2 size={19} />
                </span>
                <div>
                  <strong>
                    {c.generated ? t(`enum.${c.name}`) : c.name}
                  </strong>
                  <small>
                    {c.removed_at ? date(c.removed_at) : t(`enum.${c.kind}`)}
                  </small>
                </div>
                <Badge status={c.status} testId={`component-status-${c.id}`} />
                {canWrite && !inactive && c.status === "ACTIVE" && (
                  <button
                    className="icon-button"
                    title={t("vehicles.removeComponent")}
                    aria-label={t("vehicles.removeComponent")}
                    data-testid={`component-retire-${c.id}`}
                    onClick={() => retire(c)}
                  >
                    <Archive size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      {["maintenance", "service", "tasks", "documents", "expenses"].includes(
        tab,
      ) && <Records key={tab + id} module={tab} entityId={id} embedded />}
      {tab === "movements" && <Movements entityId={id} />}{" "}
      {tab === "activity" && <ActivityFeed items={history?.items || []} />}
    </div>
  );
}

export function LocationDetail() {
  const { id } = useParams();
  const { t, number } = useI18n();
  const { canWrite, setQuickAdd, refresh } = useApp();
  const { data: l, loading, error } = useData(`/locations/${id}`);
  const [tab, setTab] = useState("overview");
  if (loading && !l) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={refresh} />;
  return (
    <div className="entrance">
      <PageHeader
        title={l.name}
        subtitle={l.path}
        back="/home"
        action={
          canWrite && (
            <div className="header-actions">
              <Btn
                data-testid="location-move"
                icon={MoveRight}
                onClick={() => setQuickAdd({ kind: "move", record: l })}
              >
                {t("locations.move")}
              </Btn>
              <Btn
                variant="primary"
                icon={Plus}
                data-testid="location-add-item"
                onClick={() =>
                  setQuickAdd({ kind: "inventory", location_id: id })
                }
              >
                {t("inventory.add")}
              </Btn>
            </div>
          )
        }
      />
      <div className="room-summary">
        <MapPin size={34} strokeWidth={1.2} />
        <Badge status="ACTIVE" testId="room-status" />
        <span>
          <strong>
            {
              l.tasks.filter(
                (t) => !["COMPLETED", "CANCELLED"].includes(t.status),
              ).length
            }
          </strong>
          {t("overview.tasks")}
        </span>
        <span>
          <strong>
            {l.entities.filter((e) => e.entity_type === "HOME_ASSET").length}
          </strong>
          {t("overview.assets")}
        </span>
        <span>
          <strong>
            {l.entities.filter((e) => e.entity_type === "INVENTORY").length}
          </strong>
          {t("overview.stock")}
        </span>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "overview", label: t("nav.overview") },
          { value: "tasks", label: t("nav.tasks") },
          { value: "documents", label: t("nav.documents") },
        ]}
      />
      {tab === "overview" ? (
        <>
          <p className="muted preserve-text">{l.description}</p>
          {l.children.length > 0 && (
            <>
              <SectionHeader title={t("home.subLocations")} />
              <div className="location-grid">
                {l.children.map((c) => (
                  <Link
                    className="location-card compact"
                    key={c.id}
                    to={`/locations/${c.id}`}
                    data-testid={`child-location-${c.id}`}
                  >
                    <MapPin size={20} />
                    <h3>{c.name}</h3>
                    <span>{t(`enum.${c.type}`)}</span>
                  </Link>
                ))}
              </div>
            </>
          )}
          <SectionHeader title={t("home.contents")}>
            {canWrite && (
              <Btn
                data-testid="location-add-asset"
                icon={Plus}
                onClick={() => setQuickAdd({ kind: "asset", location_id: id })}
              >
                {t("home.addAsset")}
              </Btn>
            )}
          </SectionHeader>
          {l.entities.length ? (
            <div className="records-table">
              {l.entities.map((e) => (
                <Link
                  className="table-row location-entity-row"
                  key={e.id}
                  data-testid={`location-entity-${e.id}`}
                  to={`/entities/${e.id}`}
                >
                  <span className="row-icon">
                    {e.entity_type === "INVENTORY" ? (
                      <Boxes size={18} />
                    ) : (
                      <House size={18} />
                    )}
                  </span>
                  <span>
                    <strong>{e.name}</strong>
                    <small>{e.location_path}</small>
                  </span>
                  <Badge
                    status={e.status}
                    testId={`location-entity-status-${e.id}`}
                  />
                  <ArrowUpRight size={15} />
                </Link>
              ))}
            </div>
          ) : (
            <Empty icon={House} title={t("home.noContents")} small />
          )}
        </>
      ) : (
        <Records key={tab + id} module={tab} locationId={id} embedded />
      )}
    </div>
  );
}
