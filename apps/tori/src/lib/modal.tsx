import { Dialog } from "@repo/ui/components/dialog";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ModalController = {
  close: () => void;
  open: (content: ReactNode) => void;
};

const ModalContext = createContext<ModalController | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode>(null);

  const close = useCallback(() => setContent(null), []);
  const open = useCallback((nextContent: ReactNode) => setContent(nextContent), []);
  const value = useMemo(() => ({ close, open }), [close, open]);

  return (
    <ModalContext.Provider value={value}>
      {children}
      <Dialog open={content !== null} onOpenChange={(open) => !open && close()}>
        {content}
      </Dialog>
    </ModalContext.Provider>
  );
}

export function useModal() {
  const modal = useContext(ModalContext);

  if (!modal) {
    throw new Error("useModal must be used within ModalProvider");
  }

  return modal;
}
