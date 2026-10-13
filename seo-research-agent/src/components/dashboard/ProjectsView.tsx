'use client';

import React, { useState } from 'react';
import { 
  Plus, 
  Calendar, 
  Globe2, 
  ArrowRight, 
  KeyRound,
  CheckCircle,
  History,
  FolderKanban
} from 'lucide-react';
import { Project } from '@/types/seo';
import { DEMO_RESEARCH_RUNS } from '@/data/demo-data';

interface ProjectsViewProps {
  projects: Project[];
  activeProject: Project;
  onSelectProject: (p: Project) => void;
  onCreateProjectDemo: (name: string, country: string, language: string) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  activeProject,
  onSelectProject,
  onCreateProjectDemo,
}) => {
  const [subTab, setSubTab] = useState<'projects' | 'runs'>('projects');
  const [showNewModal, setShowNewModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectCountry, setNewProjectCountry] = useState('US');
  const [newProjectLanguage, setNewProjectLanguage] = useState('en');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    onCreateProjectDemo(newProjectName.trim(), newProjectCountry, newProjectLanguage);
    setNewProjectName('');
    setShowNewModal(false);
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">Research Projects &amp; Run History</h2>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              PRD FR-01 &amp; FR-06
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Manage research spaces, inspect saved historical research runs, and track market investigations over time.
          </p>
        </div>

        {/* Sub-tab & New Project button */}
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              onClick={() => setSubTab('projects')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                subTab === 'projects' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderKanban className="h-3.5 w-3.5" />
              <span>Projects ({projects.length})</span>
            </button>
            <button
              onClick={() => setSubTab('runs')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                subTab === 'runs' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              <span>Past Runs ({DEMO_RESEARCH_RUNS.length})</span>
            </button>
          </div>

          <button
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

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded">
                    Demo Project
                  </span>
                  <button
                    onClick={() => onSelectProject(proj)}
                    className="flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-indigo-600"
                  >
                    <span>Open Research</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
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
              Users can reopen and review previous queries with accurate freshness timestamps.
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
                {DEMO_RESEARCH_RUNS.map((run) => (
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
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                        <CheckCircle className="h-3 w-3" /> Completed
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-indigo-600">
                      {run.keywords_found} ideas
                    </td>
                    <td className="px-3 py-3 text-slate-500 text-[11px]">
                      {run.started_at}
                    </td>
                    <td className="py-3 pl-3 pr-5 text-right">
                      <button 
                        onClick={() => {
                          const p = projects.find((x) => x.id === run.project_id);
                          if (p) onSelectProject(p);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        <span>Re-inspect Run</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Project Modal (Demo) */}
      {showNewModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          onClick={() => setShowNewModal(false)}
        >
          <div 
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-900">Create New Project (Demo)</h3>
            <p className="mt-1 text-xs text-slate-500">
              Projects isolate keyword lists, SERP history, and AI conclusions.
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Project Name</label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g., Dental Practice Local SEO"
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Target Country</label>
                  <select
                    value={newProjectCountry}
                    onChange={(e) => setNewProjectCountry(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-slate-800 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="US">🇺🇸 United States (US)</option>
                    <option value="GB">🇬🇧 United Kingdom (GB)</option>
                    <option value="DE">🇩🇪 Germany (DE)</option>
                    <option value="FR">🇫🇷 France (FR)</option>
                    <option value="JP">🇯🇵 Japan (JP)</option>
                    <option value="AU">🇦🇺 Australia (AU)</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Target Language</label>
                  <select
                    value={newProjectLanguage}
                    onChange={(e) => setNewProjectLanguage(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-slate-800 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="en">English (en)</option>
                    <option value="de">German (de)</option>
                    <option value="fr">French (fr)</option>
                    <option value="ja">Japanese (ja)</option>
                  </select>
                </div>
              </div>

              <div className="rounded-lg bg-amber-50 p-3 text-[11px] text-amber-900 border border-amber-200">
                <strong>Demo Mode:</strong> Project will be stored in client state for this session. Database persistence will be connected in Milestone 6.
              </div>

              <div className="mt-5 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
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
