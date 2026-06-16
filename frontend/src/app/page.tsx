"use client";

import { useState } from "react";

type AnalyzeResponse = {
  message: string;
  resume_length: number;
  job_description_length: number;
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
            <div className="w-full max-w-xl rounded-lg border border-gray-700 bg-gray-900 p-4 text-sm text-gray-200">
              <h2 className="mb-3 text-lg font-semibold text-white">
                Backend Response
              </h2>

              <p>
                <span className="font-semibold">Message:</span>{" "}
                {analysisResult.message}
              </p>

              <p>
                <span className="font-semibold">Resume length:</span>{" "}
                {analysisResult.resume_length} characters
              </p>

              <p>
                <span className="font-semibold">Job description length:</span>{" "}
                {analysisResult.job_description_length} characters
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}