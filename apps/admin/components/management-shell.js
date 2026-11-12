"use client";
export const inputClass = "ui-input";
export const buttonClass = "ui-button";
export function ManagementShell({ title, subtitle, actions, error, children }) {
  return (
    <main className="ui-page">
      <div className="ui-page-header">
        <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
        {actions && <div className="ui-header-actions">{actions}</div>}
      </div>
      <div className="ui-management-content">
      {error && (
        <p role="alert" className="ui-alert ui-alert-danger">
          {error}
        </p>
      )}
      {children}
      </div>
    </main>
  );
}
