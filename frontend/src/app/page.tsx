"use client";

import { useCallback, useEffect, useState } from "react";


import { CurrentAnalysisCard } from "@/components/CurrentAnalysisCard";
import { DashboardStats } from "@/components/DashboardStats";
import { SavedAnalysesSection } from "@/components/SavedAnalysesSection";
import { StatusBanner } from "@/components/StatusBanner";
import type { AnalyzeResponse, SavedAnalysis, UpdateAnalysisRequest} from "@/types/analysis";

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
      setMessage("Analysis completed and saved successfully.");

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

  async function handleUpdateSavedAnalysis(
    analysisId: number,
    updates: UpdateAnalysisRequest
  ) {
    setMessage("");
    setErrorMessage("");

    try {
      const response = await fetch(`http://127.0.0.1:8000/analyses/${analysisId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const updatedAnalysis: SavedAnalysis = await response.json();

      setSavedAnalyses((currentAnalyses) =>
        currentAnalyses.map((analysis) =>
          analysis.id === analysisId ? updatedAnalysis : analysis
        )
      );

      setMessage("Saved application updated successfully.");

      return updatedAnalysis;
    } catch (error) {
      console.error(error);
      setErrorMessage(
        "Could not update the saved application. Make sure FastAPI is running."
      );
      throw error;
    }
  }

  async function handleDeleteSavedAnalysis(analysisId: number) {
    setMessage("");
    setErrorMessage("");

    try {
      const response = await fetch(`http://127.0.0.1:8000/analyses/${analysisId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      setSavedAnalyses((currentAnalyses) =>
        currentAnalyses.filter((analysis) => analysis.id !== analysisId)
      );

      setMessage("Saved application deleted successfully.");
    } catch (error) {
      console.error(error);
      setErrorMessage(
        "Could not delete the saved application. Make sure FastAPI is running."
      );
      throw error;
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
    setAnalysisResult(null);
    setErrorMessage("");
    setMessage("");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
        <section className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-8 shadow-xl shadow-slate-950/40">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-3 inline-flex rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-300">
                AI-powered portfolio project
              </p>

              <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-white md:text-5xl">
                AI Job Application Tracker
              </h1>

              <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300">
                Track job applications, compare your resume against job
                descriptions, and get honest AI feedback to improve your fit
                without exaggerating your experience.
              </p>
            </div>

            <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-3 lg:min-w-96">
              <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Saved
                </p>
                <p className="mt-1 text-2xl font-bold text-white">
                  {savedAnalyses.length}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  AI Feedback
                </p>
                <p className="mt-1 text-2xl font-bold text-white">On</p>
              </div>

              <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Status
                </p>
                <p className="mt-1 text-2xl font-bold text-white">Local</p>
              </div>
            </div>
          </div>
        </section>


        <section className="w-full rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl shadow-slate-950/30">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white">Analyze a Job Match</h2>
            <p className="mt-2 text-sm text-slate-400">
              Add the role details, paste your resume, and paste the job description.
              The analysis will also be saved to your local database.
            </p>
          </div>

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

        <section className="flex flex-col gap-4">
          {isLoading && (
            <StatusBanner
              tone="loading"
              message="Analyzing your resume against the job description. This may take a moment."
            />
          )}

          {message && <StatusBanner tone="success" message={message} />}
          
          {errorMessage && <StatusBanner tone="error" message={errorMessage} />}

          {analysisResult && <CurrentAnalysisCard analysis={analysisResult} />}
        </section>

        <DashboardStats savedAnalyses={savedAnalyses} />

        <SavedAnalysesSection 
          savedAnalyses={savedAnalyses}
          onUpdateAnalysis={handleUpdateSavedAnalysis}
          onDeleteAnalysis={handleDeleteSavedAnalysis} 
        />
      </div>
    </main>
  );
}