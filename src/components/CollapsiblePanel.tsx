import React from 'react';

/**
 * A column of the main panel that can be folded away to a narrow rail. The
 * grid that holds these decides the widths, so collapsing one automatically
 * hands its space to whichever columns are still open.
 */
export const CollapsiblePanel: React.FC<{
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, collapsed, onToggle, children }) => {
  if (collapsed) {
    return (
      <div
        className="module flex xl:flex-col items-center justify-center xl:justify-start gap-2 cursor-pointer select-none !px-2 !py-3 hover:border-[var(--accent)]"
        onClick={onToggle}
        title={`Show ${title}`}
      >
        <span className="text-[var(--accent)] opacity-90 text-[10px]">▶</span>
        {/* Reads bottom-to-top in the rail, and stays horizontal when the
            columns stack on a narrow window. */}
        <span className="label-meta whitespace-nowrap xl:[writing-mode:vertical-rl] xl:rotate-180">
          {title}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-w-0">
      <div
        className="flex items-center justify-between mb-2 cursor-pointer select-none opacity-90 hover:opacity-100"
        onClick={onToggle}
        title={`Hide ${title}`}
      >
        <span className="label-meta">{title}</span>
        <span className="text-[var(--accent)] text-[10px]">◀</span>
      </div>
      <div className="flex flex-col gap-6 flex-1 min-w-0">{children}</div>
    </div>
  );
};
