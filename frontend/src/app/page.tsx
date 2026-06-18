"use client";

import { useCallback, useEffect, useState } from "react";

type AnalyzeResponse = {
  match_score: number;
  matched_skills: string[];
  missing_skills: string[];
  summary: string;
  resume_length: number;
  job_description_length: number;
};

type SavedAnalysis = {
  id: number;
  resume_text: string;
  job_description: string;
  match_score: number;
  matched_skills: string[];
  missing_skills: string[];
  summary: string;
  created_at: string;
};

export default function Home() {
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
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
    fetchSavedAnalyses();
  }, [fetchSavedAnalyses]);

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
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data: AnalyzeResponse = await response.json();

      setAnalysisResult(data);
      setMessage("Backend response received successfully.");

      await fetchSavedAnalyses()
    } catch (error) {
      console.error(error);
      setErrorMessage(
        "Could not connect to the backend. Make sure FastAPI is running."
      );
    } finally {
      setIsLoading(false);
    }
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

        <section className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <label htmlFor="resume" className="text-lg font-semibold">
              Resume
            </label>

            <textarea
              id="resume"
              value={resumeText}
              onChange={(event) => setResumeText(event.target.value)}
              placeholder="Paste your resume here..."
              className="min-h-72 rounded-lg border border-gray-700 bg-gray-900 p-4 text-sm text-white outline-none placeholder:text-gray-500 focus:border-blue-500"
            />
          </div>

          <div className="flex flex-col gap-3">
            <label htmlFor="job-description" className="text-lg font-semibold">
              Job Description
            </label>

            <textarea
              id="job-description"
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              placeholder="Paste the job description here..."
              className="min-h-72 rounded-lg border border-gray-700 bg-gray-900 p-4 text-sm text-white outline-none placeholder:text-gray-500 focus:border-blue-500"
            />
          </div>
        </section>

        <section className="flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={isLoading}
            className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-600"
          >
            {isLoading ? "Analyzing..." : "Analyze Match"}
          </button>

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