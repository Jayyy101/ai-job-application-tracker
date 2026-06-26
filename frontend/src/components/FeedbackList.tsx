type FeedbackListProps = {
    title: string;
    items: string[];
    emptyMessage: string;
    tone: "blue" | "yellow" | "orange";
    boxed?: boolean;
};

const textToneClasses = {
    blue: "text-blue-300",
    yellow: "text-yellow-300",
    orange: "text-orange-200",
};

const boxToneClasses = {
    blue: "border-blue-800 bg-blue-950/30",
    yellow: "border-yellow-800 bg-yellow-950/30",
    orange: "border-orange-800 bg-orange-950/30",
};

export function FeedbackList({
    title,
    items,
    emptyMessage,
    tone,
    boxed = false,
}: FeedbackListProps) {
    return (
        <div
            className={
                boxed
                    ? `rounded-lg border p-3 ${boxToneClasses[tone]}`
                    : undefined
            }
        >
            <p
                className={
                    boxed
                        ? `font-semibold ${textToneClasses[tone]}`
                        : "font-semibold text-white"
                }
            >
                {title}
            </p>

            {items.length > 0 ? (
                <ul
                    className={`mt-2 list-inside list-disc text-sm ${textToneClasses[tone]}`}
                >
                    {items.map((item, index) => (
                        <li key={`${item}-${index}`}>{item}</li>
                    ))}
                </ul>
            ) : (
                <p className={`mt-1 text-sm ${textToneClasses[tone]}`}>
                    {emptyMessage}
                </p>
            )}
        </div>
    );
}