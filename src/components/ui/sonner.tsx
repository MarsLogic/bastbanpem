import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

// Theme color palette
const TOAST_COLORS = {
  // Success: dark grey background, white text
  success: {
    bg: "#374151", // dark grey
    text: "#ffffff", // white
    border: "#1f2937", // very dark grey
  },
  // Info: grey background, white text
  info: {
    bg: "#6b7280", // grey
    text: "#ffffff", // white
    border: "#4b5563", // dark grey
  },
  // Warning: light grey background, dark grey text
  warning: {
    bg: "#f3f4f6", // light grey
    text: "#374151", // dark grey
    border: "#d1d5db", // grey
  },
  // Error: very dark grey background, white text
  error: {
    bg: "#1f2937", // very dark grey
    text: "#ffffff", // white
    border: "#111827", // black
  },
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
        style: {
          backgroundColor: TOAST_COLORS.info.bg,
          color: TOAST_COLORS.info.text,
          border: `1px solid ${TOAST_COLORS.info.border}`,
        },
        unstyled: false,
      }}
      {...props}
    />
  )
}

export { Toaster }
