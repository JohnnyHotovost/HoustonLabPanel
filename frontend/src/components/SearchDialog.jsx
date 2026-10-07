import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  ArrowUpRight,
  CarFront,
  House,
  Boxes,
  FileText,
  ListTodo,
  Wrench,
  MapPin,
} from "lucide-react";
import { Modal, Empty, ErrorBox, TextInput } from "./common";
import { useI18n } from "../lib/i18n";
import { api } from "../lib/api";
const icons = {
  VEHICLE: CarFront,
  HOME_ASSET: House,
  INVENTORY: Boxes,
  LOCATION: MapPin,
  DOCUMENT: FileText,
  TASK: ListTodo,
  MAINTENANCE: Wrench,
};
export default function SearchDialog({ onClose }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [query, setQuery] = useState(""),
    [results, setResults] = useState([]),
    [error, setError] = useState(null),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true;
    setError(null);
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(
      () =>
        api
          .get("/search", { params: { q: query } })
          .then((r) => {
            if (active) setResults(r.data);
          })
          .catch((e) => {
            if (active) setError(e);
          })
          .finally(() => {
            if (active) setLoading(false);
          }),
      200,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);
  return (
    <Modal
      title={t("search.title")}
      onClose={onClose}
      className="search-modal"
      testId="search-modal"
    >
      <div className="search-input-wrap">
        <Search size={19} />
        <TextInput
          id="global-search-input"
          autoFocus
          value={query}
          placeholder={t("search.placeholder")}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {error ? (
        <ErrorBox error={error} />
      ) : (
        <div className="search-results" data-testid="search-results">
          {loading ? (
            <div className="search-hint">{t("common.loading")}</div>
          ) : results.length ? (
            results.map((r) => {
              const Icon = icons[r.type] || Search;
              return (
                <button
                  key={`${r.type}-${r.id}`}
                  className="search-result"
                  data-testid={`search-result-${r.id}`}
                  onClick={() => {
                    navigate(r.path);
                    onClose();
                  }}
                >
                  <Icon size={18} />
                  <span>
                    <strong>{r.name}</strong>
                    <small>
                      {t(`enum.${r.type}`)}
                      {r.context ? ` · ${r.context}` : ""}
                    </small>
                  </span>
                  <ArrowUpRight size={15} />
                </button>
              );
            })
          ) : (
            <Empty
              icon={Search}
              small
              title={t(query ? "search.empty" : "search.hint")}
            />
          )}
        </div>
      )}
    </Modal>
  );
}
