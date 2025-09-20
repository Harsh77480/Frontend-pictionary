import React from "react";

export default function Toasts({ toasts = [], removeToast }) {
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <div>{t.text}</div>
          <button className="toast-close" onClick={() => removeToast?.(t.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}
