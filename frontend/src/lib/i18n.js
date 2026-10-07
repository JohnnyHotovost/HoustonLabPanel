import React, { createContext, useContext, useState, useCallback } from "react";
import en from "../locales/en.json";
import cs from "../locales/cs.json";

const I18n = createContext(null);
export function I18nProvider({ children }) {
  const [language, setLanguage] = useState(
    localStorage.getItem("houston-language") || "en",
  );
  const changeLanguage = useCallback((lang) => {
    setLanguage(lang);
    localStorage.setItem("houston-language", lang);
    document.documentElement.lang = lang;
  }, []);
  const t = useCallback(
    (key, params = {}) => {
      let value = (language === "cs" ? cs : en)[key] || en[key] || key;
      Object.entries(params).forEach(([k, v]) => {
        value = value.replaceAll(`{${k}}`, v);
      });
      return value;
    },
    [language],
  );
  const date = (value, options = {}) =>
    value
      ? new Intl.DateTimeFormat(language === "cs" ? "cs-CZ" : "en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
          ...options,
        }).format(new Date(value))
      : "—";
  const number = (value) =>
    new Intl.NumberFormat(language === "cs" ? "cs-CZ" : "en-GB", {
      maximumFractionDigits: 3,
    }).format(value || 0);
  return (
    <I18n.Provider
      value={{ language, setLanguage: changeLanguage, t, date, number }}
    >
      {children}
    </I18n.Provider>
  );
}
export const useI18n = () => useContext(I18n);
