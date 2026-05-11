import * as React from "react";

import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";

function AlertDialog({ ...props }: React.ComponentProps<typeof Dialog>) {
  return <Dialog {...props} />;
}

function AlertDialogTrigger({ ...props }: React.ComponentProps<typeof DialogTrigger>) {
  return <DialogTrigger {...props} />;
}

function AlertDialogContent({ ...props }: React.ComponentProps<typeof DialogContent>) {
  return <DialogContent showCloseButton={false} {...props} />;
}

function AlertDialogHeader({ ...props }: React.ComponentProps<typeof DialogHeader>) {
  return <DialogHeader {...props} />;
}

function AlertDialogFooter({ ...props }: React.ComponentProps<typeof DialogFooter>) {
  return <DialogFooter {...props} />;
}

function AlertDialogTitle({ ...props }: React.ComponentProps<typeof DialogTitle>) {
  return <DialogTitle {...props} />;
}

function AlertDialogDescription({ ...props }: React.ComponentProps<typeof DialogDescription>) {
  return <DialogDescription {...props} />;
}

function AlertDialogCancel({ children = "Cancel", ...props }: React.ComponentProps<typeof Button>) {
  return <DialogClose render={<Button variant="outline" {...props} />}>{children}</DialogClose>;
}

function AlertDialogAction({
  variant = "destructive",
  ...props
}: React.ComponentProps<typeof Button>) {
  return <Button variant={variant} {...props} />;
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
};
