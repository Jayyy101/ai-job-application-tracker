type StatusBannerProps = {
    tone: "success" | "error" | "loading";
    message: string;
};

const statusStyles = {
    success: {
        label: "Success",
        classes: "border-green-700 bg-green-950/50 text-green-200",
    },
    error: {
        label: "Error",
        classes: "border-red-700 bg-red-950/50 text-red-200",
    },
    loading: {
        label: "Working",
        classes: "border-blue-700 bg-blue-950/50 text-blue-200",
    },
};

export function StatusBanner({ tone, message }: StatusBannerProps) {
    const status = statusStyles[tone];

    return (
        <div className={`rounded-2xl border px-5 py-4 ${status.classes}`}>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
                {status.label}
            </p>
            <p className="mt-1 text-sm">{message}</p>
        </div>
    );
}