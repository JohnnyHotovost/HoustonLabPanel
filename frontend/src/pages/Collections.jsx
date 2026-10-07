import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  CarFront,
  House,
  Boxes,
  MapPin,
  ArrowUpRight,
  Search,
  FolderOpen,
  ChevronRight,
  Archive,
  SlidersHorizontal,
  RotateCcw,
} from "lucide-react";
import { useI18n } from "../lib/i18n";
import { useApp } from "../lib/context";
import {
  PageHeader,
  AddButton,
  Empty,
  Loading,
  ErrorBox,
  Badge,
  Tabs,
  useData,
  TextInput,
  Btn,
} from "../components/common";

export default function Collections({ module }) {
  const { t, number } = useI18n();
  const { refresh, user } = useApp();
  const [tab, setTab] = useState(module === "home" ? "rooms" : "active"),
    [query, setQuery] = useState("");
  const type =
    module === "vehicles"
      ? "VEHICLE"
      : module === "home"
        ? "HOME_ASSET"
        : "INVENTORY";
  const {
    data: entities,
    error,
    loading,
  } = useData(`/entities?entity_type=${type}&archived=true`);
  const { data: locations } = useData("/locations");
  const [params] = useSearchParams();
  const kind =
    module === "vehicles"
      ? "vehicle"
      : module === "home" && tab === "rooms"
        ? "location"
        : module === "home"
          ? "asset"
          : "inventory";
  const Icon =
    module === "vehicles" ? CarFront : module === "home" ? House : Boxes;
  const tabs =
    module === "vehicles"
      ? [
          { value: "active", label: t("vehicles.active") },
          { value: "previous", label: t("vehicles.previous") },
          { value: "archived", label: t("common.archived") },
        ]
      : module === "home"
        ? [
            { value: "rooms", label: t("home.rooms") },
            { value: "active", label: t("home.assets") },
            { value: "archived", label: t("common.archived") },
          ]
        : [
            { value: "active", label: t("inventory.items") },
            { value: "locations", label: t("inventory.locations") },
            { value: "movements", label: t("inventory.movements") },
            { value: "archived", label: t("common.archived") },
          ];
  const list = (entities || [])
    .filter((e) =>
      tab === "archived"
        ? !!e.archived_at
        : !e.archived_at &&
          (module !== "vehicles" ||
            (tab === "previous"
              ? ["SOLD", "WRITTEN_OFF"].includes(e.status)
              : !["SOLD", "WRITTEN_OFF"].includes(e.status))),
    )
    .filter((e) =>
      (
        e.name +
        " " +
        e.location_path +
        " " +
        Object.values(e.profile).join(" ")
      )
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    );
  const roomList = (locations || [])
    .filter((l) => tab !== "rooms" || l.type === "ROOM")
    .filter((l) => l.path.toLowerCase().includes(query.trim().toLowerCase()));
  const constrainedView = !!query.trim() || ['previous', 'archived'].includes(tab);
  const clearFilters = () => {
    setQuery('');
    if (['previous', 'archived'].includes(tab)) setTab('active');
  };
  const clearAction = <Btn icon={RotateCcw} data-testid="collection-clear-filters" onClick={clearFilters}>{t('common.clearFilters')}</Btn>;
  return (
    <div className="entrance">
      <PageHeader
        title={t(`${module}.title`)}
        subtitle={t(`${module}.subtitle`)}
        action={
          <AddButton
            kind={kind}
            label={t(
              module === "home" && tab === "rooms"
                ? "home.addRoom"
                : `${module}.add`,
            )}
          />
        }
      />
      <div className="collection-toolbar">
        <Tabs
          items={tabs}
          value={tab}
          onChange={(v) => {
            setTab(v);
            setQuery("");
          }}
        />
        <div className="filter-search">
          <Search size={15} />
          <TextInput
            id="collection-search"
            placeholder={t("common.search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox error={error} onRetry={refresh} />
      ) : tab === "movements" ? (
        <Movements />
      ) : ["rooms", "locations"].includes(tab) ? (
        roomList.length ? (
          <div className="location-grid">
            {roomList.map((l) => (
              <Link
                to={`/locations/${l.id}`}
                key={l.id}
                data-testid={`location-${l.id}`}
                className="location-card"
              >
                <span className="location-symbol">
                  <House size={26} strokeWidth={1.2} />
                </span>
                <ArrowUpRight className="location-arrow" size={16} />
                <h3>{l.name}</h3>
                <p>
                  {l.parent_id
                    ? l.path.split(" / ").slice(0, -1).join(" / ")
                    : t(`enum.${l.type}`)}
                </p>
                <div className="location-meta">
                  <span>
                    {number(l.entity_count)} {t("common.items")}
                  </span>
                  <span className="subtle-dot sage" />
                  {t("common.active")}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <Empty
            icon={House}
            title={t(query.trim() ? 'common.noResults' : tab === "rooms" ? "home.empty" : "locations.empty")}
            description={t(
              query.trim() ? 'common.noResults.detail' : tab === "rooms" ? "home.empty.detail" : "locations.empty.detail",
            )}
            action={query.trim() ? clearAction : <AddButton kind="location" label={t(tab === 'rooms' ? "home.addRoom" : 'locations.add')} />}
          />
        )
      ) : list.length ? (
        <div
          className={module === "vehicles" ? "vehicle-grid" : "records-table"}
        >
          {module !== "vehicles" && (
            <div className="table-heading entity-row">
              <span>{t("common.name")}</span>
              <span>
                {t(
                  module === "inventory"
                    ? "inventory.stock"
                    : "common.category",
                )}
              </span>
              <span>{t("common.location")}</span>
              <span>{t("common.status")}</span>
            </div>
          )}
          {list.map((e) =>
            module === "vehicles" ? (
              <Link
                to={`/entities/${e.id}`}
                key={e.id}
                data-testid={`entity-${e.id}`}
                className="vehicle-card"
              >
                <div className="vehicle-top">
                  <span className="vehicle-emblem">
                    <CarFront size={40} strokeWidth={1.15} />
                  </span>
                  <Badge status={e.status} testId={`entity-status-${e.id}`} />
                </div>
                <div className="vehicle-title">
                  <span>
                    {[e.profile.year, e.profile.manufacturer]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <h3>{e.name}</h3>
                  <p>{e.profile.plate || "—"}</p>
                </div>
                <div className="vehicle-specs">
                  <div>
                    <span>{t("vehicles.mileage")}</span>
                    <strong>
                      {number(
                        user.preferences?.distance === "mi"
                          ? e.profile.mileage / 1.609344
                          : e.profile.mileage,
                      )}{" "}
                      <small>
                        {t(
                          user.preferences?.distance === "mi"
                            ? "common.miles"
                            : "common.km",
                        )}
                      </small>
                    </strong>
                  </div>
                  <div>
                    <span>{t("vehicles.drivetrain")}</span>
                    <strong>{t(`enum.${e.profile.drivetrain}`)}</strong>
                  </div>
                  <ArrowUpRight size={17} />
                </div>
              </Link>
            ) : (
              <Link
                to={`/entities/${e.id}`}
                className="table-row entity-row"
                key={e.id}
                data-testid={`entity-${e.id}`}
              >
                <div className="row-name">
                  <span className="row-icon">
                    <Icon size={18} />
                  </span>
                  <span>
                    <strong>{e.name}</strong>
                    <small>
                      {e.profile.model ||
                        e.profile.sku ||
                        e.profile.manufacturer}
                    </small>
                  </span>
                </div>
                <span>
                  {module === "inventory"
                    ? `${number(e.profile.quantity)} ${e.profile.unit}`
                    : t(`enum.${e.profile.category}`)}
                </span>
                <span className="muted location-cell">
                  <MapPin size={13} />
                  {e.location_path || "—"}
                </span>
                <Badge
                  status={e.profile.low_stock ? "LOW_STOCK" : e.status}
                  testId={`entity-status-${e.id}`}
                />
              </Link>
            ),
          )}
        </div>
      ) : (
        <Empty
          icon={Icon}
          title={t(
            query.trim()
              ? "common.noResults"
              : constrainedView ? 'common.emptyView' : `${module === "home" ? "home.assetEmpty" : module + ".empty"}`,
          )}
          description={
            t(constrainedView ? (query.trim() ? 'common.noResults.detail' : 'common.emptyView.detail')
              : `${module === "home" ? "home.assetEmpty" : module + ".empty"}.detail`)
          }
          action={
            constrainedView ? clearAction : (
              <AddButton
                kind={kind}
                label={t(module === "home" ? "home.addAsset" : `${module}.add`)}
              />
            )
          }
        />
      )}
    </div>
  );
}
export function Movements({ entityId }) {
  const { t, date, number } = useI18n();
  const { data, loading, error } = useData(
    "/stock-movements" + (entityId ? "?entity_id=" + entityId : ""),
  );
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  return data.length ? (
    <div className="records-table">
      {data.map((m) => (
        <div
          className="movement-row table-row"
          key={m.id}
          data-testid={`movement-${m.id}`}
        >
          <span
            className={`movement-amount ${m.delta > 0 ? "positive" : "negative"}`}
          >
            {m.delta > 0 ? "+" : ""}
            {number(m.delta)} <small>{m.unit}</small>
          </span>
          <div>
            <Link
              data-testid={`movement-entity-${m.id}`}
              to={`/entities/${m.entity_id}`}
            >
              {m.entity_name}
            </Link>
            <p className="muted small">
              {m.reason === "INITIAL_STOCK" ? t("inventory.initial") : m.reason}
            </p>
          </div>
          <span className="muted small">{date(m.created_at)}</span>
        </div>
      ))}
    </div>
  ) : (
    <Empty
      icon={Boxes}
      title={t("inventory.movementEmpty")}
      description={t("inventory.movementHint")}
      small
    />
  );
}
