import { useState } from 'react';

interface ActionBtnProps {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  color?: 'default' | 'blue' | 'amber' | 'red';
  title?: string;
  disabled?: boolean;
}

const COLORS = {
  default: { bg: 'var(--card-sub)', border: 'var(--border)', text: 'var(--text-sub)', hBg: '#F1F5F9', hText: 'var(--text-body)' },
  blue:    { bg: '#EFF6FF', border: 'rgba(37,99,235,0.20)', text: '#2563EB', hBg: '#DBEAFE', hText: '#1D4ED8' },
  amber:   { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.22)', text: '#D97706', hBg: 'rgba(217,119,6,0.15)', hText: '#B45309' },
  red:     { bg: 'rgba(220,38,38,0.06)', border: 'rgba(220,38,38,0.18)', text: '#DC2626', hBg: 'rgba(220,38,38,0.12)', hText: '#B91C1C' },
};

export function ActionBtn({
  icon: Icon,
  label,
  onClick,
  color = 'default',
  title,
  disabled = false,
}: ActionBtnProps) {
  const c = COLORS[color];
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '6px 11px',
        borderRadius: 8,
        border: `1px solid ${hovered && !disabled ? c.border : c.border}`,
        background: disabled ? 'var(--card-sub)' : hovered ? c.hBg : c.bg,
        color: disabled ? 'var(--text-muted)' : hovered ? c.hText : c.text,
        fontSize: 12,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.14s',
        fontFamily: 'inherit',
        letterSpacing: '-0.01em',
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap' as const,
      }}
    >
      <Icon size={13} strokeWidth={2} />
      {label}
    </button>
  );
}