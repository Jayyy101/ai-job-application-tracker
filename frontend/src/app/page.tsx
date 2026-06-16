"use client";

import { useState } from "react";

export default function Home() {
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [message, setMessage] = useState("");

  function handleAnalyze() {
    if (resumeText.trim() === "" || jobDescription.trim() === "") {
      setMessage("Please fill in both the resume and job description before analyzing.");
      return;
    }

    setMessage("Both fields are filled. Match analysis will be added in a future milestone.");
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
            className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-500"
          >
            Analyze Match
          </button>

          {message && (
            <p className="max-w-xl text-center text-sm text-gray-300">
              {message}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}