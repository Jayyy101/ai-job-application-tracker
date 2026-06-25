"use client";

import { useCallback, useEffect, useState } from "react";

type AnalyzeResponse = {
  match_score: number;
  matched_skills: string[];
  missing_skills: string[];
  summary: string;
  strengths: string[];
  improvement_suggestions: string[];
  honesty_notes: string[];
  resume_length: number;
  job_description_length: number;

  company_name: string | null;
  job_title: string | null;
  job_link: string | null;
  application_status: string;
  notes: string | null;
  follow_up_date: string | null;
};

type SavedAnalysis = {
  id: number;
  resume_text: string;
  job_description: string;

  company_name: string | null;
  job_title: string | null;
  job_link: string | null;
  application_status: string;
  notes: string | null;
  follow_up_date: string | null;

  match_score: number;
  matched_skills: string[];
  missing_skills: string[];
  summary: string;
  strengths: string[];
  improvement_suggestions: string[];
  honesty_notes: string[];

  created_at: string;
};

export default function Home() {
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobLink, setJobLink] = useState("");
  const [applicationStatus, setApplicationStatus] = useState("Interested");
  const [notes, setNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");

  const [message, setMessage] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResponse | null>(
    null
  );

  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);

  const fetchSavedAnalyses = useCallback(async () => {
    try {
      const response = await fetch("http://127.0.0.1:8000/analyses");

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data: SavedAnalysis[] = await response.json();

      setSavedAnalyses(data);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        "Could not load saved analyses. Make sure FastAPI is running."
      );
    }
  }, []);

  useEffect(() => {
    let shouldIgnore = false;

    async function loadSavedAnalyses() {
      try {
        const response = await fetch("http://127.0.0.1:8000/analyses");

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const data: SavedAnalysis[] = await response.json();

        if (!shouldIgnore) {
          setSavedAnalyses(data);
        }
      } catch (error) {
        console.error(error);

        if (!shouldIgnore) {
          setErrorMessage(
            "Could not load saved analyses. Make sure FastAPI is running."
          );
        }
      }
    }

    loadSavedAnalyses();

    return () => {
      shouldIgnore = true;
    };
  }, []);

  async function handleAnalyze() {
    setMessage("");
    setErrorMessage("");
    setAnalysisResult(null);

    if (resumeText.trim() === "" || jobDescription.trim() === "") {
      setErrorMessage(
        "Please fill in both the resume and job description before analyzing."
      );
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resume_text: resumeText,
          job_description: jobDescription,

          company_name: companyName || null,
          job_title: jobTitle || null,
          job_link: jobLink || null,
          application_status: applicationStatus,
          notes: notes || null,
          follow_up_date: followUpDate || null,
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data: AnalyzeResponse = await response.json();

      setAnalysisResult(data);
      setMessage("Backend response received successfully.");

      await fetchSavedAnalyses();
    } catch (error) {
      console.error(error);
      setErrorMessage(
        "Could not connect to the backend. Make sure FastAPI is running."
      );
    } finally {
      setIsLoading(false);
    }
  }

  function clearForm() {
    setCompanyName("");
    setJobTitle("");
    setJobLink("");
    setApplicationStatus("Interested");
    setNotes("");
    setFollowUpDate("");
    setResumeText("");
    setJobDescription("");
    setErrorMessage("");
    setMessage("");
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
        <section className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            AI Job Application Tracker
          </h1>

          <p className="mt-4 text-gray-300">
            Paste your resume and a job description to prepare for AI-powered
            job match analysis.
          </p>
        </section>

        <section className="mx-auto mt-10 w-full max-w-6xl rounded-2xl border border-slate-700 bg-slate-900/60 p-6 shadow-lg">
          <h2 className="mb-6 text-2xl font-bold text-white">Job Details</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Company Name
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="Example: OpenAI"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Job Title
              </label>
              <input
                type="text"
                value={jobTitle}
                onChange={(event) => setJobTitle(event.target.value)}
                placeholder="Example: Software Engineer"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Job Link
              </label>
              <input
                type="url"
                value={jobLink}
                onChange={(event) => setJobLink(event.target.value)}
                placeholder="https://example.com/job"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Application Status
              </label>
              <select
                value={applicationStatus}
                onChange={(event) => setApplicationStatus(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="Interested">Interested</option>
                <option value="Applied">Applied</option>
                <option value="Interviewing">Interviewing</option>
                <option value="Offer">Offer</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Follow-up Date
              </label>
              <input
                type="date"
                value={followUpDate}
                onChange={(event) => setFollowUpDate(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Add notes about this role, referral, or follow-up plan."
                className="min-h-28 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div>
              <label className="mb-2 block text-xl font-bold text-white">
                Resume
              </label>
              <textarea
                value={resumeText}
                onChange={(event) => setResumeText(event.target.value)}
                placeholder="Paste your resume text here..."
                className="min-h-72 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="mb-2 block text-xl font-bold text-white">
                Job Description
              </label>
              <textarea
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
                placeholder="Paste the job description here..."
                className="min-h-72 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isLoading}
              className="rounded-xl bg-blue-600 px-10 py-4 text-lg font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-900"
            >
              {isLoading ? "Analyzing..." : "Analyze Match"}
            </button>

            <button
              type="button"
              onClick={clearForm}
              className="rounded-xl border border-slate-600 px-10 py-4 text-lg font-bold text-slate-200 transition hover:border-slate-400 hover:bg-slate-800"
            >
              Clear Form
            </button>
          </div>
        </section>

        <section className="flex flex-col items-center gap-4">
          {message && (
            <p className="max-w-xl text-center text-sm text-gray-300">
              {message}
            </p>
          )}

          {errorMessage && (
            <p className="max-w-xl rounded-lg border border-red-500 bg-red-950 px-4 py-3 text-center text-sm text-red-200">
              {errorMessage}
            </p>
          )}

          {analysisResult && (
            <div className="w-full max-w-xl rounded-lg border border-gray-700 bg-gray-900 p-5 text-sm text-gray-200">
              <h2 className="mb-4 text-xl font-semibold text-white">
                Match Analysis
              </h2>

              <div className="mb-4 rounded-lg border border-blue-500 bg-blue-950 p-4">
                <p className="text-sm text-blue-200">Match Score</p>
                <p className="text-3xl font-bold text-white">
                  {analysisResult.match_score}%
                </p>
              </div>

              <div className="mb-4">
                <p className="font-semibold text-white">Summary</p>
                <p className="mt-1 text-gray-300">{analysisResult.summary}</p>
              </div>

              <div className="mb-4">
                <p className="font-semibold text-white">Matched Skills</p>

                {analysisResult.matched_skills.length > 0 ? (
                  <ul className="mt-2 list-inside list-disc text-green-300">
                    {analysisResult.matched_skills.map((skill) => (
                      <li key={skill}>{skill}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-gray-400">No matched skills found.</p>
                )}
              </div>

              <div className="mb-4">
                <p className="font-semibold text-white">Missing Skills</p>

                {analysisResult.missing_skills.length > 0 ? (
                  <ul className="mt-2 list-inside list-disc text-red-300">
                    {analysisResult.missing_skills.map((skill) => (
                      <li key={skill}>{skill}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-gray-400">No missing skills found.</p>
                )}
              </div>

              <div className="mb-4">
                <p className="font-semibold text-white">Strengths</p>

                {analysisResult.strengths.length > 0 ? (
                  <ul className="mt-2 list-inside list-disc text-blue-300">
                    {analysisResult.strengths.map((strength) => (
                      <li key={strength}>{strength}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-gray-400">No strengths found.</p>
                )}
              </div>

              <div className="mb-4">
                <p className="font-semibold text-white">
                  Improvement Suggestions
                </p>

                {analysisResult.improvement_suggestions.length > 0 ? (
                  <ul className="mt-2 list-inside list-disc text-yellow-300">
                    {analysisResult.improvement_suggestions.map(
                      (suggestion) => (
                        <li key={suggestion}>{suggestion}</li>
                      )
                    )}
                  </ul>
                ) : (
                  <p className="mt-1 text-gray-400">
                    No improvement suggestions found.
                  </p>
                )}
              </div>

              <div className="mb-4 rounded-lg border border-orange-700 bg-orange-950/40 p-4">
                <p className="font-semibold text-orange-200">Honesty Notes</p>

                {analysisResult.honesty_notes.length > 0 ? (
                  <ul className="mt-2 list-inside list-disc text-orange-200">
                    {analysisResult.honesty_notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-orange-200">
                    No honesty notes found.
                  </p>
                )}
              </div>

              <div className="border-t border-gray-700 pt-4 text-gray-400">
                <p>
                  <span className="font-semibold">Resume length:</span>{" "}
                  {analysisResult.resume_length} characters
                </p>

                <p>
                  <span className="font-semibold">Job description length:</span>{" "}
                  {analysisResult.job_description_length} characters
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-gray-800 bg-gray-900 p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">Saved Analyses</h2>
              <p className="mt-1 text-sm text-gray-400">
                Previous resume and job description match results saved in the database.
              </p>
            </div>

            <p className="text-sm text-gray-400">
              {savedAnalyses.length} saved
            </p>
          </div>

          {savedAnalyses.length === 0 ? (
            <p className="rounded-lg border border-gray-700 bg-gray-950 p-4 text-sm text-gray-400">
              No saved analyses yet. Submit your first analysis to see it here.
            </p>
          ) : (
            <div className="grid gap-4">
              {savedAnalyses.map((analysis) => (
                <article
                  key={analysis.id}
                  className="rounded-lg border border-gray-700 bg-gray-950 p-5"
                >
                  <div className="mb-5 border-b border-slate-700 pb-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-400">Job Application</p>
                        <h3 className="mt-1 text-xl font-bold text-white">
                          {analysis.job_title || "Untitled Role"}
                        </h3>
                        <p className="mt-1 text-slate-300">
                          {analysis.company_name || "Unknown Company"}
                        </p>

                        {analysis.job_link && (
                          <a
                            href={analysis.job_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-block text-sm font-medium text-blue-400 hover:text-blue-300 hover:underline"
                          >
                            View job posting
                          </a>
                        )}
                      </div>

                      <div className="w-fit rounded-full border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300">
                        {analysis.application_status}
                      </div>
                    </div>

                    {(analysis.follow_up_date || analysis.notes) && (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {analysis.follow_up_date && (
                          <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Follow-up Date
                            </p>
                            <p className="mt-1 text-sm text-slate-200">
                              {new Date(`${analysis.follow_up_date}T00:00:00`).toLocaleDateString()}
                            </p>
                          </div>
                        )}

                        {analysis.notes && (
                          <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Notes
                            </p>
                            <p className="mt-1 text-sm text-slate-200">{analysis.notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Match Score</p>
                      <p className="text-2xl font-bold text-blue-400">
                        {analysis.match_score}%
                      </p>
                    </div>

                    <p className="text-sm text-gray-500">
                      {new Date(analysis.created_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="mb-4">
                    <p className="font-semibold text-white">Summary</p>
                    <p className="mt-1 text-sm text-gray-300">{analysis.summary}</p>
                  </div>

                  <div className="mb-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="font-semibold text-white">Matched Skills</p>

                      {analysis.matched_skills.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {analysis.matched_skills.map((skill) => (
                            <span
                              key={skill}
                              className="rounded-full border border-green-700 bg-green-950 px-3 py-1 text-xs text-green-300"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-sm text-gray-500">
                          No matched skills found.
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="font-semibold text-white">Missing Skills</p>

                      {analysis.missing_skills.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {analysis.missing_skills.map((skill) => (
                            <span
                              key={skill}
                              className="rounded-full border border-red-700 bg-red-950 px-3 py-1 text-xs text-red-300"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-sm text-gray-500">
                          No missing skills found.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mb-4 grid gap-4 border-t border-gray-800 pt-4 md:grid-cols-3">
                    <div>
                      <p className="font-semibold text-white">Strengths</p>

                      {analysis.strengths.length > 0 ? (
                        <ul className="mt-2 list-inside list-disc text-sm text-blue-300">
                          {analysis.strengths.map((strength) => (
                            <li key={strength}>{strength}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-sm text-gray-500">
                          No strengths found.
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="font-semibold text-white">
                        Improvement Suggestions
                      </p>

                      {analysis.improvement_suggestions.length > 0 ? (
                        <ul className="mt-2 list-inside list-disc text-sm text-yellow-300">
                          {analysis.improvement_suggestions.map(
                            (suggestion) => (
                              <li key={suggestion}>{suggestion}</li>
                            )
                          )}
                        </ul>
                      ) : (
                        <p className="mt-1 text-sm text-gray-500">
                          No improvement suggestions found.
                        </p>
                      )}
                    </div>

                    <div className="rounded-lg border border-orange-800 bg-orange-950/30 p-3">
                      <p className="font-semibold text-orange-200">
                        Honesty Notes
                      </p>

                      {analysis.honesty_notes.length > 0 ? (
                        <ul className="mt-2 list-inside list-disc text-sm text-orange-200">
                          {analysis.honesty_notes.map((note) => (
                            <li key={note}>{note}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-sm text-orange-200">
                          No honesty notes found.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 border-t border-gray-800 pt-4 md:grid-cols-2">
                    <div>
                      <p className="font-semibold text-white">Resume Preview</p>
                      <p className="mt-1 text-sm text-gray-400">
                        {analysis.resume_text.slice(0, 160)}
                        {analysis.resume_text.length > 160 ? "..." : ""}
                      </p>
                    </div>

                    <div>
                      <p className="font-semibold text-white">Job Description Preview</p>
                      <p className="mt-1 text-sm text-gray-400">
                        {analysis.job_description.slice(0, 160)}
                        {analysis.job_description.length > 160 ? "..." : ""}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}