'use client';

import React, { useCallback, useId, useRef, useState } from 'react';
import { 
  Plus, 
  Calendar, 
  Globe2, 
  ArrowRight, 
  KeyRound,
  CheckCircle,
  History,
  FolderKanban,
  Archive,
  Pencil
} from 'lucide-react';
import { Project, ResearchRun } from '@/types/seo';
import { DEMO_COUNTRIES, DEMO_LANGUAGES } from '@/data/demo-data';
import { useDialogFocus } from '@/hooks/useDialogFocus';

interface ProjectsViewProps {
  projects: Project[];
  runs: ResearchRun[];
  activeProject: Project;
  onSelectProject: (p: Project) => void;
  onCreateProjectDemo: (name: string, country: string, language: string) => void;
  onRenameProject?: (project: Project) => void;
  onArchiveProject?: (project: Project) => void;
  onReopenRun?: (run: ResearchRun) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  runs,
  activeProject,
  onSelectProject,
  onCreateProjectDemo,
  onRenameProject,
  onArchiveProject,
  onReopenRun,
}) => {
  const [subTab, setSubTab] = useState<'projects' | 'runs'>('projects');
  const [showNewModal, setShowNewModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectCountry, setNewProjectCountry] = useState('US');
  const [newProjectLanguage, setNewProjectLanguage] = useState('en');
  const newProjectTitleId = useId();
  const newProjectDescriptionId = useId();
  const newProjectNameId = useId();
  const newProjectCountryId = useId();
  const newProjectLanguageId = useId();
  const newProjectNameRef = useRef<HTMLInputElement>(null);
  const closeNewProjectModal = useCallback(() => setShowNewModal(false), []);
  const newProjectDialogRef = useDialogFocus(
    showNewModal,
    closeNewProjectModal,
    newProjectNameRef,
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    onCreateProjectDemo(newProjectName.trim(), newProjectCountry, newProjectLanguage);
    setNewProjectName('');
    closeNewProjectModal();
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900">Research Projects &amp; Run History</h1>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              PRD FR-01 &amp; FR-06
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Manage research spaces, inspect saved historical research runs, and track market investigations over time.
          </p>
        </div>

        {/* Sub-tab & New Project button */}
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
            role="group"
            aria-label="Project workspace views"
          >
            <button
              type="button"
              aria-pressed={subTab === 'projects'}
              onClick={() => setSubTab('projects')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                subTab === 'projects' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderKanban className="h-3.5 w-3.5" />
              <span>Projects ({projects.length})</span>
            </button>
            <button
              type="button"
              aria-pressed={subTab === 'runs'}
              onClick={() => setSubTab('runs')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                subTab === 'runs' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              <span>Past Runs ({runs.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: Projects Cards */}
      {subTab === 'projects' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((proj) => {
            const isActive = proj.id === activeProject.id;

            return (
              <div
                key={proj.id}
                className={`flex flex-col justify-between rounded-xl border p-5 transition ${
                  isActive
                    ? 'border-indigo-400 bg-indigo-50/20 shadow-md ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      ID: {proj.id}
                    </span>
                    {isActive ? (
                      <span className="flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                        <CheckCircle className="h-3 w-3" /> Active
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelectProject(proj)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        Set Active
                      </button>
                    )}
                  </div>

                  <h3 className="mt-3 text-sm font-bold text-slate-900">{proj.name}</h3>
                  <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                    {proj.description || 'No description provided.'}
                  </p>

                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Globe2 className="h-3.5 w-3.5" /> Target Market:
                      </span>
                      <span className="font-semibold text-slate-800">
                        {proj.target_country} / {proj.target_language}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <KeyRound className="h-3.5 w-3.5" /> Saved Keywords:
                      </span>
                      <span className="font-semibold text-indigo-600">
                        {proj.keyword_count ?? 0} keywords
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" /> Updated:
                      </span>
                      <span>{proj.updated_at}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    proj.archived_at
                      ? 'bg-slate-100 text-slate-600'
                      : 'bg-amber-50 text-amber-700'
                  }`}>
                    {proj.archived_at ? 'Archived' : 'Demo Project'}
                  </span>
                  <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                    {onRenameProject && (
                      <button
                        type="button"
                        onClick={() => onRenameProject(proj)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-indigo-600"
                        aria-label={`Rename ${proj.name}`}
                      >
                        <Pencil className="h-3 w-3" aria-hidden="true" />
                        <span>Rename</span>
                      </button>
                    )}
                    {onArchiveProject && !proj.archived_at && (
                      <button
                        type="button"
                        onClick={() => onArchiveProject(proj)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-amber-700"
                        aria-label={`Archive ${proj.name}`}
                      >
                        <Archive className="h-3 w-3" aria-hidden="true" />
                        <span>Archive</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onSelectProject(proj)}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-indigo-600"
                    >
                      <span>Open Research</span>
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SUB-TAB 2: Research Runs History Table (PRD FR-06) */}
      {subTab === 'runs' && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-bold text-slate-900">Historical Research Runs (PRD FR-06)</h3>
            <p className="text-xs text-slate-500">
              Review previous queries with accurate freshness timestamps and return to their projects.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 pl-5 pr-3">Run ID</th>
                  <th className="px-3 py-3">Seed Keyword</th>
                  <th className="px-3 py-3">Target Market</th>
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="px-3 py-3 text-right">Keywords Captured</th>
                  <th className="px-3 py-3">Started Timestamp</th>
                  <th className="py-3 pl-3 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {runs.map((run) => {
                  const linkedProject = projects.find((project) => project.id === run.project_id);

                  return (
                  <tr key={run.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 pl-5 pr-3 font-mono text-[11px] text-slate-500">
                      {run.id}
                    </td>
                    <td className="px-3 py-3 font-bold text-slate-900">
                      {run.seed_keyword}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {run.country} ({run.language})
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        run.status === 'failed'
                          ? 'bg-rose-100 text-rose-800'
                          : run.status === 'running'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        <CheckCircle className="h-3 w-3" aria-hidden="true" /> {run.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-indigo-600">
                      {run.keywords_found} ideas
                    </td>
                    <td className="px-3 py-3 text-slate-500 text-[11px]">
                      {run.started_at}
                    </td>
                    <td className="py-3 pl-3 pr-5 text-right">
                      {onReopenRun ? (
                        <button
                          type="button"
                          onClick={() => onReopenRun(run)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          <span>Re-inspect Run</span>
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      ) : linkedProject ? (
                        <button
                          type="button"
                          onClick={() => onSelectProject(linkedProject)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          <span>Open Project</span>
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      ) : (
                        <span className="text-[11px] font-medium text-slate-400">Project unavailable</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Project Modal (Demo) */}
      {showNewModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          onClick={closeNewProjectModal}
        >
          <div 
            ref={newProjectDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={newProjectTitleId}
            aria-describedby={newProjectDescriptionId}
            tabIndex={-1}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id={newProjectTitleId} className="text-base font-bold text-slate-900">
              Create New Project (Demo)
            </h3>
            <p id={newProjectDescriptionId} className="mt-1 text-xs text-slate-500">
              Projects isolate keyword lists, SERP history, and AI conclusions.
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label htmlFor={newProjectNameId} className="font-semibold text-slate-700">
                  Project Name
                </label>
                <input
                  ref={newProjectNameRef}
                  id={newProjectNameId}
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g., Dental Practice Local SEO"
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="min-w-0">
                  <label htmlFor={newProjectCountryId} className="font-semibold text-slate-700">
                    Target Country
                  </label>
                  <select
                    id={newProjectCountryId}
                    value={newProjectCountry}
                    onChange={(e) => {
                      const nextCountry = DEMO_COUNTRIES.find(
                        (country) => country.code === e.target.value,
                      );
                      setNewProjectCountry(e.target.value);
                      if (nextCountry) setNewProjectLanguage(nextCountry.defaultLanguage);
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-slate-800 focus:border-indigo-500 focus:outline-none"
                  >
                    {DEMO_COUNTRIES.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.flag} {country.name} ({country.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0">
                  <label htmlFor={newProjectLanguageId} className="font-semibold text-slate-700">
                    Target Language
                  </label>
                  <select
                    id={newProjectLanguageId}
                    value={newProjectLanguage}
                    onChange={(e) => setNewProjectLanguage(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-slate-800 focus:border-indigo-500 focus:outline-none"
                  >
                    {DEMO_LANGUAGES.map((language) => (
                      <option key={language.code} value={language.code}>
                        {language.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-lg bg-amber-50 p-3 text-[11px] text-amber-900 border border-amber-200">
                <strong>Demo Mode:</strong> Project will be stored in client state for this session. Database persistence will be connected in Milestone 6.
              </div>

              <div className="mt-5 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={closeNewProjectModal}
                  className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 shadow-sm shadow-indigo-200"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
