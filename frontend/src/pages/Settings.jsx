import React, { useState, useEffect } from "react";
import {
  Globe,
  SlidersHorizontal,
  Users,
  ShieldCheck,
  Server,
  Plus,
  Check,
  LogOut,
  Monitor,
  LockKeyhole,
  Database,
  FolderArchive,
  Activity,
  ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { useApp } from "../lib/context";
import { api, errorKey } from "../lib/api";
import { toast } from "../components/ui/sonner";
import {
  PageHeader,
  Btn,
  Field,
  TextInput,
  Select,
  Badge,
  SectionHeader,
  ErrorBox,
  Loading,
  useData,
} from "../components/common";

export default function Settings() {
  const { t } = useI18n();
  const { canAdmin } = useApp();
  const [tab, setTab] = useState("general");
  const sections = [
    ["general", SlidersHorizontal],
    ...(canAdmin ? [["users", Users]] : []),
    ["security", ShieldCheck],
    ["system", Server],
  ];
  return (
    <div className="entrance">
      <PageHeader
        title={t("settings.title")}
        subtitle={t("settings.subtitle")}
      />
      <div className="settings-layout">
        <nav className="settings-nav">
          {sections.map(([key, Icon]) => (
            <button
              key={key}
              data-testid={`settings-tab-${key}`}
              className={tab === key ? "active" : ""}
              onClick={() => setTab(key)}
            >
              <Icon size={17} />
              {t(`settings.${key}`)}
            </button>
          ))}
        </nav>
        <div className="settings-content">
          {tab === "general" ? (
            <General />
          ) : tab === "users" ? (
            <UserSettings />
          ) : tab === "security" ? (
            <Security />
          ) : (
            <System />
          )}
        </div>
      </div>
    </div>
  );
}
function General() {
  const { t, setLanguage } = useI18n();
  const { user, loadUser } = useApp();
  const [form, setForm] = useState({
    language: user.language,
    distance: "km",
    temperature: "C",
    pressure: "bar",
    volume: "L",
    power: "kW",
    currency: "CZK",
    ...user.preferences,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch("/preferences", form);
      await loadUser();
      setLanguage(form.language);
      toast.success(t("common.saved"));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const unit = (key, values) => (
    <Field key={key} id={`setting-${key}`} label={t(`settings.${key}`)}>
      <Select
        id={`setting-${key}`}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        options={values.map(([value, label]) => ({ value, label }))}
      />
    </Field>
  );
  return (
    <form onSubmit={save} data-testid="preferences-form">
      <section className="settings-section">
        <SectionHeader title={t("settings.language")} />
        <p className="muted settings-hint">{t("settings.languageHint")}</p>
        <div className="language-options">
          {[
            ["en", "English"],
            ["cs", "Čeština"],
          ].map(([lang, label]) => (
            <button
              type="button"
              key={lang}
              data-testid={`language-${lang}`}
              className={form.language === lang ? "selected" : ""}
              onClick={() => setForm({ ...form, language: lang })}
            >
              <Globe size={19} />
              <span>{label}</span>
              <span className="radio-indicator">
                {form.language === lang && <Check size={12} />}
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="settings-section">
        <SectionHeader title={t("settings.units")} />
        <p className="muted settings-hint">{t("settings.unitsHint")}</p>
        <div className="form-grid">
          {unit("distance", [
            ["km", "km"],
            ["mi", t("common.miles")],
          ])}
          {unit("temperature", [
            ["C", "°C"],
            ["F", "°F"],
          ])}
          {unit("pressure", [
            ["bar", "bar"],
            ["psi", "psi"],
          ])}
          {unit("volume", [
            ["L", "L"],
            ["gal", "US gal"],
          ])}
          {unit("power", [
            ["kW", "kW"],
            ["hp", "hp"],
          ])}
          {unit("currency", [["CZK", "CZK"]])}
        </div>
      </section>
      {error && <ErrorBox error={error} />}
      <div className="settings-save">
        <Btn
          variant="primary"
          type="submit"
          icon={Check}
          loading={busy}
          data-testid="save-preferences"
        >
          {t("common.save")}
        </Btn>
      </div>
    </form>
  );
}
function UserSettings() {
  const { t } = useI18n();
  const { setQuickAdd, refresh, user } = useApp();
  const { data, loading, error } = useData("/users");
  const change = async (id, values) => {
    try {
      await api.patch("/users/" + id, values);
      refresh();
      toast.success(t("common.saved"));
    } catch (e) {
      toast.error(t(errorKey(e)));
    }
  };
  return (
    <>
      <SectionHeader title={t("settings.users")}>
        <Btn
          icon={Plus}
          variant="primary"
          data-testid="add-household-user"
          onClick={() => setQuickAdd("user")}
        >
          {t("settings.addUser")}
        </Btn>
      </SectionHeader>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox error={error} />
      ) : (
        <div className="user-list">
          {data.map((u) => (
            <div key={u.id} className="user-row" data-testid={`user-${u.id}`}>
              <span className="avatar">{u.name.slice(0, 2).toUpperCase()}</span>
              <div className="user-info">
                <strong>{u.name}</strong>
                <small>{u.email}</small>
                {!u.active && (
                  <small className="negative">
                    {t("settings.accountDisabled")}
                  </small>
                )}
              </div>
              {u.role === "OWNER" ||
              (user.role === "ADMIN" && u.role === "ADMIN") ? (
                <Badge status={u.role} testId={`user-role-${u.id}`} />
              ) : (
                <>
                  <Select
                    id={`user-role-${u.id}`}
                    aria-label={t("settings.role")}
                    value={u.role}
                    options={(user.role === "OWNER"
                      ? ["ADMIN", "MEMBER", "VIEWER"]
                      : ["MEMBER", "VIEWER"]
                    ).map((v) => ({ value: v, label: t(`enum.${v}`) }))}
                    onChange={(e) => change(u.id, { role: e.target.value })}
                  />
                  <Btn
                    data-testid={`user-access-${u.id}`}
                    onClick={() => change(u.id, { active: !u.active })}
                  >
                    {t(u.active ? "settings.disable" : "settings.enable")}
                  </Btn>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
function Security() {
  const { t, date } = useI18n();
  const { refresh } = useApp();
  const { data: sessions, loading, error } = useData("/security/sessions");
  const [password, setPassword] = useState({
      current_password: "",
      new_password: "",
    }),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState(null);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await api.post("/security/password", password);
      setPassword({ current_password: "", new_password: "" });
      refresh();
      toast.success(t("common.saved"));
    } catch (e) {
      setFormError(e);
    } finally {
      setBusy(false);
    }
  };
  const revoke = async (id) => {
    try {
      await api.delete("/security/sessions/" + id);
      refresh();
      toast.success(t("common.saved"));
    } catch (e) {
      toast.error(t(errorKey(e)));
    }
  };
  return (
    <>
      <div className="security-notice">
        <ShieldCheck size={21} />
        <div>
          <strong>{t("settings.localAuth")}</strong>
          <p>{t("settings.localAuthHint")}</p>
        </div>
      </div>
      <form onSubmit={save} className="settings-section">
        <SectionHeader title={t("settings.password")} />
        <p className="muted settings-hint">{t("settings.passwordHint")}</p>
        <div className="form-grid">
          {["current_password", "new_password"].map((key, i) => (
            <Field
              key={key}
              id={key}
              label={t(i ? "settings.newPassword" : "settings.currentPassword")}
            >
              <TextInput
                id={key}
                type="password"
                autoComplete={i ? "new-password" : "current-password"}
                minLength={i ? 12 : 1}
                maxLength={128}
                required
                value={password[key]}
                onChange={(e) =>
                  setPassword({ ...password, [key]: e.target.value })
                }
              />
            </Field>
          ))}
        </div>
        {formError && <ErrorBox error={formError} />}
        <Btn
          type="submit"
          data-testid="change-password-submit"
          loading={busy}
          icon={LockKeyhole}
        >
          {t("settings.password")}
        </Btn>
      </form>
      <section className="settings-section">
        <SectionHeader title={t("settings.sessions")} />
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorBox error={error} />
        ) : (
          sessions.map((s) => (
            <div
              className="session-row"
              key={s.id}
              data-testid={`session-${s.id}`}
            >
              <Monitor size={22} />
              <div>
                <strong>
                  {s.user_agent.includes("Chrome")
                    ? "Chrome"
                    : s.user_agent.includes("Firefox")
                      ? "Firefox"
                      : t("settings.sessions")}
                </strong>
                <small>
                  {date(s.created_at, { hour: "2-digit", minute: "2-digit" })}
                </small>
              </div>
              {s.current ? (
                <span className="quiet-badge success">
                  {t("settings.currentSession")}
                </span>
              ) : (
                <Btn
                  data-testid={`revoke-session-${s.id}`}
                  onClick={() => revoke(s.id)}
                >
                  {t("settings.revoke")}
                </Btn>
              )}
            </div>
          ))
        )}
      </section>
    </>
  );
}
function System() {
  const { t } = useI18n();
  const { data, error, loading } = useData("/health");
  return (
    <>
      <SectionHeader title={t("settings.system")} />
      <p className="muted settings-hint">{t("settings.systemHint")}</p>
      {error ? (
        <ErrorBox error={error} />
      ) : loading ? (
        <Loading />
      ) : (
        <div className="system-details">
          {[
            [Database, "settings.backend", "server.database"],
            [FolderArchive, "settings.storage", "server.storage"],
            [ShieldCheck, "common.status", "server.operational"],
            [FileClockIcon, "settings.audit", "settings.archivePolicy"],
          ].map(([Icon, label, value]) => (
            <div key={label}>
              <Icon size={18} />
              <span>{t(label)}</span>
              <strong data-testid={`system-${label}`}>{t(value)}</strong>
            </div>
          ))}
        </div>
      )}
      <Link
        className="system-audit-link"
        to="/activity"
        data-testid="system-audit-link"
      >
        <Activity size={16} />
        {t("settings.audit")}
        <ChevronRight size={15} />
      </Link>
    </>
  );
}
const FileClockIcon = Activity;
