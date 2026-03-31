"use client";

interface TabItem {
  key: string;
  label: string;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (key: string) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <nav
      style={{
        display: "flex",
        gap: "0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            style={{
              padding: "10px 20px",
              fontSize: "13px",
              fontWeight: isActive ? 600 : 400,
              color: isActive ? "var(--accent)" : "var(--text-secondary)",
              background: "transparent",
              border: "none",
              borderBottom: isActive
                ? "2px solid var(--accent)"
                : "2px solid transparent",
              cursor: "pointer",
              transition: "color 0.15s ease, border-color 0.15s ease",
              letterSpacing: "0.01em",
              marginBottom: "-1px",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
