import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@/App.css";
import { I18nProvider } from "./lib/i18n";
import { AppProvider, useApp } from "./lib/context";
import { Toaster } from "./components/ui/sonner";
import { Loading, ErrorBox } from "./components/common";
import Shell from "./components/Shell";
import Auth from "./pages/Auth";
import Overview from "./pages/Overview";
import Collections from "./pages/Collections";
import Records from "./pages/Records";
import Settings from "./pages/Settings";
import EntityDetail, { LocationDetail } from "./pages/Detail";
import { QuickAdd, NewRecord } from "./components/RecordForms";

function Workspace() {
  const { user, loading, error, initialize } = useApp();
  if (loading)
    return (
      <div className="boot-loading">
        <Loading />
      </div>
    );
  if (error)
    return (
      <div className="boot-loading">
        <ErrorBox error={error} onRetry={initialize} />
      </div>
    );
  if (!user) return <Auth />;
  return (
    <>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<Overview />} />
          {["vehicles", "home", "inventory"].map((module) => (
            <Route
              key={module}
              path={`/${module}`}
              element={<Collections key={module} module={module} />}
            />
          ))}
          {[
            "maintenance",
            "tasks",
            "service",
            "documents",
            "activity",
            "expenses",
          ].map((module) => (
            <Route
              key={module}
              path={`/${module}`}
              element={<Records key={module} module={module} />}
            />
          ))}
          <Route path="/entities/:id" element={<EntityDetail />} />
          <Route path="/locations/:id" element={<LocationDetail />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/new/:kind" element={<NewRecord />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <QuickAdd />
    </>
  );
}
export default function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <AppProvider>
          <Workspace />
          <Toaster theme="dark" position="bottom-right" richColors />
        </AppProvider>
      </BrowserRouter>
    </I18nProvider>
  );
}
