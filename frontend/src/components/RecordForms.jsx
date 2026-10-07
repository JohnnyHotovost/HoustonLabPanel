import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CarFront,
  House,
  Boxes,
  MapPin,
  ListTodo,
  Wrench,
  ClipboardList,
  FileText,
  Wallet,
  ArrowRight,
  Plus,
  Trash2,
  UploadCloud,
  Check,
} from "lucide-react";
import { useI18n } from "../lib/i18n";
import { useApp } from "../lib/context";
import { api } from "../lib/api";
import { toast } from "./ui/sonner";
import {
  Modal,
  Field,
  TextInput,
  TextArea,
  Select,
  Btn,
  ErrorBox,
  PageHeader,
  useData,
} from "./common";

const icons = {
  vehicle: CarFront,
  asset: House,
  inventory: Boxes,
  location: MapPin,
  task: ListTodo,
  maintenance: Wrench,
  service: ClipboardList,
  document: FileText,
  expense: Wallet,
};
const today = () => new Date().toISOString().slice(0, 10);
const num = (v) => (v === "" || v == null ? null : Number(v));
const nullable = (v) => v || null;

export function QuickAdd() {
  const { quickAdd, setQuickAdd } = useApp();
  const { t } = useI18n();
  const navigate = useNavigate();
  const config = typeof quickAdd === "string" ? { kind: quickAdd } : quickAdd;
  useEffect(() => {
    if (config && ["vehicle", "service"].includes(config.kind)) {
      navigate(
        `/new/${config.kind}${config.entity_id ? "?entity=" + config.entity_id : ""}`,
      );
      setQuickAdd(null);
    }
  }, [quickAdd]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!config || ["vehicle", "service"].includes(config.kind)) return null;
  if (config.kind === "choose")
    return (
      <Modal
        title={t("add.title")}
        description={t("add.subtitle")}
        onClose={() => setQuickAdd(null)}
        testId="quick-add-modal"
      >
        <div className="add-menu">
          {Object.entries(icons).map(([kind, Icon]) => (
            <button
              data-testid={`add-option-${kind}`}
              key={kind}
              onClick={() => setQuickAdd(kind)}
            >
              <span className="add-menu-icon">
                <Icon size={19} strokeWidth={1.5} />
              </span>
              <span>{t(`add.${kind}`)}</span>
              <ArrowRight size={15} />
            </button>
          ))}
        </div>
      </Modal>
    );
  return (
    <Modal
      title={formTitle(config.kind, t)}
      onClose={() => setQuickAdd(null)}
      className={
        ["maintenance", "asset"].includes(config.kind) ? "wide-modal" : ""
      }
      testId={`form-${config.kind}-modal`}
    >
      <RecordForm
        key={JSON.stringify(config)}
        config={config}
        onDone={() => setQuickAdd(null)}
      />
    </Modal>
  );
}
const formTitle = (kind, t) =>
  t(
    {
      mileage: "vehicles.updateMileage",
      sale: "vehicles.markSold",
      completion: "maintenance.complete",
      stock: "inventory.adjust",
      component: "vehicles.addComponent",
      edit: "common.edit",
      move: "locations.move",
      user: "settings.addUser",
    }[kind] || `add.${kind}`,
  );

export function NewRecord() {
  const { kind } = useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { canWrite } = useApp();
  const entity = new URLSearchParams(window.location.search).get("entity");
  if (!["vehicle", "service"].includes(kind) || !canWrite)
    return <ErrorBox error={t("error.forbidden")} />;
  return (
    <div className="form-page entrance">
      <PageHeader
        title={t(kind === "vehicle" ? "vehicles.add" : "service.add")}
        subtitle={t(
          kind === "vehicle" ? "vehicles.subtitle" : "service.subtitle",
        )}
        back={kind === "vehicle" ? "/vehicles" : "/service"}
      />
      <RecordForm
        key={kind + entity}
        fullPage
        config={{ kind, entity_id: entity }}
        onDone={(result) =>
          navigate(result?.entity_type ? `/entities/${result.id}` : "/service")
        }
      />
    </div>
  );
}

export function RecordForm({ config, onDone, fullPage = false }) {
  const { t } = useI18n();
  const { refresh, user } = useApp();
  const { kind, record = {} } = config;
  const { data: entities } = useData("/entities");
  const { data: locations } = useData("/locations");
  const { data: users } = useData("/users");
  const { data: maintenance } = useData("/maintenance");
  const [components, setComponents] = useState([]),
    [file, setFile] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  const [f, setF] = useState({
    name: record.name || "",
    title: "",
    description: record.description || "",
    entity_id: config.entity_id || "",
    location_id: config.location_id || record.location_id || "",
    parent_id: record.parent_id || "",
    type: kind === "document" ? "OTHER" : "ROOM",
    manufacturer: "",
    model: "",
    plate: "",
    vin: "",
    year: "",
    mileage: record.profile?.mileage ?? "",
    engine: "",
    transmission: "MANUAL",
    drivetrain: "FWD",
    differential: "NONE",
    serial_number: "",
    category: kind === "expense" ? "" : "OTHER",
    purchase_date: "",
    warranty_end: "",
    unit: "pcs",
    consumable: false,
    min_stock: "0",
    initial_quantity: "0",
    sku: "",
    priority: "NORMAL",
    due_date: "",
    assigned_user_id: "",
    strategy: "TIME",
    interval_days: "365",
    interval_km: "10000",
    fixed_date: "",
    baseline_date: today(),
    baseline_mileage: "0",
    warning_days: "30",
    warning_km: "1500",
    source: "OWNER_DEFINED",
    source_reference: "",
    component_id: "",
    date: today(),
    notes: "",
    workshop: "",
    cost: "0",
    maintenance_ids: [],
    materials: [],
    delta: "",
    reason: "",
    amount: "",
    supplier: "",
    sale_date: today(),
    sale_mileage: record.profile?.mileage ?? 0,
    sale_price: "",
    sale_note: "",
    status: record.status || "ACTIVE",
    component_kind: "OTHER",
    installed_at: today(),
    email: "",
    password: "",
    role: "MEMBER",
  });
  const update = (key, value) => setF((prev) => ({ ...prev, [key]: value }));
  const selectedEntity = (entities || []).find((e) => e.id === f.entity_id);
  useEffect(() => {
    if (!f.entity_id) {
      setComponents([]);
      return;
    }
    let active = true;
    api
      .get(`/entities/${f.entity_id}`)
      .then((r) => {
        if (active) setComponents(r.data.components || []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [f.entity_id]);
  useEffect(() => {
    if (selectedEntity?.entity_type === "VEHICLE" && f.mileage === "")
      update("mileage", selectedEntity.profile.mileage);
  }, [selectedEntity]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (f.drivetrain !== "AWD" && f.differential === "HALDEX")
      update("differential", "NONE");
    if (f.drivetrain !== "FWD" && f.differential === "VAQ")
      update("differential", "NONE");
  }, [f.drivetrain, f.differential]);
  const opts = (values) =>
    values.map((v) => ({ value: v, label: t(`enum.${v}`) }));
  const text = (key, label, props = {}) => (
    <Field
      key={key}
      id={`field-${key}`}
      label={t(label)}
      hint={props.hint ? t(props.hint) : null}
      wide={props.wide}
    >
      <TextInput
        id={`field-${key}`}
        value={f[key]}
        onChange={(e) => update(key, e.target.value)}
        {...props}
      />
    </Field>
  );
  const area = (key, label) => (
    <Field key={key} id={`field-${key}`} label={t(label)} wide>
      <TextArea
        id={`field-${key}`}
        value={f[key]}
        onChange={(e) => update(key, e.target.value)}
        maxLength={10000}
      />
    </Field>
  );
  const select = (key, label, options, optional = false) => (
    <Field key={key} id={`field-${key}`} label={t(label)}>
      <Select
        id={`field-${key}`}
        value={f[key]}
        onChange={(e) => update(key, e.target.value)}
        options={options}
        required={!optional}
        placeholder={optional ? t("common.none") : undefined}
      />
    </Field>
  );
  const loc = (key = "location_id", label = "common.location") =>
    select(
      key,
      label,
      (locations || [])
        .filter((l) => l.id !== record.id)
        .map((l) => ({ value: l.id, label: l.path })),
      true,
    );
  const entity = (required = false) => (
    <Field id="field-entity_id" label={t("common.entity")}>
      <Select
        id="field-entity_id"
        value={f.entity_id}
        required={required}
        placeholder={t("common.none")}
        onChange={(e) => {
          update("entity_id", e.target.value);
          update("component_id", "");
          update("maintenance_ids", []);
          update("mileage", "");
        }}
        options={(entities || [])
          .filter(
            (e) =>
              !["SOLD", "WRITTEN_OFF", "REPLACED", "DISPOSED"].includes(
                e.status,
              ) &&
              (!["maintenance", "service"].includes(kind) ||
                e.entity_type !== "INVENTORY"),
          )
          .map((e) => ({ value: e.id, label: e.name }))}
      />
    </Field>
  );
  const section = (label) => (
    <h2 className="form-section-title wide">{t(label)}</h2>
  );
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let path = "",
        payload = {},
        method = "post";
      if (["vehicle", "asset", "inventory"].includes(kind)) {
        path = "/entities";
        payload = {
          name: f.name,
          description: f.description,
          location_id: nullable(f.location_id),
          entity_type: {
            vehicle: "VEHICLE",
            asset: "HOME_ASSET",
            inventory: "INVENTORY",
          }[kind],
        };
        if (kind === "vehicle")
          payload.vehicle = {
            manufacturer: f.manufacturer,
            model: f.model,
            plate: f.plate,
            vin: f.vin,
            year: num(f.year),
            mileage: num(f.mileage) || 0,
            engine: f.engine,
            transmission: f.transmission,
            drivetrain: f.drivetrain,
            differential: f.differential,
          };
        if (kind === "asset")
          payload.asset = {
            manufacturer: f.manufacturer,
            model: f.model,
            serial_number: f.serial_number,
            category: f.category,
            purchase_date: nullable(f.purchase_date),
            warranty_end: nullable(f.warranty_end),
          };
        if (kind === "inventory")
          payload.inventory = {
            unit: f.unit,
            consumable: f.consumable,
            min_stock: num(f.min_stock) || 0,
            initial_quantity: num(f.initial_quantity) || 0,
            sku: f.sku,
          };
      } else if (kind === "location") {
        path = "/locations";
        payload = {
          name: f.name,
          type: f.type,
          parent_id: nullable(f.parent_id),
          description: f.description,
        };
      } else if (kind === "task") {
        path = "/tasks";
        payload = {
          title: f.title,
          description: f.description,
          priority: f.priority,
          due_date: nullable(f.due_date),
          entity_id: nullable(f.entity_id),
          location_id: nullable(f.location_id),
          assigned_user_id: nullable(f.assigned_user_id),
        };
      } else if (kind === "maintenance") {
        path = "/maintenance";
        payload = {
          entity_id: f.entity_id,
          component_id: nullable(f.component_id),
          title: f.title,
          strategy: f.strategy,
          interval_days: ["TIME", "COMBINED"].includes(f.strategy)
            ? num(f.interval_days)
            : null,
          interval_km: ["DISTANCE", "COMBINED"].includes(f.strategy)
            ? num(f.interval_km)
            : null,
          fixed_date: f.strategy === "FIXED_DATE" ? f.fixed_date : null,
          baseline_date: f.baseline_date,
          baseline_mileage: num(f.baseline_mileage) || 0,
          warning_days: num(f.warning_days) || 0,
          warning_km: num(f.warning_km) || 0,
          source: f.source,
          source_reference: f.source_reference,
        };
      } else if (kind === "service") {
        path = "/service";
        payload = {
          entity_id: f.entity_id,
          title: f.title,
          date: f.date,
          mileage:
            selectedEntity?.entity_type === "VEHICLE" ? num(f.mileage) : null,
          workshop: f.workshop,
          notes: f.notes,
          maintenance_ids: f.maintenance_ids,
          materials: f.materials.map((m) => ({
            entity_id: m.entity_id,
            quantity: Number(m.quantity),
          })),
          cost: num(f.cost) || 0,
        };
      } else if (kind === "document") {
        path = "/documents";
        payload = new FormData();
        payload.append("title", f.title);
        payload.append("type", f.type);
        payload.append("file", file);
        if (f.entity_id) payload.append("entity_id", f.entity_id);
        if (config.service_event_id)
          payload.append("service_event_id", config.service_event_id);
        if (config.location_id)
          payload.append("location_id", config.location_id);
      } else if (kind === "expense") {
        path = "/expenses";
        payload = {
          amount: num(f.amount),
          currency: "CZK",
          category: f.category,
          date: f.date,
          supplier: f.supplier,
          notes: f.notes,
          entity_id: nullable(f.entity_id),
          service_event_id: config.service_event_id || null,
        };
      } else if (kind === "mileage") {
        path = `/entities/${record.id}/mileage`;
        payload = { mileage: num(f.mileage) };
      } else if (kind === "sale") {
        path = `/entities/${record.id}/sell`;
        payload = {
          sale_date: f.sale_date,
          sale_mileage: num(f.sale_mileage),
          sale_price: num(f.sale_price),
          sale_note: f.sale_note,
        };
      } else if (kind === "stock") {
        path = `/entities/${record.id}/stock`;
        payload = { delta: num(f.delta), reason: f.reason };
      } else if (kind === "completion") {
        path = `/maintenance/${record.id}/complete`;
        payload = {
          date: f.date,
          mileage: record.entity_type === "VEHICLE" ? num(f.mileage) : null,
          notes: f.notes,
        };
      } else if (kind === "component") {
        path = `/entities/${record.id}/components`;
        payload = {
          name: f.name,
          kind: f.component_kind,
          installed_at: nullable(f.installed_at),
        };
      } else if (kind === "move") {
        path = `/locations/${record.id}/move`;
        method = "patch";
        payload = { parent_id: nullable(f.parent_id) };
      } else if (kind === "edit") {
        path = `/entities/${record.id}`;
        method = "patch";
        payload = {
          name: f.name,
          description: f.description,
          location_id: nullable(f.location_id),
          status: f.status,
        };
      } else if (kind === "user") {
        path = "/users";
        payload = {
          name: f.name,
          email: f.email,
          password: f.password,
          role: f.role,
        };
      }
      const { data } = await api[method](path, payload);
      refresh();
      toast.success(t("common.recorded"));
      onDone(data);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      onSubmit={submit}
      className={`record-form ${fullPage ? "full-page-form" : ""}`}
      data-testid={`record-form-${kind}`}
    >
      <div className="form-grid">
        {kind === "vehicle" && (
          <>
            {section("vehicles.identity")}
            {text("name", "common.name", {
              required: true,
              maxLength: 180,
              wide: true,
            })}
            {text("manufacturer", "vehicles.manufacturer")}
            {text("model", "vehicles.model")}
            {text("plate", "vehicles.plate")}
            {text("vin", "vehicles.vin", { maxLength: 32 })}
            {text("year", "vehicles.year", {
              type: "number",
              min: 1886,
              max: 2100,
            })}
            {text("mileage", "vehicles.mileage", {
              type: "number",
              min: 0,
              step: 1,
            })}
            {section("vehicles.configuration")}
            {text("engine", "vehicles.engine")}
            {select(
              "transmission",
              "vehicles.transmission",
              opts(["MANUAL", "AUTOMATIC", "DSG", "ELECTRIC"]),
            )}
            {select(
              "drivetrain",
              "vehicles.drivetrain",
              opts(["FWD", "RWD", "AWD"]),
            )}
            {select(
              "differential",
              "vehicles.differential",
              opts([
                "NONE",
                ...(f.drivetrain === "FWD" ? ["VAQ"] : []),
                ...(f.drivetrain === "AWD" ? ["HALDEX"] : []),
                "OTHER",
              ]),
            )}
            {loc()}
            {area("description", "common.notes")}
          </>
        )}
        {kind === "asset" && (
          <>
            {text("name", "common.name", {
              required: true,
              maxLength: 180,
              wide: true,
            })}
            {loc()}
            {select(
              "category",
              "common.category",
              opts([
                "APPLIANCES",
                "CLIMATE",
                "WATER",
                "CLEANING",
                "ELECTRICAL",
                "SMART_HOME",
                "NETWORKING",
                "BUILDING",
                "OTHER",
              ]),
            )}
            {text("manufacturer", "home.manufacturer")}
            {text("model", "home.model")}
            {text("serial_number", "home.serial")}
            {text("purchase_date", "home.purchase", { type: "date" })}
            {text("warranty_end", "home.warranty", { type: "date" })}
            {area("description", "common.notes")}
          </>
        )}
        {kind === "inventory" && (
          <>
            {text("name", "common.name", {
              required: true,
              maxLength: 180,
              wide: true,
            })}
            {loc()}
            {select(
              "unit",
              "common.unit",
              [
                "pcs",
                "set",
                "pair",
                "ml",
                "L",
                "g",
                "kg",
                "mm",
                "cm",
                "m",
                "pack",
                "roll",
              ].map((v) => ({ value: v, label: t(`unit.${v}`) })),
            )}
            {text("initial_quantity", "inventory.initial", {
              type: "number",
              min: 0,
              step: 0.001,
            })}
            {text("min_stock", "inventory.minimum", {
              type: "number",
              min: 0,
              step: 0.001,
            })}
            {text("sku", "inventory.sku")}
            <label
              className="checkbox-label field-checkbox"
              htmlFor="field-consumable"
            >
              <input
                id="field-consumable"
                data-testid="field-consumable"
                type="checkbox"
                checked={f.consumable}
                onChange={(e) => update("consumable", e.target.checked)}
              />
              {t("inventory.consumable")}
            </label>
            {area("description", "common.notes")}
          </>
        )}
        {kind === "location" && (
          <>
            {text("name", "common.name", {
              required: true,
              maxLength: 160,
              wide: true,
            })}
            {select(
              "type",
              "locations.type",
              opts([
                "ROOM",
                "AREA",
                "CABINET",
                "SHELF",
                "DRAWER",
                "RACK",
                "BOX",
                "BIN",
                "OTHER",
              ]),
            )}
            {loc("parent_id", "locations.parent")}
            {area("description", "common.description")}
          </>
        )}
        {kind === "task" && (
          <>
            {text("title", "tasks.titleField", {
              required: true,
              maxLength: 180,
              wide: true,
            })}
            {select(
              "priority",
              "tasks.priority",
              opts(["LOW", "NORMAL", "HIGH", "CRITICAL"]),
            )}
            {text("due_date", "tasks.due", { type: "date" })}
            {entity()}
            {loc()}
            {select(
              "assigned_user_id",
              "tasks.assigned",
              (users || [])
                .filter((u) => u.active)
                .map((u) => ({ value: u.id, label: u.name })),
              true,
            )}
            {area("description", "common.description")}
          </>
        )}
        {kind === "maintenance" && (
          <>
            {text("title", "maintenance.rule", {
              required: true,
              wide: true,
              maxLength: 180,
            })}
            {entity(true)}
            {select(
              "component_id",
              "maintenance.component",
              components
                .filter((c) => c.status === "ACTIVE")
                .map((c) => ({
                  value: c.id,
                  label: c.generated ? t(`enum.${c.name}`) : c.name,
                })),
              true,
            )}
            {select(
              "strategy",
              "maintenance.strategy",
              opts([
                "TIME",
                ...(selectedEntity?.entity_type === "VEHICLE"
                  ? ["DISTANCE", "COMBINED"]
                  : []),
                "FIXED_DATE",
                "CONDITION",
              ]),
            )}
            {select(
              "source",
              "maintenance.source",
              opts([
                "MANUFACTURER",
                "SERVICE_MANUAL",
                "DEALER",
                "SPECIALIST",
                "OWNER_DEFINED",
                "PRESET",
              ]),
            )}
            {["TIME", "COMBINED"].includes(f.strategy) &&
              text("interval_days", "maintenance.intervalDays", {
                type: "number",
                min: 1,
                required: true,
              })}
            {["DISTANCE", "COMBINED"].includes(f.strategy) &&
              text("interval_km", "maintenance.intervalKm", {
                type: "number",
                min: 1,
                required: true,
              })}
            {f.strategy === "FIXED_DATE" &&
              text("fixed_date", "maintenance.fixedDate", {
                type: "date",
                required: true,
              })}
            {text("baseline_date", "maintenance.baselineDate", {
              type: "date",
              required: true,
            })}
            {selectedEntity?.entity_type === "VEHICLE" &&
              text("baseline_mileage", "maintenance.baselineMileage", {
                type: "number",
                min: 0,
              })}
            {text("warning_days", "maintenance.warningDays", {
              type: "number",
              min: 0,
            })}
            {selectedEntity?.entity_type === "VEHICLE" &&
              text("warning_km", "maintenance.warningKm", {
                type: "number",
                min: 0,
              })}
            {area("source_reference", "maintenance.reference")}
          </>
        )}
        {kind === "service" && (
          <>
            {section("service.details")}
            {text("title", "service.titleField", {
              required: true,
              wide: true,
              maxLength: 180,
            })}
            {entity(true)}
            {text("date", "common.date", {
              type: "date",
              required: true,
              max: today(),
            })}
            {selectedEntity?.entity_type === "VEHICLE" &&
              text("mileage", "vehicles.mileage", {
                type: "number",
                min: 0,
                required: true,
              })}
            {text("workshop", "service.workshop")}
            {section("service.maintenanceItems")}
            <div className="maintenance-checklist wide">
              {(maintenance || []).filter(
                (m) =>
                  m.entity_id === f.entity_id && m.status !== "NOT_APPLICABLE",
              ).length ? (
                (maintenance || [])
                  .filter(
                    (m) =>
                      m.entity_id === f.entity_id &&
                      m.status !== "NOT_APPLICABLE",
                  )
                  .map((m) => (
                    <label
                      htmlFor={`service-check-${m.id}`}
                      key={m.id}
                      className="checkbox-label"
                    >
                      <input
                        id={`service-check-${m.id}`}
                        data-testid={`service-check-${m.id}`}
                        type="checkbox"
                        checked={f.maintenance_ids.includes(m.id)}
                        onChange={(e) =>
                          update(
                            "maintenance_ids",
                            e.target.checked
                              ? [...f.maintenance_ids, m.id]
                              : f.maintenance_ids.filter((id) => id !== m.id),
                          )
                        }
                      />
                      {m.title}
                      <span>{t(`enum.${m.status}`)}</span>
                    </label>
                  ))
              ) : (
                <p className="muted">{t("service.noItems")}</p>
              )}
            </div>
            {section("service.materials")}
            <div className="materials-list wide">
              {f.materials.map((m, i) => (
                <div className="material-row" key={i}>
                  <Select
                    id={`material-item-${i}`}
                    required
                    placeholder={t("add.inventory")}
                    value={m.entity_id}
                    onChange={(e) =>
                      update(
                        "materials",
                        f.materials.map((v, j) =>
                          i === j ? { ...v, entity_id: e.target.value } : v,
                        ),
                      )
                    }
                    options={(entities || [])
                      .filter((e) => e.entity_type === "INVENTORY")
                      .map((e) => ({
                        value: e.id,
                        label: `${e.name} (${e.profile.quantity} ${e.profile.unit})`,
                      }))}
                  />
                  <TextInput
                    id={`material-quantity-${i}`}
                    aria-label={t("common.quantity")}
                    type="number"
                    min="0.001"
                    step="0.001"
                    required
                    value={m.quantity}
                    onChange={(e) =>
                      update(
                        "materials",
                        f.materials.map((v, j) =>
                          i === j ? { ...v, quantity: e.target.value } : v,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={t("common.remove")}
                    data-testid={`remove-material-${i}`}
                    onClick={() =>
                      update(
                        "materials",
                        f.materials.filter((_, j) => i !== j),
                      )
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <Btn
                type="button"
                icon={Plus}
                data-testid="add-service-material"
                onClick={() =>
                  update("materials", [
                    ...f.materials,
                    { entity_id: "", quantity: 1 },
                  ])
                }
              >
                {t("service.addMaterial")}
              </Btn>
            </div>
            {text("cost", "service.cost", {
              type: "number",
              min: 0,
              step: 0.01,
            })}
            {area("notes", "common.notes")}
          </>
        )}
        {kind === "document" && (
          <>
            {text("title", "documents.titleField", {
              required: true,
              maxLength: 180,
              wide: true,
            })}
            {select(
              "type",
              "common.type",
              opts([
                "INVOICE",
                "SERVICE_REPORT",
                "MANUAL",
                "WARRANTY",
                "INSURANCE",
                "CONTRACT",
                "RECEIPT",
                "TECHNICAL",
                "OTHER",
              ]),
            )}
            {entity()}
            <Field
              label={t("documents.file")}
              id="document-file"
              hint={t("documents.types")}
              wide
            >
              <div className="file-drop">
                <UploadCloud size={26} strokeWidth={1.4} />
                <input
                  id="document-file"
                  data-testid="document-file"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  required
                  onChange={(e) => {
                    setFile(e.target.files[0]);
                    if (!f.title && e.target.files[0])
                      update(
                        "title",
                        e.target.files[0].name.replace(/\.[^.]+$/, ""),
                      );
                  }}
                />
              </div>
            </Field>
          </>
        )}
        {kind === "expense" && (
          <>
            {text("amount", "common.amount", {
              type: "number",
              min: 0,
              step: 0.01,
              required: true,
            })}
            {text("date", "common.date", { type: "date", required: true })}
            {text("category", "common.category", {
              required: true,
              maxLength: 80,
            })}
            {text("supplier", "common.supplier")}
            {entity()}
            {area("notes", "common.notes")}
          </>
        )}
        {kind === "mileage" &&
          text("mileage", "vehicles.newMileage", {
            type: "number",
            required: true,
            min: record.profile?.mileage ?? 0,
            step: 1,
            wide: true,
          })}
        {kind === "sale" && (
          <>
            <p className="form-notice wide" data-testid="sale-warning">
              {t("vehicles.soldWarning")}
            </p>
            {text("sale_date", "vehicles.saleDate", {
              type: "date",
              required: true,
              max: today(),
            })}
            {text("sale_mileage", "vehicles.saleMileage", {
              type: "number",
              min: record.profile?.mileage ?? 0,
              required: true,
            })}
            {text("sale_price", "vehicles.salePrice", {
              type: "number",
              min: 0,
              step: 0.01,
            })}
            {area("sale_note", "vehicles.saleNote")}
          </>
        )}
        {kind === "stock" && (
          <>
            {text("delta", "inventory.delta", {
              type: "number",
              step: 0.001,
              required: true,
              wide: true,
            })}
            {text("reason", "inventory.reason", {
              required: true,
              maxLength: 240,
              wide: true,
            })}
          </>
        )}
        {kind === "completion" && (
          <>
            {text("date", "maintenance.completedDate", {
              type: "date",
              required: true,
              max: today(),
            })}
            {record.entity_type === "VEHICLE" &&
              text("mileage", "vehicles.mileage", {
                type: "number",
                min: 0,
                required: ["DISTANCE", "COMBINED"].includes(record.strategy),
              })}
            {area("notes", "common.notes")}
          </>
        )}
        {kind === "component" && (
          <>
            {text("name", "vehicles.componentName", {
              required: true,
              wide: true,
            })}
            {select(
              "component_kind",
              "vehicles.componentKind",
              opts([
                "ENGINE",
                "TRANSMISSION",
                "CLUTCH",
                "DIFFERENTIAL",
                "BRAKES",
                "COOLING",
                "SUSPENSION",
                "WHEELS",
                "OTHER",
              ]),
            )}
            {text("installed_at", "common.date", { type: "date" })}
          </>
        )}
        {kind === "move" && (
          <>
            {loc("parent_id", "locations.parent")}
            <p className="muted small wide">{t("locations.moveHelp")}</p>
          </>
        )}
        {kind === "edit" && (
          <>
            {text("name", "common.name", { required: true, wide: true })}
            {loc()}
            {select(
              "status",
              "common.status",
              opts(
                record.entity_type === "VEHICLE"
                  ? ["OPERATIONAL", "STORED", "IN_SERVICE", "UNAVAILABLE"]
                  : record.entity_type === "HOME_ASSET"
                    ? ["ACTIVE", "STORED", "IN_REPAIR", "REPLACED", "DISPOSED"]
                    : ["ACTIVE", "STORED", "DISPOSED"],
              ),
            )}
            {area("description", "common.description")}
          </>
        )}
        {kind === "user" && (
          <>
            {text("name", "auth.name", { required: true, wide: true })}
            {text("email", "auth.email", {
              required: true,
              type: "email",
              wide: true,
              autoComplete: "off",
            })}
            {text("password", "auth.password", {
              required: true,
              type: "password",
              minLength: 12,
              maxLength: 128,
              wide: true,
              autoComplete: "new-password",
              hint: "auth.password.hint",
            })}
            {select(
              "role",
              "settings.role",
              opts(
                user.role === "OWNER"
                  ? ["ADMIN", "MEMBER", "VIEWER"]
                  : ["MEMBER", "VIEWER"],
              ),
            )}
          </>
        )}
      </div>
      {error && <ErrorBox error={error} />}
      <div className="form-actions">
        <Btn type="button" data-testid="form-cancel" onClick={() => onDone()}>
          {t("common.cancel")}
        </Btn>
        <Btn
          type="submit"
          variant="primary"
          icon={kind === "document" ? UploadCloud : Check}
          loading={busy}
          data-testid="form-submit"
        >
          {t(
            kind === "document"
              ? "documents.upload"
              : kind === "sale"
                ? "vehicles.markSold"
                : "common.save",
          )}
        </Btn>
      </div>
    </form>
  );
}
