import type { CSSProperties, ReactNode } from "react";
import Button from "./Button";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "primary" | "danger";
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "primary",
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div style={overlayStyle} role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        style={dialogStyle}
      >
        <h2 id="confirm-dialog-title" style={titleStyle}>
          {title}
        </h2>
        <p style={descriptionStyle}>{description}</p>
        {children ? <div style={contentStyle}>{children}</div> : null}
        <div style={actionsStyle}>
          <Button type="button" variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={confirmVariant} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </section>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1rem",
  background: "rgba(0, 0, 0, 0.72)",
};

const dialogStyle: CSSProperties = {
  width: "100%",
  maxWidth: "460px",
  padding: "1.25rem",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--surface)",
  color: "var(--text)",
  boxShadow: "0 18px 45px rgba(0, 0, 0, 0.34)",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.25rem",
  lineHeight: 1.25,
};

const descriptionStyle: CSSProperties = {
  margin: "0.65rem 0 0",
  color: "var(--text-muted)",
  lineHeight: 1.5,
};

const contentStyle: CSSProperties = {
  marginTop: "1rem",
};

const actionsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "0.75rem",
  flexWrap: "wrap",
  marginTop: "1.25rem",
};
