import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap", {
  variants: {
    variant: {
      default: "bg-secondary text-secondary-foreground",
      entry: "bg-entry/15 text-entry",
      exit: "bg-exit/15 text-exit",
      warn: "bg-warn/15 text-warn",
      danger: "bg-danger/15 text-danger",
      solid: "bg-danger text-white",
      outline: "border border-border text-muted-foreground",
    },
  },
  defaultVariants: { variant: "default" },
});
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}
function Badge({ className, variant, ...props }: BadgeProps) { return <span className={cn(badgeVariants({ variant }), className)} {...props} />; }
export { Badge };
