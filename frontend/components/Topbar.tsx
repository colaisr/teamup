"use client";

export default function Topbar() {
  return (
    <header
      style={{
        borderBottom: "1px solid #1f2937",
        padding: "12px 20px",
        display: "flex",
        justifyContent: "flex-start",
        alignItems: "center"
      }}
    >
      <span className="muted">Russian-first MVP</span>
    </header>
  );
}

