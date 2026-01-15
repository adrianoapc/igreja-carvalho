import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
} from "@/components/ui/drawer";

const MOBILE_QUERY = "(max-width: 768px)";

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);

    setMatches(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

type RootProps = Pick<React.ComponentProps<typeof Dialog>, "open" | "defaultOpen" | "onOpenChange">;

interface ResponsiveDialogProps extends RootProps {
  trigger?: React.ReactNode;
  children: React.ReactNode;
  /** @deprecated title prop is ignored - include DialogTitle inside children */
  title?: string;
  dialogContentProps?: React.ComponentPropsWithoutRef<typeof DialogContent>;
  drawerContentProps?: React.ComponentPropsWithoutRef<typeof DrawerContent>;
  dialogProps?: Omit<React.ComponentProps<typeof Dialog>, "children">;
  drawerProps?: Omit<React.ComponentProps<typeof Drawer>, "children">;
}

export function ResponsiveDialog({
  trigger,
  children,
  open,
  defaultOpen,
  onOpenChange,
  title: _title, // ignored - kept for backwards compatibility
  dialogContentProps,
  drawerContentProps,
  dialogProps,
  drawerProps,
}: ResponsiveDialogProps) {
  const isMobile = useMediaQuery(MOBILE_QUERY);

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        {trigger ? <DrawerTrigger asChild>{trigger}</DrawerTrigger> : null}
        <DrawerContent {...drawerContentProps}>{children}</DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange} {...dialogProps}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent {...dialogContentProps}>
        {/* Título invisível para acessibilidade (exigência do Radix Dialog) */}
        <DialogTitle className="sr-only">Diálogo</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
