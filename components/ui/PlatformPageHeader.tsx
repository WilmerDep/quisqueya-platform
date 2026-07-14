import React, { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import {
  platformHeaderPrimaryActionClass,
  platformHeaderSecondaryActionClass,
  platformMotionButtonClass,
  platformPageDescriptionClass,
  platformPageTitleClass,
} from './platformStyles';

export type PlatformHeaderAction = {
  label: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
};

type PlatformPageHeaderProps = {
  title: string;
  description: string;
  actions?: PlatformHeaderAction[];
};

export const PlatformPageHeader: React.FC<PlatformPageHeaderProps> = ({ title, description, actions = [] }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const primaryAction = actions.find(action => action.variant === 'primary') || actions[0];
  const secondaryActions = actions.filter(action => action !== primaryAction);

  const renderActionContent = (action: PlatformHeaderAction, iconSize = 18) => {
    const Icon = action.icon;
    return (
      <>
        {Icon ? <Icon size={iconSize} /> : null}
        <span>{action.label}</span>
      </>
    );
  };

  return (
    <section className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
      <div>
        <h1 className={platformPageTitleClass}>{title}</h1>
        <p className={platformPageDescriptionClass}>{description}</p>
      </div>

      {actions.length > 0 ? (
        <>
          <div className="hidden flex-wrap gap-3 md:flex xl:justify-end">
            {actions.map(action => (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                className={`${action.variant === 'primary' ? platformHeaderPrimaryActionClass : platformHeaderSecondaryActionClass} ${
                  action.variant === 'primary' ? '' : platformMotionButtonClass
                }`}
              >
                {renderActionContent(action, 18)}
              </button>
            ))}
          </div>

          <div className="relative flex gap-3 md:hidden">
            {primaryAction ? (
              <button type="button" onClick={primaryAction.onClick} className={`${platformHeaderPrimaryActionClass} flex-1 px-4 text-[15px]`}>
                {renderActionContent(primaryAction, 17)}
              </button>
            ) : null}
            {secondaryActions.length > 0 ? (
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(open => !open)}
                className={`flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#111827] shadow-sm ${platformMotionButtonClass}`}
                aria-expanded={isMobileMenuOpen}
                aria-label="Abrir acciones secundarias"
              >
                <MoreHorizontal size={20} />
              </button>
            ) : null}
            {isMobileMenuOpen ? (
              <div className="absolute right-0 top-[calc(100%+10px)] z-[80] w-[260px] rounded-[24px] border border-[#E5E7EB] bg-white p-2 shadow-[0_24px_60px_rgba(15,23,42,0.14)]">
                {secondaryActions.map(action => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      action.onClick();
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[14px] font-semibold text-[#111827] transition-all duration-200 hover:translate-x-1 hover:bg-[#EFF6FF] hover:text-[#2563EB]"
                  >
                    {renderActionContent(action, 16)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
};
