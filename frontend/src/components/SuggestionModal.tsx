import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  IconX,
  IconLoader2,
  IconArrowRight,
  IconCheck,
  IconChevronDown,
} from "@tabler/icons-react";

interface SuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string, body: string) => Promise<void>;
}

type IssueType = "feat" | "fix" | "docs" | "refactor" | "perf";

const SCOPES = [
  "core",
  "ui",
  "system",
  "download",
  "converter",
  "settings",
  "auth",
  "roadmap",
];

export default function SuggestionModal({
  isOpen,
  onClose,
  onSubmit,
}: SuggestionModalProps) {
  const { t } = useTranslation("roadmap");

  // Build issue types with translations
  const ISSUE_TYPES = useMemo(
    () => [
      {
        value: "feat" as IssueType,
        label: t("suggestion.type_feature"),
        description: t("suggestion.type_feature_desc"),
      },
      {
        value: "fix" as IssueType,
        label: t("suggestion.type_fix"),
        description: t("suggestion.type_fix_desc"),
      },
      {
        value: "docs" as IssueType,
        label: t("suggestion.type_docs"),
        description: t("suggestion.type_docs_desc"),
      },
      {
        value: "refactor" as IssueType,
        label: t("suggestion.type_refactor"),
        description: t("suggestion.type_refactor_desc"),
      },
      {
        value: "perf" as IssueType,
        label: t("suggestion.type_perf"),
        description: t("suggestion.type_perf_desc"),
      },
    ],
    [t]
  );

  // Form state
  const [issueType, setIssueType] = useState<IssueType>("feat");
  const [scope, setScope] = useState("core");
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [problem, setProblem] = useState("");
  const [proposal, setProposal] = useState("");
  const [tasks, setTasks] = useState("");
  const [references, setReferences] = useState("");
  const [dependencies, setDependencies] = useState("");

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const resetForm = () => {
    setIssueType("feat");
    setScope("core");
    setTitle("");
    setContext("");
    setProblem("");
    setProposal("");
    setTasks("");
    setReferences("");
    setDependencies("");
    setShowAdvanced(false);
  };

  const handleClose = () => {
    resetForm();
    setSubmitSuccess(false);
    onClose();
  };

  const generateMarkdown = (): string => {
    const sections: string[] = [];

    // Contexto
    if (context.trim()) {
      sections.push(`## Contexto\n\n${context.trim()}`);
    }

    // Problema / Motivação
    if (problem.trim()) {
      const header = issueType === "fix" ? "## Problema Atual" : "## Motivação";
      sections.push(`${header}\n\n${problem.trim()}`);
    }

    // Proposta Técnica
    if (proposal.trim()) {
      sections.push(`## Proposta Técnica\n\n${proposal.trim()}`);
    }

    // Tarefas
    if (tasks.trim()) {
      const taskLines = tasks
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => `- [ ] ${line.trim()}`)
        .join("\n");
      sections.push(`## Tarefas\n\n${taskLines}`);
    }

    // Dependências (opcional)
    if (dependencies.trim()) {
      sections.push(`## Dependência\n\n> ⚠️ ${dependencies.trim()}`);
    }

    // Referências (opcional)
    if (references.trim()) {
      const refLines = references
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => `- ${line.trim()}`)
        .join("\n");
      sections.push(`## Referências\n\n${refLines}`);
    }

    return sections.join("\n\n");
  };

  const generateTitle = (): string => {
    return `${issueType}(${scope}): ${title.trim()}`;
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      const fullTitle = generateTitle();
      const body = generateMarkdown();
      await onSubmit(fullTitle, body);
      setSubmitSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      console.error("Failed to submit suggestion:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-[2px]">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="w-full max-w-2xl bg-white dark:bg-surface-100 rounded-2xl shadow-2xl border border-surface-200 dark:border-white/10 overflow-hidden relative max-h-[90vh] flex flex-col"
      >
        {/* Gradient bar */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-500 via-amber-500 to-purple-500" />

        {submitSuccess ? (
          <div className="p-10 text-center">
            <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
              <IconCheck size={32} stroke={3} />
            </div>
            <h3 className="text-lg font-bold text-surface-900 dark:text-white">
              {t("suggestion.success_title")}
            </h3>
            <p className="text-sm text-surface-500 mt-2">
              {t("suggestion.success_description")}
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 py-5 flex justify-between items-center border-b border-surface-100 dark:border-white/10 shrink-0">
              <h3 className="font-bold text-surface-900 dark:text-white">
                {t("suggestion.modal_title")}
              </h3>
              <button
                onClick={handleClose}
                className="text-surface-400 hover:text-surface-900 dark:hover:text-white transition-colors"
              >
                <IconX size={20} />
              </button>
            </div>

            {/* Form */}
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              {/* Row: Type + Scope + Title */}
              <div className="grid grid-cols-12 gap-3">
                {/* Type */}
                <div className="col-span-3 space-y-1.5">
                  <label className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">
                    {t("suggestion.label_type")}
                  </label>
                  <select
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value as IssueType)}
                    className="w-full bg-surface-50 dark:bg-black/20 border border-surface-200 dark:border-white/10 rounded-lg px-3 py-2.5 text-sm focus:border-primary-500 outline-none appearance-none cursor-pointer dark:text-surface-200"
                  >
                    {ISSUE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Scope */}
                <div className="col-span-3 space-y-1.5">
                  <label className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">
                    {t("suggestion.label_scope")}
                  </label>
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                    className="w-full bg-surface-50 dark:bg-black/20 border border-surface-200 dark:border-white/10 rounded-lg px-3 py-2.5 text-sm focus:border-primary-500 outline-none appearance-none cursor-pointer dark:text-surface-200"
                  >
                    {SCOPES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Title */}
                <div className="col-span-6 space-y-1.5">
                  <label className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">
                    {t("suggestion.label_title")}
                  </label>
                  <input
                    type="text"
                    placeholder={t("suggestion.placeholder_title")}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-surface-50 dark:bg-black/20 border border-surface-200 dark:border-white/10 rounded-lg px-3 py-2.5 text-sm focus:border-primary-500 outline-none dark:text-surface-200"
                  />
                </div>
              </div>

              {/* Preview do título */}
              {title && (
                <div className="text-xs text-surface-400 font-mono bg-surface-50 dark:bg-black/20 px-3 py-2 rounded-lg">
                  {generateTitle()}
                </div>
              )}

              {/* Contexto */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">
                  {t("suggestion.label_context")}
                </label>
                <textarea
                  placeholder={t("suggestion.placeholder_context")}
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  className="w-full bg-surface-50 dark:bg-black/20 border border-surface-200 dark:border-white/10 rounded-lg px-3 py-2.5 text-sm focus:border-primary-500 outline-none h-20 resize-none dark:text-surface-200"
                />
              </div>

              {/* Problema / Motivação */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">
                  {issueType === "fix"
                    ? t("suggestion.label_problem")
                    : t("suggestion.label_motivation")}
                </label>
                <textarea
                  placeholder={
                    issueType === "fix"
                      ? t("suggestion.placeholder_problem")
                      : t("suggestion.placeholder_motivation")
                  }
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  className="w-full bg-surface-50 dark:bg-black/20 border border-surface-200 dark:border-white/10 rounded-lg px-3 py-2.5 text-sm focus:border-primary-500 outline-none h-20 resize-none dark:text-surface-200"
                />
              </div>

              {/* Proposta Técnica */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">
                  {t("suggestion.label_proposal")}
                </label>
                <textarea
                  placeholder={t("suggestion.placeholder_proposal")}
                  value={proposal}
                  onChange={(e) => setProposal(e.target.value)}
                  className="w-full bg-surface-50 dark:bg-black/20 border border-surface-200 dark:border-white/10 rounded-lg px-3 py-2.5 text-sm focus:border-primary-500 outline-none h-20 resize-none dark:text-surface-200"
                />
              </div>

              {/* Tarefas */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">
                  {t("suggestion.label_tasks")}{" "}
                  <span className="text-surface-400 font-normal">
                    {t("suggestion.label_tasks_hint")}
                  </span>
                </label>
                <textarea
                  placeholder={t("suggestion.placeholder_tasks")}
                  value={tasks}
                  onChange={(e) => setTasks(e.target.value)}
                  className="w-full bg-surface-50 dark:bg-black/20 border border-surface-200 dark:border-white/10 rounded-lg px-3 py-2.5 text-sm focus:border-primary-500 outline-none h-20 resize-none font-mono text-xs dark:text-surface-200"
                />
              </div>

              {/* Advanced Toggle */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-xs text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
              >
                <IconChevronDown
                  size={14}
                  className={`transform transition-transform ${
                    showAdvanced ? "rotate-180" : ""
                  }`}
                />
                {t("suggestion.advanced_fields")}
              </button>

              {/* Advanced Fields */}
              {showAdvanced && (
                <div className="space-y-4 pt-2">
                  {/* Dependências */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">
                      {t("suggestion.label_dependencies")}{" "}
                      <span className="text-surface-400 font-normal">
                        {t("suggestion.label_optional")}
                      </span>
                    </label>
                    <input
                      type="text"
                      placeholder={t("suggestion.placeholder_dependencies")}
                      value={dependencies}
                      onChange={(e) => setDependencies(e.target.value)}
                      className="w-full bg-surface-50 dark:bg-black/20 border border-surface-200 dark:border-white/10 rounded-lg px-3 py-2.5 text-sm focus:border-primary-500 outline-none dark:text-surface-200"
                    />
                  </div>

                  {/* Referências */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">
                      {t("suggestion.label_references")}{" "}
                      <span className="text-surface-400 font-normal">
                        {t("suggestion.label_tasks_hint")}
                      </span>
                    </label>
                    <textarea
                      placeholder={t("suggestion.placeholder_references")}
                      value={references}
                      onChange={(e) => setReferences(e.target.value)}
                      className="w-full bg-surface-50 dark:bg-black/20 border border-surface-200 dark:border-white/10 rounded-lg px-3 py-2.5 text-sm focus:border-primary-500 outline-none h-16 resize-none font-mono text-xs dark:text-surface-200"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-surface-100 dark:border-white/10 flex justify-end gap-3 shrink-0 bg-surface-50/50 dark:bg-black/20">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
              >
                {t("suggestion.cancel")}
              </button>
              <button
                onClick={handleSubmit}
                disabled={!title.trim() || isSubmitting}
                className="px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-surface-300 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold shadow-lg transition-all flex items-center gap-2"
              >
                {isSubmitting ? (
                  <IconLoader2 className="animate-spin" size={16} />
                ) : (
                  <IconArrowRight size={16} />
                )}
                {t("suggestion.submit")}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
