import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  House,
  Boxes,
  Wrench,
  ListTodo,
  CarFront,
  ClipboardList,
  Files,
  Activity,
  Search,
  Settings,
  ChevronDown,
  ChevronRight,
  Plus,
  Server,
  Menu,
  X,
  Bell,
  LogOut,
  Command,
  CheckCheck,
} from "lucide-react";
import { Brand, IconBtn, Modal, Empty, Btn, useData } from "./common";
import { useI18n } from "../lib/i18n";
import { useApp } from "../lib/context";
import { api, errorKey } from "../lib/api";
import { toast } from "./ui/sonner";
import SearchDialog from "./SearchDialog";

const groups = [
  { items: [["overview", LayoutDashboard, "/"]] },
  {
    label: "home",
    items: [
      ["home", House, "/home"],
      ["inventory", Boxes, "/inventory"],
      ["maintenance", Wrench, "/maintenance"],
      ["tasks", ListTodo, "/tasks"],
    ],
  },
  {
    label: "garage",
    items: [
      ["vehicles", CarFront, "/vehicles"],
      ["service", ClipboardList, "/service"],
    ],
  },
  {
    label: "system",
    items: [
      ["documents", Files, "/documents"],
      ["activity", Activity, "/activity"],
    ],
  },
];
export default function Shell() {
  const { t } = useI18n();
  const { user, setUser, setQuickAdd, canWrite } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: health, error: healthError } = useData('/health');
  const operational = health?.status === 'operational' && !healthError;
  const [search, setSearch] = useState(false),
    [mobile, setMobile] = useState(false),
    [profile, setProfile] = useState(false),
    [notices, setNotices] = useState(null);
  useEffect(() => {
    const fn = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearch((v) => !v);
      }
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, []);
  useEffect(() => {
    setMobile(false);
    setProfile(false);
  }, [location.pathname]);
  const section =
    location.pathname === "/" ? "overview" : location.pathname.split("/")[1];
  const logout = async () => {
    try {
      await api.post("/auth/logout");
      setUser(null);
    } catch (e) {
      toast.error(t(errorKey(e)));
    }
  };
  const notification = async () => {
    try {
      const { data } = await api.get("/overview");
      setNotices(data.attention);
    } catch (e) {
      toast.error(t(errorKey(e)));
    }
  };
  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="sidebar-backdrop"
          aria-label={t("nav.close")}
          data-testid="sidebar-backdrop"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <div className="sidebar-brand">
          <Brand />
        </div>
        <button
          className="workspace-switch"
          data-testid="workspace-settings"
          onClick={() => navigate("/settings")}
        >
          <span className="workspace-icon">
            <House size={15} />
          </span>
          <span>{user.household}</span>
          <ChevronDown size={13} />
        </button>
        <nav className="main-nav">
          {groups.map((group, i) => (
            <div key={i} className="nav-group">
              {group.label && (
                <span
                  className="nav-group-label"
                  data-testid={`nav-group-${group.label}`}
                >
                  {t(`nav.group.${group.label}`)}
                </span>
              )}
              {group.items.map(([key, Icon, path]) => (
                <NavLink
                  end={path === "/"}
                  to={path}
                  key={key}
                  data-testid={`nav-${key}`}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? "active" : ""}`
                  }
                >
                  <Icon size={17} strokeWidth={1.65} />
                  <span>{t(`nav.${key}`)}</span>
                  {key === "overview" && <span className="nav-active-dot" />}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="nav-item"
            data-testid="nav-search"
            onClick={() => setSearch(true)}
          >
            <Search size={17} />
            <span>{t("nav.search")}</span>
            <kbd>⌘ K</kbd>
          </button>
          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
            data-testid="nav-settings"
          >
            <Settings size={17} strokeWidth={1.65} />
            <span>{t("nav.settings")}</span>
          </NavLink>
          <div className="server-status">
            <Server size={19} />
            <div>
              <strong data-testid="server-name">{t("server.name")}</strong>
              <span data-testid="server-status">
                <i style={{ backgroundColor: operational ? 'var(--green)' : 'var(--muted)' }} />
                {t(operational ? "server.operational" : "server.offline")}
              </span>
            </div>
            <span className="server-signal">
              <i />
              <i />
              <i />
            </span>
          </div>
          <button
            data-testid="sidebar-profile"
            className="sidebar-user"
            onClick={() => navigate("/settings")}
          >
            <span className="avatar">
              {user.name.slice(0, 2).toUpperCase()}
            </span>
            <span>
              <strong data-testid="sidebar-user-name">{user.name}</strong>
              <small data-testid="sidebar-user-role">
                {t(`enum.${user.role}`)}
              </small>
            </span>
            <ChevronRight size={15} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-breadcrumb">
            <button
              className="icon-button mobile-menu"
              data-testid="mobile-menu-button"
              aria-label={t("nav.menu")}
              onClick={() => setMobile(true)}
            >
              <Menu size={18} />
            </button>
            <House size={15} />
            <span className="breadcrumb-divider">/</span>
            <span data-testid="topbar-page">
              {t(
                `nav.${["locations"].includes(section) ? "inventory" : section}`,
              )}
            </span>
          </div>
          <div className="topbar-actions">
            <button
              className="top-search"
              data-testid="global-search-button"
              onClick={() => setSearch(true)}
            >
              <Search size={15} />
              <span>{t("nav.search")}</span>
              <kbd>Ctrl K</kbd>
            </button>
            <span className="topbar-separator" />
            <IconBtn
              icon={Bell}
              label={t("overview.attention")}
              data-testid="notifications-button"
              onClick={notification}
            />
            {canWrite && (
              <Btn
                icon={Plus}
                variant="primary"
                data-testid="global-add-button"
                onClick={() => setQuickAdd("choose")}
              >
                {t("common.add")}
                <ChevronDown size={13} />
              </Btn>
            )}
            <div className="profile-wrapper">
              <button
                data-testid="profile-button"
                className="avatar top-avatar"
                aria-label={user.name}
                onClick={() => setProfile(!profile)}
              >
                {user.name.slice(0, 2).toUpperCase()}
              </button>
              {profile && (
                <div className="profile-menu">
                  <button
                    data-testid="profile-settings"
                    onClick={() => navigate("/settings")}
                  >
                    <Settings size={15} />
                    {t("nav.settings")}
                  </button>
                  <button data-testid="logout-button" onClick={logout}>
                    <LogOut size={15} />
                    {t("auth.logout")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>
            <span className="footer-dot" />
            {t("server.local")}
          </span>
          <span>{t("settings.version")}</span>
        </footer>
      </div>
      {search && <SearchDialog onClose={() => setSearch(false)} />}
      {notices && (
        <Modal
          title={t("overview.attention")}
          onClose={() => setNotices(null)}
          testId="notifications-modal"
        >
          {notices.length ? (
            notices.map((n) => (
              <button
                className="search-result"
                key={n.id}
                data-testid={`notification-${n.id}`}
                onClick={() => {
                  navigate(n.path);
                  setNotices(null);
                }}
              >
                <span>{n.title}</span>
                <ChevronRight size={16} />
              </button>
            ))
          ) : (
            <Empty
              icon={CheckCheck}
              title={t("overview.clear")}
              description={t("overview.clear.detail")}
              small
            />
          )}
        </Modal>
      )}
    </div>
  );
}
