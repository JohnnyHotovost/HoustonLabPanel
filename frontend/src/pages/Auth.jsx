import React, { useState } from "react";
import { ArrowRight, LockKeyhole, Globe, ShieldCheck } from "lucide-react";
import { Brand, Btn, Field, TextInput, ErrorBox } from "../components/common";
import { useI18n } from "../lib/i18n";
import { useApp } from "../lib/context";
import { api } from "../lib/api";

export default function Auth() {
  const { t, language, setLanguage } = useI18n();
  const { setup, setSetup, loadUser } = useApp();
  const [form, setForm] = useState({
    name: "",
    household_name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const input = (key) => ({
    value: form[key],
    onChange: (e) => setForm({ ...form, [key]: e.target.value }),
  });
  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (setup && form.password !== form.confirm) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    setBusy(true);
    try {
      await api.post(
        setup ? "/auth/setup" : "/auth/login",
        setup
          ? {
              name: form.name,
              household_name: form.household_name,
              email: form.email,
              password: form.password,
              language,
            }
          : { email: form.email, password: form.password },
      );
      setSetup(false);
      await loadUser();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-page">
      <div className="auth-backdrop" />
      <header className="auth-header">
        <Brand />
        <button
          data-testid="auth-language-toggle"
          className="language-toggle"
          onClick={() => setLanguage(language === "en" ? "cs" : "en")}
        >
          <Globe size={15} />
          {language === "en" ? "Čeština" : "English"}
        </button>
      </header>
      <main className="auth-main">
        <div className="auth-form-wrap">
          <div className="eyebrow" data-testid="auth-step">
            <span className="tiny-line" />
            {t(setup ? "auth.setup.step" : "auth.login.step")}
          </div>
          <h1 data-testid="auth-title">
            {t(setup ? "auth.setup.title" : "auth.login.title")}
          </h1>
          <p className="auth-intro" data-testid="auth-subtitle">
            {t(setup ? "auth.setup.subtitle" : "auth.login.subtitle")}
          </p>
          <form onSubmit={submit} data-testid="auth-form" className="auth-form">
            {setup && (
              <div className="form-grid">
                <Field label={t("auth.name")} id="auth-name">
                  <TextInput
                    id="auth-name"
                    autoComplete="name"
                    placeholder={t("auth.name.placeholder")}
                    required
                    maxLength={120}
                    {...input("name")}
                  />
                </Field>
                <Field label={t("auth.household")} id="auth-household">
                  <TextInput
                    id="auth-household"
                    placeholder={t("auth.household.placeholder")}
                    required
                    maxLength={120}
                    {...input("household_name")}
                  />
                </Field>
              </div>
            )}
            <Field label={t("auth.email")} id="auth-email">
              <TextInput
                id="auth-email"
                type="email"
                autoComplete="username"
                placeholder={t("auth.email.placeholder")}
                required
                {...input("email")}
              />
            </Field>
            <Field
              label={t("auth.password")}
              id="auth-password"
              hint={setup ? t("auth.password.hint") : null}
            >
              <TextInput
                id="auth-password"
                type="password"
                autoComplete={setup ? "new-password" : "current-password"}
                required
                minLength={setup ? 12 : 1}
                maxLength={128}
                {...input("password")}
              />
            </Field>
            {setup && (
              <Field label={t("auth.confirm")} id="auth-confirm">
                <TextInput
                  id="auth-confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                  {...input("confirm")}
                />
              </Field>
            )}
            {error && <ErrorBox error={error} />}
            <Btn
              variant="primary"
              type="submit"
              loading={busy}
              data-testid="auth-submit"
              className="auth-submit"
            >
              {t(setup ? "auth.create" : "auth.login")}
              <ArrowRight size={16} />
            </Btn>
          </form>
          <div className="auth-assurance" data-testid="auth-assurance">
            <LockKeyhole size={13} />
            {t("auth.local")}
          </div>
        </div>
      </main>
      <div className="auth-caption" data-testid="auth-caption">
        <span className="eyebrow">{t("brand.subtitle")}</span>
        <p>{t("brand.tagline")}</p>
      </div>
      <footer className="auth-footer">
        <span data-testid="auth-footer">{t("auth.setup.footer")}</span>
        <span>
          <ShieldCheck size={13} />
          {t("server.private")}
        </span>
      </footer>
    </div>
  );
}
