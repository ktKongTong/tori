import { Button } from "@repo/ui/components/button";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { consumeAnonymousClaim } from "@/features/binding/api";
import { useModal } from "@/lib/modal";
import { useToastError } from "@/lib/toast-error";

const redeemTokenSchema = z.object({
  token: z.string().trim().min(1, "Token is required"),
});

export function RedeemTokenDialog() {
  const modal = useModal();
  const queryClient = useQueryClient();
  const redeemToken = useMutation({
    mutationFn: async (token: string) => consumeAnonymousClaim(token),
    onSuccess: async () => {
      modal.close();
      await queryClient.invalidateQueries({
        queryKey: ["dashboard", "binding"],
      });
    },
  });
  const redeemTokenForm = useForm({
    defaultValues: {
      token: "",
    },
    validators: {
      onSubmit: redeemTokenSchema,
    },
    onSubmit: ({ value }) => {
      redeemToken.mutate(redeemTokenSchema.parse(value).token);
    },
  });

  useToastError(redeemToken.error, { title: "Failed to redeem token" });

  return (
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle className="normal-case">Redeem Token</DialogTitle>
        <DialogDescription>
          Redeem a bot-side token to bind the current authenticated user with an anonymous identity.
        </DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void redeemTokenForm.handleSubmit();
        }}
      >
        <FieldGroup>
          <redeemTokenForm.Field
            name="token"
            children={(field) => {
              const invalid = field.state.meta.errors.length > 0;

              return (
                <Field data-invalid={invalid}>
                  <FieldLabel htmlFor={field.name}>Token</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="gbt_..."
                    aria-invalid={invalid}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              );
            }}
          />
          <div className="flex justify-end">
            <redeemTokenForm.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
              children={([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  disabled={redeemToken.isPending || isSubmitting || !canSubmit}
                >
                  {redeemToken.isPending || isSubmitting ? "Redeeming..." : "Redeem Token"}
                </Button>
              )}
            />
          </div>
        </FieldGroup>
      </form>
    </DialogContent>
  );
}
