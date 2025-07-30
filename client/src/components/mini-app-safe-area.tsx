import { ReactNode } from "react";

interface MiniAppSafeAreaProps {
  children: ReactNode;
  className?: string;
}

export function MiniAppSafeArea({ children, className = "" }: MiniAppSafeAreaProps) {
  return (
    <div 
      className={`mini-app-safe-area ${className}`}
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
        minHeight: 'calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom))'
      }}
    >
      {children}
    </div>
  );
}