import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { DashboardResult } from "@/components/dashboard-ui";
import { issueBindingToken } from "@/features/binding/api";
import { useToastError } from "@/lib/toast-error";

type IssueTokenDialogProps = {
  userId: string;
};

export function IssueTokenDialog({ userId }: IssueTokenDialogProps) {
  const [issuedToken, setIssuedToken] = useState<null | {
    code: string;
    token: string;
    codeExpiresAt: string;
    tokenExpiresAt: string;
  }>(null);
  const issueToken = useMutation({
    mutationFn: async () => issueBindingToken(userId),
    onSuccess: (result) => {
      setIssuedToken({
        code: result.code,
        token: result.token,
        codeExpiresAt: result.codeExpiresAt,
        tokenExpiresAt: result.tokenExpiresAt,
      });
    },
  });

  useEffect(() => {
    issueToken.mutate();
  }, []);

  useToastError(issueToken.error, { title: "Failed to issue token" });

  return (
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle className="normal-case">Issue Token</DialogTitle>
        <DialogDescription>
          Issue a web-side token for the current authenticated user, then use it in bot to bind an
          anonymous identity.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        {issuedToken ? (
          <>
            <Field>
              <FieldLabel>Code</FieldLabel>
              <Input value={issuedToken.code} readOnly />
            </Field>
            <DashboardResult title="Token" value={issuedToken.token} />
            <DashboardResult title="Code Expires At" value={issuedToken.codeExpiresAt} />
            <DashboardResult title="Token Expires At" value={issuedToken.tokenExpiresAt} />
          </>
        ) : (
          <DashboardResult title="Status" value="Token is being prepared." />
        )}
      </FieldGroup>
    </DialogContent>
  );
}
