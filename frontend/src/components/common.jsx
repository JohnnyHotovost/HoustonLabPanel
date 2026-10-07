import React, { useEffect, useState } from "react";
import {
  Plus,
  ArrowUpRight,
  X,
  ArrowLeft,
  Loader2,
  CircleAlert,
  PackageOpen,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Skeleton } from "./ui/skeleton";
import { useI18n } from "../lib/i18n";
import { useApp } from "../lib/context";
import { api, errorKey } from "../lib/api";

export const Brand = ({ compact = false }) => {
  const { t } = useI18n();
  return (
    <div className="brand" data-testid="brand">
      <span className="brand-mark">
        <span />
        <span />
        <span />
      </span>
      {!compact && (
        <span>
          {t("brand.name")}
          <small>{t("brand.panel")}</small>
        </span>
      )}
    </div>
  );
};
export const Btn = ({
  children,
  icon: Icon,
  variant = "secondary",
  loading,
  className = "",
  ...props
}) => (
  <Button
    variant={
      variant === "primary"
        ? "default"
        : variant === "ghost"
          ? "ghost"
          : "outline"
    }
    className={`hl-button ${variant} ${className}`}
    disabled={loading || props.disabled}
    {...props}
  >
    {loading ? (
      <Loader2 size={15} className="spin" />
    ) : Icon ? (
      <Icon size={15} />
    ) : null}
    {children}
  </Button>
);
export const IconBtn = ({ icon: Icon, label, ...props }) => (
  <button className="icon-button" title={label} aria-label={label} {...props}>
    <Icon size={18} />
  </button>
);
export const Field = ({ label, id, children, hint, wide = false }) => (
  <div className={`field ${wide ? "wide" : ""}`}>
    <label htmlFor={id} data-testid={`${id}-label`}>
      {label}
    </label>
    {children}
    {hint && (
      <p className="field-hint" data-testid={`${id}-hint`}>
        {hint}
      </p>
    )}
  </div>
);
export const TextInput = ({ id, wide, hint, ...props }) => (
  <Input id={id} data-testid={id} className="hl-input" {...props} />
);
export const TextArea = ({ id, ...props }) => (
  <Textarea
    id={id}
    data-testid={id}
    className="hl-input hl-textarea"
    {...props}
  />
);
export const Select = ({ id, options, placeholder, ...props }) => (
  <select id={id} data-testid={id} className="hl-input hl-select" {...props}>
    {placeholder != null && <option value="">{placeholder}</option>}
    {options.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
);
export const Badge = ({ status, children, testId }) => {
  const { t } = useI18n();
  return (
    <span
      className={`status-badge status-${status}`}
      data-testid={testId || `status-${status}`}
    >
      <span />
      {children || t(`enum.${status}`)}
    </span>
  );
};
export const Modal = ({
  title,
  description,
  open = true,
  onClose,
  children,
  className = "",
  testId = "record-modal",
}) => {
  const { t } = useI18n();
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className={`hl-modal ${className}`}
        data-testid={testId}
        closeLabel={t("common.close")}
      >
        <div className="modal-heading">
          <DialogTitle data-testid={`${testId}-title`}>{title}</DialogTitle>
          <DialogDescription
            className={description ? "modal-description" : "sr-only"}
            data-testid={`${testId}-description`}
          >
            {description || title}
          </DialogDescription>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
};
export const Empty = ({
  icon: Icon = PackageOpen,
  title,
  description,
  action,
  small = false,
}) => (
  <div
    className={`empty-state ${small ? "small" : ""}`}
    data-testid="empty-state"
  >
    <div className="empty-icon">
      <Icon strokeWidth={1.3} />
    </div>
    <h3 data-testid="empty-title">{title}</h3>
    {description && <p data-testid="empty-description">{description}</p>}
    {action}
  </div>
);
export const PageHeader = ({ title, subtitle, action, back }) => {
  const { t } = useI18n();
  return (
    <div className="page-heading">
      {back && (
        <Link to={back} data-testid="back-link" className="back-link">
          <ArrowLeft size={14} />
          {t("common.back")}
        </Link>
      )}
      <div className="page-heading-row">
        <div>
          <h1 data-testid="page-title">{title}</h1>
          {subtitle && <p data-testid="page-subtitle">{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  );
};
export const ErrorBox = ({ error, onRetry }) => {
  const { t } = useI18n();
  return (
    <div role="alert" className="error-box" data-testid="error-message">
      <CircleAlert size={17} />
      <span>{typeof error === "string" ? error : t(errorKey(error))}</span>
      {onRetry && (
        <Btn data-testid="retry-button" onClick={onRetry}>
          {t("common.retry")}
        </Btn>
      )}
    </div>
  );
};
export const Loading = () => (
  <div className="loading-layout" data-testid="loading-state">
    <Skeleton className="h-8 w-56" />
    <Skeleton className="h-4 w-72" />
    <div className="summary-grid">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-36" />
      ))}
    </div>
    <Skeleton className="h-64 w-full" />
  </div>
);
export const Tabs = ({ items, value, onChange, testId = "tabs" }) => (
  <div className="tabs" data-testid={testId}>
    {items.map((item) => (
      <button
        type="button"
        key={item.value}
        data-testid={`${testId}-${item.value}`}
        className={value === item.value ? "active" : ""}
        onClick={() => onChange(item.value)}
      >
        {item.icon && <item.icon size={15} />} {item.label}
        {item.count != null && <span>{item.count}</span>}
      </button>
    ))}
  </div>
);
export const SectionHeader = ({ title, meta, to, children }) => {
  const { t } = useI18n();
  return (
    <div className="section-heading">
      <h2 data-testid={`section-${title.replace(/\s/g, "-")}`}>
        {title}
        {meta != null && <span className="section-count">{meta}</span>}
      </h2>
      {to ? (
        <Link to={to} data-testid={`section-link-${to.replace(/\//g, "-")}`}>
          {t("common.viewAll")}
          <ArrowUpRight size={13} />
        </Link>
      ) : (
        children
      )}
    </div>
  );
};
export function useData(path) {
  const { revision } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .get(path)
      .then((r) => {
        if (active) setData(r.data);
      })
      .catch((e) => {
        if (active) setError(e);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, revision]);
  return { data, error, loading, setData };
}
export const AddButton = ({ kind, label, ...props }) => {
  const { canWrite, setQuickAdd } = useApp();
  const { t } = useI18n();
  return canWrite ? (
    <Btn
      variant="primary"
      icon={Plus}
      data-testid={`add-${kind}-button`}
      onClick={() => setQuickAdd(kind)}
      {...props}
    >
      {label || t(`add.${kind}`)}
    </Btn>
  ) : null;
};
