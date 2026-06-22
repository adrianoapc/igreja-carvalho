import { forwardRef } from "react";
import { IMaskInput } from "react-imask";
import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

interface MaskedInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  mask: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAccept?: (value: string) => void;
}

const MaskedInput = forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ mask, value, onChange, onAccept, className, ...props }, ref) => {
    const imaskMask = mask.replace(/9/g, "0");

    return (
      <IMaskInput
        mask={imaskMask}
        value={(value as string) ?? ""}
        onAccept={(val) => {
          if (onAccept) onAccept(val as string);
          if (onChange) {
            const syntheticEvent = {
              target: { value: val as string },
            } as React.ChangeEvent<HTMLInputElement>;
            onChange(syntheticEvent);
          }
        }}
        inputRef={ref}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);

MaskedInput.displayName = "MaskedInput";

export { MaskedInput };
