import * as React from "react";
import { motion } from "framer-motion";
import { buttonVariants, ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Ripple = {
  id: number;
  x: number;
  y: number;
  size: number;
};

export const RippleButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, onClick, type, variant, size, disabled, ...props }, ref) => {
    const [ripples, setRipples] = React.useState<Ripple[]>([]);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (!disabled) {
        const rect = event.currentTarget.getBoundingClientRect();
        const rippleSize = Math.max(rect.width, rect.height) * 2;

        const nextRipple: Ripple = {
          id: Date.now() + Math.random(),
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          size: rippleSize,
        };

        setRipples((previous) => [...previous, nextRipple]);
      }

      onClick?.(event);
    };

    const removeRipple = (rippleId: number) => {
      setRipples((previous) => previous.filter((ripple) => ripple.id !== rippleId));
    };

    return (
      <button
        ref={ref}
        type={type ?? "button"}
        className={cn(buttonVariants({ variant, size, className }), "relative isolate overflow-hidden")}
        onClick={handleClick}
        disabled={disabled}
        {...props}
      >
        <span className="relative z-10">{children}</span>
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
            style={{
              left: ripple.x,
              top: ripple.y,
              width: ripple.size,
              height: ripple.size,
            }}
            initial={{ scale: 0, opacity: 0.15 }}
            animate={{ scale: 1, opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            onAnimationComplete={() => removeRipple(ripple.id)}
          />
        ))}
      </button>
    );
  }
);

RippleButton.displayName = "RippleButton";
