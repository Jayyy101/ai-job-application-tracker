// Hand-authored synthetic UX fixture. This is not model output or an evaluation result.
export const RESUME_BLOCKS = [
  { id: "demo-v1:p1", section: "University project · Campus Planner", text: "Built a course-planning interface with React and TypeScript, including keyboard navigation and labeled forms." },
  { id: "demo-v1:p2", section: "University project · Campus Planner", text: "Connected the interface to a Python API and used Git with two classmates to review changes." },
  { id: "demo-v1:p3", section: "Coursework", text: "Completed coursework in database design, algorithms, and software engineering." },
] as const;

export const REVIEW_REQUIREMENTS = [
  { id: "demo-job:r1", title: "Build interfaces with React and TypeScript", importance: "Required", status: "Supported", tone: "", source: "demo-v1:p1", explanation: "The project explicitly names both technologies. This supports project experience, not professional employment." },
  { id: "demo-job:r2", title: "Experience building accessible interfaces", importance: "Required", status: "Partially supported", tone: "partial", source: "demo-v1:p1", explanation: "Keyboard navigation and labeled forms are described. Broader accessibility testing and outcomes are not stated." },
  { id: "demo-job:r3", title: "Two years of professional development experience", importance: "Required", status: "Not evidenced", tone: "absent", source: null, explanation: "The example describes a university project. It does not establish two years of professional experience; this is not a judgment about the person’s ability." },
  { id: "demo-job:r4", title: "Docker experience", importance: "Preferred", status: "Not evidenced", tone: "absent", source: null, explanation: "Docker is not mentioned in this résumé version. Ask about relevant experience before adding it." },
] as const;
