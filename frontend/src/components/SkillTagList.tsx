type SkillTagListProps = {
  title: string;
  skills: string[];
  emptyMessage: string;
  tone: "green" | "red";
};

const tagToneClasses = {
  green: "border-green-700 bg-green-950/70 text-green-300",
  red: "border-red-700 bg-red-950/70 text-red-300",
};

export function SkillTagList({
  title,
  skills,
  emptyMessage,
  tone,
}: SkillTagListProps) {
  return (
    <div>
      <p className="font-semibold text-white">{title}</p>

      {skills.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {skills.map((skill, index) => (
            <span
              key={`${skill}-${index}`}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${tagToneClasses[tone]}`}
            >
              {skill}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-sm text-slate-500">{emptyMessage}</p>
      )}
    </div>
  );
}